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
- [ ] Prompt 2 executado (API + Temporal — Claude)
- [ ] Prompt 6 executado (Docker + Infra — Claude)
- [ ] Prompt 3 executado (Frontend — Gemini)
- [ ] Prompt 4 executado (Logs/Debug — Claude)
- [ ] Prompt 7 executado (Segurança — Claude)
- [ ] Prompt 8 executado (Testes — Claude)
- [ ] Prompt 9 executado (Open Source adapters — Claude)
- [ ] Prompt 10 executado (Integração final — Claude)

---

## 🔄 Em progresso agora

```
Data: 2026-05-02
Agente: Antigravity (Claude Sonnet)
A trabalhar em: Concluído — Prompt 5 executado com sucesso
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

## 🎯 Próximos passos

1. **Prompt 2** — API avançada + Temporal workflows (orquestração completa de pipeline)
2. **Prompt 6** — Docker + Infra (Dockerfile multi-stage, docker-compose, Helm charts)
3. **Prompt 3** — Frontend Next.js (dashboard de assets, monitorização em tempo real)
4. **Prompt 4** — Logs/Debug (request tracing, alertas, dashboards Grafana)

---

*Última actualização: 2026-05-02 — Prompt 5 (FFmpeg Avançado + Performance) concluído — 0 erros TS, 0 erros lint*
