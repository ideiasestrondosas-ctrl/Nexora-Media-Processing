// Nexora Media Processing — Temporal Activities
// Ficheiro: src/pipeline/activities.ts
//
// Implementações das actividades usadas pelo workflow Temporal.
// Cada actividade é uma função assíncrona que executa um passo
// do pipeline. O Temporal gere retry, timeout e estado.
//
// ADR-001: Temporal.io para orquestração
// ADR-002: FFmpeg via spawn/execFile (enforçado nos módulos pipeline)
// ADR-005: Two-pass EBU R128 (via loudnessNormalizer)
// ADR-010: VMAF score para todos os outputs (via vmafScorer)

import { Context } from '@temporalio/activity';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { AssetStatus } from '@prisma/client';

import { prisma } from '../db/prisma';
import { logger } from '../observability/logger';
import {
  downloadFile,
  uploadFile,
  BUCKETS,
} from '../common/minio';
import { runQCRules } from '../qc/rules/index';
import type { NexoraQCInput, VideoMetadata, AudioMetadata, ContainerMetadata } from '../qc/rules/index';
import { ffmpegBuilder } from './ffmpeg/builder';
import { detectGPU } from './ffmpeg/gpu-detector';
import { loudnessNormalizer } from './ffmpeg/loudness';
import { vmafScorer } from './ffmpeg/vmaf';
import { NexoraJobScheduler } from './ffmpeg/scheduler';
import { getRedisClient } from '../common/redis';
import { decisionEngine } from './decision-engine';

const execFileAsync = promisify(execFile);

// ── Tipos partilhados ─────────────────────────────────────────────

export interface ActivityInput {
  assetId: string;
  profile: string;
  workflowId: string;
}

export interface QCResult {
  decision: 'PASS' | 'QUARANTINE' | 'REJECT';
  summary: string;
  qcInput: NexoraQCInput;
}

export interface TranscodeResult {
  outputKey: string;
  encoder: string;
  vmafMean?: number;
  vmafPassed?: boolean;
}

export interface AudioResult {
  outputKey: string;
  measuredLufs: number;
  truePeak: number;
}

export interface PostQCResult {
  passed: boolean;
  vmafMean?: number;
  failureReason?: string;
  reEncodeRequired: boolean;
  adjustedCrf?: number;
}

// ── FFprobe helper (reutilizado em múltiplas activities) ──────────

interface FFprobeStream {
  codec_type: string;
  codec_name?: string;
  profile?: string;
  level?: number;
  width?: number;
  height?: number;
  pix_fmt?: string;
  r_frame_rate?: string;
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
}

interface FFprobeFormat {
  format_name?: string;
  duration?: string;
  size?: string;
  bit_rate?: string;
}

interface FFprobeOutput {
  streams?: FFprobeStream[];
  format?: FFprobeFormat;
}

async function runFFprobe(filePath: string): Promise<FFprobeOutput> {
  const ffprobePath = process.env.FFPROBE_PATH ?? 'ffprobe';
  const { stdout } = await execFileAsync(
    ffprobePath,
    ['-v', 'quiet', '-print_format', 'json', '-show_streams', '-show_format', filePath],
    { timeout: 60000 }
  );
  return JSON.parse(stdout) as FFprobeOutput;
}

function buildQCInput(assetId: string, profile: string, ffprobe: FFprobeOutput): NexoraQCInput {
  const videoStream = ffprobe.streams?.find(s => s.codec_type === 'video');
  const audioStream = ffprobe.streams?.find(s => s.codec_type === 'audio');
  const format = ffprobe.format;

  const parseFrameRate = (fr?: string): number => {
    if (!fr) return 0;
    const [num, den] = fr.split('/').map(Number);
    return den ? (num ?? 0) / den : (num ?? 0);
  };

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
    gopType: 'UNKNOWN',
    hasIdrFrames: true,
    bFrameCount: videoStream?.has_b_frames ?? 0,
    bitrate: Number(videoStream?.bit_rate ?? format?.bit_rate ?? 0),
    width: videoStream?.width ?? 0,
    height: videoStream?.height ?? 0,
    bitDepth: (Number(videoStream?.bits_per_raw_sample) as 8 | 10 | 12) || 8,
    colorSpace: videoStream?.color_space ?? '',
    colorPrimaries: videoStream?.color_primaries ?? '',
    transferCharacteristics: videoStream?.color_transfer ?? '',
    duration: Number(videoStream?.duration ?? format?.duration ?? 0),
    hasFastStart: false,
  };

  const audio: AudioMetadata = {
    codec: audioStream?.codec_name ?? 'unknown',
    sampleRate: Number(audioStream?.sample_rate ?? 0),
    bitDepth: audioStream?.bits_per_sample ?? 0,
    channels: audioStream?.channels ?? 0,
    channelLayout: audioStream?.channel_layout ?? '',
    integratedLufs: null,
    truePeakDbtp: null,
    loudnessRange: null,
    audioVideoSyncMs: null,
  };

  const container: ContainerMetadata = {
    format: format?.format_name ?? 'unknown',
    duration: Number(format?.duration ?? 0),
    size: Number(format?.size ?? 0),
    hasEditLists: false,
    hasTimecodeTrack: false,
    moovPosition: 'unknown',
  };

  return { assetId, profile, video, audio, container };
}

// ── Activity 1: validateQC ────────────────────────────────────────

/**
 * Executa QC técnico no asset: FFprobe + motor de regras.
 * Timeout: 5min | maxAttempts: 3
 */
export async function validateQC(input: ActivityInput): Promise<QCResult> {
  const { assetId, profile } = input;
  const log = logger.child({ activity: 'validateQC', assetId });
  Context.current().heartbeat('A iniciar validateQC');

  const asset = await prisma.asset.findUnique({ where: { id: assetId, deletedAt: null } });
  if (!asset?.minioKey) throw new Error(`Asset ${assetId} sem minioKey`);

  const tmpDir = await mkdtemp(join(tmpdir(), 'nexora-qc-'));
  const localPath = join(tmpDir, 'input');

  try {
    const [, ...keyParts] = asset.minioKey.split('/');
    await downloadFile(BUCKETS.INPUT, keyParts.join('/'), localPath);
    Context.current().heartbeat('Ficheiro descarregado');

    const ffprobeData = await runFFprobe(localPath);
    const qcInput = buildQCInput(assetId, profile, ffprobeData);

    log.info('A executar motor de regras QC...');
    const { decision, summary } = await runQCRules(qcInput);

    // Guardar decision engine result (para usar no workflow)
    const decisionResult = decisionEngine.decide(qcInput, profile);
    log.info({ decision, decisionAction: decisionResult.videoAction, reasons: decisionResult.reasons }, 'QC concluído');

    return { decision: decision as 'PASS' | 'QUARANTINE' | 'REJECT', summary, qcInput };

  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Activity 2: analyzeContent ────────────────────────────────────

/**
 * Análise técnica detalhada com FFprobe.
 * Actualiza o campo metadata do asset.
 * Timeout: 10min | maxAttempts: 2
 */
export async function analyzeContent(input: ActivityInput): Promise<NexoraQCInput> {
  const { assetId, profile } = input;
  const log = logger.child({ activity: 'analyzeContent', assetId });
  Context.current().heartbeat('A iniciar analyzeContent');

  const asset = await prisma.asset.findUnique({ where: { id: assetId, deletedAt: null } });
  if (!asset?.minioKey) throw new Error(`Asset ${assetId} sem minioKey`);

  const tmpDir = await mkdtemp(join(tmpdir(), 'nexora-analyze-'));
  const localPath = join(tmpDir, 'input');

  try {
    const [, ...keyParts] = asset.minioKey.split('/');
    await downloadFile(BUCKETS.INPUT, keyParts.join('/'), localPath);
    Context.current().heartbeat('Ficheiro descarregado');

    const ffprobeData = await runFFprobe(localPath);
    const qcInput = buildQCInput(assetId, profile, ffprobeData);

    // Persistir metadados técnicos no Asset
    await prisma.asset.update({
      where: { id: assetId },
      data: {
        metadata: ffprobeData as object,
        status: AssetStatus.QC_PASSED,
      },
    });

    log.info({ codec: qcInput.video.codec, fps: qcInput.video.frameRate }, 'Análise concluída');
    return qcInput;

  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Activity 3: transcodeVideo ────────────────────────────────────

/**
 * Transcodifica o vídeo usando o builder + GPU detection + VMAF.
 * Timeout: 4h | maxAttempts: 2
 */
export async function transcodeVideo(
  input: ActivityInput & { inputMinioKey?: string }
): Promise<TranscodeResult> {
  const { assetId, profile } = input;
  const log = logger.child({ activity: 'transcodeVideo', assetId });
  Context.current().heartbeat('A detectar GPU...');

  const gpuCapability = await detectGPU();
  const redis = getRedisClient();
  const scheduler = new NexoraJobScheduler(redis as Parameters<typeof NexoraJobScheduler.prototype['getMaxCapacity']> extends never ? never : ConstructorParameters<typeof NexoraJobScheduler>[0]);

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset?.minioKey) throw new Error(`Asset ${assetId} sem minioKey`);

  const tmpDir = await mkdtemp(join(tmpdir(), 'nexora-transcode-'));
  const inputPath = join(tmpDir, 'input');
  const outputPath = join(tmpDir, 'output.mp4');

  const commandPair = ffmpegBuilder.build(profile, inputPath, outputPath, gpuCapability);
  const selectedCommand = commandPair.gpu ?? commandPair.cpu;
  const jobType = NexoraJobScheduler.resolveJobType(profile, selectedCommand.encoder);

  const slotResult = await scheduler.acquire(`temporal-${assetId}`, jobType, selectedCommand.encoder);
  if (!slotResult.acquired) {
    throw new Error(`Sem slots disponíveis para ${jobType} (${slotResult.currentUsage}/${slotResult.maxCapacity})`);
  }

  try {
    const [, ...keyParts] = asset.minioKey.split('/');
    await downloadFile(BUCKETS.INPUT, keyParts.join('/'), inputPath);
    Context.current().heartbeat('A transcodificar...');

    // Executar encode (GPU → fallback CPU)
    let usedCommand = selectedCommand;
    try {
      await runFFmpegArgs(selectedCommand.args);
    } catch {
      if (commandPair.gpu && selectedCommand.encoder !== 'cpu') {
        log.warn('GPU falhou — a tentar CPU fallback');
        usedCommand = commandPair.cpu;
        await runFFmpegArgs(commandPair.cpu.args);
      } else {
        throw new Error('FFmpeg encode falhou (GPU + CPU)');
      }
    }

    Context.current().heartbeat('Encode concluído — a calcular VMAF...');

    // VMAF (ADR-010)
    let vmafMean: number | undefined;
    let vmafPassed: boolean | undefined;
    try {
      const vmafResult = await vmafScorer.score(inputPath, outputPath, profile);
      vmafMean = vmafResult.mean;
      vmafPassed = vmafResult.passed;
    } catch { /* VMAF opcional — não bloqueia */ }

    const outputKey = `output/${assetId}/${profile}/video.mp4`;
    await uploadFile(BUCKETS.OUTPUT, outputKey, outputPath, {
      contentType: 'video/mp4',
      metadata: { 'x-nexora-asset-id': assetId, 'x-nexora-encoder': usedCommand.encoder },
    });

    await prisma.asset.update({
      where: { id: assetId },
      data: { status: AssetStatus.AUDIO_PROCESSING },
    });

    return { outputKey, encoder: usedCommand.encoder, vmafMean, vmafPassed };

  } finally {
    if (slotResult.slot) await scheduler.release(slotResult.slot.slotId).catch(() => {});
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Activity 4: normalizeAudio ────────────────────────────────────

/**
 * Normalização two-pass EBU R128 (ADR-005).
 * Timeout: 30min | maxAttempts: 3
 */
export async function normalizeAudio(
  input: ActivityInput & { targetLufs?: number; truePeakLimit?: number }
): Promise<AudioResult> {
  const { assetId } = input;
  const targetLufs = input.targetLufs ?? -23;
  const truePeakLimit = input.truePeakLimit ?? -1.0;
  const log = logger.child({ activity: 'normalizeAudio', assetId });
  Context.current().heartbeat('A iniciar normalização de áudio...');

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset?.minioKey) throw new Error(`Asset ${assetId} sem minioKey`);

  const tmpDir = await mkdtemp(join(tmpdir(), 'nexora-audio-'));
  const inputPath = join(tmpDir, 'input');
  const outputPath = join(tmpDir, 'normalized.wav');

  try {
    const [, ...keyParts] = asset.minioKey.split('/');
    await downloadFile(BUCKETS.INPUT, keyParts.join('/'), inputPath);
    Context.current().heartbeat('A normalizar áudio two-pass...');

    const result = await loudnessNormalizer.normalize(inputPath, outputPath, targetLufs, truePeakLimit);

    if (!result.verified) {
      throw new Error(`Loudness fora do target: ${result.integratedLufs} LUFS (target ${targetLufs})`);
    }

    const outputKey = `output/${assetId}/audio/normalized.wav`;
    await uploadFile(BUCKETS.OUTPUT, outputKey, outputPath, {
      contentType: 'audio/wav',
      metadata: { 'x-nexora-asset-id': assetId, 'x-nexora-lufs': result.integratedLufs.toString() },
    });

    log.info({ lufs: result.integratedLufs, truePeak: result.truePeak }, 'Normalização concluída');
    return { outputKey, measuredLufs: result.integratedLufs, truePeak: result.truePeak };

  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Activity 5: processCaptions (opcional) ────────────────────────

/**
 * Extrai/converte legendas SRT→WebVTT.
 * Opcional — falha não bloqueia o workflow.
 * Timeout: 20min | maxAttempts: 2
 */
export async function processCaptions(input: ActivityInput): Promise<{ outputKey: string } | null> {
  const { assetId } = input;
  const log = logger.child({ activity: 'processCaptions', assetId });
  Context.current().heartbeat('A processar legendas...');

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset?.minioKey) return null;

  const tmpDir = await mkdtemp(join(tmpdir(), 'nexora-captions-'));
  const inputPath = join(tmpDir, 'input');
  const outputPath = join(tmpDir, 'captions.vtt');

  try {
    const [, ...keyParts] = asset.minioKey.split('/');
    await downloadFile(BUCKETS.INPUT, keyParts.join('/'), inputPath);

    const ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg';
    await execFileAsync(
      ffmpegPath,
      ['-y', '-i', inputPath, '-map', '0:s:0', outputPath],
      { timeout: 1200000 } // 20min
    );

    const outputKey = `output/${assetId}/captions/captions.vtt`;
    await uploadFile(BUCKETS.OUTPUT, outputKey, outputPath, {
      contentType: 'text/vtt',
      metadata: { 'x-nexora-asset-id': assetId },
    });

    log.info({ outputKey }, 'Legendas processadas');
    return { outputKey };

  } catch (err) {
    log.warn({ err: String(err) }, 'processCaptions falhou — a continuar (opcional)');
    return null;
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Activity 6: generateProxies ───────────────────────────────────

/**
 * Gera proxy 480p para preview rápido.
 * Timeout: 1h | maxAttempts: 2
 */
export async function generateProxies(input: ActivityInput): Promise<{ outputKey: string }> {
  const { assetId } = input;
  const log = logger.child({ activity: 'generateProxies', assetId });
  Context.current().heartbeat('A gerar proxy...');

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset?.minioKey) throw new Error(`Asset ${assetId} sem minioKey`);

  const tmpDir = await mkdtemp(join(tmpdir(), 'nexora-proxy-'));
  const inputPath = join(tmpDir, 'input');
  const outputPath = join(tmpDir, 'proxy.mp4');

  try {
    const [, ...keyParts] = asset.minioKey.split('/');
    await downloadFile(BUCKETS.INPUT, keyParts.join('/'), inputPath);
    Context.current().heartbeat('A codificar proxy 480p...');

    const gpuCapability = await detectGPU();
    const commandPair = ffmpegBuilder.build('proxy', inputPath, outputPath, gpuCapability);
    const cmd = commandPair.cpu; // proxy sempre CPU (baixo custo)

    await runFFmpegArgs(cmd.args);

    const outputKey = `output/${assetId}/proxy/proxy.mp4`;
    await uploadFile(BUCKETS.OUTPUT, outputKey, outputPath, {
      contentType: 'video/mp4',
      metadata: { 'x-nexora-asset-id': assetId, 'x-nexora-type': 'proxy' },
    });

    log.info({ outputKey }, 'Proxy gerado');
    return { outputKey };

  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Activity 7: generateThumbnails ────────────────────────────────

/**
 * Extrai thumbnails a cada 30 segundos.
 * Timeout: 10min | maxAttempts: 3
 */
export async function generateThumbnails(
  input: ActivityInput
): Promise<{ outputKeys: string[] }> {
  const { assetId } = input;
  const log = logger.child({ activity: 'generateThumbnails', assetId });
  Context.current().heartbeat('A gerar thumbnails...');

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset?.minioKey) throw new Error(`Asset ${assetId} sem minioKey`);

  const tmpDir = await mkdtemp(join(tmpdir(), 'nexora-thumb-'));
  const inputPath = join(tmpDir, 'input');
  const thumbPattern = join(tmpDir, 'thumb_%04d.jpg');

  try {
    const [, ...keyParts] = asset.minioKey.split('/');
    await downloadFile(BUCKETS.INPUT, keyParts.join('/'), inputPath);

    const ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg';
    // Extrai 1 frame a cada 30s, máx 20 thumbnails
    await execFileAsync(
      ffmpegPath,
      [
        '-y', '-i', inputPath,
        '-vf', 'fps=1/30,scale=320:-1',
        '-frames:v', '20',
        '-q:v', '3',
        thumbPattern,
      ],
      { timeout: 600000 } // 10min
    );

    const { readdir } = await import('fs/promises');
    const thumbFiles = (await readdir(tmpDir)).filter(f => f.startsWith('thumb_'));
    const outputKeys: string[] = [];

    for (const file of thumbFiles) {
      const thumbPath = join(tmpDir, file);
      const outputKey = `output/${assetId}/thumbnails/${file}`;
      await uploadFile(BUCKETS.OUTPUT, outputKey, thumbPath, {
        contentType: 'image/jpeg',
        metadata: { 'x-nexora-asset-id': assetId },
      });
      outputKeys.push(outputKey);
    }

    log.info({ count: outputKeys.length }, 'Thumbnails gerados');
    return { outputKeys };

  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Activity 8: runPostEncodeQC ───────────────────────────────────

/**
 * QC pós-encode: verifica VMAF + conformidade do output.
 * Se VMAF < threshold → sinaliza para re-encode com CRF ajustado.
 * Timeout: 30min | maxAttempts: 1
 */
export async function runPostEncodeQC(
  input: ActivityInput & { videoOutputKey: string; currentCrf?: number }
): Promise<PostQCResult> {
  const { assetId, profile, videoOutputKey } = input;
  const log = logger.child({ activity: 'runPostEncodeQC', assetId });
  Context.current().heartbeat('A executar QC pós-encode...');

  const tmpDir = await mkdtemp(join(tmpdir(), 'nexora-postqc-'));
  const encodedPath = join(tmpDir, 'encoded.mp4');

  try {
    // Descarregar o output transcoded
    await downloadFile(BUCKETS.OUTPUT, videoOutputKey, encodedPath);
    Context.current().heartbeat('A calcular VMAF...');

    // Obter o original para comparação
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset?.minioKey) throw new Error(`Asset ${assetId} sem minioKey`);

    const originalPath = join(tmpDir, 'original');
    const [, ...keyParts] = asset.minioKey.split('/');
    await downloadFile(BUCKETS.INPUT, keyParts.join('/'), originalPath);

    const vmafResult = await vmafScorer.score(originalPath, encodedPath, profile);
    log.info({ vmaf: vmafResult.mean, passed: vmafResult.passed }, 'VMAF pós-encode calculado');

    if (!vmafResult.passed) {
      // CRF actual (default 23 para H.264; menor = melhor qualidade)
      const currentCrf = input.currentCrf ?? 23;
      const adjustedCrf = Math.max(currentCrf - 3, 15); // baixar 3 → melhor qualidade

      return {
        passed: false,
        vmafMean: vmafResult.mean,
        failureReason: vmafResult.failureReason,
        reEncodeRequired: true,
        adjustedCrf,
      };
    }

    await prisma.asset.update({
      where: { id: assetId },
      data: { status: AssetStatus.DELIVERING },
    });

    return { passed: true, vmafMean: vmafResult.mean, reEncodeRequired: false };

  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Activity 9: deliver ───────────────────────────────────────────

/**
 * Entrega os outputs para os delivery targets configurados.
 * Timeout: 2h | maxAttempts: 3
 */
export async function deliver(
  input: ActivityInput & { outputKeys: string[] }
): Promise<{ delivered: boolean; targets: string[] }> {
  const { assetId, outputKeys } = input;
  const log = logger.child({ activity: 'deliver', assetId });
  Context.current().heartbeat('A iniciar delivery...');

  const deliveryTargets = await prisma.deliveryTarget.findMany({ where: { isActive: true } });

  if (deliveryTargets.length === 0) {
    log.warn('Sem delivery targets activos — a marcar como COMPLETED');
  }

  // Marcar asset como COMPLETED
  await prisma.asset.update({
    where: { id: assetId },
    data: { status: AssetStatus.COMPLETED },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: 'ASSET_DELIVERED',
      entityType: 'Asset',
      entityId: assetId,
      assetId,
      metadata: { outputKeys, targetCount: deliveryTargets.length } as object,
    },
  });

  log.info({ outputKeys, targetCount: deliveryTargets.length }, 'Delivery concluída');

  return {
    delivered: true,
    targets: deliveryTargets.map(t => t.name),
  };
}

// ── Helper: runFFmpegArgs ─────────────────────────────────────────

/**
 * Executa FFmpeg com array de argumentos (ADR-002).
 * Lança erro se exit code != 0.
 */
async function runFFmpegArgs(args: string[]): Promise<void> {
  const ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg';
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: 'ignore' });
    proc.on('close', (code: number | null) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg saiu com código ${code}`));
    });
    proc.on('error', reject);
  });
}
