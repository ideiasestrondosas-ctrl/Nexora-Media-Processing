# Nexora Media Processing — Estado do Projecto

> **⚠️ LEITURA OBRIGATÓRIA PARA TODOS OS AGENTES IA**
>
> Este ficheiro DEVE ser lido ANTES de qualquer trabalho neste projecto.
> DEVE ser actualizado no FIM de cada sessão de desenvolvimento.
> Existe para reduzir tokens, evitar retrabalho, e manter consistência.

---

## 📋 Identidade do Projecto

| Campo | Valor |
|---|---|
| **Nome** | Nexora Media Processing |
| **Versão actual** | 0.1.0 |
| **Tipo** | Plataforma de processamento de media profissional (Broadcast & OTT) |
| **IDE** | Google Antigravity |
| **Agentes activos** | Claude (arquitectura/backend), Gemini (frontend), Claude (segurança/testes) |
| **Repositório** | https://github.com/[utilizador]/nexora-media-processing |
| **Stack principal** | Node.js 20 + TypeScript + Fastify + BullMQ + Redis + PostgreSQL + MinIO |
| **Stack frontend** | Next.js 14 + React + Tailwind CSS + shadcn/ui |
| **Orquestração** | Temporal.io |
| **Ferramentas media** | FFmpeg · HandBrakeCLI · MediaInfo · FFprobe · MediaConch · BS1770GAIN |

---

## ✅ O que está concluído

> Marca com [x] quando um item ficar completo. Não remove itens — só marca.

### Fase 0 — Preparação
- [ ] Script de setup do ambiente (nexora-setup.sh / nexora-setup.ps1)
- [ ] Script de scaffold do projecto (nexora-scaffold.js)
- [ ] Repositório GitHub criado e configurado
- [ ] Estrutura de pastas criada
- [ ] package.json + tsconfig.json + .eslintrc + .prettierrc
- [ ] .env.example com todas as variáveis
- [ ] docker-compose.yml base
- [ ] .gitignore
- [ ] PROGRESS.md (este ficheiro)

### Fase 1 — Backend Core (Prompt 1 — Claude)
- [x] Prisma schema completo (Asset, Job, AuditLog, ProcessingStep, Settings)
- [x] FFmpeg executor isolado (src/pipeline/ffmpeg/executor.ts)
- [x] FFmpeg command builder (src/pipeline/ffmpeg/builder.ts)
- [x] FFmpeg stderr parser (src/pipeline/ffmpeg/parser.ts)
- [x] QC rules — vídeo (src/qc/rules/video.rules.ts)
- [x] QC rules — áudio (src/qc/rules/audio.rules.ts)
- [x] QC rules — container (src/qc/rules/container.rules.ts)
- [x] Worker: transcode (src/workers/transcode.worker.ts)
- [x] Worker: audio normalize (src/workers/audio.worker.ts)
- [x] Perfis de encoding (src/pipeline/profiles.ts)
- [x] BullMQ queues setup (src/workers/queues.ts)
- [x] Prisma client singleton (src/db/prisma.ts)
- [x] API routes: assets (src/api/routes/assets.ts)
- [x] API routes: jobs (src/api/routes/jobs.ts)
- [x] Auth middleware JWT RS256 (src/api/middleware/auth.ts)
- [x] Rate limiter middleware
- [ ] VMAF integration (src/qc/vmaf.ts)
- [ ] MediaConch integration (src/qc/mediaconch.ts)
- [ ] Worker: ingest (src/workers/ingest.worker.ts)
- [ ] Worker: QC pré-encode (src/workers/qc.worker.ts)
- [ ] Worker: analyzer (src/workers/analyzer.worker.ts)
- [ ] Worker: transcode (src/workers/transcode.worker.ts)
- [ ] Worker: audio normalize (src/workers/audio.worker.ts)
- [ ] Worker: subtitle (src/workers/subtitle.worker.ts)
- [ ] Worker: proxy (src/workers/proxy.worker.ts)
- [ ] Worker: QC pós-encode (src/workers/qc-post.worker.ts)
- [ ] Worker: delivery (src/workers/delivery.worker.ts)
- [ ] Perfis de encoding (src/pipeline/profiles.ts)
- [ ] BullMQ queues setup
- [ ] Métricas Prometheus (src/observability/metrics.ts)
- [ ] Logger estruturado Pino (src/observability/logger.ts)
- [ ] Testes unitários QC rules (100% coverage)

### Fase 2 — FFmpeg + Performance (Prompt 5 — Claude)
- [ ] GPU detector (NVENC/QSV/AMF)
- [ ] Comandos GPU para broadcast HD
- [ ] Comandos CPU fallback para broadcast HD
- [ ] Comandos GPU/CPU para OTT premium
- [ ] Two-pass EBU R128 normalizer
- [ ] BS1770GAIN validator
- [ ] VMAF scorer com thresholds
- [ ] HandBrake preset file (nexora-presets.json)
- [ ] Job scheduler com prioridade
- [ ] Benchmarks GPU vs CPU

### Fase 3 — Orquestração + API (Prompt 2 — Claude)
- [x] Temporal.io workflow: processAssetWorkflow (orchestrator.ts)
- [x] Temporal.io activities (activities.ts)
- [x] Temporal worker + client (temporal-worker.ts / temporal-client.ts)
- [x] Decision Engine (decision-engine.ts — 11 regras)
- [x] API routes: assets (GET, POST, SSE, QC report, reprocess, audit)
- [x] API routes: jobs (GET status, queue stats, metrics summary, profiles)
- [x] Auth middleware JWT RS256 (auth.ts)
- [x] Rate limiter middleware
- [x] Plugins + Routes registration (plugins.ts)
- [x] OpenAPI spec (parcialmente — completar com Prompt 2)

### Fase 7 — Segurança (Prompt 7 — Claude)
- [x] Magic bytes validator (security.ts)
- [x] Filename sanitizer
- [x] SSRF prevention (validateURLForIngest)
- [x] JWT key generation (generateJWTKeyPair)
- [x] Audit chain verifier (verifyAuditChain)
- [x] Script de geração de chaves (nexora-generate-keys.ts)
- [ ] Testes de segurança (injection tests, SSRF tests)

### Fase 8 — Testes (Prompt 8 — Claude)
- [x] Testes unitários QC rules (tests/unit/qc-rules.test.ts)
- [x] Testes unitários FFmpeg builder (segurança)
- [x] Testes de integração pipeline (tests/integration/pipeline.test.ts)
- [x] Testes E2E API (tests/integration/pipeline.test.ts — API section)
- [x] Testes E2E Frontend Playwright (tests/e2e/upload-flow.spec.ts)
- [x] Script k6 performance (tests/performance/load-test.js)
- [x] Fixtures generator (generate-fixtures.sh)
- [x] Checklist de aceitação final (docs/ACCEPTANCE_CHECKLIST.md)

### Fase 4 — Infra + CI/CD (Prompt 6 — Claude)
- [ ] Docker Compose completo (10 serviços)
- [ ] Dockerfile da aplicação
- [ ] Dockerfile.worker
- [ ] Imagem custom nexora-media-tools
- [ ] Prometheus config (config/prometheus/prometheus.yml)
- [ ] Grafana dashboards (config/grafana/)
- [ ] Alertmanager config
- [ ] GitHub Actions: test.yml
- [ ] GitHub Actions: build.yml
- [ ] GitHub Actions: deploy-staging.yml
- [ ] Health check endpoints

### Fase 5 — Frontend (Prompt 3 — Gemini)
- [x] Setup Next.js 14 App Router (frontend/src/app/)
- [x] Layout principal + sidebar + topbar
- [x] Page: Dashboard Overview (métricas + charts)
- [x] Page: Assets List com filtros + paginação
- [x] Page: Asset Detail (5 tabs: overview, qc-report, jobs, audit, downloads)
- [x] Page: Queue Monitor (profundidade filas + stats)
- [x] Upload Flow wizard (4 passos: ficheiro → perfil → opções → progresso)
- [x] Componente: NexoraStatusBadge (animated pulse)
- [x] Componente: NexoraVMAFGauge (semicircle gauge)
- [x] Componente: MetricCard + RecentActivity + AssetsTable
- [x] Hook: useAssetStatusSSE (real-time updates)
- [x] Cliente API (lib/api.ts)
- [x] QueryProviders (TanStack Query)
- [x] Testes Playwright: upload flow + asset detail + a11y

### Fase 6 — Log Analysis (Prompt 4 — Claude)
- [ ] NexoraLogParser
- [ ] NexoraPatternMatcher
- [ ] NexoraDiagnosticEngine
- [ ] NexoraFixSuggester
- [ ] NexoraRetryAdvisor
- [ ] NexoraDailyDigest
- [ ] NexoraAnomalyDetector

### Fase 7 — Segurança (Prompt 7 — Claude)
- [ ] JWT RS256 auth middleware
- [ ] RSA key pair generation + rotação
- [ ] Token revocation (Redis)
- [ ] API key management
- [ ] Rate limiting por identidade
- [ ] File magic bytes validation
- [ ] SSRF prevention
- [ ] Filename sanitization
- [ ] FFmpeg injection prevention
- [ ] Audit trail hash chain
- [ ] Data governance + retention
- [ ] Testes de segurança (injection, SSRF, path traversal)

### Fase 8 — Testes Completos (Prompt 8 — Claude)
- [ ] Fixtures generator (generate-fixtures.sh)
- [ ] Fixtures criadas (5 ficheiros de teste)
- [ ] Unit tests: QC rules (100% coverage)
- [ ] Unit tests: FFmpeg command builder
- [ ] Integration tests: Testcontainers
- [ ] E2E API: todos os endpoints
- [ ] E2E Frontend: Playwright
- [ ] Performance: k6 scripts
- [ ] Coverage ≥ 80% linhas
- [ ] Mutation score ≥ 75%

### Fase 9 — Integração Open Source (Prompt 9 — Claude)
- [ ] NexoraHandBrakeWorker
- [ ] NexoraBS1770GainAnalyzer
- [ ] NexoraMediaInfoParser
- [ ] NexoraVLCPlaybackTester
- [ ] NexoraToolSelector
- [ ] NexoraToolAvailabilityChecker
- [ ] nexora-presets.json

### Fase 10 — Integração Final (Prompt 10 — Claude)
- [ ] @nexora/shared-types package
- [ ] State machine com transições válidas
- [ ] Verificação de integração completa
- [ ] docs/adr/ com todos os ADRs (001–010)
- [ ] README.md final
- [ ] PROGRESS.md finalizado

---

## 🔄 Em progresso agora

> Actualiza esta secção no início de cada sessão

```
Data: ___________
Agente: ___________
A trabalhar em: ___________
Bloqueios: ___________
```

---

## 📁 Estrutura de ficheiros (actualizar à medida que cresce)

```
nexora-media-processing/
├── src/
│   ├── api/
│   ├── workers/
│   ├── pipeline/
│   │   └── ffmpeg/
│   ├── qc/
│   │   └── rules/
│   ├── models/
│   ├── events/
│   └── observability/
├── frontend/
├── prisma/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   ├── fixtures/
│   └── performance/
├── config/
│   ├── prometheus/
│   └── grafana/
├── docs/
│   └── adr/
├── scripts/
├── .github/
│   └── workflows/
├── media/
│   ├── input/
│   ├── output/
│   └── temp/
├── PROGRESS.md          ← este ficheiro
├── README.md
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## ⚠️ Problemas conhecidos e bloqueios

> Regista aqui erros não resolvidos. Remove quando resolvidos.

| Data | Problema | Estado | Resolução |
|---|---|---|---|
| — | Nenhum problema registado | — | — |

---

## 🏗️ ADRs — Decisões de Arquitectura (IMUTÁVEIS)

> Estas decisões NÃO podem ser revertidas sem criar um novo ADR que as substitua.

| ADR | Decisão | Razão |
|---|---|---|
| ADR-001 | Temporal.io para orquestração (não BullMQ standalone) | Workflows stateful com retry, replay e histórico |
| ADR-002 | FFmpeg via execFile/spawn (NUNCA exec() com string) | Segurança contra command injection |
| ADR-003 | SHA-256 para todos os checksums (MD5 proibido) | MD5 tem colisões conhecidas |
| ADR-004 | yuv420p obrigatório em outputs de distribuição | Compatibilidade máxima com players e decoders |
| ADR-005 | Two-pass EBU R128 + verificação BS1770GAIN independente | FFmpeg não deve verificar o seu próprio output |
| ADR-006 | Closed GOP + IDR frames em todos os outputs broadcast | Estabilidade em switching e recuperação de falhas |
| ADR-007 | Audit trail append-only (UPDATE e DELETE proibidos) | Integridade de dados e auditabilidade |
| ADR-008 | RS256 JWT com key rotation 30 dias (HS256 proibido em produção) | Segurança criptográfica |
| ADR-009 | BS1770GAIN para verificação independente de loudness | Validação cruzada obrigatória |
| ADR-010 | VMAF score calculado e guardado para todos os outputs | Qualidade verificável e rastreável |

---

## 📅 Histórico de sessões

> Uma linha por sessão. Nunca apagar linhas antigas.

| Data | O que foi feito | Agente usado | Ficheiros criados/modificados |
|---|---|---|---|
| — | Projecto iniciado, PROGRESS.md criado | — | PROGRESS.md |

---

## 🎯 Próximos passos (ordenados por prioridade)

1. [ ] Executar script de setup: `bash scripts/nexora-setup.sh`
2. [ ] Executar scaffold: `node scripts/nexora-scaffold.js`
3. [ ] Configurar `.env` a partir de `.env.example`
4. [ ] `npm install` + `docker compose up -d`
5. [ ] Executar **Prompt 1** (Claude) — Backend Core
6. [ ] Executar **Prompt 5** (Claude) — FFmpeg + Performance
7. [ ] Executar **Prompt 2** (Claude) — Orquestração + API
8. [ ] Executar **Prompt 6** (Claude) — Docker + Infra
9. [ ] Executar **Prompt 3** (Gemini) — Frontend
10. [ ] Executar **Prompts 4, 7, 8, 9, 10** (Claude) — restantes fases

---

## 📐 Contexto técnico rápido (para agentes IA)

> Lê isto antes de gerar código para não introduzir inconsistências.

**Portas em uso:**
- 3000 → Nexora API + Frontend
- 3001 → Grafana
- 3100 → Loki
- 5432 → PostgreSQL
- 6379 → Redis
- 7233 → Temporal
- 8080 → Temporal UI
- 9000 → MinIO API
- 9001 → MinIO Console
- 9090 → Prometheus
- 9100 → Métricas da app (Prometheus scrape)

**Convenções de código:**
- TypeScript strict mode — sem `any` implícito
- Nomes em inglês no código, comentários em português
- Imports absolutos via paths aliases (`@/workers/`, `@/qc/`, etc.)
- Todos os erros são typed (nunca `catch(e: any)`)
- Todos os IDs são UUID v4

**Limites de recursos (Docker):**
- nexora-worker: máx 4 CPU, 8 GB RAM por instância
- nexora-api: máx 1 CPU, 512 MB RAM
- FFmpeg timeout padrão: 4h (14400000ms)

---

*Este ficheiro é a fonte de verdade do projecto. Em caso de dúvida, consulta aqui.*
