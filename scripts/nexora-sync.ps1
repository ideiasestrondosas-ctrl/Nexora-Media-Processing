<#
.SYNOPSIS
    Nexora Sync - Automatiza a sincronização do workspace com o GitHub.
    
.DESCRIPTION
    Este script verifica alterações, realiza commits seguindo as normas do GitHub
    e envia para a cloud. Também possui um mecanismo de rollback.
#>

param (
    [switch]$Rollback,
    [string]$Message
)

# Configurações de Cores
$Green = "`e[32m"
$Blue = "`e[34m"
$Yellow = "`e[33m"
$Red = "`e[31m"
$Reset = "`e[0m"

function Write-Step($msg) { Write-Host "${Blue}[STEP]${Reset} $msg" }
function Write-Success($msg) { Write-Host "${Green}[OK]${Reset} $msg" }
function Write-Warning($msg) { Write-Host "${Yellow}[WARN]${Reset} $msg" }
function Write-ErrorMsg($msg) { Write-Host "${Red}[ERROR]${Reset} $msg" -ForegroundColor Red }

# ---------------------------------------------------------
# FUNÇÃO DE ROLLBACK
# ---------------------------------------------------------
if ($Rollback) {
    Write-Warning "Iniciando procedimento de Rollback..."
    
    $confirm = Read-Host "Tem certeza que deseja desfazer o último commit (local e remoto)? (y/n)"
    if ($confirm -ne "y") { Write-Host "Operação cancelada."; exit }

    Write-Step "Revertendo commit local..."
    git reset --hard HEAD~1
    
    Write-Step "Revertendo commit remoto (GitHub)..."
    $branch = git branch --show-current
    git push origin $branch --force
    
    Write-Success "Rollback concluído com sucesso!"
    exit
}

# ---------------------------------------------------------
# VERIFICAÇÃO DE AMBIENTE
# ---------------------------------------------------------
Write-Step "Verificando ambiente Git..."

if (!(Test-Path ".git")) {
    Write-Warning "Repositório Git não inicializado. Inicializando..."
    git init
}

$remote = git remote get-url origin 2>$null
if (!$remote) {
    Write-Warning "Remoto 'origin' não configurado."
    $url = Read-Host "Introduza a URL do repositório GitHub"
    if ($url) {
        git remote add origin $url
        Write-Success "Remoto origin adicionado: $url"
    } else {
        Write-ErrorMsg "URL do repositório é necessária para continuar."
        exit
    }
}

# ---------------------------------------------------------
# DETEÇÃO DE ALTERAÇÕES
# ---------------------------------------------------------
Write-Step "Verificando alterações no workspace..."
$status = git status --porcelain
if (!$status) {
    Write-Success "Workspace limpo. Nada para atualizar."
    exit
}

Write-Host "Alterações detetadas:"
Write-Host $status

# ---------------------------------------------------------
# COMMIT E CONVENÇÕES
# ---------------------------------------------------------
$commitMsg = $Message
if (!$commitMsg) {
    # Sugestão automática baseada no status
    $firstFile = ($status -split "`n")[0].Substring(3).Trim()
    $fileCount = ($status -split "`n").Count
    $suggestedDesc = "atualizar $firstFile"
    if ($fileCount -gt 1) { $suggestedDesc += " e mais $($fileCount -1) ficheiros" }
    
    Write-Host "`nNormas de Commit (GitHub):"
    Write-Host "1. feat: (Novas funcionalidades)"
    Write-Host "2. fix: (Correção de bugs)"
    Write-Host "3. docs: (Alterações na documentação)"
    Write-Host "4. style: (Formatação, estética)"
    Write-Host "5. refactor: (Refatoração de código)"
    
    $type = Read-Host "Escolha o tipo (Padrão: feat)"
    if (!$type) { $type = "feat" }
    
    $desc = Read-Host "Descrição (Sugestão: $suggestedDesc)"
    if (!$desc) { $desc = $suggestedDesc }
    
    $commitMsg = "$($type): $desc"
}

Write-Step "A utilizar mensagem: '$commitMsg'"
$confirmCommit = Read-Host "Confirmar commit e push? (y/n, Padrão: y)"
if ($confirmCommit -eq "n") { Write-Warning "Operação cancelada."; exit }

Write-Step "Adicionando ficheiros e fazendo commit..."
git add .
git commit -m $commitMsg

if ($LASTEXITCODE -ne 0) {
    Write-ErrorMsg "Falha ao realizar o commit."
    exit
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
    Write-ErrorMsg "Falha ao enviar para o GitHub. Verifique as suas credenciais ou ligação."
}
