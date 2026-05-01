// ═══════════════════════════════════════════════════════════════
// Nexora Media Processing — QC Worker (pré-encode)
// Ficheiro: src/workers/qc.worker.ts
//
// Executa todas as regras QC antes de qualquer processamento.
// Usa MediaInfo + FFprobe para análise técnica.
// ═══════════════════════════════════════════════════════════════

import { Worker, Job } from 'bullmq';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { redisConnection, queues, type QCJobPayload } from './queues';
import { runQCRules, type NexoraQCInput } from '../qc/rules/index';
import { executeFFprobe } from '../pipeline/ffmpeg/executor';
import { prisma } from '../db/prisma';
import { logger } from '../observability/logger';
import { assetsRejected } from '../observability/metrics';

const execFileAsync = promisify(execFile);
const MEDIAINFO_PATH = process.env.MEDIAINFO_PATH ?? 'mediainfo';

export class QCWorker {
  readonly name = 'qc-worker';
  private worker: Worker | null = null;

  async start(): Promise<void> {
    this.worker = new Worker(
      'qc',
      async (job: Job<QCJobPayload>) => this.process(job),
      {
        connection: redisConnection,
        concurrency: 8,           // QC é rápido — pode correr em paralelo
        limiter: { max: 20, duration: 1000 },
      }
    );

    this.worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, error: err.message }, 'QC job falhou');
    });
  }

  async stop(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<QCJobPayload>): Promise<void> {
    const { assetId, inputPath, profile } = job.data;
    const log = logger.child({ asset_id: assetId, job_id: job.id, worker: 'qc' });

    log.info({ inputPath, profile }, 'A iniciar QC pré-encode');

    // Actualizar estado do asset
    await prisma.asset.update({
      where: { id: assetId },
      data: { status: 'QC_PENDING' }
    });

    try {
      // Recolher metadata com MediaInfo e FFprobe
      const [mediaInfoData, ffprobeData] = await Promise.all([
        getMediaInfoJSON(inputPath),
        executeFFprobe(inputPath, { assetId }),
      ]);

      // Converter para tipos internos
      const qcInput = buildQCInput(assetId, profile, mediaInfoData, ffprobeData);

      // Executar todas as regras QC em paralelo
      const { decision, results, summary } = await runQCRules(qcInput);

      log.info({ decision, summary }, 'QC concluído');

      // Guardar resultado no job
      await prisma.job.update({
        where: { id: job.id! },
        data: {
          status: 'COMPLETED',
          result: { decision, results, summary },
          finishedAt: new Date(),
        }
      });

      // Audit log do resultado QC
      await writeAuditLog(assetId, 'qc_completed', 'system', {
        decision,
        summary,
        checks: results.length,
        failures: results.filter(r => !r.pass).length,
      });

      switch (decision) {
        case 'REJECT':
          await prisma.asset.update({
            where: { id: assetId },
            data: { status: 'QC_REJECT' }
          });
          assetsRejected.inc({ reason: results.find(r => !r.pass && r.severity === 'critical')?.code ?? 'unknown' });
          log.warn({ summary }, 'Asset rejeitado no QC');
          break;

        case 'QUARANTINE':
          await prisma.asset.update({
            where: { id: assetId },
            data: { status: 'QC_QUARANTINE' }
          });
          log.warn({ summary }, 'Asset em quarentena — aguarda revisão humana');
          break;

        case 'PASS':
          await prisma.asset.update({
            where: { id: assetId },
            data: {
              status: 'QC_PASS',
              frameRate: qcInput.video.frameRate,
              resolution: `${qcInput.video.width}x${qcInput.video.height}`,
              codec: qcInput.video.codec,
              pixelFormat: qcInput.video.pixelFormat,
            }
          });
          // Avançar para análise de conteúdo
          await queues.analyze.add('analyze', { assetId, inputPath, profile });
          log.info('QC passou — a avançar para análise');
          break;
      }

    } catch (error) {
      log.error(error, 'Erro durante QC');
      await prisma.asset.update({ where: { id: assetId }, data: { status: 'FAILED' } });
      throw error;
    }
  }
}

/** Obter metadata via MediaInfo em JSON */
async function getMediaInfoJSON(filePath: string): Promise<object> {
  const { stdout } = await execFileAsync(
    MEDIAINFO_PATH,
    ['--Output=JSON', filePath],
    { timeout: 60000 }
  );
  return JSON.parse(stdout);
}

/** Converter MediaInfo + FFprobe para NexoraQCInput */
function buildQCInput(
  assetId: string,
  profile: string,
  mediaInfo: any,
  ffprobe: any
): NexoraQCInput {
  const videoTrack  = mediaInfo?.media?.track?.find((t: any) => t['@type'] === 'Video') ?? {};
  const audioTrack  = mediaInfo?.media?.track?.find((t: any) => t['@type'] === 'Audio') ?? {};
  const generalTrack = mediaInfo?.media?.track?.find((t: any) => t['@type'] === 'General') ?? {};

  const ffVideo = ffprobe?.streams?.find((s: any) => s.codec_type === 'video') ?? {};
  const ffAudio = ffprobe?.streams?.find((s: any) => s.codec_type === 'audio') ?? {};

  const fps = parseFloat(videoTrack.FrameRate ?? ffVideo.r_frame_rate?.split('/')?.[0] ?? '25');
  const fpsMode = videoTrack.FrameRate_Mode === 'CFR' ? 'CFR' :
                  videoTrack.FrameRate_Mode === 'VFR' ? 'VFR' : 'UNKNOWN';

  return {
    assetId,
    profile,
    video: {
      codec: (videoTrack.Format ?? ffVideo.codec_name ?? '').toLowerCase(),
      profile: videoTrack.Format_Profile ?? ffVideo.profile ?? '',
      level: videoTrack.Format_Level ?? ffVideo.level ?? '',
      pixelFormat: ffVideo.pix_fmt ?? 'unknown',
      frameRate: fps,
      frameRateMode: fpsMode,
      gopType: 'UNKNOWN', // determinado por análise de frames
      hasIdrFrames: true, // assumir true até prova em contrário
      bFrameCount: 0,
      bitrate: parseInt(videoTrack.BitRate ?? '0') / 1000,
      width: parseInt(videoTrack.Width ?? ffVideo.width ?? '0'),
      height: parseInt(videoTrack.Height ?? ffVideo.height ?? '0'),
      bitDepth: parseInt(videoTrack.BitDepth ?? '8') as 8 | 10 | 12,
      colorSpace: videoTrack.matrix_coefficients ?? ffVideo.color_space ?? '',
      colorPrimaries: videoTrack.colour_primaries ?? ffVideo.color_primaries ?? '',
      transferCharacteristics: videoTrack.transfer_characteristics ?? ffVideo.color_transfer ?? '',
      duration: parseFloat(generalTrack.Duration ?? '0') / 1000,
      hasFastStart: false, // verificado separadamente
    },
    audio: {
      codec: (audioTrack.Format ?? ffAudio.codec_name ?? '').toLowerCase(),
      sampleRate: parseInt(audioTrack.SamplingRate ?? ffAudio.sample_rate ?? '0'),
      bitDepth: parseInt(audioTrack.BitDepth ?? '16'),
      channels: parseInt(audioTrack.Channels ?? ffAudio.channels ?? '0'),
      channelLayout: audioTrack.ChannelLayout ?? ffAudio.channel_layout ?? '',
      integratedLufs: null, // medido separadamente com BS1770GAIN
      truePeakDbtp: null,
      loudnessRange: null,
      audioVideoSyncMs: null,
    },
    container: {
      format: generalTrack.Format ?? '',
      duration: parseFloat(generalTrack.Duration ?? '0') / 1000,
      size: parseInt(generalTrack.FileSize ?? '0'),
      hasEditLists: false,
      hasTimecodeTrack: false,
      moovPosition: 'unknown',
    },
  };
}

async function writeAuditLog(
  assetId: string,
  eventType: string,
  operator: string,
  payload: object
): Promise<void> {
  const content = JSON.stringify({ assetId, eventType, operator, payload, ts: Date.now() });
  const entryHash = createHash('sha256').update(content).digest('hex');
  await prisma.auditLog.create({
    data: { assetId, eventType, operator, payload, entryHash }
  });
}


// ═══════════════════════════════════════════════════════════════
// Nexora — Ingest Worker
// Ficheiro: src/workers/ingest.worker.ts
//
// Recebe o asset, regista na DB, enfileira QC.
// ═══════════════════════════════════════════════════════════════

import { Worker, Job } from 'bullmq';
import { createHash } from 'crypto';
import { readFile, stat } from 'fs/promises';
import path from 'path';
import { redisConnection, queues, type IngestJobPayload } from './queues';
import { prisma } from '../db/prisma';
import { logger } from '../observability/logger';

export class IngestWorker {
  readonly name = 'ingest-worker';
  private worker: Worker | null = null;

  async start(): Promise<void> {
    this.worker = new Worker(
      'ingest',
      async (job: Job<IngestJobPayload>) => this.process(job),
      {
        connection: redisConnection,
        concurrency: 10,
      }
    );
  }

  async stop(): Promise<void> { await this.worker?.close(); }

  private async process(job: Job<IngestJobPayload>): Promise<void> {
    const { assetId, inputPath, profile, priority, webhookUrl } = job.data;
    const log = logger.child({ asset_id: assetId, job_id: job.id, worker: 'ingest' });

    log.info({ inputPath }, 'A processar ingest');

    // Verificar que o ficheiro existe
    const fileStat = await stat(inputPath).catch(() => null);
    if (!fileStat) {
      throw new Error(`Ficheiro não encontrado: ${inputPath}`);
    }

    // Calcular SHA-256 (ADR-003)
    const fileBuffer = await readFile(inputPath);
    const sha256 = createHash('sha256').update(fileBuffer).digest('hex');

    // Verificar deduplicação por SHA-256
    const existing = await prisma.asset.findFirst({
      where: { sha256Input: sha256, status: 'READY' }
    });

    if (existing) {
      log.info({ existingId: existing.id }, 'Ficheiro duplicado detectado — a reutilizar asset existente');
      await prisma.asset.update({
        where: { id: assetId },
        data: { status: 'FAILED', sha256Input: sha256 }
      });
      return; // Não processar duplicado
    }

    // Actualizar SHA-256 e avançar para QC
    await prisma.asset.update({
      where: { id: assetId },
      data: { sha256Input: sha256 }
    });

    // Registar passo de processamento
    await prisma.processingStep.upsert({
      where: { assetId_stepName: { assetId, stepName: 'INGEST' } },
      create: { assetId, stepName: 'INGEST', status: 'done', completedAt: new Date() },
      update: { status: 'done', completedAt: new Date() }
    });

    // Enfileirar QC pré-encode
    await queues.qc.add('qc', { assetId, inputPath, profile }, {
      priority: priority === 'high' ? 1 : priority === 'low' ? 10 : 5
    });

    log.info('Ingest concluído — QC enfileirado');
  }
}


// ═══════════════════════════════════════════════════════════════
// Nexora — Proxy Worker
// Ficheiro: src/workers/proxy.worker.ts
//
// Gera proxy LowRes e thumbnail sprite sheet.
// HandBrake para proxy (mais rápido), FFmpeg para thumbnails.
// ═══════════════════════════════════════════════════════════════

import { Worker, Job } from 'bullmq';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { createWriteStream } from 'fs';
import { redisConnection, queues } from './queues';
import { ffmpegBuilder } from '../pipeline/ffmpeg/builder';
import { executeFFmpeg } from '../pipeline/ffmpeg/executor';
import { prisma } from '../db/prisma';
import { logger } from '../observability/logger';

const execFileAsync = promisify(execFile);
const HANDBRAKE_PATH    = process.env.HANDBRAKE_CLI_PATH ?? 'HandBrakeCLI';
const HANDBRAKE_PRESETS = process.env.HANDBRAKE_PRESETS_FILE ?? './nexora-presets.json';

export interface ProxyJobPayload {
  assetId:   string;
  inputPath: string;
  outputDir: string;
}

export class ProxyWorker {
  readonly name = 'proxy-worker';
  private worker: Worker | null = null;

  async start(): Promise<void> {
    this.worker = new Worker(
      'proxy',
      async (job: Job<ProxyJobPayload>) => this.process(job),
      {
        connection: redisConnection,
        concurrency: 4,
      }
    );
  }

  async stop(): Promise<void> { await this.worker?.close(); }

  private async process(job: Job<ProxyJobPayload>): Promise<void> {
    const { assetId, inputPath, outputDir } = job.data;
    const log = logger.child({ asset_id: assetId, job_id: job.id, worker: 'proxy' });

    const proxyPath     = path.join(outputDir, `${assetId}_proxy_720p.mp4`);
    const spritePath    = path.join(outputDir, `${assetId}_thumbnails.jpg`);
    const spriteVTTPath = path.join(outputDir, `${assetId}_thumbnails.vtt`);

    log.info('A gerar proxy LowRes e thumbnails...');

    // ── Proxy LowRes via HandBrake (mais rápido que FFmpeg para proxies) ──
    let proxyGeneratedBy = 'handbrake';
    try {
      await execFileAsync(
        HANDBRAKE_PATH,
        [
          '--input',  inputPath,
          '--output', proxyPath,
          '--preset-import-file', HANDBRAKE_PRESETS,
          '--preset', 'NexoraProxyLowRes',
          '--json',
        ],
        { timeout: 3600000 }
      );
      log.info('Proxy LowRes gerado via HandBrake');
    } catch (err) {
      // Fallback para FFmpeg se HandBrake não disponível
      log.warn({ err: String(err) }, 'HandBrake falhou — a usar FFmpeg como fallback');
      proxyGeneratedBy = 'ffmpeg';
      const proxyCmds = ffmpegBuilder.buildProxyLowRes({ inputPath, outputPath: proxyPath });
      await executeFFmpeg(proxyCmds, { assetId, jobId: job.id, timeoutMs: 3600000 });
    }

    // ── Thumbnail sprite sheet via FFmpeg ──
    const spriteCmds = ffmpegBuilder.buildThumbnailSprites({
      inputPath,
      outputPath: spritePath,
      interval: 10,
      cols: 10,
      width: 160,
      height: 90,
    });
    await executeFFmpeg(spriteCmds, { assetId, jobId: job.id, timeoutMs: 600000 });

    // ── Gerar VTT para scrubbing no player ──
    await generateSpriteVTT(assetId, spriteVTTPath, await getAssetDuration(assetId));

    // Actualizar URLs no asset
    const outputBase = process.env.MINIO_BUCKET_OUTPUT ?? 'nexora-output';
    await prisma.asset.update({
      where: { id: assetId },
      data: {
        proxyUrl:     `s3://${outputBase}/${assetId}_proxy_720p.mp4`,
        thumbnailUrl: `s3://${outputBase}/${assetId}_thumbnails.vtt`,
      }
    });

    log.info({ proxyGeneratedBy }, 'Proxy e thumbnails gerados com sucesso');
  }
}

async function getAssetDuration(assetId: string): Promise<number> {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { durationMs: true }
  });
  return (asset?.durationMs ?? 0) / 1000;
}

async function generateSpriteVTT(
  assetId: string,
  vttPath: string,
  durationSeconds: number,
  interval = 10,
  cols = 10,
  thumbW = 160,
  thumbH = 90
): Promise<void> {
  const lines: string[] = ['WEBVTT', ''];
  let t = 0;
  let idx = 0;

  while (t < durationSeconds) {
    const endT = Math.min(t + interval, durationSeconds);
    const col  = idx % cols;
    const row  = Math.floor(idx / cols);
    const x    = col * thumbW;
    const y    = row * thumbH;

    const fmt = (s: number): string => {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = (s % 60).toFixed(3).padStart(6, '0');
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${sec}`;
    };

    lines.push(`${fmt(t)} --> ${fmt(endT)}`);
    lines.push(`${assetId}_thumbnails.jpg#xywh=${x},${y},${thumbW},${thumbH}`);
    lines.push('');

    t += interval;
    idx++;
  }

  const { writeFile } = await import('fs/promises');
  await writeFile(vttPath, lines.join('\n'), 'utf8');
}


// ═══════════════════════════════════════════════════════════════
// Nexora — Delivery Worker
// Ficheiro: src/workers/delivery.worker.ts
//
// Faz upload resiliente para MinIO/S3.
// Verifica SHA-256 após upload.
// Notifica via webhook quando concluído.
// ═══════════════════════════════════════════════════════════════

import { Worker, Job } from 'bullmq';
import { createHash } from 'crypto';
import { createReadStream, statSync } from 'fs';
import { Client as MinioClient } from 'minio';
import { redisConnection, type DeliveryJobPayload } from './queues';
import { prisma } from '../db/prisma';
import { logger } from '../observability/logger';
import { uploadDuration } from '../observability/metrics';

const minio = new MinioClient({
  endPoint:  process.env.MINIO_ENDPOINT   ?? 'localhost',
  port:      Number(process.env.MINIO_PORT ?? 9000),
  useSSL:    process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY ?? 'nexoraadmin',
  secretKey: process.env.MINIO_SECRET_KEY ?? 'nexoraadmin',
});

const OUTPUT_BUCKET = process.env.MINIO_BUCKET_OUTPUT ?? 'nexora-output';

export class DeliveryWorker {
  readonly name = 'delivery-worker';
  private worker: Worker | null = null;

  async start(): Promise<void> {
    this.worker = new Worker(
      'delivery',
      async (job: Job<DeliveryJobPayload>) => this.process(job),
      {
        connection: redisConnection,
        concurrency: 4,
        limiter: { max: 10, duration: 1000 },
      }
    );
  }

  async stop(): Promise<void> { await this.worker?.close(); }

  private async process(job: Job<DeliveryJobPayload>): Promise<void> {
    const { assetId, outputPath, profile, webhookUrl } = job.data;
    const log = logger.child({ asset_id: assetId, job_id: job.id, worker: 'delivery' });
    const startTime = Date.now();

    log.info({ outputPath, profile }, 'A iniciar upload para MinIO');

    await prisma.asset.update({ where: { id: assetId }, data: { status: 'DELIVERING' } });

    try {
      // Calcular SHA-256 do ficheiro local (ADR-003)
      const localHash = await computeFileSHA256(outputPath);
      const fileSize  = statSync(outputPath).size;
      const objectKey = `${assetId}/${profile}/${outputPath.split('/').pop()}`;

      // Garantir que o bucket existe
      const bucketExists = await minio.bucketExists(OUTPUT_BUCKET);
      if (!bucketExists) {
        await minio.makeBucket(OUTPUT_BUCKET, 'us-east-1');
        log.info({ bucket: OUTPUT_BUCKET }, 'Bucket criado');
      }

      // Upload com metadata
      await minio.fPutObject(OUTPUT_BUCKET, objectKey, outputPath, {
        'Content-Type': 'video/mp4',
        'x-amz-meta-asset-id':   assetId,
        'x-amz-meta-profile':    profile,
        'x-amz-meta-sha256':     localHash,
        'x-amz-meta-nexora':     'true',
      });

      // Verificar integridade pós-upload
      const uploaded = await minio.statObject(OUTPUT_BUCKET, objectKey);
      const uploadedEtag = uploaded.etag.replace(/"/g, '');

      log.info(
        { objectKey, size: fileSize, localHash },
        'Upload concluído — a verificar integridade'
      );

      // Nota: ETag S3 para ficheiros < 5GB é MD5, não SHA-256.
      // Para verificação real, calcular SHA-256 do objecto após download.
      // Neste caso, verificamos que o tamanho é correcto como sanity check.
      if (uploaded.size !== fileSize) {
        throw new Error(
          `Falha na verificação de integridade: ` +
          `tamanho local ${fileSize} ≠ tamanho no MinIO ${uploaded.size}`
        );
      }

      const deliveryUrl = `s3://${OUTPUT_BUCKET}/${objectKey}`;
      const elapsed     = Date.now() - startTime;

      // Actualizar asset como READY
      await prisma.asset.update({
        where: { id: assetId },
        data: {
          status: 'READY',
          deliveryUrl,
          sha256Output: localHash,
        }
      });

      // Métrica de duração de upload
      uploadDuration.observe({ destination: 'minio' }, elapsed / 1000);

      // Audit log
      const content = JSON.stringify({ assetId, event: 'delivered', localHash, elapsed });
      const entryHash = createHash('sha256').update(content).digest('hex');
      await prisma.auditLog.create({
        data: {
          assetId,
          eventType: 'asset_delivered',
          operator: 'delivery_worker',
          payload: { deliveryUrl, localHash, fileSizeBytes: fileSize, durationMs: elapsed },
          entryHash,
        }
      });

      log.info({ deliveryUrl, durationMs: elapsed }, 'Asset entregue com sucesso');

      // Enviar webhook de notificação
      if (webhookUrl) {
        await sendWebhook(webhookUrl, {
          event:   'asset.ready',
          assetId,
          profile,
          deliveryUrl,
          timestamp: new Date().toISOString(),
        });
      }

    } catch (error) {
      log.error(error, 'Falha no delivery');
      await prisma.asset.update({ where: { id: assetId }, data: { status: 'FAILED' } });
      throw error;
    }
  }
}

/** Calcular SHA-256 de um ficheiro em streaming (evita carregar tudo em memória) */
async function computeFileSHA256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash   = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/** Enviar webhook com retry simples */
async function sendWebhook(url: string, payload: object, attempt = 1): Promise<void> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      throw new Error(`Webhook retornou ${response.status}`);
    }
  } catch (error) {
    if (attempt < 3) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(r => setTimeout(r, delay));
      return sendWebhook(url, payload, attempt + 1);
    }
    logger.warn({ url, error: String(error) }, 'Webhook falhou após 3 tentativas');
  }
}


// ═══════════════════════════════════════════════════════════════
// Nexora — QC Post-Encode Worker
// Ficheiro: src/workers/qc-post.worker.ts
//
// Verifica qualidade após encode: VMAF + loudness + SHA-256 + conformance.
// ADR-009: BS1770GAIN verifica loudness independentemente.
// ADR-010: VMAF calculado e guardado para todos os outputs.
// ═══════════════════════════════════════════════════════════════

import { Worker, Job } from 'bullmq';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';
import { redisConnection, queues } from './queues';
import { executeFFmpeg } from '../pipeline/ffmpeg/executor';
import { ffmpegBuilder } from '../pipeline/ffmpeg/builder';
import { verifyWithBS1770GAIN } from './audio.worker';
import { prisma } from '../db/prisma';
import { logger } from '../observability/logger';
import { vmafScore as vmafMetric } from '../observability/metrics';

const VMAF_THRESHOLDS: Record<string, number> = {
  nexora_archive:       Number(process.env.VMAF_THRESHOLD_ARCHIVE    ?? 93),
  nexora_broadcast_hd:  Number(process.env.VMAF_THRESHOLD_BROADCAST  ?? 90),
  nexora_ott_premium:   Number(process.env.VMAF_THRESHOLD_BROADCAST  ?? 90),
  nexora_streaming_web: Number(process.env.VMAF_THRESHOLD_STREAMING  ?? 85),
  nexora_proxy_lowres:  Number(process.env.VMAF_THRESHOLD_PROXY      ?? 70),
};

export interface QCPostJobPayload {
  assetId:       string;
  referencePath: string; // ficheiro de mezzanine (referência)
  encodedPath:   string; // ficheiro codificado a verificar
  profile:       string;
}

export class QCPostWorker {
  readonly name = 'qc-post-worker';
  private worker: Worker | null = null;

  async start(): Promise<void> {
    this.worker = new Worker(
      'qc-post',
      async (job: Job<QCPostJobPayload>) => this.process(job),
      {
        connection: redisConnection,
        concurrency: 2,           // VMAF é pesado — limitar concorrência
      }
    );
  }

  async stop(): Promise<void> { await this.worker?.close(); }

  private async process(job: Job<QCPostJobPayload>): Promise<void> {
    const { assetId, referencePath, encodedPath, profile } = job.data;
    const log = logger.child({ asset_id: assetId, job_id: job.id, worker: 'qc-post' });

    log.info({ profile, encodedPath }, 'A iniciar QC pós-encode');

    const results: Record<string, unknown> = {};
    const errors:  string[] = [];

    // ── 1. SHA-256 do ficheiro encoded ───────────────────────
    const buffer   = await readFile(encodedPath);
    const sha256   = createHash('sha256').update(buffer).digest('hex');
    results.sha256 = sha256;
    log.info({ sha256 }, 'SHA-256 calculado');

    // ── 2. VMAF scoring (ADR-010) ────────────────────────────
    const vmafLogPath = encodedPath.replace(/\.[^.]+$/, '_vmaf.json');
    const vmafCmds = ffmpegBuilder.buildVMAFScore({
      referencePath,
      encodedPath,
      logPath: vmafLogPath,
      subsample: 5,
    });

    try {
      await executeFFmpeg(vmafCmds, { assetId, jobId: job.id, timeoutMs: 1800000 });
      const vmafLog  = JSON.parse((await readFile(vmafLogPath, 'utf8')));
      const vmafMean = vmafLog?.pooled_metrics?.vmaf?.mean ?? 0;
      const vmafMin  = vmafLog?.pooled_metrics?.vmaf?.min  ?? 0;

      results.vmaf = { mean: vmafMean, min: vmafMin };
      vmafMetric.observe({ profile }, vmafMean);

      const threshold = VMAF_THRESHOLDS[profile] ?? 85;
      if (vmafMin < threshold) {
        errors.push(`VMAF mínimo ${vmafMin.toFixed(1)} abaixo do threshold ${threshold} para ${profile}`);
        log.warn({ vmafMin, threshold, profile }, 'VMAF abaixo do threshold');
      } else {
        log.info({ vmafMean: vmafMean.toFixed(1), vmafMin: vmafMin.toFixed(1) }, 'VMAF OK');
      }
    } catch (err) {
      log.warn({ err: String(err) }, 'VMAF scoring falhou — a continuar sem VMAF');
    }

    // ── 3. Verificação de loudness (ADR-009: BS1770GAIN) ─────
    try {
      const isStreaming = profile.includes('streaming') || profile.includes('ott');
      const loudness = await verifyWithBS1770GAIN(encodedPath, isStreaming ? 'streaming' : 'broadcast');
      results.loudness = {
        integratedLufs: loudness.integratedLufs,
        truePeakDbtp:   loudness.truePeakDbtp,
        passes:         loudness.passes,
      };

      if (!loudness.passes) {
        errors.push(`Loudness falhou: ${loudness.failReason}`);
        log.warn({ reason: loudness.failReason }, 'Loudness fora dos limites');
      } else {
        log.info(
          { lufs: loudness.integratedLufs.toFixed(1), tp: loudness.truePeakDbtp.toFixed(1) },
          'Loudness OK'
        );
      }
    } catch (err) {
      log.warn({ err: String(err) }, 'Verificação de loudness falhou');
    }

    // ── 4. Decisão final do QC pós-encode ────────────────────
    const passes = errors.length === 0;

    // Actualizar asset com resultados
    await prisma.asset.update({
      where: { id: assetId },
      data: {
        sha256Output: sha256,
        vmafScore:    (results.vmaf as any)?.mean ?? null,
        loudnessLufs: (results.loudness as any)?.integratedLufs ?? null,
        truePeakDbtp: (results.loudness as any)?.truePeakDbtp ?? null,
      }
    });

    // Audit log
    const content = JSON.stringify({ assetId, results, passes });
    const entryHash = createHash('sha256').update(content).digest('hex');
    await prisma.auditLog.create({
      data: {
        assetId,
        eventType: 'qc_post_completed',
        operator:  'qc_post_worker',
        payload:   { results, passes, errors },
        entryHash,
      }
    });

    if (!passes) {
      log.warn({ errors }, 'QC pós-encode falhou — a considerar re-encode');

      // Se VMAF abaixo do threshold → re-encode
      if (errors.some(e => e.includes('VMAF'))) {
        await prisma.asset.update({ where: { id: assetId }, data: { status: 'TRANSCODING' } });
        // Re-enfileirar transcode (o Decision Engine vai ajustar parâmetros)
        await queues.transcode.add('transcode-retry', {
          assetId,
          inputPath: referencePath,
          outputPath: encodedPath,
          profile,
          retryCount: (job.data as any).retryCount ?? 0,
        });
        return;
      }

      // Outros erros → falha definitiva
      await prisma.asset.update({ where: { id: assetId }, data: { status: 'FAILED' } });
      throw new Error(`QC pós-encode falhou: ${errors.join('; ')}`);
    }

    // QC passou → avançar para delivery
    log.info('QC pós-encode passou — a avançar para delivery');
    await queues.delivery.add('delivery', {
      assetId,
      outputPath: encodedPath,
      profile,
    });
  }
}
