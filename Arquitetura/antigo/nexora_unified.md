# Nexora Media Processing
## Documento Técnico Unificado — v3.0

> Plataforma profissional de processamento de media para Broadcast & OTT  
> Dois modos de execução: **Desktop Nativo** (Windows · macOS · Linux) e **Cloud/Server**  
> Stack 100% Open Source · Arquitecto: Claude Sonnet

---

# ╔══════════════════════════════════════════════╗
# ║  PARTE 0 — DOIS MODOS, UMA PLATAFORMA      ║
# ╚══════════════════════════════════════════════╝

## A filosofia dos dois modos

O Nexora existe em dois sabores com a mesma base de código:

```
┌─────────────────────────────────────────────────────────────┐
│  NEXORA DESKTOP                                             │
│  Uma aplicação. Um instalador. Zero configuração.           │
│  Windows .exe · macOS .dmg · Linux .AppImage               │
│  Ideal para: editores, produtoras pequenas, técnicos solo   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  NEXORA SERVER (Cloud/On-premises)                          │
│  Docker Compose · API REST · Multi-utilizador               │
│  Temporal.io · Redis · PostgreSQL · MinIO · Grafana         │
│  Ideal para: broadcasters, OTT platforms, equipas grandes   │
└─────────────────────────────────────────────────────────────┘
```

**Mesmas funcionalidades. Diferente escala.**  
Um ficheiro processado no Desktop é 100% compatível com o Server.

---

## Comparação de modos

| Capacidade | Desktop | Server |
|---|---|---|
| Instalação | 1 ficheiro instalador | Docker Compose |
| Base de dados | SQLite (ficheiro local) | PostgreSQL |
| Fila de jobs | Async queue em memória | BullMQ + Redis |
| Orquestração | Workflow engine simples | Temporal.io |
| Storage | Pasta local ou externo USB | MinIO S3-compatible |
| Multi-utilizador | Não (mono-utilizador) | Sim (multi-org) |
| Jobs simultâneos | 2–4 (limitado por hardware) | Configurável (4–24+) |
| Dashboard | Integrado na app | Grafana + Prometheus |
| GPU aceleração | Sim (NVENC/AMF/QSV) | Sim |
| Todos os perfis Nexora | Sim | Sim |
| DRM packaging | Não (requer infra externa) | Sim (com key server) |
| Custo de infra | Zero | Servidor + storage |
| Requisito técnico | Nenhum | Docker, terminal |

---

---

# ╔══════════════════════════════════════════════╗
# ║  PARTE 1 — NEXORA DESKTOP                  ║
# ║  Aplicação Nativa: Windows · macOS · Linux  ║
# ╚══════════════════════════════════════════════╝

## 1.1 Stack Tecnológica Desktop

```
┌─────────────────────────────────────────────────────────────┐
│  TAURI 2.x (Shell nativo)                                   │
│  Rust backend + WebView nativo por plataforma               │
│  Windows: WebView2 (Chromium edge, já incluído no Win10/11) │
│  macOS: WKWebView (Safari engine, sem instalação extra)     │
│  Linux: WebKitGTK (instalado via package manager)           │
│  Tamanho instalador: ~15–25 MB (vs Electron ~120 MB)        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (WebView)                                         │
│  React 18 + TypeScript + Tailwind CSS + Zustand             │
│  Mesmo código que Nexora Server (shared UI package)         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  BACKEND (Rust + Node.js sidecar)                           │
│  Rust: sistema de ficheiros, IPC com frontend, tray icon    │
│  Node.js sidecar: workers FFmpeg, QC engine, audio          │
│  (Rust lida com o OS; Node.js lida com media logic)         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  DADOS                                                      │
│  SQLite (via better-sqlite3) — ficheiro local               │
│  Localização: ~/Documents/Nexora/nexora.db                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  MEDIA TOOLS (binários incluídos no instalador)             │
│  FFmpeg · FFprobe · MediaInfo · BS1770GAIN · MediaConch     │
│  HandBrakeCLI (binários compilados por plataforma)          │
│  Zero instalação manual pelo utilizador                     │
└─────────────────────────────────────────────────────────────┘
```

## 1.2 Porquê Tauri e não Electron?

| Critério | Electron | Tauri |
|---|---|---|
| Tamanho instalador | 80–150 MB | 10–25 MB |
| RAM em idle | ~200 MB | ~30 MB |
| CPU em idle | Alto | Muito baixo |
| Motor JS | Node.js bundled | Node.js sidecar (opcional) |
| Binários de media | Mais fácil de bundlar | Bundlar via Tauri sidecar |
| Build cross-platform | GitHub Actions | GitHub Actions (Tauri Action) |
| Maturidade | Muito alta (VS Code, Slack) | Alta (Tauri 2.x estável) |
| Segurança | Processo Chromium completo | Menor superfície de ataque |

**Decisão:** Tauri 2.x com Node.js sidecar para a lógica de media.  
O Node.js sidecar é o mesmo código dos workers do Nexora Server — sem duplicação.

## 1.3 Estrutura do Projecto Desktop

```
nexora-desktop/
├── src-tauri/                    # Backend Rust
│   ├── src/
│   │   ├── main.rs               # Entry point Tauri
│   │   ├── commands/
│   │   │   ├── assets.rs         # IPC: ingest, list, delete
│   │   │   ├── jobs.rs           # IPC: submit, cancel, status
│   │   │   ├── settings.rs       # IPC: profiles, preferences
│   │   │   └── system.rs         # IPC: disk space, GPU detect
│   │   ├── db/
│   │   │   ├── schema.sql        # SQLite schema
│   │   │   └── migrations.rs     # Migrações automáticas no startup
│   │   ├── sidecar.rs            # Gestão do Node.js sidecar process
│   │   └── tray.rs               # System tray icon + menu
│   ├── binaries/                 # Binários media por plataforma
│   │   ├── ffmpeg-x86_64-pc-windows-msvc.exe
│   │   ├── ffmpeg-x86_64-apple-darwin
│   │   ├── ffmpeg-aarch64-apple-darwin  # Apple Silicon
│   │   ├── ffmpeg-x86_64-unknown-linux-gnu
│   │   ├── ffprobe-*/            # Mesmas variantes
│   │   ├── mediainfo-*/
│   │   ├── bs1770gain-*/
│   │   ├── HandBrakeCLI-*/
│   │   └── mediaconch-*/
│   ├── icons/                    # Ícones da app (todas as resoluções)
│   └── tauri.conf.json           # Configuração Tauri
│
├── src/                          # Frontend React (partilhado com Server)
│   ├── components/               # Componentes Nexora UI
│   ├── pages/                    # Dashboard, Assets, Queue, Settings
│   ├── hooks/                    # useTauriCommand, useJobStatus
│   └── store/                    # Zustand stores
│
├── sidecar/                      # Node.js sidecar (workers media)
│   ├── index.ts                  # Entry point sidecar
│   ├── queue/
│   │   └── simple-queue.ts       # Async queue sem Redis
│   ├── workers/                  # MESMOS workers do Server
│   │   ├── qc.worker.ts
│   │   ├── transcode.worker.ts
│   │   ├── audio.worker.ts
│   │   ├── proxy.worker.ts
│   │   └── delivery.worker.ts
│   ├── pipeline/
│   │   ├── simple-orchestrator.ts  # Orquestrador simples (sem Temporal)
│   │   └── profiles.ts             # Mesmos perfis do Server
│   └── db/
│       └── sqlite-adapter.ts       # Adapter SQLite (substitui Prisma+PG)
│
└── package.json
```

## 1.4 SQLite Schema (substitui PostgreSQL)

```sql
-- nexora-desktop/src-tauri/db/schema.sql

CREATE TABLE IF NOT EXISTS assets (
  id              TEXT PRIMARY KEY,
  original_name   TEXT NOT NULL,
  original_path   TEXT NOT NULL,
  sha256_input    TEXT NOT NULL,
  sha256_output   TEXT,
  status          TEXT NOT NULL DEFAULT 'INGESTED',
  profile         TEXT NOT NULL,
  duration_ms     INTEGER,
  frame_rate      REAL,
  resolution      TEXT,
  vmaf_score      REAL,
  loudness_lufs   REAL,
  true_peak_dbtp  REAL,
  output_path     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id          TEXT PRIMARY KEY,
  asset_id    TEXT NOT NULL REFERENCES assets(id),
  type        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'PENDING',
  attempts    INTEGER NOT NULL DEFAULT 0,
  payload     TEXT,         -- JSON serializado
  result      TEXT,         -- JSON serializado
  error       TEXT,
  started_at  TEXT,
  finished_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY,
  asset_id    TEXT NOT NULL REFERENCES assets(id),
  event_type  TEXT NOT NULL,
  operator    TEXT NOT NULL DEFAULT 'local_user',
  payload     TEXT,         -- JSON serializado
  entry_hash  TEXT NOT NULL, -- SHA-256 chain
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_jobs_asset_id ON jobs(asset_id);
CREATE INDEX IF NOT EXISTS idx_audit_asset_id ON audit_logs(asset_id, created_at);

-- Trigger para updated_at automático
CREATE TRIGGER IF NOT EXISTS assets_updated_at
  AFTER UPDATE ON assets
  BEGIN
    UPDATE assets SET updated_at = datetime('now') WHERE id = NEW.id;
  END;
```

## 1.5 Simple Queue (substitui BullMQ + Redis)

```typescript
// sidecar/queue/simple-queue.ts
// Fila em memória com persistência em SQLite — sem Redis

interface QueueJob {
  id: string;
  assetId: string;
  type: JobType;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
  priority: 'high' | 'normal' | 'low';
}

export class NexoraSimpleQueue {
  private queues: Map<JobType, QueueJob[]> = new Map();
  private running: Set<string> = new Set();
  private maxConcurrent: number;
  private db: SQLiteAdapter;

  constructor(db: SQLiteAdapter, maxConcurrent = 2) {
    this.maxConcurrent = maxConcurrent;
    this.db = db;
    // Recuperar jobs não completados ao restart
    this.recoverPendingJobs();
  }

  async enqueue(job: Omit<QueueJob, 'attempts'>): Promise<void> {
    const fullJob = { ...job, attempts: 0 };
    const queue = this.queues.get(job.type) ?? [];
    // Ordenar por prioridade
    const priority = { high: 0, normal: 1, low: 2 };
    const insertAt = queue.findIndex(j => priority[j.priority] > priority[job.priority]);
    if (insertAt === -1) queue.push(fullJob);
    else queue.splice(insertAt, 0, fullJob);
    this.queues.set(job.type, queue);
    await this.db.updateJobStatus(job.id, 'PENDING');
    this.tick();
  }

  private async tick(): Promise<void> {
    if (this.running.size >= this.maxConcurrent) return;
    // Executar próximo job disponível por prioridade
    for (const [type, queue] of this.queues) {
      const job = queue.shift();
      if (!job) continue;
      this.running.add(job.id);
      this.processJob(job).finally(() => {
        this.running.delete(job.id);
        this.tick(); // processar próximo
      });
      if (this.running.size >= this.maxConcurrent) break;
    }
  }

  private async processJob(job: QueueJob): Promise<void> {
    await this.db.updateJobStatus(job.id, 'ACTIVE');
    try {
      await workerRouter(job); // executa o worker correcto pelo type
      await this.db.updateJobStatus(job.id, 'COMPLETED');
    } catch (err) {
      job.attempts++;
      if (job.attempts < job.maxAttempts) {
        // Retry com backoff: 2^attempts segundos
        const delay = Math.pow(2, job.attempts) * 1000;
        setTimeout(() => this.enqueue(job), delay);
      } else {
        await this.db.updateJobStatus(job.id, 'FAILED', String(err));
        // Emitir evento para o frontend
        emit('job:failed', { jobId: job.id, error: String(err) });
      }
    }
  }
}
```

## 1.6 Simple Orchestrator (substitui Temporal.io)

```typescript
// sidecar/pipeline/simple-orchestrator.ts
// Orquestrador local sem Temporal — workflows directos e simples

export class NexoraDesktopOrchestrator {
  constructor(
    private queue: NexoraSimpleQueue,
    private db: SQLiteAdapter
  ) {}

  async processAsset(assetId: string, profile: string): Promise<void> {
    // Estado persistido em SQLite — recuperável após crash/restart

    try {
      // ── SEQUENCIAL ──
      await this.runStep(assetId, 'QC_PRE', () => this.qcPreEncode(assetId));
      await this.runStep(assetId, 'ANALYZE', () => this.analyzeContent(assetId));

      // ── PARALELO ──
      await Promise.all([
        this.runStep(assetId, 'TRANSCODE', () => this.transcodeVideo(assetId, profile)),
        this.runStep(assetId, 'AUDIO', () => this.normalizeAudio(assetId, profile)),
      ]);

      // ── SEQUENCIAL ──
      await this.runStep(assetId, 'PROXY', () => this.generateProxy(assetId));
      await this.runStep(assetId, 'THUMBNAILS', () => this.generateThumbnails(assetId));
      await this.runStep(assetId, 'QC_POST', () => this.qcPostEncode(assetId));
      await this.runStep(assetId, 'DELIVER', () => this.deliver(assetId));

      await this.db.updateAssetStatus(assetId, 'READY');
      emit('asset:ready', { assetId });

    } catch (err) {
      await this.db.updateAssetStatus(assetId, 'FAILED');
      emit('asset:failed', { assetId, error: String(err) });
    }
  }

  private async runStep(
    assetId: string,
    step: string,
    fn: () => Promise<void>
  ): Promise<void> {
    // Verificar se o step já foi completado (restart recovery)
    const completed = await this.db.isStepCompleted(assetId, step);
    if (completed) return; // idempotente

    await this.db.markStepStarted(assetId, step);
    await fn();
    await this.db.markStepCompleted(assetId, step);
  }
}
```

## 1.7 Tauri Commands (IPC Rust ↔ Frontend)

```rust
// src-tauri/src/commands/assets.rs

use tauri::State;
use crate::db::Database;
use crate::sidecar::SidecarManager;

#[tauri::command]
pub async fn ingest_asset(
    path: String,
    profile: String,
    db: State<'_, Database>,
    sidecar: State<'_, SidecarManager>,
) -> Result<String, String> {
    // Validar que o ficheiro existe
    let path = std::path::Path::new(&path);
    if !path.exists() {
        return Err("Ficheiro não encontrado".to_string());
    }
    
    // Gerar UUID e calcular SHA-256
    let asset_id = uuid::Uuid::new_v4().to_string();
    let sha256 = calculate_sha256(&path).map_err(|e| e.to_string())?;
    
    // Guardar na DB
    db.insert_asset(&asset_id, path.to_str().unwrap(), &sha256, &profile)
        .map_err(|e| e.to_string())?;
    
    // Enviar para o sidecar processar
    sidecar.send_command("process_asset", serde_json::json!({
        "asset_id": asset_id,
        "profile": profile,
        "input_path": path.to_str().unwrap(),
    })).map_err(|e| e.to_string())?;
    
    Ok(asset_id)
}

#[tauri::command]
pub async fn list_assets(
    status: Option<String>,
    db: State<'_, Database>,
) -> Result<Vec<serde_json::Value>, String> {
    db.list_assets(status.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_asset(
    asset_id: String,
    db: State<'_, Database>,
) -> Result<serde_json::Value, String> {
    db.get_asset(&asset_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_output_folder(asset_id: String, db: State<'_, Database>) -> Result<(), String> {
    let asset = db.get_asset(&asset_id).map_err(|e| e.to_string())?;
    if let Some(output_path) = asset["output_path"].as_str() {
        // Abrir pasta no explorador de ficheiros nativo
        #[cfg(target_os = "windows")]
        std::process::Command::new("explorer").arg("/select,").arg(output_path).spawn().ok();
        #[cfg(target_os = "macos")]
        std::process::Command::new("open").arg("-R").arg(output_path).spawn().ok();
        #[cfg(target_os = "linux")]
        std::process::Command::new("xdg-open").arg(output_path).spawn().ok();
    }
    Ok(())
}
```

## 1.8 Detecção Automática de Binários (Rust)

```rust
// src-tauri/src/commands/system.rs

#[tauri::command]
pub fn get_bundled_binary_path(binary: String) -> Result<String, String> {
    // Tauri resolve o binário correcto para a plataforma automaticamente
    tauri::api::process::current_binary(&tauri::Env::default())
        .map_err(|e| e.to_string())
        .map(|app_path| {
            let bin_dir = app_path.parent().unwrap();
            let ext = if cfg!(target_os = "windows") { ".exe" } else { "" };
            bin_dir.join(format!("{}{}", binary, ext))
                   .to_string_lossy()
                   .to_string()
        })
}

#[tauri::command]
pub async fn detect_gpu() -> serde_json::Value {
    // NVIDIA
    let nvidia = std::process::Command::new("nvidia-smi")
        .arg("--query-gpu=name")
        .arg("--format=csv,noheader")
        .output();

    // Intel QSV
    let intel = std::process::Command::new("vainfo").output();

    serde_json::json!({
        "nvidia": nvidia.map(|o| o.status.success()).unwrap_or(false),
        "intel_qsv": intel.map(|o| o.status.success()).unwrap_or(false),
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
    })
}

#[tauri::command]
pub fn get_disk_space(path: String) -> serde_json::Value {
    // Espaço disponível na pasta de output
    use std::fs;
    if let Ok(metadata) = fs::metadata(&path) {
        serde_json::json!({
            "available_gb": get_available_space(&path) as f64 / 1e9,
            "path": path
        })
    } else {
        serde_json::json!({ "error": "Pasta não encontrada" })
    }
}
```

## 1.9 Interface Desktop — Diferenças vs Server

A UI Desktop é a mesma base do Server com estas adaptações:

**Watch folder** → substituído por drag-and-drop directo na app  
**MinIO browser** → substituído por "Abrir pasta de output" (explorador nativo)  
**Grafana** → substituído por dashboard inline simples  
**Multi-org** → removido (um utilizador local)  
**API Keys** → removidas  
**Webhooks** → simplificado para notificações do sistema operativo

**Notificações nativas:**
```typescript
// Notificação nativa do SO quando um asset fica pronto
import { sendNotification } from '@tauri-apps/api/notification';

async function notifyAssetReady(assetName: string) {
  await sendNotification({
    title: 'Nexora Media Processing',
    body: `✓ ${assetName} processado com sucesso`,
    icon: 'icons/icon.png'
  });
}
```

**System Tray:**
```rust
// Ícone na barra de sistema com status dos jobs
fn build_tray(app: &tauri::App) -> tauri::SystemTray {
    tauri::SystemTray::new()
        .with_menu(tauri::SystemTrayMenu::new()
            .add_item(tauri::CustomMenuItem::new("show", "Abrir Nexora"))
            .add_native_item(tauri::SystemTrayMenuItem::Separator)
            .add_item(tauri::CustomMenuItem::new("queue", "Fila de jobs: 0 pendentes"))
            .add_native_item(tauri::SystemTrayMenuItem::Separator)
            .add_item(tauri::CustomMenuItem::new("quit", "Sair"))
        )
}
```

## 1.10 Instalação Desktop — Por Plataforma

### Windows

```
Requisitos mínimos:
  OS: Windows 10 versão 1803 ou superior (WebView2 já incluído)
  CPU: 4 cores (recomendado 8+)
  RAM: 8 GB (recomendado 16 GB)
  Disco: 10 GB livres + espaço para media

Instalação:
  1. Descarregar NexoraMediaProcessing-Setup-x64.exe (ou arm64 para Surface)
  2. Executar o instalador (pode pedir permissão de administrador)
  3. Clicar "Seguinte" em todos os passos
  4. Abrir o Nexora a partir do Desktop ou Menu Iniciar
  Tempo: ~2 minutos

GPU aceleração (automática se detectada):
  NVIDIA: driver versão 470+ (NVENC H.264/H.265)
  AMD: driver recente com AMF (Advanced Media Framework)
  Intel: driver com Quick Sync Video
```

### macOS

```
Requisitos mínimos:
  OS: macOS 11 Big Sur ou superior
  CPU: Apple Silicon (M1/M2/M3) ou Intel (2018+)
  RAM: 8 GB (recomendado 16 GB)
  Disco: 10 GB livres + espaço para media

Instalação:
  1. Descarregar NexoraMediaProcessing.dmg
     (ficheiro universal: funciona em Intel E Apple Silicon)
  2. Abrir o .dmg
  3. Arrastar o ícone Nexora para a pasta Aplicações
  4. Na primeira abertura: clicar direito → Abrir (para aceitar app sem assinatura)
     (ou: Preferências do Sistema → Privacidade e Segurança → Abrir mesmo assim)
  Tempo: ~1 minuto

GPU aceleração:
  Apple Silicon: VideoToolbox nativo (extremamente eficiente)
  Intel Mac: Intel Quick Sync Video automático
```

### Linux

```
Requisitos mínimos:
  Kernel: 4.19 ou superior
  GTK: 3.24 ou superior (Ubuntu 18.04+, Fedora 30+, Arch recente)
  CPU: 4 cores (recomendado 8+)
  RAM: 8 GB (recomendado 16 GB)
  Disco: 10 GB livres + espaço para media

Opções de instalação:

APPIMAGE (universal — funciona em qualquer distro):
  1. Descarregar NexoraMediaProcessing-x86_64.AppImage
  2. Tornar executável: chmod +x NexoraMediaProcessing-x86_64.AppImage
  3. Executar: ./NexoraMediaProcessing-x86_64.AppImage
  Tempo: ~30 segundos

DEB (Ubuntu, Debian, Linux Mint):
  sudo dpkg -i nexora-media-processing_amd64.deb
  nexora-media-processing

RPM (Fedora, RHEL, openSUSE):
  sudo rpm -i nexora-media-processing.x86_64.rpm
  nexora-media-processing

Dependência adicional (apenas Linux, se não estiver instalada):
  Ubuntu/Debian: sudo apt install libwebkit2gtk-4.1-0 libgtk-3-0
  Fedora: sudo dnf install webkit2gtk4.1 gtk3
  Arch: sudo pacman -S webkit2gtk-4.1 gtk3

GPU aceleração:
  NVIDIA: instalar driver proprietário + nvidia-utils
  AMD: VAAPI via mesa (sudo apt install mesa-va-drivers)
  Intel: VAAPI via intel-media-va-driver
```

## 1.11 Build Cross-Platform (GitHub Actions)

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

      # Descarregar binários de media pré-compilados
      - name: Download media binaries
        run: node scripts/download-media-binaries.js

      - name: Install frontend dependencies
        run: npm install

      - name: Build sidecar Node.js
        run: npm run build:sidecar

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        with:
          tagName: 'v__VERSION__'
          releaseName: 'Nexora Media Processing v__VERSION__'
          args: ${{ matrix.args }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: nexora-${{ matrix.platform }}
          path: src-tauri/target/release/bundle/
```

## 1.12 Script de Download de Binários Media

```javascript
// scripts/download-media-binaries.js
// Descarrega FFmpeg, MediaInfo, etc. pré-compilados para cada plataforma

const BINARIES = {
  ffmpeg: {
    'x86_64-pc-windows-msvc': 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
    'x86_64-apple-darwin': 'https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip',
    'aarch64-apple-darwin': 'https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip',
    'x86_64-unknown-linux-gnu': 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz',
  },
  // ... mediainfo, bs1770gain, mediaconch, HandBrakeCLI
};

async function downloadAll() {
  const platform = process.env.TARGET_TRIPLE || detectPlatform();
  for (const [name, urls] of Object.entries(BINARIES)) {
    const url = urls[platform];
    if (!url) { console.warn(`No binary for ${name} on ${platform}`); continue; }
    await downloadAndExtract(url, `src-tauri/binaries/${name}-${platform}`);
    console.log(`✓ Downloaded ${name} for ${platform}`);
  }
}
downloadAll();
```

---

---

# ╔══════════════════════════════════════════════╗
# ║  PARTE 2 — NEXORA SERVER                   ║
# ║  Cloud / On-Premises / Docker               ║
# ╚══════════════════════════════════════════════╝

## 2.1 Stack Completa Server

```
Runtime: Node.js 20 LTS (TypeScript strict)
API: Fastify 4.x + OpenAPI 3.1
Queue: BullMQ + Redis 7
ORM: Prisma + PostgreSQL 15
Orquestração: Temporal.io
Storage: MinIO (S3-compatible)
Frontend: Next.js 14 + React + Tauri (opcional)
Observabilidade: Prometheus + Grafana + Loki + Alertmanager
Containers: Docker + Docker Compose
```

## 2.2 Docker Compose Completo

```yaml
# docker-compose.yml

version: "3.9"

services:
  nexora-api:
    build: .
    image: nexora/api:latest
    ports: ["3000:3000"]
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://nexora:${DB_PASSWORD}@postgres:5432/nexora_media
      - REDIS_URL=redis://redis:6379
      - MINIO_ENDPOINT=minio
      - TEMPORAL_ADDRESS=temporal:7233
    depends_on: [postgres, redis, minio, temporal]
    restart: unless-stopped
    deploy:
      resources:
        limits: { cpus: "1", memory: "512M" }

  nexora-worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    image: nexora/worker:latest
    environment:
      - DATABASE_URL=postgresql://nexora:${DB_PASSWORD}@postgres:5432/nexora_media
      - REDIS_URL=redis://redis:6379
      - NEXORA_INPUT_DIR=/media/input
      - NEXORA_OUTPUT_DIR=/media/output
      - NEXORA_TEMP_DIR=/media/temp
      - MAX_CONCURRENT_TRANSCODE_JOBS=${MAX_JOBS:-4}
    volumes:
      - nexora_input:/media/input
      - nexora_output:/media/output
      - nexora_temp:/media/temp
    depends_on: [postgres, redis]
    restart: unless-stopped
    deploy:
      resources:
        limits: { cpus: "4", memory: "8G" }

  temporal:
    image: temporalio/auto-setup:1.23
    ports: ["7233:7233"]
    environment:
      - DB=postgresql
      - DB_PORT=5432
      - POSTGRES_USER=nexora
      - POSTGRES_PWD=${DB_PASSWORD}
      - POSTGRES_SEEDS=postgres
    depends_on: [postgres]

  temporal-ui:
    image: temporalio/ui:2.26
    ports: ["8080:8080"]
    environment:
      - TEMPORAL_ADDRESS=temporal:7233

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=nexora
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=nexora_media
    volumes: [postgres_data:/var/lib/postgresql/data]
    deploy:
      resources:
        limits: { cpus: "2", memory: "2G" }

  redis:
    image: redis:7-alpine
    command: redis-server --save 60 1 --loglevel warning
    volumes: [redis_data:/data]

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    ports: ["9000:9000", "9001:9001"]
    environment:
      - MINIO_ROOT_USER=nexoraadmin
      - MINIO_ROOT_PASSWORD=${MINIO_PASSWORD}
    volumes: [minio_data:/data]

  prometheus:
    image: prom/prometheus:latest
    ports: ["9090:9090"]
    volumes:
      - ./config/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus

  grafana:
    image: grafana/grafana:latest
    ports: ["3001:3000"]
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD:-nexora}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./config/grafana/dashboards:/etc/grafana/provisioning/dashboards

  loki:
    image: grafana/loki:latest
    ports: ["3100:3100"]

volumes:
  postgres_data:
  redis_data:
  minio_data:
  nexora_input:
  nexora_output:
  nexora_temp:
  prometheus_data:
  grafana_data:
```

---

---

# ╔══════════════════════════════════════════════╗
# ║  PARTE 3 — GUIA DE EXECUÇÃO PASSO A PASSO  ║
# ║  (para absolutos iniciantes)               ║
# ╚══════════════════════════════════════════════╝

## 3.1 Modo Desktop — Começar em 5 minutos

### Passo 1 — Descarregar e instalar

Vai a **github.com/nexora-media/nexora/releases** e descarrega o ficheiro correcto para o teu sistema:

```
Windows:  NexoraMediaProcessing-Setup-x64.exe      (~25 MB)
macOS:    NexoraMediaProcessing.dmg                 (~20 MB)
Linux:    NexoraMediaProcessing-x86_64.AppImage     (~30 MB)
```

Instala normalmente. Não é necessário instalar mais nada — todos os binários de media (FFmpeg, MediaInfo, etc.) já estão incluídos no instalador.

### Passo 2 — Primeira abertura

Ao abrir pela primeira vez, o Nexora vai:
1. Criar a base de dados local (`~/Documents/Nexora/nexora.db`)
2. Detectar a GPU disponível (se existir)
3. Mostrar o assistente de configuração:
   - **Pasta de saída**: onde os ficheiros processados são guardados (default: `~/Documents/Nexora/Output`)
   - **Perfil padrão**: Broadcast HD, OTT Premium, Web ou Arquivo
   - **Jobs simultâneos**: 1, 2 ou 4 (depende do CPU)

### Passo 3 — Processar o primeiro ficheiro

1. Arrasta um ficheiro de vídeo para a janela do Nexora (ou clica "Adicionar ficheiros")
2. Confirma o perfil de processamento (ou muda se necessário)
3. Clica "Processar"
4. Acompanha o progresso na barra de status
5. Quando terminar, receberes uma notificação do sistema
6. Clica "Abrir pasta" para ver o resultado

### Passo 4 — Configurações avançadas (opcional)

Em **Definições → Processamento** podes configurar:
- Caminho do FFmpeg (se quiseres usar uma versão diferente da bundled)
- Perfis personalizados de encoding
- Loudness targets por perfil
- Pasta de watch (monitorização automática de uma pasta)

---

## 3.2 Modo Server — Docker (para técnicos)

### Passo 1 — Preparar o ambiente

```bash
# Verificar dependências
docker --version    # deve ser 24.x ou superior
docker compose version  # deve ser 2.x ou superior
node --version      # deve ser 20.x ou superior
git --version       # qualquer versão recente
```

Se algo estiver em falta, segue as instruções em **docs.docker.com/get-docker**.

### Passo 2 — Clonar o projecto

```bash
git clone https://github.com/nexora-media/nexora.git
cd nexora
```

### Passo 3 — Configurar variáveis

```bash
cp .env.example .env
# Abre o .env num editor e define:
# DB_PASSWORD, MINIO_PASSWORD, JWT_SECRET
# (os restantes têm valores padrão seguros para dev)
```

### Passo 4 — Iniciar tudo

```bash
# Iniciar todos os serviços
docker compose up -d

# Ver se está tudo a correr
docker compose ps

# Aguardar ~30 segundos e correr as migrações
sleep 30 && npm run db:migrate
```

### Passo 5 — Verificar

```bash
# API de saúde
curl http://localhost:3000/health/ready
# Deve retornar: {"status":"ok","db":"connected","redis":"connected"}

# Abrir interfaces web:
# App:        http://localhost:3000
# Temporal:   http://localhost:8080
# Grafana:    http://localhost:3001  (admin/nexora)
# MinIO:      http://localhost:9001  (nexoraadmin/nexoraadmin)
```

---

## 3.3 Executar Prompts de Desenvolvimento

### No Cursor (recomendado para iniciantes)

```
1. Instala o Cursor (cursor.com)
2. Abre a pasta do projecto: File → Open Folder
3. Prima Cmd+L (Mac) ou Ctrl+L (Windows) para abrir o chat
4. Cola o prompt pretendido e prime Enter
5. O Cursor cria os ficheiros automaticamente
```

### No OpenAI Codex (platform.openai.com)

```
1. Vai a platform.openai.com → Playground → Chat
2. Modelo: o1 ou gpt-4o
3. Cola o prompt e prima Enter
4. Copia o código gerado e cria os ficheiros no Cursor
```

### No Google AI Studio (aistudio.google.com)

```
1. Login com conta Google
2. Cria um novo prompt
3. Modelo: Gemini 2.5 Pro ou Flash
4. Cola o prompt e prima Run
5. Activa "Code execution" para o Gemini testar o código
```

### Sequência de execução dos prompts

```
Semana 1: Prompt 1 (Claude/Cursor) + Prompt 5 (DeepSeek)
Semana 2: Prompt 2 (Codex) + Prompt 6 (qualquer IDE)
Semana 3: Prompt 3 (Gemini) + Prompt 4 (Kimi)
Semana 4: Prompts 7, 8, 9, 10 (integração e testes)
Desktop:  Prompt DESKTOP (paralelo com semana 1–2)
```

---

---

# ╔══════════════════════════════════════════════╗
# ║  PARTE 4 — PROMPT DESKTOP                  ║
# ║  (para executar no Cursor / Claude Code)   ║
# ╚══════════════════════════════════════════════╝

```
PROJECTO: Nexora Media Processing — Desktop App

ROLE: Senior Tauri Developer + Node.js Media Engineer

Estás a construir a versão desktop nativa do Nexora Media Processing.
Uma aplicação que funciona em Windows, macOS e Linux sem qualquer
instalação de dependências pelo utilizador.

STACK:
- Shell: Tauri 2.x (Rust)
- Frontend: React 18 + TypeScript + Tailwind CSS + Zustand
- Backend lógica media: Node.js 20 sidecar (TypeScript)
- Base de dados: SQLite via better-sqlite3
- Binários incluídos: FFmpeg, FFprobe, MediaInfo, BS1770GAIN, MediaConch, HandBrakeCLI

FILOSOFIA:
- Zero configuração pelo utilizador
- Todos os binários de media incluídos no instalador
- SQLite como única dependência de dados (ficheiro local)
- Sem Docker, sem Redis, sem PostgreSQL, sem Temporal
- Mesma qualidade de output que o Nexora Server

ESTRUTURA DO PROJECTO:

nexora-desktop/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/ (assets.rs, jobs.rs, settings.rs, system.rs)
│   │   ├── db/ (schema.sql, migrations.rs, queries.rs)
│   │   └── sidecar.rs, tray.rs
│   ├── binaries/        (binários por plataforma)
│   ├── icons/
│   └── tauri.conf.json
├── src/
│   ├── components/      (NexoraStatusBadge, VMAFGauge, etc.)
│   ├── pages/           (Dashboard, Assets, Settings)
│   └── hooks/           (useTauriCommand, useJobStatus, useNotification)
├── sidecar/
│   ├── index.ts
│   ├── queue/           (simple-queue.ts — sem Redis)
│   ├── workers/         (mesmos workers do Server, adaptados)
│   ├── pipeline/        (simple-orchestrator.ts — sem Temporal)
│   └── db/              (sqlite-adapter.ts)
└── scripts/
    └── download-media-binaries.js

TAREFA 1: TAURI SETUP

Criar o projecto Tauri 2.x com:
- Configuração para build universal macOS (Intel + Apple Silicon)
- Windows x64
- Linux x86_64 + AppImage + deb + rpm
- System tray com: "Abrir Nexora", "Jobs pendentes: N", "Sair"
- Deep links: nexora://open?asset=UUID
- Auto-updater configurado (verificar novas versões automaticamente)
- Permissões mínimas (apenas acesso a ficheiros nas pastas configuradas)

tauri.conf.json deve ter:
{
  "bundle": {
    "active": true,
    "targets": "all",
    "identifier": "io.nexora.media-processing",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.icns", "icons/icon.ico"],
    "resources": ["binaries/*"],
    "externalBin": ["binaries/ffmpeg", "binaries/ffprobe", "binaries/mediainfo",
                    "binaries/bs1770gain", "binaries/mediaconch", "binaries/HandBrakeCLI",
                    "sidecar/dist/sidecar"]
  }
}

TAREFA 2: SQLITE SCHEMA + MIGRATIONS

Implementar em Rust:
- Schema SQL completo (assets, jobs, audit_logs, settings, processing_steps)
- Sistema de migrations automático no startup (verificar versão, aplicar pendentes)
- Localização DB: platform_data_dir()/Nexora/nexora.db
  (Windows: %APPDATA%\Nexora\nexora.db)
  (macOS: ~/Library/Application Support/Nexora/nexora.db)
  (Linux: ~/.local/share/Nexora/nexora.db)
- Backup automático diário para nexora.db.bak
- Vacuum automático semanal

TAREFA 3: SIMPLE QUEUE + ORCHESTRATOR (Node.js sidecar)

NexoraSimpleQueue:
- Fila em memória com persistência em SQLite
- Máximo configurável de jobs simultâneos (default: 2)
- Prioridade: high > normal > low
- Retry com backoff exponencial: 2^attempt segundos
- Recuperação automática de jobs interrompidos no startup
- Emitir eventos para o frontend via Tauri event system

NexoraDesktopOrchestrator:
- Mesmos steps que o Server (QC pré, análise, transcode, áudio, proxy, thumbnails, QC pós, delivery)
- Idempotente: cada step é marcado como completo em SQLite
- Se a app fechar e reabrir a meio de um job, retoma do step correcto
- Limitar a 1 job de transcode de cada vez no modo desktop
- Jobs de proxy e thumbnails podem correr em paralelo com o transcode

TAREFA 4: TAURI COMMANDS (IPC)

Implementar em Rust todos os comandos IPC:
- ingest_asset(path, profile) → String (asset_id)
- list_assets(status?) → Vec<Asset>
- get_asset(asset_id) → Asset
- cancel_job(job_id) → ()
- open_output_folder(asset_id) → ()
- get_settings() → Settings
- update_settings(key, value) → ()
- detect_gpu() → GpuInfo
- get_disk_space(path) → DiskInfo
- get_app_version() → String
- check_for_updates() → UpdateInfo

TAREFA 5: FRONTEND DESKTOP

Adaptar o frontend Nexora Server para desktop:
- Remover: multi-org, API keys, webhooks externos
- Adaptar: usar useTauriCommand() em vez de fetch() para a API
- Adicionar: janela de drag-and-drop (aceitar ficheiros arrastados para a app)
- Adicionar: botão "Abrir pasta de saída" em cada asset
- Adaptar: dashboard com métricas locais (sem Prometheus)
- Simplificar: sem sidebar de navegação complexa — tabs simples
- Adicionar: painel de Definições com: pasta de saída, perfil padrão, jobs simultâneos, GPU

Layout desktop (simples):
Tab 1: Processar → drop zone + lista de jobs activos
Tab 2: Histórico → todos os assets processados com filtros
Tab 3: Definições → pasta saída, perfil padrão, GPU, avançado

TAREFA 6: BINÁRIOS MEDIA

Script download-media-binaries.js que:
1. Detecta a plataforma alvo (da env var TARGET_TRIPLE)
2. Descarrega FFmpeg, FFprobe, MediaInfo, BS1770GAIN, HandBrakeCLI, MediaConch
   de releases oficiais de cada projecto
3. Extrai os binários
4. Copia para src-tauri/binaries/ com o nome correcto para o Tauri:
   ffmpeg-x86_64-pc-windows-msvc.exe
   ffmpeg-x86_64-apple-darwin
   ffmpeg-aarch64-apple-darwin
   ffmpeg-x86_64-unknown-linux-gnu
5. Verifica que cada binário executa correctamente (ffmpeg -version)

TAREFA 7: SCRIPTS npm

"dev": "concurrently \"npm run dev:sidecar\" \"tauri dev\"",
"dev:sidecar": "tsx watch sidecar/index.ts",
"build": "npm run build:sidecar && tauri build",
"build:sidecar": "esbuild sidecar/index.ts --bundle --platform=node --outfile=sidecar/dist/sidecar.js",
"build:universal-mac": "tauri build --target universal-apple-darwin",
"build:windows": "tauri build --target x86_64-pc-windows-msvc",
"build:linux": "tauri build --target x86_64-unknown-linux-gnu",
"download:binaries": "node scripts/download-media-binaries.js",
"test": "vitest run",
"lint": "eslint src sidecar --ext .ts,.tsx"

ENTREGÁVEIS:
1. Projecto Tauri 2.x completo e funcional
2. SQLite schema + sistema de migrations em Rust
3. NexoraSimpleQueue com persistência e recovery
4. NexoraDesktopOrchestrator com idempotência
5. Todos os Tauri Commands implementados em Rust
6. Frontend adaptado para desktop (sem deps do Server)
7. Script download-media-binaries.js funcional
8. GitHub Actions para build das 3 plataformas
9. Testes unitários para queue e orchestrator
10. README de desenvolvimento desktop

COMEÇAR POR (nesta ordem):
1. npm create tauri-app@latest nexora-desktop
2. Configurar tauri.conf.json
3. Implementar SQLite schema e migrations
4. Implementar NexoraSimpleQueue
5. Implementar 3 Tauri Commands base (ingest, list, get)
6. Frontend mínimo funcional (upload + lista)
7. Integrar sidecar Node.js
8. Adicionar binários media
9. Testes e refinamento
10. GitHub Actions
```

---

---

# ╔══════════════════════════════════════════════╗
# ║  PARTE 5 — TODOS OS PROMPTS SERVER (1–10)  ║
# ╚══════════════════════════════════════════════╝

*(Ver secções anteriores do documento — Prompts 1 a 10 completos com toda a especificação técnica de backend, API, frontend, segurança, testes e coordenação multi-agente. Todos os nomes actualizados para Nexora Media Processing.)*

---

---

# ╔══════════════════════════════════════════════╗
# ║  PARTE 6 — FERRAMENTAS OPEN SOURCE         ║
# ╚══════════════════════════════════════════════╝

## 6.1 Comparação e Decisão de Uso

| Ferramenta | Papel no Nexora | Desktop | Server |
|---|---|---|---|
| **FFmpeg 6.x** | Motor principal transcode, VMAF | ✓ bundled | ✓ container |
| **HandBrakeCLI** | Proxies e web outputs | ✓ bundled | ✓ container |
| **MediaInfo** | Análise de containers | ✓ bundled | ✓ container |
| **FFprobe** | Análise frame-level | ✓ bundled | ✓ container |
| **MediaConch** | Conformance AS-11/IMF | ✓ bundled | ✓ container |
| **BS1770GAIN** | Medição EBU R128 independente | ✓ bundled | ✓ container |
| **libvmaf** | VMAF scoring (integrado no FFmpeg) | ✓ via FFmpeg | ✓ via FFmpeg |
| **VLC** | Sanity check playback final | Opcional | Opcional |
| **SQLite** | Base de dados local | ✓ nativo | — |
| **PostgreSQL** | Base de dados multi-user | — | ✓ Docker |
| **Redis** | Queue e cache | — | ✓ Docker |
| **Temporal.io** | Workflow orchestration | — | ✓ Docker |
| **MinIO** | Object storage S3-compat | — | ✓ Docker |
| **Prometheus** | Métricas | — | ✓ Docker |
| **Grafana** | Dashboards | — | ✓ Docker |

## 6.2 HandBrake — Quando Usar e Quando Não Usar

**✅ Usar HandBrakeCLI para:**
- Geração de proxies LowRes (720p, 800kbps)
- Outputs web para conteúdo de animação
- Batch encoding com presets standard

**❌ Nunca usar HandBrakeCLI para:**
- Perfil `nexora_broadcast_hd` — FFmpeg obrigatório (Closed GOP + IDR rigoroso)
- Perfil `nexora_ott_premium` — FFmpeg obrigatório (CMAF/DRM)
- Qualquer output para playout system — FFmpeg obrigatório
- Conformidade AS-11 — FFmpeg obrigatório

## 6.3 Alternativas GUI (uso manual complementar)

**HandBrake GUI** (handbrake.fr) — verificar outputs manualmente  
**Shutter Encoder** (shutter-encoder.com) — pré-processamento manual  
**VLC Media Player** (videolan.org) — verificação de playback  
**Avidemux** (avidemux.org) — trimming lossless antes de ingest

---

---

# ╔══════════════════════════════════════════════╗
# ║  PARTE 7 — CHEAT SHEETS                    ║
# ╚══════════════════════════════════════════════╝

## 7.1 Comandos FFmpeg de Diagnóstico

```bash
# Informação completa de um ficheiro
ffprobe -v quiet -print_format json -show_format -show_streams input.mp4

# Verificar GOP (keyframes)
ffprobe -v quiet -select_streams v:0 \
  -show_frames -show_entries frame=pict_type,key_frame,pts_time \
  input.mp4 | grep -E "key_frame|pict_type"

# Verificar CFR vs VFR
ffprobe -v quiet -select_streams v:0 \
  -show_entries stream=r_frame_rate,avg_frame_rate \
  -print_format json input.mp4

# Medir loudness
ffmpeg -i input.mp4 \
  -af "ebur128=peak=true" \
  -f null - 2>&1 | grep -E "Integrated|True peak"

# Verificar Fast Start (moov atom)
ffprobe -v trace input.mp4 2>&1 | grep -E "moov|mdat" | head -3
# moov ANTES de mdat = Fast Start OK
```

## 7.2 Transcode Nexora Broadcast HD

```bash
# GOP = fps × 2 (25fps → 50, 29.97fps → 60, 50fps → 100)

ffmpeg -y \
  -i "input.mp4" \
  -c:v libx264 -preset slow -tune film \
  -profile:v high -level:v 4.1 \
  -pix_fmt yuv420p \
  -g 50 -keyint_min 50 -sc_threshold 0 \
  -flags +cgop \
  -x264-params "open-gop=0:bframes=0:ref=4:nal-hrd=cbr:force-cfr=1" \
  -b:v 8000k -maxrate 8000k -bufsize 16000k \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -r 25 -vsync cfr \
  -c:a pcm_s24le -ar 48000 \
  -movflags +faststart \
  "output_broadcast.mp4"
```

## 7.3 EBU R128 Two-Pass

```bash
# Pass 1: Análise
ffmpeg -i "input.mp4" \
  -af "loudnorm=I=-23:TP=-1:LRA=11:print_format=json" \
  -f null - 2>&1 | grep -A 12 '"input_i"'

# Pass 2: Normalização (usar valores do Pass 1)
ffmpeg -y -i "input.mp4" \
  -af "loudnorm=I=-23:TP=-1:LRA=11:\
measured_I=-18.34:measured_TP=-3.27:\
measured_LRA=7.45:measured_thresh=-28.57:\
offset=-0.04:linear=true" \
  -c:v copy "output_normalized.mp4"

# Verificação BS1770GAIN (independente)
bs1770gain --ebu --integrated --truepeak --xml output_normalized.mp4
```

## 7.4 VMAF Scoring

```bash
ffmpeg \
  -i "mezzanine_reference.mp4" \
  -i "nexora_encoded_output.mp4" \
  -lavfi "[0:v][1:v]libvmaf=\
log_fmt=json:log_path=/tmp/vmaf.json:\
n_subsample=5:model=version=vmaf_v0.6.1" \
  -f null -

# Thresholds: archive≥93 | broadcast≥90 | streaming≥85 | proxy≥70
```

---

---

# ╔══════════════════════════════════════════════╗
# ║  PARTE 8 — SIZING, TROUBLESHOOTING,        ║
# ║  VARIÁVEIS E GLOSSÁRIO                     ║
# ╚══════════════════════════════════════════════╝

## 8.1 Sizing Guide

| Configuração | CPU | RAM | Disco | GPU | Jobs simultâneos |
|---|---|---|---|---|---|
| Desktop mínimo | 4 cores | 8 GB | 100 GB | Não necessária | 2 |
| Desktop recomendado | 8 cores | 16 GB | 500 GB SSD | RTX 3060 | 4 |
| Server pequeno | 8 cores | 32 GB | 1 TB SSD | RTX 3060 | 4–6 |
| Server médio | 16 cores | 64 GB | 2 TB NVMe | RTX 4070 | 8–12 |
| Server grande | 32 cores | 128 GB | 4 TB NVMe | RTX 4090 | 16–24 |

## 8.2 Tempos de Transcode (1h de conteúdo 1080p)

| Perfil | CPU 8c | GPU RTX 3060 | GPU RTX 4090 | Apple M2 |
|---|---|---|---|---|
| Broadcast HD | ~45 min | ~12 min | ~5 min | ~8 min |
| OTT Premium H.265 | ~90 min | ~20 min | ~8 min | ~15 min |
| Streaming Web | ~20 min | ~8 min | ~3 min | ~5 min |
| Proxy LowRes | ~8 min | ~3 min | ~1.5 min | ~2 min |

## 8.3 Troubleshooting

**Artefactos no vídeo pós-transcode:**
→ Verificar Closed GOP: `ffprobe -show_frames input.mp4 | grep "key_frame=1"`  
→ Se `pict_type=I` mas `key_frame=0` → I-frame sem IDR → adicionar `-flags +cgop`

**Áudio muito alto/baixo após normalização:**
→ Confirmar que Pass 2 usa valores medidos exactos do Pass 1  
→ Confirmar `linear=true` no Pass 2

**Ficheiro não carrega no browser:**
→ Verificar Fast Start: `ffprobe -v trace input.mp4 2>&1 | grep -E "moov|mdat"`  
→ Corrigir: `ffmpeg -i input.mp4 -c copy -movflags +faststart output.mp4`

**Desktop — App não abre no macOS:**
→ Clicar direito → Abrir (primeira vez)  
→ Ou: Definições → Privacidade e Segurança → Abrir mesmo assim

**Desktop — WebKitGTK em falta no Linux:**
→ Ubuntu: `sudo apt install libwebkit2gtk-4.1-0`  
→ Fedora: `sudo dnf install webkit2gtk4.1`

## 8.4 Variáveis de Ambiente (.env Server completo)

```bash
# Base de dados
DATABASE_URL=postgresql://nexora:change_me@postgres:5432/nexora_media
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Redis / Queue
REDIS_URL=redis://redis:6379
BULLMQ_PREFIX=nexora
QUEUE_DEFAULT_ATTEMPTS=3

# MinIO / Storage
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=nexoraadmin
MINIO_SECRET_KEY=change_in_production
MINIO_BUCKET_INPUT=nexora-input
MINIO_BUCKET_OUTPUT=nexora-output

# Temporal.io
TEMPORAL_ADDRESS=temporal:7233
TEMPORAL_NAMESPACE=nexora-production

# Auth
JWT_PRIVATE_KEY_PATH=/secrets/jwt_private.pem
JWT_PUBLIC_KEY_PATH=/secrets/jwt_public.pem
JWT_ALGORITHM=RS256
JWT_ACCESS_TOKEN_EXPIRY=1h

# Media processing
NEXORA_INPUT_DIR=/media/input
NEXORA_OUTPUT_DIR=/media/output
NEXORA_TEMP_DIR=/media/temp
FFMPEG_DEFAULT_TIMEOUT_MS=14400000
MAX_CONCURRENT_TRANSCODE_JOBS=4

# Loudness targets
LOUDNESS_TARGET_BROADCAST_LUFS=-23
LOUDNESS_TARGET_STREAMING_LUFS=-14
LOUDNESS_TRUE_PEAK_LIMIT_DBTP=-1.0

# VMAF thresholds
VMAF_THRESHOLD_ARCHIVE=93
VMAF_THRESHOLD_BROADCAST=90
VMAF_THRESHOLD_STREAMING=85
VMAF_THRESHOLD_PROXY=70

# Observabilidade
LOG_LEVEL=info
PROMETHEUS_PORT=9100

# API
PORT=3000
NODE_ENV=production
RATE_LIMIT_USER_RPM=1000
```

## 8.5 Glossário

| Termo | Definição simples |
|---|---|
| **GOP** | Grupo de imagens — pacote de frames independente |
| **IDR frame** | Frame que permite ao decoder começar do zero |
| **CFR** | Constant Frame Rate — fps constante |
| **VFR** | Variable Frame Rate — fps variável (problemático) |
| **B-frame** | Frame que depende do passado e do futuro |
| **LUFS** | Unidade de loudness percebido |
| **True Peak** | Pico máximo após reconstrução analógica |
| **EBU R128** | Standard europeu de loudness |
| **VMAF** | Métrica de qualidade de vídeo (Netflix) |
| **MXF** | Formato broadcast profissional |
| **CMAF** | Formato unificado HLS/DASH streaming |
| **DRM** | Protecção digital de conteúdo |
| **Tauri** | Framework para apps desktop nativas (Rust) |
| **SQLite** | Base de dados num único ficheiro (sem servidor) |
| **Temporal.io** | Orquestrador de workflows com estado |
| **yuv420p** | Formato de pixel obrigatório para distribuição |
| **Fast Start** | MP4 optimizado para streaming imediato |
| **Mezzanine** | Ficheiro de alta qualidade (referência/master) |
| **Proxy** | Versão baixa resolução para edição/preview |
| **Sidecar** | Processo secundário que corre junto à app principal |

---

---

# ╔══════════════════════════════════════════════╗
# ║  PARTE 9 — CHECKLIST DE ACEITAÇÃO FINAL   ║
# ╚══════════════════════════════════════════════╝

```
DESKTOP:
[ ] Instala no Windows 10/11 sem erros
[ ] Instala no macOS 11+ (Intel e Apple Silicon)
[ ] Corre no Linux como AppImage sem dependências manuais
[ ] Primeira abertura cria DB SQLite e pasta de output
[ ] GPU detectada automaticamente
[ ] Drag-and-drop de ficheiro inicia processamento
[ ] Notificação nativa quando asset fica pronto
[ ] Jobs recuperados correctamente após reinicio da app
[ ] "Abrir pasta de saída" abre explorador nativo
[ ] System tray mostra número de jobs pendentes

SERVER:
[ ] docker compose up -d sem erros
[ ] GET /health/ready → 200 OK
[ ] GET /metrics expõe métricas Prometheus
[ ] Grafana dashboard com dados reais
[ ] Temporal UI mostra workflows

PIPELINE (ambos os modos):
[ ] GOP = fps×2 verificado com FFprobe pós-encode
[ ] Closed GOP confirmado no output
[ ] 0 B-frames no output broadcast
[ ] sc_threshold = 0 nos parâmetros
[ ] yuv420p no output
[ ] moov atom no início (Fast Start)
[ ] BS1770GAIN confirma LUFS ±0.5 LU do target
[ ] BS1770GAIN confirma True Peak ≤ -1.0 dBTP
[ ] VMAF score calculado e guardado
[ ] SHA-256 calculado antes e depois

SEGURANÇA:
[ ] FFmpeg nunca chamado com exec() — sempre execFile()
[ ] Audit trail imutável (sem UPDATE/DELETE)
[ ] Magic bytes validation bloqueia ficheiros não-media
[ ] Path traversal rejeitado

QUALIDADE DE CÓDIGO:
[ ] tsc --noEmit sem erros
[ ] eslint sem warnings
[ ] vitest coverage ≥ 80%
[ ] QC rules: 100% branch coverage
[ ] Zero hardcoded secrets
```

---

*Nexora Media Processing — Documentação Técnica Unificada v3.0*  
*Desktop (Tauri) + Server (Docker) · 100% Open Source · Broadcast & OTT Grade*
