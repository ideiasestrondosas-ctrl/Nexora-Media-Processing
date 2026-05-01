// ═══════════════════════════════════════════════════════════════
// Nexora Media Processing — Tool Availability Checker
// Ficheiro: src/pipeline/tools/availability-checker.ts
//
// Verifica no startup que todas as ferramentas de media estão
// disponíveis. Falha imediatamente se FFmpeg não estiver presente.
// ═══════════════════════════════════════════════════════════════

import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../observability/logger';

const execFileAsync = promisify(execFile);

export interface ToolStatus {
  ffmpeg:       boolean;
  ffprobe:      boolean;
  mediainfo:    boolean;
  mediaconch:   boolean;
  bs1770gain:   boolean;
  handbrake:    boolean;
  vlc:          boolean;
}

const TOOLS = {
  ffmpeg:     { path: process.env.FFMPEG_PATH     ?? 'ffmpeg',       args: ['-version'],   critical: true  },
  ffprobe:    { path: process.env.FFPROBE_PATH    ?? 'ffprobe',      args: ['-version'],   critical: true  },
  mediainfo:  { path: process.env.MEDIAINFO_PATH  ?? 'mediainfo',    args: ['--version'],  critical: true  },
  mediaconch: { path: process.env.MEDIACONCH_PATH ?? 'mediaconch',   args: ['--version'],  critical: false },
  bs1770gain: { path: process.env.BS1770GAIN_PATH ?? 'bs1770gain',   args: ['--version'],  critical: false },
  handbrake:  { path: process.env.HANDBRAKE_CLI_PATH ?? 'HandBrakeCLI', args: ['--version'], critical: false },
  vlc:        { path: 'vlc',                                          args: ['--version'],  critical: false },
} as const;

/**
 * Verificar disponibilidade de todas as ferramentas de media.
 * Ferramentas críticas (FFmpeg, FFprobe, MediaInfo) causam falha imediata.
 * Ferramentas opcionais geram apenas warning.
 */
export async function checkToolAvailability(): Promise<ToolStatus> {
  const status: ToolStatus = {
    ffmpeg: false, ffprobe: false, mediainfo: false,
    mediaconch: false, bs1770gain: false, handbrake: false, vlc: false,
  };

  const checks = Object.entries(TOOLS).map(async ([name, config]) => {
    try {
      const { stdout } = await execFileAsync(config.path, config.args, { timeout: 5000 });
      const version = stdout.split('\n')[0].trim().slice(0, 60);
      status[name as keyof ToolStatus] = true;
      logger.info({ tool: name, version }, `✓ ${name} disponível`);
    } catch {
      status[name as keyof ToolStatus] = false;
      if (config.critical) {
        logger.error({ tool: name, path: config.path },
          `✗ CRÍTICO: ${name} não encontrado em "${config.path}". ` +
          'O Nexora não pode funcionar sem esta ferramenta.'
        );
      } else {
        logger.warn({ tool: name, path: config.path },
          `⚠ ${name} não disponível — funcionalidades dependentes desactivadas`
        );
      }
    }
  });

  await Promise.allSettled(checks);

  // Falhar se qualquer ferramenta crítica estiver em falta
  const missingCritical = Object.entries(TOOLS)
    .filter(([name, cfg]) => cfg.critical && !status[name as keyof ToolStatus])
    .map(([name]) => name);

  if (missingCritical.length > 0) {
    throw new Error(
      `Ferramentas críticas em falta: ${missingCritical.join(', ')}\n` +
      'Executa: bash scripts/nexora-setup.sh\n' +
      'Ou instala manualmente — ver docs/manual-v4.md Parte 1.'
    );
  }

  return status;
}

/** Seleccionar a melhor ferramenta para um job específico */
export function selectTool(
  jobType: 'transcode' | 'proxy' | 'loudness' | 'analysis' | 'conformance' | 'vmaf' | 'playback',
  toolStatus: ToolStatus,
  profile: string
): string {
  switch (jobType) {
    case 'transcode':
      // FFmpeg para broadcast/OTT (conformance obrigatória)
      // HandBrake para proxies (mais rápido)
      if (profile === 'nexora_proxy_lowres' && toolStatus.handbrake) return 'handbrake';
      return 'ffmpeg';

    case 'proxy':
      return toolStatus.handbrake ? 'handbrake' : 'ffmpeg';

    case 'loudness':
      // ADR-009: BS1770GAIN preferido para verificação independente
      return toolStatus.bs1770gain ? 'bs1770gain' : 'ffmpeg_ebur128';

    case 'analysis':
      // MediaInfo + FFprobe em conjunto (complementares)
      return 'mediainfo_ffprobe';

    case 'conformance':
      // MediaConch para verificação AS-11/IMF formal
      if (!toolStatus.mediaconch) {
        logger.warn('MediaConch não disponível — conformance check limitado');
        return 'ffprobe_only';
      }
      return 'mediaconch';

    case 'vmaf':
      return 'ffmpeg_libvmaf';

    case 'playback':
      // VLC headless apenas para broadcast/OTT premium (sanity check final)
      if (toolStatus.vlc && (profile === 'nexora_broadcast_hd' || profile === 'nexora_ott_premium')) {
        return 'vlc_headless';
      }
      return 'skip';

    default:
      return 'ffmpeg';
  }
}


// ═══════════════════════════════════════════════════════════════
// Nexora — Subtitle Worker
// Ficheiro: src/workers/subtitle.worker.ts
//
// Converte entre formatos de legenda:
// SRT → TTML/WebVTT/CEA-708
// Suporta burn-in opcional para arquivo.
// ═══════════════════════════════════════════════════════════════

import { Worker, Job } from 'bullmq';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { redisConnection } from './queues';
import { executeFFmpeg } from '../pipeline/ffmpeg/executor';
import { ffmpegBuilder } from '../pipeline/ffmpeg/builder';
import { logger } from '../observability/logger';

export interface SubtitleJobPayload {
  assetId:     string;
  inputPath:   string;  // ficheiro de vídeo
  subtitlePath?: string; // ficheiro de legenda SRT (opcional)
  outputDir:   string;
  profile:     string;
  burnIn?:     boolean; // fazer burn-in das legendas no vídeo
}

export class SubtitleWorker {
  readonly name = 'subtitle-worker';
  private worker: Worker | null = null;

  async start(): Promise<void> {
    this.worker = new Worker(
      'subtitle',
      async (job: Job<SubtitleJobPayload>) => this.process(job),
      {
        connection: redisConnection,
        concurrency: 4,
      }
    );
  }

  async stop(): Promise<void> { await this.worker?.close(); }

  private async process(job: Job<SubtitleJobPayload>): Promise<void> {
    const { assetId, inputPath, subtitlePath, outputDir, profile, burnIn } = job.data;
    const log = logger.child({ asset_id: assetId, job_id: job.id, worker: 'subtitle' });

    // Se não há ficheiro de legenda, verificar se o vídeo tem legendas embebidas
    const srtSource = subtitlePath ?? await extractEmbeddedSubtitles(inputPath, outputDir, assetId);

    if (!srtSource) {
      log.info('Sem legendas detectadas — a saltar processamento de legendas');
      return;
    }

    log.info({ srtSource, profile }, 'A processar legendas');

    // Converter SRT para múltiplos formatos conforme o perfil
    const baseName = path.join(outputDir, assetId);

    const conversions: Promise<void>[] = [];

    // WebVTT — sempre (para HLS/DASH players)
    conversions.push(
      convertSRTtoWebVTT(srtSource, `${baseName}.vtt`)
        .then(() => log.info('WebVTT criado'))
    );

    // TTML/IMSC1 — para broadcast EU e AS-11
    if (profile === 'nexora_broadcast_hd' || profile === 'nexora_archive') {
      conversions.push(
        convertSRTtoTTML(srtSource, `${baseName}.ttml`)
          .then(() => log.info('TTML criado'))
      );
    }

    // Burn-in — para arquivo ou quando explicitamente pedido
    if (burnIn || profile === 'nexora_archive') {
      const burnInPath = inputPath.replace('.mp4', '_burnin.mp4');
      conversions.push(
        burnInSubtitles(inputPath, srtSource, burnInPath, assetId, job.id)
          .then(() => log.info('Burn-in concluído'))
      );
    }

    await Promise.allSettled(conversions);

    log.info('Processamento de legendas concluído');
  }
}

/** Extrair legendas embebidas do vídeo para ficheiro SRT */
async function extractEmbeddedSubtitles(
  videoPath: string,
  outputDir: string,
  assetId: string
): Promise<string | null> {
  const outputPath = path.join(outputDir, `${assetId}_extracted.srt`);

  try {
    await executeFFmpeg([
      '-i', videoPath,
      '-map', '0:s:0',    // primeira track de legendas
      '-c:s', 'srt',
      outputPath,
    ], { assetId, timeoutMs: 60000 });

    return existsSync(outputPath) ? outputPath : null;
  } catch {
    return null; // sem legendas embebidas
  }
}

/** Converter SRT para WebVTT */
async function convertSRTtoWebVTT(srtPath: string, outputPath: string): Promise<void> {
  const srt = await readFile(srtPath, 'utf8');

  // Conversão simples SRT → WebVTT
  const vtt = 'WEBVTT\n\n' + srt
    .replace(/\r\n/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2') // vírgula → ponto nos timestamps
    .trim();

  await writeFile(outputPath, vtt, 'utf8');
}

/** Converter SRT para TTML */
async function convertSRTtoTTML(srtPath: string, outputPath: string): Promise<void> {
  await executeFFmpeg([
    '-i', srtPath,
    '-c:s', 'ttml',
    outputPath,
  ], { timeoutMs: 60000 });
}

/** Burn-in de legendas no vídeo */
async function burnInSubtitles(
  videoPath: string,
  srtPath: string,
  outputPath: string,
  assetId: string,
  jobId: string | undefined
): Promise<void> {
  await executeFFmpeg([
    '-i', videoPath,
    '-vf', `subtitles=${srtPath}:force_style='FontSize=24,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2'`,
    '-c:a', 'copy',
    outputPath,
  ], { assetId, jobId, timeoutMs: 7200000 }); // 2h
}


// ═══════════════════════════════════════════════════════════════
// Nexora — HandBrake Presets
// Ficheiro: nexora-presets.json (raiz do projecto)
//
// Presets para HandBrakeCLI usados no proxy generation.
// NOTA: HandBrake é usado apenas para proxies — nunca para
// outputs broadcast (FFmpeg obrigatório para conformance).
// ═══════════════════════════════════════════════════════════════

export const NEXORA_HANDBRAKE_PRESETS = {
  PresetList: [
    {
      PresetName: "NexoraProxyLowRes",
      Type: 1,
      FileFormat: "av_mp4",
      Mp4HttpOptimize: true,
      Mp4iPodCompatible: false,

      VideoEncoder: "x264",
      VideoPreset: "veryfast",
      VideoTune: "",
      VideoProfile: "high",
      VideoLevel: "3.1",
      VideoQualityType: 1,        // ABR (Average Bitrate)
      VideoAvgBitrate: 800,
      VideoTwoPass: true,
      VideoTurboTwoPass: true,

      PictureWidth: 1280,
      PictureHeight: 720,
      PictureKeepRatio: true,
      PictureForceHeight: false,
      PictureForceWidth: false,

      AudioList: [
        {
          AudioEncoder: "copy:aac",
          AudioFallbackEncoder: "av_aac",
          AudioBitrate: 128,
          AudioSamplerate: "48",
          AudioMixdown: "stereo",
          AudioNormalizeMixLevel: false,
          AudioTrackGainSlider: 0,
          AudioTrackDRCSlider: 0,
        }
      ],
      AudioLanguageList: ["any"],
      AudioTrackSelectionBehavior: "first",
      AudioSecondaryEncoderMode: true,

      SubtitleList: [],
      SubtitleLanguageList: [],
      SubtitleTrackSelectionBehavior: "none",

      ChapterMarkers: false,
    },

    {
      PresetName: "NexoraWebOptimized1080p",
      Type: 1,
      FileFormat: "av_mp4",
      Mp4HttpOptimize: true,

      VideoEncoder: "x264",
      VideoPreset: "slow",
      VideoTune: "film",
      VideoProfile: "high",
      VideoLevel: "4.0",
      VideoQualityType: 1,
      VideoAvgBitrate: 4000,
      VideoTwoPass: true,
      VideoTurboTwoPass: false,

      PictureWidth: 1920,
      PictureHeight: 1080,
      PictureKeepRatio: true,

      AudioList: [
        {
          AudioEncoder: "av_aac",
          AudioBitrate: 192,
          AudioSamplerate: "48",
          AudioMixdown: "stereo",
        }
      ],
      AudioLanguageList: ["any"],

      ChapterMarkers: false,
    },

    {
      PresetName: "NexoraAnimationWeb",
      Type: 1,
      FileFormat: "av_mp4",
      Mp4HttpOptimize: true,

      // Animação beneficia muito de encoding mais eficiente
      VideoEncoder: "x264",
      VideoPreset: "slow",
      VideoTune: "animation",    // tune específico para animação
      VideoProfile: "high",
      VideoLevel: "4.0",
      VideoQualityType: 1,
      VideoAvgBitrate: 2400,     // -40% vs web padrão (alta compressibilidade)
      VideoTwoPass: true,

      PictureWidth: 1920,
      PictureHeight: 1080,
      PictureKeepRatio: true,

      AudioList: [
        {
          AudioEncoder: "av_aac",
          AudioBitrate: 192,
          AudioSamplerate: "48",
          AudioMixdown: "stereo",
        }
      ],
      ChapterMarkers: false,
    },
  ]
};

/** Guardar o ficheiro nexora-presets.json em disco */
export async function createPresetsFile(outputPath = './nexora-presets.json'): Promise<void> {
  const { writeFile } = await import('fs/promises');
  await writeFile(
    outputPath,
    JSON.stringify(NEXORA_HANDBRAKE_PRESETS, null, 2),
    'utf8'
  );
}
