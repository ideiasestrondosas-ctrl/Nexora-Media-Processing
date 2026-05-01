param (
    [string]$Message
)

<#
.SYNOPSIS
    Nexora Sync - Automatiza a sincronização do workspace com o GitHub.
#>

# Configurações de codificação para o terminal
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Funcoes de Log (Cores nativas e texto sem acentos para evitar erros de encoding)
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
# DETECAO DE ALTERACOES
# ---------------------------------------------------------
Write-Step "Verificando alteracoes no workspace..."
$status = git status --porcelain
if (!$status) {
    Write-Success "Workspace limpo. Nada para atualizar."
    exit
}

Write-Host "Alteracoes detetadas:"
Write-Host $status

# ---------------------------------------------------------
# COMMIT E CONVENCOES
# ---------------------------------------------------------
$commitMsg = $Message
if (!$commitMsg) {
    # Sugestao automatica baseada no status
    $firstLine = ($status -split "`n")[0]
    $fileCount = ($status -split "`n").Count
    if ($firstLine.Length -gt 3) {
        $firstFile = $firstLine.Substring(3).Trim()
        $suggestedDesc = "atualizar $firstFile"
        if ($fileCount -gt 1) { $suggestedDesc += " e mais $($fileCount -1) ficheiros" }
    } else {
        $suggestedDesc = "atualizacoes gerais"
    }
    
    Write-Host "`nNormas de Commit (GitHub):"
    Write-Host "1. feat: (Novas funcionalidades)"
    Write-Host "2. fix: (Correcao de bugs)"
    Write-Host "3. docs: (Alteracoes na documentacao)"
    Write-Host "4. style: (Formatacao, estetica)"
    Write-Host "5. refactor: (Refatoracao de codigo)"
    
    $type = Read-Host "Escolha o tipo (Padrao: feat)"
    if (!$type) { $type = "feat" }
    
    $desc = Read-Host "Descricao (Sugestao: $suggestedDesc)"
    if (!$desc) { $desc = $suggestedDesc }
    
    $commitMsg = "$($type): $desc"
}

Write-Step "A utilizar mensagem: '$commitMsg'"
$confirmCommit = Read-Host "Confirmar commit e push? (y/n, Padrao: y)"
if ($confirmCommit -eq "n") { Write-Warning "Operacao cancelada."; exit }

Write-Step "Adicionando ficheiros e fazendo commit..."
git add .
git commit -m $commitMsg

if ($LASTEXITCODE -ne 0) {
    Write-ErrorMsg "Falha ao realizar o commit."
    exit
}

# ---------------------------------------------------------
# LIMPEZA POS-COMMIT (GRAPHIFY)
# ---------------------------------------------------------
Start-Sleep -Seconds 1
$postStatus = git status --porcelain
if ($postStatus) {
    Write-Step "Sincronizando alteracoes automaticas (Graphify)..."
    git add .
    git commit -m "docs: atualizar grafo e relatorios (auto)" --no-verify
}

# ---------------------------------------------------------
# PUSH PARA O GITHUB
# ---------------------------------------------------------
Write-Step "Enviando para o GitHub..."
$branch = git branch --show-current
git push -u origin $branch

if ($LASTEXITCODE -eq 0) {
    Write-Success "Projeto atualizado no GitHub com sucesso!"
} else {
    Write-ErrorMsg "Falha ao enviar para o GitHub."
}
