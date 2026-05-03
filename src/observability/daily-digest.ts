// Nexora Media Processing — Daily Digest
// Ficheiro: src/observability/daily-digest.ts
//
// Relatório diário agregado de métricas da pipeline Nexora.
// Agrega dados de múltiplas fontes:
//   - PostgreSQL (Prisma): jobs, assets, audit logs das últimas 24h
//   - BullMQ (via API): contagens por estado em todas as filas
//   - NexoraAnomalyDetector: anomalias detectadas
//
// Pode ser chamado manualmente ou via cron job.

import { prisma } from '../db/prisma';
import { getNexoraQueues, QUEUE_NAMES } from '../workers/queues';
import { anomalyDetector } from './anomaly-detector';
import { logger } from './logger';

import type { AnomalyAlert } from './anomaly-detector';

// ── Tipos Públicos ────────────────────────────────────────────────

/** Sumário de erro mais frequente no período */
export interface TopErrorEntry {
  patternId: string;
  description: string;
  count: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  lastOccurrence: string;
}

/** Sumário de fila BullMQ */
export interface QueueSummary {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

/** Relatório diário completo */
export interface DailyDigestReport {
  /** Data do relatório (YYYY-MM-DD) */
  date: string;
  /** Período coberto */
  period: { start: string; end: string };

  // ── Métricas gerais ──────────────────────────────────────────
  totalJobsStarted: number;
  totalJobsCompleted: number;
  totalJobsFailed: number;
  successRate: number;      // 0.0 - 1.0
  retryCount: number;

  // ── Performance ──────────────────────────────────────────────
  avgTranscodeSeconds: number;
  p50TranscodeSeconds: number;
  p95TranscodeSeconds: number;

  // ── Qualidade ────────────────────────────────────────────────
  avgVmafScore: number | null;
  avgLufsIntegrated: number | null;
  truePeakViolations: number;
  lufsDeviations: number;

  // ── Assets ───────────────────────────────────────────────────
  assetsIngested: number;
  assetsCompleted: number;
  assetsRejected: number;
  assetsQuarantined: number;

  // ── Filas ────────────────────────────────────────────────────
  queues: QueueSummary[];

  // ── Erros ────────────────────────────────────────────────────
  topErrors: TopErrorEntry[];
  deadLetterCount: number;

  // ── Anomalias ─────────────────────────────────────────────────
  anomalies: AnomalyAlert[];
  anomalyCount: number;

  // ── Recomendações ─────────────────────────────────────────────
  recommendations: string[];

  /** Timestamp de geração do relatório */
  generatedAt: string;
  /** Tempo de geração em ms */
  generationMs: number;
}

// ── Relatório de padrão para severidade (mapeamento manual) ──────
// (sem importar o catálogo completo para evitar dependência circular)

const PATTERN_DESCRIPTIONS: Record<string, { description: string; severity: 'critical' | 'high' | 'medium' | 'low' }> = {
  MOOV_NOT_FOUND:    { description: 'Container MP4 corrompido (moov atom ausente)', severity: 'critical' },
  INVALID_DATA:      { description: 'Stream de dados inválido', severity: 'critical' },
  CONVERSION_FAILED: { description: 'Falha terminal de encoding FFmpeg', severity: 'critical' },
  OUT_OF_MEMORY:     { description: 'Sistema sem memória para encoding', severity: 'critical' },
  DTS_OUT_OF_ORDER:  { description: 'Timestamps DTS fora de ordem', severity: 'high' },
  PAST_DURATION_LARGE: { description: 'VBV buffer overflow', severity: 'high' },
  NVENC_ERROR:       { description: 'Falha no encoder GPU NVENC', severity: 'high' },
  PIPE_BROKEN:       { description: 'Pipe de output interrompido', severity: 'high' },
  TRUE_PEAK_EXCEEDED: { description: 'True Peak excede -1 dBTP (EBU R128)', severity: 'high' },
  LUFS_DEVIATION:    { description: 'Desvio LUFS > 1 LU do target', severity: 'high' },
  MEDIACONCH_FAIL:   { description: 'Não conforme com política MediaConch', severity: 'medium' },
  BS1770_PARSE_ERROR: { description: 'BS1770GAIN indisponível ou inválido', severity: 'medium' },
  VFR_DETECTED:      { description: 'Stream com frame rate variável (VFR)', severity: 'medium' },
};

// ── Daily Digest ──────────────────────────────────────────────────

export class NexoraDailyDigest {
  private cronTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Gera o relatório do dia especificado (ou do dia anterior se omitido).
   *
   * @param date - Data do relatório (default: ontem)
   */
  async generate(date?: Date): Promise<DailyDigestReport> {
    const startMs = Date.now();
    const reportDate = date ?? new Date(Date.now() - 86400 * 1000);
    const dateStr = reportDate.toISOString().slice(0, 10);

    // Período: 00:00 - 23:59:59 do dia
    const periodStart = new Date(`${dateStr}T00:00:00.000Z`);
    const periodEnd   = new Date(`${dateStr}T23:59:59.999Z`);

    const log = logger.child({ component: 'DailyDigest', date: dateStr });
    log.info('A gerar Daily Digest...');

    // Recolher dados em paralelo para minimizar latência
    const [
      jobStats,
      assetStats,
      auditErrors,
      queueStats,
    ] = await Promise.all([
      this.fetchJobStats(periodStart, periodEnd),
      this.fetchAssetStats(periodStart, periodEnd),
      this.fetchAuditErrors(periodStart, periodEnd),
      this.fetchQueueStats(),
    ]);

    // Anomalias do detector em memória
    const anomalies = anomalyDetector.getRecentAnomalies(24);

    // Métricas de qualidade dos jobs concluídos
    const qualityMetrics = this.extractQualityMetrics(jobStats.completedJobs);

    // Top erros dos audit logs
    const topErrors = this.buildTopErrors(auditErrors);

    // Recomendações baseadas nos dados
    const recommendations = this.generateRecommendations({
      successRate: jobStats.successRate,
      truePeakViolations: qualityMetrics.truePeakViolations,
      lufsDeviations: qualityMetrics.lufsDeviations,
      anomalyCount: anomalies.length,
      deadLetterCount: queueStats.deadLetterCount,
      avgVmafScore: qualityMetrics.avgVmaf,
    });

    const report: DailyDigestReport = {
      date: dateStr,
      period: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
      },

      totalJobsStarted: jobStats.total,
      totalJobsCompleted: jobStats.completed,
      totalJobsFailed: jobStats.failed,
      successRate: jobStats.successRate,
      retryCount: jobStats.retryCount,

      avgTranscodeSeconds: jobStats.avgDurationSeconds,
      p50TranscodeSeconds: jobStats.p50DurationSeconds,
      p95TranscodeSeconds: jobStats.p95DurationSeconds,

      avgVmafScore: qualityMetrics.avgVmaf,
      avgLufsIntegrated: qualityMetrics.avgLufs,
      truePeakViolations: qualityMetrics.truePeakViolations,
      lufsDeviations: qualityMetrics.lufsDeviations,

      assetsIngested: assetStats.ingested,
      assetsCompleted: assetStats.completed,
      assetsRejected: assetStats.rejected,
      assetsQuarantined: assetStats.quarantined,

      queues: queueStats.queues,
      deadLetterCount: queueStats.deadLetterCount,

      topErrors,
      anomalies,
      anomalyCount: anomalies.length,
      recommendations,

      generatedAt: new Date().toISOString(),
      generationMs: Date.now() - startMs,
    };

    log.info(
      {
        successRate: report.successRate.toFixed(2),
        totalJobs: report.totalJobsStarted,
        anomalies: report.anomalyCount,
        recommendations: report.recommendations.length,
        generationMs: report.generationMs,
      },
      'Daily Digest gerado'
    );

    return report;
  }

  /**
   * Agenda a geração automática do relatório às 06:00 UTC diariamente.
   * Deve ser chamado no startup do worker.
   */
  scheduleDaily(): void {
    // Calcular ms até às 06:00 UTC de amanhã
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setUTCHours(6, 0, 0, 0);
    if (nextRun <= now) nextRun.setUTCDate(nextRun.getUTCDate() + 1);

    const msUntilNextRun = nextRun.getTime() - now.getTime();

    setTimeout(() => {
      // Primeira execução
      void this.generate().catch(err =>
        logger.error({ err }, 'Falha ao gerar Daily Digest agendado')
      );

      // Repetir a cada 24h
      this.cronTimer = setInterval(() => {
        void this.generate().catch(err =>
          logger.error({ err }, 'Falha ao gerar Daily Digest agendado')
        );
      }, 86400 * 1000);
    }, msUntilNextRun);

    logger.info(
      { nextRunAt: nextRun.toISOString(), msUntilNextRun },
      'Daily Digest agendado'
    );
  }

  /**
   * Cancela o cron job agendado.
   */
  cancelSchedule(): void {
    if (this.cronTimer) {
      clearInterval(this.cronTimer);
      this.cronTimer = null;
    }
  }

  // ── Fontes de dados ───────────────────────────────────────────

  private async fetchJobStats(start: Date, end: Date) {
    const [allJobs, completedJobs, failedJobs] = await Promise.all([
      prisma.job.count({ where: { createdAt: { gte: start, lte: end } } }),
      prisma.job.findMany({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: start, lte: end },
        },
        select: { result: true, attempt: true },
      }),
      prisma.job.count({
        where: { status: 'FAILED', updatedAt: { gte: start, lte: end } },
      }),
    ]);

    const total = allJobs;
    const completed = completedJobs.length;
    const failed = failedJobs;
    const successRate = total > 0 ? completed / total : 0;

    // Extrair durações de transcode dos resultados JSON
    const durations: number[] = completedJobs
      .filter(j => j.result && typeof j.result === 'object')
      .map(j => {
        const r = j.result as Record<string, unknown>;
        return typeof r['durationMs'] === 'number' ? r['durationMs'] as number / 1000 : null;
      })
      .filter((d): d is number => d !== null);

    durations.sort((a, b) => a - b);

    const avg = durations.length > 0
      ? durations.reduce((s, v) => s + v, 0) / durations.length
      : 0;
    const p50 = durations[Math.floor(durations.length * 0.5)] ?? 0;
    const p95 = durations[Math.floor(durations.length * 0.95)] ?? 0;

    // Contar retries (attempt > 1)
    const retryCount = completedJobs.filter(j => (j.attempt ?? 0) > 1).length;

    return {
      total,
      completed,
      failed,
      successRate,
      retryCount,
      completedJobs,
      avgDurationSeconds: +avg.toFixed(1),
      p50DurationSeconds: +p50.toFixed(1),
      p95DurationSeconds: +p95.toFixed(1),
    };
  }

  private async fetchAssetStats(start: Date, end: Date) {
    const [ingested, completed, rejected, quarantined] = await Promise.all([
      prisma.asset.count({ where: { createdAt: { gte: start, lte: end } } }),
      prisma.asset.count({ where: { status: 'COMPLETED', updatedAt: { gte: start, lte: end } } }),
      prisma.asset.count({ where: { status: 'QC_REJECTED', updatedAt: { gte: start, lte: end } } }),
      prisma.asset.count({ where: { status: 'QC_QUARANTINED', updatedAt: { gte: start, lte: end } } }),
    ]);
    return { ingested, completed, rejected, quarantined };
  }

  private async fetchAuditErrors(start: Date, end: Date) {
    return prisma.auditLog.findMany({
      where: {
        action: { startsWith: 'QC_REJECT' },
        createdAt: { gte: start, lte: end },
      },
      select: { action: true, metadata: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  private async fetchQueueStats(): Promise<{ queues: QueueSummary[]; deadLetterCount: number }> {
    const allQueues = getNexoraQueues();
    const queueNames = Object.entries(QUEUE_NAMES) as [string, string][];

    const results = await Promise.all(
      queueNames.map(async ([, queueName]) => {
        const queue = allQueues[queueName as keyof typeof allQueues];
        try {
          const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
          return {
            name: queueName,
            waiting: counts.waiting ?? 0,
            active: counts.active ?? 0,
            completed: counts.completed ?? 0,
            failed: counts.failed ?? 0,
            delayed: counts.delayed ?? 0,
          } as QueueSummary;
        } catch {
          return { name: queueName, waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 } as QueueSummary;
        }
      })
    );

    const deadLetterEntry = results.find(q => q.name === QUEUE_NAMES.DEAD_LETTER);
    const deadLetterCount = deadLetterEntry?.waiting ?? 0;

    return {
      queues: results.filter(q => q.name !== QUEUE_NAMES.DEAD_LETTER),
      deadLetterCount,
    };
  }

  // ── Processamento de dados ────────────────────────────────────

  private extractQualityMetrics(completedJobs: Array<{ result: unknown }>) {
    let vmafSum = 0; let vmafCount = 0;
    let lufsSum = 0; let lufsCount = 0;
    let truePeakViolations = 0;
    let lufsDeviations = 0;

    for (const job of completedJobs) {
      const r = job.result as Record<string, unknown> | null;
      if (!r) continue;

      if (typeof r['vmafMean'] === 'number') {
        vmafSum += r['vmafMean'] as number;
        vmafCount++;
      }
      if (typeof r['measuredLufs'] === 'number') {
        const lufs = r['measuredLufs'] as number;
        const target = typeof r['targetLufs'] === 'number' ? r['targetLufs'] as number : -23;
        lufsSum += lufs;
        lufsCount++;
        if (Math.abs(lufs - target) > 1.0) lufsDeviations++;
      }
      if (typeof r['truePeak'] === 'number' && (r['truePeak'] as number) > -1.0) {
        truePeakViolations++;
      }
    }

    return {
      avgVmaf: vmafCount > 0 ? +(vmafSum / vmafCount).toFixed(2) : null,
      avgLufs: lufsCount > 0 ? +(lufsSum / lufsCount).toFixed(2) : null,
      truePeakViolations,
      lufsDeviations,
    };
  }

  private buildTopErrors(
    auditLogs: Array<{ action: string; metadata: unknown; createdAt: Date }>
  ): TopErrorEntry[] {
    const counts = new Map<string, { count: number; lastOccurrence: Date }>();

    for (const log of auditLogs) {
      const meta = log.metadata as Record<string, unknown> | null;
      const patternId = String(meta?.['patternId'] ?? meta?.['reason'] ?? log.action);
      const existing = counts.get(patternId);
      if (!existing || log.createdAt > existing.lastOccurrence) {
        counts.set(patternId, {
          count: (existing?.count ?? 0) + 1,
          lastOccurrence: log.createdAt,
        });
      } else {
        existing.count++;
      }
    }

    return [...counts.entries()]
      .map(([patternId, { count, lastOccurrence }]) => {
        const info = PATTERN_DESCRIPTIONS[patternId] ?? {
          description: patternId,
          severity: 'medium' as const,
        };
        return {
          patternId,
          description: info.description,
          count,
          severity: info.severity,
          lastOccurrence: lastOccurrence.toISOString(),
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private generateRecommendations(data: {
    successRate: number;
    truePeakViolations: number;
    lufsDeviations: number;
    anomalyCount: number;
    deadLetterCount: number;
    avgVmafScore: number | null;
  }): string[] {
    const recs: string[] = [];

    if (data.successRate < 0.90) {
      recs.push(
        `Taxa de sucesso baixa (${(data.successRate * 100).toFixed(1)}% < 90%). ` +
        'Verificar logs dos workers e qualidade dos ficheiros de entrada.'
      );
    }
    if (data.truePeakViolations > 0) {
      recs.push(
        `${data.truePeakViolations} violação(ões) de True Peak detectada(s). ` +
        'Considerar ajustar TP=-2.0 no loudnorm para margem adicional (FIX_TRUE_PEAK_AGGRESSIVE).'
      );
    }
    if (data.lufsDeviations > 0) {
      recs.push(
        `${data.lufsDeviations} desvio(s) LUFS > 1 LU. ` +
        'Verificar se BS1770GAIN está instalado e a devolver resultados correctos (ADR-009).'
      );
    }
    if (data.anomalyCount > 5) {
      recs.push(
        `${data.anomalyCount} anomalias estatísticas detectadas. ` +
        'Verificar NexoraAnomalyDetector.getRecentAnomalies() para detalhe.'
      );
    }
    if (data.deadLetterCount > 0) {
      recs.push(
        `${data.deadLetterCount} job(s) na dead-letter queue. ` +
        'Analisar e re-processar manualmente via painel BullMQ.'
      );
    }
    if (data.avgVmafScore !== null && data.avgVmafScore < 85) {
      recs.push(
        `Score VMAF médio baixo (${data.avgVmafScore} < 85). ` +
        'Verificar parâmetros de bitrate e encoding nos perfis afectados.'
      );
    }
    if (recs.length === 0) {
      recs.push('Pipeline operacional dentro dos parâmetros normais. Sem acções recomendadas.');
    }

    return recs;
  }
}

// ── Singleton ─────────────────────────────────────────────────────

export const dailyDigest = new NexoraDailyDigest();
