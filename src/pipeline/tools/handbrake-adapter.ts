// Nexora Media Processing — HandBrake Adapter (expandido)
// Ficheiro: src/pipeline/tools/handbrake-adapter.ts
//
// Geração de proxies, HLS ladder, archivos e encodes especializados via HandBrakeCLI.
// Consome os presets definidos em config/handbrake/nexora-presets.json.
// Publica progresso via Redis pub/sub.
//
// ADR-002: spawn com array — nunca exec() com string concatenada.

import { spawn } from 'child_process';
import { readFileSync, statSync } from 'fs';
import { resolve } from 'path';
import { logger } from '../../observability/logger';
import { handbrakeJobs } from '../../observability/metrics';
import { toolRegistry } from './availability-checker';
import { TranscodeError } from '../../common/errors';

// ── Tipos ────────────────────────────────────────────────────────

export interface HandBrakeResult {
  outputPath: string;
  preset: string;
  durationMs: number;
  avgFps: number | null;
  exitCode: number;
  outputSizeBytes: number;
}

export interface HandBrakeOptions {
  deinterlace?: 'off' | 'yadif' | 'decomb';
  denoise?: 'off' | 'nlmeans' | 'nlmeans-light' | 'hqdn3d';
  sharpen?: 'off' | 'unsharp' | 'lapsharp';
  deblock?: boolean;
  crop?: { top: number; bottom: number; left: number; right: number } | 'auto';
  onProgress?: (percent: number, eta?: number) => void;
}

export interface HLSLadderResult {
  p1080: HandBrakeResult;
  p720: HandBrakeResult;
  p480: HandBrakeResult;
}

interface HandBrakePresetFile {
  PresetList: Array<{
    PresetName: string;
    Description?: string;
    [key: string]: unknown;
  }>;
}

// ── Constantes ───────────────────────────────────────────────────

const PRESETS_FILE = resolve(__dirname, '../../../config/handbrake/nexora-presets.json');
const HANDBRAKE_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4h
const MIN_OUTPUT_SIZE_BYTES = 10_000; // 10 KB mínimo

// ── Adapter ──────────────────────────────────────────────────────

export class NexoraHandBrakeAdapter {
  private presetCache: string[] | null = null;

  /**
   * Transcoda um ficheiro com um preset Nexora específico.
   */
  async transcode(
    inputPath: string,
    outputPath: string,
    presetName: string,
    options?: HandBrakeOptions
  ): Promise<HandBrakeResult> {
    toolRegistry.requireTool('handbrake');

    const available = this.listPresets();
    if (!available.includes(presetName)) {
      throw new TranscodeError(
        `Preset HandBrake "${presetName}" não encontrado`,
        { presetName, available }
      );
    }

    const handBrakePath = toolRegistry.getPath('handbrake');
    const startTime = Date.now();

    return new Promise<HandBrakeResult>((resolve, reject) => {
      const args = [
        '--preset-import-file', PRESETS_FILE,
        '--preset', presetName,
        '-i', inputPath,
        '-o', outputPath,
      ];

      // Adicionar opções de filtros se especificadas
      if (options?.deinterlace && options.deinterlace !== 'off') {
        args.push('--deinterlace', options.deinterlace === 'yadif' ? 'default' : 'bob');
      }
      if (options?.denoise && options.denoise !== 'off') {
        args.push('--denoise', options.denoise.replace('-light', ''));
      }
      if (options?.sharpen && options.sharpen !== 'off') {
        args.push('--sharpen', options.sharpen);
      }
      if (options?.deblock) {
        args.push('--deblock');
      }
      if (options?.crop && options.crop !== 'auto') {
        const { top, bottom, left, right } = options.crop;
        args.push('--crop', `${top}:${bottom}:${left}:${right}`);
      } else if (options?.crop === 'auto') {
        args.push('--crop-mode', 'auto');
      }

      logger.info(
        { inputPath, outputPath, preset: presetName, options },
        'HandBrakeCLI a iniciar transcode'
      );

      const proc = spawn(handBrakePath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderrBuf = '';
      let lastFps: number | null = null;
      let lastProgress = 0;
      const startMs = Date.now();

      proc.stderr?.on('data', (chunk: Buffer) => {
        const line = chunk.toString();
        stderrBuf += line;

        // Parsear progresso: "Encoding: task 1 of 1, 45.23 %"
        const progressMatch = line.match(/(\d+\.\d+)\s*%/);
        if (progressMatch) {
          const percent = Number(progressMatch[1]);
          lastProgress = percent;

          // Calcular ETA
          let eta: number | undefined;
          if (percent > 0) {
            const elapsedMs = Date.now() - startMs;
            eta = Math.round((elapsedMs / percent) * (100 - percent) / 1000);
          }

          logger.debug(
            { preset: presetName, progress: percent, eta },
            `HandBrake: ${percent.toFixed(1)}%`
          );

          options?.onProgress?.(percent, eta);
        }

        // Parsear FPS: "avg 25.3 fps"
        const fpsMatch = line.match(/avg\s+([\d.]+)\s*fps/i);
        if (fpsMatch) {
          lastFps = Number(fpsMatch[1]);
        }
      });

      const timeoutId = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new TranscodeError(
          `HandBrakeCLI timeout após ${HANDBRAKE_TIMEOUT_MS}ms`,
          { preset: presetName, inputPath, progress: lastProgress }
        ));
      }, HANDBRAKE_TIMEOUT_MS);

      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        const durationMs = Date.now() - startTime;

        if (code === 0) {
          // Validar output
          let outputSizeBytes = 0;
          try {
            outputSizeBytes = statSync(outputPath).size;
            if (outputSizeBytes < MIN_OUTPUT_SIZE_BYTES) {
              reject(new TranscodeError(
                `HandBrakeCLI output demasiado pequeno: ${outputSizeBytes} bytes`,
                { preset: presetName, outputPath, outputSizeBytes }
              ));
              return;
            }
          } catch {
            reject(new TranscodeError(
              `HandBrakeCLI output não encontrado: ${outputPath}`,
              { preset: presetName }
            ));
            return;
          }

          handbrakeJobs.inc({ preset: presetName });

          logger.info(
            { preset: presetName, durationMs, avgFps: lastFps, outputSizeBytes },
            'HandBrakeCLI transcode concluído'
          );

          resolve({
            outputPath,
            preset: presetName,
            durationMs,
            avgFps: lastFps,
            exitCode: 0,
            outputSizeBytes,
          });
        } else {
          reject(new TranscodeError(
            `HandBrakeCLI falhou com código ${code}`,
            {
              preset: presetName,
              exitCode: code,
              stderr: stderrBuf.slice(-500),
            }
          ));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeoutId);
        reject(new TranscodeError(
          `Falha ao iniciar HandBrakeCLI: ${err.message}`,
          { preset: presetName }
        ));
      });
    });
  }

  // ── Métodos especializados ────────────────────────────────────

  /** Gera um proxy de baixa qualidade (preset "NexoraProxyLowRes"). */
  async generateProxy(
    inputPath: string,
    outputPath: string,
    options?: HandBrakeOptions
  ): Promise<HandBrakeResult> {
    return this.transcode(inputPath, outputPath, 'NexoraProxyLowRes', options);
  }

  /** Gera preview ultra-rápido (preset "NexoraQuickPreview"). */
  async generatePreview(
    inputPath: string,
    outputPath: string,
    options?: HandBrakeOptions
  ): Promise<HandBrakeResult> {
    return this.transcode(inputPath, outputPath, 'NexoraQuickPreview', options);
  }

  /** Gera encode de arquivo de alta qualidade. */
  async generateArchive(
    inputPath: string,
    outputPath: string,
    options?: HandBrakeOptions
  ): Promise<HandBrakeResult> {
    return this.transcode(inputPath, outputPath, 'NexoraArchiveMaster', options);
  }

  /** Gera encode para social media (vertical 1080×1080 ou 1080×1920). */
  async generateSocialMedia(
    inputPath: string,
    outputPath: string,
    options?: HandBrakeOptions
  ): Promise<HandBrakeResult> {
    return this.transcode(inputPath, outputPath, 'NexoraSocialMedia', options);
  }

  /** Gera encode OTT HD. */
  async generateOTT(
    inputPath: string,
    outputPath: string,
    options?: HandBrakeOptions
  ): Promise<HandBrakeResult> {
    return this.transcode(inputPath, outputPath, 'NexoraWebOptimized1080p', options);
  }

  /**
   * Gera as 3 variantes HLS (1080p, 720p, 480p) sequencialmente.
   * Cada variante vai para outputDir/<base>_<res>.mp4.
   */
  async generateHLSLadder(
    inputPath: string,
    outputDir: string,
    baseName: string,
    options?: HandBrakeOptions
  ): Promise<HLSLadderResult> {
    const p1080Path = `${outputDir}/${baseName}_1080p.mp4`;
    const p720Path  = `${outputDir}/${baseName}_720p.mp4`;
    const p480Path  = `${outputDir}/${baseName}_480p.mp4`;

    logger.info({ inputPath, outputDir, baseName }, 'HLS Ladder: a iniciar geração 3 variantes');

    const p1080 = await this.transcode(inputPath, p1080Path, 'NexoraHLS1080p', options);
    const p720  = await this.transcode(inputPath, p720Path, 'NexoraHLS720p', options);
    const p480  = await this.transcode(inputPath, p480Path, 'NexoraHLS480p', options);

    logger.info(
      { baseName, durations: [p1080.durationMs, p720.durationMs, p480.durationMs] },
      'HLS Ladder concluído'
    );

    return { p1080, p720, p480 };
  }

  // ── Utilitários ──────────────────────────────────────────────

  /** Parseia a percentagem de progresso do stderr do HandBrake. */
  getProgress(stderr: string): number | null {
    const lines = stderr.split('\n').reverse();
    for (const line of lines) {
      const m = line.match(/(\d+\.\d+)\s*%/);
      if (m) return Number(m[1]);
    }
    return null;
  }

  /** Lista os presets disponíveis no ficheiro de configuração. */
  listPresets(): string[] {
    if (this.presetCache) return this.presetCache;

    try {
      const raw = readFileSync(PRESETS_FILE, 'utf8');
      const parsed = JSON.parse(raw) as HandBrakePresetFile;
      this.presetCache = parsed.PresetList.map(p => p.PresetName);
      return this.presetCache;
    } catch (err) {
      logger.warn(
        { err: String(err), path: PRESETS_FILE },
        'Não foi possível ler presets HandBrake'
      );
      return [];
    }
  }

  /** Invalida o cache de presets (útil após edição do JSON em runtime). */
  invalidateCache(): void {
    this.presetCache = null;
  }
}

// ── Singleton ────────────────────────────────────────────────────

export const handbrakeAdapter = new NexoraHandBrakeAdapter();
