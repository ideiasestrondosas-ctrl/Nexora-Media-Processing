// Nexora Media Processing — VMAF Scorer
// Ficheiro: src/pipeline/ffmpeg/vmaf.ts
//
// Avaliação de qualidade visual com libvmaf integrado no FFmpeg.
// ADR-010: VMAF score calculado e guardado para todos os outputs.
// ADR-002: FFmpeg via execFile com array de argumentos.
//
// Thresholds por perfil:
//   archive   ≥ 93  (ADR-010)
//   broadcast ≥ 90
//   streaming ≥ 85
//   proxy     ≥ 70
//
// Floor de qualidade: 1st percentile como indicador de pior cena.
// Se percentile1 < threshold - 5, falha mesmo com mean acima do threshold.

import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Logger } from 'pino';
import { logger } from '../../observability/logger';
import { vmafScore as vmafScoreMetric } from '../../observability/metrics';

const execFileAsync = promisify(execFile);

// ── Tipos públicos ───────────────────────────────────────────────

export type VMAFProfile = 'archive' | 'broadcast' | 'streaming' | 'proxy';

export interface VMAFResult {
  /** Score médio VMAF (0-100) */
  mean: number;
  /** Score mínimo (pior frame) */
  min: number;
  /** Score máximo (melhor frame) */
  max: number;
  /** 1st percentile — floor de qualidade (ADR-010) */
  percentile1: number;
  /** 5th percentile */
  percentile5: number;
  /** Média harmónica (mais sensível a outliers negativos) */
  harmonicMean: number;
  /** Perfil de qualidade avaliado */
  profile: VMAFProfile;
  /** Threshold do perfil */
  threshold: number;
  /** true se o score passou o threshold */
  passed: boolean;
  /** Razão de falha, se passed=false */
  failureReason?: string;
  /** Número de frames avaliados */
  framesEvaluated: number;
}

/** Resultado bruto do JSON do libvmaf */
interface VMAFJsonOutput {
  VMAF?: {
    frames?: Array<{ metrics: { vmaf: number } }>;
    aggregate?: {
      mean?: number;
      min?: number;
      max?: number;
      harmonic_mean?: number;
      percentile1?: number;
      percentile5?: number;
    };
  };
  'pooled_metrics'?: {
    vmaf?: {
      mean: number;
      min: number;
      max: number;
      harmonic_mean: number;
      percentile1: number;
      percentile5: number;
    };
  };
  frames?: Array<{ metrics?: { vmaf?: number } }>;
}

// ── Thresholds ───────────────────────────────────────────────────

/** Threshold mínimo de VMAF por perfil de qualidade */
const VMAF_THRESHOLDS: Record<VMAFProfile, number> = {
  archive:   93,
  broadcast: 90,
  streaming: 85,
  proxy:     70,
};

/** Margem do 1st percentile abaixo do threshold que causa rejeição */
const PERCENTILE1_MARGIN = 5;

/** Timeout para análise VMAF (pode ser lenta para ficheiros longos) */
const VMAF_TIMEOUT_MS = 60 * 60 * 1000; // 1 hora

// ── Mapeamento de perfil Nexora → perfil VMAF ────────────────────

const NEXORA_PROFILE_TO_VMAF: Record<string, VMAFProfile> = {
  'broadcast-hd': 'broadcast',
  'ott-hd': 'streaming',
  'web-sd': 'streaming',
  'proxy': 'proxy',
  'archive': 'archive',
};

// ── Scorer ───────────────────────────────────────────────────────

export class NexoraVMAFScorer {

  /**
   * Calcula o score VMAF entre o ficheiro de referência e o encoded.
   * Usa o modelo vmaf_v0.6.1 com n_subsample=5 para performance.
   *
   * @param reference  - Path do ficheiro de referência (original)
   * @param encoded    - Path do ficheiro encoded (output do transcode)
   * @param nexoraProfile - Perfil Nexora (broadcast-hd, ott-hd, web-sd, proxy)
   */
  async score(
    reference: string,
    encoded: string,
    nexoraProfile: string
  ): Promise<VMAFResult> {
    const vmafProfile = NEXORA_PROFILE_TO_VMAF[nexoraProfile] ?? 'streaming';
    const threshold = VMAF_THRESHOLDS[vmafProfile];

    const log = logger.child({ reference, encoded, vmafProfile, threshold });
    log.info('A calcular score VMAF...');

    // Criar ficheiro temporário para o log VMAF
    const tmpDir = await mkdtemp(join(tmpdir(), 'nexora-vmaf-'));
    const logPath = join(tmpDir, 'vmaf.json');

    try {
      await this.runVMAF(reference, encoded, logPath, log);

      const result = await this.parseVMAFLog(logPath);
      const framesEvaluated = result.frames?.length ?? 0;

      // Extrair scores do output libvmaf
      const scores = this.extractScores(result);
      log.info({ scores }, 'VMAF calculado');

      // Avaliar conformidade
      const { passed, failureReason } = this.evaluate(scores, threshold, vmafProfile);

      // Métricas Prometheus
      vmafScoreMetric.observe({ profile: nexoraProfile }, scores.mean);

      if (!passed) {
        log.warn({ scores, threshold, failureReason }, 'VMAF abaixo do threshold');
      } else {
        log.info({ scores, threshold }, 'VMAF aprovado');
      }

      return {
        ...scores,
        profile: vmafProfile,
        threshold,
        passed,
        failureReason,
        framesEvaluated,
      };

    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * Executa FFmpeg com filtro libvmaf.
   * ADR-002: execFile com array de argumentos.
   */
  private async runVMAF(
    reference: string,
    encoded: string,
    logPath: string,
    log: Logger
  ): Promise<void> {
    const ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg';

    // Filtro libvmaf — log em JSON, n_subsample=5 para velocidade
    const vmafFilter = [
      `[0:v][1:v]libvmaf=`,
      `log_fmt=json`,
      `log_path=${logPath}`,
      `n_subsample=5`,
      `model=version=vmaf_v0.6.1`,
    ].join(':');

    log.debug({ vmafFilter }, 'A executar VMAF...');

    await execFileAsync(
      ffmpegPath,
      [
        '-i', reference,
        '-i', encoded,
        '-lavfi', vmafFilter,
        '-f', 'null',
        '-',
      ],
      { timeout: VMAF_TIMEOUT_MS }
    );
  }

  /** Parseia o ficheiro JSON de log do libvmaf */
  private async parseVMAFLog(logPath: string): Promise<VMAFJsonOutput> {
    const raw = await readFile(logPath, 'utf-8');
    return JSON.parse(raw) as VMAFJsonOutput;
  }

  /** Extrai scores do JSON libvmaf (suporta formato v2 e v3) */
  private extractScores(data: VMAFJsonOutput): Omit<VMAFResult, 'profile' | 'threshold' | 'passed' | 'failureReason' | 'framesEvaluated'> {
    // Formato moderno: pooled_metrics.vmaf
    if (data.pooled_metrics?.vmaf) {
      const v = data.pooled_metrics.vmaf;
      return {
        mean: v.mean,
        min: v.min,
        max: v.max,
        harmonicMean: v.harmonic_mean,
        percentile1: v.percentile1,
        percentile5: v.percentile5,
      };
    }

    // Formato legado: VMAF.aggregate
    if (data.VMAF?.aggregate) {
      const a = data.VMAF.aggregate;
      return {
        mean: a.mean ?? 0,
        min: a.min ?? 0,
        max: a.max ?? 0,
        harmonicMean: a.harmonic_mean ?? 0,
        percentile1: a.percentile1 ?? 0,
        percentile5: a.percentile5 ?? 0,
      };
    }

    // Fallback: calcular manualmente dos frames individuais
    const frames = data.frames ?? data.VMAF?.frames ?? [];
    const scores = frames.map(f => f.metrics?.vmaf ?? 0).filter(s => s > 0);

    if (scores.length === 0) {
      throw new Error('libvmaf não produziu scores válidos no log JSON');
    }

    scores.sort((a, b) => a - b);
    const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
    const harmonicMean = scores.length / scores.reduce((s, v) => s + (1 / Math.max(v, 0.01)), 0);

    return {
      mean,
      min: scores[0]!,
      max: scores[scores.length - 1]!,
      harmonicMean,
      percentile1: scores[Math.floor(scores.length * 0.01)]!,
      percentile5: scores[Math.floor(scores.length * 0.05)]!,
    };
  }

  /**
   * Avalia se o score passou o threshold.
   * ADR-010: 1st percentile como floor de qualidade.
   */
  private evaluate(
    scores: Omit<VMAFResult, 'profile' | 'threshold' | 'passed' | 'failureReason' | 'framesEvaluated'>,
    threshold: number,
    profile: VMAFProfile
  ): { passed: boolean; failureReason?: string } {
    // Critério 1: média acima do threshold
    if (scores.mean < threshold) {
      return {
        passed: false,
        failureReason: `Score médio ${scores.mean.toFixed(2)} < threshold ${threshold} (perfil ${profile})`,
      };
    }

    // Critério 2: 1st percentile como floor (ADR-010)
    const percentileFloor = threshold - PERCENTILE1_MARGIN;
    if (scores.percentile1 < percentileFloor) {
      return {
        passed: false,
        failureReason: `1st percentile ${scores.percentile1.toFixed(2)} < floor ${percentileFloor} — ` +
          `cenas com má qualidade detectadas (perfil ${profile})`,
      };
    }

    return { passed: true };
  }

  /**
   * Converte perfil Nexora (broadcast-hd, ott-hd, etc.) para perfil VMAF.
   */
  static resolveVMAFProfile(nexoraProfile: string): VMAFProfile {
    return NEXORA_PROFILE_TO_VMAF[nexoraProfile] ?? 'streaming';
  }

  /**
   * Retorna o threshold VMAF para um perfil.
   */
  static getThreshold(vmafProfile: VMAFProfile): number {
    return VMAF_THRESHOLDS[vmafProfile];
  }
}

// ── Singleton ────────────────────────────────────────────────────

export const vmafScorer = new NexoraVMAFScorer();
