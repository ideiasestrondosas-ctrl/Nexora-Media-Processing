# Nexora Media Processing
## Documento Técnico Completo — Especificação + Prompts + Guia de Execução

> Versão 2.0 | Arquitecto: Claude Sonnet  
> Stack: 100% Open Source | Broadcast & OTT Grade  
> Executável em: Claude Code · OpenAI Codex · Google AI Studio (Antigravity)

---

# ╔══════════════════════════════════════════╗
# ║  ANTES DE COMEÇAR — LÊ ISTO PRIMEIRO   ║
# ╚══════════════════════════════════════════╝

## O que é o Nexora Media Processing?

O **Nexora Media Processing** é uma plataforma profissional de processamento de vídeo e áudio. Recebe ficheiros de media em bruto (de câmaras, servidores, editores), valida-os automaticamente, corrige problemas de qualidade, converte-os para os formatos correctos e entrega-os prontos a emitir — seja em televisão, plataformas de streaming ou arquivo.

Pensa nisto como uma **linha de montagem automática para vídeo profissional**, com controlo de qualidade em cada etapa.

---

## 💡 Conselho de IDE — Qual usar se és iniciante?

Se é a primeira vez que interages com desenvolvimento assistido por IA, existe uma escolha clara:

### ✅ Recomendação principal: Cursor (cursor.com)

**Porquê o Cursor para um iniciante:**

O Cursor é um editor de código (baseado no VS Code, que já conheces se usas computador) com IA integrada que consegue:
- Ler todos os teus ficheiros de uma vez e entender o projecto completo
- Gerar código directamente nos ficheiros certos
- Explicar o que cada linha faz em português se pedires
- Corrigir erros automaticamente quando algo não funciona
- Executar comandos no terminal por ti

**Como se compara com as alternativas:**

| Ferramenta | Para quem é | Complexidade | Custo |
|---|---|---|---|
| **Cursor** ← recomendado | Iniciantes com IA | Baixa | $20/mês ou grátis limitado |
| VS Code + GitHub Copilot | Devs com alguma experiência | Média | $10/mês |
| Windsurf (Codeium) | Iniciantes, alternativa grátis | Baixa | Grátis / $15/mês |
| Claude Code (CLI) | Devs experientes | Alta | Pay-per-use |
| OpenAI Codex | Devs experientes | Alta | Pay-per-use |

**Sequência recomendada para iniciante:**
1. Instala o **Cursor** (cursor.com/download)
2. Usa o **Claude Code** dentro do Cursor (sim, é possível — ver secção abaixo)
3. Para revisão e análise usa o **Claude.ai** (esta janela)
4. Para tarefas específicas usa o **Google AI Studio** ou **OpenAI Codex**

---

---

# ╔══════════════════════════════════════════╗
# ║  PARTE I — GUIA DE EXECUÇÃO PASSO A    ║
# ║  PASSO (PARA ABSOLUTOS INICIANTES)     ║
# ╚══════════════════════════════════════════╝

## PASSO 0 — Preparação do Computador

Antes de qualquer prompt ou código, precisas de instalar ferramentas base.
Segue exactamente nesta ordem.

### 0.1 — Instalar Node.js

Node.js é o motor que corre o código do Nexora.

1. Vai a **nodejs.org**
2. Clica em "LTS" (a versão estável)
3. Descarrega e instala (Next, Next, Finish)
4. Abre o Terminal (Mac: Cmd+Espaço → "Terminal" | Windows: Tecla Windows → "cmd")
5. Escreve: `node --version`
6. Deves ver algo como: `v20.11.0` — se aparecer, está instalado ✓

### 0.2 — Instalar Git

Git é o sistema que guarda versões do código.

1. Vai a **git-scm.com/downloads**
2. Descarrega para o teu sistema operativo
3. Instala (todas as opções por defeito estão bem)
4. No Terminal: `git --version` → deves ver `git version 2.x.x` ✓

### 0.3 — Instalar Docker Desktop

Docker é o sistema que cria ambientes isolados para cada serviço.

1. Vai a **docker.com/products/docker-desktop**
2. Descarrega para Mac ou Windows
3. Instala e abre o Docker Desktop
4. Espera até aparecer o ícone de baleia verde no canto superior direito
5. No Terminal: `docker --version` → deves ver `Docker version 24.x.x` ✓

### 0.4 — Instalar FFmpeg (ferramenta de processamento de vídeo)

**Mac:**
```bash
# Instala o Homebrew primeiro (gestor de pacotes para Mac)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Depois instala FFmpeg
brew install ffmpeg
```

**Windows:**
1. Vai a **ffmpeg.org/download.html**
2. Clica em "Windows builds by BtbN"
3. Descarrega `ffmpeg-master-latest-win64-gpl.zip`
4. Extrai para `C:\ffmpeg`
5. Adiciona `C:\ffmpeg\bin` ao PATH do sistema
   (Pesquisa "variáveis de ambiente" no Windows → Variáveis do Sistema → Path → Novo → `C:\ffmpeg\bin`)

Verificar: `ffmpeg -version` no Terminal ✓

### 0.5 — Instalar Cursor (IDE recomendado)

1. Vai a **cursor.com**
2. Clica "Download"
3. Instala normalmente
4. Abre o Cursor
5. Faz login com Google ou GitHub
6. No canto superior direito, clica no ícone de chave inglesa → Settings
7. Em "AI Provider" selecciona "Claude" e introduz a tua API key do Anthropic
   (obtém em **console.anthropic.com** → API Keys → Create key)

---

## PASSO 1 — Criar a Pasta do Projecto

No Terminal:
```bash
# Ir para a pasta de projectos (ou Desktop)
cd ~/Desktop

# Criar pasta do projecto
mkdir nexora-media-processing
cd nexora-media-processing

# Inicializar repositório Git
git init
```

---

## PASSO 2 — Executar no CLAUDE CODE (via Cursor)

Claude Code é o agente de desenvolvimento principal do Nexora.
É o mais poderoso para código TypeScript/Node.js.

### Opção A — Claude Code via Cursor (RECOMENDADO para iniciantes)

1. Abre o Cursor
2. File → Open Folder → selecciona `nexora-media-processing`
3. Pressiona `Ctrl+L` (Windows) ou `Cmd+L` (Mac) para abrir o chat de IA
4. No campo de texto, escreve:

```
Vou colar um prompt técnico. Lê com atenção e implementa exactamente 
o que está descrito. Começa pelo passo 1 do prompt.
```

5. Cola o **PROMPT 1** (secção mais abaixo) e prime Enter
6. O Cursor vai começar a criar ficheiros automaticamente
7. Quando terminar, verás os ficheiros criados no painel esquerdo
8. Para executar, pressiona `Ctrl+`` ` para abrir o terminal integrado e segue as instruções que o Claude gerar

### Opção B — Claude Code CLI (para quando tiveres mais confiança)

```bash
# Instalar Claude Code
npm install -g @anthropic-ai/claude-code

# Verificar instalação
claude --version

# Navegar para a pasta do projecto
cd ~/Desktop/nexora-media-processing

# Iniciar Claude Code
claude

# Dentro do Claude Code, cola o prompt e prime Enter
```

**O que vai acontecer:** O Claude vai criar todos os ficheiros, instalar dependências, e dizer-te exactamente o que fazer em cada passo.

---

## PASSO 3 — Executar no OPENAI CODEX

Codex é usado para a camada de orquestração e API (Prompt 2).

1. Vai a **platform.openai.com**
2. Faz login ou cria conta
3. No menu lateral, clica em "Playground" → "Chat"
4. No topo, selecciona modelo: `o1` ou `gpt-4o`
5. Em "System prompt", escreve:
```
És um engenheiro sénior de software. Implementa exactamente o que te pedirem, 
em TypeScript, seguindo as especificações ao detalhe.
```
6. Na caixa de mensagem, cola o **PROMPT 2** e prima Enter
7. Copia o código gerado
8. No Cursor, cria os ficheiros indicados e cola o código

**Alternativa mais simples:** Usa o **ChatGPT Plus** (chatgpt.com) com o modelo GPT-4o — funciona da mesma forma mas com interface mais amigável.

---

## PASSO 4 — Executar no GOOGLE AI STUDIO (Antigravity)

Google AI Studio com Gemini é usado para o frontend (Prompt 3).

1. Vai a **aistudio.google.com**
2. Faz login com a tua conta Google
3. Clica em "Create new prompt"
4. No topo direito, selecciona modelo: `Gemini 2.0 Flash` ou `Gemini 2.5 Pro`
5. Em "System instructions" (clica na engrenagem), escreve:
```
És um engenheiro frontend sénior especializado em Next.js e React. 
Implementa exactamente o que te pedirem, com TypeScript e Tailwind CSS.
```
6. Cola o **PROMPT 3** na caixa principal e clica "Run"
7. Copia o código gerado e cola nos ficheiros correctos no Cursor

**Dica Antigravity:** No Google AI Studio existe uma funcionalidade "Code execution" — activa-a para que o Gemini possa testar o código que gera antes de te entregar.

---

## PASSO 5 — Iniciar o Projecto pela Primeira Vez

Depois de todos os prompts executados, no Terminal dentro do Cursor:

```bash
# 1. Instalar todas as dependências
npm install

# 2. Copiar o ficheiro de configuração
cp .env.example .env

# 3. Iniciar a base de dados e serviços auxiliares
docker compose up -d postgres redis minio temporal temporal-ui

# 4. Esperar 30 segundos para os serviços iniciarem
# (Podes ver os logs com: docker compose logs -f)

# 5. Criar as tabelas da base de dados
npm run db:migrate

# 6. Colocar dados de teste
npm run db:seed

# 7. Gerar ficheiros de vídeo para testes
npm run fixtures:generate

# 8. Iniciar o servidor da aplicação
npm run dev

# 9. Noutra janela do Terminal, iniciar os workers
npm run worker
```

Abre o browser em:
- **http://localhost:3000** → Aplicação Nexora
- **http://localhost:8080** → Temporal UI (monitorização de jobs)
- **http://localhost:3001** → Grafana (dashboard de métricas)
- **http://localhost:9001** → MinIO (gestão de ficheiros)

---

## PASSO 6 — Testar que Tudo Funciona

```bash
# Correr todos os testes
npm run test

# Ver cobertura de testes
npm run test:coverage

# Verificar qualidade do código
npm run lint
```

Se todos os testes passarem (verde), o Nexora está operacional. ✓

---

## PASSO 7 — Enviar o Primeiro Ficheiro de Vídeo

1. Abre **http://localhost:3000**
2. Clica no botão "Upload" ou arrasta um ficheiro de vídeo
3. Selecciona o perfil "Broadcast HD" ou "Web Streaming"
4. Clica "Processar"
5. Observa o progresso em tempo real
6. Quando o status mudar para "READY", o ficheiro está processado

---

## RESOLUÇÃO DE PROBLEMAS COMUNS

**"docker: command not found"**
→ O Docker Desktop não está a correr. Abre o Docker Desktop e espera pelo ícone verde.

**"npm install" falha com erros**
→ Verifica a versão do Node: `node --version` — deve ser v18 ou superior.

**"Port 3000 already in use"**
→ Muda a porta no `.env`: `PORT=3001` e acede em http://localhost:3001

**A base de dados não conecta**
→ Verifica se os containers estão a correr: `docker compose ps`
→ Se não estiverem, corre: `docker compose up -d`

**FFmpeg não encontrado**
→ Verifica a instalação: `ffmpeg -version`
→ Se não funcionar, reinicia o Terminal após a instalação.

---

---

# ╔══════════════════════════════════════════╗
# ║  PARTE II — ESPECIFICAÇÃO TÉCNICA      ║
# ╚══════════════════════════════════════════╝

## Arquitectura — 6 Camadas do Nexora

```
┌─────────────────────────────────────────────────────────────┐
│  CAMADA 1 — INGEST                                          │
│  Watch folder · API HTTP · S3/MinIO · FTP · Live RTMP/SRT   │
│  → SHA-256 dedup + Perceptual hash + UUID interno           │
└─────────────────────────────┬───────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  CAMADA 2 — QC & VALIDAÇÃO                                  │
│  MediaInfo + FFprobe + MediaConch + BS1770GAIN              │
│  → GOP · CFR · PixelFormat · Loudness · Black/Freeze/Flash  │
│  → PASS / QUARANTINE / REJECT (com reason codes)           │
└─────────────────────────────┬───────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  CAMADA 3 — INTELLIGENCE                                    │
│  SI/TI analysis · Content classification · Per-title VMAF  │
│  → Profile selector (Broadcast/OTT/Archive/Web)            │
│  → Bitrate ladder dinâmica                                  │
└─────────────────────────────┬───────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  CAMADA 4 — PROCESSING (Workers Distribuídos)              │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────────────┐  │
│  │  Transcode  │ │Audio R128   │ │Legendas CEA-708/TTML  │  │
│  │FFmpeg+NVENC │ │Two-pass TP  │ │WebVTT · Burn-in       │  │
│  └─────────────┘ └─────────────┘ └──────────────────────┘  │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────────────┐  │
│  │HDR/SDR Tone │ │DRM Packaging│ │Proxy+Thumbnail Sprite │  │
│  │HLG·HDR10·PQ │ │CMAF·Widevine│ │LowRes·ProRes·VTT     │  │
│  └─────────────┘ └─────────────┘ └──────────────────────┘  │
│  Orquestrado por Temporal.io · Retry backoff · Dead-letter  │
└─────────────────────────────┬───────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  CAMADA 5 — QC PÓS-ENCODE                                  │
│  VMAF ≥85/90/93 · SHA-256 · R128 final · MediaConch AS-11  │
└─────────────────────────────┬───────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  CAMADA 6 — DELIVERY                                        │
│  S3 Multipart · MXF/FTP · EBU Core XML · Playout API       │
│  → "ready_for_schedule" webhook trigger                     │
└─────────────────────────────────────────────────────────────┘
         TRANSVERSAL: Prometheus · Grafana · Loki · Alertmanager
```

## Stack Tecnológico Nexora

| Camada | Tecnologia | Papel |
|---|---|---|
| Core transcoding | FFmpeg 6.x | Motor principal de processamento |
| Batch encoding | HandBrake CLI | Proxies e web outputs |
| Análise | MediaInfo + FFprobe | Validação de containers |
| Conformance | MediaConch | Verificação AS-11/IMF |
| Loudness | BS1770GAIN | Medição EBU R128 independente |
| Qualidade | libvmaf | VMAF scoring (Netflix-grade) |
| Backend | Node.js 20 + TypeScript | API e workers |
| API | Fastify 4.x | HTTP server |
| Queue | BullMQ + Redis 7 | Fila de jobs |
| Orquestração | Temporal.io | Workflows stateful |
| ORM | Prisma + PostgreSQL 15 | Persistência |
| Storage | MinIO (S3-compatible) | Ficheiros media |
| Frontend | Next.js 14 + React | Interface web |
| Observabilidade | Prometheus + Grafana + Loki | Monitorização |
| Containers | Docker + Docker Compose | Ambiente de produção |

## Standards Cobertos

EBU R128 (loudness) · ITU-R BS.1770-4 · AS-11 UK DPP · IMF SMPTE ST 2067 ·
CMAF ISO 23000-19 · EBU Core (metadata) · Apple HLS Authoring Spec · DASH-IF IOP ·
Harding FPA (flash safety) · SCTE-35 (ad markers) · SPEKE/CPIX (DRM keys) ·
Netflix per-title encoding spec · SMPTE 330M (UMID)

---

---

# ╔══════════════════════════════════════════╗
# ║  PARTE III — PROMPTS DE PRODUÇÃO       ║
# ║  (todos os 10 agentes)                 ║
# ╚══════════════════════════════════════════╝

---

# ══════════════════════════════════════════════
# PROMPT 1 — CLAUDE CODE
# Backend Core + Workers + QC Engine + Pipeline
# Executar em: Cursor / Claude Code CLI
# ══════════════════════════════════════════════

```
PROJECTO: Nexora Media Processing

CONTEXTO: És o engenheiro sénior responsável pelo backend e pipeline de 
processamento do Nexora Media Processing — uma plataforma profissional de 
ingest, transcoding e entrega de media para broadcast e OTT.

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

TAREFA: Construir o backend completo do Nexora Media Processing:

src/
├── api/
│   ├── routes/
│   │   ├── assets.ts
│   │   ├── jobs.ts
│   │   └── webhooks.ts
│   └── middleware/
│       ├── auth.ts
│       └── rateLimiter.ts
├── workers/
│   ├── ingest.worker.ts
│   ├── qc.worker.ts
│   ├── analyzer.worker.ts
│   ├── transcode.worker.ts
│   ├── audio.worker.ts
│   ├── subtitle.worker.ts
│   ├── proxy.worker.ts
│   ├── qc-post.worker.ts
│   └── delivery.worker.ts
├── pipeline/
│   ├── orchestrator.ts
│   ├── profiles.ts
│   └── ffmpeg/
│       ├── builder.ts
│       ├── executor.ts
│       └── parser.ts
├── qc/
│   ├── rules/
│   │   ├── video.rules.ts
│   │   ├── audio.rules.ts
│   │   └── container.rules.ts
│   ├── vmaf.ts
│   └── mediaconch.ts
├── models/
│   ├── asset.model.ts
│   ├── job.model.ts
│   └── audit.model.ts
├── events/
│   ├── emitter.ts
│   └── webhooks.ts
└── observability/
    ├── metrics.ts
    ├── logger.ts
    └── tracing.ts

REGRAS DE IMPLEMENTAÇÃO OBRIGATÓRIAS:

1. FFmpeg NUNCA é executado inline — sempre child_process.spawn isolado:
   - Timeout máximo configurável (default 4h transcode)
   - SIGTERM → esperar 5s → SIGKILL
   - Captura stderr linha a linha com parse estruturado

2. GOP/Keyframe obrigatório em TODOS os transcode jobs:
   -g [fps*2] -keyint_min [fps*2] -sc_threshold 0 -flags +cgop
   -x264-params "open-gop=0:bframes=0" -bf 0

3. Áudio — two-pass EBU R128:
   - Pass 1: análise com loudnorm print_format=json
   - Pass 2: normalização linear com valores medidos exactos
   - Verificação pós-encode com BS1770GAIN (independente do FFmpeg)
   - Falha se True Peak > -1 dBTP após encode

4. QC rules composable e testáveis:
   - Cada regra: (metadata) => { pass, severity, code, detail }
   - Rules executadas em paralelo com Promise.allSettled
   - 'critical' fail → REJECT | múltiplos 'warning' → QUARANTINE

5. Audit trail imutável (INSERT-only, nunca UPDATE/DELETE)

6. Checksums: SHA-256 em tudo (nunca MD5)

PERFIS DE ENCODING:

nexora_broadcast_hd:
  container: mxf_op1a | video: h264 high 4.1 yuv420p 8000k closed-gop-50fr 0-bframes
  audio: pcm_s24le 48000 -23LUFS -1dBTP

nexora_ott_premium:
  container: cmaf (fmp4) | video: h265 main yuv420p10le ladder dinâmica
  audio: eac3 -14LUFS -1dBTP | drm: Widevine/FairPlay placeholder

nexora_streaming_web:
  container: mp4+faststart | video: h264 high 4.0 yuv420p ladder 480p/720p/1080p
  audio: aac 192kbps 48000 -14LUFS

nexora_proxy_lowres:
  container: mp4+faststart | video: h264 baseline 1280x720 800kbps
  audio: aac 128kbps

nexora_archive:
  container: mxf_op1a | video: prores_4444 | audio: pcm_s24le

MÉTRICAS PROMETHEUS (/metrics):
  nexora_assets_ingested_total
  nexora_assets_rejected_total {reason}
  nexora_transcode_duration_seconds (histogram)
  nexora_queue_depth {worker_type} (gauge)
  nexora_vmaf_score (histogram)
  nexora_loudness_lufs (histogram)
  nexora_job_success_rate (gauge 5min)
  nexora_ffmpeg_timeout_total
  nexora_upload_duration_seconds (histogram)

SCHEMA PRISMA:

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
  INGESTED QC_PENDING QC_PASS QC_QUARANTINE QC_REJECT
  ANALYZING TRANSCODING AUDIO_PROCESSING POST_QC DELIVERING READY FAILED
}

model AuditLog {
  id        String   @id @default(uuid())
  assetId   String
  eventType String
  operator  String
  payload   Json
  entryHash String   // SHA-256 chain para tamper-evidence
  createdAt DateTime @default(now())
}

ENTREGÁVEIS:
1. Repositório com estrutura acima completamente implementada
2. Docker Compose: app, postgres, redis, minio, prometheus, grafana, temporal
3. .env.example com todas as variáveis
4. Scripts npm: dev, build, test, lint, migrate, seed, fixtures:generate, worker
5. README com setup em menos de 10 comandos
6. Colecção Insomnia/Postman para todos os endpoints

COMEÇAR POR (nesta ordem):
1. Setup do projecto (package.json, tsconfig, eslint, docker-compose)
2. Schema Prisma + migrations
3. FFmpeg executor isolado com timeout
4. QC rules engine (video + audio)
5. BullMQ queues setup
6. API routes base
7. Testes unitários das QC rules
```

---

# ══════════════════════════════════════════════
# PROMPT 2 — OPENAI CODEX / O1
# Orquestração · Decision Engine · API Design
# Executar em: OpenAI Codex / ChatGPT-4o / Cursor
# ══════════════════════════════════════════════

```
PROJECTO: Nexora Media Processing

ROLE: Senior Systems Architect — Nexora Media Processing

Estás a construir a camada de orquestração inteligente do Nexora Media 
Processing. O backend workers (FFmpeg, MediaInfo, BullMQ) já estão 
construídos. O teu trabalho é o cérebro de decisão.

TASK 1: TEMPORAL.IO WORKFLOWS

Workflow principal: processAssetWorkflow(assetId: string)

SEQUENCIAL (cada um tem de ter sucesso antes do próximo):
1. validateQC()          → timeout 5min, maxAttempts 3
2. analyzeContent()      → timeout 10min, maxAttempts 2

PARALELO (após analyzeContent):
3a. transcodeVideo()     → timeout 4h, maxAttempts 2
3b. normalizeAudio()     → timeout 30min, maxAttempts 3
3c. processCaptions()    → timeout 20min, maxAttempts 2, opcional

SEQUENCIAL (após grupo paralelo):
4. generateProxies()     → timeout 1h, maxAttempts 2
5. generateThumbnails()  → timeout 10min, maxAttempts 3
6. runPostEncodeQC()     → timeout 30min, maxAttempts 1
7. deliver()             → timeout 2h, maxAttempts 3

FALHAS:
- validateQC REJECT → terminar workflow, emitir NexoraAssetRejected
- validateQC QUARANTINE → pausar, aguardar sinal humano, timeout 48h
- transcodeVideo falha após maxAttempts → emitir NexoraTranscodeFailed
- runPostEncodeQC falha VMAF → re-encode com parâmetros ajustados
- Todos os retries: backoff 1s, 10s, 60s

TASK 2: DECISION ENGINE

Input: MediaAnalysis (FFprobe + BS1770GAIN + SI/TI analysis)
Output: ProcessingDecision

Regras de decisão (implementar exactamente):
1. VFR detectado → sempre TRANSCODE (CFR obrigatório)
2. Open GOP detectado → sempre TRANSCODE
3. B-frames > 0 E target é broadcast → sempre TRANSCODE
4. pixelFormat != yuv420p E não é HDR → sempre TRANSCODE
5. True Peak > -1 dBTP → audio normalisation required
6. LUFS difere do target em > 1 LU → normalisation required
7. Codec OK + GOP compliant + CFR + sem issues → COPY ou REMUX
8. GOP size = Math.round(frameRate) * 2 (sempre grupos de 2 segundos)
9. bufsize = maxrateKbps * 2 (VBV buffer para compatibilidade STB)
10. contentType 'sport' → aumentar bitrate 30% acima do base
11. contentType 'animation' → reduzir bitrate 40% (alta compressibilidade)

Output type: ProcessingDecision com:
  action: 'COPY' | 'REMUX' | 'TRANSCODE' | 'REJECT'
  targetProfile: 'nexora_broadcast_hd' | 'nexora_ott_premium' | ...
  videoParams: { codec, profile, level, gopSize, scThreshold: 0, closedGop: true,
                 bFrames: 0, targetBitrateKbps, bufsize, colorSpace, ... }
  audioParams: { codec, sampleRate: 48000, targetLufs, truePeakLimit: -1, ... }
  ffmpegParams: string[] // array de argumentos validados
  handbrakePreset?: string // se HandBrake pode tratar este job

TASK 3: REST API — OpenAPI 3.1 + Fastify

POST   /api/v1/assets                    → Ingest (multipart ou URL)
GET    /api/v1/assets                    → Lista (paginação, filtros)
GET    /api/v1/assets/:id                → Detalhe + status actual
GET    /api/v1/assets/:id/status         → SSE stream para polling
GET    /api/v1/assets/:id/jobs           → Todos os jobs do asset
GET    /api/v1/assets/:id/audit          → Audit trail imutável
GET    /api/v1/assets/:id/qc-report      → Relatório QC completo JSON
GET    /api/v1/assets/:id/download/:type → URL pre-assinada (1h TTL)
POST   /api/v1/assets/:id/reprocess      → Re-processar com novo perfil
POST   /api/v1/jobs                      → Submeter job manual
GET    /api/v1/jobs/:id                  → Status + logs
GET    /api/v1/profiles                  → Perfis disponíveis
GET    /api/v1/metrics/summary           → Métricas para dashboard
GET    /api/v1/queue/stats               → Filas + workers
POST   /api/v1/webhooks/register         → Registar webhook outbound

API STANDARDS:
- Respostas: { data: T, meta: { requestId, timestamp, version } }
- Erros: { error: { code, message, details }, meta: { requestId } }
- Paginação: { data: T[], meta: { total, page, pageSize, hasMore } }
- Auth: Bearer JWT RS256
- Rate limiting: 1000 req/min por API key

ENTREGÁVEIS:
1. OpenAPI 3.1 YAML spec completo
2. Implementação Fastify com Zod validation
3. Error handling middleware
4. Testes de integração (Vitest + Supertest)
```

---

# ══════════════════════════════════════════════
# PROMPT 3 — GOOGLE AI STUDIO / GEMINI
# Frontend · Dashboard · Interface Web
# Executar em: Google AI Studio (Antigravity)
# ══════════════════════════════════════════════

```
PROJECTO: Nexora Media Processing

ROLE: Senior Frontend Engineer — Nexora Media Processing

Estás a construir a interface web profissional do Nexora Media Processing.
A API backend já está construída (OpenAPI 3.1 spec disponível).

STACK:
- Next.js 14 (App Router, Server Components)
- TypeScript strict
- Tailwind CSS + shadcn/ui
- TanStack Query v5 (server state)
- Zustand (client state)
- Recharts (visualização de dados)
- React Hook Form + Zod (formulários)
- nuqs (URL state management)

DESIGN SYSTEM:
- Dark mode first, light mode suportado
- Font: Inter (body), JetBrains Mono (métricas/código)
- Cor de acento única: blue-600
- Cores de status: verde (ready), âmbar (processing), vermelho (failed), cinza (pending)

PÁGINAS A CONSTRUIR:

PAGE 1: Dashboard Overview
  - 4 metric cards: assets processados hoje | taxa de sucesso | tempo médio transcode | queue depth
  - Line chart: assets/hora (últimas 24h)
  - Bar chart: tipos de erro (últimos 7 dias)
  - Tabela de actividade recente com live updates (SSE polling 10s)

PAGE 2: Assets List
  - Tabela: filename | status badge | perfil | resolução | duração | VMAF | data
  - Filtros em URL params: status, perfil, date range, search
  - Upload zone drag-and-drop ou URL input
  - Bulk actions: reprocessar, download, arquivar
  - Paginação: 25/50/100 por página

PAGE 3: Asset Detail (tabs)
  - Overview: player vídeo (proxy lowres) + specs técnicas + VMAF gauge + timeline
  - QC Report: tabela por check (PASS/FAIL/WARN) com severity + exportação PDF
  - Jobs: timeline de todos os jobs com logs expandíveis
  - Audit Trail: log cronológico imutável com JSON expandível
  - Downloads: outputs disponíveis com presigned URL (1h TTL)

PAGE 4: Queue Monitor
  - Worker health grid: nome | status | job actual | uptime
  - Queue depth bars: ingest/qc/transcode/audio/delivery
  - Throughput chart: jobs/hora (últimas 6h)
  - Dead letter queue: jobs falhados com retry/discard

PAGE 5: Upload Flow (5 passos)
  - 1. Drop zone (multi-ficheiro, URL input)
  - 2. Profile selector (cards: Nexora Broadcast HD | OTT Premium | Web | Archive)
  - 3. Opções (prioridade, webhook URL, metadata)
  - 4. Progresso (por ficheiro + status de processamento)
  - 5. Concluído → link para detalhe do asset

COMPONENTES OBRIGATÓRIOS:
  - NexoraStatusBadge: pulse animado para 'processing'
  - NexoraVMAFGauge: semi-círculo com valor numérico e cor (red<70, amber<85, green≥85)
  - NexoraLoudnessMeter: barra -40 a 0 LUFS com zona de target marcada
  - NexoraCodecBadge: pill colorido (H.264=blue, H.265=purple, ProRes=green)
  - NexoraFileDropzone: validação MIME + feedback de limite de tamanho
  - NexoraTimecodeDisplay: formato HH:MM:SS:FF

REAL-TIME:
  - Status updates: SSE /api/v1/assets/:id/status
  - Queue stats: polling 5s
  - Dashboard metrics: polling 30s
  - On READY: browser notification

ACESSIBILIDADE: WCAG 2.1 AA mínimo

ENTREGÁVEIS:
1. Next.js 14 App Router completo
2. Todos os componentes com TypeScript strict
3. Testes Playwright para upload flow e asset detail
4. README frontend com: npm run dev, variáveis, estrutura
```

---

# ══════════════════════════════════════════════
# PROMPT 4 — KIMI (Long Context)
# Análise de Logs · Debug · Troubleshooting
# Executar em: kimi.moonshot.ai ou API Moonshot
# ══════════════════════════════════════════════

```
PROJECTO: Nexora Media Processing

ROLE: Log Analysis and Debug Intelligence — Nexora Media Processing

És a camada de análise de logs e debugging do Nexora Media Processing.
Recebes logs brutos de FFmpeg, MediaInfo, MediaConch, BullMQ e sistema,
e produces relatórios de diagnóstico estruturados.

INPUT:
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

OUTPUT OBRIGATÓRIO:
{
  "asset_id": "uuid",
  "analysis_timestamp": "ISO8601",
  "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
  "root_cause": {
    "category": "codec|container|audio|io|hardware|network|config|unknown",
    "description": "Descrição em português para operador",
    "technical_detail": "Detalhe técnico para engenheiro",
    "evidence": ["linha de log ou evidência que suporta esta conclusão"]
  },
  "issues_found": [
    {
      "code": "ERR_GOP_OPEN|ERR_VFR|ERR_LUFS|ERR_VMAF|ERR_CORRUPT|...",
      "severity": "critical|warning|info",
      "description": "...",
      "raw_evidence": "excerto exacto do log"
    }
  ],
  "fix_strategy": {
    "action": "retry|adjust_params|reject|manual_review|escalate",
    "automated_fix_possible": true|false,
    "steps": ["Passo concreto 1", "Passo concreto 2"],
    "ffmpeg_params_to_change": { "remove": [...], "add": [...] }
  },
  "retry_recommendation": {
    "should_retry": true|false,
    "max_retries": 0|1|2|3,
    "backoff_seconds": [1, 10, 60]
  }
}

PADRÕES DE ERRO FFMPEG A RECONHECER:

CRÍTICO (parar e rejeitar):
  "moov atom not found" → container corrompido
  "Invalid data found when processing input" → stream corrompido
  "No such file or directory" → ficheiro desapareceu
  "Conversion failed!" → encode falhou completamente

ALTO (retry com ajuste):
  "DTS .* out of order" → problema timestamps → tentar -fflags +igndts
  "Past duration .* too large" → bitrate/buffer issue → ajustar VBV
  "Queue input is backward in time" → tentar -vsync cfr

ÁUDIO:
  Loudness > -1 dBTP → normalização falhou → re-tentar com margem extra
  LUFS desvio > 1 LU → two-pass falhou → verificar measured_* values

FERRAMENTAS A CONSTRUIR:
1. NexoraLogParser: parse FFmpeg stderr em eventos estruturados
2. NexoraPatternMatcher: match padrões de erro + severity + code
3. NexoraDiagnosticEngine: correlacionar todos os logs → root_cause
4. NexoraFixSuggester: root_cause + issues → fix_strategy
5. NexoraRetryAdvisor: fix_strategy → parâmetros de retry
6. NexoraDailyDigest: relatório agregado de 24h (top 10 erros)
7. NexoraAnomalyDetector: alerta se taxa de erro aumenta vs baseline
```

---

# ══════════════════════════════════════════════
# PROMPT 5 — DEEPSEEK CODER
# FFmpeg · Optimização · GPU · Performance
# Executar em: chat.deepseek.com ou API DeepSeek
# ══════════════════════════════════════════════

```
PROJECTO: Nexora Media Processing

ROLE: FFmpeg Optimization Engineer — Nexora Media Processing

FERRAMENTAS DISPONÍVEIS:
FFmpeg 6.x com: libx264, libx265, libvpx-vp9, libfdk_aac, libopus, libvmaf,
nvenc (NVIDIA), qsv (Intel), amf (AMD)
HandBrakeCLI, BS1770GAIN

TASK 1: FFmpeg Command Generator

Para cada perfil Nexora, gerar DOIS comandos:
A) GPU (nvenc/qsv/amf) — preferido se GPU disponível
B) CPU fallback — sempre funciona

NEXORA BROADCAST HD — GPU:
ffmpeg -y -hwaccel cuda -hwaccel_output_format cuda -i {input}
  -c:v h264_nvenc -preset p4 -tune hq -profile:v high -level:v 4.1
  -pix_fmt yuv420p -g {gop} -keyint_min {gop} -forced-idr 1 -no-scenecut 1
  -b:v {bitrate}k -maxrate {maxrate}k -bufsize {bufsize}k -rc cbr
  -colorspace bt709 -color_primaries bt709 -color_trc bt709
  -c:a pcm_s24le -ar 48000 {audio_loudnorm} -movflags +faststart {output}

NEXORA BROADCAST HD — CPU:
ffmpeg -y -i {input}
  -c:v libx264 -preset slow -tune film -profile:v high -level:v 4.1
  -pix_fmt yuv420p -g {gop} -keyint_min {gop} -sc_threshold 0 -flags +cgop
  -x264-params "open-gop=0:bframes=0:ref=4:nal-hrd=cbr:force-cfr=1"
  -b:v {bitrate}k -maxrate {maxrate}k -bufsize {bufsize}k
  -colorspace bt709 -color_primaries bt709 -color_trc bt709
  -c:a pcm_s24le -ar 48000 {audio_loudnorm} -movflags +faststart {output}

NEXORA PROXY (HandBrake — mais rápido para proxies):
HandBrakeCLI --input {input} --output {output}
  --preset-import-file nexora-presets.json --preset "Nexora_ProxyLowRes"
  --json

TASK 2: GPU Detection e Fallback

1. Verificar nvidia-smi → CUDA disponível?
2. Verificar vainfo → VAAPI disponível?
3. Executar encode de teste (5 frames) com params GPU
4. Se teste falhar → fallback para CPU automaticamente
5. Cache resultado por sessão (re-verificar cada 30min)

TASK 3: Two-Pass EBU R128 Completo

Pass 1 (análise):
ffmpeg -i {input} -af "loudnorm=I=-{target}:TP=-1:LRA=11:print_format=json" -f null -

Parse JSON: input_i, input_tp, input_lra, input_thresh, target_offset

Pass 2 (normalização linear):
ffmpeg -i {input}
  -af "loudnorm=I=-{target}:TP=-1:LRA=11:
       measured_I={input_i}:measured_TP={input_tp}:
       measured_LRA={input_lra}:measured_thresh={input_thresh}:
       offset={target_offset}:linear=true" {output}

Validação com BS1770GAIN (independente):
bs1770gain --ebu --integrated --truepeak --xml {output}
Parse resultado → verificar LUFS ±0.5 de target E True Peak ≤ -1.0 dBTP
Se falhar → retry com offset +/- 0.5 LU, máximo 3 tentativas

TASK 4: VMAF Integration

ffmpeg -i {reference} -i {encoded}
  -lavfi "[0:v][1:v]libvmaf=log_fmt=json:log_path={log}:n_subsample=5:
          model=version=vmaf_v0.6.1" -f null -

Thresholds Nexora: archive≥93 | broadcast≥90 | streaming≥85 | proxy≥70
Usar 1st percentile como floor (pior momento)
Abaixo do threshold → re-encode com CRF/bitrate ajustado

TASK 5: Concurrent Job Optimizer

- Manter CPU utilization: 70-85%
- Slots GPU separados de CPU
- Prioridade: broadcast > OTT > web > proxy
- Tracking: jobs/min, avg_realtime_factor, gpu_utilization

ENTREGÁVEIS:
1. NexoraFFmpegCommandBuilder (type-safe, arg array nunca string shell)
2. NexoraGPUDetector com test-encode validation
3. NexoraLoudnessNormalizer (two-pass + BS1770GAIN verification)
4. NexoraVMAFScorer com threshold logic e retry
5. NexoraJobScheduler com priority queuing
6. HandBrake preset file: nexora-presets.json
7. Benchmarks: GPU vs CPU por perfil
```

---

# ══════════════════════════════════════════════
# PROMPT 6 — QUALQUER IDE
# Docker · CI/CD · Infra · Deployment
# Executar em: Cursor / VS Code / Claude Code
# ══════════════════════════════════════════════

```
PROJECTO: Nexora Media Processing

ROLE: DevOps / Infrastructure Engineer — Nexora Media Processing

DOCKER COMPOSE — Serviços obrigatórios:

1.  nexora-api       → Node.js Fastify — port 3000
2.  nexora-worker    → BullMQ workers — sem port
3.  temporal         → Temporal.io server — port 7233
4.  temporal-ui      → Temporal web UI — port 8080
5.  postgres         → PostgreSQL 15 — port 5432
6.  redis            → Redis 7 — port 6379
7.  minio            → MinIO S3-compatible — ports 9000, 9001
8.  prometheus       → Colecção de métricas — port 9090
9.  grafana          → Dashboards — port 3001
10. loki             → Log aggregation — port 3100

Imagem custom (nexora-media-tools):
Base: ubuntu:22.04
Instalar: ffmpeg 6.x (libvmaf, libx264, libx265, libfdk_aac)
Instalar: mediainfo, ffprobe, mediaconch, bs1770gain, HandBrakeCLI
Instalar: Node.js 20 LTS
User não-root: nexora (UID 1001)

Resource limits:
  nexora-api: 1 CPU, 512MB RAM
  nexora-worker (transcode): 4 CPU, 8GB RAM
  postgres: 2 CPU, 2GB RAM
  redis: 0.5 CPU, 512MB RAM
  minio: 1 CPU, 1GB RAM

Volumes:
  postgres_data, redis_data, minio_data
  nexora_input → /media/input (watch folder)
  nexora_output → /media/output
  nexora_temp → /media/temp (scratch)
  grafana_data, prometheus_data

.env.example:
  DATABASE_URL=postgresql://nexora:secret@postgres:5432/nexora_media
  REDIS_URL=redis://redis:6379
  MINIO_ENDPOINT=minio
  MINIO_PORT=9000
  MINIO_ACCESS_KEY=nexoraadmin
  MINIO_SECRET_KEY=nexoraadmin
  MINIO_BUCKET_INPUT=nexora-input
  MINIO_BUCKET_OUTPUT=nexora-output
  TEMPORAL_ADDRESS=temporal:7233
  JWT_SECRET=change-in-production
  MAX_CONCURRENT_TRANSCODE_JOBS=4
  FFMPEG_DEFAULT_TIMEOUT_MS=14400000
  LOG_LEVEL=info

GRAFANA DASHBOARDS (provisionar automaticamente):
1. Nexora Overview: jobs/min, success rate, queue depth, avg transcode time
2. Nexora Quality: VMAF distribution, loudness histogram, rejection rate
3. Nexora Infrastructure: CPU/RAM/disk por serviço, FFmpeg process count

PROMETHEUS ALERTAS:
  NexoraPipelineStalled: queue_depth > 50 por 10m → critical
  NexoraHighRejectionRate: rejection_rate > 0.20 por 5m → warning
  NexoraWorkerDown: worker heartbeat ausente 2m → critical
  NexoraLowVMAF: vmaf_p50 < 85 por 15m → warning
  NexoraFFmpegTimeout: nexora_ffmpeg_timeout_total aumenta → critical
  NexoraDiskWarning: disk_usage > 80% → warning

CI/CD (GitHub Actions):
  test: vitest + coverage ≥ 80%
  lint: eslint + prettier check
  build: docker build + push registry
  deploy-staging: docker compose pull + up
  deploy-prod: aprovação manual → blue-green deploy

HEALTH CHECKS:
  GET /health → { status, timestamp, version, uptime }
  GET /health/ready → DB + Redis + MinIO conectados
  GET /health/live → processo vivo

SCRIPTS npm:
  dev, build, test, test:watch, test:coverage, lint,
  db:migrate, db:seed, db:studio,
  queue:flush, worker, fixtures:generate
```

---

# ══════════════════════════════════════════════
# PROMPT 7 — CLAUDE CODE
# Segurança · Auth · Hardening · Compliance
# Executar em: Cursor / Claude Code CLI
# ══════════════════════════════════════════════

```
PROJECTO: Nexora Media Processing

ROLE: Security Engineer — Nexora Media Processing

THREAT MODEL:
- Acesso não autorizado a assets (conteúdo pré-lançamento)
- Replay attacks na API
- Path traversal no handling de ficheiros
- SSRF via endpoint de URL ingest
- Injecção FFmpeg via nomes de ficheiro maliciosos
- Resource exhaustion (file bomb, uploads oversized)
- Roubo de credenciais via logs

TASK 1: AUTH RS256 JWT

interface NexoraJWTPayload {
  sub: string; org: string;
  roles: ('admin'|'operator'|'viewer'|'api')[];
  permissions: string[]; iat: number; exp: number; jti: string;
}

Implementar:
1. RSA key pair 4096-bit + rotação a cada 30 dias (chave antiga válida 7 dias)
2. JWT middleware Fastify (plugin)
3. Token revocation list em Redis (por jti)
4. API key management (hash+salt, nunca plaintext)
5. Rate limiting por identidade: user 1000/min | api 5000/min | anon 10/min

TASK 2: VALIDAÇÃO DE FICHEIROS (MULTI-LAYER)

Layer 1 — Magic bytes (nunca confiar em Content-Type):
ALLOWED: mp4 ftyp box | mxf UL 06 0E 2B 34 | mpeg-ts sync 0x47 |
         mkv EBML 1A 45 DF A3 | wav RIFF | mp3 ID3/FF FB | aac FF F1

Layer 2 — Limites: max 50GB | min 1KB | filename max 255 chars
Rejeitar nomes com: ../ ./ \0 | & ; ` $ ( ) { }

Layer 3 — Sanitização de filename:
Apenas [a-zA-Z0-9._-] permitido
UUID interno IMEDIATAMENTE no ingest
NUNCA usar filename original em qualquer shell command

Layer 4 — SSRF prevention (URL ingest):
Validar http/https apenas
Resolver DNS e rejeitar IPs privados: 127.x | 10.x | 172.16-31.x | 192.168.x | 169.254.x | ::1
Re-verificar após cada redirect (max 3 redirects)

TASK 3: FFMPEG INJECTION PREVENTION

NUNCA: exec(`ffmpeg ${someString}`)
SEMPRE: execFile('ffmpeg', commandArray, options)

class NexoraFFmpegCommandBuilder {
  validateInputPath(p: string): string {
    const allowed = [process.env.NEXORA_INPUT_DIR, process.env.NEXORA_TEMP_DIR];
    const resolved = path.resolve(p);
    if (!allowed.some(dir => resolved.startsWith(path.resolve(dir!)))) {
      throw new NexoraSecurityError('Path outside allowed directories');
    }
    return resolved;
  }
  // Todos os parâmetros tipados — sem interpolação de strings crua
}

TASK 4: AUDIT TRAIL TAMPER-EVIDENT

Cada entrada tem hash chain:
  entry_hash = SHA256(previous_entry_hash + entry_content)
Verificação periódica a cada 6h
Se chain quebrada → CRITICAL ALERT imediato

TASK 5: DATA GOVERNANCE

- Retenção configurável por organização (default 90 dias)
- Deletion job diário: overwrite com zeros antes de delete
- Deletion logged no audit trail
- Export de metadata em JSON
- Right to erasure endpoint

ENTREGÁVEIS:
1. Auth middleware com cobertura de testes 100%
2. File validation pipeline com testes de injecção
3. NexoraFFmpegCommandBuilder com injection prevention testado
4. Secrets loader (Vault → AWS SM → env fallback)
5. Audit chain integrity system
6. Mapa OWASP Top 10 → implementação
```

---

# ══════════════════════════════════════════════
# PROMPT 8 — CLAUDE CODE / OPENAI CODEX
# Testes Completos · QA · Performance
# Executar em: Cursor / Claude Code / Codex
# ══════════════════════════════════════════════

```
PROJECTO: Nexora Media Processing

ROLE: QA & Test Engineer — Nexora Media Processing

TEST STACK: Vitest + Testcontainers | Supertest | Playwright | k6 | Stryker

FIXTURE GENERATION (via FFmpeg — sem copyright):

# Ficheiro de referência — perfeito, broadcast-safe
ffmpeg -f lavfi -i "testsrc2=duration=30:size=1920x1080:rate=25" \
  -f lavfi -i "sine=frequency=1000:duration=30:sample_rate=48000" \
  -c:v libx264 -profile:v high -level:v 4.1 -pix_fmt yuv420p \
  -g 50 -keyint_min 50 -sc_threshold 0 -flags +cgop -bf 0 \
  -b:v 8000k -maxrate 8000k -bufsize 16000k -c:a pcm_s24le -ar 48000 \
  -movflags +faststart fixtures/nexora_reference_broadcast.mp4

# Ficheiro com Open GOP (deve forçar re-encode)
ffmpeg -f lavfi -i "testsrc2=duration=10:size=1920x1080:rate=25" \
  -c:v libx264 -g 50 -x264-params "open-gop=1:bframes=3" \
  fixtures/nexora_problem_open_gop.mp4

# Ficheiro VFR (deve ser rejeitado)
ffmpeg -f lavfi -i "testsrc2=duration=10:size=1920x1080:rate=25" \
  -c:v libx264 -vsync vfr fixtures/nexora_problem_vfr.mp4

# Ficheiro com loudness incorrecta (-6 LUFS)
ffmpeg -f lavfi -i "testsrc2=duration=10:size=1920x1080:rate=25" \
  -f lavfi -i "sine=frequency=440:duration=10" -af "volume=10dB" \
  fixtures/nexora_problem_loud.mp4

# Ficheiro corrompido (truncado)
head -c 1000000 fixtures/nexora_reference_broadcast.mp4 \
  > fixtures/nexora_problem_corrupt.mp4

UNIT TESTS OBRIGATÓRIOS (100% coverage nas QC rules):

describe('NexoraVideoQCRules', () => {
  describe('gopRule', () => {
    it('passes closed GOP with IDR frames')
    it('fails open GOP with severity critical and code ERR_GOP_OPEN')
    it('fails variable keyframes')
  })
  describe('cfrRule', () => {
    it('passes CFR')
    it('fails VFR with severity critical')
  })
  describe('pixelFormatRule', () => {
    it('passes yuv420p')
    it('fails yuv422p')
    it('passes yuv420p10le for nexora_ott_premium profile')
  })
})

describe('NexoraAudioQCRules', () => {
  it('passes -1.5 dBTP true peak')
  it('fails -0.5 dBTP above limit')
  it('fails 0.0 dBTP with severity critical')
  it('passes 48000 Hz sample rate')
  it('fails 44100 Hz with severity warning')
})

describe('NexoraFFmpegCommandBuilder', () => {
  it('always includes -sc_threshold 0')
  it('always includes -flags +cgop')
  it('GOP = fps * 2')
  it('rejects path traversal → throws NexoraSecurityError')
  it('rejects pipe char in filename')
  it('never produces exec-style string — always arg array')
})

INTEGRATION TESTS (Testcontainers):
  'rejeita ficheiro corrompido e cria audit entry'
  'normaliza loudness para -23 LUFS ±0.5 LU'
  'verifica True Peak ≤ -1.0 dBTP com BS1770GAIN'
  'open GOP força re-encode e output tem closed GOP'

E2E API:
  POST /api/v1/assets → 202 para MP4 válido
  POST /api/v1/assets → 422 para tipo não permitido
  GET  /api/v1/assets → 401 sem token
  Rate limiting → 429 após 1000 requests

PERFORMANCE (k6):
  p95 < 500ms | p99 status endpoint < 200ms | error rate < 1%
  stages: ramp 10 → sustain 50 → spike 100 → ramp down

TARGETS:
  Cobertura linhas ≥ 80% | branches ≥ 75%
  QC rules: 100% branch coverage (são safety-critical)
  Mutation score ≥ 75% (Stryker)

ENTREGÁVEIS:
1. Suite completa unit tests
2. Integration tests com Testcontainers
3. E2E API (Supertest)
4. E2E Frontend (Playwright — upload flow + asset detail)
5. Performance tests k6
6. Script de geração de fixtures (generate-fixtures.sh)
7. CI config: GitHub Actions
```

---

# ══════════════════════════════════════════════
# PROMPT 9 — QUALQUER IDE
# Integração Open Source: HandBrake + BS1770 + VLC
# Executar em: Cursor / VS Code / Claude Code
# ══════════════════════════════════════════════

```
PROJECTO: Nexora Media Processing

ROLE: Open Source Integration Engineer — Nexora Media Processing

TOOL SELECTION MATRIX (usar exactamente esta lógica):

| Job                    | Tool primário        | Fallback      |
|------------------------|----------------------|---------------|
| Broadcast transcode    | FFmpeg               | —             |
| OTT / CMAF             | FFmpeg               | —             |
| Proxy / Web encode     | HandBrakeCLI         | FFmpeg        |
| Loudness measure       | BS1770GAIN           | FFmpeg ebur128|
| Container analysis     | MediaInfo            | FFprobe       |
| Conformance check      | MediaConch           | —             |
| VMAF scoring           | FFmpeg libvmaf       | —             |
| Playback sanity        | VLC headless         | opcional      |
| Thumbnail sprites      | FFmpeg -vf tile      | —             |

HANDBRAKE — Presets Nexora (nexora-presets.json):

Preset NexoraProxyLowRes:
  VideoEncoder: x264 | VideoPreset: veryfast | VideoProfile: high | Level: 3.1
  VideoAvgBitrate: 800 | VideoTwoPass: true | VideoTurboTwoPass: true
  PictureWidth: 1280 | PictureHeight: 720 | PictureKeepRatio: true
  AudioEncoder: copy:aac | AudioBitrate: 128 | AudioSamplerate: 48 | Mixdown: stereo
  Mp4HttpOptimize: true

Preset NexoraWebOptimized1080p:
  VideoEncoder: x264 | VideoPreset: slow | Profile: high | Level: 4.0
  VideoAvgBitrate: 4000 | VideoTwoPass: true
  PictureWidth: 1920 | PictureHeight: 1080 | Mp4HttpOptimize: true

IMPORTANTE: HandBrake NÃO garante Closed GOP com a mesma rigor que FFmpeg.
Para proxies (uso editorial) é aceitável. Para broadcast → sempre FFmpeg.
Verificar sempre o output com FFprobe e logar warning se GOP não for closed.

BS1770GAIN — Validação independente:
bs1770gain --ebu --integrated --range --truepeak --xml {file}

NUNCA confiar apenas na medição FFmpeg do seu próprio output.
BS1770GAIN é a verificação independente obrigatória.

VLC HEADLESS — Sanity check final:
vlc --intf dummy --no-video-display --play-and-exit --no-loop
    --run-time 10 --verbose 2 {file} 2>&1

Usar apenas para nexora_broadcast_hd e nexora_ott_premium.

NEXORA TOOL SELECTOR (classe de decisão):
class NexoraToolSelector {
  selectTranscodeTool(profile: string, jobType: JobType): 'ffmpeg' | 'handbrake'
  selectLoudnessTool(): 'bs1770gain' | 'ffmpeg_ebur128'
  selectAnalysisTool(): 'mediainfo' | 'ffprobe' | 'both'
  isPlaybackCheckRequired(profile: string): boolean
}

VERIFICAÇÃO DE DISPONIBILIDADE (no startup):
- Verificar cada ferramenta com: which {tool} && {tool} --version
- Logar WARNING se HandBrake não disponível (fallback para FFmpeg)
- CRITICAL se FFmpeg não disponível (sistema não pode funcionar)
- CRITICAL se MediaInfo não disponível
- WARNING se BS1770GAIN não disponível (usar fallback FFmpeg)

ENTREGÁVEIS:
1. NexoraHandBrakeWorker com preset management e progress parsing
2. NexoraBS1770GainAnalyzer com XML parser e validation logic
3. NexoraMediaInfoParser normalizando para MediaAnalysis interface
4. NexoraVLCPlaybackTester (headless)
5. NexoraToolSelector com lógica de decisão
6. NexoraToolAvailabilityChecker (run at startup)
7. nexora-presets.json (HandBrake presets)
8. Testes de integração para cada adapter com fixture files
```

---

# ══════════════════════════════════════════════
# PROMPT 10 — TODOS OS AGENTES
# Protocolo Multi-Agente + Coordenação
# Executar em: qualquer IDE como referência
# ══════════════════════════════════════════════

```
PROJECTO: Nexora Media Processing

ROLE: Multi-Agent Coordination Protocol — Nexora Media Processing

Todos os agentes DEVEM seguir este protocolo.

SHARED TYPES (@nexora/shared-types):

type NexoraAssetStatus = 
  | 'INGESTED' | 'QC_PENDING' | 'QC_PASS' | 'QC_QUARANTINE' | 'QC_REJECT'
  | 'ANALYZING' | 'TRANSCODING' | 'AUDIO_PROCESSING' | 'POST_QC'
  | 'DELIVERING' | 'READY' | 'FAILED';

// Transições válidas apenas:
const NEXORA_VALID_TRANSITIONS = {
  INGESTED:         ['QC_PENDING', 'QC_REJECT'],
  QC_PENDING:       ['QC_PASS', 'QC_QUARANTINE', 'QC_REJECT'],
  QC_PASS:          ['ANALYZING'],
  QC_QUARANTINE:    ['QC_PASS', 'QC_REJECT'],
  ANALYZING:        ['TRANSCODING'],
  TRANSCODING:      ['AUDIO_PROCESSING', 'POST_QC', 'FAILED'],
  AUDIO_PROCESSING: ['POST_QC', 'FAILED'],
  POST_QC:          ['DELIVERING', 'TRANSCODING', 'FAILED'],
  DELIVERING:       ['READY', 'FAILED'],
  READY:            [], FAILED: ['QC_PENDING'],
  QC_REJECT:        [],
};

interface NexoraAgentEvent {
  event_id: string; timestamp: string; asset_id: string;
  agent: NexoraAgentName; event_type: string;
  payload: Record<string, unknown>; correlation_id?: string;
}

type NexoraAgentName = 
  | 'ingest_worker' | 'qc_worker' | 'analyzer_worker' | 'transcode_worker'
  | 'audio_worker' | 'subtitle_worker' | 'proxy_worker'
  | 'post_qc_worker' | 'delivery_worker' | 'log_analyzer' | 'orchestrator';

OWNERSHIP MAP:

Claude Code → Workers | QC Rules | Auth | Audit Trail | File Safety | Delivery
OpenAI Codex → Temporal Workflows | Decision Engine | REST API | Integration Tests
Gemini → Next.js Frontend | React Components | Dashboards | Playwright E2E
DeepSeek → FFmpeg Commands | GPU Detection | VMAF | Two-pass R128 | Benchmarks
Kimi → Log Parsing | Error Patterns | Root Cause | Fix Suggestions | Anomaly Detect

HANDOFF PROTOCOL:
1. Commit em feature branch: feat(agent-name): description
2. Interface primeiro: shared types antes da implementação
3. Test gate: testes passam antes de marcar como pronto
4. Documentar contrato: input type | output type | exceptions | side effects

ADRS IMUTÁVEIS (não podem ser revertidas):
ADR-001: Temporal.io para orquestração (não BullMQ standalone)
ADR-002: FFmpeg execFile/spawn isolado (nunca exec() com string)
ADR-003: SHA-256 para todos os checksums (nunca MD5)
ADR-004: yuv420p obrigatório para distribuição
ADR-005: Two-pass EBU R128 com True Peak verificado por BS1770GAIN
ADR-006: Closed GOP + IDR frames obrigatório em todos os outputs broadcast
ADR-007: Audit trail append-only (sem UPDATE/DELETE)
ADR-008: RS256 JWT com key rotation (não HS256)
ADR-009: BS1770GAIN para verificação independente de loudness
ADR-010: VMAF score calculado e guardado para todos os outputs

RESOLUÇÃO DE CONFLITOS:
1. Mais cobertura de testes → ganha
2. Igual cobertura → mais próximo do standard (EBU, SMPTE, Apple HLS) → ganha
3. Ainda igual → ADR obrigatório antes de continuar
```

---

---

# ╔══════════════════════════════════════════╗
# ║  PARTE IV — CHECKLIST DE ACEITAÇÃO     ║
# ╚══════════════════════════════════════════╝

```
INFRAESTRUTURA:
[ ] docker compose up -d corre sem erros
[ ] GET /health/ready → 200 OK com DB+Redis+MinIO
[ ] GET /metrics expõe métricas Prometheus
[ ] Grafana dashboard com dados reais em http://localhost:3001
[ ] Temporal UI mostra workflows em http://localhost:8080

SEGURANÇA:
[ ] JWT RS256 funciona (gerar + usar + expirar)
[ ] Path traversal rejeitado com 422
[ ] SSRF bloqueado para IPs privados (10.x, 192.168.x, etc.)
[ ] FFmpeg nunca chamado com exec() — sempre execFile()
[ ] Audit trail imutável (sem UPDATE/DELETE possíveis no DB)
[ ] SHA-256 calculado em todos os assets
[ ] Magic bytes validation bloqueia .exe, .zip, etc.

PIPELINE NEXORA:
[ ] Ingest → status INGESTED em < 5 segundos
[ ] QC rejeita ficheiro corrompido → audit entry criado
[ ] Transcode nexora_broadcast_hd:
    [ ] FFprobe pós-encode confirma GOP = fps*2
    [ ] FFprobe confirma Closed GOP
    [ ] FFprobe confirma 0 B-frames
    [ ] FFprobe confirma sc_threshold = 0 foi cumprido
    [ ] FFprobe confirma yuv420p no output
    [ ] ffprobe -v quiet -show_entries format_tags=major_brand confirma faststart
[ ] Áudio:
    [ ] BS1770GAIN confirma LUFS dentro de ±0.5 LU do target
    [ ] BS1770GAIN confirma True Peak ≤ -1.0 dBTP
[ ] VMAF score calculado e guardado na DB
[ ] Proxy LowRes gerado (720p, 800kbps)
[ ] Thumbnail sprite sheet + VTT gerado

QUALIDADE DE CÓDIGO:
[ ] npx tsc --noEmit sem erros
[ ] npx eslint src sem erros
[ ] vitest coverage ≥ 80% linhas
[ ] QC rules: 100% branch coverage
[ ] Mutation score ≥ 75% (Stryker)
[ ] Zero any implícito TypeScript
[ ] Zero secrets no código

FRONTEND:
[ ] Upload flow completo: drag-drop → progress → asset detail
[ ] Status updates em tempo real via SSE
[ ] Dashboard com métricas reais do Prometheus
[ ] QC report visível e exportável como PDF
[ ] axe-core: zero violations WCAG 2.1 AA críticas
```

---

*Nexora Media Processing — Plataforma de processamento de media broadcast & OTT.*
*Stack 100% open-source. Pronto para produção real.*
*Documento técnico completo — versão 2.0*
