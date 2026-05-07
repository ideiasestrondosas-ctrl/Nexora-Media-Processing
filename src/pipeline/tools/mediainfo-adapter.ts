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
  Format_Version?: string;
  Format_Settings_GOP?: string;    // "M=1, N=50"
  Format_Settings_CABAC?: string;  // "Yes" / "No"
  Format_Settings_RefFrames?: string;
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
  ScanType?: string;               // "Progressive" | "Interlaced" | "MBAFF"
  ScanOrder?: string;              // "TFF" | "BFF"
  ScanType_StoreMethod?: string;
  colour_primaries?: string;
  transfer_characteristics?: string;
  matrix_coefficients?: string;
  colour_range?: string;           // "Full" | "Limited"
  SamplingRate?: string;
  Channels?: string;
  ChannelPositions?: string;
  ChannelLayout?: string;
  StreamSize?: string;
  StreamOrder?: string;
  UniqueID?: string;
  Default?: string;
  Forced?: string;
  Language?: string;
  Title?: string;
  Delay?: string;
  Delay_Source?: string;
  TimeCode_FirstFrame?: string;
  TimeCode_Source?: string;
  // HDR Metadata
  HDR_Format?: string;
  HDR_Format_Compatibility?: string;
  MasteringDisplay_ColorPrimaries?: string;
  MasteringDisplay_Luminance?: string;
  MaxCLL?: string;
  MaxFALL?: string;
  // Encoding library
  Encoded_Library?: string;
  Encoded_Library_Name?: string;
  Encoded_Library_Version?: string;
  Encoded_Library_Settings?: string;
  // Container
  IsStreamable?: string;           // "Yes" / "No"
  HeaderSize?: string;
  DataSize?: string;
  FooterSize?: string;
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

// ── Tipos de análise expandida ───────────────────────────────────

export interface NexoraGeneralInfo {
  format: string;
  formatVersion?: string;
  duration: number;
  fileSize: number;
  overallBitrate: number;
  isStreamable: boolean;
  encodedDate?: string;
  hasTimecodeTrack: boolean;
}

export interface NexoraVideoInfo {
  codec: string;
  profile: string;
  level: string;
  pixelFormat: string;
  width: number;
  height: number;
  frameRate: number;
  frameRateMode: 'CFR' | 'VFR' | 'UNKNOWN';
  bitrate: number;
  bitDepth: number;
  duration: number;
  scanType: 'Progressive' | 'Interlaced' | 'MBAFF' | 'UNKNOWN';
  scanOrder: 'TFF' | 'BFF' | 'UNKNOWN';
  colorSpace: string;
  colorPrimaries: string;
  transferCharacteristics: string;
  matrixCoefficients: string;
  colourRange: 'Full' | 'Limited' | 'UNKNOWN';
  hdrFormat: string | null;
  maxCLL: number | null;
  maxFALL: number | null;
  encodingLibrary: string;
  encodingSettings: string;
  gopSize: number | null;
  gopType: 'CLOSED' | 'OPEN' | 'UNKNOWN';
  bFrameCount: number;
  refFrameCount: number;
  cabacEnabled: boolean;
}

export interface NexoraAudioInfo {
  codec: string;
  sampleRate: number;
  bitDepth: number;
  channels: number;
  channelLayout: string;
  bitrate: number;
  language?: string;
  title?: string;
  isDefault: boolean;
}

export interface NexoraSubtitleInfo {
  format: string;
  language?: string;
  title?: string;
  isDefault: boolean;
  isForced: boolean;
}

export interface NexoraChapterInfo {
  title?: string;
}

export interface NexoraFullMediaInfo {
  general: NexoraGeneralInfo;
  video: NexoraVideoInfo | null;
  audio: NexoraAudioInfo[];
  subtitles: NexoraSubtitleInfo[];
  chapters: NexoraChapterInfo[];
  raw: MediaInfoResult;
}

// ── Resultado de comparação ──────────────────────────────────────

export interface MediaFieldDiff {
  field: string;
  before: string | number | null;
  after: string | number | null;
}

export interface MediaComparisonResult {
  videoChanged: MediaFieldDiff[];
  audioChanged: MediaFieldDiff[];
  containerChanged: MediaFieldDiff[];
  qualityIndicators: {
    bitrateRatio: number;
    resolutionChanged: boolean;
    codecChanged: boolean;
    durationDelta: number;
    fileSizeRatio: number;
  };
}

// ── Constantes ───────────────────────────────────────────────────

const MEDIAINFO_TIMEOUT_MS = 30_000;

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
   * Executa MediaInfo com --Full para obter campos extra
   * (encoding settings detalhadas, stream IDs internos, etc.).
   */
  async analyzeWithFullFlag(filePath: string): Promise<MediaInfoResult> {
    toolRegistry.requireTool('mediainfo');
    const mediaInfoPath = toolRegistry.getPath('mediainfo');

    const { stdout } = await execFileAsync(
      mediaInfoPath,
      ['--Full', '--Output=JSON', filePath],
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

  /**
   * Análise completa com todos os campos organizados por categoria.
   */
  async analyzeFullMetadata(filePath: string): Promise<NexoraFullMediaInfo> {
    const result = await this.analyze(filePath);
    return this.buildFullMetadata(result);
  }

  /**
   * Análise completa segura (sem lançar excepção).
   */
  async analyzeFullMetadataSafe(filePath: string): Promise<NexoraFullMediaInfo | null> {
    try {
      return await this.analyzeFullMetadata(filePath);
    } catch (error) {
      logger.warn({ filePath, error: String(error) }, 'analyzeFullMetadata falhou');
      return null;
    }
  }

  /**
   * Constrói NexoraFullMediaInfo a partir do resultado raw do MediaInfo.
   */
  buildFullMetadata(result: MediaInfoResult): NexoraFullMediaInfo {
    const g = this.getGeneralTrack(result);
    const v = this.getVideoTrack(result);
    const audioTracks = this.getTracks(result, 'Audio') as MediaInfoAudioTrack[];
    const textTracks = this.getTracks(result, 'Text') as MediaInfoTextTrack[];
    const otherTracks = this.getTracks(result, 'Other');
    const menuTracks = this.getTracks(result, 'Menu');

    const isStreamable = g?.IsStreamable?.toLowerCase() === 'yes';

    const general: NexoraGeneralInfo = {
      format: g?.Format?.toLowerCase() ?? 'unknown',
      formatVersion: g?.Format_Version,
      duration: this.parseDuration(g?.Duration),
      fileSize: Number(g?.FileSize ?? 0),
      overallBitrate: Math.round(Number(g?.OverallBitRate ?? 0) / 1000),
      isStreamable,
      encodedDate: g?.Encoded_Date,
      hasTimecodeTrack: otherTracks.some(
        t => (t['Format'] ?? '').toLowerCase().includes('timecode')
      ),
    };

    const video: NexoraVideoInfo | null = v ? this.buildVideoInfo(v) : null;

    const audio: NexoraAudioInfo[] = audioTracks.map(a => ({
      codec: a.Format?.toLowerCase() ?? 'unknown',
      sampleRate: Number(a.SamplingRate ?? 0),
      bitDepth: Number(a.BitDepth ?? 0),
      channels: Number(a.Channels ?? 0),
      channelLayout: a.ChannelLayout ?? a.ChannelPositions ?? '',
      bitrate: Math.round(Number(a.BitRate ?? 0) / 1000),
      language: a.Language,
      title: a.Title,
      isDefault: a.Default?.toLowerCase() === 'yes',
    }));

    const subtitles: NexoraSubtitleInfo[] = textTracks.map(t => ({
      format: t.Format?.toLowerCase() ?? 'unknown',
      language: t.Language,
      title: t.Title,
      isDefault: t.Default?.toLowerCase() === 'yes',
      isForced: t.Forced?.toLowerCase() === 'yes',
    }));

    const chapters: NexoraChapterInfo[] = menuTracks.map(m => ({
      title: m.Title,
    }));

    return { general, video, audio, subtitles, chapters, raw: result };
  }

  /**
   * Compara análises antes/depois do encode.
   */
  compareAnalysis(
    before: NexoraFullMediaInfo,
    after: NexoraFullMediaInfo
  ): MediaComparisonResult {
    const videoChanged: MediaFieldDiff[] = [];
    const audioChanged: MediaFieldDiff[] = [];
    const containerChanged: MediaFieldDiff[] = [];

    // Comparar campos de vídeo
    if (before.video && after.video) {
      const vFields: (keyof NexoraVideoInfo)[] = [
        'codec', 'profile', 'level', 'pixelFormat', 'width', 'height',
        'frameRate', 'frameRateMode', 'bitrate', 'bitDepth', 'scanType',
        'colorPrimaries', 'matrixCoefficients', 'colourRange', 'hdrFormat',
        'gopType', 'encodingLibrary',
      ];
      for (const field of vFields) {
        const b = before.video[field] as string | number | null;
        const a = after.video[field] as string | number | null;
        if (String(b) !== String(a)) {
          videoChanged.push({ field: String(field), before: b, after: a });
        }
      }
    }

    // Comparar áudio (primeira pista)
    const bAudio = before.audio[0];
    const aAudio = after.audio[0];
    if (bAudio && aAudio) {
      const aFields: (keyof NexoraAudioInfo)[] = ['codec', 'sampleRate', 'bitDepth', 'channels', 'bitrate'];
      for (const field of aFields) {
        const b = bAudio[field] as string | number | null;
        const a = aAudio[field] as string | number | null;
        if (String(b) !== String(a)) {
          audioChanged.push({ field: String(field), before: b, after: a });
        }
      }
    }

    // Comparar container
    if (String(before.general.format) !== String(after.general.format)) {
      containerChanged.push({ field: 'format', before: before.general.format, after: after.general.format });
    }
    if (before.general.isStreamable !== after.general.isStreamable) {
      containerChanged.push({ field: 'isStreamable', before: String(before.general.isStreamable), after: String(after.general.isStreamable) });
    }

    const bBr = before.video?.bitrate ?? 0;
    const aBr = after.video?.bitrate ?? 0;
    const bFs = before.general.fileSize;
    const aFs = after.general.fileSize;

    return {
      videoChanged,
      audioChanged,
      containerChanged,
      qualityIndicators: {
        bitrateRatio: bBr > 0 ? aBr / bBr : 0,
        resolutionChanged:
          before.video?.width !== after.video?.width ||
          before.video?.height !== after.video?.height,
        codecChanged: before.video?.codec !== after.video?.codec,
        durationDelta: after.general.duration - before.general.duration,
        fileSizeRatio: bFs > 0 ? aFs / bFs : 0,
      },
    };
  }

  // ── Helpers de extracção tipada ────────────────────────────────

  getTracks(result: MediaInfoResult, type: string): MediaInfoTrack[] {
    return (result.media?.track ?? []).filter(t => t['@type'] === type);
  }

  getVideoTrack(result: MediaInfoResult): MediaInfoVideoTrack | null {
    return (this.getTracks(result, 'Video')[0] as MediaInfoVideoTrack) ?? null;
  }

  getAudioTrack(result: MediaInfoResult): MediaInfoAudioTrack | null {
    return (this.getTracks(result, 'Audio')[0] as MediaInfoAudioTrack) ?? null;
  }

  getGeneralTrack(result: MediaInfoResult): MediaInfoGeneralTrack | null {
    return (this.getTracks(result, 'General')[0] as MediaInfoGeneralTrack) ?? null;
  }

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
    const frameRate = Number(v?.FrameRate ?? 0);
    const frameRateMode = (v?.FrameRate_Mode?.toUpperCase() ?? 'UNKNOWN') as 'CFR' | 'VFR' | 'UNKNOWN';
    const gopInfo = this.extractGOPInfo(v);

    return {
      codec: v?.Format?.toLowerCase() ?? 'unknown',
      profile: v?.Format_Profile ?? '',
      level: v?.Format_Level ?? '',
      pixelFormat: this.inferPixelFormat(v),
      frameRate,
      frameRateMode,
      gopType: gopInfo.gopType,
      hasIdrFrames: gopInfo.cabacEnabled !== false, // CABAC=No → baseline → tem IDR
      bFrameCount: gopInfo.bFrameCount,
      bitrate: Number(v?.BitRate ?? g?.OverallBitRate ?? 0),
      width: Number(v?.Width ?? 0),
      height: Number(v?.Height ?? 0),
      bitDepth: (Number(v?.BitDepth ?? 8) as 8 | 10 | 12) || 8,
      colorSpace: v?.ColorSpace ?? '',
      colorPrimaries: v?.colour_primaries ?? '',
      transferCharacteristics: v?.transfer_characteristics ?? '',
      duration: this.parseDuration(v?.Duration ?? g?.Duration),
      hasFastStart: isStreamable,
      // Campos expandidos
      scanType: this.detectScanType(v),
      scanOrder: (v?.ScanOrder ?? 'UNKNOWN') as 'TFF' | 'BFF' | 'UNKNOWN',
      encodingLibrary: v?.Encoded_Library ?? v?.Encoded_Library_Name ?? '',
      encodingSettings: v?.Encoded_Library_Settings ?? '',
      hdrFormat: this.extractHDRMetadata(v).format,
      maxCLL: this.extractHDRMetadata(v).maxCLL,
      maxFALL: this.extractHDRMetadata(v).maxFALL,
      matrixCoefficients: v?.matrix_coefficients ?? '',
      colourRange: (v?.colour_range ?? 'UNKNOWN') as 'Full' | 'Limited' | 'UNKNOWN',
      refFrameCount: gopInfo.refFrameCount,
      cabacEnabled: gopInfo.cabacEnabled,
    };
  }

  extractAudioMetadata(result: MediaInfoResult): AudioMetadata {
    const a = this.getAudioTrack(result);
    return {
      codec: a?.Format?.toLowerCase() ?? 'unknown',
      sampleRate: Number(a?.SamplingRate ?? 0),
      bitDepth: Number(a?.BitDepth ?? 0),
      channels: Number(a?.Channels ?? 0),
      channelLayout: a?.ChannelLayout ?? a?.ChannelPositions ?? '',
      integratedLufs: null,
      truePeakDbtp: null,
      loudnessRange: null,
      audioVideoSyncMs: null,
    };
  }

  extractContainerMetadata(result: MediaInfoResult): ContainerMetadata {
    const g = this.getGeneralTrack(result);
    const isStreamable = g?.IsStreamable?.toLowerCase() === 'yes';
    return {
      format: g?.Format?.toLowerCase() ?? 'unknown',
      duration: this.parseDuration(g?.Duration),
      size: Number(g?.FileSize ?? 0),
      hasEditLists: false,
      hasTimecodeTrack: this.getTracks(result, 'Other').some(
        t => (t['Format'] ?? '').toLowerCase().includes('timecode')
      ),
      moovPosition: isStreamable ? 'start' : 'unknown',
    };
  }

  // ── Helpers de análise específicos ────────────────────────────

  /** Extrai informação de GOP a partir dos campos MediaInfo */
  extractGOPInfo(track: MediaInfoTrack | null): {
    gopType: 'CLOSED' | 'OPEN' | 'UNKNOWN';
    gopSize: number | null;
    bFrameCount: number;
    refFrameCount: number;
    cabacEnabled: boolean;
  } {
    if (!track) {
      return { gopType: 'UNKNOWN', gopSize: null, bFrameCount: 0, refFrameCount: 0, cabacEnabled: true };
    }

    // Parsear "M=1, N=50" ou "M=3, N=48"
    let gopSize: number | null = null;
    let bFrameCount = 0;
    const gopStr = track.Format_Settings_GOP ?? '';
    if (gopStr) {
      const nMatch = gopStr.match(/N=(\d+)/i);
      const mMatch = gopStr.match(/M=(\d+)/i);
      if (nMatch) gopSize = Number(nMatch[1]);
      if (mMatch) bFrameCount = Math.max(0, Number(mMatch[1]) - 1);
    }

    const refFrameCount = Number(track.Format_Settings_RefFrames ?? 0);
    const cabacEnabled = (track.Format_Settings_CABAC ?? 'Yes').toLowerCase() !== 'no';

    // Tipo GOP: sem info directa do MediaInfo → inferir
    const gopType: 'CLOSED' | 'OPEN' | 'UNKNOWN' = gopStr ? 'UNKNOWN' : 'UNKNOWN';

    return { gopType, gopSize, bFrameCount, refFrameCount, cabacEnabled };
  }

  /** Extrai metadados HDR */
  extractHDRMetadata(track: MediaInfoTrack | null): {
    format: string | null;
    maxCLL: number | null;
    maxFALL: number | null;
    colorPrimaries: string | null;
  } {
    if (!track) return { format: null, maxCLL: null, maxFALL: null, colorPrimaries: null };

    const format = track.HDR_Format ?? null;
    const maxCLL = track.MaxCLL ? Number(track.MaxCLL.replace(/\D+/g, '')) : null;
    const maxFALL = track.MaxFALL ? Number(track.MaxFALL.replace(/\D+/g, '')) : null;
    const colorPrimaries = track.MasteringDisplay_ColorPrimaries ?? null;

    return { format, maxCLL: isNaN(maxCLL as number) ? null : maxCLL, maxFALL: isNaN(maxFALL as number) ? null : maxFALL, colorPrimaries };
  }

  /** Detecta o tipo de scan (Progressive/Interlaced/MBAFF) */
  detectScanType(track: MediaInfoTrack | null): 'Progressive' | 'Interlaced' | 'MBAFF' | 'UNKNOWN' {
    const scanType = track?.ScanType;
    if (!scanType) return 'UNKNOWN';
    const lower = scanType.toLowerCase();
    if (lower === 'progressive') return 'Progressive';
    if (lower === 'interlaced') return 'Interlaced';
    if (lower === 'mbaff') return 'MBAFF';
    return 'UNKNOWN';
  }

  // ── Utilitários privados ──────────────────────────────────────

  private buildVideoInfo(v: MediaInfoVideoTrack): NexoraVideoInfo {
    const gopInfo = this.extractGOPInfo(v);
    const hdrInfo = this.extractHDRMetadata(v);
    const frameRate = Number(v.FrameRate ?? 0);
    const frMode = (v.FrameRate_Mode?.toUpperCase() ?? 'UNKNOWN') as 'CFR' | 'VFR' | 'UNKNOWN';

    return {
      codec: v.Format?.toLowerCase() ?? 'unknown',
      profile: v.Format_Profile ?? '',
      level: v.Format_Level ?? '',
      pixelFormat: this.inferPixelFormat(v),
      width: Number(v.Width ?? 0),
      height: Number(v.Height ?? 0),
      frameRate,
      frameRateMode: frMode,
      bitrate: Math.round(Number(v.BitRate ?? 0) / 1000),
      bitDepth: Number(v.BitDepth ?? 8),
      duration: this.parseDuration(v.Duration),
      scanType: this.detectScanType(v),
      scanOrder: (v.ScanOrder ?? 'UNKNOWN') as 'TFF' | 'BFF' | 'UNKNOWN',
      colorSpace: v.ColorSpace ?? '',
      colorPrimaries: v.colour_primaries ?? '',
      transferCharacteristics: v.transfer_characteristics ?? '',
      matrixCoefficients: v.matrix_coefficients ?? '',
      colourRange: (v.colour_range ?? 'UNKNOWN') as 'Full' | 'Limited' | 'UNKNOWN',
      hdrFormat: hdrInfo.format,
      maxCLL: hdrInfo.maxCLL,
      maxFALL: hdrInfo.maxFALL,
      encodingLibrary: v.Encoded_Library ?? v.Encoded_Library_Name ?? '',
      encodingSettings: v.Encoded_Library_Settings ?? '',
      gopSize: gopInfo.gopSize,
      gopType: gopInfo.gopType,
      bFrameCount: gopInfo.bFrameCount,
      refFrameCount: gopInfo.refFrameCount,
      cabacEnabled: gopInfo.cabacEnabled,
    };
  }

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

  private parseDuration(duration?: string): number {
    if (!duration) return 0;
    const num = Number(duration);
    if (!isNaN(num)) {
      return num > 100000 ? num / 1000 : num;
    }
    const m = duration.match(/(\d+):(\d+):([\d.]+)/);
    if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    return 0;
  }
}

// ── Singleton ────────────────────────────────────────────────────

export const mediainfoAdapter = new NexoraMediaInfoAdapter();
