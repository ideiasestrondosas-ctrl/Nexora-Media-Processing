// Nexora Media Processing — Transcode Worker
// Ficheiro: src/workers/transcode.worker.ts
//
// Worker de transcoding de vídeo com todos os perfis Nexora.
// ADR-002: FFmpeg sempre via executor isolado com timeout.
// ADR-006: Parâmetros GOP obrigatórios em todos os perfis broadcast.
// Progresso em tempo real via Redis pub/sub.

import { Worker, Job as BullJob } from 'bullmq';
import { spawn } from 'child_process';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { AssetStatus, JobStatus } from '@prisma/client';

import { prisma } from '../db/prisma';
import { logger, jobLogger } from '../observability/logger';
import { transcodeDuration } from '../observability/metrics';
import {
  downloadFile,
  uploadFile,
  BUCKETS,
} from '../common/minio';
import { publishTranscodeProgress } from '../common/redis';
import { QUEUE_NAMES, addToDeadLetter } from './queues';
import { TranscodeError } from '../common/errors';
import type { TranscodeJobPayload } from './queues';

// ── Perfis de encoding ────────────────────────────────────────────

interface EncodingProfile {
  name: string;
  videoBitrateK: number;
  maxrateK: number;
  bufsizeK: number;
  gopSize: number;          // keyframe interval (ADR-006)
  pixFmt: string;           // yuv420p obrigatório (ADR-004)
  colorspace: string;
  preset: string;           // libx264 preset
  bFrames: number;          // 0 para broadcast (ADR-006)
  audioBitrateK: number;
  audioSampleRate: number;  // 48000 Hz obrigatório
}

const ENCODING_PROFILES: Record<string, EncodingProfile> = {
  'broadcast-hd': {
    name: 'Nexora Broadcast HD',
    videoBitrateK: 8000,
    maxrateK: 10000,
    bufsizeK: 20000,
    gopSize: 50,       // 2s a 25fps — ADR-006
    pixFmt: 'yuv420p', // ADR-004
    colorspace: 'bt709',
    preset: 'slow',
    bFrames: 0,        // ADR-006: zero B-frames para broadcast
    audioBitrateK: 256,
    audioSampleRate: 48000,
  },
  'ott-hd': {
    name: 'Nexora OTT HD',
    videoBitrateK: 5000,
    maxrateK: 7000,
    bufsizeK: 14000,
    gopSize: 48,       // 2s a 24fps
    pixFmt: 'yuv420p',
    colorspace: 'bt709',
    preset: 'medium',
    bFrames: 2,        // B-frames permitidos em OTT
    audioBitrateK: 192,
    audioSampleRate: 48000,
  },
  'web-sd': {
    name: 'Nexora Web SD',
    videoBitrateK: 2000,
    maxrateK: 3000,
    bufsizeK: 6000,
    gopSize: 60,
    pixFmt: 'yuv420p',
    colorspace: 'bt709',
    preset: 'medium',
    bFrames: 2,
    audioBitrateK: 128,
    audioSampleRate: 48000,
  },
  'proxy': {
    name: 'Nexora Proxy',
    videoBitrateK: 800,
    maxrateK: 1000,
    bufsizeK: 2000,
    gopSize: 60,
    pixFmt: 'yuv420p',
    colorspace: 'bt709',
    preset: 'fast',
    bFrames: 2,
    audioBitrateK: 96,
    audioSampleRate: 48000,
  },
};

// ── Worker ───────────────────────────────────────────────────────

export class TranscodeWorker {
  public readonly name = 'TranscodeWorker';
  private worker: Worker | null = null;

  async start(): Promise<void> {
    const maxConcurrent = Number(process.env.MAX_CONCURRENT_TRANSCODE_JOBS ?? 4);

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
        // Actualizar status do asset para FAILED
        await prisma.asset.update({
          where: { id: job.data.assetId },
          data: { status: AssetStatus.FAILED },
        }).catch(() => {}); // Ignorar erro se asset não existir
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

    // 1. Seleccionar perfil de encoding
    const encodingProfile = ENCODING_PROFILES[profile] ?? ENCODING_PROFILES['broadcast-hd'];
    log.info({ profile: encodingProfile.name }, 'Perfil de encoding seleccionado');

    // 2. Criar directoria temporária
    const tmpDir = await mkdtemp(join(tmpdir(), 'nexora-transcode-'));
    const inputPath = join(tmpDir, 'input');
    const outputPath = join(tmpDir, 'output.mp4');

    try {
      // 3. Descarregar ficheiro do MinIO
      log.info({ inputMinioKey }, 'A descarregar ficheiro para transcode...');
      await downloadFile(BUCKETS.INPUT, inputMinioKey, inputPath);

      // 4. Actualizar job no PostgreSQL
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

      // 5. Construir e executar comando FFmpeg
      // NOTA ADR-002: usar spawn() com array, NUNCA exec() com string
      const ffmpegArgs = this.buildFFmpegArgs(inputPath, outputPath, encodingProfile);
      log.info({ ffmpegArgs }, 'A executar FFmpeg...');

      await this.runFFmpeg(job.id ?? 'unknown', assetId, ffmpegArgs, log);

      // 6. Upload do output para MinIO
      const outputKey = `output/${assetId}/${profile}/output.mp4`;
      log.info({ outputKey }, 'A fazer upload do output...');

      await uploadFile(BUCKETS.OUTPUT, outputKey, outputPath, {
        contentType: 'video/mp4',
        metadata: {
          'x-nexora-asset-id': assetId,
          'x-nexora-profile': profile,
        },
      });

      // 7. Actualizar Asset e Job no PostgreSQL
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
          },
        },
      });

      // 8. Métricas
      const durationSeconds = durationMs / 1000;
      transcodeDuration.observe({ profile }, durationSeconds);

      // 9. Audit log
      await prisma.auditLog.create({
        data: {
          action: 'TRANSCODE_COMPLETED',
          entityType: 'Asset',
          entityId: assetId,
          assetId,
          metadata: { profile, durationMs, outputKey, jobId: job.id },
        },
      });

      log.info({ assetId, durationMs, outputKey }, 'Transcode concluído');

    } finally {
      // Limpar sempre a directoria temporária
      try {
        await rm(tmpDir, { recursive: true, force: true });
      } catch (err) {
        log.warn({ tmpDir, err }, 'Erro ao limpar directoria temporária transcode');
      }
    }
  }

  /**
   * Constrói o array de argumentos FFmpeg para o perfil dado.
   * ADR-002: retorna string[] — NUNCA uma string única para exec()
   */
  private buildFFmpegArgs(
    inputPath: string,
    outputPath: string,
    profile: EncodingProfile
  ): string[] {
    const args: string[] = [
      '-y',                                        // sobrescrever output
      '-i', inputPath,                             // input
      // Vídeo
      '-c:v', 'libx264',
      '-preset', profile.preset,
      '-tune', 'film',
      '-profile:v', 'high',
      '-level:v', '4.1',
      '-pix_fmt', profile.pixFmt,                  // ADR-004: yuv420p
      '-g', profile.gopSize.toString(),            // GOP size — ADR-006
      '-keyint_min', profile.gopSize.toString(),   // keyint_min = gopSize
      '-sc_threshold', '0',                        // desactivar scene detection
      '-flags', '+cgop',                           // Closed GOP — ADR-006
      '-bf', profile.bFrames.toString(),           // B-frames
      '-b:v', `${profile.videoBitrateK}k`,
      '-maxrate', `${profile.maxrateK}k`,
      '-bufsize', `${profile.bufsizeK}k`,
      '-colorspace', profile.colorspace,
      '-color_primaries', profile.colorspace,
      '-color_trc', profile.colorspace,
      '-vsync', 'cfr',                             // CFR obrigatório — ADR-006
      // Áudio
      '-c:a', 'aac',
      '-b:a', `${profile.audioBitrateK}k`,
      '-ar', profile.audioSampleRate.toString(),   // 48000 Hz
      // Container
      '-movflags', '+faststart',                   // Fast Start para streaming
      outputPath,
    ];

    return args;
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

        // Parsear linha de progresso: "frame= 125 fps= 24 q=28.0 size=  1024kB time=00:00:05.00 bitrate=..."
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

          // Publicar progresso via Redis (fire-and-forget)
          publishTranscodeProgress({
            jobId,
            assetId,
            percent,
            fps,
            speed,
            frame,
            eta,
          }).catch(() => {}); // Não falhar o transcode se Redis falhar
        }
      });

      ffmpegProcess.on('close', (code) => {
        clearTimeout(timeoutId);

        if (code === 0) {
          // Publicar 100% ao terminar
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
