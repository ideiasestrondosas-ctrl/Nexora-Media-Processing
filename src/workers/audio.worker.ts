// Nexora Media Processing — Audio Worker
// Ficheiro: src/workers/audio.worker.ts
//
// Worker de normalização de loudness — delega para NexoraLoudnessNormalizer.
// ADR-005: Two-pass EBU R128 obrigatório.
// ADR-009: BS1770GAIN verificação independente (via NexoraLoudnessNormalizer).
// ADR-002: FFmpeg via execFile/spawn com array (enforçado no módulo loudness).

import { Worker, Job as BullJob } from 'bullmq';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { AssetStatus, JobStatus } from '@prisma/client';

import { prisma } from '../db/prisma';
import { logger, jobLogger } from '../observability/logger';
import {
  downloadFile,
  uploadFile,
  BUCKETS,
} from '../common/minio';
import { QUEUE_NAMES, addToDeadLetter } from './queues';
import { AudioNormalizationError } from '../common/errors';
import type { AudioJobPayload } from './queues';
import { diagnosticEngine } from '../observability/diagnostic-engine';
import { fixSuggestionsApplied } from '../observability/metrics';

// Pipeline module — encapsula toda a lógica two-pass + BS1770GAIN
import { loudnessNormalizer } from '../pipeline/ffmpeg/loudness';

// ── Worker ───────────────────────────────────────────────────────

export class AudioWorker {
  public readonly name = 'AudioWorker';
  private worker: Worker | null = null;

  async start(): Promise<void> {
    this.worker = new Worker(
      QUEUE_NAMES.AUDIO,
      async (job: BullJob<AudioJobPayload>) => this.process(job),
      {
        connection: {
          host: this.extractRedisHost(),
          port: this.extractRedisPort(),
          maxRetriesPerRequest: null as unknown as number,
          enableReadyCheck: false,
        },
        concurrency: 4,
        lockDuration: 1800000, // 30 minutos
      }
    );

    this.worker.on('failed', async (job, err) => {
      if (!job) return;

      // Diagnóstico automático — analisa padrões de falha de áudio
      const diagnostic = diagnosticEngine.onAudioFailed(
        job.id ?? 'unknown',
        job.data.assetId,
        err,
        undefined,                   // bs1770gainXml (não capturado aqui)
        job.data.targetLufs,
        job.data.truePeakLimit,
        job.attemptsMade
      );

      // Registar fixes aplicados nas métricas
      for (const fix of diagnostic.fixes) {
        fixSuggestionsApplied.inc({ fix_id: fix.id });
      }

      if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
        await addToDeadLetter(
          QUEUE_NAMES.AUDIO, job.id ?? '', job.name,
          job.data, err.message, err.stack, job.attemptsMade
        );
        await prisma.asset.update({
          where: { id: job.data.assetId },
          data: { status: AssetStatus.FAILED },
        }).catch(() => {});
      }
    });

    logger.info({ worker: this.name }, 'AudioWorker iniciado');
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      logger.info({ worker: this.name }, 'AudioWorker encerrado');
    }
  }

  public setConcurrency(n: number): void {
    if (this.worker) {
      this.worker.concurrency = n;
      logger.info({ worker: this.name, concurrency: n }, 'Concorrência atualizada dinamicamente');
    }
  }

  private async process(job: BullJob<AudioJobPayload>): Promise<void> {
    const { assetId, inputMinioKey, targetLufs, truePeakLimit } = job.data;
    const log = jobLogger(job.id ?? 'unknown', assetId);

    log.info({ assetId, targetLufs, truePeakLimit }, 'A iniciar normalização de áudio');

    // 1. Criar directoria temporária
    const tmpDir = await mkdtemp(join(tmpdir(), 'nexora-audio-'));
    const inputPath = join(tmpDir, 'input');
    const outputPath = join(tmpDir, 'output_normalized.wav');

    try {
      // 2. Descarregar ficheiro do MinIO
      log.info({ inputMinioKey }, 'A descarregar ficheiro para normalização...');
      await downloadFile(BUCKETS.OUTPUT, inputMinioKey, inputPath);

      // 3. Normalização two-pass EBU R128 via NexoraLoudnessNormalizer
      //    ADR-005: two-pass obrigatório
      //    ADR-009: BS1770GAIN verificação — dentro do módulo
      const result = await loudnessNormalizer.normalize(
        inputPath,
        outputPath,
        targetLufs,
        truePeakLimit,
        (p) => { job.updateProgress(p).catch(() => {}); }
      );

      log.info(
        {
          lufs: result.integratedLufs,
          truePeak: result.truePeak,
          passes: result.passes,
          verifiedByBS1770Gain: result.verifiedByBS1770Gain,
        },
        'Normalização EBU R128 concluída'
      );

      if (!result.verified) {
        throw new AudioNormalizationError(
          `Normalização não passou na verificação. LUFS: ${result.integratedLufs}, Target: ${targetLufs}`,
          { assetId, targetLufs, truePeakLimit, result }
        );
      }

      // 4. Upload do ficheiro normalizado para MinIO
      const outputKey = `output/${assetId}/audio/normalized.wav`;
      await uploadFile(BUCKETS.OUTPUT, outputKey, outputPath, {
        contentType: 'audio/wav',
        metadata: {
          'x-nexora-asset-id': assetId,
          'x-nexora-lufs-target': targetLufs.toString(),
          'x-nexora-lufs-measured': result.integratedLufs.toString(),
          'x-nexora-bs1770gain-verified': result.verifiedByBS1770Gain.toString(),
        },
      });

      // 5. Actualizar Asset e Job
      await prisma.asset.update({
        where: { id: assetId },
        data: { status: AssetStatus.DELIVERING },
      });

      await prisma.job.updateMany({
        where: { assetId, type: 'AUDIO', status: 'ACTIVE' },
        data: {
          status: JobStatus.COMPLETED,
          completedAt: new Date(),
          result: {
            outputKey: `${BUCKETS.OUTPUT}/${outputKey}`,
            targetLufs,
            measuredLufs: result.integratedLufs,
            truePeak: result.truePeak,
            loudnessRange: result.loudnessRange,
            passes: result.passes,
            verifiedByBS1770Gain: result.verifiedByBS1770Gain,
          },
        },
      });

      // 6. Audit log
      await prisma.auditLog.create({
        data: {
          action: 'AUDIO_NORMALIZED',
          entityType: 'Asset',
          entityId: assetId,
          assetId,
          metadata: {
            targetLufs,
            measuredLufs: result.integratedLufs,
            truePeak: result.truePeak,
            passes: result.passes,
            verifiedByBS1770Gain: result.verifiedByBS1770Gain,
            outputKey,
            jobId: job.id,
          } as object,
        },
      });

      log.info({ assetId, outputKey }, 'Normalização de áudio concluída');

    } finally {
      try {
        await rm(tmpDir, { recursive: true, force: true });
      } catch (err) {
        log.warn({ tmpDir, err }, 'Erro ao limpar directoria temporária áudio');
      }
    }
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
