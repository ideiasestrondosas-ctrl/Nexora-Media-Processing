// Nexora Media Processing — Retry Advisor
// Ficheiro: src/observability/retry-advisor.ts
//
// Decide se um job falhado deve ser re-tentado e com que parâmetros ajustados.
// Consulta os padrões detectados e aplica regras de negócio específicas
// para cada tipo de falha.

import type { DiagnosticResult } from './diagnostic-engine';
import type { PatternSeverity } from './pattern-matcher';
import type { FixSuggestion } from './fix-suggester';

// ── Tipos Públicos ────────────────────────────────────────────────

/** Configuração de retry gerada pelo advisor */
export interface RetryConfig {
  /** Se o job deve ser re-tentado */
  shouldRetry: boolean;
  /** Razão da decisão (para logging) */
  reason: string;
  /** Número máximo de retries adicionais permitidos */
  maxAdditionalRetries: number;
  /** Delay antes do retry (ms) */
  backoffMs: number;
  /** Ajustes de parâmetros para o retry */
  adjustedParams: RetryParams;
  /** ID do diagnóstico que gerou esta decisão */
  diagnosticId: string;
  /** Severidade dos padrões detectados */
  detectedSeverity: PatternSeverity | null;
}

/** Parâmetros ajustados para o retry */
export interface RetryParams {
  /** Flags a adicionar ao comando FFmpeg */
  ffmpegInputFlags?: string[];
  /** Flags de output a adicionar ao comando FFmpeg */
  ffmpegOutputFlags?: string[];
  /** Flags a remover do comando original */
  ffmpegFlagsToRemove?: string[];
  /** Encoder a forçar */
  encoderOverride?: 'cpu' | 'nvenc' | 'qsv' | 'amf';
  /** Timeout FFmpeg ajustado (ms) */
  timeoutMs?: number;
  /** Variáveis de ambiente a sobrepor */
  envOverrides?: Record<string, string>;
  /** Filtro de áudio ajustado */
  audioFilter?: string;
  /** Prioridade BullMQ ajustada (menor = mais rápido) */
  bullmqPriority?: number;
}

// ── Limites de Retry por Padrão ───────────────────────────────────

const RETRY_LIMITS: Record<string, number> = {
  // Críticos retryable: máximo 1 retry
  OUT_OF_MEMORY: 1,
  // High retryable: máximo 2 retries
  DTS_OUT_OF_ORDER: 2,
  PAST_DURATION_LARGE: 2,
  PIPE_BROKEN: 2,
  // GPU: 1 retry forçando CPU
  NVENC_ERROR: 1,
  // VFR: 2 retries com CFR
  VFR_DETECTED: 2,
  // Áudio: conforme documentação ADR-005 (já tem retry próprio em loudness.ts)
  TRUE_PEAK_EXCEEDED: 2,
  LUFS_DEVIATION: 3,
  BS1770_PARSE_ERROR: 1,
  // Queue
  BULLMQ_JOB_STALLED: 1,
};

const BACKOFF_MS: Record<string, number> = {
  OUT_OF_MEMORY: 30000,     // 30s — aguardar liberação de memória
  DTS_OUT_OF_ORDER: 5000,   // 5s
  PAST_DURATION_LARGE: 5000,
  PIPE_BROKEN: 10000,        // 10s
  NVENC_ERROR: 3000,         // 3s — fallback CPU imediato
  VFR_DETECTED: 5000,
  TRUE_PEAK_EXCEEDED: 3000,
  LUFS_DEVIATION: 3000,
  BS1770_PARSE_ERROR: 5000,
  BULLMQ_JOB_STALLED: 15000,
};

const DEFAULT_BACKOFF_MS = 10000;

// ── Advisor ───────────────────────────────────────────────────────

export class NexoraRetryAdvisor {

  /**
   * Analisa um resultado de diagnóstico e decide se deve fazer retry.
   *
   * @param diagnostic  - Resultado do NexoraDiagnosticEngine
   * @param attemptsMade - Número de tentativas já realizadas (BullMQ)
   */
  advise(diagnostic: DiagnosticResult, attemptsMade: number): RetryConfig {
    const baseConfig: RetryConfig = {
      shouldRetry: false,
      reason: 'Sem padrões retryable detectados',
      maxAdditionalRetries: 0,
      backoffMs: DEFAULT_BACKOFF_MS,
      adjustedParams: {},
      diagnosticId: diagnostic.id,
      detectedSeverity: diagnostic.severity,
    };

    // Sem padrões detectados — não alterar comportamento padrão BullMQ
    if (diagnostic.patterns.length === 0) {
      return { ...baseConfig, reason: 'Nenhum padrão de erro reconhecido — retry padrão BullMQ' };
    }

    // Erros terminais não-retryable (moov, invalid data, conversion failed)
    const hasTerminal = diagnostic.patterns.some(
      m => m.pattern.severity === 'critical' && !m.pattern.isRetryable
    );
    if (hasTerminal) {
      const terminalPattern = diagnostic.patterns.find(
        m => m.pattern.severity === 'critical' && !m.pattern.isRetryable
      )!;
      return {
        ...baseConfig,
        shouldRetry: false,
        reason: `Erro terminal: ${terminalPattern.pattern.id} — ${terminalPattern.pattern.description}`,
        detectedSeverity: 'critical',
      };
    }

    // Recolher todos os padrões retryable
    const retryableMatches = diagnostic.patterns.filter(m => m.pattern.isRetryable);
    if (retryableMatches.length === 0) {
      return { ...baseConfig, reason: 'Padrões detectados mas nenhum é retryable' };
    }

    // Calcular máximo de retries permitidos com base no padrão mais restritivo
    const maxRetries = Math.min(
      ...retryableMatches.map(m => RETRY_LIMITS[m.pattern.id] ?? 2)
    );

    if (attemptsMade > maxRetries) {
      return {
        ...baseConfig,
        shouldRetry: false,
        reason: `Máximo de retries (${maxRetries}) atingido após ${attemptsMade} tentativas`,
        maxAdditionalRetries: 0,
        detectedSeverity: diagnostic.severity,
      };
    }

    // Calcular backoff (usar o maior dos padrões detectados)
    const backoffMs = Math.max(
      ...retryableMatches.map(m => BACKOFF_MS[m.pattern.id] ?? DEFAULT_BACKOFF_MS)
    );

    // Agregar parâmetros dos fixes sugeridos
    const adjustedParams = this.buildRetryParams(diagnostic.fixes, attemptsMade);

    // Construir razão legível
    const patternDescriptions = retryableMatches
      .slice(0, 3) // máximo 3 padrões na mensagem
      .map(m => m.pattern.id)
      .join(', ');

    return {
      shouldRetry: true,
      reason: `Retry com ajustes para: ${patternDescriptions} (tentativa ${attemptsMade + 1}/${maxRetries + 1})`,
      maxAdditionalRetries: maxRetries - attemptsMade,
      backoffMs,
      adjustedParams,
      diagnosticId: diagnostic.id,
      detectedSeverity: diagnostic.severity,
    };
  }

  /**
   * Constrói os parâmetros ajustados para o retry a partir das sugestões de fix.
   * Combina flags de múltiplos fixes, resolvendo conflitos.
   */
  private buildRetryParams(
    fixes: FixSuggestion[],
    attemptsMade: number
  ): RetryParams {
    const params: RetryParams = {};

    if (fixes.length === 0) return params;

    const inputFlags: string[] = [];
    const outputFlags: string[] = [];
    const toRemove: string[] = [];
    const envOverrides: Record<string, string> = {};

    for (const fix of fixes) {
      if (fix.ffmpegInputFlags) {
        inputFlags.push(...fix.ffmpegInputFlags);
      }
      if (fix.ffmpegFlagsAdd) {
        outputFlags.push(...fix.ffmpegFlagsAdd);
      }
      if (fix.ffmpegFlagsRemove) {
        toRemove.push(...fix.ffmpegFlagsRemove);
      }
      if (fix.envOverrides) {
        Object.assign(envOverrides, fix.envOverrides);
      }
      if (fix.ffmpegAudioFilter) {
        params.audioFilter = fix.ffmpegAudioFilter;
      }
      if (fix.encoderOverride) {
        params.encoderOverride = fix.encoderOverride as RetryParams['encoderOverride'];
      }
    }

    // Timeout: duplicar por tentativa (progressivo)
    const baseTimeout = 14400000; // 4h
    params.timeoutMs = baseTimeout * Math.pow(1.5, attemptsMade);

    // Remover duplicados
    params.ffmpegInputFlags = [...new Set(inputFlags)];
    params.ffmpegOutputFlags = [...new Set(outputFlags)];
    params.ffmpegFlagsToRemove = [...new Set(toRemove)];

    if (Object.keys(envOverrides).length > 0) {
      params.envOverrides = envOverrides;
    }

    return params;
  }

  /**
   * Verifica se um conjunto de padrões inclui erros de GPU que
   * requerem fallback imediato para CPU.
   */
  requiresCPUFallback(diagnostic: DiagnosticResult): boolean {
    return diagnostic.patterns.some(m => m.pattern.id === 'NVENC_ERROR');
  }

  /**
   * Verifica se os padrões detectados indicam problema de loudness
   * que deve ser tratado pelo módulo de normalização (não pelo retry geral).
   */
  isLoudnessIssue(diagnostic: DiagnosticResult): boolean {
    return diagnostic.patterns.some(
      m => m.pattern.category === 'audio' && m.pattern.isRetryable
    );
  }

  /**
   * Gera um sumário legível da decisão de retry para logging.
   */
  summarize(config: RetryConfig): string {
    if (!config.shouldRetry) {
      return `❌ Sem retry: ${config.reason}`;
    }
    const flags = [
      ...(config.adjustedParams.ffmpegInputFlags ?? []),
      ...(config.adjustedParams.ffmpegOutputFlags ?? []),
    ].slice(0, 6).join(' ');

    return (
      `✅ Retry em ${config.backoffMs}ms` +
      (flags ? ` com flags: ${flags}` : '') +
      (config.adjustedParams.encoderOverride ? ` encoder=${config.adjustedParams.encoderOverride}` : '') +
      ` (${config.maxAdditionalRetries} retries restantes)`
    );
  }
}

// ── Singleton ─────────────────────────────────────────────────────

export const retryAdvisor = new NexoraRetryAdvisor();
