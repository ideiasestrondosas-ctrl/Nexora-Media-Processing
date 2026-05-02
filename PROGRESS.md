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
- [ ] Prompt 5 executado (FFmpeg + Performance — Claude)
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
Agente: Antigravity (Gemini)
A trabalhar em: Prompt 2 (API avançada + Temporal workflows)
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

## ⚠️ Problemas conhecidos

| Data | Problema | Estado |
|---|---|---|
| 2026-05-02 | `openssl` não disponível no PATH do Windows | Resolvido — chaves RSA geradas com Node.js crypto |
| 2026-05-02 | Ficheiros stub com `—` no nome não são importáveis | Resolvido — criados ficheiros com nomes correctos |

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

---

## 🎯 Próximos passos

1. **Prompt 5** — FFmpeg avançado + Performance (pipeline de análise VMAF, streaming otimizado)
2. **Prompt 2** — API avançada + Temporal workflows (orquestração completa de pipeline)
3. **Prompt 6** — Docker + Infra (Dockerfile multi-stage, docker-compose, Helm charts)
4. **Prompt 3** — Frontend Next.js (dashboard de assets, monitorização em tempo real)

---

*Última actualização: 2026-05-02 — Prompt 1 concluído*
