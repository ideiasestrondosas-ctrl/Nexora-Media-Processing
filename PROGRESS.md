# Nexora Media Processing â€” Estado do Projecto

> **âš ï¸ LEITURA OBRIGATÃ“RIA PARA TODOS OS AGENTES IA**
> Este ficheiro deve ser lido ANTES de qualquer trabalho e actualizado no FIM de cada sessÃ£o.

---

## ðŸ“‹ Identidade

| Campo | Valor |
|---|---|
| **Nome** | Nexora Media Processing |
| **VersÃ£o** | 1.0.1 |
| **IDE** | Google Antigravity |
| **Stack** | Node.js 20 + TypeScript + Fastify + BullMQ + Redis + PostgreSQL + MinIO |
| **Frontend** | Next.js 14 + React + Tailwind CSS |
| **OrquestraÃ§Ã£o** | Temporal.io |
| **Media tools** | FFmpeg Â· HandBrakeCLI Â· MediaInfo Â· FFprobe Â· MediaConch Â· BS1770GAIN |

---

## âœ… O que estÃ¡ concluÃ­do

- [x] Setup do ambiente (nexora-setup.sh executado)
- [x] Scaffold do projecto (nexora-scaffold.js executado)
- [x] PROGRESS.md criado
- [x] .antigravity/rules.md criado
- [x] RepositÃ³rio GitHub configurado
- [x] **Prompt 1 executado â€” Backend Core (Antigravity, 2026-05-02)**
- [x] **Prompt 5 executado â€” FFmpeg AvanÃ§ado + Performance (Antigravity, 2026-05-02)**
- [x] **Prompt 2 executado â€” Temporal.io Workflows + API REST Completa (Antigravity, 2026-05-02)**
- [x] **Prompt 6 executado â€” DevOps / Infrastructure (Antigravity, 2026-05-02)**
- [x] **Prompt 3 executado â€” Frontend Dashboard (Antigravity, 2026-05-03)**
- [x] **Prompt 4 executado â€” DiagnÃ³stico / Logs / Debug (Antigravity, 2026-05-03)**
- [x] **Prompt 7 executado â€” SeguranÃ§a (Antigravity, 2026-05-03)**
- [x] **Prompt 8 executado â€” Testes da Suite Nexora (Antigravity, 2026-05-03)**
- [x] **Prompt 9 executado â€” Open Source Adapters (Antigravity, 2026-05-03)**
- [x] **Prompt 10 executado â€” IntegraÃ§Ã£o Final (Antigravity, 2026-05-03)**

---

## 🔄 Em progresso agora

```
Data: 2026-05-05
Agente: Antigravity (Gemini)
Estado: 🔄 Planeamento da Migração Desktop & Sincronização GitHub
Fase Actual: Fase 0 (Arquitectura) e Sincronização de Tarefas no GitHub
Bloqueios: Nenhum
```

---

## ðŸ“ Ficheiros implementados no Prompt 1

```
prisma/
  schema.prisma              âœ… 6 modelos + 5 enums + migraÃ§Ã£o aplicada
  migrations/
    20260502190306_init/
    20260502201157_backend_core_prompt1/

secrets/
  jwt_private.pem            âœ… RSA 4096-bit gerada (Node.js crypto)
  jwt_public.pem             âœ… RSA 4096-bit gerada

src/
  db/
    prisma.ts                âœ… Singleton + lifecycle + Pino logging
  common/
    errors.ts                âœ… Hierarquia NexoraError + 8 sub-classes
    minio.ts                 âœ… Singleton + bucket init + stream helpers
    redis.ts                 âœ… Dual singleton (general + pub/sub) + progress publisher
  observability/
    logger.ts                âœ… Pino estruturado (JSON prod / pretty dev)
    metrics.ts               âœ… Prometheus: counters, histogramas, gauges + servidor
  workers/
    queues.ts                âœ… 6 filas + dead-letter + retry exp. + enqueue helpers
    ingest.worker.ts         âœ… SHA-256 stream, MediaInfo, MinIO upload, QC enqueue
    qc.worker.ts             âœ… FFprobe, motor regras QC, routing PASS/QUARANTINE/REJECT
    transcode.worker.ts      âœ… 4 perfis, spawn ADR-002, progresso Redis pub/sub
    audio.worker.ts          âœ… Two-pass EBU R128, BS1770GAIN, retry Â±0.5 LU
  api/
    plugins.ts               âœ… CORS, multipart, rateLimit, Swagger, auth, audit, erros
    routes/
      index.ts               âœ… Prefixo /api/v1
      assets.ts              âœ… Upload, list, get, soft delete + audit
      jobs.ts                âœ… Create, list, get, cancel (BullMQ + DB)
    middleware/
      auth.ts                âœ… JWT RS256 (jose), hook onRequest, generateToken
      rateLimiter.ts         âœ… Redis-backed, 100 req/min, X-RateLimit headers
      audit.ts               âœ… AuditLog append-only, hook onResponse
  index.ts                   âœ… Startup sequencial + graceful shutdown
  worker.ts                  âœ… Tool check + 4 workers + graceful shutdown
```

---

## ðŸ“ Ficheiros implementados no Prompt 5

```
src/pipeline/ffmpeg/
  builder.ts                 âœ… NexoraFFmpegCommandBuilder â€” 8 comandos (4 perfis x GPU+CPU)
                                ADR-002: string[] tipado, nunca string concatenada
                                ADR-004: yuv420p forcado em todos os perfis
                                ADR-006: Closed GOP, 0 B-frames broadcast, force-cfr=1
                                Colorspace BT.709 obrigatorio
  gpu-detector.ts            âœ… NexoraGPUDetector â€” deteccao NVIDIA/Intel/AMD
                                nvidia-smi + vainfo + encode test 5 frames
                                Cache Redis TTL 30 minutos
                                Fallback automatico para CPU se GPU falhar
  loudness.ts                âœ… NexoraLoudnessNormalizer â€” two-pass EBU R128
                                ADR-005: Pass 1 (analise) + Pass 2 (linear)
                                ADR-009: BS1770GAIN verificacao definitiva
                                Retry inteligente +-0.5 LU, max 3 tentativas
                                Fallback FFmpeg se BS1770GAIN nao instalado
  vmaf.ts                    âœ… NexoraVMAFScorer â€” scoring libvmaf via FFmpeg
                                ADR-010: score guardado para todos os outputs
                                Thresholds: archive>=93, broadcast>=90, streaming>=85, proxy>=70
                                1st percentile como floor de qualidade
                                Suporta JSON v2 (pooled_metrics) e v3 (VMAF.aggregate)
  scheduler.ts               âœ… NexoraJobScheduler â€” semaforos Redis
                                GPU: max 2 simultaneos (VRAM)
                                CPU broadcast: cores/4 | OTT/web: cores/2 | proxy: sem limite
                                SETNX atomico + TTL 4h (anti-deadlock se worker crashar)

src/workers/
  queues.ts                  âœ… HOTFIX: filas renomeadas nexora:* -> nexora-* (BullMQ)
  transcode.worker.ts        âœ… Refactored â€” delega a builder + GPU + VMAF + scheduler
                                GPU->CPU fallback automatico em caso de erro
  audio.worker.ts            âœ… Refactored â€” thin wrapper sobre NexoraLoudnessNormalizer

src/observability/
  metrics.ts                 âœ… +4 metricas: vmaf_failures_total, gpu_detection_total,
                                gpu_available (gauge), scheduler_slots_used (gauge)

config/handbrake/
  nexora-presets.json        âœ… 4 presets HandBrakeCLI:
                                Nexora Broadcast HD (8Mbps, PCM, Closed GOP, 0 B-frames)
                                Nexora OTT HD (5Mbps, AAC 192k, 2-pass)
                                Nexora Web SD (2Mbps, 720p, AAC 128k)
                                Nexora Proxy (800kbps, 480p, fast preset)
```

---

## âš ï¸ Problemas conhecidos

| Data | Problema | Estado |
|---|---|---|
| 2026-05-02 | `openssl` nao disponivel no PATH do Windows | Resolvido â€” chaves RSA geradas com Node.js crypto |
| 2026-05-02 | Ficheiros stub com nome errado nao sao importaveis | Resolvido â€” criados ficheiros com nomes correctos |
| 2026-05-02 | BullMQ rejeita nomes de fila com `:` | Resolvido â€” filas renomeadas de `nexora:*` para `nexora-*` |

---

## ðŸ—ï¸ ADRs ImutÃ¡veis

| ADR | DecisÃ£o |
|---|---|
| ADR-001 | Temporal.io para orquestraÃ§Ã£o (nÃ£o BullMQ standalone) |
| ADR-002 | FFmpeg via execFile/spawn (NUNCA exec() com string) |
| ADR-003 | SHA-256 para checksums (MD5 proibido) |
| ADR-004 | yuv420p obrigatÃ³rio em outputs de distribuiÃ§Ã£o |
| ADR-005 | Two-pass EBU R128 + BS1770GAIN verificaÃ§Ã£o independente |
| ADR-006 | Closed GOP + IDR frames em todos os outputs broadcast |
| ADR-007 | Audit trail append-only (UPDATE/DELETE proibidos) |
| ADR-008 | RS256 JWT com rotaÃ§Ã£o (HS256 proibido em produÃ§Ã£o) |
| ADR-009 | BS1770GAIN para verificaÃ§Ã£o independente de loudness |
| ADR-010 | VMAF score calculado e guardado para todos os outputs |

---

## ðŸ“… HistÃ³rico

| Data | Feito | Agente | Ficheiros |
|---|---|---|---|
| 2026-05-02 | Ficheiros de config criados | nexora-deploy-docs.js | PROGRESS.md, rules.md, ADRs |
| 2026-05-02 | **Prompt 1 â€” Backend Core completo** | Antigravity (Gemini) | 18 ficheiros novos, migraÃ§Ã£o DB aplicada, 0 erros TS |
| 2026-05-02 | **Prompt 5 â€” FFmpeg AvanÃ§ado + Performance** | Antigravity (Claude Sonnet) | 8 ficheiros novos, 4 refactored, 0 erros TS, 0 erros lint |

---

## ðŸ“ Ficheiros implementados no Prompt 6

```
Dockerfile.worker              âœ… Multi-stage bookworm-slim: FFmpeg 6.x + BS1770GAIN + MediaInfo
docker-compose.yml             âœ… +3 serviÃ§os: node-exporter, cAdvisor, Alertmanager
                                  health conditions em depends_on
                                  secrets volume mount

config/prometheus/
  prometheus.yml               âœ… scrape 10s, 6 jobs (API, worker, postgres, redis, node-exporter, cadvisor)
  alerts.yml                   âœ… 9 alertas: pipeline + qualidade + infraestrutura

config/alertmanager/
  alertmanager.yml             âœ… Routing por severidade, 3 receivers, inhibit rules

config/grafana/provisioning/dashboards/
  nexora-overview.json         âœ… 8 painÃ©is: jobs/min, success rate, queue depth, avg transcode
  nexora-quality.json          âœ… 6 painÃ©is: VMAF P50/P1, rejection rate, loudness LUFS
  nexora-infra.json            âœ… 6 painÃ©is: CPU/RAM/disco por container, rede I/O, event loop

.github/workflows/
  test.yml                     âœ… prisma generate, cache npm, coverage fix, integration tests
  build.yml                    âœ… build ambas imagens (nexora-api + nexora-worker), OCI labels
  deploy-staging.yml           âœ… retry 3x, worker health check, logs em caso de falha

scripts/
  healthcheck.sh               âœ… 8 serviÃ§os, --json / --quiet flags, exit code 0/1
```

---

## ðŸ“ Ficheiros implementados no Prompt 4

```
src/observability/
  log-parser.ts              âœ… NexoraLogParser â€” parser unificado 5 ferramentas
                                FFmpeg stderr (progresso, erros, metadata)
                                MediaInfo JSON (streams, VFR detection)
                                MediaConch XML (regras pass/fail)
                                BullMQ events (failed, stalled, retrying)
                                BS1770GAIN XML (LUFS, True Peak, LRA + warnings)
  pattern-matcher.ts         âœ… NexoraPatternMatcher â€” catÃ¡logo 16 padrÃµes
                                CRÃTICOS: MOOV_NOT_FOUND, INVALID_DATA, CONVERSION_FAILED, OUT_OF_MEMORY
                                ALTO: DTS_OUT_OF_ORDER, PAST_DURATION_LARGE, NVENC_ERROR, PIPE_BROKEN
                                ÃUDIO: TRUE_PEAK_EXCEEDED, LUFS_DEVIATION, BS1770_PARSE_ERROR
                                MÃ‰DIO: MEDIACONCH_FAIL, VFR_DETECTED, MEDIAINFO_NO_TRACKS
                                QUEUE: BULLMQ_JOB_STALLED, BULLMQ_JOB_FAILED
  fix-suggester.ts           âœ… NexoraFixSuggester â€” 9 correcÃ§Ãµes mapeadas
                                FIX_IGNDTS, FIX_VBV_BUFFER, FIX_FORCE_CFR
                                FIX_CPU_FALLBACK, FIX_REDUCE_THREADS, FIX_INCREASE_TIMEOUT
                                FIX_TRUE_PEAK_AGGRESSIVE, FIX_LUFS_OFFSET, FIX_FFMPEG_LOUDNESS_FALLBACK
  retry-advisor.ts           âœ… NexoraRetryAdvisor â€” limites por padrÃ£o, backoff progressivo
                                Regras: crÃ­tico-terminalâ†’DLQ, GPUâ†’CPU fallback, DTSâ†’igndts
                                Timeout duplicado por tentativa (Ã—1.5)
  anomaly-detector.ts        âœ… NexoraAnomalyDetector â€” z-score com algoritmo Welford
                                6 mÃ©tricas: transcode_duration, vmaf_score, lufs, true_peak, error_rate, queue_depth
                                Ring buffer 100 valores | warning z>2.5 | critical z>3.5
  diagnostic-engine.ts       âœ… NexoraDiagnosticEngine â€” orquestrador central
                                Hook onJobFailed() para TranscodeWorker
                                Hook onAudioFailed() para AudioWorker
                                Loga resultados via Pino + incrementa Prometheus
  daily-digest.ts            âœ… NexoraDailyDigest â€” relatÃ³rio agregado 24h
                                Fontes: Prisma (jobs/assets/audit) + BullMQ + AnomalyDetector
                                RecomendaÃ§Ãµes automÃ¡ticas + cron Ã s 06:00 UTC

src/observability/metrics.ts âœ… +4 contadores Prometheus:
                                nexora_diagnostic_patterns_total (label: pattern_id, severity)
                                nexora_diagnostic_retries_advised_total (label: pattern_id)
                                nexora_anomalies_detected_total (label: metric, severity)
                                nexora_fix_suggestions_applied_total (label: fix_id)

src/workers/
  transcode.worker.ts        âœ… Hook diagnosticEngine.onJobFailed() em on('failed')
                                lastStderr Map<jobId, string> para captura de stderr
                                fixSuggestionsApplied.inc() por fix detectado
  audio.worker.ts            âœ… Hook diagnosticEngine.onAudioFailed() em on('failed')
                                fixSuggestionsApplied.inc() por fix detectado
```

---

## ðŸ“ Ficheiros implementados no Prompt 7

```
src/security/                           [NOVO DIRECTORIO]
  path-sanitizer.ts      âœ… NexoraPathSanitizer â€” anti path traversal
                            sanitizeFilename() | sanitizeMinioKey() | isWithinBase() | safePath()
                            Bloqueia: ../  ..\ %2e%2e %00 null bytes caracteres perigosos
  file-validator.ts      âœ… NexoraFileValidator â€” validaÃ§Ã£o de magic bytes
                            10 formatos: MP4/MOV, MKV/WebM, AVI, MPEG-TS, MXF, WAV, AIFF, MP3, AAC
                            validateMagicBytes() | isMimeAllowed() | getAllowedMimes()
  ssrf-guard.ts          âœ… NexoraSSRFGuard â€” protecÃ§Ã£o SSRF para webhooks
                            Blocklists: RFC 1918, loopback, cloud metadata (169.254.169.254)
                            ResoluÃ§Ã£o DNS anti-rebinding | safeFetch() | HTTPS obrigatÃ³rio em prod

src/api/middleware/
  auth.ts                âœ… JWT Refactored â€” access 15min + refresh 7 dias
                            generateTokenPair() | rotateRefreshToken() (rotaÃ§Ã£o)
                            revokeRefreshToken() | revokeAllRefreshTokens()
                            DetecÃ§Ã£o de replay attack (revoga todos os tokens)
                            purgeExpiredRefreshTokens() para cron
  audit.ts               âœ… Audit v2 â€” severity + userAgent + security events
                            buildActionName(): AUTH_LOGIN_*, AUTH_REFRESH, AUTH_LOGOUT_ALL
                            RATE_LIMIT_EXCEEDED, AUTH_FAILED, AUTH_FORBIDDEN
                            SSRF_BLOCKED, INVALID_FILE_REJECTED
                            auditSecurityEvent() helper para eventos directos
  rateLimiter.ts         âœ… Rate Limiter v2 â€” per-user key
                            userId autenticado > X-Forwarded-For > IP directo
  rate-limit-config.ts   âœ… Limites granulares por rota:
                            POST /auth/login: 10/min | POST /assets/upload: 5/min
                            POST /auth/refresh: 20/min | GET /assets: 200/min
                            POST /webhooks: 10/min | GET /status-sse: 5/min (SSE)

src/api/routes/
  auth-routes.ts         âœ… Endpoints de auth:
                            POST /auth/login   â€” emite token pair
                            POST /auth/refresh â€” rotaÃ§Ã£o de refresh token
                            POST /auth/logout  â€” revoga token actual
                            POST /auth/logout-all â€” revoga todos (requer access token)
  index.ts               âœ… Registar authRoutes (Prompt 7)
  assets.ts              âœ… Upload integrado com magic bytes + path sanitization
                            9 passos de validaÃ§Ã£o: filename â†’ MIME â†’ tamanho â†’ magic bytes â†’ MinIO key
  webhooks.ts            âœ… SSRF guard integrado em registo + notificaÃ§Ã£o
                            ssrfGuard.validateWebhookUrl() em POST /webhooks
                            ssrfGuard.safeFetch() em notifyWebhooks()

src/api/plugins.ts       âœ… Security headers (helmet) + CORS configurÃ¡vel
                            CSP: default-src 'self' | HSTS em produÃ§Ã£o
                            X-Frame-Options: DENY | X-Content-Type-Options
                            CORS_ORIGINS env var (whitelist explÃ­cita em prod)

prisma/schema.prisma     âœ… +RefreshToken model (tokenHash SHA-256, userId, expiresAt, revokedAt)
                          âœ… +AuditLog.userAgent + AuditLog.severity
prisma/migrations/20260503142733_security_prompt7/
                          âœ… MigraÃ§Ã£o aplicada com sucesso
prisma/rls_audit_logs.sql âœ… RLS activo em audit_logs (INSERT + SELECT only)
                            UPDATE e DELETE bloqueados por PostgreSQL RLS (ADR-007)
```

---

## ðŸ“ Ficheiros implementados no Prompt 8

```
tests/
  fixtures/
    generate-fixtures.sh      âœ… Cria video.mp4, audio.wav, broken.mp4 (gerador via FFmpeg)
    generate-fixtures.ps1     âœ… VersÃ£o Windows em PowerShell para media fixtures
  unit/
    qc-rules.test.ts          âœ… 22 testes unitÃ¡rios do motor QC (Video, Ãudio, Container)
    decision-engine.test.ts   âœ… 5 testes do diagnostic engine (PASS, QUARANTINE, REJECT)
    ffmpeg-builder.test.ts    âœ… 8 testes validando ADR-004 e ADR-006 (GOP, codecs, fallbacks)
  integration/
    api.test.ts               âœ… Testes de Auth (JWT), Rate Limiting e Upload (magic bytes)
    pipeline.test.ts          âœ… Teste de fluxo completo Ingest -> QC -> Transcode com Testcontainers
  e2e/
    upload-flow.spec.ts       âœ… Teste end-to-end de Upload e Dashboard via Playwright
  performance/
    load-test.js              âœ… Script de simulaÃ§Ã£o de carga (100 VUs) via k6

package.json                  âœ… +9 dependÃªncias dev (vitest, supertest, playwright, testcontainers)
vitest.config.ts              âœ… ConfiguraÃ§Ã£o do Vitest com thresholds a 80% coverage
.gitignore                    âœ… Ignora testes/fixtures/data/*
```

---

## ðŸ“ Ficheiros implementados no Prompt 9

```
src/pipeline/tools/
  availability-checker.ts   âœ… NexoraToolRegistry singleton â€” 7 ferramentas, versÃµes, gauges Prometheus
  mediainfo-adapter.ts      âœ… Wrapper type-safe MediaInfo JSON â€” VideoMetadata/AudioMetadata/ContainerMetadata
  mediaconch-adapter.ts     âœ… ValidaÃ§Ã£o AS-11/IMF com policies XML â€” parseReport, requirePass
  bs1770gain-adapter.ts     âœ… MediÃ§Ã£o EBU R128 independente â€” consolidou XML parsing duplicado
  handbrake-adapter.ts      âœ… Proxy generation com nexora-presets.json â€” spawn seguro, parsing FPS/progress

src/workers/
  subtitle.worker.ts        âœ… SRTâ†’TTML/WebVTT, validaÃ§Ã£o timing (overlap, CPS, min/max), re-sync offset

config/mediaconch/
  as11-uk-dpp.xml           âœ… Policy XML AS-11 UK DPP (1080i/25, PCM 24-bit, MXF OP1a)
  imf-basic.xml             âœ… Policy XML IMF Basic (SMPTE ST 2067-2, 10-bit, MXF)

â€” RefactorizaÃ§Ãµes â€”
src/workers/queues.ts       âœ… +fila nexora-subtitle, +SubtitleJobPayload, +enqueueSubtitle()
src/worker.ts               âœ… Usa toolRegistry.checkAllTools() â€” removido checkToolAvailability() inline
src/workers/ingest.worker.ts âœ… Usa mediainfoAdapter.analyzeSafe() â€” removidas interfaces duplicadas
src/pipeline/ffmpeg/loudness.ts âœ… verify() delega em bs1770gainAdapter â€” removido parseBS1770GainXML() duplicado
src/common/errors.ts        âœ… +ToolNotAvailableError, +SubtitleError, +MediaConchValidationError
src/observability/metrics.ts âœ… +6 novas mÃ©tricas Prometheus (tool_available, mediaconch, bs1770gain, handbrake, subtitles)
```

---

## ðŸ“ Ficheiros implementados no Prompt 10

```
src/index.ts
  /health          âœ… Expandido: uptime + tool registry summary
  /health/live     âœ… Timestamp incluido
  /health/ready    âœ… Verifica PostgreSQL + Redis + MinIO (503 em falha)

src/api/plugins.ts
  onRequest hook   âœ… Regista timestamp de inÃ­cio por request
  onSend hook      âœ… Mede latÃªncia HTTP por rota e incrementa contadores

src/observability/metrics.ts
  nexora_http_request_duration_seconds  âœ… Histogram (8 buckets, labels: method/route/status)
  nexora_http_requests_total            âœ… Counter (labels: method/route/status)

README.md         âœ… Reescrito â€” arquitectura, state machine, API ref, ADRs, deployment
PROGRESS.md       âœ… 10/10 Prompts marcados como concluÃ­dos
```

---

## ðŸŽ¯ Estado Final

**Projecto 100% concluÃ­do â€” 10/10 Prompts executados**

NÃ£o existem mais passos pendentes. O Nexora Media Processing estÃ¡ pronto para deployment.

---

*Ãšltima actualizaÃ§Ã£o: 2026-05-05 â€” Release v1.0.0 concluÃ­da â€” 0 erros TS â€” build OK â€” 10/10 Prompts*
