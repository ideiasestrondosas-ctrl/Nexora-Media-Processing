// Nexora Media Processing — MediaInfo Adapter
// Ficheiro: src/pipeline/tools/mediainfo-adapter.ts
//
// Wrapper type-safe à volta do output JSON do MediaInfo.
// Extrai VideoMetadata, AudioMetadata e ContainerMetadata compatíveis
// com o motor de regras QC existente (src/qc/rules/index.ts).
//
// ADR-002: execFile com array — nunca string concatenada.

import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../observability/logger';
import { toolRegistry } from './availability-checker';
import type { VideoMetadata, AudioMetadata, ContainerMetadata } from '../../qc/rules/index';

const execFileAsync = promisify(execFile);

// ── Tipos do MediaInfo JSON ──────────────────────────────────────

export interface MediaInfoResult {
  media?: {
    track?: MediaInfoTrack[];
  };
}

export interface MediaInfoTrack {
  '@type': 'General' | 'Video' | 'Audio' | 'Text' | 'Other' | 'Menu' | 'Image';
  Format?: string;
  Format_Profile?: string;
  Format_Level?: string;
  Format_Commercial?: string;
  CodecID?: string;
  Width?: string;
  Height?: string;
  FrameRate?: string;
  FrameRate_Mode?: string;
  FrameRate_Num?: string;
  FrameRate_Den?: string;
  BitRate?: string;
  BitRate_Mode?: string;
  Duration?: string;
  ColorSpace?: string;
  ChromaSubsampling?: string;
  BitDepth?: string;
  ScanType?: string;
  ScanOrder?: string;
  colour_primaries?: string;
  transfer_characteristics?: string;
  matrix_coefficients?: string;
  SamplingRate?: string;
  Channels?: string;
  ChannelPositions?: string;
  ChannelLayout?: string;
  StreamSize?: string;
  Encoded_Library?: string;
  IsStreamable?: string;
  FileSize?: string;
  OverallBitRate?: string;
  Encoded_Date?: string;
  extra?: Record<string, string>;
  [key: string]: string | Record<string, string> | undefined;
}

export interface MediaInfoGeneralTrack extends MediaInfoTrack {
  '@type': 'General';
  Format: string;
  FileSize?: string;
  OverallBitRate?: string;
}

export interface MediaInfoVideoTrack extends MediaInfoTrack {
  '@type': 'Video';
}

export interface MediaInfoAudioTrack extends MediaInfoTrack {
  '@type': 'Audio';
}

export interface MediaInfoTextTrack extends MediaInfoTrack {
  '@type': 'Text';
}

// ── Constantes ───────────────────────────────────────────────────

const MEDIAINFO_TIMEOUT_MS = 30_000; // 30s

// ── Adapter ──────────────────────────────────────────────────────

export class NexoraMediaInfoAdapter {

  /**
   * Executa MediaInfo e devolve o output JSON parseado e tipado.
   * @throws ToolNotAvailableError se MediaInfo não estiver instalado.
   */
  async analyze(filePath: string): Promise<MediaInfoResult> {
    toolRegistry.requireTool('mediainfo');
    const mediaInfoPath = toolRegistry.getPath('mediainfo');

    const { stdout } = await execFileAsync(
      mediaInfoPath,
      ['--Output=JSON', filePath],
      { timeout: MEDIAINFO_TIMEOUT_MS }
    );

    return JSON.parse(stdout) as MediaInfoResult;
  }

  /**
   * Analisa um ficheiro e devolve o resultado.
   * Em caso de falha, devolve resultado vazio (para fallback a FFprobe).
   */
  async analyzeSafe(filePath: string): Promise<MediaInfoResult> {
    try {
      return await this.analyze(filePath);
    } catch (error) {
      logger.warn(
        { filePath, error: String(error) },
        'MediaInfo não disponível ou falhou — metadata mínima'
      );
      return {};
    }
  }

  // ── Helpers de extracção tipada ────────────────────────────────

  /** Extrai todas as tracks de um tipo específico */
  getTracks(result: MediaInfoResult, type: string): MediaInfoTrack[] {
    return (result.media?.track ?? []).filter(t => t['@type'] === type);
  }

  /** Devolve a primeira video track */
  getVideoTrack(result: MediaInfoResult): MediaInfoVideoTrack | null {
    return (this.getTracks(result, 'Video')[0] as MediaInfoVideoTrack) ?? null;
  }

  /** Devolve a primeira audio track */
  getAudioTrack(result: MediaInfoResult): MediaInfoAudioTrack | null {
    return (this.getTracks(result, 'Audio')[0] as MediaInfoAudioTrack) ?? null;
  }

  /** Devolve a general track */
  getGeneralTrack(result: MediaInfoResult): MediaInfoGeneralTrack | null {
    return (this.getTracks(result, 'General')[0] as MediaInfoGeneralTrack) ?? null;
  }

  /** Devolve todas as text/subtitle tracks */
  getTextTracks(result: MediaInfoResult): MediaInfoTextTrack[] {
    return this.getTracks(result, 'Text') as MediaInfoTextTrack[];
  }

  // ── Conversão para tipos QC ───────────────────────────────────

  /**
   * Converte o resultado MediaInfo para VideoMetadata (compatível com QC engine).
   */
  extractVideoMetadata(result: MediaInfoResult): VideoMetadata {
    const v = this.getVideoTrack(result);
    const g = this.getGeneralTrack(result);
    const isStreamable = g?.IsStreamable?.toLowerCase() === 'yes';

    // Parsear frame rate
    const frameRate = Number(v?.FrameRate ?? 0);
    const frameRateMode = (v?.FrameRate_Mode?.toUpperCase() ?? 'UNKNOWN') as 'CFR' | 'VFR' | 'UNKNOWN';

    return {
      codec: v?.Format?.toLowerCase() ?? 'unknown',
      profile: v?.Format_Profile ?? '',
      level: v?.Format_Level ?? '',
      pixelFormat: this.inferPixelFormat(v),
      frameRate,
      frameRateMode,
      gopType: 'UNKNOWN', // MediaInfo não reporta GOP directamente
      hasIdrFrames: true,
      bFrameCount: 0, // MediaInfo não reporta B-frame count directamente
      bitrate: Number(v?.BitRate ?? g?.OverallBitRate ?? 0),
      width: Number(v?.Width ?? 0),
      height: Number(v?.Height ?? 0),
      bitDepth: (Number(v?.BitDepth ?? 8) as 8 | 10 | 12) || 8,
      colorSpace: v?.ColorSpace ?? '',
      colorPrimaries: v?.colour_primaries ?? '',
      transferCharacteristics: v?.transfer_characteristics ?? '',
      duration: this.parseDuration(v?.Duration ?? g?.Duration),
      hasFastStart: isStreamable,
    };
  }

  /**
   * Converte o resultado MediaInfo para AudioMetadata (compatível com QC engine).
   */
  extractAudioMetadata(result: MediaInfoResult): AudioMetadata {
    const a = this.getAudioTrack(result);

    return {
      codec: a?.Format?.toLowerCase() ?? 'unknown',
      sampleRate: Number(a?.SamplingRate ?? 0),
      bitDepth: Number(a?.BitDepth ?? 0),
      channels: Number(a?.Channels ?? 0),
      channelLayout: a?.ChannelLayout ?? a?.ChannelPositions ?? '',
      integratedLufs: null, // Requer BS1770GAIN (adaptador separado)
      truePeakDbtp: null,
      loudnessRange: null,
      audioVideoSyncMs: null,
    };
  }

  /**
   * Converte o resultado MediaInfo para ContainerMetadata (compatível com QC engine).
   */
  extractContainerMetadata(result: MediaInfoResult): ContainerMetadata {
    const g = this.getGeneralTrack(result);
    const isStreamable = g?.IsStreamable?.toLowerCase() === 'yes';

    return {
      format: g?.Format?.toLowerCase() ?? 'unknown',
      duration: this.parseDuration(g?.Duration),
      size: Number(g?.FileSize ?? 0),
      hasEditLists: false, // MediaInfo não reporta edit lists directamente
      hasTimecodeTrack: this.getTracks(result, 'Other').some(
        t => (t['Format'] ?? '').toLowerCase().includes('timecode')
      ),
      moovPosition: isStreamable ? 'start' : 'unknown',
    };
  }

  // ── Utilitários privados ──────────────────────────────────────

  /** Infere o pixel format a partir de MediaInfo fields */
  private inferPixelFormat(track: MediaInfoVideoTrack | null): string {
    if (!track) return 'unknown';
    const cs = (track.ColorSpace ?? '').toLowerCase();
    const chroma = (track.ChromaSubsampling ?? '').replace(/[:/]/g, '');
    const depth = track.BitDepth ?? '8';

    if (cs === 'yuv' && chroma === '420' && depth === '8') return 'yuv420p';
    if (cs === 'yuv' && chroma === '420' && depth === '10') return 'yuv420p10le';
    if (cs === 'yuv' && chroma === '422' && depth === '8') return 'yuv422p';
    if (cs === 'yuv' && chroma === '422' && depth === '10') return 'yuv422p10le';
    if (cs === 'rgb') return 'rgb24';

    return chroma ? `${cs}${chroma}p` : cs || 'unknown';
  }

  /** Parseia duração do MediaInfo (pode ser em ms ou HH:MM:SS.mmm) */
  private parseDuration(duration?: string): number {
    if (!duration) return 0;
    const num = Number(duration);
    if (!isNaN(num)) {
      // MediaInfo pode devolver em ms ou segundos dependendo do campo
      return num > 100000 ? num / 1000 : num;
    }
    // Formato HH:MM:SS.mmm
    const m = duration.match(/(\d+):(\d+):([\d.]+)/);
    if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    return 0;
  }
}

// ── Singleton ────────────────────────────────────────────────────

export const mediainfoAdapter = new NexoraMediaInfoAdapter();
