# Nexora Media Processing — Guia de Prompts
## Google Antigravity · Todos os Agentes · Ordem de Execução

---

## Como usar cada prompt

1. Abre o **Google Antigravity**
2. `File → Open Folder` → `C:\Dev\Nexora Media Processing`
3. Abre o chat de IA: `Ctrl + Shift + I`
4. Selecciona o agente indicado (**Claude** ou **Gemini**)
5. Copia o prompt completo e cola no chat
6. Aguarda — o agente cria os ficheiros automaticamente
7. Após terminar, faz commit:
```
git add .
git commit -m "Prompt X concluído — descrição"
git push origin main
```

---

## Ordem de Execução

| Semana | Prompt | Agente | O que cria |
|--------|--------|--------|-----------|
| 1 | **Prompt 1** | Claude | Backend, workers, QC rules, BullMQ |
| 1 | **Prompt 5** | Claude | FFmpeg, GPU, VMAF, two-pass R128 |
| 2 | **Prompt 2** | Claude | Temporal workflows, Decision Engine, API REST |
| 2 | **Prompt 6** | Claude | Docker completo, CI/CD, Grafana |
| 3 | **Prompt 3** | Gemini | Frontend Next.js 14 completo |
| 3 | **Prompt 4** | Claude | Log parser, debug engine |
| 4 | **Prompt 7** | Claude | Segurança, JWT, SSRF |
| 4 | **Prompt 8** | Claude | Testes completos |
| 4 | **Prompt 9** | Claude | Adaptadores open source |
| 4 | **Prompt 10** | Claude | Integração e coordenação final |

---

---

# SEMANA 1

---

## PROMPT 1 — Claude · Backend Core + Workers + QC Engine

```
PROJECTO: Nexora Media Processing

Antes de começar, lê o ficheiro PROGRESS.md na raiz do projecto.

CONTEXTO: És o engenheiro sénior responsável pelo backend e pipeline de
processamento do Nexora Media Processing — plataforma profissional de
ingest, transcoding e entrega de media para broadcast e OTT.

O ambiente já está configurado e a correr:
- PostgreSQL na porta 5432 (base de dados nexora_media criada)
- Redis na porta 6379
- MinIO na porta 9000
- Temporal na porta 7233
- API a responder em http://localhost:3000/health

TAREFA — implementa o backend core completo:

1. prisma/schema.prisma — schema completo com modelos:
   Asset, Job, QCReport, DeliveryTarget, AuditLog, WorkflowRun

2. src/workers/queues.ts — BullMQ setup:
   - Filas: ingest, transcode, audio, qc, proxy, delivery
   - Retry: 3 tentativas, backoff exponencial (1s, 10s, 60s)
   - Dead-letter queue para falhas permanentes
   - Priority: broadcast=10, ott=7, web=5, proxy=3

3. src/workers/ingest.worker.ts — ingest de ficheiros:
   - Mover para MinIO /raw/{assetId}/original
   - Extrair metadata com MediaInfo
   - Calcular SHA256
   - Criar registo Asset no PostgreSQL
   - Emitir evento para fila qc

4. src/workers/qc.worker.ts — controlo de qualidade:
   - Executar regras QC (ver src/qc/rules/index.ts)
   - Gerar QCReport com issues encontrados
   - Decisão: PASS | QUARANTINE | REJECT
   - Se PASS → emitir para fila transcode

5. src/qc/rules/index.ts — motor de regras QC:
   VÍDEO: codec permitido, GOP fechado, CFR, sem VFR,
          B-frames=0 para broadcast, pixelFormat yuv420p,
          resolução e frame rate válidos, bitrate dentro dos limites
   ÁUDIO: sample rate 48000Hz, bit depth 24bit,
          canais (mono/stereo/5.1), loudness EBU R128,
          True Peak ≤ -1.0 dBTP

6. src/workers/transcode.worker.ts — transcoding:
   - Seleccionar perfil de encoding
   - Chamar FFmpegCommandBuilder (Prompt 5)
   - Progresso em tempo real via Redis pub/sub
   - Retry automático com parâmetros ajustados

7. src/workers/audio.worker.ts — normalização áudio:
   - Two-pass EBU R128 (Prompt 5)
   - Validação BS1770GAIN
   - Retry com offset ±0.5 LU, máx 3 tentativas

8. src/api/routes/assets.ts — CRUD assets:
   POST /assets/upload — multipart upload para MinIO
   GET  /assets — listagem paginada com filtros
   GET  /assets/:id — detalhes + QC report + jobs
   DELETE /assets/:id — soft delete

9. src/api/routes/jobs.ts — CRUD jobs:
   POST /jobs — criar job manualmente
   GET  /jobs — listagem com estado
   GET  /jobs/:id — detalhes + logs
   POST /jobs/:id/cancel — cancelar job

10. src/api/middleware/auth.ts — autenticação JWT:
    - Verificar Bearer token
    - Rate limiting por IP (100 req/min)
    - Logging de auditoria

STANDARDS:
- TypeScript strict, sem any implícito
- Nomes em inglês, comentários em português
- Todos os IDs UUID v4
- Todos os erros typed (NexoraError com código e mensagem)
- Logging estruturado com Pino

No final, actualiza o PROGRESS.md com o que foi criado.
```

**Verificação após Prompt 1:**
```powershell
npm run db:migrate
npm run dev
curl http://localhost:3000/health
```

---

## PROMPT 5 — Claude · FFmpeg + GPU + VMAF + Performance

```
PROJECTO: Nexora Media Processing

Antes de começar, lê o ficheiro PROGRESS.md.

ROLE: Engenheiro de optimização FFmpeg e performance

FERRAMENTAS:
FFmpeg 6.x com libx264, libx265, libvpx-vp9, libfdk_aac, libopus,
libvmaf, nvenc (NVIDIA), qsv (Intel), amf (AMD)

TASK 1 — FFMPEG COMMAND BUILDER

Para cada perfil, gerar 2 comandos (GPU + CPU fallback):

NEXORA BROADCAST HD — CPU:
ffmpeg -y -i {input}
  -c:v libx264 -preset slow -tune film
  -profile:v high -level:v 4.1
  -pix_fmt yuv420p
  -g {gop} -keyint_min {gop} -sc_threshold 0 -flags +cgop
  -x264-params "open-gop=0:bframes=0:ref=4:nal-hrd=cbr:force-cfr=1"
  -b:v {bitrate}k -maxrate {maxrate}k -bufsize {bufsize}k
  -colorspace bt709 -color_primaries bt709 -color_trc bt709
  -r 25 -vsync cfr
  -c:a pcm_s24le -ar 48000
  {audio_loudnorm}
  -movflags +faststart {output}

NEXORA BROADCAST HD — GPU (NVENC):
ffmpeg -y -hwaccel cuda -hwaccel_output_format cuda -i {input}
  -c:v h264_nvenc -preset p4 -tune hq
  -profile:v high -level:v 4.1
  -pix_fmt yuv420p
  -g {gop} -keyint_min {gop} -forced-idr 1 -no-scenecut 1
  -b:v {bitrate}k -maxrate {maxrate}k -bufsize {bufsize}k -rc cbr
  -colorspace bt709 -color_primaries bt709 -color_trc bt709
  -c:a pcm_s24le -ar 48000
  {audio_loudnorm}
  -movflags +faststart {output}

TASK 2 — GPU DETECTION
1. nvidia-smi → CUDA disponível?
2. vainfo → VAAPI disponível (Intel/AMD)?
3. Encode de teste (5 frames) → GPU funciona?
4. Fallback automático para CPU se falhar
5. Cache resultado (re-verificar cada 30min)

TASK 3 — TWO-PASS EBU R128

Pass 1 (análise):
ffmpeg -i {input}
  -af "loudnorm=I=-{target}:TP=-1:LRA=11:print_format=json"
  -f null -
Parse: input_i, input_tp, input_lra, input_thresh, target_offset

Pass 2 (normalização linear):
ffmpeg -i {input}
  -af "loudnorm=I=-{target}:TP=-1:LRA=11:
       measured_I={input_i}:measured_TP={input_tp}:
       measured_LRA={input_lra}:measured_thresh={input_thresh}:
       offset={target_offset}:linear=true" {output}

Validação BS1770GAIN:
- LUFS dentro de ±0.5 LU do target
- True Peak ≤ -1.0 dBTP
- Se falhar: retry com offset ±0.5 LU, máx 3 tentativas

TASK 4 — VMAF INTEGRATION
ffmpeg -i {reference} -i {encoded}
  -lavfi "[0:v][1:v]libvmaf=log_fmt=json:log_path={log}:
          n_subsample=5:model=version=vmaf_v0.6.1" -f null -

Thresholds: archive≥93 | broadcast≥90 | streaming≥85 | proxy≥70
Usar 1st percentile como floor de qualidade

ENTREGÁVEIS:
1. src/pipeline/ffmpeg/builder.ts — NexoraFFmpegCommandBuilder
2. src/pipeline/ffmpeg/gpu-detector.ts — NexoraGPUDetector
3. src/pipeline/ffmpeg/loudness.ts — NexoraLoudnessNormalizer
4. src/pipeline/ffmpeg/vmaf.ts — NexoraVMAFScorer
5. src/pipeline/ffmpeg/scheduler.ts — NexoraJobScheduler
6. config/handbrake/nexora-presets.json — HandBrake presets

Actualiza o PROGRESS.md no final.
```

---

---

# SEMANA 2

---

## PROMPT 2 — Claude · Temporal Workflows + Decision Engine + API REST

```
PROJECTO: Nexora Media Processing

Antes de começar, lê o ficheiro PROGRESS.md.

ROLE: Arquitecto de sistemas — orquestração e API

TASK 1 — TEMPORAL.IO WORKFLOWS

Workflow principal: processAssetWorkflow(assetId: string)

SEQUENCIAL:
1. validateQC()       timeout 5min, maxAttempts 3
2. analyzeContent()   timeout 10min, maxAttempts 2

PARALELO (após analyzeContent):
3a. transcodeVideo()  timeout 4h, maxAttempts 2
3b. normalizeAudio()  timeout 30min, maxAttempts 3
3c. processCaptions() timeout 20min, maxAttempts 2, opcional

SEQUENCIAL (após paralelo):
4. generateProxies()    timeout 1h, maxAttempts 2
5. generateThumbnails() timeout 10min, maxAttempts 3
6. runPostEncodeQC()    timeout 30min, maxAttempts 1
7. deliver()            timeout 2h, maxAttempts 3

FALHAS:
- validateQC REJECT → terminar, emitir NexoraAssetRejected
- validateQC QUARANTINE → pausar, aguardar sinal humano (48h timeout)
- runPostEncodeQC falha VMAF → re-encode com CRF ajustado
- Todos os retries: backoff 1s, 10s, 60s

TASK 2 — DECISION ENGINE

Regras (implementar exactamente):
1. VFR detectado → TRANSCODE (CFR obrigatório)
2. Open GOP → TRANSCODE
3. B-frames > 0 E target broadcast → TRANSCODE
4. pixelFormat != yuv420p E não é HDR → TRANSCODE
5. True Peak > -1 dBTP → audio normalisation required
6. LUFS difere do target > 1 LU → normalisation required
7. Codec OK + GOP compliant + CFR + sem issues → COPY ou REMUX
8. GOP size = Math.round(frameRate) * 2
9. bufsize = maxrateKbps * 2

TASK 3 — API REST COMPLETA

Rotas adicionais (além das do Prompt 1):
GET  /profiles — listar perfis de encoding disponíveis
GET  /metrics/summary — estatísticas globais
GET  /queue/stats — estado das filas BullMQ
POST /webhooks — registar webhook para notificações
GET  /assets/:id/status — SSE para progresso em tempo real

Spec OpenAPI 3.1 em openapi.yaml

ENTREGÁVEIS:
1. src/pipeline/orchestrator.ts — Temporal workflow
2. src/pipeline/activities.ts — Temporal activities
3. src/pipeline/temporal-worker.ts — worker Temporal
4. src/pipeline/temporal-client.ts — cliente Temporal
5. src/pipeline/decision-engine.ts — DecisionEngine
6. openapi.yaml — spec completa

Actualiza o PROGRESS.md no final.
```

---

## PROMPT 6 — Claude · Docker + CI/CD + Infra

```
PROJECTO: Nexora Media Processing

Antes de começar, lê o ficheiro PROGRESS.md.

ROLE: DevOps / Infrastructure Engineer

GRAFANA DASHBOARDS (provisionar automaticamente):
1. Nexora Overview: jobs/min, success rate, queue depth, avg transcode time
2. Nexora Quality: VMAF distribution, loudness histogram, rejection rate
3. Nexora Infrastructure: CPU/RAM/disk por container

GITHUB ACTIONS:
- test.yml → npm test em cada PR
- build.yml → build Docker em cada push main
- deploy-staging.yml → deploy automático para staging

PROMETHEUS — alertas:
- queue_depth > 100 → warning
- error_rate > 5% → critical
- transcode_time_p95 > 2h → warning

ENTREGÁVEIS:
1. config/prometheus/prometheus.yml — scrape config
2. config/grafana/provisioning/ — dashboards automáticos
3. config/grafana/alerting/ — regras de alerta
4. .github/workflows/test.yml
5. .github/workflows/build.yml
6. .github/workflows/deploy-staging.yml
7. scripts/healthcheck.sh

Actualiza o PROGRESS.md no final.
```

---

---

# SEMANA 3

---

## PROMPT 3 — Gemini · Frontend Next.js 14

> ⚠️ Este prompt usa **Gemini** (não Claude)

```
PROJECTO: Nexora Media Processing

Antes de começar, lê o ficheiro PROGRESS.md.

ROLE: Engenheiro frontend — Next.js 14 App Router

STACK: Next.js 14, React 18, TypeScript strict, Tailwind CSS,
       shadcn/ui, TanStack Query, Zustand, Recharts

PÁGINAS A CRIAR:
1. / → Dashboard com métricas em tempo real
2. /assets → Listagem de assets com filtros e paginação
3. /assets/upload → Upload drag-and-drop com progresso
4. /assets/[id] → Detalhe do asset com QC report e jobs
5. /queue → Estado das filas com jobs activos
6. /profiles → Gestão de perfis de encoding

COMPONENTES:
- AssetCard — miniatura, estado, progresso
- QCReportViewer — issues por categoria com severidade
- JobTimeline — histórico de estados com timestamps
- QueueDashboard — filas em tempo real via SSE
- UploadZone — drag-and-drop com validação de tipo/tamanho
- MetricsChart — gráficos Recharts para VMAF e loudness

INTEGRAÇÃO API:
- Todas as chamadas via TanStack Query
- SSE para progresso em /assets/:id/status
- Autenticação Bearer token

Todos os componentes TypeScript strict.
Testes Playwright para upload flow.
README com instruções de setup.

Actualiza o PROGRESS.md no final.
```

---

## PROMPT 4 — Claude · Log Analysis + Debug Engine

```
PROJECTO: Nexora Media Processing

Antes de começar, lê o ficheiro PROGRESS.md.

ROLE: Engenheiro de diagnóstico — análise de logs e debugging

FERRAMENTAS A ANALISAR:
FFmpeg stderr, MediaInfo JSON, MediaConch XML, BullMQ logs, BS1770GAIN XML

PADRÕES DE ERRO A RECONHECER:

CRÍTICO:
  "moov atom not found" → container corrompido
  "Invalid data found" → stream corrompido
  "Conversion failed!" → encode falhou

ALTO (retry com ajuste):
  "DTS .* out of order" → problema timestamps → -fflags +igndts
  "Past duration .* too large" → ajustar VBV

ÁUDIO:
  True Peak > -1 dBTP → normalização falhou
  LUFS desvio > 1 LU → two-pass falhou

ENTREGÁVEIS:
1. src/observability/log-parser.ts — NexoraLogParser
2. src/observability/pattern-matcher.ts — NexoraPatternMatcher
3. src/observability/diagnostic-engine.ts — NexoraDiagnosticEngine
4. src/observability/fix-suggester.ts — NexoraFixSuggester
5. src/observability/retry-advisor.ts — NexoraRetryAdvisor
6. src/observability/daily-digest.ts — NexoraDailyDigest
7. src/observability/anomaly-detector.ts — NexoraAnomalyDetector

Actualiza o PROGRESS.md no final.
```

---

---

# SEMANA 4

---

## PROMPT 7 — Claude · Segurança

```
PROJECTO: Nexora Media Processing

Antes de começar, lê o ficheiro PROGRESS.md.

ROLE: Engenheiro de segurança

IMPLEMENTAR:
1. JWT com refresh tokens (access 15min, refresh 7d)
2. Rate limiting granular por rota e por utilizador
3. Validação de ficheiros na upload (magic bytes, não só extensão)
4. Protecção SSRF para webhooks (bloquear IPs privados)
5. Audit trail completo em PostgreSQL
6. Row Level Security no PostgreSQL
7. Sanitização de paths para evitar path traversal
8. Headers de segurança (helmet.js)
9. CORS configurável por ambiente

Actualiza o PROGRESS.md no final.
```

---

## PROMPT 8 — Claude · Testes Completos

```
PROJECTO: Nexora Media Processing

Antes de começar, lê o ficheiro PROGRESS.md.

ROLE: Engenheiro de qualidade — testes

COBERTURA MÍNIMA: 80%

TESTES A CRIAR:
1. tests/unit/qc-rules.test.ts — 100% coverage das regras QC
2. tests/unit/decision-engine.test.ts — todos os casos de decisão
3. tests/unit/ffmpeg-builder.test.ts — comandos gerados correctos
4. tests/integration/pipeline.test.ts — fluxo completo ingest→deliver
5. tests/integration/api.test.ts — todas as rotas com Supertest
6. tests/e2e/upload-flow.spec.ts — Playwright: upload + processar
7. tests/performance/load-test.js — k6: 100 jobs simultâneos

FIXTURES:
- Video corrompido (moov atom em falta)
- Video VFR
- Video com Open GOP
- Audio fora do target LUFS
- Video com VMAF < threshold

Actualiza o PROGRESS.md no final.
```

---

## PROMPT 9 — Claude · Adaptadores Open Source

```
PROJECTO: Nexora Media Processing

Antes de começar, lê o ficheiro PROGRESS.md.

ROLE: Engenheiro de integração

ADAPTADORES A CRIAR:
1. src/pipeline/tools/mediainfo-adapter.ts
   — wrapper type-safe para MediaInfo JSON
2. src/pipeline/tools/mediaconch-adapter.ts
   — validação AS-11/IMF com policies XML
3. src/pipeline/tools/bs1770gain-adapter.ts
   — medição EBU R128 independente do FFmpeg
4. src/pipeline/tools/handbrake-adapter.ts
   — proxy generation com presets
5. src/pipeline/tools/availability-checker.ts
   — verificar no startup quais as ferramentas disponíveis
6. src/workers/subtitle.worker.ts
   — processar legendas (SRT→TTML, validação timing)

Actualiza o PROGRESS.md no final.
```

---

## PROMPT 10 — Claude · Integração Final

```
PROJECTO: Nexora Media Processing

Antes de começar, lê o ficheiro PROGRESS.md.

ROLE: Arquitecto — integração e verificação final

VERIFICAÇÕES:
1. Todos os shared types consistentes entre workers e API
2. Transições de estado Asset válidas (ver PROGRESS.md)
3. Todos os eventos BullMQ têm handlers
4. Temporal workflow cobre todos os cenários de falha
5. Métricas Prometheus expostas em /metrics
6. Health checks em /health/live e /health/ready

ENTREGÁVEIS:
1. src/index.ts — ponto de entrada API com todos os plugins
2. src/worker.ts — ponto de entrada workers com graceful shutdown
3. src/observability/metrics.ts — todas as métricas Prometheus
4. src/observability/logger.ts — Pino logger configurado
5. README.md — documentação completa
6. PROGRESS.md — marcado como 100% completo

Verifica que npm run build passa sem erros.
Verifica que npm test passa com cobertura ≥ 80%.
```

---

---

# Verificações por Semana

## ✅ Semana 1
```powershell
npm run db:migrate
npm run dev
curl http://localhost:3000/health
npm test
```

## ✅ Semana 2
Abrir no browser:
- http://localhost:3000 → API
- http://localhost:8080 → Temporal UI
- http://localhost:3001 → Grafana (admin/nexora)
- http://localhost:9001 → MinIO (nexoraadmin/nexora_minio_secret)

## ✅ Semana 3
```powershell
cd frontend
npm install
npm run dev
# Abrir http://localhost:3000
```

## ✅ Semana 4
```powershell
npm run test:coverage   # deve ser ≥ 80%
npm run lint            # sem erros
npm run build           # sem erros
docker compose ps       # todos Up
```
