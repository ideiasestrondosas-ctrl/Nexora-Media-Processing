# ═══════════════════════════════════════════════════════════════
# Nexora Media Processing — Setup do Ambiente (Windows)
# Guardar em: C:\Dev\Nexora Media Processing\arquitetura\nexora-setup.ps1
#
# Como executar (PowerShell como Administrador):
#   Set-ExecutionPolicy Bypass -Scope Process -Force
#   cd "C:\Dev\Nexora Media Processing"
#   .\arquitetura\nexora-setup.ps1
# ═══════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

function Write-Info    { Write-Host "[INFO]  $args" -ForegroundColor Cyan }
function Write-Success { Write-Host "[OK]    $args" -ForegroundColor Green }
function Write-Warn    { Write-Host "[AVISO] $args" -ForegroundColor Yellow }
function Write-Fail    { Write-Host "[ERRO]  $args" -ForegroundColor Red }

Write-Host ""
Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "║  Nexora Media Processing — Setup    ║" -ForegroundColor Blue
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Blue
Write-Host ""

# ── Verificar se é Administrador ──────────────────────────────
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Fail "Este script deve ser executado como Administrador!"
    Write-Fail "Clica com o botão direito no PowerShell → 'Executar como administrador'"
    exit 1
}

# ── Instalar Chocolatey (gestor de pacotes Windows) ───────────
if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Info "A instalar Chocolatey..."
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Success "Chocolatey instalado"
} else {
    Write-Success "Chocolatey já instalado"
}

# ── Ferramentas a instalar ────────────────────────────────────
$tools = @(
    @{ name="Node.js 20"; pkg="nodejs-lts";    cmd="node";        ver="--version" },
    @{ name="Git";        pkg="git";            cmd="git";         ver="--version" },
    @{ name="FFmpeg";     pkg="ffmpeg";          cmd="ffmpeg";      ver="-version" },
    @{ name="HandBrake";  pkg="handbrake-cli";   cmd="HandBrakeCLI"; ver="--version" },
    @{ name="MediaInfo";  pkg="mediainfo-cli";   cmd="mediainfo";   ver="--version" }
)

foreach ($tool in $tools) {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    if (Get-Command $tool.cmd -ErrorAction SilentlyContinue) {
        Write-Success "$($tool.name) já instalado"
    } else {
        Write-Info "A instalar $($tool.name)..."
        choco install $tool.pkg -y --no-progress
        Write-Success "$($tool.name) instalado"
    }
}

# ── Docker Desktop ────────────────────────────────────────────
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Success "Docker já instalado"
} else {
    Write-Info "A instalar Docker Desktop..."
    choco install docker-desktop -y --no-progress
    Write-Warn "IMPORTANTE: Reinicia o computador após a instalação do Docker!"
    Write-Warn "Após reiniciar, continua com o passo 2."
}

# ── BS1770GAIN (instalar manualmente) ────────────────────────
Write-Warn "BS1770GAIN não está disponível via Chocolatey."
Write-Warn "Descarrega de: https://github.com/petterreinholdtsen/bs1770gain/releases"
Write-Warn "Extrai o .exe para C:\tools\bs1770gain\ e adiciona ao PATH manualmente."
Write-Warn "(Opcional para começar — o sistema usa FFmpeg como fallback)"

# ── Refresh do PATH ───────────────────────────────────────────
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# ── Verificação final ─────────────────────────────────────────
Write-Host ""
Write-Host "══════════════════════════════════════" -ForegroundColor Blue
Write-Host "VERIFICAÇÃO FINAL" -ForegroundColor Blue
Write-Host "══════════════════════════════════════" -ForegroundColor Blue

$checks = @(
    @{ cmd="node";      args="--version" },
    @{ cmd="git";       args="--version" },
    @{ cmd="docker";    args="--version" },
    @{ cmd="ffmpeg";    args="-version"  },  # ffmpeg usa -version (1 hífen)
    @{ cmd="mediainfo"; args="--version" }
)
foreach ($check in $checks) {
    if (Get-Command $check.cmd -ErrorAction SilentlyContinue) {
        # Redirecionar stderr para stdout para capturar output do ffmpeg
        $v = (& $check.cmd $check.args 2>&1 | Select-Object -First 1).ToString().Trim()
        Write-Success "$($check.cmd) : $v"
    } else {
        Write-Warn "$($check.cmd) : não encontrado (pode requerer reinício do PowerShell)"
    }
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✓ Setup concluído!                     ║" -ForegroundColor Green
Write-Host "║                                         ║" -ForegroundColor Green
Write-Host "║  Próximo passo:                         ║" -ForegroundColor Green
Write-Host "║  node arquitetura\nexora-scaffold.js    ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
