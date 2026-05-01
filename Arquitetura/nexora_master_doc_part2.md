# Nexora Media Processing — Manual v4.0 (Parte 2/2)

---

# ═══════════════════════════════════════════
# PARTE 7 — SCRIPTS DE AUTOMAÇÃO
# ═══════════════════════════════════════════

> **O que são estes scripts:** Programas que automatizam tarefas repetitivas. Em vez de criar ficheiros um a um, um script cria tudo automaticamente. Não precisas de perceber como funcionam — só precisas de os executar.

---

## 7.1 — Script de Setup do Ambiente (nexora-setup.sh / .ps1)

Este script instala todas as ferramentas necessárias no teu computador.

### nexora-setup.sh (macOS e Linux)

Cria o ficheiro `scripts/nexora-setup.sh`:

```bash
#!/bin/bash
# ═══════════════════════════════════════════════════════
# Nexora Media Processing — Script de Setup do Ambiente
# ═══════════════════════════════════════════════════════
# Executar: bash scripts/nexora-setup.sh
# O que faz: instala Node.js, Git, Docker, FFmpeg e
#            todas as ferramentas necessárias para o Nexora
# ═══════════════════════════════════════════════════════

set -e  # Parar se algum comando falhar

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # Sem cor

# Funções de log
info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warning() { echo -e "${YELLOW}[AVISO]${NC} $1"; }
error()   { echo -e "${RED}[ERRO]${NC} $1"; exit 1; }

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  Nexora Media Processing — Setup    ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Detectar sistema operativo ──
OS="$(uname -s)"
ARCH="$(uname -m)"
info "Sistema detectado: $OS ($ARCH)"

# ── macOS ──
if [ "$OS" = "Darwin" ]; then
  info "A configurar para macOS..."

  # Homebrew
  if ! command -v brew &> /dev/null; then
    info "A instalar o Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Configurar PATH para Apple Silicon
    if [ "$ARCH" = "arm64" ]; then
      echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
      eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
    success "Homebrew instalado"
  else
    success "Homebrew já instalado"
  fi

  # Actualizar Homebrew
  info "A actualizar Homebrew..."
  brew update

  # Node.js
  if ! command -v node &> /dev/null; then
    info "A instalar Node.js 20..."
    brew install node@20
    echo 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> ~/.zprofile
    export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
    success "Node.js instalado: $(node --version)"
  else
    success "Node.js já instalado: $(node --version)"
  fi

  # Git
  if ! command -v git &> /dev/null; then
    brew install git
    success "Git instalado"
  else
    success "Git já instalado: $(git --version)"
  fi

  # FFmpeg
  if ! command -v ffmpeg &> /dev/null; then
    info "A instalar FFmpeg (pode demorar alguns minutos)..."
    brew install ffmpeg
    success "FFmpeg instalado"
  else
    success "FFmpeg já instalado"
  fi

  # HandBrake CLI
  if ! command -v HandBrakeCLI &> /dev/null; then
    brew install handbrake
    success "HandBrake CLI instalado"
  else
    success "HandBrake CLI já instalado"
  fi

  # MediaInfo
  if ! command -v mediainfo &> /dev/null; then
    brew install mediainfo
    success "MediaInfo instalado"
  else
    success "MediaInfo já instalado"
  fi

  # MediaConch
  if ! command -v mediaconch &> /dev/null; then
    brew install mediaconch
    success "MediaConch instalado"
  else
    success "MediaConch já instalado"
  fi

  # BS1770GAIN
  if ! command -v bs1770gain &> /dev/null; then
    brew install bs1770gain 2>/dev/null || warning "BS1770GAIN não disponível via brew — a instalar manualmente"
    # Fallback: compilar da fonte
    if ! command -v bs1770gain &> /dev/null; then
      brew install automake libtool libsndfile
      git clone https://github.com/petterreinholdtsen/bs1770gain.git /tmp/bs1770gain
      cd /tmp/bs1770gain && autoreconf -i && ./configure && make && sudo make install
      cd -
    fi
    success "BS1770GAIN instalado"
  else
    success "BS1770GAIN já instalado"
  fi

  # Docker Desktop
  if ! command -v docker &> /dev/null; then
    info "A instalar Docker Desktop..."
    brew install --cask docker
    warning "Abre o Docker Desktop e aguarda o ícone verde antes de continuar!"
    open /Applications/Docker.app
    
    # Aguardar Docker iniciar
    info "A aguardar Docker iniciar (30 segundos)..."
    sleep 30
    
    # Verificar
    until docker info &> /dev/null; do
      warning "Docker ainda não está pronto. A aguardar..."
      sleep 5
    done
    success "Docker instalado e a correr"
  else
    success "Docker já instalado"
  fi

# ── Linux ──
elif [ "$OS" = "Linux" ]; then
  info "A configurar para Linux..."

  # Detectar distribuição
  if command -v apt-get &> /dev/null; then
    DISTRO="debian"
    PKG_INSTALL="sudo apt-get install -y"
    sudo apt-get update
  elif command -v dnf &> /dev/null; then
    DISTRO="fedora"
    PKG_INSTALL="sudo dnf install -y"
  elif command -v pacman &> /dev/null; then
    DISTRO="arch"
    PKG_INSTALL="sudo pacman -S --noconfirm"
  else
    error "Distribuição Linux não suportada. Instala as ferramentas manualmente."
  fi

  info "Distribuição: $DISTRO"

  # Node.js 20
  if ! command -v node &> /dev/null; then
    info "A instalar Node.js 20..."
    if [ "$DISTRO" = "debian" ]; then
      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
      sudo apt-get install -y nodejs
    elif [ "$DISTRO" = "fedora" ]; then
      sudo dnf install -y nodejs npm
    elif [ "$DISTRO" = "arch" ]; then
      sudo pacman -S --noconfirm nodejs npm
    fi
    success "Node.js instalado: $(node --version)"
  else
    success "Node.js já instalado: $(node --version)"
  fi

  # Restantes ferramentas
  if [ "$DISTRO" = "debian" ]; then
    sudo apt-get install -y git ffmpeg handbrake-cli mediainfo mediaconch bs1770gain
  elif [ "$DISTRO" = "fedora" ]; then
    sudo dnf install -y git ffmpeg HandBrakeCLI mediainfo bs1770gain
  elif [ "$DISTRO" = "arch" ]; then
    sudo pacman -S --noconfirm git ffmpeg handbrake mediainfo bs1770gain
  fi

  # Docker
  if ! command -v docker &> /dev/null; then
    info "A instalar Docker..."
    curl -fsSL https://get.docker.com | sudo bash
    sudo usermod -aG docker "$USER"
    sudo systemctl enable docker
    sudo systemctl start docker
    warning "IMPORTANTE: Reinicia o terminal para o grupo docker ter efeito!"
    success "Docker instalado"
  else
    success "Docker já instalado"
  fi

  # WebKit para Google Antigravity
  if [ "$DISTRO" = "debian" ]; then
    sudo apt-get install -y libwebkit2gtk-4.1-0 libgtk-3-0 2>/dev/null || true
  elif [ "$DISTRO" = "fedora" ]; then
    sudo dnf install -y webkit2gtk4.1 gtk3 2>/dev/null || true
  fi

else
  error "Sistema operativo não suportado: $OS"
fi

# ── Verificações finais ──
echo ""
echo "═══════════════════════════════════════"
echo "VERIFICAÇÃO FINAL"
echo "═══════════════════════════════════════"

check_tool() {
  local name=$1
  local cmd=$2
  if command -v "$cmd" &> /dev/null; then
    success "$name: OK ($(eval "$cmd --version 2>&1 | head -1"))"
  else
    warning "$name: NÃO encontrado (opcional ou requer reinício)"
  fi
}

check_tool "Node.js"    "node"
check_tool "npm"        "npm"
check_tool "Git"        "git"
check_tool "Docker"     "docker"
check_tool "FFmpeg"     "ffmpeg"
check_tool "FFprobe"    "ffprobe"
check_tool "MediaInfo"  "mediainfo"
check_tool "MediaConch" "mediaconch"
check_tool "BS1770GAIN" "bs1770gain"
check_tool "HandBrake"  "HandBrakeCLI"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  ✓ Nexora setup completo!           ║"
echo "║  Próximo passo: corre o scaffold    ║"
echo "║  node scripts/nexora-scaffold.js    ║"
echo "╚══════════════════════════════════════╝"
echo ""
```

### nexora-setup.ps1 (Windows)

Cria o ficheiro `scripts/nexora-setup.ps1`:

```powershell
# ═══════════════════════════════════════════════════════
# Nexora Media Processing — Script de Setup (Windows)
# ═══════════════════════════════════════════════════════
# Executar como Administrador:
#   Set-ExecutionPolicy Bypass -Scope Process -Force
#   .\scripts\nexora-setup.ps1
# ═══════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

function Write-Info    { Write-Host "[INFO]  $args" -ForegroundColor Cyan }
function Write-Success { Write-Host "[OK]    $args" -ForegroundColor Green }
function Write-Warning { Write-Host "[AVISO] $args" -ForegroundColor Yellow }
function Write-Error2  { Write-Host "[ERRO]  $args" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "║  Nexora Media Processing — Setup    ║" -ForegroundColor Blue
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Blue
Write-Host ""

# Verificar se é Administrador
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error2 "Este script precisa de ser executado como Administrador!"
}

# Instalar Chocolatey
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Info "A instalar o Chocolatey..."
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    Write-Success "Chocolatey instalado"
} else {
    Write-Success "Chocolatey já instalado"
}

# Refresh environment
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Ferramentas via Chocolatey
$tools = @(
    @{ name = "Node.js 20"; pkg = "nodejs-lts"; cmd = "node" },
    @{ name = "Git"; pkg = "git"; cmd = "git" },
    @{ name = "FFmpeg"; pkg = "ffmpeg"; cmd = "ffmpeg" },
    @{ name = "HandBrake"; pkg = "handbrake"; cmd = "HandBrakeCLI" },
    @{ name = "MediaInfo"; pkg = "mediainfo-cli"; cmd = "mediainfo" }
)

foreach ($tool in $tools) {
    if (-not (Get-Command $tool.cmd -ErrorAction SilentlyContinue)) {
        Write-Info "A instalar $($tool.name)..."
        choco install $tool.pkg -y
        Write-Success "$($tool.name) instalado"
    } else {
        Write-Success "$($tool.name) já instalado"
    }
}

# Docker Desktop
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Info "A instalar Docker Desktop..."
    choco install docker-desktop -y
    Write-Warning "Reinicia o computador após a instalação do Docker!"
    Write-Warning "Após reiniciar, executa: node scripts/nexora-scaffold.js"
}

# Verificação final
Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Blue
Write-Host "VERIFICAÇÃO FINAL" -ForegroundColor Blue
Write-Host "═══════════════════════════════════════" -ForegroundColor Blue

@("node", "git", "docker", "ffmpeg", "mediainfo") | ForEach-Object {
    if (Get-Command $_ -ErrorAction SilentlyContinue) {
        Write-Success "$_`: OK"
    } else {
        Write-Warning "$_`: não encontrado"
    }
}

Write-Host ""
Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✓ Setup completo! Próximo passo:   ║" -ForegroundColor Green
Write-Host "║  node scripts\nexora-scaffold.js    ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Green
```

---

## 7.2 — Script de Scaffold do Projecto (nexora-scaffold.js)

> **O que faz este script:** Lê este manual e cria automaticamente toda a estrutura de pastas e ficheiros base do projecto. Em vez de criar 50+ ficheiros manualmente, o script faz tudo em segundos.

**Como executar:**
```bash
node scripts/nexora-scaffold.js
```

Cria o ficheiro `scripts/nexora-scaffold.js`:

```javascript
#!/usr/bin/env node
// ═══════════════════════════════════════════════════════
// Nexora Media Processing — Script de Scaffold
// ═══════════════════════════════════════════════════════
// O que faz:
//   1. Cria toda a estrutura de pastas do projecto
//   2. Cria ficheiros base com conteúdo inicial
//   3. Cria .env.example com todas as variáveis
//   4. Cria docker-compose.yml base
//   5. Cria package.json com todos os scripts
//   6. Cria PROGRESS.md inicial
//   7. Cria .gitignore
//
// Como executar:
//   node scripts/nexora-scaffold.js
//
// Requisitos:
//   Node.js 20+ instalado
// ═══════════════════════════════════════════════════════

const fs   = require('fs');
const path = require('path');

// Cores para output
const c = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  blue:   '\x1b[34m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
};

const log  = (msg) => console.log(`${c.blue}[INFO]${c.reset}  ${msg}`);
const ok   = (msg) => console.log(`${c.green}[OK]${c.reset}    ${msg}`);
const warn = (msg) => console.log(`${c.yellow}[AVISO]${c.reset} ${msg}`);
const err  = (msg) => { console.log(`${c.red}[ERRO]${c.reset}  ${msg}`); process.exit(1); };

// ── Raiz do projecto ──
const ROOT = process.cwd();

// ── Função para criar directoria ──
function mkdir(relPath) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    ok(`Directoria criada: ${relPath}`);
  } else {
    warn(`Directoria já existe: ${relPath}`);
  }
}

// ── Função para criar ficheiro ──
function write(relPath, content) {
  const fullPath = path.join(ROOT, relPath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, content, 'utf8');
    ok(`Ficheiro criado: ${relPath}`);
  } else {
    warn(`Ficheiro já existe (não sobrescrito): ${relPath}`);
  }
}

console.log('');
console.log('╔══════════════════════════════════════╗');
console.log('║  Nexora Media Processing — Scaffold ║');
console.log('╚══════════════════════════════════════╝');
console.log('');

// ═══════════════════════════════════════
// 1. ESTRUTURA DE PASTAS
// ═══════════════════════════════════════
log('A criar estrutura de pastas...');

const dirs = [
  'src/api/routes',
  'src/api/middleware',
  'src/workers',
  'src/pipeline/ffmpeg',
  'src/qc/rules',
  'src/models',
  'src/events',
  'src/observability',
  'src/db',
  'prisma/migrations',
  'frontend/src/app/(dashboard)',
  'frontend/src/app/api',
  'frontend/src/components',
  'frontend/src/hooks',
  'frontend/src/store',
  'tests/unit',
  'tests/integration',
  'tests/e2e',
  'tests/fixtures',
  'tests/performance',
  'config/grafana/dashboards',
  'config/prometheus',
  'config/alertmanager',
  'docs/adr',
  'scripts',
  '.github/workflows',
  'logs',
  'media/input',
  'media/output',
  'media/temp',
];

dirs.forEach(mkdir);

// ═══════════════════════════════════════
// 2. FICHEIROS BASE
// ═══════════════════════════════════════
log('A criar ficheiros base...');

// package.json
write('package.json', JSON.stringify({
  name: "nexora-media-processing",
  version: "0.1.0",
  description: "Plataforma profissional de processamento de media broadcast & OTT",
  main: "dist/index.js",
  scripts: {
    "dev": "tsx watch src/index.ts",
    "build": "tsc --noEmit && tsc -p tsconfig.build.json",
    "start": "node dist/index.js",
    "worker": "tsx src/worker.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "format": "prettier --write src/**/*.ts",
    "db:migrate": "prisma migrate deploy",
    "db:migrate:dev": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio",
    "db:generate": "prisma generate",
    "queue:flush": "tsx scripts/flush-queues.ts",
    "fixtures:generate": "bash tests/fixtures/generate-fixtures.sh",
    "setup": "bash scripts/nexora-setup.sh"
  },
  dependencies: {
    "@temporalio/client": "^1.9.0",
    "@temporalio/worker": "^1.9.0",
    "@temporalio/workflow": "^1.9.0",
    "@temporalio/activity": "^1.9.0",
    "fastify": "^4.26.0",
    "@fastify/cors": "^9.0.0",
    "@fastify/jwt": "^8.0.0",
    "@fastify/multipart": "^8.3.0",
    "@fastify/rate-limit": "^9.1.0",
    "@fastify/swagger": "^8.14.0",
    "bullmq": "^5.7.0",
    "ioredis": "^5.3.0",
    "@prisma/client": "^5.11.0",
    "minio": "^8.0.0",
    "pino": "^9.1.0",
    "prom-client": "^15.1.0",
    "zod": "^3.22.0",
    "uuid": "^9.0.0",
    "jose": "^5.2.0"
  },
  devDependencies: {
    "typescript": "^5.4.0",
    "tsx": "^4.7.0",
    "@types/node": "^20.11.0",
    "vitest": "^1.4.0",
    "@vitest/coverage-v8": "^1.4.0",
    "prisma": "^5.11.0",
    "eslint": "^8.57.0",
    "@typescript-eslint/parser": "^7.4.0",
    "@typescript-eslint/eslint-plugin": "^7.4.0",
    "prettier": "^3.2.0"
  }
}, null, 2));

// tsconfig.json
write('tsconfig.json', JSON.stringify({
  compilerOptions: {
    target: "ES2022",
    module: "commonjs",
    lib: ["ES2022"],
    outDir: "./dist",
    rootDir: "./src",
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    resolveJsonModule: true,
    declaration: true,
    declarationMap: true,
    sourceMap: true
  },
  include: ["src/**/*"],
  exclude: ["node_modules", "dist", "tests"]
}, null, 2));

// .gitignore
write('.gitignore', `
# Dependencies
node_modules/
.pnp
.pnp.js

# Build
dist/
build/
.next/

# Environment
.env
.env.local
.env.*.local
!.env.example

# Logs
logs/*.log
*.log
npm-debug.log*

# Media (ficheiros de media não devem ir para Git)
media/input/*
media/output/*
media/temp/*
!media/input/.gitkeep
!media/output/.gitkeep
!media/temp/.gitkeep

# Database
*.db
*.db-shm
*.db-wal

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/settings.json
.idea/
*.swp
*.swo

# Tests
coverage/
.nyc_output/

# Docker
.docker/

# Prisma
prisma/*.db
`);

// .env.example
write('.env.example', `
# ═══════════════════════════════════════════════════════
# Nexora Media Processing — Variáveis de Ambiente
# ═══════════════════════════════════════════════════════
# INSTRUÇÕES:
#   1. Copia este ficheiro para .env: cp .env.example .env
#   2. Substitui os valores com as tuas configurações
#   3. NUNCA faças commit do ficheiro .env (está no .gitignore)
# ═══════════════════════════════════════════════════════

# ── Base de dados ────────────────────────────────────
DATABASE_URL=postgresql://nexora:nexora_password@localhost:5432/nexora_media
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# ── Redis / Queue ────────────────────────────────────
REDIS_URL=redis://localhost:6379
BULLMQ_PREFIX=nexora
QUEUE_DEFAULT_ATTEMPTS=3
QUEUE_BACKOFF_DELAY_MS=1000

# ── MinIO / Storage ──────────────────────────────────
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=nexoraadmin
MINIO_SECRET_KEY=nexora_minio_secret
MINIO_BUCKET_INPUT=nexora-input
MINIO_BUCKET_OUTPUT=nexora-output
MINIO_BUCKET_TEMP=nexora-temp

# ── Temporal.io ──────────────────────────────────────
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=nexora-production
TEMPORAL_TASK_QUEUE=nexora-media-tasks

# ── Auth ─────────────────────────────────────────────
JWT_PRIVATE_KEY_PATH=./secrets/jwt_private.pem
JWT_PUBLIC_KEY_PATH=./secrets/jwt_public.pem
JWT_ALGORITHM=RS256
JWT_ACCESS_TOKEN_EXPIRY=1h
JWT_API_TOKEN_EXPIRY=24h

# ── Media processing ─────────────────────────────────
NEXORA_INPUT_DIR=./media/input
NEXORA_OUTPUT_DIR=./media/output
NEXORA_TEMP_DIR=./media/temp
FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe
MEDIAINFO_PATH=mediainfo
MEDIACONCH_PATH=mediaconch
BS1770GAIN_PATH=bs1770gain
HANDBRAKE_CLI_PATH=HandBrakeCLI

# ── Limites de jobs ──────────────────────────────────
MAX_CONCURRENT_TRANSCODE_JOBS=4
MAX_CONCURRENT_AUDIO_JOBS=8
FFMPEG_DEFAULT_TIMEOUT_MS=14400000
MAX_UPLOAD_SIZE_BYTES=53687091200

# ── Loudness targets ─────────────────────────────────
LOUDNESS_TARGET_BROADCAST_LUFS=-23
LOUDNESS_TARGET_STREAMING_LUFS=-14
LOUDNESS_TRUE_PEAK_LIMIT_DBTP=-1.0
LOUDNESS_TOLERANCE_LU=0.5

# ── VMAF thresholds ──────────────────────────────────
VMAF_THRESHOLD_ARCHIVE=93
VMAF_THRESHOLD_BROADCAST=90
VMAF_THRESHOLD_STREAMING=85
VMAF_THRESHOLD_PROXY=70

# ── Observabilidade ──────────────────────────────────
LOG_LEVEL=info
PROMETHEUS_PORT=9100

# ── API ──────────────────────────────────────────────
PORT=3000
NODE_ENV=development
API_VERSION=v1
RATE_LIMIT_USER_RPM=1000
RATE_LIMIT_API_RPM=5000
`);

// docker-compose.yml
write('docker-compose.yml', `version: "3.9"

services:
  nexora-api:
    build: .
    image: nexora/api:latest
    ports: ["3000:3000"]
    env_file: .env
    environment:
      DATABASE_URL: postgresql://nexora:\${DB_PASSWORD:-nexora_password}@postgres:5432/nexora_media
      REDIS_URL: redis://redis:6379
      MINIO_ENDPOINT: minio
      TEMPORAL_ADDRESS: temporal:7233
    depends_on: [postgres, redis, minio, temporal]
    restart: unless-stopped
    volumes:
      - nexora_input:/media/input
      - nexora_output:/media/output
      - nexora_temp:/media/temp

  nexora-worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    image: nexora/worker:latest
    env_file: .env
    environment:
      DATABASE_URL: postgresql://nexora:\${DB_PASSWORD:-nexora_password}@postgres:5432/nexora_media
      REDIS_URL: redis://redis:6379
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
      DB: postgresql
      POSTGRES_USER: nexora
      POSTGRES_PWD: \${DB_PASSWORD:-nexora_password}
      POSTGRES_SEEDS: postgres
    depends_on: [postgres]

  temporal-ui:
    image: temporalio/ui:2.26
    ports: ["8080:8080"]
    environment:
      TEMPORAL_ADDRESS: temporal:7233

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: nexora
      POSTGRES_PASSWORD: \${DB_PASSWORD:-nexora_password}
      POSTGRES_DB: nexora_media
    volumes: [postgres_data:/var/lib/postgresql/data]
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    command: redis-server --save 60 1 --loglevel warning
    volumes: [redis_data:/data]
    ports: ["6379:6379"]

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    ports: ["9000:9000", "9001:9001"]
    environment:
      MINIO_ROOT_USER: nexoraadmin
      MINIO_ROOT_PASSWORD: \${MINIO_PASSWORD:-nexora_minio_secret}
    volumes: [minio_data:/data]

  prometheus:
    image: prom/prometheus:latest
    ports: ["9090:9090"]
    volumes:
      - ./config/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus

  grafana:
    image: grafana/grafana:latest
    ports: ["3001:3000"]
    environment:
      GF_SECURITY_ADMIN_PASSWORD: \${GRAFANA_PASSWORD:-nexora}
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
`);

// PROGRESS.md
write('PROGRESS.md', `# Nexora Media Processing — Estado do Projecto

> **REGRA OBRIGATÓRIA:** Este ficheiro DEVE ser lido por todos os agentes IA antes
> de qualquer trabalho, e actualizado após cada sessão de desenvolvimento.

---

## 📋 Resumo

**Nome:** Nexora Media Processing  
**Versão:** 0.1.0  
**Stack:** Node.js 20 + TypeScript + Fastify + BullMQ + PostgreSQL + Redis + MinIO  
**IDE:** Google Antigravity  

---

## ✅ O que está feito

- [x] Estrutura de pastas criada (scaffold)
- [x] package.json + tsconfig.json
- [x] .env.example
- [x] docker-compose.yml base
- [x] .gitignore
- [x] PROGRESS.md
- [ ] Schema Prisma + migrações
- [ ] FFmpeg executor isolado
- [ ] QC rules engine
- [ ] BullMQ queues
- [ ] API routes
- [ ] Temporal.io workflows
- [ ] Decision Engine
- [ ] Frontend Next.js 14
- [ ] Segurança completa
- [ ] Testes

---

## 🔄 Em progresso

_Scaffold criado. Pronto para Prompt 1._

---

## 📅 Histórico

| Data | Feito | Agente |
|------|-------|--------|
| $(date +%Y-%m-%d) | Scaffold criado | nexora-scaffold.js |

---

*Última actualização: $(date +%Y-%m-%d)*
`);

// Ficheiros placeholder para Git
['media/input', 'media/output', 'media/temp', 'logs'].forEach(dir => {
  write(`${dir}/.gitkeep`, '');
});

// Prisma schema base
write('prisma/schema.prisma', `
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Adicionar modelos via Prompt 1
`);

// src/index.ts base
write('src/index.ts', `
import Fastify from 'fastify';

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' }
});

app.get('/health', async () => ({ status: 'ok', version: '0.1.0' }));

const start = async () => {
  try {
    await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
    app.log.info('Nexora Media Processing iniciado');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
`);

// GitHub Actions base
write('.github/workflows/test.yml', `
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm install
      - run: npm run lint
      - run: npm test
      - run: npm run test:coverage
`);

// Script de geração de fixtures
write('tests/fixtures/generate-fixtures.sh', `#!/bin/bash
# Gera ficheiros de vídeo para testes usando FFmpeg (sem copyright)

FIXTURES_DIR="$(dirname "$0")"

echo "A gerar fixtures de teste..."

# Referência perfeita broadcast-safe
ffmpeg -y -f lavfi -i "testsrc2=duration=30:size=1920x1080:rate=25" \\
  -f lavfi -i "sine=frequency=1000:duration=30:sample_rate=48000" \\
  -c:v libx264 -profile:v high -level:v 4.1 -pix_fmt yuv420p \\
  -g 50 -keyint_min 50 -sc_threshold 0 -flags +cgop -bf 0 \\
  -b:v 8000k -maxrate 8000k -bufsize 16000k \\
  -c:a pcm_s24le -ar 48000 -movflags +faststart \\
  "$FIXTURES_DIR/nexora_reference_broadcast.mp4"

# Open GOP (deve forçar re-encode)
ffmpeg -y -f lavfi -i "testsrc2=duration=10:size=1920x1080:rate=25" \\
  -c:v libx264 -g 50 -x264-params "open-gop=1:bframes=3" \\
  "$FIXTURES_DIR/nexora_problem_open_gop.mp4"

# VFR (deve ser rejeitado)
ffmpeg -y -f lavfi -i "testsrc2=duration=10:size=1920x1080:rate=25" \\
  -c:v libx264 -vsync vfr \\
  "$FIXTURES_DIR/nexora_problem_vfr.mp4"

# Loudness incorrecta (-6 LUFS)
ffmpeg -y -f lavfi -i "testsrc2=duration=10:size=1920x1080:rate=25" \\
  -f lavfi -i "sine=frequency=440:duration=10" \\
  -af "volume=10dB" \\
  "$FIXTURES_DIR/nexora_problem_loud.mp4"

# Ficheiro corrompido
head -c 1000000 "$FIXTURES_DIR/nexora_reference_broadcast.mp4" \\
  > "$FIXTURES_DIR/nexora_problem_corrupt.mp4"

echo "✓ Fixtures geradas em $FIXTURES_DIR/"
`);

// Prometheus config
write('config/prometheus/prometheus.yml', `
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'nexora-api'
    static_configs:
      - targets: ['nexora-api:9100']
    metrics_path: '/metrics'

  - job_name: 'nexora-worker'
    static_configs:
      - targets: ['nexora-worker:9101']
`);

// ═══════════════════════════════════════
// SUMÁRIO FINAL
// ═══════════════════════════════════════
console.log('');
console.log('╔══════════════════════════════════════╗');
console.log('║  ✓ Scaffold completo!               ║');
console.log('╚══════════════════════════════════════╝');
console.log('');
console.log('Próximos passos:');
console.log('  1. cp .env.example .env');
console.log('  2. Edita o .env com as tuas configurações');
console.log('  3. npm install');
console.log('  4. docker compose up -d');
console.log('  5. npm run db:migrate');
console.log('  6. Abre o Antigravity e executa o Prompt 1 (Claude)');
console.log('');
```

---

---

# ═══════════════════════════════════════════
# PARTE 8 — GUIA PASSO A PASSO DE EXECUÇÃO
# ═══════════════════════════════════════════

> **Esta é a secção mais importante para um iniciante.** Segue estes passos exactamente pela ordem indicada.

---

## 8.1 — Da Instalação ao Primeiro Asset Processado

### ✦ DIA 1 — Setup e Estrutura

**Passo 1 — Instalar as ferramentas**
```bash
# macOS/Linux — no Terminal:
bash scripts/nexora-setup.sh

# Windows — no PowerShell como Administrador:
.\scripts\nexora-setup.ps1
```
Tempo: 10-20 minutos. Aguarda até ver `✓ Nexora setup completo!`

**Passo 2 — Criar o repositório no GitHub**
- Vai a github.com → New repository → `nexora-media-processing` → Create
- Segue o passo 2.4 deste manual para clonar

**Passo 3 — Correr o scaffold**
```bash
cd nexora-media-processing
node scripts/nexora-scaffold.js
```
Verás uma lista de ficheiros criados. Deve terminar com `✓ Scaffold completo!`

**Passo 4 — Configurar as variáveis**
```bash
cp .env.example .env
```
Abre o ficheiro `.env` no Antigravity e ajusta os valores (especialmente passwords).

**Passo 5 — Instalar dependências Node.js**
```bash
npm install
```

**Passo 6 — Iniciar os serviços**
```bash
docker compose up -d
```
Aguarda ~30 segundos. Verifica:
```bash
docker compose ps
```
Todos os serviços devem mostrar `Up`.

**Passo 7 — Criar as tabelas da base de dados**
```bash
npm run db:migrate
```

> ✅ **Verificação do Dia 1:**
> ```bash
> curl http://localhost:3000/health
> # Deve retornar: {"status":"ok","version":"0.1.0"}
> ```

---

### ✦ SEMANA 1 — Backend e Workers

**Passo 8 — Executar o Prompt 1 (Claude) no Antigravity**

1. Abre o Google Antigravity
2. Abre a pasta `nexora-media-processing` (File → Open Folder)
3. Prime `Cmd+Shift+I` (mac) ou `Ctrl+Shift+I` (win/linux)
4. Selecciona "Claude" como agente
5. Copia o **PROMPT 1** da PARTE 6 deste manual
6. Cola no chat e prime Enter
7. **Aguarda** — o Claude vai criar dezenas de ficheiros automaticamente
8. Quando terminar, verifica o PROGRESS.md (deve estar actualizado)

**Passo 9 — Executar o Prompt 5 (Claude) no Antigravity**
- Segue o mesmo processo com o **PROMPT 5**
- Cria: FFmpeg commands, GPU detection, two-pass R128, VMAF

**Passo 10 — Gerar fixtures de teste**
```bash
npm run fixtures:generate
```

**Passo 11 — Correr os testes**
```bash
npm test
```

> ✅ **Verificação da Semana 1:** Os testes das QC rules devem passar (green).

---

### ✦ SEMANA 2 — API e Orquestração

**Passo 12 — Executar o Prompt 2 (Claude) no Antigravity**
- Cria: Temporal.io workflows, Decision Engine, REST API completa

**Passo 13 — Executar o Prompt 6 (Claude) no Antigravity**
- Cria: Docker Compose completo, GitHub Actions, Grafana dashboards

**Passo 14 — Reiniciar os serviços com configuração completa**
```bash
docker compose down
docker compose up -d
```

> ✅ **Verificação da Semana 2:**
> - http://localhost:3000 → API responde
> - http://localhost:8080 → Temporal UI
> - http://localhost:3001 → Grafana (admin/nexora)
> - http://localhost:9001 → MinIO (nexoraadmin/nexora_minio_secret)

---

### ✦ SEMANA 3 — Frontend

**Passo 15 — Executar o Prompt 3 (Gemini) no Antigravity**
- Selecciona "Gemini" como agente
- Cria: toda a interface web Next.js 14

**Passo 16 — Iniciar o frontend**
```bash
cd frontend
npm install
npm run dev
```

> ✅ **Verificação da Semana 3:** http://localhost:3000 mostra a interface Nexora

---

### ✦ SEMANA 4 — Segurança e Testes

**Passo 17 — Executar Prompt 4 (Claude) — Log Analysis**
**Passo 18 — Executar Prompt 7 (Claude) — Segurança**
**Passo 19 — Executar Prompt 8 (Claude) — Testes**
**Passo 20 — Executar Prompt 9 (Claude) — Open Source adapters**
**Passo 21 — Executar Prompt 10 (Claude) — Integração final**

**Passo 22 — Verificação final completa**
```bash
npm run test:coverage    # deve ser ≥ 80%
npm run lint             # deve ser sem erros
docker compose ps        # todos os serviços Up
```

---

## 8.2 — Processar o Primeiro Ficheiro de Vídeo

Após toda a semana 1 estar concluída:

1. Abre http://localhost:3000
2. Clica em "Upload" ou arrasta um ficheiro de vídeo
3. Selecciona o perfil "Broadcast HD"
4. Clica "Processar"
5. Observa o progresso em tempo real
6. Quando mudar para "READY" → clica "Download"

---

---

# ═══════════════════════════════════════════
# PARTE 9 — FERRAMENTAS OPEN SOURCE
# ═══════════════════════════════════════════

## 9.1 — Tabela de Selecção por Tarefa

| Tarefa | Tool primário | Fallback | Notas |
|---|---|---|---|
| Broadcast transcode | **FFmpeg** | — | Único aceite para conformance AS-11 |
| OTT / CMAF / DRM | **FFmpeg** | — | Único com CMAF nativo |
| Proxy / Web encode | **HandBrakeCLI** | FFmpeg | HandBrake 2× mais rápido para proxies |
| Loudness measure | **BS1770GAIN** | FFmpeg ebur128 | NUNCA confiar só na medição FFmpeg |
| Container analysis | **MediaInfo** | FFprobe | Usar ambos — são complementares |
| Conformance check | **MediaConch** | — | Único com policy XML formal |
| VMAF scoring | **FFmpeg libvmaf** | — | — |
| Playback sanity | **VLC headless** | — | Opcional, apenas broadcast/OTT |
| Thumbnail sprites | **FFmpeg -vf tile** | — | — |

## 9.2 — HandBrake: Quando Usar e Quando Não

**✅ Usar HandBrake para:**
- Proxies LowRes (720p, 800kbps) — 2× mais rápido
- Outputs web para conteúdo de animação
- Batch encoding com presets standard

**❌ NUNCA usar HandBrake para:**
- Perfil `nexora_broadcast_hd` — FFmpeg obrigatório
- Perfil `nexora_ott_premium` — FFmpeg obrigatório
- Qualquer output para playout system broadcast

## 9.3 — Alternativas GUI para Uso Manual Complementar

**HandBrake GUI** (handbrake.fr) — verificar outputs manualmente  
**Shutter Encoder** (shutter-encoder.com) — pré-processamento manual  
**VLC** (videolan.org) — verificação de playback  
**Avidemux** (avidemux.org) — trimming lossless antes de ingest

---

---

# ═══════════════════════════════════════════
# PARTE 10 — CHEAT SHEETS
# ═══════════════════════════════════════════

## 10.1 — Comandos de Diagnóstico FFmpeg

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
ffmpeg -i input.mp4 -af "ebur128=peak=true" -f null - 2>&1 \
  | grep -E "Integrated|True peak"

# Verificar Fast Start
ffprobe -v trace input.mp4 2>&1 | grep -E "moov|mdat" | head -3
# moov ANTES de mdat = Fast Start OK
```

## 10.2 — Transcode Broadcast HD (CPU)

```bash
# GOP = fps × 2 (25fps=50, 29.97fps=60, 50fps=100)

ffmpeg -y -i "input.mp4" \
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

## 10.3 — EBU R128 Two-Pass

```bash
# Pass 1: Análise
ffmpeg -i "input.mp4" \
  -af "loudnorm=I=-23:TP=-1:LRA=11:print_format=json" \
  -f null - 2>&1 | grep -A 12 '"input_i"'

# Pass 2: Normalização (usar valores exactos do Pass 1)
ffmpeg -y -i "input.mp4" \
  -af "loudnorm=I=-23:TP=-1:LRA=11:\
measured_I=-18.34:measured_TP=-3.27:\
measured_LRA=7.45:measured_thresh=-28.57:\
offset=-0.04:linear=true" \
  -c:v copy "output_normalized.mp4"

# Verificação BS1770GAIN (independente do FFmpeg)
bs1770gain --ebu --integrated --truepeak --xml output_normalized.mp4
# Deve mostrar: Integrated ≈ -23 LUFS, True Peak ≤ -1.0 dBTP
```

## 10.4 — VMAF Scoring

```bash
ffmpeg \
  -i "mezzanine_referencia.mp4" \
  -i "nexora_output.mp4" \
  -lavfi "[0:v][1:v]libvmaf=\
log_fmt=json:log_path=/tmp/vmaf.json:\
n_subsample=5:model=version=vmaf_v0.6.1" \
  -f null -

# Thresholds: archive≥93 | broadcast≥90 | streaming≥85 | proxy≥70
```

## 10.5 — Regras QC Broadcast

| Parâmetro | Valor correcto | Valor problemático | Acção |
|---|---|---|---|
| Frame rate mode | CFR | VFR | TRANSCODE obrigatório |
| GOP type | Closed | Open | TRANSCODE obrigatório |
| Keyframe | IDR frames | I-frames simples | TRANSCODE obrigatório |
| sc_threshold | 0 | Qualquer outro | TRANSCODE obrigatório |
| B-frames | 0 (broadcast linear) | > 0 | TRANSCODE obrigatório |
| Pixel format | yuv420p | yuv422p, yuv444p | TRANSCODE obrigatório |
| GOP size | fps × 2 | Diferente | TRANSCODE obrigatório |
| Sample rate | 48000 Hz | 44100 Hz | NORMALIZAR |
| Loudness | -23 LUFS ±0.5 (broadcast) | Desvio > 1 LU | NORMALIZAR |
| True Peak | ≤ -1.0 dBTP | > -1.0 dBTP | NORMALIZAR |
| moov atom | Início do ficheiro | No final | REMUX |

---

---

# ═══════════════════════════════════════════
# PARTE 11 — APÊNDICES
# ═══════════════════════════════════════════

## 11.1 — Sizing Guide

| Configuração | CPU | RAM | Disco | GPU | Jobs em simultâneo |
|---|---|---|---|---|---|
| Desenvolvimento | 4 cores | 8 GB | 100 GB | Não necessária | 2 |
| Produção pequena | 8 cores | 32 GB | 1 TB SSD | RTX 3060 | 4–6 |
| Produção média | 16 cores | 64 GB | 2 TB NVMe | RTX 4070 | 8–12 |
| Produção grande | 32 cores | 128 GB | 4 TB NVMe | RTX 4090 | 16–24 |

## 11.2 — Tempos de Transcode (1 hora de conteúdo 1080p)

| Perfil | CPU 8 cores | GPU RTX 3060 | GPU RTX 4090 | Apple M2 |
|---|---|---|---|---|
| Broadcast HD | ~45 min | ~12 min | ~5 min | ~8 min |
| OTT Premium H.265 | ~90 min | ~20 min | ~8 min | ~15 min |
| Streaming Web | ~20 min | ~8 min | ~3 min | ~5 min |
| Proxy LowRes | ~8 min | ~3 min | ~1.5 min | ~2 min |

## 11.3 — Troubleshooting

**Artefactos no vídeo após transcode**
```bash
# Verificar GOP
ffprobe -show_frames input.mp4 | grep "key_frame=1" | head -5
# Se pict_type=I mas key_frame=0 → I-frame sem IDR
# Solução: confirmar -flags +cgop e -x264-params "open-gop=0"
```

**Áudio muito alto/baixo após normalização**
```
Causa: Pass 2 não usou os valores medidos exactos do Pass 1
Solução: confirmar que measured_I, measured_TP, measured_LRA, measured_thresh e offset
         foram copiados exactamente do JSON de análise do Pass 1
```

**Ficheiro não carrega no browser/player**
```bash
ffprobe -v trace input.mp4 2>&1 | grep -E "moov|mdat" | head -3
# Se mdat aparece antes de moov → sem Fast Start
# Solução: ffmpeg -i input.mp4 -c copy -movflags +faststart output.mp4
```

**VMAF muito baixo (< 70) com bitrate alto**
```
Causa: referência e encode têm resoluções ou pixel formats diferentes
Solução: verifica com ffprobe que ambos têm a mesma resolução e yuv420p
```

**Workers ficam parados**
```bash
docker compose ps        # verificar se redis está running
docker compose logs redis
npm run queue:flush      # ATENÇÃO: perde jobs pendentes
```

**Docker: "port already in use"**
```bash
# Ver o que está a usar a porta
lsof -i :5432  # ou a porta em questão
# Matar o processo ou mudar a porta no .env e docker-compose.yml
```

**macOS: app não abre**
```
Clicar direito → Abrir → Abrir mesmo assim
Ou: Definições do Sistema → Privacidade e Segurança → Abrir mesmo assim
```

**Linux: WebKitGTK em falta**
```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.1-0

# Fedora
sudo dnf install webkit2gtk4.1
```

## 11.4 — Glossário

| Termo | O que significa em linguagem simples |
|---|---|
| **GOP** | Grupo de imagens de vídeo que funcionam como uma unidade |
| **IDR frame** | Frame que reinicia o decoder completamente — necessário para switching |
| **CFR** | Vídeo com número constante de imagens por segundo |
| **VFR** | Vídeo com número variável — problemático em broadcast |
| **B-frame** | Tipo de frame que depende de imagens do passado E do futuro |
| **LUFS** | Unidade de medida de volume percebido pelo ouvido humano |
| **True Peak** | Pico máximo de áudio após conversão para analógico |
| **EBU R128** | Standard europeu de normalização de volume de áudio |
| **VMAF** | Métrica de qualidade de vídeo criada pela Netflix |
| **MXF** | Formato de ficheiro para broadcast profissional |
| **CMAF** | Formato de streaming unificado (HLS + DASH) |
| **DRM** | Protecção digital de conteúdo contra cópia não autorizada |
| **Widevine** | Sistema DRM da Google (Android, Chrome) |
| **FairPlay** | Sistema DRM da Apple (iPhone, Mac, Safari) |
| **AS-11** | Standard obrigatório para entrega a BBC, ITV, Channel 4 |
| **IMF** | Standard de masters para Netflix, Amazon, Disney+ |
| **Temporal.io** | Sistema de gestão de tarefas complexas com histórico |
| **BullMQ** | Fila de trabalhos para processamento assíncrono |
| **PostgreSQL** | Base de dados profissional |
| **Redis** | Base de dados de alta velocidade para filas e cache |
| **MinIO** | Sistema de armazenamento de ficheiros compatível com Amazon S3 |
| **Prometheus** | Sistema de colecção de métricas |
| **Grafana** | Dashboard para visualizar métricas |
| **yuv420p** | Formato de pixel obrigatório para compatibilidade máxima |
| **Fast Start** | MP4 optimizado para streaming (o índice fica no início) |
| **Mezzanine** | Ficheiro de alta qualidade usado como referência/master |
| **Proxy** | Versão de baixa resolução para edição e preview |
| **SHA-256** | Código único calculado a partir do conteúdo de um ficheiro |
| **ADR** | Architecture Decision Record — registo de decisões técnicas |
| **SCTE-35** | Standard para inserção de marcadores de anúncios |

---

---

# ═══════════════════════════════════════════
# PARTE 12 — CHECKLIST DE ACEITAÇÃO FINAL
# ═══════════════════════════════════════════

Usa esta checklist para verificar que tudo está a funcionar correctamente antes de usar o Nexora em produção.

## 12.1 — Infraestrutura

```
[ ] docker compose up -d corre sem erros
[ ] docker compose ps mostra todos os serviços como "Up"
[ ] GET http://localhost:3000/health/ready → {"status":"ok"}
[ ] GET http://localhost:3000/metrics → lista de métricas Prometheus
[ ] http://localhost:8080 → Temporal UI abre (mostra workflows)
[ ] http://localhost:3001 → Grafana abre (login: admin/nexora)
[ ] http://localhost:9001 → MinIO abre (login: nexoraadmin/nexora_minio_secret)
```

## 12.2 — Segurança

```
[ ] JWT RS256 funciona (gerar token, usar em request, expirar)
[ ] Path traversal rejeitado com 422
[ ] SSRF bloqueado para IPs privados (10.x, 192.168.x, etc.)
[ ] FFmpeg nunca chamado com exec() — sempre execFile()
[ ] Audit trail imutável (sem UPDATE/DELETE possíveis na DB)
[ ] SHA-256 calculado em todos os assets
[ ] Magic bytes validation bloqueia .exe, .zip, etc.
```

## 12.3 — Pipeline de Processamento

```
[ ] Ingest de ficheiro MP4 → status INGESTED em < 5 segundos
[ ] QC rejeita ficheiro corrompido → audit entry criado
[ ] Transcode nexora_broadcast_hd:
    [ ] FFprobe pós-encode: GOP = fps × 2
    [ ] FFprobe pós-encode: Closed GOP confirmado
    [ ] FFprobe pós-encode: 0 B-frames
    [ ] FFprobe pós-encode: yuv420p
    [ ] moov atom antes de mdat (Fast Start)
[ ] Áudio:
    [ ] BS1770GAIN confirma LUFS dentro de ±0.5 LU do target
    [ ] BS1770GAIN confirma True Peak ≤ -1.0 dBTP
[ ] VMAF score calculado e guardado na base de dados
[ ] Proxy LowRes gerado (720p, 800kbps)
[ ] Thumbnail sprite sheet + VTT gerado
```

## 12.4 — Qualidade de Código

```
[ ] npm run build → sem erros TypeScript
[ ] npm run lint → sem warnings ou erros ESLint
[ ] npm run test:coverage → cobertura ≥ 80% linhas
[ ] QC rules: 100% cobertura de branches (são safety-critical)
[ ] Zero secrets hardcoded no código
[ ] Zero ficheiros .env no Git (apenas .env.example)
```

## 12.5 — Frontend

```
[ ] Upload flow completo funcional (drag-drop → progress → asset detail)
[ ] Status updates em tempo real via SSE
[ ] Dashboard com métricas reais do Prometheus
[ ] QC report visível e exportável como PDF
[ ] WCAG 2.1 AA: axe-core sem violations críticas
```

## 12.6 — Git / GitHub

```
[ ] Repositório criado e sincronizado no GitHub
[ ] PROGRESS.md actualizado e completo
[ ] .env NÃO está no repositório (apenas .env.example)
[ ] GitHub Actions passa (verde) no repositório
[ ] Commits com mensagens descritivas em português
```

---

---

# ═══════════════════════════════════════════
# REFERÊNCIA RÁPIDA — INTERFACES WEB
# ═══════════════════════════════════════════

| Interface | URL | Login | Para que serve |
|---|---|---|---|
| **Nexora App** | http://localhost:3000 | JWT token | Plataforma principal |
| **Temporal UI** | http://localhost:8080 | — (sem auth) | Ver estado dos workflows |
| **Grafana** | http://localhost:3001 | admin / nexora | Dashboards e métricas |
| **MinIO Console** | http://localhost:9001 | nexoraadmin / nexora_minio_secret | Gestão de ficheiros |
| **Prometheus** | http://localhost:9090 | — (sem auth) | Métricas raw |

---

# ═══════════════════════════════════════════
# REFERÊNCIA RÁPIDA — COMANDOS ESSENCIAIS
# ═══════════════════════════════════════════

```bash
# ── Iniciar tudo ──────────────────────────────────────────
docker compose up -d           # iniciar todos os serviços
npm run dev                    # iniciar API em modo desenvolvimento
npm run worker                 # iniciar workers BullMQ

# ── Parar tudo ───────────────────────────────────────────
docker compose down            # parar serviços (preserva dados)
docker compose down -v         # parar E apagar todos os dados

# ── Base de dados ─────────────────────────────────────────
npm run db:migrate             # aplicar migrações
npm run db:seed                # colocar dados de teste
npm run db:studio              # abrir interface visual da DB

# ── Testes ───────────────────────────────────────────────
npm test                       # correr todos os testes
npm run test:coverage          # testes com relatório de cobertura
npm run fixtures:generate      # gerar ficheiros de vídeo de teste

# ── Git ───────────────────────────────────────────────────
git status                     # ver o que mudou
git add .                      # adicionar tudo
git commit -m "mensagem"       # guardar alterações
git push origin main           # enviar para GitHub

# ── Diagnóstico ──────────────────────────────────────────
docker compose logs -f         # ver logs em tempo real
docker compose ps              # estado dos containers
npm run queue:flush            # limpar fila de jobs
```

---

*Nexora Media Processing — Manual Técnico Completo v4.0*  
*Stack 100% Open Source · Broadcast & OTT Grade · Portugal*
