// Nexora Media Processing — HandBrake Adapter
// Ficheiro: src/pipeline/tools/handbrake-adapter.ts
//
// Geração de proxies e transcodes via HandBrakeCLI com presets Nexora.
// Consome os presets definidos em config/handbrake/nexora-presets.json.
//
// ADR-002: spawn com array — nunca exec() com string concatenada.

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
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
const HANDBRAKE_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4h para ficheiros grandes

// ── Adapter ──────────────────────────────────────────────────────

export class NexoraHandBrakeAdapter {
  private presetCache: string[] | null = null;

  /**
   * Transcoda um ficheiro com um preset Nexora específico.
   *
   * @param inputPath  - Ficheiro de entrada
   * @param outputPath - Ficheiro de saída
   * @param presetName - Nome do preset (deve existir em nexora-presets.json)
   */
  async transcode(
    inputPath: string,
    outputPath: string,
    presetName: string
  ): Promise<HandBrakeResult> {
    toolRegistry.requireTool('handbrake');

    // Validar preset antes de executar (segurança)
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

      logger.info(
        { inputPath, outputPath, preset: presetName },
        'HandBrakeCLI a iniciar transcode'
      );

      const proc = spawn(handBrakePath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderrBuf = '';
      let lastFps: number | null = null;

      proc.stderr?.on('data', (chunk: Buffer) => {
        const line = chunk.toString();
        stderrBuf += line;

        // Parsear progresso: "Encoding: task 1 of 1, 45.23 %"
        const progressMatch = line.match(/(\d+\.\d+)\s*%/);
        if (progressMatch) {
          logger.debug(
            { preset: presetName, progress: progressMatch[1] },
            `HandBrake: ${progressMatch[1]}%`
          );
        }

        // Parsear FPS: "avg 25.3 fps"
        const fpsMatch = line.match(/avg\s+([\d.]+)\s*fps/i);
        if (fpsMatch) {
          lastFps = Number(fpsMatch[1]);
        }
      });

      // Timeout
      const timeoutId = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new TranscodeError(
          `HandBrakeCLI timeout após ${HANDBRAKE_TIMEOUT_MS}ms`,
          { preset: presetName, inputPath }
        ));
      }, HANDBRAKE_TIMEOUT_MS);

      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        const durationMs = Date.now() - startTime;

        if (code === 0) {
          handbrakeJobs.inc({ preset: presetName });

          logger.info(
            { preset: presetName, durationMs, avgFps: lastFps },
            'HandBrakeCLI transcode concluído'
          );

          resolve({
            outputPath,
            preset: presetName,
            durationMs,
            avgFps: lastFps,
            exitCode: 0,
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

  /**
   * Gera um proxy de baixa qualidade (preset "Nexora Proxy").
   */
  async generateProxy(inputPath: string, outputPath: string): Promise<HandBrakeResult> {
    return this.transcode(inputPath, outputPath, 'Nexora Proxy');
  }

  /**
   * Gera um encode OTT HD (preset "Nexora OTT HD").
   */
  async generateOTT(inputPath: string, outputPath: string): Promise<HandBrakeResult> {
    return this.transcode(inputPath, outputPath, 'Nexora OTT HD');
  }

  /**
   * Parseia a percentagem de progresso do stderr do HandBrake.
   */
  getProgress(stderr: string): number | null {
    const lines = stderr.split('\n').reverse();
    for (const line of lines) {
      const m = line.match(/(\d+\.\d+)\s*%/);
      if (m) return Number(m[1]);
    }
    return null;
  }

  /**
   * Lista os presets disponíveis no ficheiro de configuração.
   */
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
}

// ── Singleton ────────────────────────────────────────────────────

export const handbrakeAdapter = new NexoraHandBrakeAdapter();
