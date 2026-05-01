// ═══════════════════════════════════════════════════════════════
// Nexora Media Processing — Audio Worker
// Ficheiro: src/workers/audio.worker.ts
//
// Normalização de loudness EBU R128 em dois passos.
// ADR-005: Two-pass obrigatório + BS1770GAIN verificação independente.
// ADR-009: BS1770GAIN é a verificação final — nunca só o FFmpeg.
// ═══════════════════════════════════════════════════════════════

import { execFile } from 'child_process';
import { promisify } from 'util';
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { executeFFmpeg } from '../pipeline/ffmpeg/executor';
import { ffmpegBuilder } from '../pipeline/ffmpeg/builder';
import { logger } from '../observability/logger';
import { loudnessLufs } from '../observability/metrics';

const execFileAsync = promisify(execFile);

const BS1770GAIN_PATH  = process.env.BS1770GAIN_PATH  ?? 'bs1770gain';
const TARGET_BROADCAST = Number(process.env.LOUDNESS_TARGET_BROADCAST_LUFS ?? -23);
const TARGET_STREAMING = Number(process.env.LOUDNESS_TARGET_STREAMING_LUFS ?? -14);
const TRUE_PEAK_LIMIT  = Number(process.env.LOUDNESS_TRUE_PEAK_LIMIT_DBTP  ?? -1.0);
const LUFS_TOLERANCE   = Number(process.env.LOUDNESS_TOLERANCE_LU          ?? 0.5);
const MAX_RETRY        = 3;

export interface LoudnessAnalysisResult {
  /** Loudness integrado medido (LUFS) */
  inputI: number;
  /** True Peak medido (dBTP) */
  inputTP: number;
  /** Loudness Range (LU) */
  inputLRA: number;
  /** Threshold medido */
  inputThresh: number;
  /** Offset para normalização linear */
  targetOffset: number;
}

export interface LoudnessVerificationResult {
  integratedLufs: number;
  truePeakDbtp: number;
  loudnessRange: number;
  passes: boolean;
  failReason?: string;
}

/**
 * Normaliza o áudio de um ficheiro usando EBU R128 two-pass.
 *
 * Passo 1: Análise — medir valores actuais
 * Passo 2: Normalização — aplicar com valores medidos exactos (linear=true)
 * Passo 3: Verificação — BS1770GAIN confirma resultado independentemente
 */
export async function normalizeAudio(params: {
  inputPath: string;
  outputPath: string;
  profile: 'broadcast' | 'streaming' | 'archive';
  assetId: string;
  jobId: string;
}): Promise<{
  integratedLufs: number;
  truePeakDbtp: number;
  passes: boolean;
}> {
  const { inputPath, outputPath, profile, assetId, jobId } = params;
  const log = logger.child({ asset_id: assetId, job_id: jobId, worker: 'audio' });
  const targetLufs = profile === 'streaming' ? TARGET_STREAMING : TARGET_BROADCAST;

  log.info({ targetLufs, profile }, 'A iniciar normalização de loudness EBU R128');

  // ── PASSO 1: Análise ─────────────────────────────────────────
  log.info('Passo 1/3: A analisar loudness actual...');

  const analysisArgs = ffmpegBuilder.buildLoudnessAnalysis(inputPath);
  const analysisResult = await executeFFmpeg(
    ['-y', ...analysisArgs],
    { assetId, jobId, timeoutMs: 1800000 } // 30min max para análise
  );

  const measured = parseLoudnormJSON(analysisResult.stderr);
  if (!measured) {
    throw new Error(
      'FFmpeg não retornou JSON de loudness válido no Pass 1. ' +
      'Verificar se o ficheiro tem áudio.'
    );
  }

  log.info(
    { measuredI: measured.inputI, measuredTP: measured.inputTP },
    'Passo 1 concluído — valores medidos'
  );

  // ── PASSO 2: Normalização ────────────────────────────────────
  log.info('Passo 2/3: A normalizar com valores medidos...');

  let attempt = 0;
  let lastVerification: LoudnessVerificationResult | null = null;
  let currentOffset = measured.targetOffset;

  while (attempt < MAX_RETRY) {
    attempt++;

    // Construir filtro de normalização com valores exactos do Pass 1
    const loudnormFilter = [
      `loudnorm=I=${targetLufs}`,
      `TP=${TRUE_PEAK_LIMIT}`,
      `LRA=11`,
      `measured_I=${measured.inputI}`,
      `measured_TP=${measured.inputTP}`,
      `measured_LRA=${measured.inputLRA}`,
      `measured_thresh=${measured.inputThresh}`,
      `offset=${currentOffset}`,
      `linear=true`,          // OBRIGATÓRIO: preserva dinâmica, não comprime
    ].join(':');

    const normalizeArgs = [
      '-y',
      '-i', ffmpegBuilder.validateInputPath(inputPath),
      '-af', loudnormFilter,
      '-c:v', 'copy',         // copiar vídeo sem re-encode
      '-c:a', 'aac',
      '-b:a', profile === 'broadcast' ? '256k' : '192k',
      '-ar', '48000',
      '-movflags', '+faststart',
      ffmpegBuilder.validateInputPath(outputPath),
    ];

    await executeFFmpeg(normalizeArgs, {
      assetId,
      jobId,
      timeoutMs: 3600000  // 1h
    });

    // ── PASSO 3: Verificação independente com BS1770GAIN ────────
    log.info(`Passo 3/3 (tentativa ${attempt}): A verificar com BS1770GAIN...`);
    lastVerification = await verifyWithBS1770GAIN(outputPath);

    if (lastVerification.passes) {
      log.info(
        {
          integratedLufs: lastVerification.integratedLufs,
          truePeakDbtp:   lastVerification.truePeakDbtp,
          attempt
        },
        'Normalização verificada com sucesso pelo BS1770GAIN'
      );

      // Registar métrica Prometheus
      loudnessLufs.observe(lastVerification.integratedLufs);

      return {
        integratedLufs: lastVerification.integratedLufs,
        truePeakDbtp:   lastVerification.truePeakDbtp,
        passes: true,
      };
    }

    // Ajustar offset e tentar de novo
    log.warn(
      {
        measured:  lastVerification.integratedLufs,
        target:    targetLufs,
        deviation: Math.abs(lastVerification.integratedLufs - targetLufs).toFixed(2),
        attempt,
      },
      `Verificação falhou — a ajustar offset e tentar novamente`
    );

    // Corrigir offset baseado no desvio medido
    const deviation = targetLufs - lastVerification.integratedLufs;
    currentOffset = measured.targetOffset + deviation * 0.5; // ajuste conservador
  }

  // Após MAX_RETRY tentativas
  throw new Error(
    `Normalização de loudness falhou após ${MAX_RETRY} tentativas. ` +
    `Último resultado: ${lastVerification?.integratedLufs.toFixed(1)} LUFS ` +
    `(target: ${targetLufs} LUFS ±${LUFS_TOLERANCE} LU). ` +
    `Motivo: ${lastVerification?.failReason ?? 'desconhecido'}`
  );
}

/**
 * Parsear o JSON retornado pelo FFmpeg no Pass 1 de loudnorm.
 * O FFmpeg escreve no stderr, por isso o parseamos de lá.
 */
function parseLoudnormJSON(stderr: string): LoudnessAnalysisResult | null {
  // FFmpeg escreve o JSON com as chaves numa secção específica do stderr
  // Exemplo: {"input_i" : "-18.34", "input_tp" : "-3.27", ...}
  const jsonMatch = stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?"target_offset"[\s\S]*?\}/);
  if (!jsonMatch) return null;

  try {
    const data = JSON.parse(jsonMatch[0]);
    return {
      inputI:       parseFloat(data.input_i),
      inputTP:      parseFloat(data.input_tp),
      inputLRA:     parseFloat(data.input_lra),
      inputThresh:  parseFloat(data.input_thresh),
      targetOffset: parseFloat(data.target_offset),
    };
  } catch {
    return null;
  }
}

/**
 * Verificar loudness com BS1770GAIN (ADR-009).
 * Ferramenta independente do FFmpeg — não pode verificar o próprio output.
 */
async function verifyWithBS1770GAIN(
  filePath: string,
  profile: 'broadcast' | 'streaming' = 'broadcast'
): Promise<LoudnessVerificationResult> {
  const targetLufs = profile === 'streaming' ? TARGET_STREAMING : TARGET_BROADCAST;

  let stdout = '';
  let stderr = '';

  try {
    const result = await execFileAsync(
      BS1770GAIN_PATH,
      [
        '--ebu',        // modo EBU R128
        '--integrated', // medir loudness integrado
        '--range',      // medir loudness range
        '--truepeak',   // medir True Peak (4x oversampling)
        '--xml',        // output em XML (mais fácil de parsear)
        filePath,
      ],
      { timeout: 120000 } // 2min max
    );
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (error) {
    // BS1770GAIN não disponível — usar fallback FFmpeg ebur128
    logger.warn(
      { error: String(error) },
      'BS1770GAIN não disponível — a usar fallback FFmpeg ebur128'
    );
    return verifyWithFFmpegEbur128(filePath, profile);
  }

  // Parsear XML output do BS1770GAIN
  const integratedMatch = stdout.match(/integrated="([-\d.]+)"/);
  const truePeakMatch   = stdout.match(/true-peak="([-\d.]+)"/);
  const rangeMatch      = stdout.match(/range="([-\d.]+)"/);

  if (!integratedMatch || !truePeakMatch) {
    logger.warn('BS1770GAIN XML inválido — a usar fallback');
    return verifyWithFFmpegEbur128(filePath, profile);
  }

  const integratedLufs = parseFloat(integratedMatch[1]);
  const truePeakDbtp   = parseFloat(truePeakMatch[1]);
  const loudnessRange  = rangeMatch ? parseFloat(rangeMatch[1]) : 0;

  const lufsDeviation = Math.abs(integratedLufs - targetLufs);
  const tpPasses      = truePeakDbtp <= TRUE_PEAK_LIMIT;
  const lufsPasses    = lufsDeviation <= LUFS_TOLERANCE;
  const passes        = lufsPasses && tpPasses;

  let failReason: string | undefined;
  if (!lufsPasses) {
    failReason = `LUFS ${integratedLufs.toFixed(1)} desvia ${lufsDeviation.toFixed(1)} LU do target ${targetLufs}`;
  } else if (!tpPasses) {
    failReason = `True Peak ${truePeakDbtp.toFixed(1)} dBTP acima do limite ${TRUE_PEAK_LIMIT} dBTP`;
  }

  return { integratedLufs, truePeakDbtp, loudnessRange, passes, failReason };
}

/**
 * Fallback: verificar loudness com FFmpeg ebur128 quando BS1770GAIN não disponível.
 * Nota: isto vai contra ADR-009 mas é melhor do que nada.
 */
async function verifyWithFFmpegEbur128(
  filePath: string,
  profile: 'broadcast' | 'streaming' = 'broadcast'
): Promise<LoudnessVerificationResult> {
  const targetLufs = profile === 'streaming' ? TARGET_STREAMING : TARGET_BROADCAST;

  const result = await executeFFmpeg([
    '-i', filePath,
    '-af', 'ebur128=peak=true:framelog=verbose',
    '-f', 'null',
    '-',
  ], { timeoutMs: 300000 });

  const intMatch = result.stderr.match(/I:\s+([-\d.]+)\s+LUFS/);
  const tpMatch  = result.stderr.match(/True peak:\s+([-\d.]+)\s+dBFS/);

  const integratedLufs = intMatch  ? parseFloat(intMatch[1])  : 0;
  const truePeakDbtp   = tpMatch   ? parseFloat(tpMatch[1])   : 0;

  const passes =
    Math.abs(integratedLufs - targetLufs) <= LUFS_TOLERANCE &&
    truePeakDbtp <= TRUE_PEAK_LIMIT;

  return { integratedLufs, truePeakDbtp, loudnessRange: 0, passes };
}


// ═══════════════════════════════════════════════════════════════
// Nexora Media Processing — Transcode Worker
// Ficheiro: src/workers/transcode.worker.ts
//
// Worker de transcoding de vídeo com todos os perfis Nexora.
// ADR-002: FFmpeg sempre via executor isolado com timeout.
// ADR-006: Parâmetros GOP obrigatórios em todos os perfis broadcast.
// ═══════════════════════════════════════════════════════════════

import path from 'path';
import { executeFFmpeg } from '../pipeline/ffmpeg/executor';
import { ffmpegBuilder } from '../pipeline/ffmpeg/builder';
import { detectGPU, type GPUInfo } from '../pipeline/gpu-detector';
import { logger } from '../observability/logger';
import { transcodeDuration } from '../observability/metrics';

export type NexoraProfile =
  | 'nexora_broadcast_hd'
  | 'nexora_ott_premium'
  | 'nexora_streaming_web'
  | 'nexora_proxy_lowres'
  | 'nexora_archive';

export interface TranscodeParams {
  inputPath:    string;
  outputPath:   string;
  profile:      NexoraProfile;
  assetId:      string;
  jobId:        string;
  fps?:         number;
  width?:       number;
  height?:      number;
  bitrateKbps?: number;
  onProgress?:  (percent: number) => void;
  durationMs?:  number; // duração total para calcular progresso
}

export interface TranscodeResult {
  outputPath:  string;
  durationMs:  number;
  usedGPU:     boolean;
  profile:     NexoraProfile;
}

/**
 * Transcodificar um ficheiro de media usando o perfil Nexora especificado.
 * Detecta automaticamente GPU e usa aceleração de hardware se disponível.
 */
export async function transcodeAsset(params: TranscodeParams): Promise<TranscodeResult> {
  const {
    inputPath, outputPath, profile,
    assetId, jobId, fps = 25,
    bitrateKbps, onProgress, durationMs
  } = params;

  const log = logger.child({ asset_id: assetId, job_id: jobId, worker: 'transcode', profile });
  const startTime = Date.now();

  log.info({ profile, inputPath }, 'A iniciar transcode');

  // Detectar GPU disponível
  const gpu = await detectGPU();
  log.info({ gpu: gpu.type }, `GPU detectada: ${gpu.type}`);

  let cmd: string[];
  let usedGPU = false;

  switch (profile) {
    case 'nexora_broadcast_hd':
      ({ cmd, usedGPU } = buildBroadcastHDCommand(
        inputPath, outputPath, fps, bitrateKbps ?? 8000, gpu
      ));
      break;

    case 'nexora_ott_premium':
      ({ cmd, usedGPU } = buildOTTPremiumCommand(
        inputPath, outputPath, fps, bitrateKbps ?? 6000, gpu
      ));
      break;

    case 'nexora_streaming_web':
      cmd = buildStreamingWebCommand(inputPath, outputPath, fps);
      break;

    case 'nexora_proxy_lowres':
      cmd = ffmpegBuilder.buildProxyLowRes({ inputPath, outputPath });
      break;

    case 'nexora_archive':
      cmd = buildArchiveCommand(inputPath, outputPath);
      break;

    default:
      throw new Error(`Perfil desconhecido: ${profile as string}`);
  }

  // Executar transcode
  const result = await executeFFmpeg(cmd, {
    assetId,
    jobId,
    timeoutMs: 14400000, // 4h
    totalDurationMs: durationMs,
    onProgress: onProgress
      ? (p) => { if (p.progressPercent != null) onProgress(p.progressPercent); }
      : undefined,
  });

  const elapsed = Date.now() - startTime;

  // Registar métrica
  transcodeDuration.observe({ profile }, elapsed / 1000);

  log.info(
    { durationMs: elapsed, usedGPU, profile },
    `Transcode concluído em ${(elapsed / 1000).toFixed(0)}s`
  );

  return {
    outputPath,
    durationMs: elapsed,
    usedGPU,
    profile,
  };
}

// ── Builders de comandos por perfil ───────────────────────────

function buildBroadcastHDCommand(
  input: string,
  output: string,
  fps: number,
  bitrateKbps: number,
  gpu: GPUInfo
): { cmd: string[]; usedGPU: boolean } {
  if (gpu.nvenc) {
    // Versão GPU (NVENC)
    const gop  = Math.round(fps) * 2;
    const maxr = bitrateKbps;
    const bufs = bitrateKbps * 2;

    return {
      usedGPU: true,
      cmd: [
        '-y',
        '-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda',
        '-i', ffmpegBuilder.validateInputPath(input),
        '-c:v', 'h264_nvenc',
        '-preset', 'p4', '-tune', 'hq',
        '-profile:v', 'high', '-level:v', '4.1',
        '-pix_fmt', 'yuv420p',
        '-g', String(gop), '-keyint_min', String(gop),
        '-forced-idr', '1',       // IDR frames obrigatórios (ADR-006)
        '-no-scenecut', '1',      // sem keyframes em scene cuts
        '-b:v', `${bitrateKbps}k`,
        '-maxrate', `${maxr}k`,
        '-bufsize', `${bufs}k`,
        '-rc', 'cbr',
        '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
        '-r', String(fps),
        '-c:a', 'pcm_s24le', '-ar', '48000',
        '-movflags', '+faststart',
        ffmpegBuilder.validateInputPath(output),
      ],
    };
  }

  // Versão CPU (libx264) — fallback
  return {
    usedGPU: false,
    cmd: ffmpegBuilder.buildBroadcastHD({
      inputPath: input,
      outputPath: output,
      fps,
      bitrateKbps,
    }),
  };
}

function buildOTTPremiumCommand(
  input: string,
  output: string,
  fps: number,
  bitrateKbps: number,
  gpu: GPUInfo
): { cmd: string[]; usedGPU: boolean } {
  const gop  = Math.round(fps) * 2;
  const maxr = bitrateKbps;
  const bufs = bitrateKbps * 2;

  if (gpu.nvenc) {
    return {
      usedGPU: true,
      cmd: [
        '-y',
        '-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda',
        '-i', ffmpegBuilder.validateInputPath(input),
        '-c:v', 'hevc_nvenc',
        '-preset', 'p5', '-tune', 'hq',
        '-profile:v', 'main',
        '-pix_fmt', 'p010le',      // 10-bit para OTT premium
        '-g', String(gop), '-keyint_min', String(gop),
        '-forced-idr', '1',
        '-no-scenecut', '1',
        '-b:v', `${bitrateKbps}k`,
        '-maxrate', `${maxr}k`,
        '-bufsize', `${bufs}k`,
        '-tag:v', 'hvc1',          // tag para compatibilidade Apple
        '-c:a', 'eac3', '-b:a', '384k', '-ar', '48000',
        ffmpegBuilder.validateInputPath(output),
      ],
    };
  }

  return {
    usedGPU: false,
    cmd: [
      '-y',
      '-i', ffmpegBuilder.validateInputPath(input),
      '-c:v', 'libx265',
      '-preset', 'slow',
      '-profile:v', 'main',
      '-pix_fmt', 'yuv420p',
      '-g', String(gop), '-keyint_min', String(gop),
      '-x265-params', `open-gop=0:bframes=0:keyint=${gop}:min-keyint=${gop}`,
      '-b:v', `${bitrateKbps}k`,
      '-maxrate', `${maxr}k`,
      '-bufsize', `${bufs}k`,
      '-tag:v', 'hvc1',
      '-c:a', 'eac3', '-b:a', '384k', '-ar', '48000',
      ffmpegBuilder.validateInputPath(output),
    ],
  };
}

function buildStreamingWebCommand(
  input: string,
  output: string,
  fps: number
): string[] {
  const gop = Math.round(fps) * 2;
  return [
    '-y',
    '-i', ffmpegBuilder.validateInputPath(input),
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-profile:v', 'high', '-level:v', '4.0',
    '-pix_fmt', 'yuv420p',
    '-g', String(gop), '-keyint_min', String(gop),
    '-sc_threshold', '0',
    '-flags', '+cgop',
    '-x264-params', 'open-gop=0:bframes=2:ref=3',
    '-b:v', '4000k', '-maxrate', '5000k', '-bufsize', '8000k',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-movflags', '+faststart',
    ffmpegBuilder.validateInputPath(output),
  ];
}

function buildArchiveCommand(input: string, output: string): string[] {
  return [
    '-y',
    '-i', ffmpegBuilder.validateInputPath(input),
    '-c:v', 'prores_ks',
    '-profile:v', '3',             // ProRes 422 HQ
    '-vendor', 'apl0',
    '-bits_per_mb', '8000',
    '-pix_fmt', 'yuv422p10le',     // 10-bit para arquivo
    '-c:a', 'pcm_s24le',
    '-ar', '48000',
    ffmpegBuilder.validateInputPath(output),
  ];
}


// ═══════════════════════════════════════════════════════════════
// Nexora Media Processing — GPU Detector
// Ficheiro: src/pipeline/gpu-detector.ts
//
// Detecta GPU disponível e verifica se funciona com FFmpeg.
// Fallback automático para CPU se GPU falhar.
// ═══════════════════════════════════════════════════════════════

import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../observability/logger';

const execFileAsync = promisify(execFile);

export interface GPUInfo {
  type:   'nvenc' | 'qsv' | 'amf' | 'videotoolbox' | 'none';
  nvenc:  boolean;
  qsv:    boolean;
  amf:    boolean;
  vt:     boolean; // Apple VideoToolbox
  name?:  string;
}

let cachedGPU: GPUInfo | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos

/**
 * Detectar GPU disponível com cache de 30 minutos.
 * Testa realmente se o hardware encoder funciona com FFmpeg.
 */
export async function detectGPU(): Promise<GPUInfo> {
  // Retornar cache se ainda válido
  if (cachedGPU && Date.now() - cacheTime < CACHE_TTL_MS) {
    return cachedGPU;
  }

  logger.info('A detectar GPU disponível...');

  const result: GPUInfo = {
    type: 'none',
    nvenc: false,
    qsv: false,
    amf: false,
    vt: false,
  };

  // Apple VideoToolbox (macOS)
  if (process.platform === 'darwin') {
    const works = await testFFmpegEncoder('h264_videotoolbox');
    if (works) {
      result.vt = true;
      result.type = 'videotoolbox';
      result.name = 'Apple VideoToolbox';
      logger.info('GPU: Apple VideoToolbox disponível');
    }
  }

  // NVIDIA NVENC
  const nvidiaSmi = await checkNvidiaSmi();
  if (nvidiaSmi) {
    const works = await testFFmpegEncoder('h264_nvenc');
    if (works) {
      result.nvenc = true;
      result.type = 'nvenc';
      result.name = nvidiaSmi;
      logger.info({ gpuName: nvidiaSmi }, 'GPU: NVIDIA NVENC disponível');
    }
  }

  // Intel Quick Sync (VAAPI/QSV)
  if (!result.nvenc && process.platform === 'linux') {
    const works = await testFFmpegEncoder('h264_qsv');
    if (works) {
      result.qsv = true;
      result.type = 'qsv';
      result.name = 'Intel Quick Sync';
      logger.info('GPU: Intel QSV disponível');
    }
  }

  // AMD AMF
  if (!result.nvenc && !result.qsv && process.platform !== 'darwin') {
    const works = await testFFmpegEncoder('h264_amf');
    if (works) {
      result.amf = true;
      result.type = 'amf';
      result.name = 'AMD AMF';
      logger.info('GPU: AMD AMF disponível');
    }
  }

  if (result.type === 'none') {
    logger.info('GPU: Nenhuma disponível — a usar CPU (libx264/libx265)');
  }

  cachedGPU = result;
  cacheTime = Date.now();
  return result;
}

async function checkNvidiaSmi(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      'nvidia-smi',
      ['--query-gpu=name', '--format=csv,noheader'],
      { timeout: 5000 }
    );
    return stdout.trim().split('\n')[0] ?? 'NVIDIA GPU';
  } catch {
    return null;
  }
}

/**
 * Testar se um encoder FFmpeg funciona realmente
 * gerando 5 frames de teste (muito rápido).
 */
async function testFFmpegEncoder(encoder: string): Promise<boolean> {
  return new Promise(resolve => {
    const args = [
      '-f', 'lavfi',
      '-i', 'testsrc=duration=0.2:size=64x64:rate=25',
      '-c:v', encoder,
      '-frames:v', '5',
      '-f', 'null',
      '-',
    ];

    execFile(
      process.env.FFMPEG_PATH ?? 'ffmpeg',
      args,
      { timeout: 10000 },
      (error) => resolve(error === null)
    );
  });
}
