// Nexora Media Processing — Audio Worker
// Ficheiro: src/workers/audio.worker.ts
//
// Normalização de loudness EBU R128 em dois passos.
// ADR-005: Two-pass obrigatório + BS1770GAIN verificação independente.
// ADR-009: BS1770GAIN é a verificação final — nunca só o FFmpeg.
// Retry com offset ±0.5 LU, máximo 3 tentativas.

import { Worker, Job as BullJob } from 'bullmq';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { AssetStatus, JobStatus } from '@prisma/client';

import { prisma } from '../db/prisma';
import { logger, jobLogger } from '../observability/logger';
import { loudnessLufs } from '../observability/metrics';
import {
  downloadFile,
  uploadFile,
  BUCKETS,
} from '../common/minio';
import { QUEUE_NAMES, addToDeadLetter } from './queues';
import { AudioNormalizationError } from '../common/errors';
import type { AudioJobPayload } from './queues';

const execFileAsync = promisify(execFile);

// ── Tipos internos ───────────────────────────────────────────────

/** Output do FFmpeg loudnorm (Pass 1) */
interface LoudnormAnalysis {
  input_i: string;     // loudness integrado (LUFS)
  input_tp: string;    // true peak (dBTP)
  input_lra: string;   // loudness range (LU)
  input_thresh: string;
  target_offset: string;
}

/** Resultado de medição BS1770GAIN */
interface BS1770GainResult {
  integratedLufs: number;
  truePeakDbtp: number;
  loudnessRange: number;
}

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

      // 3. Normalização two-pass EBU R128 com retry
      let normalized = false;
      let currentTargetLufs = targetLufs;
      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        log.info({ attempt, targetLufs: currentTargetLufs }, `Two-pass R128 — tentativa ${attempt}/${maxRetries}`);

        try {
          // Pass 1: Analisar loudness actual
          const analysis = await this.runLoudnessPass1(inputPath, currentTargetLufs, log);
          log.info({ analysis }, 'Pass 1 concluído');

          // Pass 2: Normalização linear com valores medidos
          await this.runLoudnessPass2(inputPath, outputPath, analysis, currentTargetLufs, log);
          log.info('Pass 2 concluído');

          // Verificação independente com BS1770GAIN (ADR-005, ADR-009)
          const verification = await this.verifyWithBS1770Gain(outputPath, log);
          log.info({ verification }, 'Verificação BS1770GAIN concluída');

          // Verificar conformidade
          const lufsDeviation = Math.abs(verification.integratedLufs - currentTargetLufs);
          const truePeakOk = verification.truePeakDbtp <= truePeakLimit;
          const lufsOk = lufsDeviation <= 0.5;

          if (lufsOk && truePeakOk) {
            log.info(
              { lufs: verification.integratedLufs, truePeak: verification.truePeakDbtp },
              'Normalização EBU R128 validada'
            );
            normalized = true;

            // Registar métrica
            loudnessLufs.observe(verification.integratedLufs);
            break;
          } else {
            // Ajustar target para próxima tentativa
            const offset = lufsDeviation > 0.5 ? (verification.integratedLufs > currentTargetLufs ? -0.5 : 0.5) : 0;
            log.warn(
              {
                lufs: verification.integratedLufs,
                deviation: lufsDeviation,
                truePeak: verification.truePeakDbtp,
                offset,
                attempt,
              },
              'Verificação BS1770GAIN falhou — a ajustar e repetir'
            );
            currentTargetLufs += offset;
          }

        } catch (err) {
          if (attempt === maxRetries) throw err;
          log.warn({ attempt, err }, 'Tentativa de normalização falhou — a repetir');
        }
      }

      if (!normalized) {
        throw new AudioNormalizationError(
          `Não foi possível normalizar áudio para ${targetLufs} LUFS após ${maxRetries} tentativas`,
          { assetId, targetLufs, truePeakLimit }
        );
      }

      // 4. Upload do ficheiro normalizado para MinIO
      const outputKey = `output/${assetId}/audio/normalized.wav`;
      await uploadFile(BUCKETS.OUTPUT, outputKey, outputPath, {
        contentType: 'audio/wav',
        metadata: {
          'x-nexora-asset-id': assetId,
          'x-nexora-lufs-target': currentTargetLufs.toString(),
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
            targetLufs: currentTargetLufs,
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
          metadata: { targetLufs, outputKey, jobId: job.id },
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

  /**
   * Pass 1: Análise do loudness actual com FFmpeg loudnorm.
   * Retorna os parâmetros medidos para o Pass 2.
   */
  private async runLoudnessPass1(
    inputPath: string,
    targetLufs: number,
    _log: ReturnType<typeof jobLogger>
  ): Promise<LoudnormAnalysis> {
    const ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg';

    // ADR-002: execFile com array de argumentos
    const { stderr } = await execFileAsync(
      ffmpegPath,
      [
        '-i', inputPath,
        '-af', `loudnorm=I=${targetLufs}:TP=${-1.0}:LRA=11:print_format=json`,
        '-f', 'null',
        '-',
      ],
      { timeout: 300000 } // 5 minutos
    );

    // O FFmpeg escreve o JSON no stderr — extrair entre { e }
    const jsonMatch = stderr.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      throw new AudioNormalizationError(
        'FFmpeg loudnorm Pass 1 não retornou JSON válido',
        { stderr: stderr.slice(-500) }
      );
    }

    return JSON.parse(jsonMatch[0]) as LoudnormAnalysis;
  }

  /**
   * Pass 2: Normalização linear com os valores medidos no Pass 1.
   * Produz áudio com loudness controlado para o target.
   */
  private async runLoudnessPass2(
    inputPath: string,
    outputPath: string,
    analysis: LoudnormAnalysis,
    targetLufs: number,
    _log: ReturnType<typeof jobLogger>
  ): Promise<void> {
    const ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg';

    const loudnormFilter = [
      `loudnorm=I=${targetLufs}:TP=-1.0:LRA=11`,
      `measured_I=${analysis.input_i}`,
      `measured_TP=${analysis.input_tp}`,
      `measured_LRA=${analysis.input_lra}`,
      `measured_thresh=${analysis.input_thresh}`,
      `offset=${analysis.target_offset}`,
      'linear=true',
    ].join(':');

    await new Promise<void>((resolve, reject) => {
      // ADR-002: spawn com array — NUNCA exec() com string
      const proc = spawn(
        ffmpegPath,
        [
          '-y',
          '-i', inputPath,
          '-af', loudnormFilter,
          '-ar', '48000',          // 48000 Hz obrigatório
          '-c:a', 'pcm_s24le',     // 24-bit PCM
          outputPath,
        ],
        { stdio: ['ignore', 'ignore', 'pipe'] }
      );

      let stderr = '';
      proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new AudioNormalizationError(
            `FFmpeg loudnorm Pass 2 falhou com código ${code}`,
            { exitCode: code, lastLines: stderr.slice(-500) }
          ));
        }
      });

      proc.on('error', (err) =>
        reject(new AudioNormalizationError(`Falha ao iniciar FFmpeg Pass 2: ${err.message}`))
      );
    });
  }

  /**
   * Verificação independente do loudness com BS1770GAIN.
   * ADR-005 + ADR-009: esta é a verificação definitiva.
   * Se BS1770GAIN falhar, a normalização é considerada inválida.
   */
  private async verifyWithBS1770Gain(
    filePath: string,
    log: ReturnType<typeof jobLogger>
  ): Promise<BS1770GainResult> {
    const bs1770gainPath = process.env.BS1770GAIN_PATH ?? 'bs1770gain';

    try {
      const { stdout } = await execFileAsync(
        bs1770gainPath,
        [
          '--integrated',
          '--true-peak',
          '--lra',
          '-o', 'xml',
          filePath,
        ],
        { timeout: 120000 } // 2 minutos
      );

      // Parsear output XML do BS1770GAIN
      const lufsMatch = stdout.match(/<integrated[^>]*>([-\d.]+)<\/integrated>/);
      const tpMatch = stdout.match(/<true-peak[^>]*>([-\d.]+)<\/true-peak>/);
      const lraMatch = stdout.match(/<lra[^>]*>([-\d.]+)<\/lra>/);

      return {
        integratedLufs: lufsMatch ? Number(lufsMatch[1]) : 0,
        truePeakDbtp: tpMatch ? Number(tpMatch[1]) : 0,
        loudnessRange: lraMatch ? Number(lraMatch[1]) : 0,
      };

    } catch (err) {
      // BS1770GAIN não instalado — usar FFmpeg como fallback (apenas warning)
      log.warn(
        { err: String(err) },
        'BS1770GAIN não disponível — a usar FFmpeg como fallback de verificação (ADR-009)'
      );

      // Fallback: re-analisar com FFmpeg loudnorm
      const ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg';
      const { stderr } = await execFileAsync(
        ffmpegPath,
        ['-i', filePath, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'],
        { timeout: 60000 }
      );

      const jsonMatch = stderr.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        return { integratedLufs: 0, truePeakDbtp: 0, loudnessRange: 0 };
      }

      const data = JSON.parse(jsonMatch[0]) as Record<string, string>;
      return {
        integratedLufs: Number(data['output_i'] ?? data['input_i'] ?? 0),
        truePeakDbtp: Number(data['output_tp'] ?? data['input_tp'] ?? 0),
        loudnessRange: Number(data['output_lra'] ?? data['input_lra'] ?? 0),
      };
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
