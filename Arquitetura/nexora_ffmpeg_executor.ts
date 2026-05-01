// ═══════════════════════════════════════════════════════════════
// Nexora Media Processing — FFmpeg Executor
// Ficheiro: src/pipeline/ffmpeg/executor.ts
//
// REGRA ADR-002: FFmpeg NUNCA é chamado com exec() + string.
// Sempre usa execFile() ou spawn() com array de argumentos.
// Isolado em processo filho com timeout e kill automático.
// ═══════════════════════════════════════════════════════════════

import { execFile, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { logger } from '../observability/logger';
import { ffmpegTimeouts } from '../observability/metrics';

const FFMPEG_PATH = process.env.FFMPEG_PATH ?? 'ffmpeg';
const FFPROBE_PATH = process.env.FFPROBE_PATH ?? 'ffprobe';
const DEFAULT_TIMEOUT_MS = Number(process.env.FFMPEG_DEFAULT_TIMEOUT_MS ?? 14400000); // 4h
const SIGTERM_WAIT_MS = 5000; // aguardar 5s antes de SIGKILL

// Classe de erro personalizada
export class NexoraFFmpegError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number | null,
    public readonly stderr: string,
    public readonly command: string[]
  ) {
    super(message);
    this.name = 'NexoraFFmpegError';
  }
}

export class NexoraFFmpegTimeout extends NexoraFFmpegError {
  constructor(timeoutMs: number, command: string[]) {
    super(`FFmpeg excedeu o timeout de ${timeoutMs}ms`, null, '', command);
    this.name = 'NexoraFFmpegTimeout';
  }
}

export interface FFmpegProgress {
  frame: number;
  fps: number;
  bitrate: string;
  totalSize: number;
  outTimeMs: number;
  dupFrames: number;
  dropFrames: number;
  speed: number;
  progressPercent?: number; // calculado se soubermos a duração total
}

export interface FFmpegResult {
  exitCode: number;
  stderr: string;
  durationMs: number;
  command: string[];
}

/**
 * Executa um comando FFmpeg de forma isolada e segura.
 *
 * @param args - Array de argumentos (SEM o "ffmpeg" no início)
 * @param options - Opções de execução
 * @returns Resultado da execução
 *
 * @example
 * await executeFFmpeg(['-i', input, '-c', 'copy', output], {
 *   timeoutMs: 3600000,
 *   onProgress: (p) => console.log(p.progressPercent)
 * });
 */
export async function executeFFmpeg(
  args: string[],
  options: {
    timeoutMs?: number;
    onProgress?: (progress: FFmpegProgress) => void;
    totalDurationMs?: number; // para calcular percentagem de progresso
    assetId?: string;
    jobId?: string;
  } = {}
): Promise<FFmpegResult> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    onProgress,
    totalDurationMs,
    assetId,
    jobId
  } = options;

  const log = logger.child({ asset_id: assetId, job_id: jobId, tool: 'ffmpeg' });
  const startTime = Date.now();

  // Validar que nenhum argumento é undefined ou null
  const cleanArgs = args.filter((a): a is string => typeof a === 'string' && a.length > 0);

  log.info({ args: cleanArgs.join(' ') }, 'A iniciar FFmpeg');

  return new Promise((resolve, reject) => {
    let proc: ChildProcess | null = null;
    let timedOut = false;
    const stderrLines: string[] = [];

    // Timeout handler
    const timeoutId = setTimeout(() => {
      timedOut = true;
      ffmpegTimeouts.inc();
      log.warn({ timeoutMs }, 'FFmpeg timeout — a terminar processo');

      if (proc && proc.pid) {
        // Graceful: SIGTERM primeiro
        proc.kill('SIGTERM');

        // Forçado: SIGKILL após 5s
        setTimeout(() => {
          if (proc && !proc.killed) {
            log.error('FFmpeg não terminou após SIGTERM — a enviar SIGKILL');
            proc.kill('SIGKILL');
          }
        }, SIGTERM_WAIT_MS);
      }

      reject(new NexoraFFmpegTimeout(timeoutMs, [FFMPEG_PATH, ...cleanArgs]));
    }, timeoutMs);

    // Lançar processo
    proc = execFile(
      FFMPEG_PATH,
      cleanArgs,
      { maxBuffer: 100 * 1024 * 1024 }, // 100MB buffer para stderr
      (error, _stdout, stderr) => {
        clearTimeout(timeoutId);

        if (timedOut) return; // já rejeitamos acima

        const durationMs = Date.now() - startTime;

        if (error) {
          log.error(
            { exitCode: error.code, durationMs },
            `FFmpeg falhou: ${error.message}`
          );
          reject(new NexoraFFmpegError(
            `FFmpeg falhou com exit code ${error.code ?? 'unknown'}`,
            error.code ? Number(error.code) : null,
            stderrLines.join('\n'),
            [FFMPEG_PATH, ...cleanArgs]
          ));
          return;
        }

        log.info({ durationMs }, 'FFmpeg concluído com sucesso');
        resolve({
          exitCode: 0,
          stderr: stderrLines.join('\n'),
          durationMs,
          command: [FFMPEG_PATH, ...cleanArgs]
        });
      }
    );

    // Capturar stderr linha a linha (FFmpeg reporta progresso aqui)
    if (proc.stderr) {
      let buffer = '';
      proc.stderr.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // manter linha incompleta no buffer

        for (const line of lines) {
          stderrLines.push(line);

          // Parsear linha de progresso (FFmpeg usa \r para overwrite)
          if (line.startsWith('frame=') && onProgress) {
            const progress = parseFFmpegProgress(line, totalDurationMs);
            if (progress) onProgress(progress);
          }

          // Logar erros e warnings detectados
          if (line.includes('Error') || line.includes('error')) {
            log.warn({ line }, 'FFmpeg stderr error');
          }
        }
      });
    }
  });
}

/**
 * Executa FFprobe e retorna o JSON com metadata do ficheiro.
 * ADR-002: sempre usa execFile, nunca exec().
 */
export async function executeFFprobe(
  inputPath: string,
  options: { assetId?: string } = {}
): Promise<object> {
  return new Promise((resolve, reject) => {
    // SEGURANÇA: validar que o path não tem caracteres maliciosos
    // O NexoraFFmpegCommandBuilder garante paths seguros antes de chegar aqui
    if (!inputPath || typeof inputPath !== 'string') {
      reject(new Error('Path de input inválido para FFprobe'));
      return;
    }

    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      '-show_frames',
      '-read_intervals', '%+#10', // só analisar primeiras 10 frames (mais rápido)
      inputPath
    ];

    execFile(FFPROBE_PATH, args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
      if (error) {
        reject(new Error(`FFprobe falhou: ${error.message}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error('FFprobe retornou JSON inválido'));
      }
    });
  });
}

/** Parsear linha de progresso do FFmpeg */
function parseFFmpegProgress(line: string, totalDurationMs?: number): FFmpegProgress | null {
  try {
    const frame      = parseInt(line.match(/frame=\s*(\d+)/)?.[1] ?? '0');
    const fps        = parseFloat(line.match(/fps=\s*([\d.]+)/)?.[1] ?? '0');
    const bitrate    = line.match(/bitrate=\s*([\d.]+\s*\w+\/s)/)?.[1] ?? '0kbits/s';
    const totalSize  = parseInt(line.match(/size=\s*(\d+)/)?.[1] ?? '0');
    const outTimeStr = line.match(/out_time_ms=(\d+)/)?.[1] ?? '0';
    const outTimeMs  = parseInt(outTimeStr);
    const dupFrames  = parseInt(line.match(/dup_frames=(\d+)/)?.[1] ?? '0');
    const dropFrames = parseInt(line.match(/drop_frames=(\d+)/)?.[1] ?? '0');
    const speed      = parseFloat(line.match(/speed=\s*([\d.]+)x/)?.[1] ?? '0');

    const progressPercent = totalDurationMs
      ? Math.min(100, (outTimeMs / totalDurationMs) * 100)
      : undefined;

    return { frame, fps, bitrate, totalSize, outTimeMs, dupFrames, dropFrames, speed, progressPercent };
  } catch {
    return null;
  }
}


// ═══════════════════════════════════════════════════════════════
// Nexora Media Processing — FFmpeg Command Builder
// Ficheiro: src/pipeline/ffmpeg/builder.ts
//
// SEGURANÇA (ADR-002):
// - Todos os paths são validados contra allowlist de directorias
// - Todos os parâmetros são tipados — sem interpolação de strings
// - Retorna string[] (array), nunca string única para exec()
// ═══════════════════════════════════════════════════════════════

import path from 'path';
import { logger } from '../observability/logger';

const ALLOWED_INPUT_DIRS  = [
  process.env.NEXORA_INPUT_DIR  ?? './media/input',
  process.env.NEXORA_TEMP_DIR   ?? './media/temp',
  process.env.NEXORA_OUTPUT_DIR ?? './media/output',
  // Directorias de testes
  './tests/fixtures',
  './tests/output',
];

export class NexoraSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NexoraSecurityError';
  }
}

export class NexoraFFmpegCommandBuilder {

  /** Validar path de input — SEGURANÇA */
  validateInputPath(inputPath: string): string {
    if (!inputPath || typeof inputPath !== 'string') {
      throw new NexoraSecurityError('Path de input inválido ou vazio');
    }

    // Resolver path absoluto
    const resolved = path.resolve(inputPath);

    // Verificar contra allowlist
    const allowed = ALLOWED_INPUT_DIRS
      .filter(Boolean)
      .map(d => path.resolve(d));

    const isAllowed = allowed.some(dir => resolved.startsWith(dir + path.sep) || resolved === dir);

    if (!isAllowed) {
      throw new NexoraSecurityError(
        `Path "${resolved}" fora das directorias permitidas. ` +
        `Permitido: ${allowed.join(', ')}`
      );
    }

    // Verificar caracteres perigosos no path
    const dangerous = ['|', '&', ';', '`', '$', '(', ')', '{', '}', '\0', '\n', '\r'];
    for (const char of dangerous) {
      if (inputPath.includes(char)) {
        throw new NexoraSecurityError(
          `Carácter proibido "${char}" detectado no path — possível tentativa de injection`
        );
      }
    }

    return resolved;
  }

  /** Validar bitrate em kbps */
  private validateBitrate(kbps: number): number {
    if (!Number.isInteger(kbps) || kbps < 100 || kbps > 200000) {
      throw new RangeError(`Bitrate ${kbps}kbps fora do intervalo válido (100-200000)`);
    }
    return kbps;
  }

  /** Calcular GOP size correcto (sempre fps × 2) */
  private calcGopSize(fps: number): number {
    return Math.round(fps) * 2;
  }

  /**
   * Construir comando para perfil Broadcast HD (H.264)
   * Inclui todos os parâmetros obrigatórios ADR-006
   */
  buildBroadcastHD(params: {
    inputPath: string;
    outputPath: string;
    fps?: number;
    bitrateKbps?: number;
    audioBitrateKbps?: number;
    audioLoudnormPass2?: {
      measuredI: number;
      measuredTP: number;
      measuredLRA: number;
      measuredThresh: number;
      offset: number;
    };
  }): string[] {
    const input  = this.validateInputPath(params.inputPath);
    const output = this.validateInputPath(params.outputPath);
    const fps    = params.fps ?? 25;
    const gop    = this.calcGopSize(fps);
    const vbr    = this.validateBitrate(params.bitrateKbps ?? 8000);
    const maxr   = vbr; // CBR para broadcast
    const bufs   = vbr * 2; // VBV buffer = 2× bitrate

    const audioFilter = params.audioLoudnormPass2
      ? `loudnorm=I=-23:TP=-1:LRA=11:` +
        `measured_I=${params.audioLoudnormPass2.measuredI}:` +
        `measured_TP=${params.audioLoudnormPass2.measuredTP}:` +
        `measured_LRA=${params.audioLoudnormPass2.measuredLRA}:` +
        `measured_thresh=${params.audioLoudnormPass2.measuredThresh}:` +
        `offset=${params.audioLoudnormPass2.offset}:` +
        `linear=true`
      : null;

    const cmd: string[] = [
      '-y',                              // sobrescrever output sem perguntar
      '-i', input,                       // input

      // ── Vídeo ──
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-tune', 'film',
      '-profile:v', 'high',
      '-level:v', '4.1',
      '-pix_fmt', 'yuv420p',             // ADR-004: pixel format obrigatório

      // ── GOP (ADR-006) ──
      '-g', String(gop),                 // GOP = fps × 2
      '-keyint_min', String(gop),        // keyint_min = GOP (sem GOP curto)
      '-sc_threshold', '0',              // SEM keyframes extra em scene cuts
      '-flags', '+cgop',                 // Closed GOP obrigatório
      '-x264-params', [                  // Parâmetros X264 específicos
        'open-gop=0',                    // confirmar Open GOP desactivado
        'bframes=0',                     // sem B-frames em broadcast linear
        'ref=4',                         // 4 frames de referência
        'nal-hrd=cbr',                   // NAL HRD para CBR broadcast
        'force-cfr=1',                   // forçar CFR
      ].join(':'),

      // ── Bitrate CBR ──
      '-b:v', `${vbr}k`,
      '-maxrate', `${maxr}k`,
      '-bufsize', `${bufs}k`,

      // ── Colorimetria BT.709 ──
      '-colorspace', 'bt709',
      '-color_primaries', 'bt709',
      '-color_trc', 'bt709',

      // ── Frame rate forçado CFR ──
      '-r', String(fps),
      '-vsync', 'cfr',

      // ── Áudio ──
      '-c:a', 'pcm_s24le',               // PCM 24-bit para broadcast
      '-ar', '48000',                    // 48kHz obrigatório
    ];

    // Adicionar loudness normalization se temos os valores medidos
    if (audioFilter) {
      cmd.push('-af', audioFilter);
    }

    // Fast Start: moov atom no início do ficheiro
    cmd.push('-movflags', '+faststart');

    cmd.push(output);

    return cmd;
  }

  /**
   * Construir comando para análise de loudness (Pass 1 de EBU R128)
   * Não produz ficheiro de output — só análise.
   */
  buildLoudnessAnalysis(inputPath: string): string[] {
    const input = this.validateInputPath(inputPath);
    return [
      '-i', input,
      '-af', 'loudnorm=I=-23:TP=-1:LRA=11:print_format=json',
      '-f', 'null',
      '-'
    ];
  }

  /**
   * Construir comando para proxy LowRes (usando parâmetros simples)
   * HandBrake é preferido para proxies, mas este é o fallback FFmpeg.
   */
  buildProxyLowRes(params: {
    inputPath: string;
    outputPath: string;
  }): string[] {
    const input  = this.validateInputPath(params.inputPath);
    const output = this.validateInputPath(params.outputPath);
    return [
      '-y',
      '-i', input,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-profile:v', 'high',
      '-level:v', '3.1',
      '-pix_fmt', 'yuv420p',
      '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
      '-b:v', '800k',
      '-maxrate', '1000k',
      '-bufsize', '1600k',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '48000',
      '-ac', '2',
      '-movflags', '+faststart',
      output
    ];
  }

  /**
   * Construir comando para thumbnail sprite sheet
   */
  buildThumbnailSprites(params: {
    inputPath: string;
    outputPath: string;
    interval?: number;   // segundos entre thumbnails (default: 10)
    cols?: number;       // colunas no grid (default: 10)
    width?: number;      // largura de cada thumbnail (default: 160)
    height?: number;     // altura de cada thumbnail (default: 90)
  }): string[] {
    const input    = this.validateInputPath(params.inputPath);
    const output   = this.validateInputPath(params.outputPath);
    const interval = params.interval ?? 10;
    const cols     = params.cols ?? 10;
    const w        = params.width ?? 160;
    const h        = params.height ?? 90;

    return [
      '-y',
      '-i', input,
      '-vf', `fps=1/${interval},scale=${w}:${h},tile=${cols}x100`,
      '-frames:v', '1',
      '-q:v', '3',
      output
    ];
  }

  /**
   * Construir comando para VMAF scoring (comparação referência vs encode)
   */
  buildVMAFScore(params: {
    referencePath: string;
    encodedPath: string;
    logPath: string;
    subsample?: number; // analisar 1 de cada N frames (default: 5)
  }): string[] {
    const ref     = this.validateInputPath(params.referencePath);
    const encoded = this.validateInputPath(params.encodedPath);
    const log     = params.logPath;
    const n       = params.subsample ?? 5;

    return [
      '-i', ref,
      '-i', encoded,
      '-lavfi',
      [
        `[0:v][1:v]libvmaf=`,
        `log_fmt=json:`,
        `log_path=${log}:`,
        `n_subsample=${n}:`,
        `model=version=vmaf_v0.6.1`
      ].join(''),
      '-f', 'null',
      '-'
    ];
  }
}

// Instância singleton
export const ffmpegBuilder = new NexoraFFmpegCommandBuilder();


// ═══════════════════════════════════════════════════════════════
// Nexora Media Processing — FFmpeg Stderr Parser
// Ficheiro: src/pipeline/ffmpeg/parser.ts
//
// Parseia o stderr do FFmpeg em eventos estruturados
// para logging, debugging e detecção de erros.
// ═══════════════════════════════════════════════════════════════

export type FFmpegLogLevel = 'debug' | 'verbose' | 'info' | 'warning' | 'error' | 'fatal';

export interface FFmpegLogEvent {
  level: FFmpegLogLevel;
  message: string;
  rawLine: string;
  timestamp?: Date;
}

export interface FFmpegStreamInfo {
  index: number;
  type: 'video' | 'audio' | 'subtitle' | 'data';
  codec: string;
  profile?: string;
  width?: number;
  height?: number;
  fps?: number;
  bitrate?: string;
  sampleRate?: number;
  channels?: number;
}

export interface FFmpegParsedOutput {
  streams: FFmpegStreamInfo[];
  duration?: number;    // segundos
  bitrate?: number;     // kbps
  errors: FFmpegLogEvent[];
  warnings: FFmpegLogEvent[];
  hasCorruptData: boolean;
  hasMissingFrames: boolean;
  hasTimestampIssues: boolean;
}

/** Padrões de erro do FFmpeg a detectar */
const ERROR_PATTERNS: Array<{ pattern: RegExp; level: FFmpegLogLevel; description: string }> = [
  { pattern: /moov atom not found/i,              level: 'error',   description: 'Container MP4 corrompido — sem moov atom' },
  { pattern: /Invalid data found when processing/i, level: 'error', description: 'Stream corrompido ou formato inválido' },
  { pattern: /Conversion failed!/i,               level: 'error',   description: 'Encoding falhou' },
  { pattern: /No such file or directory/i,        level: 'error',   description: 'Ficheiro não encontrado' },
  { pattern: /Permission denied/i,                level: 'error',   description: 'Sem permissão de acesso' },
  { pattern: /DTS .*, resampling/i,               level: 'warning', description: 'Problema de timestamps DTS' },
  { pattern: /non monotonically increasing dts/i, level: 'warning', description: 'DTS fora de ordem' },
  { pattern: /Discarding invalid/i,               level: 'warning', description: 'Amostras de áudio inválidas descartadas' },
  { pattern: /past duration/i,                    level: 'warning', description: 'Duração passada — possível problema de bitrate' },
  { pattern: /Queue input is backward in time/i,  level: 'warning', description: 'Input de queue fora de ordem temporal' },
  { pattern: /dropping duplicated frame/i,        level: 'info',    description: 'Frame duplicada descartada' },
  { pattern: /Last message repeated/i,            level: 'info',    description: 'Mensagem repetida — possível loop' },
];

export function parseFFmpegStderr(stderr: string): FFmpegParsedOutput {
  const lines  = stderr.split('\n').filter(l => l.trim().length > 0);
  const errors: FFmpegLogEvent[] = [];
  const warnings: FFmpegLogEvent[] = [];
  const streams: FFmpegStreamInfo[] = [];

  let hasCorruptData = false;
  let hasMissingFrames = false;
  let hasTimestampIssues = false;

  for (const rawLine of lines) {
    // Detectar nível do log do FFmpeg
    let level: FFmpegLogLevel = 'info';
    if (/^\[.*\] error/i.test(rawLine) || /conversion failed/i.test(rawLine)) {
      level = 'error';
    } else if (/^\[.*\] warning/i.test(rawLine) || /^\[.*\] warn/i.test(rawLine)) {
      level = 'warning';
    }

    // Verificar contra padrões conhecidos
    for (const { pattern, level: patternLevel, description } of ERROR_PATTERNS) {
      if (pattern.test(rawLine)) {
        const event: FFmpegLogEvent = {
          level: patternLevel,
          message: description,
          rawLine,
          timestamp: new Date()
        };

        if (patternLevel === 'error') {
          errors.push(event);
          if (/corrupt|invalid data/i.test(rawLine)) hasCorruptData = true;
        } else if (patternLevel === 'warning') {
          warnings.push(event);
          if (/dts|timestamp/i.test(rawLine)) hasTimestampIssues = true;
          if (/missing frame|drop/i.test(rawLine)) hasMissingFrames = true;
        }
        break;
      }
    }

    // Parsear informação de streams (linha "Stream #0:0")
    const streamMatch = rawLine.match(/Stream #(\d+):(\d+).*?: (Video|Audio|Subtitle|Data): (.+)/i);
    if (streamMatch) {
      const type = streamMatch[3].toLowerCase() as 'video' | 'audio' | 'subtitle' | 'data';
      const codecInfo = streamMatch[4];

      const streamInfo: FFmpegStreamInfo = {
        index: parseInt(streamMatch[2]),
        type,
        codec: codecInfo.split(',')[0].trim(),
      };

      if (type === 'video') {
        const fpsMatch = codecInfo.match(/([\d.]+) fps/);
        const resMatch = codecInfo.match(/(\d{2,4})x(\d{2,4})/);
        if (fpsMatch) streamInfo.fps = parseFloat(fpsMatch[1]);
        if (resMatch) {
          streamInfo.width  = parseInt(resMatch[1]);
          streamInfo.height = parseInt(resMatch[2]);
        }
      } else if (type === 'audio') {
        const srMatch  = codecInfo.match(/(\d{4,6}) Hz/);
        const chMatch  = codecInfo.match(/stereo|mono|(\d+) channels?/i);
        if (srMatch) streamInfo.sampleRate = parseInt(srMatch[1]);
        if (chMatch) {
          if (chMatch[0].toLowerCase() === 'stereo') streamInfo.channels = 2;
          else if (chMatch[0].toLowerCase() === 'mono') streamInfo.channels = 1;
          else if (chMatch[1]) streamInfo.channels = parseInt(chMatch[1]);
        }
      }

      streams.push(streamInfo);
    }
  }

  // Extrair duração global
  const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d+)/);
  const duration = durationMatch
    ? parseInt(durationMatch[1]) * 3600 +
      parseInt(durationMatch[2]) * 60   +
      parseInt(durationMatch[3])        +
      parseFloat(`0.${durationMatch[4]}`)
    : undefined;

  // Extrair bitrate global
  const bitrateMatch = stderr.match(/bitrate: ([\d.]+) kb\/s/);
  const bitrate = bitrateMatch ? parseFloat(bitrateMatch[1]) : undefined;

  return {
    streams,
    duration,
    bitrate,
    errors,
    warnings,
    hasCorruptData,
    hasMissingFrames,
    hasTimestampIssues,
  };
}
