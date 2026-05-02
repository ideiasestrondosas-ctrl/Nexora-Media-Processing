// Nexora Media Processing — FFmpeg Command Builder
// Ficheiro: src/pipeline/ffmpeg/builder.ts
//
// Gera arrays de argumentos FFmpeg tipados para todos os perfis Nexora.
// Cada perfil tem duas variantes: GPU (NVENC) e CPU (libx264) fallback.
//
// SEGURANÇA (ADR-002):
// - Todos os paths são passados como elementos separados do array
// - Todos os parâmetros são tipados — sem interpolação de strings não validadas
// - Retorna string[] (array), NUNCA string única para exec()
//
// ADR-004: yuv420p obrigatório em todos os perfis
// ADR-006: Closed GOP, zero B-frames em broadcast, force-cfr=1

import type { GPUCapability } from './gpu-detector';

// ── Tipos públicos ───────────────────────────────────────────────

/** Encoder disponível para seleção */
export type EncoderType = 'cpu' | 'nvenc' | 'qsv' | 'amf';

/** Resultado do builder: array de argumentos FFmpeg tipado */
export interface FFmpegCommand {
  /** Argumentos para passar ao spawn() — NUNCA concatenar numa string */
  args: string[];
  /** Encoder utilizado neste comando */
  encoder: EncoderType;
  /** Nome do perfil Nexora */
  profile: string;
  /** Bitrate de vídeo alvo em kbps */
  videoBitrateK: number;
}

/** Par de comandos: GPU primário + CPU fallback */
export interface FFmpegCommandPair {
  gpu: FFmpegCommand | null;  // null se GPU não disponível
  cpu: FFmpegCommand;
}

/** Parâmetros de áudio para substituição no loudnorm */
export interface AudioLoudnormParams {
  targetLufs: number;
  truePeakLimit: number;
  measuredI?: string;
  measuredTp?: string;
  measuredLra?: string;
  measuredThresh?: string;
  offset?: string;
  linearMode?: boolean;
}

// ── Definição interna de perfis ──────────────────────────────────

interface NexoraProfile {
  name: string;
  /** kbps de vídeo alvo */
  videoBitrateK: number;
  maxrateK: number;
  bufsizeK: number;
  /** Frames por GOP — ADR-006: 2s a 25fps = 50 */
  gopSize: number;
  /** Pixel format — ADR-004: yuv420p obrigatório */
  pixFmt: 'yuv420p';
  /** Preset CPU libx264 */
  cpuPreset: 'slow' | 'medium' | 'fast' | 'veryfast';
  /** Preset NVENC (p1=fastest, p7=slowest/best) */
  nvencPreset: 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6' | 'p7';
  /** B-frames — ADR-006: 0 para broadcast */
  bFrames: number;
  /** Rate control mode CPU */
  rateControlCpu: string;
  /** Rate control mode GPU */
  rateControlGpu: 'cbr' | 'vbr' | 'constqp';
  /** Codec de áudio: pcm_s24le em broadcast, aac nos restantes */
  audioCodec: 'pcm_s24le' | 'aac' | 'libfdk_aac';
  audioBitrateK: number;
  audioSampleRate: 48000;
  /** Profile H.264 */
  h264Profile: 'high' | 'main' | 'baseline';
  /** Level H.264 */
  h264Level: '4.1' | '4.0' | '3.1';
}

const NEXORA_PROFILES: Record<string, NexoraProfile> = {
  'broadcast-hd': {
    name: 'Nexora Broadcast HD',
    videoBitrateK: 8000,
    maxrateK: 10000,
    bufsizeK: 20000,
    gopSize: 50,            // 2s a 25fps — ADR-006
    pixFmt: 'yuv420p',     // ADR-004
    cpuPreset: 'slow',
    nvencPreset: 'p4',
    bFrames: 0,             // ADR-006: zero B-frames broadcast
    rateControlCpu: 'cbr',
    rateControlGpu: 'cbr',
    audioCodec: 'pcm_s24le', // Broadcast: PCM sem perdas
    audioBitrateK: 0,        // PCM não usa bitrate
    audioSampleRate: 48000,
    h264Profile: 'high',
    h264Level: '4.1',
  },
  'ott-hd': {
    name: 'Nexora OTT HD',
    videoBitrateK: 5000,
    maxrateK: 7000,
    bufsizeK: 14000,
    gopSize: 48,           // 2s a 24fps
    pixFmt: 'yuv420p',
    cpuPreset: 'medium',
    nvencPreset: 'p5',
    bFrames: 2,            // B-frames permitidos em OTT
    rateControlCpu: 'vbr',
    rateControlGpu: 'vbr',
    audioCodec: 'aac',
    audioBitrateK: 192,
    audioSampleRate: 48000,
    h264Profile: 'high',
    h264Level: '4.0',
  },
  'web-sd': {
    name: 'Nexora Web SD',
    videoBitrateK: 2000,
    maxrateK: 3000,
    bufsizeK: 6000,
    gopSize: 60,
    pixFmt: 'yuv420p',
    cpuPreset: 'medium',
    nvencPreset: 'p6',
    bFrames: 2,
    rateControlCpu: 'vbr',
    rateControlGpu: 'vbr',
    audioCodec: 'aac',
    audioBitrateK: 128,
    audioSampleRate: 48000,
    h264Profile: 'main',
    h264Level: '3.1',
  },
  'proxy': {
    name: 'Nexora Proxy',
    videoBitrateK: 800,
    maxrateK: 1000,
    bufsizeK: 2000,
    gopSize: 60,
    pixFmt: 'yuv420p',
    cpuPreset: 'fast',
    nvencPreset: 'p7',
    bFrames: 2,
    rateControlCpu: 'vbr',
    rateControlGpu: 'vbr',
    audioCodec: 'aac',
    audioBitrateK: 96,
    audioSampleRate: 48000,
    h264Profile: 'main',
    h264Level: '3.1',
  },
};

// ── Builder principal ────────────────────────────────────────────

export class NexoraFFmpegCommandBuilder {

  /**
   * Gera o par de comandos FFmpeg (GPU + CPU) para um perfil.
   * @param profile - Nome do perfil (ex: 'broadcast-hd')
   * @param input   - Path absoluto do ficheiro de entrada
   * @param output  - Path absoluto do ficheiro de saída
   * @param gpu     - Capacidade GPU detectada (null = sem GPU)
   * @param loudnorm - Parâmetros de loudnorm (opcional, para Pass 2)
   */
  build(
    profile: string,
    input: string,
    output: string,
    gpu: GPUCapability | null = null,
    loudnorm?: AudioLoudnormParams
  ): FFmpegCommandPair {
    const p = NEXORA_PROFILES[profile] ?? NEXORA_PROFILES['broadcast-hd'];

    const audioArgs = this.buildAudioArgs(p, loudnorm);

    const cpu: FFmpegCommand = {
      args: this.buildCpuArgs(input, output, p, audioArgs),
      encoder: 'cpu',
      profile,
      videoBitrateK: p.videoBitrateK,
    };

    let gpuCommand: FFmpegCommand | null = null;
    if (gpu?.available && gpu.type !== 'none') {
      gpuCommand = {
        args: this.buildGpuArgs(input, output, p, audioArgs, gpu.type),
        encoder: gpu.type as EncoderType,
        profile,
        videoBitrateK: p.videoBitrateK,
      };
    }

    return { gpu: gpuCommand, cpu };
  }

  /**
   * Constrói argumentos para CPU libx264.
   * ADR-002: array tipado, nunca string
   * ADR-006: Closed GOP, force-cfr, zero B-frames em broadcast
   */
  private buildCpuArgs(
    input: string,
    output: string,
    p: NexoraProfile,
    audioArgs: string[]
  ): string[] {
    const args: string[] = [
      '-y',
      '-i', input,
      // Vídeo
      '-c:v', 'libx264',
      '-preset', p.cpuPreset,
      '-tune', 'film',
      '-profile:v', p.h264Profile,
      '-level:v', p.h264Level,
      '-pix_fmt', p.pixFmt,         // ADR-004
      '-g', String(p.gopSize),       // GOP size — ADR-006
      '-keyint_min', String(p.gopSize),
      '-sc_threshold', '0',          // sem scene-cut detection
      '-flags', '+cgop',             // Closed GOP — ADR-006
      '-bf', String(p.bFrames),      // B-frames (0 para broadcast)
    ];

    // Parâmetros x264 específicos para broadcast (ADR-006)
    if (p.bFrames === 0) {
      args.push('-x264-params', 'open-gop=0:bframes=0:ref=4:nal-hrd=cbr:force-cfr=1');
    }

    args.push(
      '-b:v', `${p.videoBitrateK}k`,
      '-maxrate', `${p.maxrateK}k`,
      '-bufsize', `${p.bufsizeK}k`,
      // Colorspace BT.709
      '-colorspace', 'bt709',
      '-color_primaries', 'bt709',
      '-color_trc', 'bt709',
      '-r', '25',
      '-vsync', 'cfr',               // CFR obrigatório — ADR-006
    );

    // Áudio
    args.push(...audioArgs);

    // Container
    args.push('-movflags', '+faststart', output);

    return args;
  }

  /**
   * Constrói argumentos para GPU NVENC (h264_nvenc).
   * Inclui hwaccel CUDA e parâmetros CBR para broadcast.
   */
  private buildGpuArgs(
    input: string,
    output: string,
    p: NexoraProfile,
    audioArgs: string[],
    gpuType: string
  ): string[] {
    // Determinar encoder e hwaccel por tipo de GPU
    const { hwaccel, hwaccelOutput, encoder } = this.resolveGpuEncoder(gpuType);

    const args: string[] = [
      '-y',
    ];

    // Hardware acceleration
    if (hwaccel) {
      args.push('-hwaccel', hwaccel);
      if (hwaccelOutput) {
        args.push('-hwaccel_output_format', hwaccelOutput);
      }
    }

    args.push(
      '-i', input,
      // Vídeo GPU
      '-c:v', encoder,
      '-preset', p.nvencPreset,
      '-tune', 'hq',
      '-profile:v', p.h264Profile,
      '-level:v', p.h264Level,
      '-pix_fmt', p.pixFmt,          // ADR-004
      '-g', String(p.gopSize),        // ADR-006
      '-keyint_min', String(p.gopSize),
    );

    // Parâmetros específicos NVENC broadcast (ADR-006)
    if (encoder === 'h264_nvenc' && p.bFrames === 0) {
      args.push('-forced-idr', '1', '-no-scenecut', '1');
    }

    args.push(
      '-b:v', `${p.videoBitrateK}k`,
      '-maxrate', `${p.maxrateK}k`,
      '-bufsize', `${p.bufsizeK}k`,
      '-rc', p.rateControlGpu,
      // Colorspace BT.709
      '-colorspace', 'bt709',
      '-color_primaries', 'bt709',
      '-color_trc', 'bt709',
    );

    // Áudio
    args.push(...audioArgs);

    // Container
    args.push('-movflags', '+faststart', output);

    return args;
  }

  /** Resolve encoder e hwaccel pelo tipo de GPU detectado */
  private resolveGpuEncoder(gpuType: string): {
    hwaccel: string | null;
    hwaccelOutput: string | null;
    encoder: string;
  } {
    switch (gpuType) {
      case 'nvenc':
        return { hwaccel: 'cuda', hwaccelOutput: 'cuda', encoder: 'h264_nvenc' };
      case 'qsv':
        return { hwaccel: 'qsv', hwaccelOutput: null, encoder: 'h264_qsv' };
      case 'amf':
        return { hwaccel: null, hwaccelOutput: null, encoder: 'h264_amf' };
      default:
        return { hwaccel: null, hwaccelOutput: null, encoder: 'libx264' };
    }
  }

  /**
   * Constrói os argumentos de áudio com ou sem loudnorm.
   * Se loudnorm não for passado: usa o codec sem filtro.
   * Se passado sem valores medidos: Pass 1 (análise).
   * Se passado com valores medidos: Pass 2 (normalização linear).
   */
  private buildAudioArgs(p: NexoraProfile, loudnorm?: AudioLoudnormParams): string[] {
    const args: string[] = ['-c:a', p.audioCodec];

    if (p.audioCodec !== 'pcm_s24le') {
      args.push('-b:a', `${p.audioBitrateK}k`);
    }

    args.push('-ar', String(p.audioSampleRate));

    if (loudnorm) {
      const filter = this.buildLoudnormFilter(loudnorm);
      args.push('-af', filter);
    }

    return args;
  }

  /** Constrói o filtro loudnorm com os parâmetros correctos */
  private buildLoudnormFilter(params: AudioLoudnormParams): string {
    const base = `loudnorm=I=-${params.targetLufs}:TP=-${Math.abs(params.truePeakLimit)}:LRA=11`;

    // Pass 2: usa valores medidos para normalização linear
    if (params.measuredI !== undefined) {
      return [
        base,
        `measured_I=${params.measuredI}`,
        `measured_TP=${params.measuredTp ?? '-1.0'}`,
        `measured_LRA=${params.measuredLra ?? '11'}`,
        `measured_thresh=${params.measuredThresh ?? '-31.0'}`,
        `offset=${params.offset ?? '0.0'}`,
        params.linearMode !== false ? 'linear=true' : 'linear=false',
      ].join(':');
    }

    // Pass 1: apenas análise
    return `${base}:print_format=json`;
  }

  /**
   * Retorna a lista de todos os perfis disponíveis.
   */
  static getAvailableProfiles(): string[] {
    return Object.keys(NEXORA_PROFILES);
  }

  /**
   * Retorna os metadados de um perfil (bitrates, GOP, etc).
   */
  static getProfileMetadata(profile: string): NexoraProfile | null {
    return NEXORA_PROFILES[profile] ?? null;
  }
}

// Exportar singleton para uso directo
export const ffmpegBuilder = new NexoraFFmpegCommandBuilder();
