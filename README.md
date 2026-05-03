# Nexora Media Processing

> Plataforma profissional de ingest, validação, transcoding e entrega de media para Broadcast & OTT  
> Stack 100% Open Source · EBU R128 · AS-11 UK DPP · IMF · VMAF · CMAF

[![Tests](https://github.com/ideiasestrondosas-ctrl/Nexora-Media-Processing/actions/workflows/test.yml/badge.svg)](https://github.com/ideiasestrondosas-ctrl/Nexora-Media-Processing/actions/workflows/test.yml)
[![Build Docker](https://github.com/ideiasestrondosas-ctrl/Nexora-Media-Processing/actions/workflows/build.yml/badge.svg)](https://github.com/ideiasestrondosas-ctrl/Nexora-Media-Processing/actions/workflows/build.yml)

---

## O que é

O **Nexora Media Processing** é uma plataforma server-side que automatiza o pipeline completo de ficheiros de media profissional:

1. **Ingest** — recebe ficheiros, calcula SHA-256, extrai metadata
2. **QC pré-encode** — valida contra perfis broadcast (AS-11, IMF, EBU R128)
3. **Transcode** — converte para múltiplos formatos com GPU acceleration
4. **Áudio** — normalização two-pass EBU R128 com verificação BS1770GAIN
5. **Legendas** — conversão SRT→TTML/WebVTT com validação de timing
6. **QC pós-encode** — VMAF scoring e re-encode automático se necessário
7. **Delivery** — upload para MinIO/S3 com verificação de integridade

---

## Começar em 10 passos

### Prerequisitos

- Node.js 20+
- Docker Desktop
- FFmpeg 6.x (`choco install ffmpeg` / `brew install ffmpeg` / `sudo apt install ffmpeg`)

```bash
# 1. Clonar o repositório
git clone https://github.com/ideiasestrondosas-ctrl/Nexora-Media-Processing.git
cd Nexora-Media-Processing

# 2. Instalar dependências Node.js
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Edita o .env com as tuas configurações (DATABASE_URL, REDIS_URL, MINIO_*)

# 4. Iniciar serviços de infra via Docker
docker compose up -d postgres redis minio temporal temporal-ui

# 5. Aguardar serviços iniciarem (~30 segundos)
Start-Sleep 30   # PowerShell
# sleep 30       # bash

# 6. Gerar chaves JWT RS256
npm run keys:generate

# 7. Aplicar migrações da base de dados
npm run db:migrate

# 8. Verificar saúde do sistema
bash scripts/healthcheck.sh   # ou .\scripts\healthcheck.ps1

# 9. Iniciar a API (terminal 1)
npm run dev

# 10. Iniciar os workers (terminal 2)
npm run worker
```

---

## Interfaces e Acessos

| Interface | URL | Credenciais (Padrão) |
|---|---|---|
| **API REST** | http://localhost:3000/api/v1 | JWT via POST /api/v1/auth/login |
| **Swagger UI** | http://localhost:3000/documentation | — |
| **Dashboard Frontend** | http://localhost:3002 | — |
| **Temporal UI** | http://localhost:8080 | — |
| **Grafana** | http://localhost:3001 | `admin` / `nexora` |
| **MinIO Console** | http://localhost:9001 | `nexoraadmin` / `nexora_minio_secret` |
| **Prometheus** | http://localhost:9090 | — |

---

## Arquitectura

```
                          ┌─────────────────────────────────────┐
                          │         Nexora API (Fastify)         │
                          │  POST /api/v1/assets/upload          │
                          │  GET  /api/v1/assets/:id             │
                          │  POST /api/v1/auth/login             │
                          │  GET  /health/ready (PG+Redis+MinIO) │
                          └────────────────┬────────────────────┘
                                           │ enqueue
                    ┌──────────────────────▼──────────────────────┐
                    │              BullMQ (Redis)                  │
                    │  nexora-ingest · nexora-qc · nexora-transcode│
                    │  nexora-audio  · nexora-subtitle             │
                    └──┬─────────┬────────┬──────────┬────────────┘
                       │         │        │          │
              ┌────────▼──┐ ┌────▼───┐ ┌─▼──────┐ ┌▼──────────┐
              │  Ingest   │ │   QC   │ │Transcode│ │  Audio    │
              │  Worker   │ │ Worker │ │ Worker  │ │  Worker   │
              └────┬──────┘ └───┬────┘ └────┬────┘ └─────┬─────┘
                   │            │            │             │
                   └────────────▼────────────▼─────────────┘
                                │   Temporal.io Orchestrator
                                │   processAssetWorkflow()
                                │   (retry, quarantine, signals)
                                ▼
                          ┌──────────────────┐
                          │   PostgreSQL +    │
                          │   MinIO Storage   │
                          └──────────────────┘
```

### Modos de Operação

| Modo | Quando usar |
|---|---|
| **BullMQ Standalone** | Jobs simples sem orquestração complexa |
| **Temporal.io** | Pipeline completo com retry, quarantine, signals humanos |
| **Híbrido** | API usa BullMQ para enqueue, Temporal gere o workflow de longa duração |

---

## Máquina de Estados — AssetStatus

```mermaid
stateDiagram-v2
    [*] --> PENDING
    PENDING --> QC_RUNNING: ingest.worker (BullMQ)
    QC_RUNNING --> TRANSCODING: QC PASS
    QC_RUNNING --> QC_QUARANTINED: QC QUARANTINE (aguarda revisão humana 48h)
    QC_RUNNING --> QC_REJECTED: QC REJECT
    QC_QUARANTINED --> TRANSCODING: Aprovado por revisor
    QC_QUARANTINED --> QC_REJECTED: Rejeitado ou timeout 48h
    TRANSCODING --> AUDIO_PROCESSING: transcode.worker
    TRANSCODING --> FAILED: erro não-recuperável
    AUDIO_PROCESSING --> DELIVERING: audio.worker
    AUDIO_PROCESSING --> FAILED: erro BS1770GAIN
    DELIVERING --> COMPLETED: activities.deliver()
    COMPLETED --> DELETED: soft delete (ADR-007)
    QC_REJECTED --> DELETED: soft delete
    FAILED --> DELETED: soft delete
```

> **Nota**: as transições via BullMQ standalone saltam o estado `QC_PASSED` (escrito apenas pelas Temporal Activities). Ambas as paths são funcionalmente correctas.

---

## API Reference

### Autenticação

Todos os endpoints (excepto `/health*` e `/api/v1/auth/login`) requerem header:
```
Authorization: Bearer <access_token>
```

Tokens: Access Token (15min) + Refresh Token (7 dias) via RS256.

### Endpoints

| Método | Endpoint | Auth | Descrição |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | ❌ | Emite token pair |
| `POST` | `/api/v1/auth/refresh` | ❌ | Renova access token |
| `POST` | `/api/v1/auth/logout` | ✅ | Revoga token actual |
| `POST` | `/api/v1/auth/logout-all` | ✅ | Revoga todos os tokens |
| `POST` | `/api/v1/assets/upload` | ✅ | Upload de ficheiro media |
| `GET`  | `/api/v1/assets` | ✅ | Listar assets |
| `GET`  | `/api/v1/assets/:id` | ✅ | Detalhe do asset |
| `DELETE` | `/api/v1/assets/:id` | ✅ | Soft delete |
| `GET`  | `/api/v1/assets/:id/review` | ✅ | Aprovação de quarentena |
| `POST` | `/api/v1/jobs` | ✅ | Criar job manual |
| `GET`  | `/api/v1/jobs` | ✅ | Listar jobs |
| `GET`  | `/api/v1/jobs/:id` | ✅ | Detalhe do job |
| `DELETE` | `/api/v1/jobs/:id` | ✅ | Cancelar job |
| `GET`  | `/api/v1/profiles` | ✅ | Listar perfis de encoding |
| `GET`  | `/api/v1/queue-stats` | ✅ | Estatísticas das filas BullMQ |
| `GET`  | `/api/v1/metrics-summary` | ✅ | Resumo de métricas |
| `POST` | `/api/v1/webhooks` | ✅ | Registar webhook |
| `GET`  | `/api/v1/status-sse` | ✅ | SSE — eventos em tempo real |
| `GET`  | `/health` | ❌ | Status + tool registry |
| `GET`  | `/health/live` | ❌ | Liveness probe (Kubernetes) |
| `GET`  | `/health/ready` | ❌ | Readiness probe (PG+Redis+MinIO) |

---

## Workers

| Worker | Fila | Concorrência | Ferramentas |
|---|---|---|---|
| `IngestWorker` | `nexora-ingest` | 5 | MediaInfo, MinIO |
| `QCWorker` | `nexora-qc` | 3 | FFprobe, MediaConch |
| `TranscodeWorker` | `nexora-transcode` | 2 | FFmpeg, GPU detector, VMAF |
| `AudioWorker` | `nexora-audio` | 4 | FFmpeg two-pass, BS1770GAIN |
| `SubtitleWorker` | `nexora-subtitle` | 8 | Parser SRT interno |

### Workers Stub (extensão futura)
- `proxy.worker.ts` — geração de proxy via HandBrakeCLI (coberto por Temporal Activity)
- `delivery.worker.ts` — upload para S3 externo (coberto por Temporal Activity)

---

## Adaptadores Open Source (Prompt 9)

| Adaptador | Ferramenta | Função |
|---|---|---|
| `mediainfoAdapter` | MediaInfo | Extrai VideoMetadata, AudioMetadata, ContainerMetadata (type-safe) |
| `mediaconchAdapter` | MediaConch | Valida conformidade AS-11 UK DPP e IMF Basic |
| `bs1770gainAdapter` | BS1770GAIN | Mede LUFS, True Peak, LRA — fonte única de parsing XML |
| `handbrakeAdapter` | HandBrakeCLI | Gera proxies com presets Nexora |
| `toolRegistry` | — | Verifica disponibilidade de 7 ferramentas no startup |

---

## Observabilidade

### Prometheus Metrics (porta 9100/9101)

| Métrica | Tipo | Descrição |
|---|---|---|
| `nexora_assets_ingested_total` | Counter | Total de assets recebidos |
| `nexora_assets_rejected_total` | Counter | Assets rejeitados (label: reason) |
| `nexora_transcode_duration_seconds` | Histogram | Duração por perfil |
| `nexora_vmaf_score` | Histogram | Distribuição de scores VMAF |
| `nexora_loudness_lufs` | Histogram | Distribuição de LUFS |
| `nexora_http_request_duration_seconds` | Histogram | Latência HTTP por rota |
| `nexora_http_requests_total` | Counter | Requests por método/rota/status |
| `nexora_tool_available` | Gauge | 1/0 por ferramenta externa |
| `nexora_mediaconch_validations_total` | Counter | Validações MediaConch |
| `nexora_bs1770gain_measurements_total` | Counter | Medições BS1770GAIN |
| `nexora_subtitles_processed_total` | Counter | Legendas convertidas |
| `nexora_queue_depth` | Gauge | Jobs em fila por worker |
| `nexora_gpu_available` | Gauge | GPU disponível para encoding |

### Grafana Dashboards

- **nexora-overview.json** — jobs/min, success rate, queue depth, avg transcode
- **nexora-quality.json** — VMAF P50/P1, rejection rate, loudness LUFS
- **nexora-infra.json** — CPU/RAM por container, rede I/O, event loop

### Logging

Logs estruturados em JSON via Pino. Em desenvolvimento, formato pretty com cores.

```bash
# Seguir logs da API
.\nexora.ps1 logs backend

# Seguir logs dos workers
.\nexora.ps1 logs worker
```

---

## Segurança

| Feature | Implementação |
|---|---|
| **Autenticação** | JWT RS256 4096-bit, access 15min + refresh 7 dias |
| **Rotação de tokens** | Replay attack detection — revoga todos os tokens |
| **Rate Limiting** | Redis-backed, por utilizador autenticado |
| **Upload validation** | Magic bytes (10 formatos) + MIME + tamanho |
| **Path traversal** | `NexoraPathSanitizer` — bloqueia `../`, null bytes, encoding |
| **SSRF Protection** | `NexoraSSRFGuard` — blocklist RFC 1918, cloud metadata (169.254.169.254) |
| **Security headers** | Helmet: CSP, HSTS, X-Frame-Options: DENY |
| **Audit trail** | Append-only PostgreSQL com RLS (UPDATE/DELETE bloqueados por RLS) |

---

## Perfis de Encoding

| Perfil | Formato | Bitrate | Uso |
|---|---|---|---|
| `broadcast-hd` | MXF OP1a + H.264 | 8 Mbps | Broadcasters (RTP, BBC, DPP) |
| `ott-premium` | CMAF + H.265 | 5 Mbps | Netflix, Amazon, Disney+ |
| `streaming-web` | MP4 + H.264 | 2 Mbps | YouTube, web players |
| `proxy` | MP4 480p | 800 kbps | Revisão editorial |
| `archive` | MXF + ProRes | lossless | Arquivo profissional |

**ADR-004**: yuv420p obrigatório em todos os outputs de distribuição  
**ADR-006**: Closed GOP + IDR frames + 0 B-frames em broadcast  
**ADR-010**: VMAF calculado e guardado para todos os outputs

---

## ADRs — Architecture Decision Records

| ADR | Decisão | Motivo |
|---|---|---|
| ADR-001 | Temporal.io para orquestração (não BullMQ standalone) | Retry durável, signals, quarantine workflow |
| ADR-002 | FFmpeg via `execFile`/`spawn` (NUNCA `exec()` com string) | Prevenção de command injection |
| ADR-003 | SHA-256 para checksums (MD5 proibido) | Colisões MD5 conhecidas |
| ADR-004 | `yuv420p` obrigatório em outputs de distribuição | Compatibilidade máxima com players |
| ADR-005 | Two-pass EBU R128 + BS1770GAIN verificação independente | Precisão ±0.1 LU |
| ADR-006 | Closed GOP + IDR frames em todos os outputs broadcast | Conformidade AS-11 UK DPP |
| ADR-007 | Audit trail append-only (UPDATE/DELETE proibidos) | Rastreabilidade regulatória |
| ADR-008 | RS256 JWT com rotação (HS256 proibido em produção) | Assymmetric key — sem shared secret |
| ADR-009 | BS1770GAIN para verificação independente de loudness | Fallback FFmpeg loudnorm apenas em emergência |
| ADR-010 | VMAF score calculado e guardado para todos os outputs | Garantia de qualidade perceptual |

---

## Standards de Broadcast Cobertos

| Standard | Âmbito |
|---|---|
| **EBU R128** | Loudness normalisation (target -23 LUFS, TP -1 dBTP) |
| **ITU-R BS.1770-4** | Algorithmo de medição de loudness |
| **AS-11 UK DPP** | Entrega para broadcasters britânicos (MXF OP1a, 1080i/25) |
| **IMF SMPTE ST 2067** | Interoperable Master Format (JPEG2000, 10-bit) |
| **CMAF ISO 23000-19** | Streaming adaptativo fragmentado |
| **HLS Apple Authoring** | Apple HLS delivery spec |
| **DASH-IF IOP** | DASH Interoperability Points |

---

## Testes

```bash
# Testes unitários (sem dependências externas)
npm test

# Testes com cobertura (threshold: 80%)
npm run test:coverage

# Testes de integração (requer Docker)
npm run test -- tests/integration/

# Testes end-to-end (requer servidor a correr)
npm run test:e2e

# Testes de carga (requer k6 instalado)
k6 run tests/performance/load-test.js

# Gerar fixtures de media (requer FFmpeg)
npm run fixtures:generate
```

---

## Deployment

### Docker Compose (Desenvolvimento)

```bash
docker compose up -d                    # Inicia todos os serviços
docker compose ps                       # Verifica estado
docker compose logs -f nexora-api       # Logs da API
bash scripts/healthcheck.sh             # Verifica saúde dos 8 serviços
```

### Variáveis de Ambiente Obrigatórias

```env
DATABASE_URL=postgresql://nexora:nexora@localhost:5432/nexora_media
REDIS_URL=redis://localhost:6379
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=nexoraadmin
MINIO_SECRET_KEY=nexora_minio_secret
NEXORA_INPUT_DIR=/tmp/nexora/input
NEXORA_OUTPUT_DIR=/tmp/nexora/output
NEXORA_TEMP_DIR=/tmp/nexora/temp
JWT_PUBLIC_KEY_PATH=./secrets/jwt_public.pem
JWT_PRIVATE_KEY_PATH=./secrets/jwt_private.pem
```

### CI/CD

- **test.yml** — prisma generate + testes + cobertura a cada push
- **build.yml** — build Docker images (nexora-api + nexora-worker) com OCI labels
- **deploy-staging.yml** — deploy com retry 3×, health check e logs em caso de falha

---

## Gestão do Ambiente (CLI PowerShell)

```powershell
.\nexora.ps1          # Menu interactivo
.\nexora.ps1 start    # Inicia API + workers em background
.\nexora.ps1 stop     # Para todos os serviços
.\nexora.ps1 status   # Estado de todos os serviços + memória
.\nexora.ps1 logs backend   # Segue logs da API em tempo real
.\nexora.ps1 logs worker    # Segue logs dos workers
.\nexora.ps1 reset    # Reset nuclear: Docker + DB + logs
```

Os logs de background são guardados em `.logs/`.

---

## Documentação

- [Estado do projecto](PROGRESS.md) — 10/10 prompts concluídos
- [API Reference (OpenAPI)](openapi.yaml) — especificação completa
- [ADRs](docs/adr/) — Architecture Decision Records detalhados
- [Manual técnico](docs/manual-v4.md)

---

## Licença

MIT — ver [LICENSE](LICENSE)
