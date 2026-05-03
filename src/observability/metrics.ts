// Nexora Media Processing — Métricas Prometheus
// Ficheiro: src/observability/metrics.ts
//
// Expõe endpoint /metrics para scraping pelo Prometheus.
// Servidor Fastify separado na porta PROMETHEUS_PORT.

import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';
import Fastify from 'fastify';

// Registry dedicado para métricas Nexora
export const nexoraRegistry = new Registry();

// Recolher métricas padrão do Node.js (CPU, memória, event loop)
collectDefaultMetrics({ register: nexoraRegistry, prefix: 'nexora_node_' });

// ── Contadores ─────────────────────────────────────────────────

export const assetsIngested = new Counter({
  name: 'nexora_assets_ingested_total',
  help: 'Total de assets recebidos pelo sistema',
  registers: [nexoraRegistry],
});

export const assetsRejected = new Counter({
  name: 'nexora_assets_rejected_total',
  help: 'Total de assets rejeitados no QC',
  labelNames: ['reason'] as const,
  registers: [nexoraRegistry],
});

export const ffmpegTimeouts = new Counter({
  name: 'nexora_ffmpeg_timeout_total',
  help: 'Total de timeouts do FFmpeg',
  registers: [nexoraRegistry],
});

export const vmafFailures = new Counter({
  name: 'nexora_vmaf_failures_total',
  help: 'Total de outputs rejeitados por VMAF abaixo do threshold',
  labelNames: ['profile'] as const,
  registers: [nexoraRegistry],
});

export const gpuDetectionTotal = new Counter({
  name: 'nexora_gpu_detection_total',
  help: 'Total de detecções GPU executadas',
  labelNames: ['result'] as const,
  registers: [nexoraRegistry],
});

// ── Histogramas ────────────────────────────────────────────────

export const transcodeDuration = new Histogram({
  name: 'nexora_transcode_duration_seconds',
  help: 'Duração do transcode em segundos',
  labelNames: ['profile'] as const,
  buckets: [30, 120, 600, 1800, 3600, 14400],
  registers: [nexoraRegistry],
});

export const vmafScore = new Histogram({
  name: 'nexora_vmaf_score',
  help: 'Distribuição dos scores VMAF',
  labelNames: ['profile'] as const,
  buckets: [60, 70, 75, 80, 85, 90, 93, 95, 98, 100],
  registers: [nexoraRegistry],
});

export const loudnessLufs = new Histogram({
  name: 'nexora_loudness_lufs',
  help: 'Distribuição de LUFS integrado',
  buckets: [-30, -25, -23, -20, -16, -14, -10],
  registers: [nexoraRegistry],
});

export const uploadDuration = new Histogram({
  name: 'nexora_upload_duration_seconds',
  help: 'Duração de uploads para storage',
  labelNames: ['destination'] as const,
  buckets: [1, 5, 15, 30, 60, 120, 300],
  registers: [nexoraRegistry],
});

// ── Gauges ─────────────────────────────────────────────────────

export const queueDepth = new Gauge({
  name: 'nexora_queue_depth',
  help: 'Número de jobs na fila por tipo de worker',
  labelNames: ['worker_type'] as const,
  registers: [nexoraRegistry],
});

export const jobSuccessRate = new Gauge({
  name: 'nexora_job_success_rate',
  help: 'Taxa de sucesso de jobs nos últimos 5 minutos',
  registers: [nexoraRegistry],
});

export const gpuAvailable = new Gauge({
  name: 'nexora_gpu_available',
  help: '1 se GPU disponível para encoding, 0 se apenas CPU',
  labelNames: ['gpu_type'] as const,
  registers: [nexoraRegistry],
});

export const schedulerSlotsUsed = new Gauge({
  name: 'nexora_scheduler_slots_used',
  help: 'Número de slots de encoding actualmente em uso',
  labelNames: ['job_type'] as const,
  registers: [nexoraRegistry],
});

// ── Métricas de Diagnóstico (Prompt 4) ───────────────────────────

export const diagnosticPatternsDetected = new Counter({
  name: 'nexora_diagnostic_patterns_total',
  help: 'Total de padrões de erro detectados pelo motor de diagnóstico',
  labelNames: ['pattern_id', 'severity'] as const,
  registers: [nexoraRegistry],
});

export const diagnosticRetriesAdvised = new Counter({
  name: 'nexora_diagnostic_retries_advised_total',
  help: 'Total de retries aconselhados pelo NexoraRetryAdvisor',
  labelNames: ['pattern_id'] as const,
  registers: [nexoraRegistry],
});

export const anomaliesDetected = new Counter({
  name: 'nexora_anomalies_detected_total',
  help: 'Total de anomalias estatísticas detectadas pelo NexoraAnomalyDetector',
  labelNames: ['metric', 'severity'] as const,
  registers: [nexoraRegistry],
});

export const fixSuggestionsApplied = new Counter({
  name: 'nexora_fix_suggestions_applied_total',
  help: 'Total de sugestões de correcção aplicadas automaticamente',
  labelNames: ['fix_id'] as const,
  registers: [nexoraRegistry],
});

// ── Métricas de Adaptadores (Prompt 9) ───────────────────────────

export const toolAvailable = new Gauge({
  name: 'nexora_tool_available',
  help: '1 se ferramenta externa disponível, 0 se ausente',
  labelNames: ['tool_name'] as const,
  registers: [nexoraRegistry],
});

export const mediaconchValidations = new Counter({
  name: 'nexora_mediaconch_validations_total',
  help: 'Total de validações MediaConch executadas',
  labelNames: ['policy', 'outcome'] as const,
  registers: [nexoraRegistry],
});

export const bs1770gainMeasurements = new Counter({
  name: 'nexora_bs1770gain_measurements_total',
  help: 'Total de medições BS1770GAIN executadas',
  registers: [nexoraRegistry],
});

export const bs1770gainDuration = new Histogram({
  name: 'nexora_bs1770gain_duration_seconds',
  help: 'Duração da medição BS1770GAIN em segundos',
  buckets: [1, 5, 15, 30, 60, 120],
  registers: [nexoraRegistry],
});

export const handbrakeJobs = new Counter({
  name: 'nexora_handbrake_jobs_total',
  help: 'Total de jobs HandBrakeCLI executados',
  labelNames: ['preset'] as const,
  registers: [nexoraRegistry],
});

export const subtitlesProcessed = new Counter({
  name: 'nexora_subtitles_processed_total',
  help: 'Total de ficheiros de legendas processados',
  labelNames: ['format_in', 'format_out'] as const,
  registers: [nexoraRegistry],
});

// ── Servidor de métricas (porta separada) ──────────────────────

export const metricsServer = {
  async start(port: number): Promise<void> {
    const app = Fastify({ logger: false });

    app.get('/metrics', async (_, reply) => {
      void reply.header('Content-Type', nexoraRegistry.contentType);
      const metrics = await nexoraRegistry.metrics();
      return metrics;
    });

    app.get('/health', async () => ({ status: 'ok' }));

    await app.listen({ port, host: '0.0.0.0' });
  },
};
