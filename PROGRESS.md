# Nexora Media Processing — Estado do Projecto

> **⚠️ LEITURA OBRIGATÓRIA PARA TODOS OS AGENTES IA**
> Este ficheiro deve ser lido ANTES de qualquer trabalho e actualizado no FIM de cada sessão.

---

## 📋 Identidade

| Campo | Valor |
|---|---|
| **Nome** | Nexora Media Processing |
| **Versão** | 0.1.0 |
| **IDE** | Google Antigravity |
| **Stack** | Node.js 20 + TypeScript + Fastify + BullMQ + Redis + PostgreSQL + MinIO |
| **Frontend** | Next.js 14 + React + Tailwind CSS |
| **Orquestração** | Temporal.io |
| **Media tools** | FFmpeg · HandBrakeCLI · MediaInfo · FFprobe · MediaConch · BS1770GAIN |

---

## ✅ O que está concluído

- [x] Setup do ambiente (nexora-setup.sh executado)
- [x] Scaffold do projecto (nexora-scaffold.js executado)
- [x] PROGRESS.md criado
- [x] .antigravity/rules.md criado
- [x] Repositório GitHub configurado
- [x] **Prompt 1 executado — Backend Core (Antigravity, 2026-05-02)**
- [x] **Prompt 5 executado — FFmpeg Avançado + Performance (Antigravity, 2026-05-02)**
- [x] **Prompt 2 executado — Temporal.io Workflows + API REST Completa (Antigravity, 2026-05-02)**
- [x] **Prompt 6 executado — DevOps / Infrastructure (Antigravity, 2026-05-02)**
- [x] **Prompt 3 executado — Frontend Dashboard (Antigravity, 2026-05-03)**
- [x] **Prompt 4 executado — Diagnóstico / Logs / Debug (Antigravity, 2026-05-03)**
- [ ] Prompt 7 executado (Segurança — Claude)
- [ ] Prompt 8 executado (Testes — Claude)
- [ ] Prompt 9 executado (Open Source adapters — Claude)
- [ ] Prompt 10 executado (Integração final — Claude)

---

## 🔄 Em progresso agora

```
Data: 2026-05-03
Agente: Antigravity (Claude Sonnet)
A trabalhar em: Prompt 4 — Motor de Diagnóstico (Concluído)
Bloqueios: Nenhum
```

---

## 📁 Ficheiros implementados no Prompt 1

```
prisma/
  schema.prisma              ✅ 6 modelos + 5 enums + migração aplicada
  migrations/
    20260502190306_init/
    20260502201157_backend_core_prompt1/

secrets/
  jwt_private.pem            ✅ RSA 4096-bit gerada (Node.js crypto)
  jwt_public.pem             ✅ RSA 4096-bit gerada

src/
  db/
    prisma.ts                ✅ Singleton + lifecycle + Pino logging
  common/
    errors.ts                ✅ Hierarquia NexoraError + 8 sub-classes
    minio.ts                 ✅ Singleton + bucket init + stream helpers
    redis.ts                 ✅ Dual singleton (general + pub/sub) + progress publisher
  observability/
    logger.ts                ✅ Pino estruturado (JSON prod / pretty dev)
    metrics.ts               ✅ Prometheus: counters, histogramas, gauges + servidor
  workers/
    queues.ts                ✅ 6 filas + dead-letter + retry exp. + enqueue helpers
    ingest.worker.ts         ✅ SHA-256 stream, MediaInfo, MinIO upload, QC enqueue
    qc.worker.ts             ✅ FFprobe, motor regras QC, routing PASS/QUARANTINE/REJECT
    transcode.worker.ts      ✅ 4 perfis, spawn ADR-002, progresso Redis pub/sub
    audio.worker.ts          ✅ Two-pass EBU R128, BS1770GAIN, retry ±0.5 LU
  api/
    plugins.ts               ✅ CORS, multipart, rateLimit, Swagger, auth, audit, erros
    routes/
      index.ts               ✅ Prefixo /api/v1
      assets.ts              ✅ Upload, list, get, soft delete + audit
      jobs.ts                ✅ Create, list, get, cancel (BullMQ + DB)
    middleware/
      auth.ts                ✅ JWT RS256 (jose), hook onRequest, generateToken
      rateLimiter.ts         ✅ Redis-backed, 100 req/min, X-RateLimit headers
      audit.ts               ✅ AuditLog append-only, hook onResponse
  index.ts                   ✅ Startup sequencial + graceful shutdown
  worker.ts                  ✅ Tool check + 4 workers + graceful shutdown
```

---

## 📁 Ficheiros implementados no Prompt 5

```
src/pipeline/ffmpeg/
  builder.ts                 ✅ NexoraFFmpegCommandBuilder — 8 comandos (4 perfis x GPU+CPU)
                                ADR-002: string[] tipado, nunca string concatenada
                                ADR-004: yuv420p forcado em todos os perfis
                                ADR-006: Closed GOP, 0 B-frames broadcast, force-cfr=1
                                Colorspace BT.709 obrigatorio
  gpu-detector.ts            ✅ NexoraGPUDetector — deteccao NVIDIA/Intel/AMD
                                nvidia-smi + vainfo + encode test 5 frames
                                Cache Redis TTL 30 minutos
                                Fallback automatico para CPU se GPU falhar
  loudness.ts                ✅ NexoraLoudnessNormalizer — two-pass EBU R128
                                ADR-005: Pass 1 (analise) + Pass 2 (linear)
                                ADR-009: BS1770GAIN verificacao definitiva
                                Retry inteligente +-0.5 LU, max 3 tentativas
                                Fallback FFmpeg se BS1770GAIN nao instalado
  vmaf.ts                    ✅ NexoraVMAFScorer — scoring libvmaf via FFmpeg
                                ADR-010: score guardado para todos os outputs
                                Thresholds: archive>=93, broadcast>=90, streaming>=85, proxy>=70
                                1st percentile como floor de qualidade
                                Suporta JSON v2 (pooled_metrics) e v3 (VMAF.aggregate)
  scheduler.ts               ✅ NexoraJobScheduler — semaforos Redis
                                GPU: max 2 simultaneos (VRAM)
                                CPU broadcast: cores/4 | OTT/web: cores/2 | proxy: sem limite
                                SETNX atomico + TTL 4h (anti-deadlock se worker crashar)

src/workers/
  queues.ts                  ✅ HOTFIX: filas renomeadas nexora:* -> nexora-* (BullMQ)
  transcode.worker.ts        ✅ Refactored — delega a builder + GPU + VMAF + scheduler
                                GPU->CPU fallback automatico em caso de erro
  audio.worker.ts            ✅ Refactored — thin wrapper sobre NexoraLoudnessNormalizer

src/observability/
  metrics.ts                 ✅ +4 metricas: vmaf_failures_total, gpu_detection_total,
                                gpu_available (gauge), scheduler_slots_used (gauge)

config/handbrake/
  nexora-presets.json        ✅ 4 presets HandBrakeCLI:
                                Nexora Broadcast HD (8Mbps, PCM, Closed GOP, 0 B-frames)
                                Nexora OTT HD (5Mbps, AAC 192k, 2-pass)
                                Nexora Web SD (2Mbps, 720p, AAC 128k)
                                Nexora Proxy (800kbps, 480p, fast preset)
```

---

## ⚠️ Problemas conhecidos

| Data | Problema | Estado |
|---|---|---|
| 2026-05-02 | `openssl` nao disponivel no PATH do Windows | Resolvido — chaves RSA geradas com Node.js crypto |
| 2026-05-02 | Ficheiros stub com nome errado nao sao importaveis | Resolvido — criados ficheiros com nomes correctos |
| 2026-05-02 | BullMQ rejeita nomes de fila com `:` | Resolvido — filas renomeadas de `nexora:*` para `nexora-*` |

---

## 🏗️ ADRs Imutáveis

| ADR | Decisão |
|---|---|
| ADR-001 | Temporal.io para orquestração (não BullMQ standalone) |
| ADR-002 | FFmpeg via execFile/spawn (NUNCA exec() com string) |
| ADR-003 | SHA-256 para checksums (MD5 proibido) |
| ADR-004 | yuv420p obrigatório em outputs de distribuição |
| ADR-005 | Two-pass EBU R128 + BS1770GAIN verificação independente |
| ADR-006 | Closed GOP + IDR frames em todos os outputs broadcast |
| ADR-007 | Audit trail append-only (UPDATE/DELETE proibidos) |
| ADR-008 | RS256 JWT com rotação (HS256 proibido em produção) |
| ADR-009 | BS1770GAIN para verificação independente de loudness |
| ADR-010 | VMAF score calculado e guardado para todos os outputs |

---

## 📅 Histórico

| Data | Feito | Agente | Ficheiros |
|---|---|---|---|
| 2026-05-02 | Ficheiros de config criados | nexora-deploy-docs.js | PROGRESS.md, rules.md, ADRs |
| 2026-05-02 | **Prompt 1 — Backend Core completo** | Antigravity (Gemini) | 18 ficheiros novos, migração DB aplicada, 0 erros TS |
| 2026-05-02 | **Prompt 5 — FFmpeg Avançado + Performance** | Antigravity (Claude Sonnet) | 8 ficheiros novos, 4 refactored, 0 erros TS, 0 erros lint |

---

## 📁 Ficheiros implementados no Prompt 6

```
Dockerfile.worker              ✅ Multi-stage bookworm-slim: FFmpeg 6.x + BS1770GAIN + MediaInfo
docker-compose.yml             ✅ +3 serviços: node-exporter, cAdvisor, Alertmanager
                                  health conditions em depends_on
                                  secrets volume mount

config/prometheus/
  prometheus.yml               ✅ scrape 10s, 6 jobs (API, worker, postgres, redis, node-exporter, cadvisor)
  alerts.yml                   ✅ 9 alertas: pipeline + qualidade + infraestrutura

config/alertmanager/
  alertmanager.yml             ✅ Routing por severidade, 3 receivers, inhibit rules

config/grafana/provisioning/dashboards/
  nexora-overview.json         ✅ 8 painéis: jobs/min, success rate, queue depth, avg transcode
  nexora-quality.json          ✅ 6 painéis: VMAF P50/P1, rejection rate, loudness LUFS
  nexora-infra.json            ✅ 6 painéis: CPU/RAM/disco por container, rede I/O, event loop

.github/workflows/
  test.yml                     ✅ prisma generate, cache npm, coverage fix, integration tests
  build.yml                    ✅ build ambas imagens (nexora-api + nexora-worker), OCI labels
  deploy-staging.yml           ✅ retry 3x, worker health check, logs em caso de falha

scripts/
  healthcheck.sh               ✅ 8 serviços, --json / --quiet flags, exit code 0/1
```

---

## 📁 Ficheiros implementados no Prompt 4

```
src/observability/
  log-parser.ts              ✅ NexoraLogParser — parser unificado 5 ferramentas
                                FFmpeg stderr (progresso, erros, metadata)
                                MediaInfo JSON (streams, VFR detection)
                                MediaConch XML (regras pass/fail)
                                BullMQ events (failed, stalled, retrying)
                                BS1770GAIN XML (LUFS, True Peak, LRA + warnings)
  pattern-matcher.ts         ✅ NexoraPatternMatcher — catálogo 16 padrões
                                CRÍTICOS: MOOV_NOT_FOUND, INVALID_DATA, CONVERSION_FAILED, OUT_OF_MEMORY
                                ALTO: DTS_OUT_OF_ORDER, PAST_DURATION_LARGE, NVENC_ERROR, PIPE_BROKEN
                                ÁUDIO: TRUE_PEAK_EXCEEDED, LUFS_DEVIATION, BS1770_PARSE_ERROR
                                MÉDIO: MEDIACONCH_FAIL, VFR_DETECTED, MEDIAINFO_NO_TRACKS
                                QUEUE: BULLMQ_JOB_STALLED, BULLMQ_JOB_FAILED
  fix-suggester.ts           ✅ NexoraFixSuggester — 9 correcções mapeadas
                                FIX_IGNDTS, FIX_VBV_BUFFER, FIX_FORCE_CFR
                                FIX_CPU_FALLBACK, FIX_REDUCE_THREADS, FIX_INCREASE_TIMEOUT
                                FIX_TRUE_PEAK_AGGRESSIVE, FIX_LUFS_OFFSET, FIX_FFMPEG_LOUDNESS_FALLBACK
  retry-advisor.ts           ✅ NexoraRetryAdvisor — limites por padrão, backoff progressivo
                                Regras: crítico-terminal→DLQ, GPU→CPU fallback, DTS→igndts
                                Timeout duplicado por tentativa (×1.5)
  anomaly-detector.ts        ✅ NexoraAnomalyDetector — z-score com algoritmo Welford
                                6 métricas: transcode_duration, vmaf_score, lufs, true_peak, error_rate, queue_depth
                                Ring buffer 100 valores | warning z>2.5 | critical z>3.5
  diagnostic-engine.ts       ✅ NexoraDiagnosticEngine — orquestrador central
                                Hook onJobFailed() para TranscodeWorker
                                Hook onAudioFailed() para AudioWorker
                                Loga resultados via Pino + incrementa Prometheus
  daily-digest.ts            ✅ NexoraDailyDigest — relatório agregado 24h
                                Fontes: Prisma (jobs/assets/audit) + BullMQ + AnomalyDetector
                                Recomendações automáticas + cron às 06:00 UTC

src/observability/metrics.ts ✅ +4 contadores Prometheus:
                                nexora_diagnostic_patterns_total (label: pattern_id, severity)
                                nexora_diagnostic_retries_advised_total (label: pattern_id)
                                nexora_anomalies_detected_total (label: metric, severity)
                                nexora_fix_suggestions_applied_total (label: fix_id)

src/workers/
  transcode.worker.ts        ✅ Hook diagnosticEngine.onJobFailed() em on('failed')
                                lastStderr Map<jobId, string> para captura de stderr
                                fixSuggestionsApplied.inc() por fix detectado
  audio.worker.ts            ✅ Hook diagnosticEngine.onAudioFailed() em on('failed')
                                fixSuggestionsApplied.inc() por fix detectado
```

---

## 🎯 Próximos passos

1. **Prompt 7** — Segurança (rate limiting avançado, autenticação OAuth2, secrets rotation)
2. **Prompt 8** — Testes (unit tests, integration tests, E2E com Playwright)
3. **Prompt 9** — Open Source adapters

---

*Última actualização: 2026-05-03 — Prompt 4 (Diagnóstico / Logs / Debug) concluído — 7 ficheiros novos, 3 modificados, 4 métricas Prometheus novas*
