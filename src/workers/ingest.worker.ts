// Nexora Media Processing — Ingest Worker
// Ficheiro: src/workers/ingest.worker.ts
//
// Recebe um ficheiro, calcula SHA-256, extrai metadata com MediaInfo,
// faz upload para MinIO e cria o registo Asset no PostgreSQL.
// No final, emite job para a fila QC.

import { Worker, Job as BullJob } from 'bullmq';
import { createReadStream, statSync } from 'fs';
import { unlink } from 'fs/promises';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { AssetStatus } from '@prisma/client';

import { prisma } from '../db/prisma';
import { logger, jobLogger } from '../observability/logger';
import { assetsIngested } from '../observability/metrics';
import { uploadFile, BUCKETS } from '../common/minio';
import { enqueueQC, QUEUE_NAMES, addToDeadLetter } from './queues';
import {
  IngestError,
  StorageError,
} from '../common/errors';
import type { IngestJobPayload } from './queues';
import { mediainfoAdapter } from '../pipeline/tools/mediainfo-adapter';

// ── Worker ───────────────────────────────────────────────────────

/**
 * Worker de ingest de ficheiros de media.
 * Processa uma tarefa de cada vez para controlo de recursos.
 */
export class IngestWorker {
  public readonly name = 'IngestWorker';
  private worker: Worker | null = null;

  /** Inicia o worker BullMQ */
  async start(): Promise<void> {
    this.worker = new Worker(
      QUEUE_NAMES.INGEST,
      async (job: BullJob<IngestJobPayload>) => this.process(job),
      {
        connection: {
          host: this.extractRedisHost(),
          port: this.extractRedisPort(),
          maxRetriesPerRequest: null as unknown as number,
          enableReadyCheck: false,
        },
        concurrency: 2, // 2 ingest simultâneos (limitado por I/O, não CPU)
      }
    );

    this.worker.on('failed', async (job, err) => {
      if (!job) return;

      // Mover para dead-letter após esgotar tentativas
      if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
        await addToDeadLetter(
          QUEUE_NAMES.INGEST,
          job.id ?? '',
          job.name,
          job.data,
          err.message,
          err.stack,
          job.attemptsMade
        );
      }
    });

    logger.info({ worker: this.name }, 'IngestWorker iniciado');
  }

  /** Encerra o worker de forma limpa */
  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      logger.info({ worker: this.name }, 'IngestWorker encerrado');
    }
  }

  /** Processa um job de ingest */
  private async process(job: BullJob<IngestJobPayload>): Promise<void> {
    const { filePath, filename, mimeType, profile } = job.data;
    const assetId = uuidv4();
    const log = jobLogger(job.id ?? 'unknown', assetId);

    log.info({ filename, filePath }, 'A iniciar ingest');

    // 1. Verificar que o ficheiro existe e obter tamanho
    let fileSizeBytes: bigint;
    try {
      const stat = statSync(filePath);
      fileSizeBytes = BigInt(stat.size);
    } catch {
      throw new IngestError(`Ficheiro não encontrado: ${filePath}`, { filePath });
    }

    // 2. Calcular SHA-256 via stream (não carregar ficheiro inteiro em memória)
    log.info('A calcular SHA-256...');
    const sha256 = await this.calculateSHA256(filePath);
    log.info({ sha256 }, 'SHA-256 calculado');

    // 3. Verificar se já existe asset com este checksum (evitar duplicados)
    const existing = await prisma.asset.findFirst({
      where: { sha256, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      log.warn({ existingAssetId: existing.id, sha256 }, 'Asset duplicado detectado');
      // Não lançar erro — apenas logar e continuar (pode ser re-ingest intencional)
    }

    // 4. Extrair metadata com MediaInfo (via adaptador type-safe — Prompt 9)
    log.info('A extrair metadata com MediaInfo...');
    const metadata = await mediainfoAdapter.analyzeSafe(filePath);

    // 5. Upload para MinIO (usar stream, não carregar em memória)
    const minioKey = `raw/${assetId}/original/${filename}`;
    log.info({ minioKey }, 'A fazer upload para MinIO...');

    try {
      await uploadFile(BUCKETS.INPUT, minioKey, filePath, {
        contentType: mimeType ?? 'application/octet-stream',
        metadata: {
          'x-nexora-asset-id': assetId,
          'x-nexora-sha256': sha256,
        },
      });
    } catch (error) {
      throw new StorageError(
        `Falha no upload para MinIO: ${minioKey}`,
        { assetId, minioKey, error: String(error) }
      );
    }

    // 6. Criar registo Asset no PostgreSQL
    log.info('A criar registo Asset no PostgreSQL...');
    await prisma.asset.create({
      data: {
        id: assetId,
        filename,
        originalPath: filePath,
        minioKey: `${BUCKETS.INPUT}/${minioKey}`,
        mimeType: mimeType ?? this.inferMimeType(filename),
        size: fileSizeBytes,
        sha256,
        metadata: metadata as object,
        profile: profile ?? 'broadcast-hd',
        status: AssetStatus.QC_RUNNING,
      },
    });

    // 7. Criar entrada no audit log
    await prisma.auditLog.create({
      data: {
        action: 'ASSET_INGESTED',
        entityType: 'Asset',
        entityId: assetId,
        assetId,
        metadata: {
          filename,
          sha256,
          sizeBytes: fileSizeBytes.toString(),
          minioKey,
          jobId: job.id,
        },
      },
    });

    // 8. Emitir job para fila QC
    await enqueueQC({
      assetId,
      profile: profile ?? 'broadcast-hd',
    });

    log.info({ assetId, minioKey }, 'Ingest concluído — job QC enfileirado');

    // 9. Métricas Prometheus
    assetsIngested.inc();

    // 10. Tentar remover ficheiro local após upload bem-sucedido
    try {
      await unlink(filePath);
    } catch (err) {
      log.warn({ filePath, err }, 'Não foi possível remover ficheiro local após ingest');
    }
  }

  /** Calcula o SHA-256 de um ficheiro via stream */
  private async calculateSHA256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256'); // ADR-003: SHA-256 obrigatório
      const stream = createReadStream(filePath);

      stream.on('data', (chunk: unknown) => hash.update(chunk as Buffer));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }


  private inferMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      mxf: 'application/mxf',
      avi: 'video/x-msvideo',
      mkv: 'video/x-matroska',
      ts: 'video/mp2t',
      mts: 'video/mp2t',
      m2ts: 'video/mp2t',
      wav: 'audio/wav',
      aiff: 'audio/aiff',
      mp3: 'audio/mpeg',
      aac: 'audio/aac',
    };
    return mimeTypes[ext ?? ''] ?? 'application/octet-stream';
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
