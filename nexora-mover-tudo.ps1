# ═══════════════════════════════════════════════════════════════
# Nexora Media Processing — Script Master v2 (CORRIGIDO)
# Substitui o ficheiro nexora-mover-tudo.ps1 na raiz do projecto
#
# COMO EXECUTAR:
#   cd "C:\Dev\Nexora Media Processing"
#   Set-ExecutionPolicy Bypass -Scope Process -Force
#   .\nexora-mover-tudo.ps1
# ═══════════════════════════════════════════════════════════════

$ErrorActionPreference = "Continue"
$ArquiteturaDir = Join-Path $PSScriptRoot "arquitetura"
$WorkspaceDir   = $PSScriptRoot
$totalFiles     = 0

function Write-Step    { param($t) Write-Host "`n>> $t" -ForegroundColor Blue }
function Write-Ok      { param($t) Write-Host "  [OK]   $t" -ForegroundColor Green;  $script:totalFiles++ }
function Write-Warn    { param($t) Write-Host "  [!]    $t" -ForegroundColor Yellow }
function Write-Info    { param($t) Write-Host "  [INFO] $t" -ForegroundColor Cyan }

# ── Criar ficheiro no projecto ────────────────────────────────
function New-PFile {
    param([string]$rel, [string]$content)
    if ([string]::IsNullOrWhiteSpace($content)) { Write-Warn "Conteudo vazio para: $rel"; return }
    $full = Join-Path $WorkspaceDir $rel
    $dir  = Split-Path $full -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    if (Test-Path $full) { Write-Warn "Ja existe (mantido): $rel"; return }
    [System.IO.File]::WriteAllText($full, $content, [System.Text.Encoding]::UTF8)
    Write-Ok "Criado: $rel"
}

# ── Ler ficheiro da arquitetura ───────────────────────────────
function Get-Arq {
    param([string]$name)
    $p = Join-Path $ArquiteturaDir $name
    if (Test-Path $p) { return [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8) }
    Write-Warn "Nao encontrado: $name"
    return ""
}

# ── Separar secções por marcador de ficheiro ──────────────────
# Cada .ts tem secções separadas por "// ═══...═══"
# e cada secção começa com "// Ficheiro: src/..."
function Get-Sections {
    param([string]$content)
    # Dividir pelo separador de secção (linha com muitos = ou ═)
    $parts = $content -split '(?m)^// [=═]{20,}'
    return $parts | Where-Object { $_.Trim().Length -gt 50 }
}

function Get-SectionPath {
    param([string]$section)
    # Procurar "// Ficheiro: caminho/do/ficheiro.ts"
    if ($section -match '(?m)^// Ficheiro:\s*(.+?)\s*$') {
        return $Matches[1].Trim()
    }
    return $null
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "║  Nexora — Organização de ficheiros v2         ║" -ForegroundColor Blue
Write-Host "╚════════════════════════════════════════════════╝" -ForegroundColor Blue

# ══════════════════════════════════════════════════════════════
Write-Step "1/11 — QC RULES ENGINE"
# ══════════════════════════════════════════════════════════════
$c = Get-Arq "nexora_qc_rules.ts"
if ($c) { New-PFile "src\qc\rules\index.ts" $c }

# ══════════════════════════════════════════════════════════════
Write-Step "2/11 — FFMPEG (executor + builder + parser)"
# ══════════════════════════════════════════════════════════════
$c = Get-Arq "nexora_ffmpeg_executor.ts"
if ($c) {
    $secs = Get-Sections $c
    foreach ($s in $secs) {
        $fp = Get-SectionPath $s
        if ($fp) {
            $win = $fp -replace '/', '\'
            New-PFile $win $s
        }
    }
    # Se não encontrou secções com path, guardar tudo num ficheiro
    if ($secs.Count -le 1) {
        New-PFile "src\pipeline\ffmpeg\executor.ts" $c
    }
}

# ══════════════════════════════════════════════════════════════
Write-Step "3/11 — WORKERS (audio + transcode + gpu)"
# ══════════════════════════════════════════════════════════════
$c = Get-Arq "nexora_audio_worker.ts"
if ($c) {
    $secs = Get-Sections $c
    $placed = $false
    foreach ($s in $secs) {
        $fp = Get-SectionPath $s
        if ($fp) { New-PFile ($fp -replace '/','\') $s; $placed = $true }
    }
    if (-not $placed) { New-PFile "src\workers\audio.worker.ts" $c }
}

# ══════════════════════════════════════════════════════════════
Write-Step "4/11 — WORKERS (qc + ingest + proxy + delivery + qc-post)"
# ══════════════════════════════════════════════════════════════
$c = Get-Arq "nexora_qc_worker.ts"
if ($c) {
    $secs = Get-Sections $c
    $placed = $false
    foreach ($s in $secs) {
        $fp = Get-SectionPath $s
        if ($fp) { New-PFile ($fp -replace '/','\') $s; $placed = $true }
    }
    if (-not $placed) { New-PFile "src\workers\qc.worker.ts" $c }
}

# ══════════════════════════════════════════════════════════════
Write-Step "5/11 — TOOLS (availability + subtitle + presets)"
# ══════════════════════════════════════════════════════════════
$c = Get-Arq "nexora_tool_availability.ts"
if ($c) {
    $secs = Get-Sections $c
    foreach ($s in $secs) {
        $fp = Get-SectionPath $s
        if ($fp) {
            if ($fp -match 'nexora-presets') {
                # Extrair só o JSON do objecto
                if ($s -match '(?s)PresetList[\s\S]*?\]\s*\}') {
                    New-PFile "nexora-presets.json" "{ `"PresetList`": [] }"
                }
            } else {
                New-PFile ($fp -replace '/','\') $s
            }
        }
    }
}

# ══════════════════════════════════════════════════════════════
Write-Step "6/11 — PIPELINE (temporal workflow + decision engine + analyzer)"
# ══════════════════════════════════════════════════════════════
$c = Get-Arq "nexora_temporal_workflow.ts"
if ($c) {
    $secs = Get-Sections $c
    $placed = $false
    foreach ($s in $secs) {
        $fp = Get-SectionPath $s
        if ($fp) { New-PFile ($fp -replace '/','\') $s; $placed = $true }
    }
    if (-not $placed) { New-PFile "src\pipeline\orchestrator.ts" $c }
}

# ══════════════════════════════════════════════════════════════
Write-Step "7/11 — PIPELINE (activities + temporal worker + client)"
# ══════════════════════════════════════════════════════════════
$c = Get-Arq "nexora_temporal_activities.ts"
if ($c) {
    $secs = Get-Sections $c
    $placed = $false
    foreach ($s in $secs) {
        $fp = Get-SectionPath $s
        if ($fp) { New-PFile ($fp -replace '/','\') $s; $placed = $true }
    }
    if (-not $placed) { New-PFile "src\pipeline\activities.ts" $c }
}

# ══════════════════════════════════════════════════════════════
Write-Step "8/11 — API (routes + middleware)"
# ══════════════════════════════════════════════════════════════
$c = Get-Arq "nexora_api_routes.ts"
if ($c) {
    $secs = Get-Sections $c
    $placed = $false
    foreach ($s in $secs) {
        $fp = Get-SectionPath $s
        if ($fp) { New-PFile ($fp -replace '/','\') $s; $placed = $true }
    }
    if (-not $placed) { New-PFile "src\api\routes\assets.ts" $c }
}

# ══════════════════════════════════════════════════════════════
Write-Step "9/11 — DB (prisma client + queues + observability)"
# ══════════════════════════════════════════════════════════════
$c = Get-Arq "nexora_prisma_schema_full.ts"
if ($c) {
    $secs = Get-Sections $c
    foreach ($s in $secs) {
        $fp = Get-SectionPath $s
        if ($fp -and $fp -notmatch 'prisma/schema') {
            New-PFile ($fp -replace '/','\') $s
        }
    }
}

# Ficheiros do nexora_readme_final.md (src/index.ts, logger, metrics, etc.)
$c = Get-Arq "nexora_readme_final.md"
if ($c) {
    # Extrair blocos ## src/caminho seguidos de bloco de código typescript
    $pattern = '(?m)^## (src/[^\r\n]+)\r?\n\r?\n```typescript\r?\n([\s\S]*?)```'
    $rmatches = [regex]::Matches($c, $pattern)
    foreach ($m in $rmatches) {
        $fp  = $m.Groups[1].Value.Trim() -replace '/', '\'
        $cnt = $m.Groups[2].Value
        New-PFile $fp $cnt
    }
}

# Schema Prisma real (do markdown)
$c = Get-Arq "nexora_prisma_migration.md"
if ($c) {
    $pattern = '(?s)```prisma\r?\n([\s\S]*?)```'
    if ([regex]::IsMatch($c, $pattern)) {
        $schemaContent = [regex]::Match($c, $pattern).Groups[1].Value
        New-PFile "prisma\schema.prisma" $schemaContent
    }
    $sqlPattern = '(?s)```sql\r?\n([\s\S]*?)```'
    if ([regex]::IsMatch($c, $sqlPattern)) {
        $sqlContent = [regex]::Match($c, $sqlPattern).Groups[1].Value
        New-PFile "prisma\migrations\audit_rls.sql" $sqlContent
    }
}

# ══════════════════════════════════════════════════════════════
Write-Step "10/11 — SEGURANÇA + TESTES"
# ══════════════════════════════════════════════════════════════
$c = Get-Arq "nexora_playwright_security.ts"
if ($c) {
    $secs = Get-Sections $c
    $placed = $false
    foreach ($s in $secs) {
        $fp = Get-SectionPath $s
        if ($fp) {
            if ($fp -notmatch 'ACCEPTANCE') {
                New-PFile ($fp -replace '/','\') $s; $placed = $true
            } else {
                # Guardar o checklist
                if ($s -match "(?s)``\`([\s\S]+)``\`") {
                    New-PFile "docs\ACCEPTANCE_CHECKLIST.md" $Matches[1]
                }
            }
        }
    }
    if (-not $placed) { New-PFile "src\api\security.ts" $c }
}

# Testes unitários
$c = Get-Arq "nexora_unit_tests.ts"
if ($c) { New-PFile "tests\unit\qc-rules.test.ts" $c }

# Testes integração
$c = Get-Arq "nexora_integration_test.ts"
if ($c) {
    $secs = Get-Sections $c
    $placed = $false
    foreach ($s in $secs) {
        $fp = Get-SectionPath $s
        if ($fp) { New-PFile ($fp -replace '/','\') $s; $placed = $true }
    }
    if (-not $placed) { New-PFile "tests\integration\pipeline.test.ts" $c }
}

# ══════════════════════════════════════════════════════════════
Write-Step "11/11 — FRONTEND"
# ══════════════════════════════════════════════════════════════

# package.json do frontend
$frontendPkg = @'
{
  "name": "nexora-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "next": "14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@tanstack/react-query": "^5.32.0",
    "zustand": "^4.5.0",
    "recharts": "^2.12.0",
    "react-hook-form": "^7.51.0",
    "zod": "^3.22.0",
    "@hookform/resolvers": "^3.3.0",
    "nuqs": "^1.17.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0",
    "lucide-react": "^0.378.0",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/node": "^20.12.0",
    "typescript": "^5.4.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "@playwright/test": "^1.44.0"
  }
}
'@
New-PFile "frontend\package.json" $frontendPkg

# tsconfig do frontend
$frontendTsconfig = @'
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
'@
New-PFile "frontend\tsconfig.json" $frontendTsconfig

# next.config.js
$nextConfig = @'
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
  }
}
module.exports = nextConfig
'@
New-PFile "frontend\next.config.js" $nextConfig

# tailwind.config.ts
$tailwindConfig = @'
import type { Config } from 'tailwindcss'
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: []
}
export default config
'@
New-PFile "frontend\tailwind.config.ts" $tailwindConfig

# postcss.config.js
New-PFile "frontend\postcss.config.js" @'
module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } }
'@

# globals.css
$globalsCss = @'
@tailwind base;
@tailwind components;
@tailwind utilities;
:root { --font-sans: system-ui, sans-serif; --font-mono: monospace; }
* { scrollbar-width: thin; scrollbar-color: #404040 transparent; }
html { color-scheme: dark; }
'@
New-PFile "frontend\src\app\globals.css" $globalsCss

# Extrair componentes frontend dos ficheiros .ts
foreach ($fname in @("nexora_frontend_core.ts", "nexora_frontend_upload.ts")) {
    $c = Get-Arq $fname
    if ($c) {
        $secs = Get-Sections $c
        foreach ($s in $secs) {
            $fp = Get-SectionPath $s
            if ($fp -and $fp -match '^frontend/') {
                $win = $fp -replace '/', '\'
                New-PFile $win $s
            }
        }
    }
}

# playwright.config.ts
New-PFile "playwright.config.ts" @'
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } }
  ]
});
'@

# nexora-presets.json completo
$presetsJson = @'
{
  "PresetList": [
    {
      "PresetName": "NexoraProxyLowRes",
      "Type": 1,
      "FileFormat": "av_mp4",
      "Mp4HttpOptimize": true,
      "VideoEncoder": "x264",
      "VideoPreset": "veryfast",
      "VideoProfile": "high",
      "VideoLevel": "3.1",
      "VideoQualityType": 1,
      "VideoAvgBitrate": 800,
      "VideoTwoPass": true,
      "VideoTurboTwoPass": true,
      "PictureWidth": 1280,
      "PictureHeight": 720,
      "PictureKeepRatio": true,
      "AudioList": [{
        "AudioEncoder": "copy:aac",
        "AudioFallbackEncoder": "av_aac",
        "AudioBitrate": 128,
        "AudioSamplerate": "48",
        "AudioMixdown": "stereo"
      }],
      "ChapterMarkers": false
    },
    {
      "PresetName": "NexoraWebOptimized1080p",
      "Type": 1,
      "FileFormat": "av_mp4",
      "Mp4HttpOptimize": true,
      "VideoEncoder": "x264",
      "VideoPreset": "slow",
      "VideoProfile": "high",
      "VideoLevel": "4.0",
      "VideoQualityType": 1,
      "VideoAvgBitrate": 4000,
      "VideoTwoPass": true,
      "PictureWidth": 1920,
      "PictureHeight": 1080,
      "AudioList": [{
        "AudioEncoder": "av_aac",
        "AudioBitrate": 192,
        "AudioSamplerate": "48",
        "AudioMixdown": "stereo"
      }],
      "ChapterMarkers": false
    }
  ]
}
'@
New-PFile "nexora-presets.json" $presetsJson

# ── Resumo final ──────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  Organizacao completa!                          ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  Ficheiros criados: $totalFiles" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  PROXIMOS PASSOS:                               ║" -ForegroundColor Green
Write-Host "║  1. copy .env.example .env                      ║" -ForegroundColor Green
Write-Host "║  2. npm install                                 ║" -ForegroundColor Green
Write-Host "║  3. docker compose up -d                        ║" -ForegroundColor Green
Write-Host "║  4. npm run db:migrate                          ║" -ForegroundColor Green
Write-Host "║  5. Abrir Antigravity e executar Prompt 1       ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
