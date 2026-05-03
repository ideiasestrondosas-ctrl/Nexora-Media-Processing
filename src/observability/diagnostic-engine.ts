// Nexora Media Processing — Diagnostic Engine
// Ficheiro: src/observability/diagnostic-engine.ts
//
// Motor central de diagnóstico — orquestra o fluxo completo:
//   NexoraLogParser → NexoraPatternMatcher → NexoraFixSuggester
//   → NexoraRetryAdvisor → NexoraAnomalyDetector
//
// Chamado pelos workers em falhas de job para análise automática.
// Loga resultados via Pino estruturado e incrementa métricas Prometheus.

import { logger } from './logger';
import { logParser } from './log-parser';
import { patternMatcher } from './pattern-matcher';
import { fixSuggester } from './fix-suggester';
import { retryAdvisor } from './retry-advisor';
import { anomalyDetector } from './anomaly-detector';
import {
  diagnosticPatternsDetected,
  diagnosticRetriesAdvised,
  anomaliesDetected,
} from './metrics';

import type { ParsedLogEntry } from './log-parser';
import type { PatternMatch, PatternSeverity } from './pattern-matcher';
import type { FixSuggestion } from './fix-suggester';
import type { RetryConfig } from './retry-advisor';

// ── Tipos Públicos ────────────────────────────────────────────────

/** Input para o motor de diagnóstico */
export interface DiagnosticInput {
  jobId: string;
  assetId: string;
  /** Tentativas já realizadas pelo BullMQ */
  attemptsMade?: number;
  /** stderr completo do FFmpeg */
  ffmpegStderr?: string;
  /** JSON de output do MediaInfo */
  mediaInfoJson?: string;
  /** XML de output do MediaConch */
  mediaConchXml?: string;
  /** XML de output do BS1770GAIN */
  bs1770gainXml?: string;
  /** Target LUFS (para validação BS1770GAIN) */
  targetLufs?: number;
  /** True Peak limit (para validação BS1770GAIN) */
  truePeakLimit?: number;
  /** Evento BullMQ (failed, stalled, etc.) */
  bullmqEvent?: Record<string, unknown>;
  /** Erro JavaScript capturado no worker */
  error?: Error;
}

/** Resultado completo do diagnóstico */
export interface DiagnosticResult {
  /** ID único deste diagnóstico */
  id: string;
  /** Contexto do job */
  jobId: string;
  assetId: string;
  /** Timestamp ISO 8601 */
  timestamp: string;
  /** Severidade máxima detectada */
  severity: PatternSeverity | null;
  /** Padrões reconhecidos nas entradas de log */
  patterns: PatternMatch[];
  /** Entradas de log parseadas (todas as fontes) */
  parsedEntries: ParsedLogEntry[];
  /** Sugestões de correcção */
  fixes: FixSuggestion[];
  /** Decisão de retry */
  retryConfig: RetryConfig;
  /** Anomalias detectadas nas métricas */
  anomalies: ReturnType<typeof anomalyDetector.record>[];
  /** Sumário legível do diagnóstico */
  summary: string;
  /** Tempo de diagnóstico em ms */
  diagnosticMs: number;
}

// ── Diagnostic Engine ─────────────────────────────────────────────

export class NexoraDiagnosticEngine {
  private readonly log = logger.child({ component: 'DiagnosticEngine' });

  /**
   * Diagnóstico completo de um job falhado.
   * Orquestra parser → matcher → suggester → advisor → anomaly detector.
   */
  diagnose(input: DiagnosticInput): DiagnosticResult {
    const startMs = Date.now();
    const id = `diag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const timestamp = new Date().toISOString();
    const { jobId, assetId, attemptsMade = 0 } = input;

    const diagLog = this.log.child({ diagnosticId: id, jobId, assetId });
    diagLog.debug({ attemptsMade }, 'A iniciar diagnóstico');

    // ── 1. Parsear todos os inputs disponíveis ────────────────────
    const allEntries: ParsedLogEntry[] = [];

    if (input.ffmpegStderr?.trim()) {
      const ffmpegEntries = logParser.parseFFmpegStderr(
        input.ffmpegStderr,
        jobId,
        assetId
      );
      allEntries.push(...ffmpegEntries);
    }

    if (input.mediaInfoJson?.trim()) {
      const miEntries = logParser.parseMediaInfoJSON(input.mediaInfoJson, assetId);
      allEntries.push(...miEntries);
    }

    if (input.mediaConchXml?.trim()) {
      const mcEntries = logParser.parseMediaConchXML(input.mediaConchXml, assetId);
      allEntries.push(...mcEntries);
    }

    if (input.bs1770gainXml?.trim()) {
      const bsEntries = logParser.parseBS1770GainXML(
        input.bs1770gainXml,
        assetId,
        input.targetLufs,
        input.truePeakLimit
      );
      allEntries.push(...bsEntries);
    }

    if (input.bullmqEvent) {
      const bullEntry = logParser.parseBullMQEvent(input.bullmqEvent, jobId, assetId);
      allEntries.push(bullEntry);
    }

    // Se só temos um Error JS sem outros inputs, criar entrada sintética
    if (allEntries.length === 0 && input.error) {
      allEntries.push({
        id: `synth-${Date.now()}`,
        source: 'bullmq',
        timestamp,
        level: 'error',
        message: input.error.message,
        raw: input.error.stack ?? input.error.message,
        metadata: { error_name: input.error.name },
        jobId,
        assetId,
      });
    }

    diagLog.debug({ entryCount: allEntries.length }, 'Entradas parseadas');

    // ── 2. Reconhecer padrões ─────────────────────────────────────
    const patterns = patternMatcher.match(allEntries);
    const severity = patternMatcher.getMaxSeverity(patterns);

    diagLog.debug({ patternCount: patterns.length, severity }, 'Padrões reconhecidos');

    // Incrementar métricas Prometheus por padrão detectado
    for (const match of patterns) {
      diagnosticPatternsDetected.inc({
        pattern_id: match.pattern.id,
        severity: match.pattern.severity,
      });
    }

    // ── 3. Obter sugestões de correcção ───────────────────────────
    const fixes = fixSuggester.suggest(patterns);

    diagLog.debug({ fixCount: fixes.length }, 'Sugestões de correcção obtidas');

    // ── 4. Decisão de retry ───────────────────────────────────────
    // Precisamos de um DiagnosticResult parcial para o RetryAdvisor
    const partialResult: DiagnosticResult = {
      id, jobId, assetId, timestamp, severity, patterns, parsedEntries: allEntries,
      fixes, retryConfig: null as unknown as RetryConfig, anomalies: [], summary: '',
      diagnosticMs: 0,
    };

    const retryConfig = retryAdvisor.advise(partialResult, attemptsMade);

    if (retryConfig.shouldRetry) {
      diagnosticRetriesAdvised.inc({ pattern_id: patterns[0]?.pattern.id ?? 'unknown' });
    }

    // ── 5. Detecção de anomalias nas métricas ─────────────────────
    const anomalies: ReturnType<typeof anomalyDetector.record>[] = [];
    this.recordMetricAnomalies(input, anomalies);

    // Incrementar métricas Prometheus por anomalia
    for (const anomaly of anomalies) {
      if (anomaly) {
        anomaliesDetected.inc({ metric: anomaly.metric, severity: anomaly.severity });
      }
    }

    // ── 6. Construir sumário ──────────────────────────────────────
    const summary = this.buildSummary(patterns, fixes, retryConfig, severity);

    const diagnosticMs = Date.now() - startMs;

    const result: DiagnosticResult = {
      id,
      jobId,
      assetId,
      timestamp,
      severity,
      patterns,
      parsedEntries: allEntries,
      fixes,
      retryConfig,
      anomalies: anomalies.filter(Boolean),
      summary,
      diagnosticMs,
    };

    // ── 7. Log estruturado do resultado ──────────────────────────
    const logLevel = severity === 'critical' ? 'error' : severity === 'high' ? 'warn' : 'info';
    diagLog[logLevel](
      {
        severity,
        patternIds: patterns.map(m => m.pattern.id),
        fixIds: fixes.map(f => f.id),
        shouldRetry: retryConfig.shouldRetry,
        anomalyCount: anomalies.filter(Boolean).length,
        diagnosticMs,
      },
      summary
    );

    return result;
  }

  /**
   * Hook conveniente para workers — chamado no handler on('failed').
   * Aceita directamente os parâmetros típicos de um BullMQ failure handler.
   */
  onJobFailed(
    jobId: string,
    assetId: string,
    error: Error,
    ffmpegStderr?: string,
    attemptsMade = 0
  ): DiagnosticResult {
    return this.diagnose({
      jobId,
      assetId,
      attemptsMade,
      ffmpegStderr,
      error,
    });
  }

  /**
   * Hook para diagnóstico de áudio — inclui BS1770GAIN e parâmetros de loudness.
   */
  onAudioFailed(
    jobId: string,
    assetId: string,
    error: Error,
    bs1770gainXml?: string,
    targetLufs = -23,
    truePeakLimit = -1.0,
    attemptsMade = 0
  ): DiagnosticResult {
    return this.diagnose({
      jobId,
      assetId,
      attemptsMade,
      bs1770gainXml,
      targetLufs,
      truePeakLimit,
      error,
    });
  }

  // ── Privado ───────────────────────────────────────────────────

  private recordMetricAnomalies(
    input: DiagnosticInput,
    anomalies: ReturnType<typeof anomalyDetector.record>[]
  ): void {
    // Incrementar error_rate quando há falhas
    // (simplificado: 1.0 = falha, será suavizado pela janela deslizante)
    const errAnomaly = anomalyDetector.record('error_rate', 1.0);
    if (errAnomaly) anomalies.push(errAnomaly);

    // Registar True Peak se disponível no BS1770GAIN
    if (input.bs1770gainXml) {
      const tpMatch = input.bs1770gainXml.match(/dbtp=['\"]([-\d.]+)['\"]|true[_-]?peak[^>]*>([-\d.]+)/i);
      if (tpMatch) {
        const tp = Number(tpMatch[1] ?? tpMatch[2]);
        if (!isNaN(tp)) {
          const tpAnomaly = anomalyDetector.record('true_peak', tp);
          if (tpAnomaly) anomalies.push(tpAnomaly);
        }
      }
    }
  }

  private buildSummary(
    patterns: PatternMatch[],
    fixes: FixSuggestion[],
    retryConfig: RetryConfig,
    severity: PatternSeverity | null
  ): string {
    if (patterns.length === 0) {
      return 'Diagnóstico: nenhum padrão conhecido reconhecido — falha não classificada';
    }

    const topPattern = patterns[0]!;
    const sevLabel = severity?.toUpperCase() ?? 'UNKNOWN';
    const retryLabel = retryConfig.shouldRetry
      ? `retry aconselhado em ${retryConfig.backoffMs}ms`
      : 'sem retry — job terminado';

    const fixTitles = fixes
      .slice(0, 2)
      .map(f => f.title)
      .join('; ');

    return (
      `[${sevLabel}] ${topPattern.pattern.description}` +
      (patterns.length > 1 ? ` (+${patterns.length - 1} padrões adicionais)` : '') +
      `. ${retryLabel}` +
      (fixTitles ? `. Correcções: ${fixTitles}` : '')
    );
  }
}

// ── Singleton ─────────────────────────────────────────────────────

export const diagnosticEngine = new NexoraDiagnosticEngine();
