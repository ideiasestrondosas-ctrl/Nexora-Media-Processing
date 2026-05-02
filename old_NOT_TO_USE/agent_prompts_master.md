# Media Processing Hub
## Sistema de Prompts Multi-Agente — Pronto para Produção

> Versão 1.0 | Arquiteto: Claude Sonnet  
> Executável em: Claude Code · OpenAI Codex · Google AI Studio · Cursor · Windsurf

---

## DECISÃO DE ARQUITETURA — Stack Open Source

Antes dos prompts, a decisão técnica de stack. Tudo open-source, sem vendor lock-in:

| Camada | Tecnologia | Justificação |
|---|---|---|
| Core transcoding | **FFmpeg** | Standard da indústria, suporte universal |
| Preset encoding | **HandBrake CLI** | Presets validados, GPU accel, batch |
| Análise/validação | **MediaInfo + FFprobe** | Complementares, melhor juntos |
| Conformance | **MediaConch** | Único tool com policy XML formal |
| Qualidade | **libvmaf** | Netflix-grade, integrado no FFmpeg |
| Backend | **Node.js (TypeScript)** | Ecosystem, async nativo, libs media |
| Workers | **BullMQ + Redis** | Queue robusta, retry, dead-letter nativo |
| Orquestração | **Temporal.io** | Workflows stateful, replay, histórico |
| API | **Fastify** | Performance superior a Express |
| Frontend | **Next.js 14 + React** | SSR, App Router, ecosystem |
| Database | **PostgreSQL + Prisma** | Relacional para metadata, type-safe ORM |
| Storage | **MinIO** (S3-compatible) | Self-hosted, sem custo de cloud |
| Observabilidade | **Prometheus + Grafana + Loki** | Stack completo de produção |
| Containers | **Docker + Docker Compose** | Dev/prod parity |
| Audio loudness | **BS1770GAIN** | EBU R128 measurement standalone |

---

---

# ═══════════════════════════════════════════
# PROMPT 1 — CLAUDE CODE
# Arquitetura Base + Backend + Workers + Pipeline
# ═══════════════════════════════════════════

```
CONTEXTO: És o engenheiro sénior responsável pelo backend e pipeline de processamento 
do Media Processing Hub — uma plataforma profissional de ingest, transcoding e 
entrega de media para broadcast e OTT.

STACK APROVADO (não alterar sem justificação):
- Runtime: Node.js 20 LTS (TypeScript strict mode)
- Framework API: Fastify 4.x
- Queue: BullMQ + Redis 7
- ORM: Prisma + PostgreSQL 15
- Workers: processos isolados com child_process.spawn (FFmpeg)
- Storage: MinIO SDK (S3-compatible)
- Testes: Vitest + Testcontainers
- Linting: ESLint + Prettier (config Airbnb-TypeScript)

FERRAMENTAS OPEN SOURCE DE MEDIA (já instaladas no sistema):
- FFmpeg 6.x (com libvmaf, libx264, libx265, libfdk_aac)
- HandBrake CLI (HandBrakeCLI) — para presets de batch encoding
- MediaInfo CLI — análise de containers e streams
- FFprobe — análise frame-level e metadata
- MediaConch — conformance checking com policy XML
- BS1770GAIN — medição EBU R128 standalone

TAREFA: Construir o backend completo do Media Processing Hub com a seguinte estrutura:

src/
├── api/
│   ├── routes/
│   │   ├── assets.ts          # CRUD assets + status
│   │   ├── jobs.ts            # Submit/status/cancel jobs
│   │   └── webhooks.ts        # Inbound webhooks de playout systems
│   └── middleware/
│       ├── auth.ts            # JWT validation
│       └── rateLimiter.ts
├── workers/
│   ├── ingest.worker.ts       # Watch folder + S3 + FTP polling
│   ├── qc.worker.ts           # QC pré-encode (MediaInfo + FFprobe + MediaConch)
│   ├── analyzer.worker.ts     # Content analysis (SI/TI, complexity)
│   ├── transcode.worker.ts    # FFmpeg transcode com isolamento
│   ├── audio.worker.ts        # BS1770GAIN + FFmpeg loudness normalize
│   ├── subtitle.worker.ts     # Conversão SRT→TTML→WebVTT→CEA-708
│   ├── proxy.worker.ts        # Proxy LowRes + Thumbnail sprites
│   ├── qc-post.worker.ts      # QC pós-encode (VMAF + checksum + loudness)
│   └── delivery.worker.ts     # Upload S3/FTP + metadata sidecar
├── pipeline/
│   ├── orchestrator.ts        # Temporal.io workflow definitions
│   ├── profiles.ts            # Perfis broadcast/OTT/archive/web
│   └── ffmpeg/
│       ├── builder.ts         # FFmpeg command builder type-safe
│       ├── executor.ts        # Spawn isolado com timeout + kill
│       └── parser.ts          # Parse stderr FFmpeg → structured logs
├── qc/
│   ├── rules/
│   │   ├── video.rules.ts     # GOP, CFR, pixfmt, colorimetry
│   │   ├── audio.rules.ts     # LUFS, True Peak, sample rate
│   │   └── container.rules.ts # moov atom, edit lists, timecodes
│   ├── vmaf.ts                # libvmaf integration + scoring
│   └── mediaconch.ts          # Policy XML conformance
├── models/
│   ├── asset.model.ts
│   ├── job.model.ts
│   └── audit.model.ts         # Append-only, nunca UPDATE/DELETE
├── events/
│   ├── emitter.ts             # Internal event bus
│   └── webhooks.ts            # Outbound webhook dispatcher
└── observability/
    ├── metrics.ts             # Prometheus client + custom metrics
    ├── logger.ts              # Pino structured JSON logger
    └── tracing.ts             # OpenTelemetry setup

REGRAS DE IMPLEMENTAÇÃO OBRIGATÓRIAS:

1. FFmpeg NUNCA é executado inline no processo principal:
   - Sempre via child_process.spawn em processo filho isolado
   - Timeout máximo configurável por tipo de job (default: 4h transcode)
   - SIGTERM → esperar 5s → SIGKILL se não terminar
   - Captura de stderr linha a linha com parse estruturado
   - Exit code 0 = sucesso, qualquer outro = falha com detalhe

2. GOP/Keyframe obrigatório em TODOS os transcode jobs:
   - -g [fps*2] (GOP = 2 segundos)
   - -keyint_min [fps*2]
   - -sc_threshold 0 (NUNCA keyframes extra em scene cuts)
   - -flags +cgop (Closed GOP)
   - -x264-params "open-gop=0:bframes=0" (H.264)
   - -bf 0 explícito (sem B-frames em linear broadcast)

3. Áudio obrigatório — two-pass EBU R128:
   - Pass 1: análise com loudnorm print_format=json
   - Parse dos valores medidos: measured_I, measured_TP, measured_LRA, measured_thresh, offset
   - Pass 2: normalização linear com valores exactos
   - Verificação pós-encode com BS1770GAIN ou ebur128 filter
   - Falha se True Peak > -1 dBTP após encode

4. QC rules devem ser composable e testáveis unitariamente:
   - Cada regra é uma função pura: (metadata) => QCResult
   - QCResult: { pass: boolean, severity: 'critical'|'warning'|'info', code: string, detail: string }
   - Rules executadas em paralelo com Promise.allSettled
   - Um 'critical' fail → REJECT. Múltiplos 'warning' → QUARANTINE

5. Audit trail é imutável:
   - Tabela PostgreSQL com INSERT-only (sem UPDATE, sem DELETE)
   - RLS policy: apenas INSERT e SELECT
   - Cada evento tem: asset_id, timestamp, event_type, operator, payload JSON
   - Nunca purgar — usar particionamento por mês se necessário

6. Todos os checksums são SHA-256 (nunca MD5):
   - Calculado no ingest (ficheiro original)
   - Calculado no output (ficheiro processado)
   - Verificado após upload (comparar com ETag S3)

7. HandBrake CLI para jobs de batch com presets:
   - Usar HandBrakeCLI --preset-import-file com presets JSON custom
   - Presets definidos para: WebOptimized, BroadcastHD, ProxyLowRes
   - FFmpeg para jobs que precisam de controlo fine-grained (broadcast, OTT)

PERFIS DE ENCODING A IMPLEMENTAR (ficheiro profiles.ts):

broadcast_hd:
  container: mxf_op1a
  video: h264, high, 4.1, yuv420p, 8000k, closed GOP 50fr, 0 bframes
  audio: pcm_s24le, 48000, -23 LUFS, -1 dBTP

ott_premium:
  container: cmaf (fmp4)
  video: h265, main, yuv420p10le, ladder dinâmica
  audio: eac3, -14 LUFS, -1 dBTP
  drm: placeholder para Widevine/FairPlay

streaming_web:
  container: mp4 + faststart
  video: h264, high, 4.0, yuv420p, ladder 480p/720p/1080p
  audio: aac, 192kbps, 48000, -14 LUFS

proxy_lowres:
  container: mp4 + faststart  
  video: h264, baseline, 1280x720, 800kbps
  audio: aac, 128kbps

archive:
  container: mxf_op1a
  video: prores_4444 ou prores_422hq
  audio: pcm_s24le

MÉTRICAS PROMETHEUS A EXPOR (/metrics endpoint):
- media_assets_ingested_total (counter)
- media_assets_rejected_total {reason} (counter)
- media_transcode_duration_seconds (histogram, buckets: 30s,2m,10m,30m,1h,4h)
- media_queue_depth {worker_type} (gauge)
- media_vmaf_score (histogram)
- media_loudness_lufs (histogram)
- media_job_success_rate (gauge, janela 5min)
- media_ffmpeg_timeout_total (counter)
- media_upload_duration_seconds (histogram)

SCHEMA PRISMA (base — expandir conforme necessário):

model Asset {
  id            String    @id @default(uuid())
  originalName  String
  sha256Input   String
  sha256Output  String?
  status        AssetStatus
  profile       String
  durationMs    Int?
  frameRate     Float?
  resolution    String?
  vmafScore     Float?
  loudnessLufs  Float?
  truePeakDbtp  Float?
  deliveryUrl   String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  jobs          Job[]
  auditLogs     AuditLog[]
}

enum AssetStatus {
  INGESTED
  QC_PENDING
  QC_PASS
  QC_QUARANTINE
  QC_REJECT
  ANALYZING
  TRANSCODING
  QC_POST
  DELIVERING
  READY
  FAILED
}

model Job {
  id         String    @id @default(uuid())
  assetId    String
  type       JobType
  status     JobStatus
  attempts   Int       @default(0)
  payload    Json
  result     Json?
  error      String?
  startedAt  DateTime?
  finishedAt DateTime?
  asset      Asset     @relation(fields: [assetId], references: [id])
}

model AuditLog {
  id        String   @id @default(uuid())
  assetId   String
  eventType String
  operator  String
  payload   Json
  createdAt DateTime @default(now())
  asset     Asset    @relation(fields: [assetId], references: [id])
  @@index([assetId, createdAt])
}

ENTREGÁVEIS ESPERADOS:
1. Repositório com estrutura acima completamente implementada
2. Docker Compose com: app, postgres, redis, minio, prometheus, grafana
3. .env.example com todas as variáveis necessárias
4. Scripts npm: dev, build, test, lint, migrate, seed
5. README com: setup, arquitetura, variáveis, endpoints API
6. Colecção Insomnia/Postman para todos os endpoints
7. Testes de integração para: ingest, QC, transcode, delivery

COMEÇAR POR (nesta ordem):
1. Setup do projeto (package.json, tsconfig, eslint, docker-compose)
2. Schema Prisma + migrations
3. FFmpeg executor isolado com timeout (transcode.worker.ts base)
4. QC rules engine (video.rules.ts + audio.rules.ts)
5. BullMQ queues setup
6. API routes base (assets + jobs)
7. Testes unitários das QC rules
```

---

---

# ═══════════════════════════════════════════
# PROMPT 2 — OPENAI CODEX / O1
# Orquestração · Decision Engine · API Design
# ═══════════════════════════════════════════

```
ROLE: Senior Systems Architect — Media Processing Hub

You are building the intelligent decision layer and API surface of a 
broadcast-grade Media Processing Hub. The backend workers (FFmpeg, MediaInfo, 
BullMQ) are already built. Your job is the orchestration brain.

CONTEXT: This is a TypeScript/Node.js system using:
- Temporal.io for workflow orchestration
- Fastify for HTTP API
- BullMQ + Redis for job queues
- PostgreSQL + Prisma for persistence
- Open source media tools: FFmpeg, HandBrakeCLI, MediaInfo, MediaConch, libvmaf

YOUR TASKS:

═══════════════════════════
TASK 1: TEMPORAL.IO WORKFLOWS
═══════════════════════════

Build the main workflow: processAssetWorkflow(assetId: string)

The workflow must execute these activities in sequence/parallel:

SEQUENTIAL (each must succeed before next):
1. validateQC()          → timeout 5min, maxAttempts 3
2. analyzeContent()      → timeout 10min, maxAttempts 2

PARALLEL (after analyzeContent):
3a. transcodeVideo()     → timeout 4h, maxAttempts 2
3b. normalizeAudio()     → timeout 30min, maxAttempts 3
3c. processCaptions()    → timeout 20min, maxAttempts 2, optional

SEQUENTIAL (after parallel group completes):
4. generateProxies()     → timeout 1h, maxAttempts 2
5. generateThumbnails()  → timeout 10min, maxAttempts 3
6. runPostEncodeQC()     → timeout 30min, maxAttempts 1 (no retry — if fails, re-encode)
7. deliver()             → timeout 2h, maxAttempts 3

FAILURE HANDLING:
- If validateQC fails with REJECT → terminate workflow, emit AssetRejected event
- If validateQC fails with QUARANTINE → pause, wait for human signal, timeout 48h
- If transcodeVideo fails after maxAttempts → emit TranscodeFailed, escalate
- If runPostEncodeQC fails VMAF check → trigger re-encode with adjusted params
- All retries use exponential backoff: 1s, 10s, 60s

═══════════════════════════
TASK 2: DECISION ENGINE
═══════════════════════════

Build a deterministic Decision Engine that receives media analysis and 
outputs processing instructions. No randomness. No assumptions.

Input type:
interface MediaAnalysis {
  // From FFprobe
  container: string;
  videoCodec: string;
  videoProfile: string;
  videoLevel: string;
  pixelFormat: string;
  frameRate: number;
  frameRateMode: 'CFR' | 'VFR';
  resolution: { width: number; height: number };
  bitrate: number;
  bitDepth: 8 | 10 | 12;
  colorSpace: string;
  colorPrimaries: string;
  transferCharacteristics: string;
  gopType: 'CLOSED' | 'OPEN' | 'UNKNOWN';
  hasIdrFrames: boolean;
  bFrameCount: number;
  // From BS1770GAIN / FFprobe
  audioCodec: string;
  audioSampleRate: number;
  audioBitDepth: number;
  audioChannels: number;
  integratedLoudnessLufs: number | null;
  truePeakDbtp: number | null;
  // Derived
  contentType: 'talking_head' | 'sport' | 'cinema' | 'animation' | 'news' | 'unknown';
  spatialInformation: number;    // SI score
  temporalInformation: number;   // TI score
}

Output type:
interface ProcessingDecision {
  action: 'COPY' | 'REMUX' | 'TRANSCODE' | 'REJECT';
  rejectReason?: string;
  targetProfile: 'broadcast_hd' | 'ott_premium' | 'streaming_web' | 'proxy_lowres' | 'archive';
  transcodeRequired: boolean;
  audioNormalizationRequired: boolean;
  captionProcessingRequired: boolean;
  hdrConversionRequired: boolean;
  
  videoParams: {
    codec: 'h264' | 'h265' | 'prores_4444' | 'prores_422hq';
    profile: string;
    level: string;
    pixelFormat: 'yuv420p' | 'yuv420p10le';
    gopSize: number;         // Always = fps * 2 (2-second GOP)
    keyintMin: number;       // Always = gopSize
    scThreshold: 0;          // ALWAYS 0
    closedGop: true;         // ALWAYS true
    bFrames: 0;              // ALWAYS 0 for broadcast linear
    targetBitrateKbps: number;
    maxrateKbps: number;
    bufsize: number;         // Always = maxrate * 2
    colorSpace: string;
    colorPrimaries: string;
    colorTrc: string;
  };
  
  audioParams: {
    codec: 'aac' | 'pcm_s24le' | 'eac3';
    sampleRate: 48000;       // ALWAYS 48000
    targetLufs: -23 | -14;  // -23 broadcast EU, -14 streaming
    truePeakLimit: -1;       // ALWAYS -1 dBTP
    channels: number;
    bitrateKbps?: number;
  };
  
  estimatedDurationMs: number;
  priorityLevel: 'critical' | 'high' | 'normal' | 'low';
  ffmpegParams: string[];    // Final validated FFmpeg argument array
  handbrakePreset?: string;  // If HandBrake can handle this job
}

Decision logic rules (implement exactly):
1. If VFR detected → always TRANSCODE (CFR required)
2. If Open GOP detected → always TRANSCODE (Closed GOP required)
3. If B-frames > 0 AND target is broadcast → always TRANSCODE
4. If pixelFormat not yuv420p AND not targeting HDR → always TRANSCODE
5. If audio True Peak > -1 dBTP → audio normalization required
6. If integrated LUFS differs from target by > 1 LU → normalization required
7. If codec matches + GOP compliant + CFR + no issues → action = COPY or REMUX
8. COPY only if container matches target AND all params compliant
9. REMUX if video stream compliant but container needs changing
10. GOP size = Math.round(frameRate) * 2 (always 2-second groups)
11. bufsize = maxrateKbps * 2 (VBV buffer for STB compatibility)
12. contentType 'sport' → increase bitrate 30% above base target
13. contentType 'animation' → decrease bitrate 40% (high compressibility)

═══════════════════════════
TASK 3: REST API — OpenAPI 3.1 SPEC + IMPLEMENTATION
═══════════════════════════

Design and implement a complete REST API with these endpoints:

POST   /api/v1/assets                    → Ingest new asset (multipart or URL)
GET    /api/v1/assets                    → List assets (pagination, filters)
GET    /api/v1/assets/:id                → Asset detail + current status
DELETE /api/v1/assets/:id               → Soft delete (marks as archived)
GET    /api/v1/assets/:id/status         → Status polling (SSE stream available)
GET    /api/v1/assets/:id/jobs           → All jobs for this asset
GET    /api/v1/assets/:id/audit          → Immutable audit trail
GET    /api/v1/assets/:id/qc-report      → Full QC report JSON
GET    /api/v1/assets/:id/download/:type → Presigned URL for output file
POST   /api/v1/assets/:id/reprocess      → Re-trigger processing with new profile

POST   /api/v1/jobs                      → Submit manual job
GET    /api/v1/jobs/:id                  → Job status + logs
DELETE /api/v1/jobs/:id                 → Cancel job (if cancellable)

GET    /api/v1/profiles                  → List available encoding profiles
GET    /api/v1/profiles/:name            → Profile detail + FFmpeg params

GET    /api/v1/metrics/summary           → Aggregate metrics for dashboard
GET    /api/v1/queue/stats               → Queue depths, workers, throughput

POST   /api/v1/webhooks/playout          → Receive events from playout systems
POST   /api/v1/webhooks/register         → Register outbound webhook endpoint

API STANDARDS:
- All responses: { data: T, meta: { requestId, timestamp, version } }
- All errors: { error: { code, message, details }, meta: { requestId } }
- Pagination: { data: T[], meta: { total, page, pageSize, hasMore } }
- Status codes: 200, 201, 202 (async accepted), 400, 401, 403, 404, 409, 422, 429, 500
- Rate limiting: 1000 req/min per API key
- All IDs: UUID v4
- All timestamps: ISO 8601 UTC
- Authentication: Bearer JWT (RS256)

GENERATE:
1. Complete OpenAPI 3.1 YAML spec
2. Fastify route implementations with Zod validation schemas
3. Error handling middleware
4. Request/response type generation from OpenAPI spec
5. Integration tests for all endpoints (Vitest + Supertest)
```

---

---

# ═══════════════════════════════════════════
# PROMPT 3 — GOOGLE AI STUDIO / GEMINI
# Frontend · Dashboard · UX Profissional
# ═══════════════════════════════════════════

```
ROLE: Senior Frontend Engineer — Media Processing Hub UI

You are building the professional web interface for the Media Processing Hub.
The backend API is already built (REST API documented in OpenAPI 3.1 spec).

STACK:
- Next.js 14 (App Router, Server Components)
- TypeScript strict
- Tailwind CSS + shadcn/ui
- TanStack Query v5 (server state)
- Zustand (client state)
- Recharts (data visualization)
- React Hook Form + Zod (forms)
- nuqs (URL state management)

DESIGN SYSTEM RULES:
- Dark mode first, light mode supported
- Font: Inter (body), JetBrains Mono (code/metrics)
- Colors: neutral grays + single accent (blue-600)
- No gradients in data-critical UI
- Status colors: green (ready), amber (processing), red (failed), gray (pending)
- All numbers rounded: use Intl.NumberFormat

APPLICATION STRUCTURE:

app/
├── (dashboard)/
│   ├── layout.tsx               # Sidebar nav + topbar
│   ├── page.tsx                 # Overview dashboard
│   ├── assets/
│   │   ├── page.tsx             # Assets list with filters
│   │   ├── [id]/
│   │   │   ├── page.tsx         # Asset detail
│   │   │   ├── qc-report/
│   │   │   └── audit/
│   ├── jobs/
│   │   └── page.tsx             # Jobs monitor (live)
│   ├── queue/
│   │   └── page.tsx             # Queue stats + worker health
│   └── settings/
│       ├── profiles/            # Encoding profile management
│       └── webhooks/            # Webhook registration
└── api/                         # Next.js route handlers (BFF layer)

PAGES TO BUILD:

─────────────────────
PAGE 1: Overview Dashboard
─────────────────────
Layout: 4 metric cards (top) + 2 charts (middle) + recent activity (bottom)

Metric cards:
- Assets processed today (count + % vs yesterday)
- Success rate (%, last 24h)
- Average transcode time (minutes)
- Queue depth (current)

Charts:
- Line chart: Assets processed per hour (last 24h) — Recharts
- Bar chart: Error types distribution (last 7d)

Recent activity table:
- Asset name | Profile | Status | Duration | VMAF | Time
- Live update via SSE or polling every 10s
- Status badges: color-coded, animated for 'processing'

─────────────────────
PAGE 2: Assets List
─────────────────────
- Table with: filename, status badge, profile, resolution, duration, VMAF score, uploaded
- Filters: status (multi-select), profile, date range, search by filename
- Sort: any column
- Pagination: 25/50/100 per page
- Bulk actions: reprocess, download, archive
- Upload zone: drag-and-drop or URL input (multipart upload with progress bar)
- All filter state in URL params (nuqs)

─────────────────────
PAGE 3: Asset Detail
─────────────────────
Tabs: Overview | QC Report | Jobs | Audit Trail | Downloads

Overview tab:
- Video player (proxy lowres) with waveform audio visualization
- Technical specs grid: codec, resolution, fps, bitrate, colorimetry, GOP
- Audio specs: channels, sample rate, LUFS, True Peak
- VMAF score gauge (0-100, color: red<70, amber<85, green≥85)
- Timeline of processing steps (completed checkmarks)

QC Report tab:
- Per-check result table: check name | result (PASS/FAIL/WARN) | severity | detail
- Critical failures highlighted in red
- Exportable as PDF

Jobs tab:
- All jobs for this asset in timeline view
- Each job: type, status, duration, attempts, logs (expandable)
- Live update for active jobs

Audit Trail tab:
- Chronological immutable log
- Each entry: timestamp, event type, operator, payload (expandable JSON)

Downloads tab:
- Available outputs: [Broadcast HD MXF] [OTT Premium CMAF] [Web MP4] [Proxy] [Thumbnails]
- Each output: size, format, generated date, presigned download button (valid 1h)

─────────────────────
PAGE 4: Queue Monitor
─────────────────────
- Worker health grid: worker name | status (active/idle/dead) | current job | uptime
- Queue depth bars: ingest / qc / transcode / audio / delivery
- Throughput chart: jobs/hour last 6h
- Dead letter queue: failed jobs with retry/discard actions

─────────────────────
PAGE 5: Upload Flow
─────────────────────
- Step 1: Drop zone (drag-and-drop, multi-file, URL input)
- Step 2: Profile selector (cards: Broadcast HD | OTT Premium | Web | Archive)
- Step 3: Options (priority, webhook URL, custom metadata)
- Step 4: Progress (per-file upload progress + processing status)
- On complete: link to asset detail

COMPONENT REQUIREMENTS:
- StatusBadge: animated pulse for 'processing', static for others
- VMaFGauge: semicircle gauge with numeric value
- LoudnessMeter: horizontal bar from -40 to 0 LUFS with target zone marked
- CodecBadge: colored pill per codec (H.264=blue, H.265=purple, ProRes=green)
- TimecodeDisplay: HH:MM:SS:FF format
- FileDropzone: with MIME type validation + size limit feedback
- QCResultRow: expandable with detail + severity icon

REAL-TIME REQUIREMENTS:
- Asset status updates: SSE /api/v1/assets/:id/status
- Queue stats: polling 5s (not SSE — avoid WebSocket overhead)
- Dashboard metrics: polling 30s
- On status change to READY: browser notification (if permission granted)

ACCESSIBILITY:
- WCAG 2.1 AA minimum
- All status colors have text label (never color-only)
- Keyboard navigable
- Focus indicators visible
```

---

---

# ═══════════════════════════════════════════
# PROMPT 4 — KIMI (Long Context)
# Análise de Logs · Debug · Troubleshooting
# ═══════════════════════════════════════════

```
ROLE: Log Analysis and Debug Intelligence — Media Processing Hub

You are the debugging and log analysis layer of a broadcast-grade 
Media Processing Hub. You receive raw logs from FFmpeg, MediaInfo, 
MediaConch, BullMQ, and system processes, and produce structured 
diagnostic reports.

YOUR CAPABILITIES:
- Parse FFmpeg stderr (full verbosity -v verbose or -v debug)
- Parse MediaInfo XML/JSON output
- Parse MediaConch policy XML reports
- Parse BullMQ job logs and error stacks
- Parse BS1770GAIN output for loudness measurements
- Correlate logs across multiple services for a single asset_id

INPUT FORMAT you will receive:
{
  "asset_id": "uuid",
  "timestamp_range": { "from": "ISO8601", "to": "ISO8601" },
  "logs": {
    "ffmpeg_stderr": "...",
    "mediainfo_json": {...},
    "mediaconch_report": "...",
    "bullmq_job": {...},
    "system": "..."
  }
}

OUTPUT FORMAT you must produce:
{
  "asset_id": "uuid",
  "analysis_timestamp": "ISO8601",
  "severity": "CRITICAL | HIGH | MEDIUM | LOW | INFO",
  "root_cause": {
    "category": "codec | container | audio | io | hardware | network | config | unknown",
    "description": "Human-readable root cause in pt-PT",
    "technical_detail": "Technical explanation for engineers",
    "evidence": ["log line or evidence that supports this conclusion"]
  },
  "issues_found": [
    {
      "code": "ERR_GOP_OPEN | ERR_VFR | ERR_LUFS | ERR_VMAF | ERR_CORRUPT | ...",
      "severity": "critical | warning | info",
      "description": "...",
      "location": "timestamp or frame number if available",
      "raw_evidence": "exact log excerpt"
    }
  ],
  "fix_strategy": {
    "action": "retry | adjust_params | reject | manual_review | escalate",
    "automated_fix_possible": true | false,
    "steps": [
      "Specific actionable step 1",
      "Specific actionable step 2"
    ],
    "ffmpeg_params_to_change": {
      "remove": ["-param old_value"],
      "add": ["-param new_value"]
    }
  },
  "retry_recommendation": {
    "should_retry": true | false,
    "max_retries": 0 | 1 | 2 | 3,
    "backoff_seconds": [1, 10, 60],
    "reason": "..."
  },
  "escalation": {
    "required": true | false,
    "reason": "...",
    "suggested_action": "human review | support ticket | vendor contact"
  }
}

FFmpeg ERROR PATTERNS you must recognize and handle:

CRITICAL (stop and reject):
- "moov atom not found" → container corrupt, MP4 não-seekable
- "Invalid data found when processing input" → stream corrupt ou truncado
- "No such file or directory" → ficheiro desapareceu durante processamento
- "Permission denied" → problema de filesystem
- "Conversion failed!" → encode falhou completamente

HIGH (retry with adjustment):
- "DTS .* out of order" → problema de timestamps, tentar -fflags +igndts
- "Application provided invalid, non monotonically increasing dts" → timestamp issue
- "Error while opening encoder" → codec params inválidos
- "Past duration .* too large" → bitrate ou buffer issue → ajustar VBV
- "Queue input is backward in time" → tentar -vsync cfr

MEDIUM (warning, continue):
- "Last message repeated" → possível loop, monitorizar
- "Dropping duplicated frame" → stream tem frames duplicadas
- "PTS .* < DTS" → problema menor de timestamps

AUDIO-SPECIFIC:
- "Discarding invalid" → amostras de áudio inválidas
- Loudness > -1 dBTP após encode → normalização falhou, re-tentar com margem extra
- LUFS desvio > 1 LU do target → two-pass falhou, verificar measured_* values

GOP-SPECIFIC:
- Detetar se output tem keyframe interval inconsistente:
  analisar linhas "frame= N fps= X" com keyframe markers
- Detetar se Closed GOP foi cumprido:
  procurar por "slice_type=I" vs "IDR" no debug output

TASK — BUILD THESE TOOLS:

1. LogParser class: parse raw FFmpeg stderr into structured events
2. PatternMatcher: match error patterns above, return severity + code
3. DiagnosticEngine: correlate all logs, produce root_cause
4. FixSuggester: given root_cause + issues, produce fix_strategy
5. RetryAdvisor: given fix_strategy, decide retry params

Also build:
- A daily log digest report (aggregate errors in last 24h, top 10 issues)
- An anomaly detector (if error rate suddenly increases vs baseline)
- A performance regression detector (if avg transcode time increases >20%)
```

---

---

# ═══════════════════════════════════════════
# PROMPT 5 — DEEPSEEK CODER
# Otimização · FFmpeg Commands · GPU · Performance
# ═══════════════════════════════════════════

```
ROLE: FFmpeg Optimization and Performance Engineer

You are the encoding optimization layer of a broadcast-grade 
Media Processing Hub. Your job is to generate optimal FFmpeg 
commands and optimize system performance.

OPEN SOURCE TOOLS AVAILABLE:
- FFmpeg 6.x with: libx264, libx265, libvpx-vp9, libfdk_aac, 
  libopus, libvmaf, nvenc (NVIDIA), qsv (Intel), amf (AMD)
- HandBrakeCLI with GPU presets
- MediaInfo for stream analysis
- BS1770GAIN for standalone loudness measurement

SYSTEM CONSTRAINTS:
- Production server: may have NVIDIA GPU (nvenc) or CPU-only
- Must detect GPU availability at runtime and fallback gracefully
- Memory limit per FFmpeg process: 8GB
- CPU limit per FFmpeg process: 4 cores (configurable)
- Must support concurrent jobs (4-8 simultaneous transcode)

TASK 1: FFmpeg Command Generator

Build a type-safe FFmpeg command builder in TypeScript that generates
verified, production-safe commands for each profile.

For EACH profile, generate two commands:
A) GPU-accelerated (nvenc/qsv/amf) — preferred if GPU available
B) CPU fallback — always works, slightly slower

BROADCAST HD (H.264, GPU):
ffmpeg -y \
  -hwaccel cuda -hwaccel_output_format cuda \
  -i {input} \
  -c:v h264_nvenc \
  -preset p4 -tune hq \
  -profile:v high -level:v 4.1 \
  -pix_fmt yuv420p \
  -g {gop_size} -keyint_min {gop_size} \
  -forced-idr 1 \
  -no-scenecut 1 \
  -b:v {bitrate}k -maxrate {maxrate}k -bufsize {bufsize}k \
  -rc cbr \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a pcm_s24le -ar 48000 \
  {audio_loudnorm_params} \
  -movflags +faststart \
  {output}

BROADCAST HD (H.264, CPU fallback):
ffmpeg -y \
  -i {input} \
  -c:v libx264 \
  -preset slow -tune film \
  -profile:v high -level:v 4.1 \
  -pix_fmt yuv420p \
  -g {gop_size} -keyint_min {gop_size} \
  -sc_threshold 0 \
  -flags +cgop \
  -x264-params "open-gop=0:bframes=0:ref=4:nal-hrd=cbr:force-cfr=1" \
  -b:v {bitrate}k -maxrate {maxrate}k -bufsize {bufsize}k \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a pcm_s24le -ar 48000 \
  {audio_loudnorm_params} \
  -movflags +faststart \
  {output}

OTT PREMIUM (H.265, GPU):
ffmpeg -y \
  -hwaccel cuda -hwaccel_output_format cuda \
  -i {input} \
  -c:v hevc_nvenc \
  -preset p5 -tune hq \
  -profile:v main10 \
  -pix_fmt p010le \
  -g {gop_size} -keyint_min {gop_size} \
  -forced-idr 1 \
  -b:v {bitrate}k -maxrate {maxrate}k -bufsize {bufsize}k \
  -tag:v hvc1 \
  -c:a eac3 -b:a 384k -ar 48000 \
  {audio_loudnorm_params} \
  {output}

PROXY LOWRES (HandBrake CLI — fastest for proxies):
HandBrakeCLI \
  --input {input} \
  --output {output} \
  --preset "Fast 720p30" \
  --vb 800 \
  --two-pass \
  --turbo \
  --audio-lang-list "any" \
  --aencoder copy:aac \
  --ab 128

TASK 2: GPU Detection and Fallback System

Build a runtime GPU detector:
1. Check for nvidia-smi → CUDA available?
2. Check for vainfo → VAAPI available (Intel/AMD)?
3. Run test encode (5 frames) with GPU params → success?
4. If test fails → fallback to CPU automatically
5. Cache result per session (re-check every 30min)

Build performance estimator:
- Given input metadata (duration, resolution, bitrate, codec)
- Given hardware (GPU/CPU, cores, RAM)
- Estimate: encoding time, output size
- Accuracy target: ±20%

TASK 3: Concurrent Job Optimizer

Build a job scheduler that:
1. Maintains target CPU utilization: 70-85%
2. Slots GPU jobs separately from CPU jobs
3. Gives priority to: broadcast profiles > OTT > web > proxy
4. Preempts low-priority jobs if high-priority arrives
5. Tracks: jobs_per_minute, avg_realtime_factor, gpu_utilization

TASK 4: Two-Pass Loudness Implementation

Implement the complete two-pass EBU R128 normalization:

Pass 1 (analysis):
ffmpeg -i {input} \
  -af "loudnorm=I=-{target_lufs}:TP=-1:LRA=11:print_format=json" \
  -f null -

Parse JSON output, extract:
- input_i (measured integrated loudness)
- input_tp (measured true peak)
- input_lra (loudness range)
- input_thresh (threshold)
- target_offset (correction offset)

Pass 2 (normalization) — linear mode:
ffmpeg -i {input} \
  -af "loudnorm=I=-{target_lufs}:TP=-1:LRA=11:\
       measured_I={input_i}:measured_TP={input_tp}:\
       measured_LRA={input_lra}:measured_thresh={input_thresh}:\
       offset={target_offset}:linear=true" \
  {output}

Validation pass:
ffmpeg -i {output} \
  -af "ebur128=peak=true:framelog=verbose" \
  -f null - 2>&1

Parse validation output:
- "Integrated loudness" → must be within ±0.5 LU of target
- "True peak" → must be ≤ -1.0 dBTP
- If fails → retry with offset adjustment (+/-0.5 LU) max 3 attempts

TASK 5: VMAF Integration

Build VMAF scorer for post-encode QC:
ffmpeg \
  -i {reference_mezzanine} \
  -i {encoded_output} \
  -lavfi "[0:v][1:v]libvmaf=\
    log_fmt=json:\
    log_path={vmaf_log}:\
    n_subsample=5:\
    model=version=vmaf_v0.6.1" \
  -f null -

Parse vmaf_log JSON:
- Extract: mean, min, percentiles (1st, 5th, 10th)
- Use 1st percentile as quality floor (worst moment)
- Thresholds: archive≥93, broadcast≥90, streaming≥85, proxy≥70
- If below threshold: log reason, trigger re-encode with adjusted CRF/bitrate

DELIVERABLES:
1. FFmpegCommandBuilder class with full type safety
2. GPU detection module with test-encode validation
3. ConcurrentJobScheduler with priority queuing
4. LoudnessNormalizer (two-pass + validation)
5. VMAFScorer with threshold logic
6. HandBrakePresetManager for proxy jobs
7. Performance benchmarks comparing GPU vs CPU for each profile
8. Unit tests for all command builders (test: generated command contains required params)
```

---

---

# ═══════════════════════════════════════════
# PROMPT 6 — QUALQUER IDE (Integration Prompt)
# Docker · CI/CD · Deployment · Infra
# ═══════════════════════════════════════════

```
ROLE: DevOps / Infrastructure Engineer — Media Processing Hub

Build the complete infrastructure layer for production deployment.

DOCKER COMPOSE (development + staging):

Services required:
1. app           — Node.js API (Fastify) — port 3000
2. worker        — BullMQ workers (all types) — no port
3. temporal      — Temporal.io server — port 7233
4. temporal-ui   — Temporal web UI — port 8080
5. postgres      — PostgreSQL 15 — port 5432
6. redis         — Redis 7 — port 6379
7. minio         — MinIO S3-compatible — ports 9000, 9001
8. prometheus    — Metrics collection — port 9090
9. grafana       — Dashboards — port 3001
10. loki         — Log aggregation — port 3100

Media tools (build custom image):
- Base: ubuntu:22.04
- Install: ffmpeg 6.x (with libvmaf, libx264, libx265, libfdk_aac)
- Install: mediainfo, ffprobe, mediaconch, bs1770gain, handbrake-cli
- Install: Node.js 20 LTS
- Non-root user: mediaworker (UID 1001)

Resource limits per service:
- app: 1 CPU, 512MB RAM
- worker (transcode): 4 CPU, 8GB RAM (per instance)
- postgres: 2 CPU, 2GB RAM
- redis: 0.5 CPU, 512MB RAM
- minio: 1 CPU, 1GB RAM

Volumes:
- postgres_data → /var/lib/postgresql/data
- redis_data → /data
- minio_data → /data
- media_input → /media/input (watch folder)
- media_output → /media/output
- media_temp → /media/temp (processing scratch)
- grafana_data → /var/lib/grafana
- prometheus_data → /prometheus

Environment variables (.env):
DATABASE_URL=postgresql://media:secret@postgres:5432/media_hub
REDIS_URL=redis://redis:6379
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_INPUT=media-input
MINIO_BUCKET_OUTPUT=media-output
TEMPORAL_ADDRESS=temporal:7233
JWT_SECRET=change-in-production
PROMETHEUS_PORT=9100
LOG_LEVEL=info
MAX_CONCURRENT_TRANSCODE_JOBS=4
FFMPEG_DEFAULT_TIMEOUT_MS=14400000
WORKER_CONCURRENCY=8

GRAFANA DASHBOARDS (provision automatically):
1. Media Hub Overview — main ops dashboard
   - Panels: jobs/min, success rate, queue depth, avg transcode time
   - Alerts pre-configured
2. Quality Metrics — VMAF and loudness
   - Panels: VMAF distribution, loudness histogram, rejection rate by reason
3. Infrastructure — system health
   - Panels: CPU/RAM/disk per service, FFmpeg process count, Redis memory

PROMETHEUS ALERTS (alertmanager config):
- MediaPipelineStalled: queue_depth > 50 for 10m → critical
- HighRejectionRate: rejection_rate > 0.20 for 5m → warning
- WorkerDown: worker heartbeat missing 2m → critical
- LowVMAFScore: vmaf_p50 < 85 for 15m → warning
- FFmpegTimeout: ffmpeg_timeout_total increase > 0 → critical
- DiskSpaceWarning: disk_usage > 80% → warning

CI/CD (GitHub Actions):
jobs:
  test: vitest + coverage (min 80%)
  lint: eslint + prettier check
  build: docker build + push to registry
  deploy-staging: docker compose pull + up (staging env)
  deploy-prod: (manual approval required) → blue-green deploy

HEALTH CHECKS:
GET /health → { status: 'ok', timestamp, version, uptime }
GET /health/ready → checks: DB connected, Redis connected, MinIO accessible
GET /health/live → process alive check

SCRIPTS (package.json):
"dev": "docker compose up -d postgres redis minio && tsx watch src/index.ts"
"dev:all": "docker compose up -d"
"build": "tsc --noEmit && docker build -t media-hub ."
"test": "vitest run"
"test:watch": "vitest"
"test:coverage": "vitest run --coverage"
"lint": "eslint src --ext .ts"
"db:migrate": "prisma migrate deploy"
"db:seed": "tsx prisma/seed.ts"
"db:studio": "prisma studio"
"queue:flush": "tsx scripts/flush-queues.ts"
"worker": "tsx src/worker.ts"
```

---

## SEQUÊNCIA DE EXECUÇÃO RECOMENDADA

Execute os prompts nesta ordem para desenvolvimento mais rápido:

```
Semana 1:
  [Claude Code]   → Prompt 1 — Backend base + workers + QC rules
  [DeepSeek]      → Prompt 5 — FFmpeg commands + GPU detection

Semana 2:
  [OpenAI Codex]  → Prompt 2 — Temporal workflows + Decision Engine + API
  [Any IDE]       → Prompt 6 — Docker + infra + CI/CD

Semana 3:
  [Gemini/Claude] → Prompt 3 — Frontend completo
  [Kimi]          → Prompt 4 — Log analysis + debug engine

Semana 4:
  Integration testing
  Performance tuning (concurrent jobs, GPU vs CPU)
  Grafana dashboards fine-tuning
  End-to-end tests: ingest → QC → transcode → deliver
```

---

## CRITÉRIOS DE ACEITAÇÃO (Definition of Done)

Antes de considerar qualquer componente completo:

- [ ] Testes unitários com cobertura > 80%
- [ ] Testes de integração passam com Docker Compose
- [ ] Zero erros TypeScript strict
- [ ] ESLint sem warnings
- [ ] FFmpeg executor com timeout e isolamento verificados
- [ ] GOP correto verificado em output (FFprobe pós-encode)
- [ ] Loudness verificado em output (BS1770GAIN pós-encode)
- [ ] VMAF score calculado e guardado em DB
- [ ] SHA-256 calculado e verificado pré/pós upload
- [ ] Audit trail imutável testado (sem UPDATE/DELETE possíveis)
- [ ] Prometheus metrics expostas e validadas
- [ ] Grafana dashboard com dados reais
- [ ] README com setup em < 10 comandos
