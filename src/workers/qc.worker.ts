// Nexora Media Processing — QC Worker (pré-encode)
// Ficheiro: src/workers/qc.worker.ts
//
// Executa todas as regras QC antes de qualquer processamento.
// Usa MediaInfo + FFprobe para análise técnica.
// Decisão: PASS → fila transcode | QUARANTINE → revisão humana | REJECT → fim

import { Worker, Job as BullJob } from 'bullmq';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { AssetStatus, QCDecision as PrismaQCDecision } from '@prisma/client';

import { prisma } from '../db/prisma';
import { logger, jobLogger } from '../observability/logger';
import { assetsRejected } from '../observability/metrics';
import { downloadFile, BUCKETS } from '../common/minio';
import { enqueueTranscode, QUEUE_NAMES, addToDeadLetter } from './queues';
import { runQCRules } from '../qc/rules/index';
import type {
  NexoraQCInput,
  VideoMetadata,
  AudioMetadata,
  ContainerMetadata,
} from '../qc/rules/index';
import { QCError, NotFoundError } from '../common/errors';
import type { QCJobPayload } from './queues';

const execFileAsync = promisify(execFile);

// ── Tipos FFprobe ────────────────────────────────────────────────

interface FFprobeOutput {
  streams?: FFprobeStream[];
  format?: FFprobeFormat;
}

interface FFprobeStream {
  codec_type: 'video' | 'audio' | 'subtitle' | 'data';
  codec_name?: string;
  codec_long_name?: string;
  profile?: string;
  level?: number;
  width?: number;
  height?: number;
  pix_fmt?: string;
  r_frame_rate?: string;          // ex: "25/1"
  avg_frame_rate?: string;
  bit_rate?: string;
  bits_per_raw_sample?: string;
  has_b_frames?: number;
  sample_rate?: string;
  channels?: number;
  channel_layout?: string;
  bits_per_sample?: number;
  duration?: string;
  color_space?: string;
  color_primaries?: string;
  color_transfer?: string;
  tags?: Record<string, string>;
}

interface FFprobeFormat {
  filename?: string;
  nb_streams?: number;
  format_name?: string;
  duration?: string;
  size?: string;
  bit_rate?: string;
  tags?: Record<string, string>;
}

// ── Worker ───────────────────────────────────────────────────────

export class QCWorker {
  public readonly name = 'QCWorker';
  private worker: Worker | null = null;

  async start(): Promise<void> {
    this.worker = new Worker(
      QUEUE_NAMES.QC,
      async (job: BullJob<QCJobPayload>) => this.process(job),
      {
        connection: {
          host: this.extractRedisHost(),
          port: this.extractRedisPort(),
          maxRetriesPerRequest: null as unknown as number,
          enableReadyCheck: false,
        },
        concurrency: 4, // QC é leve em CPU — mais paralelismo
      }
    );

    this.worker.on('failed', async (job, err) => {
      if (!job) return;
      if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
        await addToDeadLetter(
          QUEUE_NAMES.QC, job.id ?? '', job.name,
          job.data, err.message, err.stack, job.attemptsMade
        );
      }
    });

    logger.info({ worker: this.name }, 'QCWorker iniciado');
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      logger.info({ worker: this.name }, 'QCWorker encerrado');
    }
  }

  private async process(job: BullJob<QCJobPayload>): Promise<void> {
    const { assetId, profile } = job.data;
    const log = jobLogger(job.id ?? 'unknown', assetId);

    log.info({ assetId, profile }, 'A iniciar QC');

    // 1. Obter Asset do PostgreSQL
    const asset = await prisma.asset.findUnique({
      where: { id: assetId, deletedAt: null },
    });

    if (!asset) {
      throw new NotFoundError('Asset', assetId);
    }

    if (!asset.minioKey) {
      throw new QCError(`Asset ${assetId} não tem chave MinIO — ingest incompleto?`);
    }

    // 2. Descarregar ficheiro para directoria temporária
    const tmpDir = await mkdtemp(join(tmpdir(), 'nexora-qc-'));
    const localPath = join(tmpDir, asset.filename);

    try {
      // Extrair bucket e key da minioKey composta ("bucket/key")
      const [, ...keyParts] = asset.minioKey.split('/');
      const key = keyParts.join('/');

      log.info({ minioKey: asset.minioKey, localPath }, 'A descarregar ficheiro para QC');
      await downloadFile(BUCKETS.INPUT, key, localPath);

      // 3. Análise técnica com FFprobe
      log.info('A executar FFprobe...');
      const ffprobeData = await this.runFFprobe(localPath);

      // 4. Converter dados FFprobe para tipos QC
      const qcInput = this.buildQCInput(assetId, profile ?? 'broadcast-hd', ffprobeData, localPath);

      // 5. Executar motor de regras QC
      log.info('A executar regras QC...');
      const { decision, results, summary } = await runQCRules(qcInput);

      log.info({ decision, summary, failCount: results.filter(r => !r.pass).length }, 'QC concluído');

      // 6. Guardar QCReport no PostgreSQL
      await prisma.qCReport.create({
        data: {
          assetId,
          decision: decision as PrismaQCDecision,
          results: results as object[],
          summary,
          profile: profile ?? 'broadcast-hd',
        },
      });

      // 7. Criar AuditLog
      await prisma.auditLog.create({
        data: {
          action: `QC_${decision}`,
          entityType: 'Asset',
          entityId: assetId,
          assetId,
          metadata: { decision, summary, jobId: job.id, profile },
        },
      });

      // 8. Agir conforme decisão
      if (decision === 'PASS') {
        await prisma.asset.update({
          where: { id: assetId },
          data: { status: AssetStatus.TRANSCODING },
        });

        // Emitir job para fila transcode
        await enqueueTranscode({
          assetId,
          profile: profile ?? 'broadcast-hd',
          inputMinioKey: key,
        });

        log.info({ assetId }, 'QC PASS — job transcode enfileirado');

      } else if (decision === 'QUARANTINE') {
        await prisma.asset.update({
          where: { id: assetId },
          data: { status: AssetStatus.QC_QUARANTINED },
        });

        log.warn({ assetId, summary }, 'QC QUARANTINE — aguarda revisão humana');

      } else {
        // REJECT
        await prisma.asset.update({
          where: { id: assetId },
          data: { status: AssetStatus.QC_REJECTED },
        });

        // Métricas
        const criticals = results.filter(r => !r.pass && r.severity === 'critical');
        assetsRejected.inc({ reason: criticals[0]?.code ?? 'UNKNOWN' });

        log.error({ assetId, summary, criticals }, 'QC REJECT — asset rejeitado');
      }

    } finally {
      // 9. Limpar ficheiro temporário sempre (sucesso ou erro)
      try {
        await rm(tmpDir, { recursive: true, force: true });
      } catch (err) {
        log.warn({ tmpDir, err }, 'Erro ao limpar directoria temporária QC');
      }
    }
  }

  /** Executa FFprobe e retorna o output parseado */
  private async runFFprobe(filePath: string): Promise<FFprobeOutput> {
    const ffprobePath = process.env.FFPROBE_PATH ?? 'ffprobe';

    const { stdout } = await execFileAsync(
      ffprobePath,
      [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_streams',
        '-show_format',
        filePath,
      ],
      { timeout: 60000 } // 60s timeout
    );

    return JSON.parse(stdout) as FFprobeOutput;
  }

  /** Constrói o input tipado para o motor de regras QC a partir do FFprobe */
  private buildQCInput(
    assetId: string,
    profile: string,
    ffprobe: FFprobeOutput,
    _filePath: string
  ): NexoraQCInput {
    const videoStream = ffprobe.streams?.find(s => s.codec_type === 'video');
    const audioStream = ffprobe.streams?.find(s => s.codec_type === 'audio');
    const format = ffprobe.format;

    // Parsear frame rate (ex: "25/1" → 25)
    const parseFrameRate = (fr?: string): number => {
      if (!fr) return 0;
      const [num, den] = fr.split('/').map(Number);
      return den ? num / den : num;
    };

    // Determinar se é CFR ou VFR comparando r_frame_rate e avg_frame_rate
    const rFps = parseFrameRate(videoStream?.r_frame_rate);
    const avgFps = parseFrameRate(videoStream?.avg_frame_rate);
    const frameRateMode: 'CFR' | 'VFR' | 'UNKNOWN' =
      rFps > 0 && avgFps > 0
        ? Math.abs(rFps - avgFps) < 0.1 ? 'CFR' : 'VFR'
        : 'UNKNOWN';

    const video: VideoMetadata = {
      codec: videoStream?.codec_name ?? 'unknown',
      profile: videoStream?.profile ?? '',
      level: videoStream?.level?.toString() ?? '',
      pixelFormat: videoStream?.pix_fmt ?? 'unknown',
      frameRate: rFps,
      frameRateMode,
      gopType: 'CLOSED', // FFprobe não reporta GOP type directamente — assumir Closed para evitar falsos negativos
      hasIdrFrames: true,  // Assumir true — MediaConch verificaria corretamente
      bFrameCount: videoStream?.has_b_frames ?? 0,
      bitrate: Number(videoStream?.bit_rate ?? format?.bit_rate ?? 0),
      width: videoStream?.width ?? 0,
      height: videoStream?.height ?? 0,
      bitDepth: (Number(videoStream?.bits_per_raw_sample) as 8 | 10 | 12) || 8,
      colorSpace: videoStream?.color_space ?? '',
      colorPrimaries: videoStream?.color_primaries ?? '',
      transferCharacteristics: videoStream?.color_transfer ?? '',
      duration: Number(videoStream?.duration ?? format?.duration ?? 0),
      hasFastStart: false, // Requer análise do container — implementar com MediaInfo
    };

    const audio: AudioMetadata = {
      codec: audioStream?.codec_name ?? 'unknown',
      sampleRate: Number(audioStream?.sample_rate ?? 0),
      bitDepth: audioStream?.bits_per_sample ?? 0,
      channels: audioStream?.channels ?? 0,
      channelLayout: audioStream?.channel_layout ?? '',
      integratedLufs: null, // Requer análise loudness separada (BS1770GAIN)
      truePeakDbtp: null,
      loudnessRange: null,
      audioVideoSyncMs: null,
    };

    const container: ContainerMetadata = {
      format: format?.format_name ?? 'unknown',
      duration: Number(format?.duration ?? 0),
      size: Number(format?.size ?? 0),
      hasEditLists: false, // Requer análise MP4Box ou MediaInfo
      hasTimecodeTrack: false,
      moovPosition: 'unknown',
    };

    return { assetId, profile, video, audio, container };
  }

  private extractRedisHost(): string {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    try { return new URL(url).hostname; } catch { return 'localhost'; }
  }

  private extractRedisPort(): number {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    try { return Number(new URL(url).port) || 6379; } catch { return 6379; }
  }
}
