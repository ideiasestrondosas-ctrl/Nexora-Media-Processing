// Nexora Media Processing — Proxy Worker
// Ficheiro: src/workers/proxy.worker.ts
//
// Gera proxy LowRes e thumbnail sprite sheet.
// HandBrake para proxy (mais rápido), FFmpeg para thumbnails.

import { Worker, Job as BullJob } from 'bullmq';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { AssetStatus } from '@prisma/client';

import { prisma } from '../db/prisma';
import { logger, jobLogger } from '../observability/logger';
import { downloadFile, uploadFile, BUCKETS } from '../common/minio';
import { QUEUE_NAMES, addToDeadLetter } from './queues';
import { handbrakeAdapter } from '../pipeline/tools/handbrake-adapter';
import { NotFoundError } from '../common/errors';

const execFileAsync = promisify(execFile);

// ── Tipos ────────────────────────────────────────────────────────

export interface ProxyJobPayload {
  assetId: string;
  /** Chave MinIO do ficheiro original */
  inputMinioKey: string;
  /** Gerar thumbnail sprite sheet (scrubbing) */
  generateSprites?: boolean;
}

// ── Worker ───────────────────────────────────────────────────────

export class ProxyWorker {
  public readonly name = 'ProxyWorker';
  private worker: Worker | null = null;

  async start(): Promise<void> {
    this.worker = new Worker(
      QUEUE_NAMES.QC, // reutiliza a fila QC para prioridade baixa
      async (job: BullJob<ProxyJobPayload>) => this.process(job),
      {
        connection: {
          host: this.extractRedisHost(),
          port: this.extractRedisPort(),
          maxRetriesPerRequest: null as unknown as number,
          enableReadyCheck: false,
        },
        concurrency: 2, // proxies são leves em CPU
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

    logger.info({ worker: this.name }, 'ProxyWorker iniciado');
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      logger.info({ worker: this.name }, 'ProxyWorker encerrado');
    }
  }

  public setConcurrency(n: number): void {
    if (this.worker) {
      this.worker.concurrency = n;
      logger.info({ worker: this.name, concurrency: n }, 'Concorrência atualizada dinamicamente');
    }
  }

  private async process(job: BullJob<ProxyJobPayload>): Promise<void> {
    const { assetId, inputMinioKey, generateSprites = true } = job.data;
    const log = jobLogger(job.id ?? 'unknown', assetId);

    log.info({ assetId, inputMinioKey }, 'A iniciar geração de proxy');

    const asset = await prisma.asset.findUnique({
      where: { id: assetId, deletedAt: null },
    });

    if (!asset) throw new NotFoundError('Asset', assetId);

    const tmpDir = await mkdtemp(join(tmpdir(), 'nexora-proxy-'));

    try {
      const extractKey = (minioKey: string) => minioKey.split('/').slice(1).join('/');
      const inputKey = extractKey(inputMinioKey);

      const localInput    = join(tmpDir, asset.filename);
      const proxyPath     = join(tmpDir, `proxy_${asset.filename}`);
      const previewPath   = join(tmpDir, `preview_${asset.filename}`);
      const spritePath    = join(tmpDir, 'sprites.jpg');

      // Descarregar ficheiro original
      log.info({ inputMinioKey, localInput }, 'A descarregar ficheiro para proxy');
      await downloadFile(BUCKETS.INPUT, inputKey, localInput);

      // 1. Gerar proxy (HandBrake — preset Proxy 480p)
      log.info('A gerar proxy com HandBrake...');
      const proxyResult = await handbrakeAdapter.generateProxy(localInput, proxyPath, {
        onProgress: (pct, eta) => {
          log.debug({ pct, eta }, `Proxy: ${pct.toFixed(1)}%`);
        },
      });

      log.info(
        { durationMs: proxyResult.durationMs, avgFps: proxyResult.avgFps, sizeBytes: proxyResult.outputSizeBytes },
        'Proxy gerado com HandBrake'
      );

      // 2. Gerar quick preview (HandBrake — preset Quick Preview 360p)
      log.info('A gerar quick preview com HandBrake...');
      const previewResult = await handbrakeAdapter.generatePreview(localInput, previewPath);

      log.info(
        { durationMs: previewResult.durationMs, sizeBytes: previewResult.outputSizeBytes },
        'Quick preview gerado'
      );

      // 3. Gerar thumbnail sprite sheet via FFmpeg (se solicitado)
      let spriteMinioKey: string | null = null;
      if (generateSprites) {
        log.info('A gerar sprite sheet de thumbnails...');
        try {
          await this.generateSpriteSheet(localInput, spritePath);
          // Upload sprite para MinIO
          const spriteKey = `proxies/${assetId}/sprites.jpg`;
          await uploadFile(BUCKETS.INPUT, spriteKey, spritePath, { contentType: 'image/jpeg' });
          spriteMinioKey = `${BUCKETS.INPUT}/${spriteKey}`;
          log.info({ spriteMinioKey }, 'Sprite sheet gerado e carregado');
        } catch (err) {
          log.warn({ err: String(err) }, 'Falha ao gerar sprite sheet — a continuar sem sprites');
        }
      }

      // 4. Upload dos proxies para MinIO
      const proxyKey   = `proxies/${assetId}/proxy_${asset.filename}`;
      const previewKey = `proxies/${assetId}/preview_${asset.filename}`;

      await Promise.all([
        uploadFile(BUCKETS.INPUT, proxyKey, proxyPath, { contentType: 'video/mp4' }),
        uploadFile(BUCKETS.INPUT, previewKey, previewPath, { contentType: 'video/mp4' }),
      ]);

      const proxyMinioKey   = `${BUCKETS.INPUT}/${proxyKey}`;
      const previewMinioKey = `${BUCKETS.INPUT}/${previewKey}`;

      log.info({ proxyMinioKey, previewMinioKey }, 'Proxies carregados para MinIO');

      // 5. Atualizar Asset com chaves dos proxies
      await prisma.asset.update({
        where: { id: assetId },
        data: {
          thumbnailKey: spriteMinioKey ?? previewMinioKey,
        },
      });

      // 6. Audit log
      await prisma.auditLog.create({
        data: {
          action: 'PROXY_GENERATED',
          entityType: 'Asset',
          entityId: assetId,
          assetId,
          metadata: {
            proxyMinioKey,
            previewMinioKey,
            spriteMinioKey,
            proxyDurationMs: proxyResult.durationMs,
            proxyAvgFps: proxyResult.avgFps,
            proxySizeBytes: proxyResult.outputSizeBytes,
          },
        },
      });

      log.info({ assetId }, 'ProxyWorker concluído');

    } finally {
      try {
        await rm(tmpDir, { recursive: true, force: true });
      } catch (err) {
        log.warn({ tmpDir, err }, 'Erro ao limpar directoria temporária Proxy');
      }
    }
  }

  /**
   * Gera thumbnail sprite sheet via FFmpeg.
   * 1 thumbnail por cada 10 segundos, organizado em grid 10×N.
   * Útil para scrubbing no player de vídeo.
   */
  private async generateSpriteSheet(inputPath: string, outputPath: string): Promise<void> {
    const ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg';

    // Extrair 1 frame por cada 10 segundos, redimensionar para 160x90, grid 10 colunas
    await execFileAsync(
      ffmpegPath,
      [
        '-y',
        '-i', inputPath,
        '-vf', 'fps=1/10,scale=160:90,tile=10x999',
        '-frames:v', '1',
        '-q:v', '3',
        outputPath,
      ],
      { timeout: 120_000 } // 2min
    );
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
