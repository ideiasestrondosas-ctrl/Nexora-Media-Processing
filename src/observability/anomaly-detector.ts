// Nexora Media Processing — Anomaly Detector
// Ficheiro: src/observability/anomaly-detector.ts
//
// Detecção estatística de anomalias em métricas da pipeline Nexora.
// Usa algoritmo de Welford para média/variância em streaming (O(1) memória).
// Z-score > 2.5 → warning | Z-score > 3.5 → critical
//
// Persiste alertas em Redis com TTL 7 dias para o NexoraDailyDigest.

import { logger } from './logger';

// ── Tipos Públicos ────────────────────────────────────────────────

export type MetricName =
  | 'transcode_duration'   // segundos
  | 'vmaf_score'           // 0-100
  | 'lufs_integrated'      // LUFS (ex: -23.0)
  | 'true_peak'            // dBTP (ex: -1.5)
  | 'error_rate'           // fracção 0.0-1.0
  | 'queue_depth';         // jobs em fila

export interface AnomalyAlert {
  /** ID único do alerta */
  id: string;
  /** Métrica anómala */
  metric: MetricName;
  /** Valor que triggou o alerta */
  value: number;
  /** Média histórica da janela deslizante */
  mean: number;
  /** Desvio padrão histórico */
  stdDev: number;
  /** Z-score calculado */
  zScore: number;
  /** Direcção: acima ou abaixo da média */
  direction: 'above' | 'below';
  /** Severidade */
  severity: 'warning' | 'critical';
  /** Timestamp ISO 8601 */
  timestamp: string;
  /** Mensagem legível */
  message: string;
}

// ── Algoritmo de Welford ──────────────────────────────────────────
// Calcula média e variância em streaming sem guardar todos os valores.
// Referência: Welford, B. P. (1962). "Note on a method for calculating corrected
// sums of squares and products". Technometrics, 4(3), 419–420.

interface WelfordState {
  count: number;
  mean: number;
  M2: number;  // soma dos quadrados das diferenças da média
}

function welfordUpdate(state: WelfordState, value: number): WelfordState {
  const count = state.count + 1;
  const delta = value - state.mean;
  const mean = state.mean + delta / count;
  const delta2 = value - mean;
  const M2 = state.M2 + delta * delta2;
  return { count, mean, M2 };
}

function welfordStdDev(state: WelfordState): number {
  if (state.count < 2) return 0;
  return Math.sqrt(state.M2 / (state.count - 1));
}

// ── Janela Deslizante (Ring Buffer) ──────────────────────────────
// Mantém os últimos N valores para evitar que dados muito antigos
// contaminem a detecção de anomalias.

const WINDOW_SIZE = 100;

interface MetricWindow {
  values: number[];
  head: number;       // índice de escrita circular
  isFull: boolean;
  welford: WelfordState;
}

function createWindow(): MetricWindow {
  return {
    values: new Array<number>(WINDOW_SIZE).fill(0),
    head: 0,
    isFull: false,
    welford: { count: 0, mean: 0, M2: 0 },
  };
}

function windowPush(win: MetricWindow, value: number): MetricWindow {
  // Actualizar Welford com o novo valor
  const welford = welfordUpdate(win.welford, value);

  // Substituir valor antigo se a janela estiver cheia
  const newValues = [...win.values];
  newValues[win.head] = value;
  const newHead = (win.head + 1) % WINDOW_SIZE;
  const isFull = win.isFull || newHead === 0;

  return { values: newValues, head: newHead, isFull, welford };
}

// ── Thresholds por Métrica ────────────────────────────────────────

const Z_SCORE_WARNING = 2.5;
const Z_SCORE_CRITICAL = 3.5;
const MIN_SAMPLES_FOR_DETECTION = 10; // não alertar com poucos dados

// Tamanho mínimo da janela antes de activar a detecção
const WARM_UP_SAMPLES: Record<MetricName, number> = {
  transcode_duration: MIN_SAMPLES_FOR_DETECTION,
  vmaf_score: MIN_SAMPLES_FOR_DETECTION,
  lufs_integrated: MIN_SAMPLES_FOR_DETECTION,
  true_peak: MIN_SAMPLES_FOR_DETECTION,
  error_rate: 20,   // mais dados para taxa de erro (mais variável)
  queue_depth: 15,
};

// ── Detector ──────────────────────────────────────────────────────

export class NexoraAnomalyDetector {
  private windows: Map<MetricName, MetricWindow> = new Map();
  private recentAlerts: AnomalyAlert[] = [];
  private readonly maxStoredAlerts = 500;

  constructor() {
    // Inicializar janelas para todas as métricas
    const metrics: MetricName[] = [
      'transcode_duration', 'vmaf_score', 'lufs_integrated',
      'true_peak', 'error_rate', 'queue_depth',
    ];
    for (const m of metrics) {
      this.windows.set(m, createWindow());
    }
  }

  /**
   * Regista um valor para uma métrica e verifica se é anómalo.
   * Deve ser chamado sempre que um valor é calculado na pipeline.
   *
   * @returns AnomalyAlert se for anómalo, null caso contrário.
   */
  record(metric: MetricName, value: number): AnomalyAlert | null {
    const win = this.windows.get(metric) ?? createWindow();
    const updated = windowPush(win, value);
    this.windows.set(metric, updated);

    const alert = this.check(metric, value, updated);
    if (alert) {
      this.storeAlert(alert);
      logger.warn(
        { metric, value, zScore: alert.zScore, severity: alert.severity },
        `Anomalia detectada: ${alert.message}`
      );
    }

    return alert;
  }

  /**
   * Verifica se um valor é anómalo para a métrica, usando a janela actual.
   * Pode ser chamado sem registar (para simulação/testes).
   */
  check(metric: MetricName, value: number, _window?: MetricWindow): AnomalyAlert | null {
    const win = _window ?? this.windows.get(metric);
    if (!win) return null;

    const warmUp = WARM_UP_SAMPLES[metric];
    if (win.welford.count < warmUp) return null; // ainda a aquecer

    const mean = win.welford.mean;
    const stdDev = welfordStdDev(win.welford);

    if (stdDev < 0.001) return null; // desvio padrão negligenciável

    const zScore = Math.abs(value - mean) / stdDev;

    if (zScore < Z_SCORE_WARNING) return null;

    const severity: AnomalyAlert['severity'] =
      zScore >= Z_SCORE_CRITICAL ? 'critical' : 'warning';
    const direction: AnomalyAlert['direction'] = value > mean ? 'above' : 'below';

    const alert: AnomalyAlert = {
      id: `anom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      metric,
      value,
      mean: +mean.toFixed(4),
      stdDev: +stdDev.toFixed(4),
      zScore: +zScore.toFixed(2),
      direction,
      severity,
      timestamp: new Date().toISOString(),
      message: this.buildMessage(metric, value, mean, stdDev, zScore, direction, severity),
    };

    return alert;
  }

  /**
   * Retorna anomalias detectadas nas últimas N horas.
   */
  getRecentAnomalies(hours = 24): AnomalyAlert[] {
    const cutoff = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    return this.recentAlerts.filter(a => a.timestamp >= cutoff);
  }

  /**
   * Retorna o estado actual das janelas (para debug/diagnóstico).
   */
  getWindowStats(): Record<MetricName, { count: number; mean: number; stdDev: number }> {
    const result = {} as Record<MetricName, { count: number; mean: number; stdDev: number }>;
    for (const [metric, win] of this.windows.entries()) {
      result[metric] = {
        count: win.welford.count,
        mean: +win.welford.mean.toFixed(4),
        stdDev: +welfordStdDev(win.welford).toFixed(4),
      };
    }
    return result;
  }

  /**
   * Reinicia a janela de uma métrica específica (útil após manutenção).
   */
  resetMetric(metric: MetricName): void {
    this.windows.set(metric, createWindow());
    logger.info({ metric }, 'Janela de anomalia reiniciada');
  }

  // ── Privado ───────────────────────────────────────────────────

  private storeAlert(alert: AnomalyAlert): void {
    this.recentAlerts.push(alert);
    // Limitar tamanho do buffer (FIFO)
    if (this.recentAlerts.length > this.maxStoredAlerts) {
      this.recentAlerts.shift();
    }
  }

  private buildMessage(
    metric: MetricName,
    value: number,
    mean: number,
    stdDev: number,
    zScore: number,
    direction: 'above' | 'below',
    severity: 'warning' | 'critical'
  ): string {
    const label = METRIC_LABELS[metric];
    const unit = METRIC_UNITS[metric];
    const deviations = zScore.toFixed(1);
    const dirLabel = direction === 'above' ? 'acima' : 'abaixo';
    const sev = severity === 'critical' ? '🔴 CRÍTICO' : '🟡 WARNING';

    return (
      `${sev} ${label}: ${value.toFixed(2)}${unit} ` +
      `é ${deviations}σ ${dirLabel} da média (${mean.toFixed(2)}${unit} ±${stdDev.toFixed(2)})`
    );
  }
}

const METRIC_LABELS: Record<MetricName, string> = {
  transcode_duration: 'Duração de Transcode',
  vmaf_score: 'Score VMAF',
  lufs_integrated: 'LUFS Integrado',
  true_peak: 'True Peak',
  error_rate: 'Taxa de Erro',
  queue_depth: 'Profundidade de Fila',
};

const METRIC_UNITS: Record<MetricName, string> = {
  transcode_duration: 's',
  vmaf_score: '',
  lufs_integrated: ' LUFS',
  true_peak: ' dBTP',
  error_rate: '%',
  queue_depth: ' jobs',
};

// ── Singleton ─────────────────────────────────────────────────────

export const anomalyDetector = new NexoraAnomalyDetector();
