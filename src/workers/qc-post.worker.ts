// Nexora Media Processing — QC Post-Encode Worker
// Ficheiro: src/workers/qc-post.worker.ts
//
// Executa análise técnica completa do ficheiro após o encode.
// Compara com a análise pré-encode e detecta regressões de qualidade.
// Grava MediaAnalysis POST_ENCODE na base de dados.

import { Worker, Job as BullJob } from 'bullmq';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { AssetStatus } from '@prisma/client';

import { prisma } from '../db/prisma';
import { logger, jobLogger } from '../observability/logger';
import { downloadFile, BUCKETS } from '../common/minio';
import { QUEUE_NAMES, addToDeadLetter } from './queues';
import { mediainfoAdapter } from '../pipeline/tools/mediainfo-adapter';
import { mediaComparisonService } from '../pipeline/tools/media-comparison.service';
import { NotFoundError, QCError } from '../common/errors';

// ── Tipos ────────────────────────────────────────────────────────

export interface QCPostJobPayload {
  assetId: string;
  profile: string;
  /** Chave MinIO do ficheiro processado */
  outputMinioKey: string;
  /** Chave MinIO do ficheiro original (para comparação) */
  inputMinioKey: string;
}

// ── Worker ───────────────────────────────────────────────────────

export class QCPostWorker {
  public readonly name = 'QCPostWorker';
  private worker: Worker | null = null;

  async start(): Promise<void> {
    this.worker = new Worker(
      QUEUE_NAMES.QC,
      async (job: BullJob<QCPostJobPayload>) => this.process(job),
      {
        connection: {
          host: this.extractRedisHost(),
          port: this.extractRedisPort(),
          maxRetriesPerRequest: null as unknown as number,
          enableReadyCheck: false,
        },
        concurrency: 2,
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

    logger.info({ worker: this.name }, 'QCPostWorker iniciado');
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      logger.info({ worker: this.name }, 'QCPostWorker encerrado');
    }
  }

  public setConcurrency(n: number): void {
    if (this.worker) {
      this.worker.concurrency = n;
      logger.info({ worker: this.name, concurrency: n }, 'Concorrência atualizada dinamicamente');
    }
  }

  private async process(job: BullJob<QCPostJobPayload>): Promise<void> {
    const { assetId, profile, outputMinioKey, inputMinioKey } = job.data;
    const log = jobLogger(job.id ?? 'unknown', assetId);

    log.info({ assetId, profile, outputMinioKey }, 'A iniciar QC pós-encode');

    const asset = await prisma.asset.findUnique({
      where: { id: assetId, deletedAt: null },
    });

    if (!asset) throw new NotFoundError('Asset', assetId);

    const tmpDir = await mkdtemp(join(tmpdir(), 'nexora-qcpost-'));

    try {
      // Extrair bucket e keys
      const extractKey = (minioKey: string) => minioKey.split('/').slice(1).join('/');
      const inputKey = extractKey(inputMinioKey);
      const outputKey = extractKey(outputMinioKey);

      const inputLocalPath  = join(tmpDir, `input_${asset.filename}`);
      const outputLocalPath = join(tmpDir, `output_${asset.filename}`);

      // Descarregar ambos os ficheiros
      log.info('A descarregar ficheiros para análise...');
      await Promise.all([
        downloadFile(BUCKETS.INPUT, inputKey, inputLocalPath),
        downloadFile(BUCKETS.INPUT, outputKey, outputLocalPath),
      ]);

      // 1. Análise MediaInfo completa do output
      log.info('A analisar output com MediaInfo...');
      const afterFull = await mediainfoAdapter.analyzeFullMetadata(outputLocalPath);

      // 2. Análise MediaInfo do input (para comparação)
      log.info('A analisar input com MediaInfo...');
      const beforeFull = await mediainfoAdapter.analyzeFullMetadata(inputLocalPath);

      // 3. Comparação before/after
      const comparison = mediaComparisonService.compareAnalyses(beforeFull, afterFull);
      const regressionResults = mediaComparisonService.checkQualityRegression(comparison);
      const report = mediaComparisonService.generateReport(comparison, inputMinioKey, outputMinioKey);

      log.info(
        {
          bitrateRatio: comparison.qualityIndicators.bitrateRatio,
          durationDelta: comparison.qualityIndicators.durationDelta,
          videoChanges: comparison.videoChanged.length,
          regressions: regressionResults.filter(r => !r.pass).length,
        },
        'Comparação MediaInfo concluída'
      );

      // 4. SHA-256 do output
      const sha256 = await this.computeSHA256(outputLocalPath);
      log.info({ sha256 }, 'SHA-256 do output calculado');

      // 5. Verificação de duração (±2s)
      const durationDelta = Math.abs(comparison.qualityIndicators.durationDelta);
      if (durationDelta > 2.0) {
        log.warn(
          { durationDelta },
          'QC Post-Encode: duração do output difere do input em mais de 2s'
        );
      }

      // 6. Fast Start check
      const hasFastStart = afterFull.general.isStreamable;
      if (!hasFastStart) {
        log.warn({ outputMinioKey }, 'QC Post-Encode: output não tem Fast Start (moov atom não está no início)');
      }

      // 7. Guardar MediaAnalysis POST_ENCODE na DB
      const v = afterFull.video;
      const a = afterFull.audio[0];
      const g = afterFull.general;

      await prisma.mediaAnalysis.create({
        data: {
          assetId,
          phase: 'POST_ENCODE',
          // Vídeo
          videoCodec: v?.codec,
          videoProfile: v?.profile,
          videoLevel: v?.level,
          width: v?.width,
          height: v?.height,
          frameRate: v?.frameRate,
          frameRateMode: v?.frameRateMode,
          scanType: v?.scanType,
          scanOrder: v?.scanOrder,
          pixelFormat: v?.pixelFormat,
          bitDepth: v?.bitDepth,
          videoBitrate: v?.bitrate,
          gopSize: v?.gopSize ?? null,
          gopType: v?.gopType,
          bFrameCount: v?.bFrameCount,
          colorSpace: v?.colorSpace,
          colorPrimaries: v?.colorPrimaries,
          transferCharacteristics: v?.transferCharacteristics,
          matrixCoefficients: v?.matrixCoefficients,
          colourRange: v?.colourRange,
          hdrFormat: v?.hdrFormat,
          maxCLL: v?.maxCLL,
          maxFALL: v?.maxFALL,
          encodingLibrary: v?.encodingLibrary,
          encodingSettings: v?.encodingSettings,
          // Áudio
          audioCodec: a?.codec,
          audioSampleRate: a?.sampleRate,
          audioBitDepth: a?.bitDepth,
          audioChannels: a?.channels,
          audioChannelLayout: a?.channelLayout,
          audioBitrate: a?.bitrate,
          audioLanguage: a?.language,
          // Container
          containerFormat: g.format,
          duration: g.duration,
          fileSize: BigInt(Math.round(g.fileSize)),
          overallBitrate: g.overallBitrate,
          isStreamable: g.isStreamable,
          hasTimecodeTrack: g.hasTimecodeTrack,
          encodedDate: g.encodedDate,
          // Comparação
          comparisonResult: comparison as object,
          rawMediaInfo: afterFull.raw as object,
        },
      });

      // 8. Atualizar SHA-256 do output no asset
      await prisma.asset.update({
        where: { id: assetId },
        data: {
          sha256,
          status: AssetStatus.DELIVERING,
        },
      });

      // 9. Registo de auditoria com relatório diferencial
      await prisma.auditLog.create({
        data: {
          action: 'QC_POST_ENCODE_COMPLETED',
          entityType: 'Asset',
          entityId: assetId,
          assetId,
          metadata: {
            profile,
            sha256,
            hasFastStart,
            durationDelta: comparison.qualityIndicators.durationDelta,
            bitrateRatio: comparison.qualityIndicators.bitrateRatio,
            fileSizeRatio: comparison.qualityIndicators.fileSizeRatio,
            regressionCount: regressionResults.filter(r => !r.pass).length,
            videoChanges: comparison.videoChanged.length,
            report: report.slice(0, 2000), // truncar para não explodir o JSON
          },
        },
      });

      log.info({ assetId, sha256, hasFastStart }, 'QC pós-encode concluído');

    } finally {
      try {
        await rm(tmpDir, { recursive: true, force: true });
      } catch (err) {
        log.warn({ tmpDir, err }, 'Erro ao limpar directoria temporária QC Post');
      }
    }
  }

  /** Calcula o SHA-256 de um ficheiro local. */
  private computeSHA256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
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
