# Nexora Media Processing — Desktop Nativo
## Documento de Progresso, Execução e Especificação Técnica — v1.0

> **Para quem é este documento:** Para qualquer pessoa, mesmo sem experiência em desenvolvimento, que queira construir e executar a versão Desktop nativa do Nexora Media Processing.
>
> **Relação com o projecto principal:** Este documento é parte integrante do projecto Nexora Media Processing. O Desktop Nativo é um módulo de execução separado, mas partilha a mesma base de qualidade, perfis e standards do Nexora Server (Cloud). Complementa o Manual Técnico Completo v4.0 (Partes 1 e 2).
>
> **IDE recomendado:** Google Antigravity (fork do VS Code com Gemini, Claude e ChatGPT integrados)
>
> **Língua:** Português de Portugal
>
> **Versão:** 1.0 | Arquitecto: Claude Opus | Data: Maio 2026

---

# ═══════════════════════════════════════════
# ÍNDICE GERAL
# ═══════════════════════════════════════════

```
PARTE 0  — CONTEXTO: PORQUÊ UMA VERSÃO DESKTOP NATIVA
PARTE 1  — ARQUITECTURA TÉCNICA DESKTOP
PARTE 2  — STACK TECNOLÓGICA E DECISÕES (ADRs Desktop)
PARTE 3  — ESTRUTURA DO PROJECTO DESKTOP
PARTE 4  — PREPARAÇÃO DO AMBIENTE (macOS · Windows · Linux)
PARTE 5  — PROMPTS DE DESENVOLVIMENTO (Agentes IA)
PARTE 6  — GUIA PASSO A PASSO DE EXECUÇÃO
PARTE 7  — SCRIPTS DE AUTOMAÇÃO DESKTOP
PARTE 8  — INTERFACE DO UTILIZADOR (UI/UX)
PARTE 9  — BUILD CROSS-PLATFORM E DISTRIBUIÇÃO
PARTE 10 — TESTES E VALIDAÇÃO
PARTE 11 — CHECKLIST DE ACEITAÇÃO DESKTOP
PARTE 12 — PROGRESS.md DESKTOP (ESTADO DO PROJECTO)
APÊNDICE A — VARIÁVEIS DE AMBIENTE DESKTOP
APÊNDICE B — MAPEAMENTO FUNCIONAL CLOUD → DESKTOP
APÊNDICE C — TROUBLESHOOTING DESKTOP
APÊNDICE D — GLOSSÁRIO COMPLEMENTAR
```

---

---

# ═══════════════════════════════════════════
# PARTE 0 — CONTEXTO: PORQUÊ UMA VERSÃO DESKTOP NATIVA
# ═══════════════════════════════════════════

## 0.1 — O Problema que o Desktop Resolve

O Nexora Server (Cloud) é poderoso, mas exige:
- Docker e Docker Compose instalados e configurados
- PostgreSQL, Redis, MinIO, Temporal.io a correr simultaneamente
- Conhecimento de terminal e administração de sistemas
- Servidor com recursos dedicados (CPU, RAM, disco)
- Custos de infraestrutura cloud recorrentes

Para um editor de vídeo freelancer, uma produtora pequena ou um técnico que trabalha sozinho, esta complexidade é desnecessária. O Nexora Desktop elimina toda essa barreira:

```
┌─────────────────────────────────────────────────────────────┐
│  NEXORA DESKTOP                                             │
│                                                             │
│  Um instalador. Um clique. Zero configuração.               │
│                                                             │
│  ✓ Windows .exe (~20-30 MB)                                 │
│  ✓ macOS .dmg (~20-30 MB)                                   │
│  ✓ Linux .AppImage / .deb / .rpm (~20-30 MB)                │
│                                                             │
│  Todas as funcionalidades do Server.                        │
│  Sem Docker. Sem Redis. Sem PostgreSQL.                     │
│  Processamento local na máquina do utilizador.              │
└─────────────────────────────────────────────────────────────┘
```

## 0.2 — Filosofia: Dois Sabores, Uma Plataforma

```
                    ┌──────────────────────┐
                    │   NEXORA CORE        │
                    │   Mesmas regras       │
                    │   Mesmos perfis       │
                    │   Mesmos standards    │
                    │   Mesma qualidade     │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                                 ▼
┌──────────────────────┐          ┌──────────────────────┐
│   NEXORA DESKTOP     │          │   NEXORA SERVER      │
│                      │          │                      │
│   SQLite             │          │   PostgreSQL         │
│   Fila em memória    │          │   BullMQ + Redis     │
│   Orchestrator local │          │   Temporal.io        │
│   Pasta local        │          │   MinIO S3           │
│   Mono-utilizador    │          │   Multi-utilizador   │
│   1 instalador       │          │   Docker Compose     │
│   Zero configuração  │          │   Grafana+Prometheus │
└──────────────────────┘          └──────────────────────┘
```

**Regra fundamental:** Um ficheiro processado no Desktop é 100% compatível com o Server. Mesmos codecs, mesmos perfis, mesmos metadados, mesmas verificações de qualidade.

## 0.3 — Comparação Funcional Completa

| Capacidade | Desktop | Server |
|---|---|---|
| Instalação | 1 ficheiro instalador | Docker Compose |
| Base de dados | SQLite (ficheiro local) | PostgreSQL |
| Fila de jobs | Async queue em memória com persistência SQLite | BullMQ + Redis |
| Orquestração | Workflow engine simples (local) | Temporal.io |
| Storage | Pasta local ou disco externo USB/NAS | MinIO S3-compatible |
| Multi-utilizador | Não (mono-utilizador) | Sim (multi-org, RBAC) |
| Jobs simultâneos | 1-4 (limitado por hardware local) | Configurável (4-24+) |
| Dashboard | Integrado na aplicação | Grafana + Prometheus |
| GPU aceleração | Sim (NVENC/AMF/QSV — auto-detectada) | Sim |
| Todos os perfis Nexora | Sim | Sim |
| Transcode (H.264/H.265) | Sim | Sim |
| Audio EBU R128 + True Peak | Sim | Sim |
| VMAF scoring | Sim | Sim |
| QC pré-encode | Sim | Sim |
| QC pós-encode | Sim | Sim |
| Proxy + Thumbnails | Sim | Sim |
| Legendas (CEA-708/TTML/WebVTT) | Sim | Sim |
| MXF output | Sim | Sim |
| HDR/SDR tone mapping | Sim | Sim |
| DRM packaging | Não (requer key server externo) | Sim (CMAF + Widevine) |
| API REST | Não | Sim |
| Webhooks | Notificações nativas do SO | Sim (HTTP callbacks) |
| Watch folder | Não — drag-and-drop na app | Sim |
| Custo de infraestrutura | Zero | Servidor + storage |
| Requisito técnico | Nenhum | Docker, terminal, rede |
| System tray | Sim (ícone com estado dos jobs) | N/A |
| Notificações nativas SO | Sim | N/A |
| Auto-updater | Sim (verificação automática) | Manual (docker pull) |
| Backup automático da DB | Sim (diário) | Configurável |
| Tamanho do instalador | ~20-30 MB | N/A (imagens Docker) |

---

---

# ═══════════════════════════════════════════
# PARTE 1 — ARQUITECTURA TÉCNICA DESKTOP
# ═══════════════════════════════════════════

## 1.1 — Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    NEXORA DESKTOP APP                        │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  CAMADA UI — Frontend React (WebView nativo)          │  │
│  │                                                       │  │
│  │  React 18 + TypeScript + Tailwind CSS + Zustand       │  │
│  │                                                       │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐              │  │
│  │  │Tab:      │ │Tab:      │ │Tab:      │              │  │
│  │  │Processar │ │Histórico │ │Definições│              │  │
│  │  │          │ │          │ │          │              │  │
│  │  │Drop zone │ │Assets    │ │Pasta out │              │  │
│  │  │Jobs act. │ │Filtros   │ │Perfil    │              │  │
│  │  │Progresso │ │Detalhes  │ │GPU       │              │  │
│  │  └──────────┘ └──────────┘ └──────────┘              │  │
│  └───────────────────────┬───────────────────────────────┘  │
│                          │ IPC (Tauri Commands)              │
│  ┌───────────────────────┴───────────────────────────────┐  │
│  │  CAMADA SHELL — Tauri 2.x (Rust)                      │  │
│  │                                                       │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │  │
│  │  │commands/     │ │db/           │ │sidecar.rs    │  │  │
│  │  │assets.rs     │ │schema.sql    │ │Gestão do     │  │  │
│  │  │jobs.rs       │ │migrations.rs │ │Node.js       │  │  │
│  │  │settings.rs   │ │queries.rs    │ │sidecar proc  │  │  │
│  │  │system.rs     │ │              │ │              │  │  │
│  │  └──────────────┘ └──────────────┘ └──────┬───────┘  │  │
│  │                                           │           │  │
│  │  ┌──────────────┐ ┌──────────────┐        │           │  │
│  │  │tray.rs       │ │updater.rs    │        │           │  │
│  │  │System tray   │ │Auto-updates  │        │           │  │
│  │  └──────────────┘ └──────────────┘        │           │  │
│  └───────────────────────────────────────────┼───────────┘  │
│                                              │              │
│  ┌───────────────────────────────────────────┴───────────┐  │
│  │  CAMADA WORKERS — Node.js Sidecar (TypeScript)        │  │
│  │                                                       │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌────────────────┐  │  │
│  │  │SimpleQueue  │ │Desktop      │ │Workers Media   │  │  │
│  │  │Memória +    │ │Orchestrator │ │                │  │  │
│  │  │SQLite       │ │Idempotente  │ │FFmpeg transcode│  │  │
│  │  │Prioridades  │ │Step-by-step │ │Audio R128      │  │  │
│  │  │Retry backoff│ │Recovery     │ │QC pré/pós      │  │  │
│  │  └─────────────┘ └─────────────┘ │VMAF scoring    │  │  │
│  │                                  │Proxy+Thumbnails│  │  │
│  │                                  │Legendas        │  │  │
│  │                                  │HDR/SDR tone    │  │  │
│  │                                  │MXF packaging   │  │  │
│  │                                  └────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  CAMADA DADOS                                         │  │
│  │                                                       │  │
│  │  SQLite (better-sqlite3)                              │  │
│  │  Localização:                                         │  │
│  │    Windows: %APPDATA%\Nexora\nexora.db                │  │
│  │    macOS:   ~/Library/Application Support/Nexora/     │  │
│  │    Linux:   ~/.local/share/Nexora/nexora.db           │  │
│  │                                                       │  │
│  │  Backup automático diário → nexora.db.bak             │  │
│  │  Vacuum automático semanal                            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  BINÁRIOS MEDIA (incluídos no instalador)             │  │
│  │                                                       │  │
│  │  FFmpeg · FFprobe · MediaInfo · BS1770GAIN            │  │
│  │  MediaConch · HandBrakeCLI                            │  │
│  │                                                       │  │
│  │  Compilados por plataforma:                           │  │
│  │  x86_64-pc-windows-msvc                               │  │
│  │  x86_64-apple-darwin + aarch64-apple-darwin           │  │
│  │  x86_64-unknown-linux-gnu                             │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 1.2 — Pipeline de Processamento Desktop

O pipeline Desktop é idêntico ao Server em funcionalidade, mas executado localmente sem dependências externas:

```
FICHEIRO DE MEDIA (drag-and-drop ou selecção manual)
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 1 — INGEST + QC PRÉ-ENCODE                           │
│                                                             │
│  1. Cópia do ficheiro para pasta de trabalho Nexora         │
│  2. FFprobe: extracção de metadados (codec, resolução,      │
│     frame rate, GOP, color space, audio channels)           │
│  3. MediaInfo: validação de container e streams             │
│  4. Verificações automáticas:                               │
│     · Container suportado? (MP4/MOV/MXF/MKV/AVI/TS)        │
│     · Codec de vídeo presente?                              │
│     · Audio streams presentes?                              │
│     · CFR ou VFR? (VFR = warning, necessita conversão)      │
│     · Resolução ≥ 720p?                                     │
│     · Duração > 0?                                          │
│  5. Gerar SHA-256 do ficheiro original                      │
│  6. Criar registo na SQLite (status: analysed)              │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2 — TRANSCODE                                         │
│                                                             │
│  Perfis disponíveis (mesmo que Server):                     │
│  · broadcast_h264_1080p   (TV/playout)                      │
│  · broadcast_h264_4k      (TV UHD)                          │
│  · streaming_h264_ladder  (OTT adaptive)                    │
│  · streaming_h265_ladder  (OTT eficiente)                   │
│  · archive_mezzanine      (master de alta qualidade)        │
│  · proxy_lowres            (edição/preview)                 │
│                                                             │
│  Parâmetros obrigatórios (todos os perfis):                 │
│  · GOP fixo: -g {fps×2} -keyint_min {fps×2}                │
│  · Closed GOP: -flags +cgop                                 │
│  · Scene cut desactivado: -sc_threshold 0                   │
│  · Zero B-frames (broadcast): -bf 0                         │
│  · Pixel format: -pix_fmt yuv420p                           │
│  · CFR: -vsync cfr                                          │
│  · Fast Start: -movflags +faststart                         │
│                                                             │
│  GPU auto-detectada:                                        │
│  · NVIDIA → NVENC (h264_nvenc / hevc_nvenc)                 │
│  · AMD → AMF (h264_amf / hevc_amf)                          │
│  · Intel → QSV (h264_qsv / hevc_qsv)                       │
│  · Nenhuma → libx264/libx265 (CPU, mais lento)              │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3 — ÁUDIO EBU R128                                    │
│                                                             │
│  Two-pass loudness normalisation:                           │
│  · Pass 1: loudnorm filter (análise + medição)              │
│  · Pass 2: loudnorm filter (correcção linear)               │
│                                                             │
│  Targets:                                                   │
│  · Broadcast: -23 LUFS integrado, -1 dBTP, LRA 11          │
│  · Streaming: -14 LUFS integrado, -1 dBTP                  │
│                                                             │
│  Verificação independente:                                  │
│  · BS1770GAIN mede o output final                           │
│  · Se desvio > 0.5 LU do target → re-process               │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 4 — PROXY + THUMBNAILS                                │
│                                                             │
│  · Proxy: 480p H.264, qualidade baixa (CRF 28)             │
│  · Thumbnail grid: 1 frame por cada 10 segundos            │
│  · Sprite VTT para preview hover                            │
│  · Corre em paralelo com steps anteriores                   │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 5 — QC PÓS-ENCODE                                    │
│                                                             │
│  · VMAF: calcular score (threshold: ≥85 streaming,         │
│    ≥90 broadcast, ≥93 archive)                              │
│  · SHA-256 do output final                                  │
│  · MediaConch: conformidade AS-11 (se perfil broadcast)     │
│  · Verificar: GOP, closed GOP, yuv420p, fast start,         │
│    audio LUFS, true peak                                    │
│  · Se alguma verificação falhar → marcar como failed        │
│    com detalhes do problema                                 │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 6 — DELIVERY (local)                                  │
│                                                             │
│  · Mover ficheiro final para pasta de output configurada    │
│  · Gerar relatório de QC em JSON                            │
│  · Enviar notificação nativa do SO                          │
│  · Actualizar estado na SQLite (status: delivered)          │
│  · Registar no audit log (append-only)                      │
└─────────────────────────────────────────────────────────────┘
```

## 1.3 — Porquê Tauri 2.x e Não Electron

| Critério | Electron | Tauri 2.x |
|---|---|---|
| Tamanho do instalador | 80-150 MB | 10-25 MB |
| RAM em idle | ~200 MB | ~30 MB |
| CPU em idle | Alto (Chromium completo) | Muito baixo |
| Motor de rendering | Chromium bundled | WebView nativo do SO |
| Windows | Chromium (duplicado) | WebView2 (Edge, já no Win10/11) |
| macOS | Chromium (duplicado) | WKWebView (Safari engine) |
| Linux | Chromium (duplicado) | WebKitGTK |
| Backend | Node.js completo | Rust (leve) + sidecar opcional |
| Segurança | Superfície Chromium completa | Superfície mínima |
| Build cross-platform | GitHub Actions | GitHub Actions (Tauri Action) |
| Maturidade | Muito alta (VS Code, Slack, Discord) | Alta (Tauri 2.x estável, prod-ready) |

**Decisão ADR-DESKTOP-001:** Tauri 2.x com Node.js sidecar para lógica de media. O sidecar reutiliza o mesmo código dos workers do Nexora Server — sem duplicação de lógica.

---

---

# ═══════════════════════════════════════════
# PARTE 2 — STACK TECNOLÓGICA E DECISÕES (ADRs Desktop)
# ═══════════════════════════════════════════

## 2.1 — Stack Completa

| Camada | Tecnologia | Função |
|---|---|---|
| Shell nativa | Tauri 2.x (Rust) | Janela, IPC, system tray, auto-updater |
| Frontend | React 18 + TypeScript + Tailwind CSS | Interface do utilizador |
| Estado frontend | Zustand | Gestão de estado (simples, sem Redux) |
| Backend media | Node.js 20 sidecar (TypeScript) | Workers FFmpeg, QC, áudio |
| Base de dados | SQLite via better-sqlite3 | Dados locais (ficheiro único) |
| Transcode core | FFmpeg 6.x | Motor principal de processamento |
| Batch encoding | HandBrake CLI | Proxies e web outputs |
| Análise media | MediaInfo + FFprobe | Validação de containers e streams |
| Conformance | MediaConch | Verificação AS-11 broadcast |
| Loudness | BS1770GAIN | Medição independente LUFS/True Peak |
| Build | esbuild | Bundling do sidecar Node.js |
| Testes | Vitest | Unit + integration tests |
| Linting | ESLint | Qualidade de código |
| CI/CD | GitHub Actions | Build automático das 3 plataformas |

## 2.2 — ADRs Desktop (Decisões Imutáveis)

Estas decisões são definitivas e não devem ser alteradas por nenhum agente IA.

| ADR | Decisão | Justificação |
|---|---|---|
| ADR-D001 | Tauri 2.x como shell nativa | Instalador 10x menor que Electron, RAM 6x menor |
| ADR-D002 | Node.js sidecar para lógica media | Reutiliza código dos workers do Server sem duplicação |
| ADR-D003 | SQLite como única base de dados | Zero configuração, ficheiro local, backup trivial |
| ADR-D004 | Fila em memória com persistência SQLite | Substituição simples do BullMQ+Redis do Server |
| ADR-D005 | Orchestrator local step-by-step | Substituição simples do Temporal.io do Server |
| ADR-D006 | Binários media incluídos no instalador | Zero dependências externas para o utilizador |
| ADR-D007 | GPU auto-detectada no startup | NVENC/AMF/QSV sem configuração manual |
| ADR-D008 | Notificações nativas do SO | Substituição dos webhooks HTTP do Server |
| ADR-D009 | Auto-updater via Tauri built-in | Actualizações automáticas sem intervenção |
| ADR-D010 | Mesmos parâmetros FFmpeg que o Server | Garantia de compatibilidade de outputs |
| ADR-D011 | IPC via Tauri Commands (não HTTP) | Comunicação directa Rust↔WebView, sem servidor HTTP |
| ADR-D012 | Deep links nexora://open?asset=UUID | Abrir assets directamente via URL |

---

---

# ═══════════════════════════════════════════
# PARTE 3 — ESTRUTURA DO PROJECTO DESKTOP
# ═══════════════════════════════════════════

## 3.1 — Árvore de Directórios

```
nexora-desktop/                       ← raiz do projecto desktop
│
├── src-tauri/                        ← Backend Rust (shell Tauri)
│   ├── src/
│   │   ├── main.rs                   ← Entry point Tauri
│   │   ├── commands/                 ← IPC handlers (Tauri Commands)
│   │   │   ├── mod.rs
│   │   │   ├── assets.rs             ← ingest_asset, list_assets, get_asset, delete_asset
│   │   │   ├── jobs.rs               ← submit_job, cancel_job, get_job_status
│   │   │   ├── settings.rs           ← get_settings, update_settings, get_profiles
│   │   │   └── system.rs             ← detect_gpu, get_disk_space, get_app_version
│   │   ├── db/
│   │   │   ├── mod.rs
│   │   │   ├── schema.sql            ← Schema SQLite completo
│   │   │   ├── migrations.rs         ← Migrações automáticas no startup
│   │   │   └── queries.rs            ← Queries preparadas
│   │   ├── sidecar.rs                ← Gestão do processo Node.js sidecar
│   │   ├── tray.rs                   ← System tray icon + menu contextual
│   │   └── updater.rs                ← Auto-updater
│   ├── binaries/                     ← Binários media por plataforma
│   │   ├── ffmpeg-x86_64-pc-windows-msvc.exe
│   │   ├── ffmpeg-x86_64-apple-darwin
│   │   ├── ffmpeg-aarch64-apple-darwin
│   │   ├── ffmpeg-x86_64-unknown-linux-gnu
│   │   ├── ffprobe-*                 ← Mesmas variantes por plataforma
│   │   ├── mediainfo-*
│   │   ├── bs1770gain-*
│   │   ├── HandBrakeCLI-*
│   │   └── mediaconch-*
│   ├── icons/                        ← Ícones da app (todas as resoluções)
│   │   ├── 32x32.png
│   │   ├── 128x128.png
│   │   ├── 128x128@2x.png
│   │   ├── icon.icns                 ← macOS
│   │   └── icon.ico                  ← Windows
│   ├── tauri.conf.json               ← Configuração Tauri principal
│   └── Cargo.toml                    ← Dependências Rust
│
├── src/                              ← Frontend React
│   ├── components/                   ← Componentes UI Nexora
│   │   ├── NexoraStatusBadge.tsx     ← Badge de estado (queued/processing/done/failed)
│   │   ├── VMAFGauge.tsx             ← Gauge visual do score VMAF
│   │   ├── ProgressBar.tsx           ← Barra de progresso com ETA
│   │   ├── DropZone.tsx              ← Zona de drag-and-drop de ficheiros
│   │   ├── JobCard.tsx               ← Card de cada job na fila
│   │   ├── AssetDetailPanel.tsx      ← Painel de detalhes do asset
│   │   ├── SettingsForm.tsx          ← Formulário de definições
│   │   └── GPUDetector.tsx           ← Indicador de GPU detectada
│   ├── pages/                        ← Páginas da app
│   │   ├── ProcessPage.tsx           ← Tab "Processar" (drop zone + jobs activos)
│   │   ├── HistoryPage.tsx           ← Tab "Histórico" (assets processados)
│   │   └── SettingsPage.tsx          ← Tab "Definições" (configuração)
│   ├── hooks/                        ← React hooks customizados
│   │   ├── useTauriCommand.ts        ← Hook genérico para Tauri Commands
│   │   ├── useJobStatus.ts           ← Hook de polling do estado dos jobs
│   │   ├── useNotification.ts        ← Hook para notificações nativas
│   │   └── useGPU.ts                 ← Hook para informação de GPU
│   ├── store/                        ← Zustand stores
│   │   ├── useJobStore.ts            ← Estado dos jobs e fila
│   │   ├── useSettingsStore.ts       ← Definições do utilizador
│   │   └── useAssetStore.ts          ← Assets processados
│   ├── lib/                          ← Utilitários
│   │   ├── tauri-bridge.ts           ← Abstracção sobre invoke()
│   │   └── formatters.ts             ← Formatação de duração, tamanho, etc.
│   ├── App.tsx                       ← Componente raiz
│   ├── main.tsx                      ← Entry point React
│   └── index.css                     ← Tailwind CSS base
│
├── sidecar/                          ← Node.js sidecar (workers media)
│   ├── index.ts                      ← Entry point do sidecar
│   ├── queue/
│   │   └── simple-queue.ts           ← NexoraSimpleQueue (memória + SQLite)
│   ├── pipeline/
│   │   └── desktop-orchestrator.ts   ← NexoraDesktopOrchestrator (step-by-step)
│   ├── workers/                      ← Workers de processamento (partilhados com Server)
│   │   ├── ingest-worker.ts
│   │   ├── transcode-worker.ts
│   │   ├── audio-worker.ts
│   │   ├── proxy-worker.ts
│   │   ├── thumbnail-worker.ts
│   │   ├── subtitle-worker.ts
│   │   ├── qc-pre-worker.ts
│   │   ├── qc-post-worker.ts
│   │   └── delivery-worker.ts
│   ├── profiles/                     ← Perfis de transcode (JSON)
│   │   ├── broadcast-h264-1080p.json
│   │   ├── broadcast-h264-4k.json
│   │   ├── streaming-h264-ladder.json
│   │   ├── streaming-h265-ladder.json
│   │   ├── archive-mezzanine.json
│   │   └── proxy-lowres.json
│   ├── db/
│   │   └── sqlite-adapter.ts        ← Adaptador SQLite para o sidecar
│   └── dist/                        ← Output do esbuild (bundle do sidecar)
│       └── sidecar.js
│
├── scripts/                          ← Scripts de automação
│   ├── download-media-binaries.js    ← Descarrega FFmpeg, MediaInfo, etc.
│   ├── nexora-desktop-setup.sh       ← Setup macOS/Linux
│   └── nexora-desktop-setup.ps1      ← Setup Windows
│
├── tests/                            ← Testes
│   ├── queue.test.ts
│   ├── orchestrator.test.ts
│   ├── workers.test.ts
│   └── fixtures/
│       └── generate-fixtures.sh      ← Gera ficheiros de teste com FFmpeg
│
├── .github/
│   └── workflows/
│       └── build-desktop.yml         ← GitHub Actions: build 3 plataformas
│
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vite.config.ts
├── PROGRESS-DESKTOP.md               ← Estado do projecto desktop
├── README-DESKTOP.md
└── .gitignore
```

## 3.2 — Relação com o Workspace Principal

O `nexora-desktop/` vive dentro do workspace principal do projecto:

```
nexora-media-processing/              ← workspace principal
├── arquitetura/                      ← documentos de arquitectura (todos os .md, scripts)
│   ├── nexora-desktop-documento.md   ← ESTE DOCUMENTO
│   ├── nexora-scaffold.js
│   ├── nexora-deploy-docs.js
│   ├── nexora-finalize.js
│   ├── nexora-setup.sh / .ps1
│   └── (restantes ficheiros de arquitectura)
├── nexora-desktop/                   ← PROJECTO DESKTOP (novo)
│   └── (estrutura descrita em 3.1)
├── src/                              ← código do Nexora Server
├── docker-compose.yml
├── package.json
├── PROGRESS.md                       ← estado do projecto Server
├── PROGRESS-DESKTOP.md               ← estado do projecto Desktop (symlink ou cópia)
└── README.md
```

---

---

# ═══════════════════════════════════════════
# PARTE 4 — PREPARAÇÃO DO AMBIENTE
# ═══════════════════════════════════════════

> **Para quem é esta secção:** Para quem vai desenvolver o Nexora Desktop. Se só quer usar a aplicação final (já compilada), salte para a PARTE 9.

## 4.1 — Requisitos de Desenvolvimento

Antes de começar a desenvolver, precisas de instalar estas ferramentas no teu computador:

| Ferramenta | Versão mínima | Para que serve |
|---|---|---|
| Node.js | 20.x LTS | Frontend React + Sidecar TypeScript |
| Rust | 1.77+ (stable) | Backend Tauri (compilação da shell nativa) |
| Git | 2.x | Controlo de versões e sincronização GitHub |
| FFmpeg | 6.x | Teste local de processamento media |
| VS Code / Antigravity | Mais recente | IDE de desenvolvimento |

## 4.2 — Setup macOS

```bash
# ── Passo 1: Instalar Homebrew (se não tiver) ──
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# ── Passo 2: Instalar ferramentas base ──
brew install node@20 git
brew install rustup-init
rustup-init -y  # Instalar Rust (aceitar defaults)
source "$HOME/.cargo/env"

# ── Passo 3: Instalar dependências Tauri (macOS já tem WKWebView) ──
# Não precisa de mais nada no macOS — WKWebView é built-in
xcode-select --install  # Xcode CLI tools (se não tiver)

# ── Passo 4: Instalar ferramentas de media para testes ──
brew install ffmpeg mediainfo

# ── Passo 5: Instalar targets de compilação ──
rustup target add x86_64-apple-darwin    # Intel Mac
rustup target add aarch64-apple-darwin   # Apple Silicon

# ── Passo 6: Verificar tudo ──
node --version   # deve mostrar v20.x.x
cargo --version  # deve mostrar cargo 1.77+
git --version    # deve mostrar git 2.x.x
ffmpeg -version  # deve mostrar ffmpeg 6.x
```

## 4.3 — Setup Windows

Abrir PowerShell como Administrador:

```powershell
# ── Passo 1: Instalar Chocolatey (gestor de pacotes Windows) ──
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# ── Passo 2: Instalar ferramentas base ──
choco install nodejs-lts git -y
choco install rustup.install -y
rustup-init -y
# Fechar e reabrir PowerShell

# ── Passo 3: Instalar dependências Tauri (Windows) ──
# WebView2 já está incluído no Windows 10 1803+ e Windows 11
# Se por alguma razão não estiver:
# choco install webview2-runtime -y

# Instalar Visual Studio Build Tools (necessário para compilar Rust no Windows)
choco install visualstudio2022buildtools -y
choco install visualstudio2022-workload-vctools -y

# ── Passo 4: Instalar ferramentas de media para testes ──
choco install ffmpeg mediainfo-cli -y

# ── Passo 5: Verificar tudo ──
node --version   # v20.x.x
cargo --version  # cargo 1.77+
git --version    # git 2.x.x
ffmpeg -version  # ffmpeg 6.x
```

## 4.4 — Setup Linux (Ubuntu/Debian)

```bash
# ── Passo 1: Actualizar sistema ──
sudo apt update && sudo apt upgrade -y

# ── Passo 2: Instalar ferramentas base ──
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git build-essential

# Instalar Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

# ── Passo 3: Instalar dependências Tauri (Linux) ──
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  pkg-config \
  libssl-dev

# ── Passo 4: Instalar ferramentas de media para testes ──
sudo apt install -y ffmpeg mediainfo

# ── Passo 5: Verificar tudo ──
node --version   # v20.x.x
cargo --version  # cargo 1.77+
git --version    # git 2.x.x
ffmpeg -version  # ffmpeg 6.x
```

## 4.5 — Criar o Projecto Desktop

Após setup do ambiente, criar o projecto:

```bash
# Ir para o workspace principal
cd ~/Documents/nexora-media-processing  # ou C:\Dev\Nexora Media Processing

# Criar o projecto Tauri
npm create tauri-app@latest nexora-desktop -- --template react-ts

# Entrar no projecto
cd nexora-desktop

# Instalar dependências adicionais
npm install zustand better-sqlite3 esbuild concurrently
npm install -D @types/better-sqlite3 vitest @vitest/coverage-v8 eslint

# Criar pasta do sidecar
mkdir -p sidecar/{queue,pipeline,workers,profiles,db,dist}

# Criar pasta dos binários
mkdir -p src-tauri/binaries

# Criar pasta de testes
mkdir -p tests/fixtures

# Descarregar binários de media
node scripts/download-media-binaries.js
```

---

---

# ═══════════════════════════════════════════
# PARTE 5 — PROMPTS DE DESENVOLVIMENTO (Agentes IA)
# ═══════════════════════════════════════════

> **Como usar:** Cola cada prompt no teu IDE (Antigravity, Cursor, ou outro com IA integrada). Executa na ordem indicada. Cada prompt produz uma parte funcional da aplicação.

## 5.1 — Prompt Desktop 1: Tauri Setup + SQLite + IPC Base

```
PROJECTO: Nexora Media Processing — Desktop App
ROLE: Senior Tauri 2.x Developer + Rust Engineer

Estás a construir a shell nativa do Nexora Desktop.
Lê o PROGRESS-DESKTOP.md antes de começar.

STACK:
- Tauri 2.x (Rust)
- SQLite (better-sqlite3 via sidecar)
- React 18 + TypeScript (frontend já existe, não tocar agora)

TAREFA 1: CONFIGURAÇÃO TAURI

Configurar tauri.conf.json com:
{
  "productName": "Nexora Media Processing",
  "version": "0.1.0",
  "identifier": "io.nexora.media-processing",
  "build": {
    "beforeBuildCommand": "npm run build:sidecar && npm run build",
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist"
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.icns", "icons/icon.ico"],
    "resources": ["binaries/*"],
    "externalBin": [
      "binaries/ffmpeg", "binaries/ffprobe", "binaries/mediainfo",
      "binaries/bs1770gain", "binaries/mediaconch", "binaries/HandBrakeCLI",
      "sidecar/dist/sidecar"
    ]
  },
  "app": {
    "windows": [{
      "title": "Nexora Media Processing",
      "width": 1280,
      "height": 800,
      "minWidth": 900,
      "minHeight": 600,
      "center": true
    }],
    "security": {
      "csp": "default-src 'self'; style-src 'self' 'unsafe-inline'"
    }
  }
}

TAREFA 2: SQLITE SCHEMA

Criar src-tauri/src/db/schema.sql:

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  original_path TEXT NOT NULL,
  working_path TEXT,
  output_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  -- status: pending | analysed | processing | completed | failed
  profile TEXT NOT NULL DEFAULT 'broadcast_h264_1080p',
  file_size_bytes INTEGER,
  duration_seconds REAL,
  resolution_width INTEGER,
  resolution_height INTEGER,
  codec_video TEXT,
  codec_audio TEXT,
  frame_rate REAL,
  gop_size INTEGER,
  color_space TEXT,
  audio_channels INTEGER,
  audio_sample_rate INTEGER,
  sha256_input TEXT,
  sha256_output TEXT,
  vmaf_score REAL,
  loudness_lufs REAL,
  true_peak_dbtp REAL,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id),
  step TEXT NOT NULL,
  -- step: ingest | qc_pre | transcode | audio | proxy | thumbnails | qc_post | delivery
  status TEXT NOT NULL DEFAULT 'pending',
  -- status: pending | running | completed | failed | skipped
  progress_percent INTEGER DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id TEXT,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
  -- REGRA: INSERT only. UPDATE e DELETE proibidos nesta tabela.
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Settings defaults
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('output_folder', ''),
  ('default_profile', 'broadcast_h264_1080p'),
  ('max_concurrent_jobs', '2'),
  ('gpu_enabled', 'auto'),
  ('loudness_target', 'broadcast'),
  ('auto_update', 'true'),
  ('theme', 'system'),
  ('language', 'pt');

CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_jobs_asset ON jobs(asset_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_audit_asset ON audit_log(asset_id);

Implementar sistema de migrations automático em Rust:
- No startup, verificar versão actual da DB
- Aplicar migrations pendentes em ordem
- Registar cada migration aplicada

TAREFA 3: TAURI COMMANDS (IPC)

Implementar em Rust todos os comandos IPC:
- ingest_asset(path: String, profile: String) → String (asset_id)
- list_assets(status: Option<String>) → Vec<Asset>
- get_asset(asset_id: String) → Asset
- cancel_job(job_id: String) → ()
- open_output_folder(asset_id: String) → ()
- get_settings() → Settings
- update_settings(key: String, value: String) → ()
- detect_gpu() → GpuInfo
- get_disk_space(path: String) → DiskInfo
- get_app_version() → String
- check_for_updates() → UpdateInfo

TAREFA 4: SYSTEM TRAY

Implementar tray.rs:
- Ícone na barra de sistema com menu contextual
- Itens: "Abrir Nexora", separador, "Fila de jobs: N pendentes", separador, "Sair"
- Actualizar contagem de jobs em tempo real
- Duplo-clique no ícone abre a janela

ENTREGÁVEIS:
1. tauri.conf.json completo
2. schema.sql + migrations.rs funcionais
3. Todos os Tauri Commands implementados
4. System tray funcional
5. PROGRESS-DESKTOP.md actualizado

COMEÇAR POR:
1. tauri.conf.json
2. schema.sql
3. migrations.rs
4. commands/system.rs (detect_gpu, get_disk_space)
5. commands/settings.rs
6. tray.rs
```

## 5.2 — Prompt Desktop 2: Sidecar Node.js + Queue + Orchestrator

```
PROJECTO: Nexora Media Processing — Desktop App
ROLE: Senior Node.js Media Engineer

Estás a construir o sidecar Node.js do Nexora Desktop — o motor
de processamento de media que corre como processo filho do Tauri.
Lê o PROGRESS-DESKTOP.md antes de começar.

STACK:
- Node.js 20 + TypeScript
- SQLite via better-sqlite3
- FFmpeg, FFprobe, MediaInfo, BS1770GAIN, MediaConch, HandBrakeCLI
- Comunicação com Tauri via stdin/stdout (JSON-RPC)

TAREFA 1: SIMPLE QUEUE (NexoraSimpleQueue)

Criar sidecar/queue/simple-queue.ts:

Requisitos:
- Fila em memória com persistência em SQLite
- Máximo configurável de jobs simultâneos (default: 2)
- Prioridade: high > normal > low
- Retry com backoff exponencial: 2^attempt segundos, máximo 3 retries
- Recuperação automática de jobs interrompidos no startup
  (se a app fechar a meio de um job, ao reabrir retoma do step correcto)
- Emitir eventos para o frontend via stdout (JSON)
- Dead-letter: após 3 retries, marcar como failed com erro detalhado

Interface:
class NexoraSimpleQueue {
  constructor(db: Database, maxConcurrent: number)
  enqueue(assetId: string, profile: string, priority: 'high'|'normal'|'low'): string
  cancel(jobId: string): void
  getStatus(jobId: string): JobStatus
  getAll(): JobStatus[]
  onProgress(callback: (jobId: string, percent: number, step: string) => void): void
  recoverInterrupted(): void  // chamado no startup
}

TAREFA 2: DESKTOP ORCHESTRATOR (NexoraDesktopOrchestrator)

Criar sidecar/pipeline/desktop-orchestrator.ts:

Requisitos:
- Mesmos steps que o Nexora Server:
  ingest → qc_pre → transcode → audio → proxy → thumbnails → qc_post → delivery
- Idempotente: cada step é marcado como completo em SQLite
- Se a app fechar e reabrir a meio de um job, retoma do step correcto
- Limitar a 1 job de transcode de cada vez (CPU/GPU intensivo)
- Jobs de proxy e thumbnails podem correr em paralelo com o transcode
- Emitir progresso granular (% do FFmpeg via stderr parsing)
- Timeout configurável por step (default: 4h para transcode)

Interface:
class NexoraDesktopOrchestrator {
  constructor(db: Database, queue: NexoraSimpleQueue)
  processAsset(assetId: string, profile: string): Promise<void>
  getStepStatus(assetId: string): StepStatus[]
  cancelProcessing(assetId: string): void
}

TAREFA 3: WORKERS MEDIA

Implementar os workers (reutilizando lógica do Server quando possível):

1. ingest-worker.ts
   - Copiar ficheiro para pasta de trabalho
   - Extrair metadados com FFprobe
   - Gerar SHA-256 do input
   - Registar metadados na SQLite

2. qc-pre-worker.ts
   - Validar container (MP4/MOV/MXF/MKV/AVI/TS)
   - Verificar codec de vídeo e áudio presentes
   - Detectar CFR vs VFR
   - Verificar resolução mínima (720p)
   - MediaConch conformance check

3. transcode-worker.ts
   - Carregar perfil de transcode (JSON)
   - Detectar GPU disponível (NVENC/AMF/QSV/CPU)
   - Construir comando FFmpeg com parâmetros correctos:
     * GOP fixo: -g {fps*2} -keyint_min {fps*2}
     * Closed GOP: -flags +cgop
     * sc_threshold 0
     * bf 0 (broadcast)
     * pix_fmt yuv420p
     * vsync cfr
     * movflags +faststart
   - Executar via execFile (NUNCA exec com string)
   - Parse do progresso via stderr (frame=, fps=, time=)
   - Emitir progresso em tempo real

4. audio-worker.ts
   - Two-pass loudnorm:
     * Pass 1: análise (measured_I, measured_TP, measured_LRA)
     * Pass 2: correcção linear com valores medidos
   - Targets: broadcast (-23 LUFS, -1 dBTP) ou streaming (-14 LUFS, -1 dBTP)
   - Verificação com BS1770GAIN
   - Se desvio > 0.5 LU → re-process

5. proxy-worker.ts
   - 480p H.264 CRF 28 (rápido, qualidade baixa)
   - Pode correr em paralelo com transcode

6. thumbnail-worker.ts
   - 1 frame por cada 10 segundos
   - Sprite grid + ficheiro VTT para preview hover

7. qc-post-worker.ts
   - VMAF score (threshold por perfil: 85/90/93)
   - SHA-256 do output
   - MediaConch AS-11 (se broadcast)
   - Verificar: GOP, closed GOP, yuv420p, fast start, LUFS, true peak

8. delivery-worker.ts
   - Mover output para pasta configurada
   - Gerar relatório QC (JSON)
   - Enviar notificação nativa (via evento Tauri)
   - Actualizar SQLite (status: delivered)
   - Registar no audit log

TAREFA 4: PERFIS DE TRANSCODE

Criar ficheiros JSON em sidecar/profiles/:
- broadcast-h264-1080p.json
- broadcast-h264-4k.json
- streaming-h264-ladder.json
- streaming-h265-ladder.json
- archive-mezzanine.json
- proxy-lowres.json

Cada perfil deve conter: resolução, bitrate, codec, preset, GOP,
parâmetros de áudio, e parâmetros específicos de GPU.

ENTREGÁVEIS:
1. NexoraSimpleQueue completo e testável
2. NexoraDesktopOrchestrator completo e testável
3. 8 workers implementados
4. 6 perfis de transcode em JSON
5. PROGRESS-DESKTOP.md actualizado

COMEÇAR POR:
1. simple-queue.ts
2. desktop-orchestrator.ts
3. transcode-worker.ts (o mais complexo)
4. audio-worker.ts
5. Restantes workers
6. Perfis JSON
```

## 5.3 — Prompt Desktop 3: Frontend React Desktop

```
PROJECTO: Nexora Media Processing — Desktop App
ROLE: Senior React/TypeScript Frontend Developer

Estás a construir o frontend da versão Desktop do Nexora.
A interface é simples, com 3 tabs, sem a complexidade do Server.
Lê o PROGRESS-DESKTOP.md antes de começar.

STACK:
- React 18 + TypeScript
- Tailwind CSS (utility-first)
- Zustand (gestão de estado)
- Tauri IPC via @tauri-apps/api

FILOSOFIA DA INTERFACE:
- Simples e directa. 3 tabs, sem sidebar.
- A mesma aparência em Windows, macOS e Linux.
- Cores base: Azul #1A6FD4, Teal #4FB8A0 (paleta Nexora)
- Fundo claro/escuro seguindo o tema do SO
- Tipografia: system fonts (San Francisco no Mac, Segoe UI no Windows)

LAYOUT:

┌──────────────────────────────────────────────────────────┐
│  Nexora Media Processing          [GPU: NVENC]  [─][□][✕]│
├──────────────────────────────────────────────────────────┤
│  [Processar]    [Histórico]    [Definições]              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  TAB PROCESSAR:                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  │     Arrasta ficheiros para aqui                    │  │
│  │     ou clica para seleccionar                      │  │
│  │                                                    │  │
│  │     Formatos: MP4 · MOV · MXF · MKV · AVI · TS   │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Perfil: [Broadcast H.264 1080p ▾]                       │
│                                                          │
│  ── Jobs activos ───────────────────────────────────── │  │
│  ┌────────────────────────────────────────────────────┐  │
│  │  video_final.mp4     Transcode     ████████░░ 78%  │  │
│  │  ETA: 3m 22s         VMAF: —       [Cancelar]      │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  entrevista.mov      Áudio R128    ██████░░░░ 62%  │  │
│  │  ETA: 1m 05s         VMAF: —       [Cancelar]      │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  TAB HISTÓRICO:                                          │
│  Filtros: [Todos ▾] [Broadcast ▾] [Últimos 7 dias ▾]    │
│  ┌────────────────────────────────────────────────────┐  │
│  │  clip_01.mp4   ✓ Concluído   VMAF 94.2   2m 15s   │  │
│  │  [Abrir pasta] [Ver detalhes] [Reprocessar]        │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  promo.mov     ✗ Falhou      VMAF —      —        │  │
│  │  Erro: GOP não conforme   [Ver detalhes] [Retry]   │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  TAB DEFINIÇÕES:                                         │
│  Pasta de saída:    [~/Documents/Nexora/output]  [...]   │
│  Perfil padrão:     [Broadcast H.264 1080p ▾]           │
│  Jobs simultâneos:  [2 ▾]                                │
│  GPU:               NVIDIA RTX 3060 (NVENC) ✓ Detectada │
│  Tema:              [Sistema ▾]                          │
│  Actualizações:     [✓] Verificar automaticamente        │
│  Loudness target:   [Broadcast -23 LUFS ▾]              │
│                                                          │
└──────────────────────────────────────────────────────────┘

TAREFA 1: COMPONENTES UI

Criar todos os componentes listados na estrutura do projecto (3.1).
Cada componente deve:
- Usar Tailwind CSS para estilização
- Suportar tema claro e escuro (via prefers-color-scheme)
- Ser acessível (WCAG AA)
- Usar @tauri-apps/api/core invoke() para comunicar com Rust

TAREFA 2: HOOKS TAURI

- useTauriCommand(command, args): abstracção sobre invoke()
  com loading state, error handling, e retry
- useJobStatus(): polling de 1s dos jobs activos
- useNotification(): wrapper sobre @tauri-apps/api/notification
- useGPU(): informação de GPU detectada

TAREFA 3: STORES ZUSTAND

- useJobStore: jobs activos, fila, progresso
- useSettingsStore: definições do utilizador (persistidas via Tauri)
- useAssetStore: assets processados (paginados)

TAREFA 4: DRAG-AND-DROP

Implementar DropZone.tsx que:
- Aceita drag-and-drop de ficheiros (extensões: mp4, mov, mxf, mkv, avi, ts)
- Aceita clique para abrir file dialog nativo via @tauri-apps/api/dialog
- Mostra preview do ficheiro após drop (nome, tamanho, duração se disponível)
- Inicia processamento automaticamente após confirmar perfil
- Suporta múltiplos ficheiros de uma vez (enfileirados)

ENTREGÁVEIS:
1. Todos os componentes React implementados
2. 3 páginas (Process, History, Settings) funcionais
3. Hooks Tauri implementados
4. Stores Zustand configurados
5. Drag-and-drop funcional
6. PROGRESS-DESKTOP.md actualizado

COMEÇAR POR:
1. App.tsx com navegação por tabs
2. DropZone.tsx
3. useTauriCommand.ts
4. ProcessPage.tsx (mínimo funcional)
5. Restantes componentes
6. HistoryPage.tsx + SettingsPage.tsx
```

## 5.4 — Prompt Desktop 4: Build, Testes e Distribuição

```
PROJECTO: Nexora Media Processing — Desktop App
ROLE: Senior DevOps + Release Engineer

Estás a configurar o build cross-platform, testes e distribuição
do Nexora Desktop. Lê o PROGRESS-DESKTOP.md antes de começar.

TAREFA 1: GITHUB ACTIONS BUILD

Criar .github/workflows/build-desktop.yml que:
- Faz build para Windows (x64), macOS (Universal: Intel+ARM), Linux (x64)
- Usa tauri-apps/tauri-action@v0
- Descarrega binários de media antes do build
- Gera: .exe (Windows), .dmg (macOS), .AppImage + .deb + .rpm (Linux)
- Cria GitHub Release com todos os artefactos
- Trigger: push de tags v*

TAREFA 2: SCRIPT DE DOWNLOAD DE BINÁRIOS

Criar scripts/download-media-binaries.js que:
1. Detecta a plataforma alvo (env var TARGET_TRIPLE ou SO actual)
2. Descarrega de releases oficiais:
   - FFmpeg (ffmpeg.org/releases)
   - FFprobe (incluído no FFmpeg)
   - MediaInfo (mediaarea.net)
   - BS1770GAIN (GitHub releases)
   - MediaConch (mediaarea.net)
   - HandBrakeCLI (handbrake.fr)
3. Extrai os binários
4. Copia para src-tauri/binaries/ com nome correcto para Tauri:
   ffmpeg-x86_64-pc-windows-msvc.exe
   ffmpeg-x86_64-apple-darwin
   ffmpeg-aarch64-apple-darwin
   ffmpeg-x86_64-unknown-linux-gnu
5. Verifica que cada binário executa (ffmpeg -version)

TAREFA 3: TESTES

Criar testes em tests/:
- queue.test.ts: NexoraSimpleQueue (enqueue, cancel, priority, retry, recovery)
- orchestrator.test.ts: NexoraDesktopOrchestrator (steps, idempotency, recovery)
- workers.test.ts: transcode, audio, qc (com fixtures gerados por FFmpeg)

Criar tests/fixtures/generate-fixtures.sh:
- Gera ficheiros de teste com FFmpeg:
  * 10s 1080p H.264 com áudio (teste base)
  * 5s 720p VFR (teste de detecção VFR)
  * 3s sem áudio (teste de handling de missing audio)
  * 10s 4K HDR10 (teste de tone mapping)

TAREFA 4: SCRIPTS NPM

Configurar package.json:
"scripts": {
  "dev": "concurrently \"npm run dev:sidecar\" \"tauri dev\"",
  "dev:sidecar": "tsx watch sidecar/index.ts",
  "build": "npm run build:sidecar && vite build && tauri build",
  "build:sidecar": "esbuild sidecar/index.ts --bundle --platform=node --outfile=sidecar/dist/sidecar.js",
  "build:universal-mac": "tauri build --target universal-apple-darwin",
  "build:windows": "tauri build --target x86_64-pc-windows-msvc",
  "build:linux": "tauri build --target x86_64-unknown-linux-gnu",
  "download:binaries": "node scripts/download-media-binaries.js",
  "test": "vitest run",
  "test:coverage": "vitest run --coverage",
  "lint": "eslint src sidecar --ext .ts,.tsx",
  "fixtures:generate": "bash tests/fixtures/generate-fixtures.sh"
}

TAREFA 5: README-DESKTOP.md

Criar README completo com:
- O que é o Nexora Desktop
- Requisitos de sistema (utilizador final)
- Como instalar (por plataforma)
- Como usar (screenshot do workflow)
- Como contribuir (desenvolvimento)
- Links para documentação

ENTREGÁVEIS:
1. build-desktop.yml funcional
2. download-media-binaries.js funcional
3. Testes completos com fixtures
4. package.json com todos os scripts
5. README-DESKTOP.md
6. PROGRESS-DESKTOP.md actualizado
```

## 5.5 — Sequência de Execução dos Prompts

```
SEMANA 1:
  Dia 1-2: Prompt Desktop 1 (Tauri + SQLite + IPC)
  Dia 3-5: Prompt Desktop 2 (Sidecar + Queue + Orchestrator + Workers)

SEMANA 2:
  Dia 1-3: Prompt Desktop 3 (Frontend React Desktop)
  Dia 4-5: Prompt Desktop 4 (Build + Testes + Distribuição)

SEMANA 3:
  Integração final + testes end-to-end + polish da UI
  Build das 3 plataformas + GitHub Release
```

---

---

# ═══════════════════════════════════════════
# PARTE 6 — GUIA PASSO A PASSO DE EXECUÇÃO
# ═══════════════════════════════════════════

> **Para quem é:** Para alguém sem experiência que quer construir o Nexora Desktop do zero.

## 6.1 — Visão Geral: 10 Passos

```
PASSO  1: Instalar ferramentas (Node.js, Rust, Git, FFmpeg)
PASSO  2: Clonar o repositório GitHub
PASSO  3: Criar o projecto Tauri
PASSO  4: Executar Prompt Desktop 1 no IDE (Tauri + SQLite)
PASSO  5: Executar Prompt Desktop 2 no IDE (Sidecar + Workers)
PASSO  6: Executar Prompt Desktop 3 no IDE (Frontend React)
PASSO  7: Executar Prompt Desktop 4 no IDE (Build + Testes)
PASSO  8: Testar localmente (tauri dev)
PASSO  9: Correr testes automatizados (npm test)
PASSO 10: Build final + GitHub Release
```

## 6.2 — Passo a Passo Detalhado

### PASSO 1: Instalar Ferramentas

Segue as instruções da PARTE 4 para o teu sistema operativo (macOS, Windows ou Linux).

Quando terminares, verifica que tudo está instalado:

```bash
node --version    # Deve mostrar: v20.x.x
cargo --version   # Deve mostrar: cargo 1.77.x
git --version     # Deve mostrar: git 2.x.x
ffmpeg -version   # Deve mostrar: ffmpeg version 6.x
```

Se algum destes comandos falhar, volta à PARTE 4 e repete a instalação.

### PASSO 2: Clonar o Repositório

```bash
# Se ainda não tens o repositório
git clone https://github.com/TEU-USERNAME/nexora-media-processing.git
cd nexora-media-processing

# Se já tens o repositório
cd ~/Documents/nexora-media-processing  # ou C:\Dev\Nexora Media Processing
git pull origin main
```

### PASSO 3: Criar o Projecto Tauri

```bash
# Dentro do workspace principal
npm create tauri-app@latest nexora-desktop -- --template react-ts
cd nexora-desktop
npm install

# Instalar dependências adicionais
npm install zustand better-sqlite3 esbuild concurrently
npm install -D @types/better-sqlite3 vitest @vitest/coverage-v8

# Verificar que funciona
npm run tauri dev
# Deverá abrir uma janela com "Welcome to Tauri"
# Fechar a janela (Ctrl+C no terminal)
```

### PASSO 4: Executar Prompt Desktop 1

1. Abre o IDE (Antigravity, Cursor, etc.)
2. Abre a pasta `nexora-desktop` como workspace
3. Abre o chat de IA (Cmd+L no Cursor, ou painel IA no Antigravity)
4. Cola o **Prompt Desktop 1** (secção 5.1)
5. Prima Enter e aguarda
6. O agente vai criar: tauri.conf.json, schema.sql, migrations.rs, commands/, tray.rs
7. Quando terminar, verifica que compila:
   ```bash
   cargo check  # dentro de src-tauri/
   ```
8. Actualiza o PROGRESS-DESKTOP.md

### PASSO 5: Executar Prompt Desktop 2

1. No mesmo IDE, cola o **Prompt Desktop 2** (secção 5.2)
2. O agente vai criar: simple-queue.ts, desktop-orchestrator.ts, todos os workers, perfis JSON
3. Quando terminar, verifica que o sidecar compila:
   ```bash
   npx esbuild sidecar/index.ts --bundle --platform=node --outfile=sidecar/dist/sidecar.js
   ```
4. Actualiza o PROGRESS-DESKTOP.md

### PASSO 6: Executar Prompt Desktop 3

1. Cola o **Prompt Desktop 3** (secção 5.3)
2. O agente vai criar: componentes React, páginas, hooks, stores
3. Quando terminar, verifica que o frontend compila:
   ```bash
   npm run build  # vite build
   ```
4. Actualiza o PROGRESS-DESKTOP.md

### PASSO 7: Executar Prompt Desktop 4

1. Cola o **Prompt Desktop 4** (secção 5.4)
2. O agente vai criar: GitHub Actions, script de binários, testes, README
3. Actualiza o PROGRESS-DESKTOP.md

### PASSO 8: Testar Localmente

```bash
# Descarregar binários de media (primeira vez)
npm run download:binaries

# Iniciar em modo desenvolvimento
npm run dev

# A aplicação deverá abrir com:
# - 3 tabs (Processar, Histórico, Definições)
# - Drop zone funcional
# - GPU detectada automaticamente
# - System tray com ícone Nexora
```

### PASSO 9: Correr Testes

```bash
# Gerar ficheiros de teste
npm run fixtures:generate

# Correr todos os testes
npm test

# Com cobertura
npm run test:coverage
```

### PASSO 10: Build Final

```bash
# Build para a tua plataforma actual
npm run build

# Ou build específico:
npm run build:windows         # Windows
npm run build:universal-mac   # macOS (Intel + Apple Silicon)
npm run build:linux           # Linux

# O instalador estará em:
# src-tauri/target/release/bundle/
```

Para gerar builds das 3 plataformas automaticamente:
```bash
git tag v0.1.0
git push origin v0.1.0
# O GitHub Actions faz build das 3 plataformas e cria um Release
```

---

---

# ═══════════════════════════════════════════
# PARTE 7 — SCRIPTS DE AUTOMAÇÃO DESKTOP
# ═══════════════════════════════════════════

## 7.1 — nexora-desktop-setup.sh (macOS/Linux)

```bash
#!/bin/bash
# ═══════════════════════════════════════════════════════
# Nexora Desktop — Script de Setup do Ambiente
# Executar: bash scripts/nexora-desktop-setup.sh
# ═══════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warning() { echo -e "${YELLOW}[AVISO]${NC} $1"; }
error()   { echo -e "${RED}[ERRO]${NC} $1"; exit 1; }

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  Nexora Desktop — Setup             ║"
echo "╚══════════════════════════════════════╝"
echo ""

OS="$(uname -s)"
info "Sistema: $OS ($(uname -m))"

# ── Node.js ──
if command -v node &>/dev/null; then
  success "Node.js: $(node --version)"
else
  info "A instalar Node.js..."
  if [ "$OS" = "Darwin" ]; then
    brew install node@20
  else
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
  fi
  success "Node.js instalado: $(node --version)"
fi

# ── Rust ──
if command -v cargo &>/dev/null; then
  success "Rust: $(cargo --version)"
else
  info "A instalar Rust..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
  success "Rust instalado: $(cargo --version)"
fi

# ── Git ──
if command -v git &>/dev/null; then
  success "Git: $(git --version)"
else
  if [ "$OS" = "Darwin" ]; then
    brew install git
  else
    sudo apt install -y git
  fi
  success "Git instalado"
fi

# ── FFmpeg ──
if command -v ffmpeg &>/dev/null; then
  success "FFmpeg: $(ffmpeg -version 2>&1 | head -1)"
else
  info "A instalar FFmpeg..."
  if [ "$OS" = "Darwin" ]; then
    brew install ffmpeg
  else
    sudo apt install -y ffmpeg
  fi
  success "FFmpeg instalado"
fi

# ── Dependências Tauri (Linux) ──
if [ "$OS" = "Linux" ]; then
  info "A instalar dependências Tauri para Linux..."
  sudo apt install -y \
    libwebkit2gtk-4.1-dev libgtk-3-dev \
    libayatana-appindicator3-dev librsvg2-dev \
    pkg-config libssl-dev build-essential
  success "Dependências Tauri instaladas"
fi

# ── macOS: Xcode CLI tools ──
if [ "$OS" = "Darwin" ]; then
  if ! xcode-select -p &>/dev/null; then
    info "A instalar Xcode CLI tools..."
    xcode-select --install
  fi
  success "Xcode CLI tools OK"
fi

# ── Rust targets ──
rustup target add x86_64-unknown-linux-gnu 2>/dev/null || true
if [ "$OS" = "Darwin" ]; then
  rustup target add x86_64-apple-darwin aarch64-apple-darwin 2>/dev/null || true
fi

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  ✓ Setup Desktop concluído!         ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "Próximo passo: cd nexora-desktop && npm install"
```

## 7.2 — nexora-desktop-setup.ps1 (Windows)

```powershell
# ═══════════════════════════════════════════════════════
# Nexora Desktop — Script de Setup (Windows)
# Executar como Administrador:
#   Set-ExecutionPolicy Bypass -Scope Process -Force
#   .\scripts\nexora-desktop-setup.ps1
# ═══════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Nexora Desktop — Setup Windows      ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Verificar Chocolatey
if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Host "[INFO] A instalar Chocolatey..." -ForegroundColor Blue
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
}

# Node.js
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[INFO] A instalar Node.js..." -ForegroundColor Blue
    choco install nodejs-lts -y
} else {
    Write-Host "[OK] Node.js: $(node --version)" -ForegroundColor Green
}

# Git
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "[INFO] A instalar Git..." -ForegroundColor Blue
    choco install git -y
} else {
    Write-Host "[OK] Git: $(git --version)" -ForegroundColor Green
}

# Rust
if (!(Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "[INFO] A instalar Rust..." -ForegroundColor Blue
    choco install rustup.install -y
    rustup-init -y
} else {
    Write-Host "[OK] Rust: $(cargo --version)" -ForegroundColor Green
}

# Visual Studio Build Tools
Write-Host "[INFO] A verificar Visual Studio Build Tools..." -ForegroundColor Blue
choco install visualstudio2022buildtools -y
choco install visualstudio2022-workload-vctools -y

# FFmpeg
if (!(Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host "[INFO] A instalar FFmpeg..." -ForegroundColor Blue
    choco install ffmpeg -y
} else {
    Write-Host "[OK] FFmpeg instalado" -ForegroundColor Green
}

# MediaInfo
choco install mediainfo-cli -y 2>$null

Write-Host ""
Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✓ Setup Desktop concluído!          ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Próximo passo: cd nexora-desktop; npm install" -ForegroundColor Yellow
```

---

---

# ═══════════════════════════════════════════
# PARTE 8 — INTERFACE DO UTILIZADOR (UI/UX)
# ═══════════════════════════════════════════

## 8.1 — Design System Desktop

```
PALETA DE CORES NEXORA:
  Azul principal:     #1A6FD4
  Teal secundário:    #4FB8A0
  Sucesso:            #22C55E
  Erro:               #EF4444
  Warning:            #F59E0B
  Fundo claro:        #FFFFFF
  Fundo escuro:       #0F172A
  Texto claro:        #1E293B
  Texto escuro:       #E2E8F0
  Borda:              #E2E8F0 (claro) / #334155 (escuro)

TIPOGRAFIA:
  Windows:    Segoe UI
  macOS:      San Francisco (system)
  Linux:      Ubuntu / system-ui

  Tamanhos:
  Títulos:    18px semibold
  Subtítulos: 14px medium
  Corpo:      13px regular
  Mono:       JetBrains Mono / Cascadia Code / monospace (dados técnicos)

ESPAÇAMENTO:
  Padding interno:   16px
  Gap entre cards:   12px
  Margem da janela:  20px

ANIMAÇÕES:
  Duração base: 200ms ease-out
  Progresso:    transição suave de largura
  Hover:        opacity 0.8 → 1.0
```

## 8.2 — Experiência do Utilizador (UX Flow)

```
PRIMEIRO USO:
  1. Utilizador instala o Nexora Desktop (1 clique)
  2. Abre a app → janela com tab "Processar" activa
  3. GPU é detectada automaticamente (banner verde: "NVIDIA RTX 3060 detectada")
  4. Se pasta de saída não configurada → dialog a pedir para escolher
  5. Utilizador arrasta um ficheiro para a drop zone
  6. Selecciona o perfil (ou usa o default)
  7. Processamento inicia automaticamente
  8. Barra de progresso mostra: step actual, %, ETA
  9. Quando termina → notificação nativa do SO
  10. "Abrir pasta de saída" → abre explorador de ficheiros nativo

USO DIÁRIO:
  1. Arrastar ficheiros → processam automaticamente
  2. Tab "Histórico" → ver tudo o que foi processado
  3. Filtrar por: estado, perfil, data
  4. Clicar num asset → ver detalhes (VMAF, LUFS, SHA-256, duração)
  5. "Reprocessar" → envia o mesmo ficheiro com perfil diferente

NOTIFICAÇÕES:
  - Asset concluído → "✓ video_final.mp4 processado com sucesso (VMAF: 94.2)"
  - Asset falhou → "✗ clip_02.mov falhou: GOP não conforme após encode"
  - Actualização → "Nova versão disponível: Nexora v0.2.0"
```

---

---

# ═══════════════════════════════════════════
# PARTE 9 — BUILD CROSS-PLATFORM E DISTRIBUIÇÃO
# ═══════════════════════════════════════════

## 9.1 — Requisitos do Utilizador Final (Não Desenvolvedor)

### Windows

```
Requisitos mínimos:
  SO: Windows 10 versão 1803 ou superior
  CPU: 4 cores (recomendado 8+)
  RAM: 8 GB (recomendado 16 GB)
  Disco: 10 GB livres + espaço para media
  GPU (opcional): NVIDIA com driver 470+ (NVENC) / AMD com AMF / Intel QSV

Instalação:
  1. Descarregar NexoraMediaProcessing-Setup-x64.exe
  2. Executar o instalador (pode pedir permissão de administrador)
  3. Clicar "Seguinte" em todos os passos
  4. Abrir o Nexora a partir do Desktop ou Menu Iniciar
  Tempo estimado: ~2 minutos
```

### macOS

```
Requisitos mínimos:
  SO: macOS 11 Big Sur ou superior
  CPU: Apple Silicon (M1/M2/M3/M4) ou Intel (2018+)
  RAM: 8 GB (recomendado 16 GB)
  Disco: 10 GB livres + espaço para media
  GPU: Apple Silicon tem aceleração nativa (VideoToolbox)

Instalação:
  1. Descarregar NexoraMediaProcessing-universal.dmg
  2. Abrir o .dmg e arrastar o Nexora para a pasta Aplicações
  3. Na primeira abertura: Ctrl+clique → "Abrir" (bypass do Gatekeeper)
  Tempo estimado: ~1 minuto

Nota: Universal binary (corre nativamente em Intel e Apple Silicon)
```

### Linux

```
Requisitos mínimos:
  SO: Ubuntu 22.04+, Fedora 38+, ou equivalente
  CPU: 4 cores (recomendado 8+)
  RAM: 8 GB (recomendado 16 GB)
  Disco: 10 GB livres + espaço para media
  GPU (opcional): NVIDIA com driver proprietário / AMD VAAPI / Intel VAAPI

AppImage (recomendado — funciona em qualquer distro):
  1. Descarregar NexoraMediaProcessing-x86_64.AppImage
  2. chmod +x NexoraMediaProcessing-x86_64.AppImage
  3. ./NexoraMediaProcessing-x86_64.AppImage
  Tempo estimado: ~30 segundos

DEB (Ubuntu, Debian, Linux Mint):
  sudo dpkg -i nexora-media-processing_amd64.deb

RPM (Fedora, RHEL, openSUSE):
  sudo rpm -i nexora-media-processing.x86_64.rpm

Dependência adicional (se não estiver instalada):
  Ubuntu/Debian: sudo apt install libwebkit2gtk-4.1-0 libgtk-3-0
  Fedora: sudo dnf install webkit2gtk4.1 gtk3
```

## 9.2 — GitHub Actions Build

```yaml
# .github/workflows/build-desktop.yml

name: Build Nexora Desktop

on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      matrix:
        include:
          - platform: windows-latest
            args: '--target x86_64-pc-windows-msvc'
          - platform: macos-latest
            args: '--target universal-apple-darwin'
          - platform: ubuntu-22.04
            args: '--target x86_64-unknown-linux-gnu'

    runs-on: ${{ matrix.platform }}

    steps:
      - uses: actions/checkout@v4

      - name: Install Linux dependencies
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev libgtk-3-dev \
            libayatana-appindicator3-dev librsvg2-dev

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: >
            x86_64-pc-windows-msvc,
            x86_64-apple-darwin,
            aarch64-apple-darwin,
            x86_64-unknown-linux-gnu

      - name: Download media binaries
        run: node scripts/download-media-binaries.js

      - name: Install dependencies
        run: npm install

      - name: Build sidecar
        run: npm run build:sidecar

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        with:
          tagName: 'v__VERSION__'
          releaseName: 'Nexora Media Processing v__VERSION__'
          releaseBody: |
            Nexora Media Processing Desktop — instalador nativo.
            Inclui todos os binários de media (FFmpeg, MediaInfo, etc.)
            Zero configuração. Pronto a usar.
          args: ${{ matrix.args }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: nexora-desktop-${{ matrix.platform }}
          path: src-tauri/target/release/bundle/
```

## 9.3 — Auto-Updater

O Tauri 2.x tem auto-updater built-in. Configuração:

```json
// tauri.conf.json (adicionar ao existente)
{
  "plugins": {
    "updater": {
      "active": true,
      "dialog": true,
      "pubkey": "CHAVE_PUBLICA_AQUI",
      "endpoints": [
        "https://github.com/TEU-USERNAME/nexora-media-processing/releases/latest/download/latest.json"
      ]
    }
  }
}
```

Quando uma nova versão é publicada no GitHub Releases, o Nexora Desktop verifica automaticamente e notifica o utilizador.

---

---

# ═══════════════════════════════════════════
# PARTE 10 — TESTES E VALIDAÇÃO
# ═══════════════════════════════════════════

## 10.1 — Testes Unitários

```typescript
// tests/queue.test.ts — Exemplo de estrutura
import { describe, it, expect, beforeEach } from 'vitest';
import { NexoraSimpleQueue } from '../sidecar/queue/simple-queue';

describe('NexoraSimpleQueue', () => {
  let queue: NexoraSimpleQueue;

  beforeEach(() => {
    // Criar queue com SQLite em memória
    queue = new NexoraSimpleQueue(':memory:', 2);
  });

  it('deve enfileirar um job', () => {
    const jobId = queue.enqueue('asset-1', 'broadcast_h264_1080p', 'normal');
    expect(jobId).toBeDefined();
    expect(queue.getStatus(jobId).status).toBe('pending');
  });

  it('deve respeitar prioridade', () => {
    queue.enqueue('asset-low', 'proxy_lowres', 'low');
    queue.enqueue('asset-high', 'broadcast_h264_1080p', 'high');
    const all = queue.getAll();
    expect(all[0].priority).toBe('high');
  });

  it('deve cancelar um job', () => {
    const jobId = queue.enqueue('asset-1', 'broadcast_h264_1080p', 'normal');
    queue.cancel(jobId);
    expect(queue.getStatus(jobId).status).toBe('cancelled');
  });

  it('deve fazer retry com backoff', async () => {
    // Simular falha e verificar retry count + delay
  });

  it('deve recuperar jobs interrompidos no startup', () => {
    // Simular jobs com status 'running' na DB e verificar recovery
  });
});
```

## 10.2 — Testes de Integração Media

```bash
# tests/fixtures/generate-fixtures.sh
#!/bin/bash
# Gera ficheiros de teste para validação do pipeline

FIXTURES_DIR="tests/fixtures"
mkdir -p "$FIXTURES_DIR"

# Teste base: 10s 1080p H.264 com áudio
ffmpeg -y -f lavfi -i testsrc2=duration=10:size=1920x1080:rate=25 \
  -f lavfi -i sine=frequency=1000:duration=10 \
  -c:v libx264 -preset ultrafast -pix_fmt yuv420p \
  -c:a aac -b:a 128k \
  "$FIXTURES_DIR/test_1080p_h264.mp4"

# Teste VFR: 5s 720p Variable Frame Rate
ffmpeg -y -f lavfi -i testsrc2=duration=5:size=1280x720:rate=30 \
  -vf "setpts='if(eq(N,0),0,PTS+random(0)*0.02)'" \
  -c:v libx264 -preset ultrafast \
  "$FIXTURES_DIR/test_720p_vfr.mp4"

# Teste sem áudio: 3s 1080p
ffmpeg -y -f lavfi -i testsrc2=duration=3:size=1920x1080:rate=25 \
  -c:v libx264 -preset ultrafast -an \
  "$FIXTURES_DIR/test_1080p_no_audio.mp4"

# Teste 4K: 5s 3840x2160
ffmpeg -y -f lavfi -i testsrc2=duration=5:size=3840x2160:rate=25 \
  -f lavfi -i sine=frequency=440:duration=5 \
  -c:v libx264 -preset ultrafast -pix_fmt yuv420p \
  -c:a aac -b:a 128k \
  "$FIXTURES_DIR/test_4k_h264.mp4"

echo "✓ Fixtures gerados em $FIXTURES_DIR"
ls -la "$FIXTURES_DIR"
```

---

---

# ═══════════════════════════════════════════
# PARTE 11 — CHECKLIST DE ACEITAÇÃO DESKTOP
# ═══════════════════════════════════════════

A aplicação Desktop só é considerada "pronta" quando todos estes pontos estiverem verificados:

```
INSTALAÇÃO E PRIMEIRO USO:
[ ] Instala no Windows 10/11 sem erros
[ ] Instala no macOS 11+ (Intel e Apple Silicon)
[ ] Corre no Linux como AppImage sem dependências manuais adicionais
[ ] Primeira abertura: cria DB SQLite automaticamente
[ ] Primeira abertura: cria pasta de output automaticamente
[ ] Primeira abertura: pede pasta de saída se não configurada
[ ] GPU detectada automaticamente (ou "CPU mode" se nenhuma)
[ ] Tamanho do instalador ≤ 30 MB

FUNCIONALIDADE:
[ ] Drag-and-drop de ficheiro inicia processamento
[ ] Selecção de ficheiro via dialog nativo funciona
[ ] Múltiplos ficheiros enfileirados correctamente
[ ] Todos os 6 perfis de transcode funcionam
[ ] Progresso mostra: step, %, ETA
[ ] Cancelar job funciona (mata processo FFmpeg)
[ ] Notificação nativa quando asset fica pronto
[ ] Notificação nativa quando asset falha
[ ] "Abrir pasta de saída" abre explorador nativo
[ ] Histórico mostra todos os assets processados
[ ] Filtros no histórico funcionam (estado, perfil, data)
[ ] Detalhes do asset mostram: VMAF, LUFS, SHA-256, duração, resolução
[ ] Reprocessar asset com perfil diferente funciona
[ ] Definições: pasta de saída alterável
[ ] Definições: perfil padrão alterável
[ ] Definições: jobs simultâneos ajustável
[ ] Definições: tema claro/escuro
[ ] System tray: ícone com número de jobs pendentes
[ ] System tray: "Abrir Nexora" funciona
[ ] System tray: "Sair" fecha a app completamente

RESILIÊNCIA:
[ ] Jobs recuperados correctamente após fecho inesperado da app
[ ] DB SQLite não corrompe após crash
[ ] Backup automático diário da DB funciona
[ ] App funciona sem internet
[ ] App funciona sem GPU (fallback para CPU)
[ ] App funciona com disco quase cheio (alerta antes de falhar)

PIPELINE (qualidade — mesmos critérios que o Server):
[ ] GOP = fps×2 verificado com FFprobe no output
[ ] Closed GOP confirmado no output
[ ] 0 B-frames no output broadcast
[ ] sc_threshold = 0 nos parâmetros
[ ] yuv420p no output
[ ] moov atom no início (Fast Start) confirmado
[ ] BS1770GAIN confirma LUFS ±0.5 LU do target
[ ] BS1770GAIN confirma True Peak ≤ -1.0 dBTP
[ ] VMAF score calculado e guardado
[ ] SHA-256 calculado para input e output
[ ] Proxy 480p gerado
[ ] Thumbnails sprite gerado
[ ] Relatório QC JSON gerado por asset
[ ] Audit log append-only funcional

BUILD E DISTRIBUIÇÃO:
[ ] GitHub Actions build 3 plataformas sem erros
[ ] .exe funciona em Windows limpo
[ ] .dmg funciona em macOS limpo
[ ] .AppImage funciona em Ubuntu limpo
[ ] Auto-updater detecta novas versões
[ ] Testes unitários passam (>80% cobertura)
```

---

---

# ═══════════════════════════════════════════
# PARTE 12 — PROGRESS-DESKTOP.md (ESTADO DO PROJECTO)
# ═══════════════════════════════════════════

Este ficheiro deve ser criado na raiz do workspace como `PROGRESS-DESKTOP.md`:

```markdown
# Nexora Media Processing — Desktop Nativo — Estado do Projecto

> ⚠️ LEITURA OBRIGATÓRIA PARA TODOS OS AGENTES IA
>
> Este ficheiro DEVE ser lido ANTES de qualquer trabalho no Desktop.
> DEVE ser actualizado no FIM de cada sessão de desenvolvimento.
> Existe para reduzir tokens, evitar retrabalho, e manter consistência.

---

## Identidade

| Campo | Valor |
|---|---|
| Nome | Nexora Media Processing — Desktop |
| Versão | 0.1.0 |
| IDE | Google Antigravity |
| Stack Shell | Tauri 2.x (Rust) |
| Stack Frontend | React 18 + TypeScript + Tailwind CSS + Zustand |
| Stack Sidecar | Node.js 20 + TypeScript + esbuild |
| Base de dados | SQLite via better-sqlite3 |
| Media tools | FFmpeg · FFprobe · MediaInfo · BS1770GAIN · MediaConch · HandBrakeCLI |
| Build | GitHub Actions (Tauri Action) |
| Plataformas | Windows x64 · macOS Universal · Linux x64 |

---

## O que está concluído

- [ ] Setup do ambiente (nexora-desktop-setup executado)
- [ ] Projecto Tauri criado (npm create tauri-app)
- [ ] Dependências instaladas (npm install)
- [ ] Prompt Desktop 1 executado (Tauri + SQLite + IPC)
- [ ] Prompt Desktop 2 executado (Sidecar + Queue + Orchestrator + Workers)
- [ ] Prompt Desktop 3 executado (Frontend React Desktop)
- [ ] Prompt Desktop 4 executado (Build + Testes + Distribuição)
- [ ] Binários media descarregados (download-media-binaries.js)
- [ ] Testes unitários passam
- [ ] Build local funciona (tauri dev)
- [ ] Build final funciona (tauri build)
- [ ] GitHub Actions build 3 plataformas

---

## Em progresso agora

Data: ___________
Agente: ___________
A trabalhar em: ___________
Bloqueios: ___________

---

## Estrutura de ficheiros

nexora-desktop/
├── (actualizar à medida que cresce)

---

## Problemas conhecidos

| Data | Problema | Estado |
|---|---|---|
| — | Nenhum | — |

---

## ADRs Desktop (Imutáveis)

| ADR | Decisão |
|---|---|
| ADR-D001 | Tauri 2.x como shell nativa |
| ADR-D002 | Node.js sidecar para lógica media |
| ADR-D003 | SQLite como única base de dados |
| ADR-D004 | Fila em memória com persistência SQLite |
| ADR-D005 | Orchestrator local step-by-step |
| ADR-D006 | Binários media incluídos no instalador |
| ADR-D007 | GPU auto-detectada no startup |
| ADR-D008 | Notificações nativas do SO |
| ADR-D009 | Auto-updater via Tauri built-in |
| ADR-D010 | Mesmos parâmetros FFmpeg que o Server |
| ADR-D011 | IPC via Tauri Commands (não HTTP) |
| ADR-D012 | Deep links nexora://open?asset=UUID |

---

## Histórico de sessões

Nunca apagar linhas antigas.

| Data | O que foi feito | Agente usado | Ficheiros criados/modificados |
|---|---|---|---|
| YYYY-MM-DD | Projecto iniciado, PROGRESS-DESKTOP.md criado | — | PROGRESS-DESKTOP.md |

---

## Próximos passos (ordenados)

1. [ ] Executar script de setup do ambiente
2. [ ] Criar projecto Tauri (npm create tauri-app)
3. [ ] Instalar dependências
4. [ ] Executar Prompt Desktop 1 (Tauri + SQLite + IPC)
5. [ ] Executar Prompt Desktop 2 (Sidecar + Workers)
6. [ ] Executar Prompt Desktop 3 (Frontend React)
7. [ ] Executar Prompt Desktop 4 (Build + Testes)
8. [ ] Descarregar binários media
9. [ ] Testar localmente (tauri dev)
10. [ ] Build final + GitHub Release

---

## Contexto técnico rápido (para agentes IA)

Portas em uso (desenvolvimento):
- 1420 → Vite dev server (frontend React)
- Sem servidor HTTP em produção (IPC directo Tauri)

Convenções de código:
- TypeScript strict mode — sem "any" implícito
- Nomes em inglês no código, comentários em português
- Todos os erros são typed (nunca catch(e: any))
- Todos os IDs são UUID v4
- FFmpeg sempre via execFile (NUNCA exec com string)

Limites:
- Max jobs simultâneos: configurável (default 2)
- FFmpeg timeout: 4h por transcode
- SQLite max size: sem limite prático (filesystem local)

---

*Este ficheiro é a fonte de verdade do projecto Desktop.*
*Em caso de dúvida, consulta aqui.*
```

---

---

# ═══════════════════════════════════════════
# APÊNDICE A — VARIÁVEIS DE CONFIGURAÇÃO DESKTOP
# ═══════════════════════════════════════════

O Nexora Desktop não usa ficheiro `.env` — usa a tabela `settings` na SQLite. Valores por defeito:

| Chave | Valor default | Descrição |
|---|---|---|
| output_folder | (vazio — pede ao utilizador) | Pasta onde os ficheiros processados são guardados |
| default_profile | broadcast_h264_1080p | Perfil usado quando nenhum é seleccionado |
| max_concurrent_jobs | 2 | Número máximo de jobs em paralelo |
| gpu_enabled | auto | auto / nvidia / amd / intel / cpu |
| loudness_target | broadcast | broadcast (-23 LUFS) ou streaming (-14 LUFS) |
| auto_update | true | Verificar actualizações automaticamente |
| theme | system | system / light / dark |
| language | pt | Idioma da interface (pt / en) |
| vmaf_threshold_streaming | 85 | Score VMAF mínimo para streaming |
| vmaf_threshold_broadcast | 90 | Score VMAF mínimo para broadcast |
| vmaf_threshold_archive | 93 | Score VMAF mínimo para arquivo |
| ffmpeg_timeout_ms | 14400000 | Timeout do FFmpeg (4h em milissegundos) |
| max_retries | 3 | Número máximo de retries por job |
| backup_enabled | true | Backup automático diário da SQLite |

---

---

# ═══════════════════════════════════════════
# APÊNDICE B — MAPEAMENTO FUNCIONAL CLOUD → DESKTOP
# ═══════════════════════════════════════════

Este apêndice mostra como cada componente do Nexora Server é substituído no Desktop:

| Server (Cloud) | Desktop (Local) | Notas |
|---|---|---|
| PostgreSQL | SQLite (better-sqlite3) | Ficheiro local, zero config |
| BullMQ + Redis | NexoraSimpleQueue (memória + SQLite) | Mesma API, sem Redis |
| Temporal.io | NexoraDesktopOrchestrator | Idempotente, step-by-step |
| MinIO S3 | Pasta local (filesystem) | ~/Documents/Nexora/output |
| Fastify API REST | Tauri Commands (IPC directo) | Sem servidor HTTP |
| Grafana + Prometheus | Dashboard inline na app | Métricas básicas |
| Webhooks HTTP | Notificações nativas do SO | @tauri-apps/api/notification |
| Watch folder | Drag-and-drop na app | @tauri-apps/api/dialog |
| Multi-org RBAC | Mono-utilizador | Sem autenticação |
| JWT RS256 | N/A | Sem API externa |
| Docker Compose | Instalador nativo (.exe/.dmg/.AppImage) | Tauri bundle |
| Loki (logs) | Ficheiro de log local | pino → ficheiro rotativo |
| Alertmanager | Notificações nativas do SO | Apenas alertas locais |
| DRM packaging | Não incluído | Requer key server externo |

---

---

# ═══════════════════════════════════════════
# APÊNDICE C — TROUBLESHOOTING DESKTOP
# ═══════════════════════════════════════════

## Problemas de Instalação

| Problema | SO | Solução |
|---|---|---|
| "WebView2 não encontrado" | Windows | Instalar WebView2 Runtime: choco install webview2-runtime |
| "App não abre" | macOS | Ctrl+clique → "Abrir" (bypass Gatekeeper) |
| "libwebkit2gtk not found" | Linux | sudo apt install libwebkit2gtk-4.1-0 |
| "Tela branca ao abrir" | Todos | Actualizar drivers de GPU. Tentar com --disable-gpu |
| Instalador pede admin | Windows | Normal — precisa de permissões para instalar binários |

## Problemas de Processamento

| Problema | Causa provável | Solução |
|---|---|---|
| Transcode muito lento | GPU não detectada, a usar CPU | Verificar definições → GPU. Actualizar drivers |
| VMAF abaixo do threshold | Bitrate insuficiente para o conteúdo | Usar perfil com bitrate mais alto (ex: archive_mezzanine) |
| LUFS fora do target | Áudio com dinâmica extrema | Verificar se fonte é mono/estéreo. Ajustar LRA |
| Job fica "stuck" em processing | FFmpeg crash ou timeout | Cancelar e resubmeter. Verificar logs em ~/.local/share/Nexora/logs/ |
| "Disco cheio" durante transcode | Espaço insuficiente | Libertar espaço. Alterar pasta de output para disco com mais espaço |
| Erro "FFmpeg not found" | Binário corrompido ou não bundled | Reinstalar o Nexora Desktop |
| App não inicia após update | DB migration falhou | Apagar nexora.db (perdes histórico) ou reportar bug |

## Localizações dos Ficheiros

| O quê | Windows | macOS | Linux |
|---|---|---|---|
| Base de dados | %APPDATA%\Nexora\nexora.db | ~/Library/Application Support/Nexora/nexora.db | ~/.local/share/Nexora/nexora.db |
| Logs | %APPDATA%\Nexora\logs\ | ~/Library/Logs/Nexora/ | ~/.local/share/Nexora/logs/ |
| Backups | %APPDATA%\Nexora\backups\ | ~/Library/Application Support/Nexora/backups/ | ~/.local/share/Nexora/backups/ |
| Config | %APPDATA%\Nexora\ | ~/Library/Application Support/Nexora/ | ~/.config/Nexora/ |
| Output (default) | Documentos\Nexora\output\ | ~/Documents/Nexora/output/ | ~/Documents/Nexora/output/ |

---

---

# ═══════════════════════════════════════════
# APÊNDICE D — GLOSSÁRIO COMPLEMENTAR
# ═══════════════════════════════════════════

Termos específicos do Desktop que complementam o glossário do Manual Técnico v4.0:

| Termo | Definição |
|---|---|
| Tauri | Framework open source para criar apps desktop nativas usando Rust + WebView |
| WebView | Componente nativo do SO que renderiza HTML/CSS/JS (como um browser embutido) |
| Sidecar | Processo secundário que corre em paralelo com a app principal |
| IPC | Inter-Process Communication — comunicação entre o Rust (Tauri) e o React (frontend) |
| Tauri Command | Função em Rust que pode ser chamada pelo frontend via invoke() |
| AppImage | Formato de distribuição Linux — um único ficheiro executável, sem instalação |
| .dmg | Formato de instalação macOS — um disco virtual que se monta |
| WKWebView | Motor de rendering web nativo do macOS (Safari engine) |
| WebView2 | Motor de rendering web nativo do Windows (Edge/Chromium) |
| WebKitGTK | Motor de rendering web para Linux (necessário para Tauri) |
| Zustand | Biblioteca de gestão de estado para React (alternativa simples ao Redux) |
| esbuild | Bundler JavaScript ultra-rápido (compila o sidecar Node.js) |
| better-sqlite3 | Binding Node.js para SQLite (síncrono, rápido) |
| System Tray | Ícone na barra de sistema (bandeja do Windows, menu bar do macOS) |
| Deep Link | URL que abre directamente a app (ex: nexora://open?asset=UUID) |
| Universal Binary | Binário macOS que corre nativamente em Intel e Apple Silicon |
| NVENC | Encoder de hardware da NVIDIA (H.264/H.265 acelerado por GPU) |
| AMF | Advanced Media Framework da AMD (encoder de hardware) |
| QSV | Quick Sync Video da Intel (encoder de hardware) |
| VideoToolbox | Framework de aceleração de vídeo nativo do macOS/Apple Silicon |

---

---

# ═══════════════════════════════════════════
# NOTA FINAL
# ═══════════════════════════════════════════

Este documento é parte integrante do projecto Nexora Media Processing e complementa:

1. **Manual Técnico Completo v4.0 (Parte 1/2)** — arquitectura Server, prompts 1-10, setup do ambiente
2. **Manual Técnico Completo v4.0 (Parte 2/2)** — scripts de automação, apêndices, cheat sheets
3. **PROGRESS.md** — estado do projecto Server
4. **PROGRESS-DESKTOP.md** — estado do projecto Desktop (criado por este documento)
5. **.antigravity/rules.md** — regras globais para todos os agentes IA

O Nexora Desktop deve ser desenvolvido em paralelo com o Server, partilhando:
- A mesma lógica de workers (código TypeScript reutilizado)
- Os mesmos perfis de transcode (ficheiros JSON)
- Os mesmos parâmetros FFmpeg
- Os mesmos standards de qualidade (EBU R128, VMAF, GOP, etc.)
- O mesmo repositório GitHub

**Sequência recomendada de desenvolvimento:**
```
Server:  Semana 1-4 (Prompts 1-10 do Manual v4.0)
Desktop: Semana 1-3 (Prompts Desktop 1-4 deste documento)
         (pode ser desenvolvido em paralelo por outro agente/pessoa)
```

---

*Nexora Media Processing — Desktop Nativo — Documento de Progresso, Execução e Especificação Técnica v1.0*
*Stack 100% Open Source · Broadcast & OTT Grade · Portugal*
*Arquitecto: Claude Opus · Maio 2026*
