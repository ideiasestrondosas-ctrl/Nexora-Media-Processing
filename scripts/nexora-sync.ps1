param (
    [string]$Message,
    [switch]$SkipRelease
)

<#
.SYNOPSIS
    Nexora Sync - Automatiza a sincronização, versionamento (SemVer) e releases no GitHub.
#>

# Configurações de codificação para o terminal
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Funcoes de Log
function Write-Step($msg) { Write-Host "[STEP] $msg" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warning($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-ErrorMsg($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

# ---------------------------------------------------------
# VERIFICACAO DE AMBIENTE
# ---------------------------------------------------------
Write-Step "Verificando ambiente Git..."

if (!(Test-Path ".git")) {
    Write-Warning "Repositorio Git nao inicializado. Inicializando..."
    git init
}

$remote = git remote get-url origin 2>$null
if (!$remote) {
    Write-Warning "Remoto 'origin' nao configurado."
    $url = Read-Host "Introduza a URL do repositorio GitHub"
    if ($url) {
        git remote add origin $url
        Write-Success "Remoto origin adicionado: $url"
    } else {
        Write-ErrorMsg "URL do repositorio e necessaria para continuar."
        exit
    }
}

# ---------------------------------------------------------
# CARREGAMENTO DE CONFIGURACOES (.env)
# ---------------------------------------------------------
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^\s*GITHUB_TOKEN\s*=\s*(.*)$") {
            $val = $matches[1].Trim().Trim("'").Trim('"')
            if ($val) { $script:GITHUB_TOKEN = $val }
        }
    }
}

# ---------------------------------------------------------
# DETECAO DE ALTERACOES
# ---------------------------------------------------------
Write-Step "Analisando alteracoes no workspace..."

git update-index --refresh > $null 2>&1
$branch = git branch --show-current
$status = git status --porcelain

if (!$status -and !(git log origin/$branch..HEAD --oneline)) {
    Write-Success "Workspace e GitHub estao sincronizados. Nada para fazer."
    exit
}

# ---------------------------------------------------------
# COMMIT DE CODIGO
# ---------------------------------------------------------
if ($status) {
    $commitMsg = $Message
    if (!$commitMsg) {
        Write-Host "`nConvencoes de Commit (SemVer):"
        Write-Host "1. feat: (Nova funcionalidade -> Bump MINOR)"
        Write-Host "2. fix: (Correcao de bug -> Bump PATCH)"
        Write-Host "3. docs: (Documentacao -> Bump PATCH)"
        Write-Host "4. style: (Estetica -> Bump PATCH)"
        Write-Host "5. refactor: (Refatoracao -> Bump PATCH)"
        Write-Host "6. BREAKING CHANGE: (Alteracao disruptiva -> Bump MAJOR)"
        
        $type = Read-Host "Escolha o tipo (Padrao: feat)"
        if (!$type) { $type = "feat" }
        
        $desc = Read-Host "Descricao"
        if (!$desc) { $desc = "atualizacoes gerais" }
        
        $commitMsg = "$($type): $desc"
    }

    Write-Step "Realizando commit: '$commitMsg'..."
    git add .
    git commit -m $commitMsg
    
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "Falha ao realizar o commit."
        exit
    }

    # Sincronizar Graphify se necessario
    Start-Sleep -Seconds 1
    if (git status --porcelain) {
        git add .
        git commit -m "docs: atualizar grafo e relatorios (auto)" --no-verify
    }
}

# ---------------------------------------------------------
# GESTAO DE VERSAO (SemVer)
# ---------------------------------------------------------
if (!$SkipRelease) {
    Write-Step "Iniciando processo de versionamento..."
    
    # 1. Ler versao atual
    if (Test-Path "package.json") {
        $packageJson = Get-Content "package.json" | ConvertFrom-Json
        $currentVersion = $packageJson.version
    } else {
        $currentVersion = "0.1.0"
    }
    
    Write-Host "Versao atual: $currentVersion" -ForegroundColor Gray

    # 2. Deduzir proxima versao
    $vParts = $currentVersion.Split('.')
    $major = [int]$vParts[0]
    $minor = [int]$vParts[1]
    $patch = [int]$vParts[2]

    $suggestedVersion = ""
    if ($commitMsg -match "BREAKING CHANGE") {
        $suggestedVersion = "$($major + 1).0.0"
    } elseif ($commitMsg -match "^feat:") {
        $suggestedVersion = "$major.$($minor + 1).0"
    } else {
        $suggestedVersion = "$major.$minor.$($patch + 1)"
    }

    # 3. Menu Interativo
    Write-Host "`nEscolha a proxima versao:" -ForegroundColor Yellow
    Write-Host "1) Patch ($($major).$($minor).$($patch + 1))"
    Write-Host "2) Minor ($($major).$($minor + 1).0)"
    Write-Host "3) Major ($($major + 1).0.0)"
    Write-Host "4) Ignorar versao (Apenas push)"
    
    $choice = Read-Host "Opcao (Padrao baseada no commit: $suggestedVersion)"
    
    $newVersion = ""
    switch ($choice) {
        "1" { $newVersion = "$($major).$($minor).$($patch + 1)" }
        "2" { $newVersion = "$major.$($minor + 1).0" }
        "3" { $newVersion = "$($major + 1).0.0" }
        "4" { $newVersion = "" }
        default { if (!$choice) { $newVersion = $suggestedVersion } }
    }

    if ($newVersion) {
        Write-Step "Aplicando versao v$newVersion..."

        # Atualizar package.json
        if (Test-Path "package.json") {
            $packageJson.version = $newVersion
            $packageJson | ConvertTo-Json -Depth 20 | Out-File "package.json" -Encoding UTF8
        }

        # Atualizar CHANGELOG.md
        if (Test-Path "CHANGELOG.md") {
            $changelog = Get-Content "CHANGELOG.md" -Raw
            $date = Get-Date -Format "yyyy-MM-dd"
            $newEntry = "## [$newVersion] - $date`n`n### Added`n- $commitMsg`n"
            $changelog = $changelog -replace "## \[Unreleased\]", "## [Unreleased]`n`n$newEntry"
            # Se nao tiver Unreleased, colocar no topo
            if ($changelog -notmatch "## \[Unreleased\]") {
                $changelog = "# Changelog`n`n$newEntry`n" + ($changelog -replace "# Changelog", "")
            }
            $changelog | Out-File "CHANGELOG.md" -Encoding UTF8
        }

        # Atualizar PROGRESS.md
        if (Test-Path "PROGRESS.md") {
            (Get-Content "PROGRESS.md") -replace "\| \*\*Versão\*\* \| .* \|", "| **Versão** | $newVersion |" | Out-File "PROGRESS.md" -Encoding UTF8
        }

        # Commit de release e Tag
        git add package.json CHANGELOG.md PROGRESS.md
        git commit -m "chore(release): v$newVersion" --no-verify
        git tag -a "v$newVersion" -m "Nexora Release v$newVersion"
        Write-Success "Versao v$newVersion preparada com sucesso!"
        $isNewRelease = $true
    }
}

# ---------------------------------------------------------
# PUSH PARA O GITHUB
# ---------------------------------------------------------
Write-Step "Enviando para o GitHub..."
$username = "ideiasestrondosas-ctrl"

if ($script:GITHUB_TOKEN) {
    $remoteUrl = git remote get-url origin
    $baseRepo = $remoteUrl -replace "https://[^@]+@", "" -replace "https://", ""
    $authenticatedUrl = "https://$($username):$($script:GITHUB_TOKEN)@$baseRepo"
    git push -u "$authenticatedUrl" $branch --tags
} else {
    git push -u origin $branch --tags
}

if ($LASTEXITCODE -eq 0) {
    Write-Success "Sincronizacao concluida!"
    
    # Criar GitHub Release se houver nova versao e token
    if ($isNewRelease -and $script:GITHUB_TOKEN) {
        Write-Step "Criando Release no GitHub via API..."
        try {
            $releaseBody = @{
                tag_name = "v$newVersion"
                name = "Nexora Media Processing v$newVersion"
                body = "### Alteracoes nesta versao`n`n- $commitMsg`n`nConsulte o CHANGELOG.md para detalhes."
                draft = $false
                prerelease = $false
            } | ConvertTo-Json

            $headers = @{
                "Authorization" = "token $script:GITHUB_TOKEN"
                "Accept" = "application/vnd.github+json"
            }

            Invoke-RestMethod -Uri "https://api.github.com/repos/$username/Nexora-Media-Processing/releases" -Method Post -Headers $headers -Body $releaseBody -ContentType "application/json" > $null
            Write-Success "GitHub Release v$newVersion publicada!"
        } catch {
            Write-Warning "Nao foi possivel publicar a Release no GitHub: $_"
        }
    }
} else {
    Write-ErrorMsg "Falha ao enviar para o GitHub."
}
