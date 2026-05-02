// Nexora Media Processing — Transcode Worker
// Ficheiro: src/workers/transcode.worker.ts
//
// Worker de transcoding de vídeo — orquestra os módulos da pipeline:
//   - NexoraFFmpegCommandBuilder: gera argumentos FFmpeg tipados
//   - NexoraGPUDetector: selecção automática GPU/CPU com cache
//   - NexoraVMAFScorer: validação de qualidade pós-encode (ADR-010)
//   - NexoraJobScheduler: controlo de concorrência por tipo de job
//
// ADR-002: FFmpeg via spawn() com array (nunca exec() com string)
// ADR-004: yuv420p obrigatório — enforçado pelo builder
// ADR-006: Closed GOP — enforçado pelo builder para broadcast
// ADR-010: VMAF score calculado e guardado para todos os outputs

import { Worker, Job as BullJob } from 'bullmq';
import { spawn } from 'child_process';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { AssetStatus, JobStatus } from '@prisma/client';

import { prisma } from '../db/prisma';
import { logger, jobLogger } from '../observability/logger';
import { transcodeDuration, vmafFailures, gpuAvailable } from '../observability/metrics';
import {
  downloadFile,
  uploadFile,
  BUCKETS,
} from '../common/minio';
import { publishTranscodeProgress } from '../common/redis';
import { QUEUE_NAMES, addToDeadLetter } from './queues';
import { TranscodeError } from '../common/errors';
import type { TranscodeJobPayload } from './queues';

// Pipeline modules
import { ffmpegBuilder } from '../pipeline/ffmpeg/builder';
import { detectGPU } from '../pipeline/ffmpeg/gpu-detector';
import { vmafScorer } from '../pipeline/ffmpeg/vmaf';
import { NexoraJobScheduler } from '../pipeline/ffmpeg/scheduler';
import { getRedisClient } from '../common/redis';

// ── Worker ───────────────────────────────────────────────────────

export class TranscodeWorker {
  public readonly name = 'TranscodeWorker';
  private worker: Worker | null = null;
  private scheduler: NexoraJobScheduler | null = null;

  async start(): Promise<void> {
    const maxConcurrent = Number(process.env.MAX_CONCURRENT_TRANSCODE_JOBS ?? 4);

    // Inicializar scheduler com Redis
    const redis = getRedisClient();
    this.scheduler = new NexoraJobScheduler(redis as unknown as Parameters<typeof NexoraJobScheduler.prototype['getMaxCapacity']>[0] extends never ? never : ConstructorParameters<typeof NexoraJobScheduler>[0]);

    this.worker = new Worker(
      QUEUE_NAMES.TRANSCODE,
      async (job: BullJob<TranscodeJobPayload>) => this.process(job),
      {
        connection: {
          host: this.extractRedisHost(),
          port: this.extractRedisPort(),
          maxRetriesPerRequest: null as unknown as number,
          enableReadyCheck: false,
        },
        concurrency: maxConcurrent,
        lockDuration: 14400000, // 4h — transcode pode demorar muito
      }
    );

    this.worker.on('failed', async (job, err) => {
      if (!job) return;
      if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
        await addToDeadLetter(
          QUEUE_NAMES.TRANSCODE, job.id ?? '', job.name,
          job.data, err.message, err.stack, job.attemptsMade
        );
        await prisma.asset.update({
          where: { id: job.data.assetId },
          data: { status: AssetStatus.FAILED },
        }).catch(() => {});
      }
    });

    logger.info({ worker: this.name }, 'TranscodeWorker iniciado');
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      logger.info({ worker: this.name }, 'TranscodeWorker encerrado');
    }
  }

  private async process(job: BullJob<TranscodeJobPayload>): Promise<void> {
    const { assetId, profile, inputMinioKey } = job.data;
    const log = jobLogger(job.id ?? 'unknown', assetId);
    const startTime = Date.now();

    log.info({ assetId, profile }, 'A iniciar transcode');

    // 1. Detectar GPU disponível (com cache Redis 30min)
    const gpuCapability = await detectGPU();
    log.info(
      { gpuAvailable: gpuCapability.available, gpuType: gpuCapability.type },
      'GPU detectada'
    );
    gpuAvailable.set({ gpu_type: gpuCapability.type }, gpuCapability.available ? 1 : 0);

    // 2. Criar directoria temporária
    const tmpDir = await mkdtemp(join(tmpdir(), 'nexora-transcode-'));
    const inputPath = join(tmpDir, 'input');
    const outputPath = join(tmpDir, 'output.mp4');

    // 3. Resolver encoder e tipo de slot
    const commandPair = ffmpegBuilder.build(profile, inputPath, outputPath, gpuCapability);
    const selectedCommand = commandPair.gpu ?? commandPair.cpu;
    const jobType = NexoraJobScheduler.resolveJobType(profile, selectedCommand.encoder);

    // 4. Adquirir slot de concorrência
    const slotResult = this.scheduler
      ? await this.scheduler.acquire(job.id ?? 'unknown', jobType, selectedCommand.encoder)
      : { acquired: true, slot: undefined, currentUsage: 0, maxCapacity: 99 };

    if (!slotResult.acquired) {
      throw new TranscodeError(
        `Sem slots disponíveis para ${jobType} (${slotResult.currentUsage}/${slotResult.maxCapacity})`,
        { jobId: job.id, jobType, profile }
      );
    }

    log.info(
      { encoder: selectedCommand.encoder, jobType, profile },
      'Slot de encoding adquirido'
    );

    try {
      // 5. Descarregar ficheiro do MinIO
      log.info({ inputMinioKey }, 'A descarregar ficheiro para transcode...');
      await downloadFile(BUCKETS.INPUT, inputMinioKey, inputPath);

      // 6. Actualizar job no PostgreSQL
      await prisma.job.updateMany({
        where: {
          assetId,
          type: 'TRANSCODE',
          status: { in: ['PENDING', 'ACTIVE'] },
        },
        data: {
          status: JobStatus.ACTIVE,
          startedAt: new Date(),
        },
      });

      // 7. Executar FFmpeg com o comando gerado pelo builder
      // Tentar GPU primeiro; se falhar, fallback para CPU
      let usedCommand = selectedCommand;
      try {
        log.info(
          { encoder: selectedCommand.encoder, args: selectedCommand.args.slice(0, 6) },
          'A executar FFmpeg...'
        );
        await this.runFFmpeg(job.id ?? 'unknown', assetId, selectedCommand.args, log);
      } catch (gpuErr) {
        if (commandPair.gpu && selectedCommand.encoder !== 'cpu') {
          log.warn(
            { err: String(gpuErr) },
            'GPU encode falhou — a tentar CPU fallback'
          );
          usedCommand = commandPair.cpu;

          // Reconstruir args com paths correctos (o builder já os tem)
          await this.runFFmpeg(job.id ?? 'unknown', assetId, commandPair.cpu.args, log);
        } else {
          throw gpuErr;
        }
      }

      // 8. Upload do output para MinIO
      const outputKey = `output/${assetId}/${profile}/output.mp4`;
      log.info({ outputKey }, 'A fazer upload do output...');

      await uploadFile(BUCKETS.OUTPUT, outputKey, outputPath, {
        contentType: 'video/mp4',
        metadata: {
          'x-nexora-asset-id': assetId,
          'x-nexora-profile': profile,
          'x-nexora-encoder': usedCommand.encoder,
        },
      });

      // 9. Score VMAF (ADR-010) — comparar encoded vs. original
      let vmafResult: Awaited<ReturnType<typeof vmafScorer.score>> | null = null;
      try {
        vmafResult = await vmafScorer.score(inputPath, outputPath, profile);
        log.info({ vmaf: vmafResult }, 'VMAF score calculado');

        if (!vmafResult.passed) {
          vmafFailures.inc({ profile });
          log.warn({ vmaf: vmafResult }, 'VMAF abaixo do threshold — output marcado como degradado');
        }
      } catch (vmafErr) {
        log.warn({ err: String(vmafErr) }, 'VMAF falhou — a continuar sem score');
      }

      // 10. Actualizar Asset e Job no PostgreSQL
      const durationMs = Date.now() - startTime;

      await prisma.asset.update({
        where: { id: assetId },
        data: { status: AssetStatus.AUDIO_PROCESSING },
      });

      await prisma.job.updateMany({
        where: { assetId, type: 'TRANSCODE', status: 'ACTIVE' },
        data: {
          status: JobStatus.COMPLETED,
          completedAt: new Date(),
          result: {
            outputKey: `${BUCKETS.OUTPUT}/${outputKey}`,
            durationMs,
            profile,
            encoder: usedCommand.encoder,
            vmaf: vmafResult ? {
              mean: vmafResult.mean,
              percentile1: vmafResult.percentile1,
              passed: vmafResult.passed,
            } : null,
          },
        },
      });

      // 11. Métricas
      transcodeDuration.observe({ profile }, durationMs / 1000);

      // 12. Audit log
      await prisma.auditLog.create({
        data: {
          action: 'TRANSCODE_COMPLETED',
          entityType: 'Asset',
          entityId: assetId,
          assetId,
          metadata: {
            profile,
            durationMs,
            outputKey,
            encoder: usedCommand.encoder,
            vmafMean: vmafResult?.mean,
            vmafPassed: vmafResult?.passed,
            jobId: job.id,
          } as object,
        },
      });

      log.info(
        { assetId, durationMs, outputKey, encoder: usedCommand.encoder, vmafMean: vmafResult?.mean },
        'Transcode concluído'
      );

    } finally {
      // Libertar slot de concorrência
      if (slotResult.slot && this.scheduler) {
        await this.scheduler.release(slotResult.slot.slotId).catch(() => {});
      }

      // Limpar directoria temporária
      try {
        await rm(tmpDir, { recursive: true, force: true });
      } catch (err) {
        log.warn({ tmpDir, err }, 'Erro ao limpar directoria temporária transcode');
      }
    }
  }

  /**
   * Executa FFmpeg e monitoriza o progresso via stderr.
   * Publica progresso via Redis pub/sub para SSE.
   * ADR-002: usa spawn() com array, nunca exec() com string.
   */
  private async runFFmpeg(
    jobId: string,
    assetId: string,
    args: string[],
    _log: ReturnType<typeof jobLogger>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg';
      const timeout = Number(process.env.FFMPEG_DEFAULT_TIMEOUT_MS ?? 14400000);

      // ADR-002: spawn com array de argumentos (seguro contra injecção)
      const ffmpegProcess = spawn(ffmpegPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderrBuffer = '';
      let totalDuration: number | null = null;

      // Timeout automático
      const timeoutId = setTimeout(() => {
        ffmpegProcess.kill('SIGKILL');
        reject(new TranscodeError(`FFmpeg timeout após ${timeout}ms`, { jobId, assetId }));
      }, timeout);

      // Parsear progresso do stderr
      ffmpegProcess.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stderrBuffer += text;

        // Extrair duração total na primeira leitura
        if (!totalDuration) {
          const durationMatch = text.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
          if (durationMatch) {
            const [, h, m, s] = durationMatch;
            totalDuration = Number(h) * 3600 + Number(m) * 60 + Number(s);
          }
        }

        // Parsear linha de progresso
        const timeMatch = text.match(/time=(\d+):(\d+):(\d+\.?\d*)/);
        const fpsMatch = text.match(/fps=\s*(\d+\.?\d*)/);
        const speedMatch = text.match(/speed=\s*(\d+\.?\d*x)/);
        const frameMatch = text.match(/frame=\s*(\d+)/);

        if (timeMatch && totalDuration) {
          const [, h, m, s] = timeMatch;
          const currentTime = Number(h) * 3600 + Number(m) * 60 + Number(s);
          const percent = Math.min(Math.round((currentTime / totalDuration) * 100), 99);
          const fps = fpsMatch ? Number(fpsMatch[1]) : undefined;
          const speed = speedMatch ? speedMatch[1] : undefined;
          const frame = frameMatch ? Number(frameMatch[1]) : undefined;
          const eta = fps && fps > 0 && totalDuration
            ? Math.round((totalDuration - currentTime) / (fps / 25))
            : undefined;

          publishTranscodeProgress({
            jobId,
            assetId,
            percent,
            fps,
            speed,
            frame,
            eta,
          }).catch(() => {});
        }
      });

      ffmpegProcess.on('close', (code) => {
        clearTimeout(timeoutId);

        if (code === 0) {
          publishTranscodeProgress({ jobId, assetId, percent: 100 }).catch(() => {});
          resolve();
        } else {
          const errorLines = stderrBuffer.split('\n').slice(-10).join('\n');
          reject(new TranscodeError(
            `FFmpeg terminou com código ${code}`,
            { jobId, assetId, exitCode: code, lastLines: errorLines }
          ));
        }
      });

      ffmpegProcess.on('error', (err) => {
        clearTimeout(timeoutId);
        reject(new TranscodeError(
          `Falha ao iniciar FFmpeg: ${err.message}`,
          { jobId, assetId, error: String(err) }
        ));
      });
    });
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
