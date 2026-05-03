// Nexora Media Processing — Tool Availability Checker
// Ficheiro: src/pipeline/tools/availability-checker.ts
//
// Verifica no startup que todas as ferramentas de media estão
// disponíveis. Falha imediatamente se FFmpeg não estiver presente.
// Exporta NexoraToolRegistry singleton para consulta durante runtime.

import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../observability/logger';
import { toolAvailable } from '../../observability/metrics';
import { ToolNotAvailableError } from '../../common/errors';

const execFileAsync = promisify(execFile);

// ── Tipos ────────────────────────────────────────────────────────

export type ToolName =
  | 'ffmpeg'
  | 'ffprobe'
  | 'mediainfo'
  | 'mediaconch'
  | 'bs1770gain'
  | 'handbrake'
  | 'ccextractor';

export interface ToolStatus {
  name: ToolName;
  available: boolean;
  version: string | null;
  path: string;
  checkedAt: string;
}

export interface ToolReport {
  tools: ToolStatus[];
  criticalMissing: ToolName[];
  optionalMissing: ToolName[];
  checkedAt: string;
}

// ── Configuração por ferramenta ──────────────────────────────────

interface ToolConfig {
  name: ToolName;
  envKey: string;
  defaultName: string;
  args: string[];
  /** true = o startup falha se não estiver disponível */
  critical: boolean;
  /** Regex para extrair versão do stdout/stderr */
  versionRegex: RegExp;
}

const TOOL_CONFIGS: ToolConfig[] = [
  {
    name: 'ffmpeg',
    envKey: 'FFMPEG_PATH',
    defaultName: 'ffmpeg',
    args: ['-version'],
    critical: true,
    versionRegex: /ffmpeg version (\S+)/i,
  },
  {
    name: 'ffprobe',
    envKey: 'FFPROBE_PATH',
    defaultName: 'ffprobe',
    args: ['-version'],
    critical: true,
    versionRegex: /ffprobe version (\S+)/i,
  },
  {
    name: 'mediainfo',
    envKey: 'MEDIAINFO_PATH',
    defaultName: 'mediainfo',
    args: ['--version'],
    critical: false,
    versionRegex: /MediaInfoLib\s*-\s*v?([\d.]+)/i,
  },
  {
    name: 'mediaconch',
    envKey: 'MEDIACONCH_PATH',
    defaultName: 'mediaconch',
    args: ['--version'],
    critical: false,
    versionRegex: /MediaConch\s+(?:command line,?\s*)?v?([\d.]+)/i,
  },
  {
    name: 'bs1770gain',
    envKey: 'BS1770GAIN_PATH',
    defaultName: 'bs1770gain',
    args: ['--version'],
    critical: false,
    versionRegex: /bs1770gain\s+v?([\d.]+)/i,
  },
  {
    name: 'handbrake',
    envKey: 'HANDBRAKE_CLI_PATH',
    defaultName: 'HandBrakeCLI',
    args: ['--version'],
    critical: false,
    versionRegex: /HandBrake\s+v?([\d.]+)/i,
  },
  {
    name: 'ccextractor',
    envKey: 'CCEXTRACTOR_PATH',
    defaultName: 'ccextractorwin',
    args: ['--version'],
    critical: false,
    versionRegex: /CCExtractor\s+v?([\d.]+)/i,
  },
];

const CHECK_TIMEOUT_MS = 5000;

// ── Registry ─────────────────────────────────────────────────────

/**
 * Registo centralizado de ferramentas de media disponíveis.
 *
 * Substitui o `checkToolAvailability()` inline do `worker.ts`.
 * Deve ser chamado uma vez no startup e consultado durante runtime.
 */
export class NexoraToolRegistry {
  private statuses = new Map<ToolName, ToolStatus>();

  /**
   * Verifica a disponibilidade de todas as ferramentas configuradas.
   * Actualiza o gauge Prometheus `nexora_tool_available` para cada uma.
   */
  async checkAllTools(): Promise<ToolReport> {
    const results = await Promise.all(
      TOOL_CONFIGS.map(config => this.checkTool(config))
    );

    for (const status of results) {
      this.statuses.set(status.name, status);
      toolAvailable.set({ tool_name: status.name }, status.available ? 1 : 0);

      if (status.available) {
        logger.info(
          { tool: status.name, version: status.version, path: status.path },
          `✓ Ferramenta disponível: ${status.name} v${status.version ?? '?'}`
        );
      } else {
        logger.warn(
          { tool: status.name, path: status.path },
          `⚠ Ferramenta não encontrada: ${status.name}`
        );
      }
    }

    const criticalMissing = results
      .filter(s => !s.available && TOOL_CONFIGS.find(c => c.name === s.name)?.critical)
      .map(s => s.name);

    const optionalMissing = results
      .filter(s => !s.available && !TOOL_CONFIGS.find(c => c.name === s.name)?.critical)
      .map(s => s.name);

    return {
      tools: results,
      criticalMissing,
      optionalMissing,
      checkedAt: new Date().toISOString(),
    };
  }

  /** Verifica uma ferramenta individual */
  private async checkTool(config: ToolConfig): Promise<ToolStatus> {
    const toolPath = process.env[config.envKey] ?? config.defaultName;
    const base: ToolStatus = {
      name: config.name,
      available: false,
      version: null,
      path: toolPath,
      checkedAt: new Date().toISOString(),
    };

    try {
      const { stdout, stderr } = await execFileAsync(
        toolPath,
        config.args,
        { timeout: CHECK_TIMEOUT_MS }
      );

      const combined = `${stdout}\n${stderr}`;
      const versionMatch = combined.match(config.versionRegex);

      return {
        ...base,
        available: true,
        version: versionMatch?.[1] ?? 'unknown',
      };
    } catch {
      return base;
    }
  }

  /**
   * Lança `ToolNotAvailableError` se a ferramenta não estiver disponível.
   * Deve ser chamado no início de cada adaptador.
   */
  requireTool(name: ToolName): ToolStatus {
    const status = this.statuses.get(name);

    if (!status || !status.available) {
      throw new ToolNotAvailableError(name, {
        path: status?.path ?? 'not checked',
        checkedAt: status?.checkedAt ?? 'never',
      });
    }

    return status;
  }

  /** Verifica se uma ferramenta está disponível (sem lançar erro) */
  isAvailable(name: ToolName): boolean {
    return this.statuses.get(name)?.available ?? false;
  }

  /** Devolve o path resolvido de uma ferramenta */
  getPath(name: ToolName): string {
    const config = TOOL_CONFIGS.find(c => c.name === name);
    return process.env[config?.envKey ?? ''] ?? config?.defaultName ?? name;
  }

  /** Devolve a versão de uma ferramenta (ou null se não disponível) */
  getVersion(name: ToolName): string | null {
    return this.statuses.get(name)?.version ?? null;
  }

  /** Relatório JSON serializável para `/health` e logs de startup */
  getReport(): ToolReport {
    const tools = Array.from(this.statuses.values());
    const criticalMissing = tools
      .filter(s => !s.available && TOOL_CONFIGS.find(c => c.name === s.name)?.critical)
      .map(s => s.name);
    const optionalMissing = tools
      .filter(s => !s.available && !TOOL_CONFIGS.find(c => c.name === s.name)?.critical)
      .map(s => s.name);

    return {
      tools,
      criticalMissing,
      optionalMissing,
      checkedAt: new Date().toISOString(),
    };
  }
}

// ── Singleton ────────────────────────────────────────────────────

export const toolRegistry = new NexoraToolRegistry();
