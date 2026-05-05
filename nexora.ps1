# Nexora Media Processing - Environment Manager v2.0
# Fix: UTF-8 Encoding for Windows Terminal
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8

$PROJECT_ROOT = $PSScriptRoot
$LOG_DIR = Join-Path $PROJECT_ROOT ".logs"
$PID_DIR = Join-Path $PROJECT_ROOT ".nexora/pids"

if (-not (Test-Path $LOG_DIR)) { New-Item -ItemType Directory -Path $LOG_DIR -Force | Out-Null }
if (-not (Test-Path $PID_DIR)) { New-Item -ItemType Directory -Path $PID_DIR -Force | Out-Null }

$SERVICES = @{
    "backend"  = @{ "port" = 3005; "metricsPort" = 9200; "cmd" = "npm run dev"; "cwd" = $PROJECT_ROOT; "log" = "backend.log"; "url" = "http://localhost:3005" }
    "worker"   = @{ "port" = $null; "metricsPort" = 9201; "cmd" = "npm run worker"; "cwd" = $PROJECT_ROOT; "log" = "worker.log"; "url" = $null }
    "frontend" = @{ "port" = 3002; "metricsPort" = $null; "cmd" = "npm run dev -- -p 3002"; "cwd" = (Join-Path $PROJECT_ROOT "frontend"); "log" = "frontend.log"; "url" = "http://localhost:3002" }
}

function Write-Nexora([string]$msg, [string]$color = "Cyan") {
    Write-Host "[Nexora CLI] " -NoNewline -ForegroundColor Blue
    Write-Host $msg -ForegroundColor $color
}

function Get-ServicePID([string]$name) {
    $pidFile = Join-Path $PID_DIR "$name.pid"
    if (Test-Path $pidFile) {
        $id = Get-Content $pidFile -ErrorAction SilentlyContinue
        if ($id -and (Get-Process -Id $id -ErrorAction SilentlyContinue)) {
            return $id
        }
    }
    return $null
}

function Stop-NexoraService([string]$name) {
    $id = Get-ServicePID $name
    if ($id) {
        Write-Nexora "A parar $name (PID: $id)..."
        Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $PID_DIR "$name.pid") -ErrorAction SilentlyContinue
    } else {
        $pidFile = Join-Path $PID_DIR "$name.pid"
        if (Test-Path $pidFile) { Remove-Item $pidFile -Force -ErrorAction SilentlyContinue }
    }
}

function Start-NexoraService([string]$name) {
    $svc = $SERVICES[$name]

    # Se ja estiver a correr, reiniciar
    if (Get-ServicePID $name) {
        Write-Nexora "$name ja esta a correr. Reiniciando..." "Yellow"
        Stop-NexoraService $name
    }

    # Verificar se a porta esta ocupada (app e metrics)
    $portsToCheck = @()
    if ($svc.port) { $portsToCheck += $svc.port }
    if ($svc.metricsPort) { $portsToCheck += $svc.metricsPort }

    foreach ($p in $portsToCheck) {
        $conn = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -ne 0 } | Select-Object -First 1
        if ($conn) {
            $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            $procName = if ($proc) { $proc.Name } else { "Desconhecido" }
            
            if ($procName -eq "node") {
                Write-Nexora "Porta $p ocupada por 'node' (PID: $($conn.OwningProcess)). A libertar..." "Yellow"
                Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 1
            } elseif ($procName -like "*docker*" -or $procName -like "*com.docker*") {
                Write-Nexora "ERRO: Porta $p ocupada pelo Docker. Verifica 'docker ps' ou para o container correspondente." "Red"
                return
            } else {
                Write-Nexora "ERRO: Porta $p ocupada por '$procName' (PID: $($conn.OwningProcess))." "Red"
                return
            }
        }
    }

    Write-Nexora "A iniciar $name em background..."
    $logFile = [System.IO.Path]::GetFullPath((Join-Path $LOG_DIR $svc.log))
    
    if (Test-Path $logFile) { Remove-Item $logFile -Force -ErrorAction SilentlyContinue }

    # Usar powershell.exe para arrancar em background com redireccionamento limpo
    $cmdToRun = $svc.cmd
    $sb = "Set-Location '$($svc.cwd)'; $cmdToRun *>&1 | Out-File -FilePath '$logFile' -Encoding utf8"
    $proc = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "& { $sb }" `
               -WorkingDirectory $svc.cwd -PassThru -WindowStyle Hidden

    if ($proc) {
        $proc.Id | Out-File (Join-Path $PID_DIR "$name.pid")
        Write-Nexora "$name iniciado (PID: $($proc.Id))." "Green"
        if ($svc.url) { Write-Nexora "  -> $($svc.url)" "DarkGray" }
    } else {
        Write-Nexora "Falha ao iniciar $name." "Red"
    }
}

function Show-Status {
    Write-Host ""
    Write-Nexora "--- Processos de Desenvolvimento (Node.js) ---" "Magenta"
    
    $header = "{0,-12} {1,-8} {2,-10} {3,-8} {4,-25} {5}" -f "Servico", "Porta", "Estado", "PID", "URL / Acesso", "Porta Metrics"
    Write-Host $header -ForegroundColor DarkCyan
    Write-Host ("-" * 85) -ForegroundColor DarkGray

    foreach ($name in @("backend", "frontend", "worker")) {
        $svc = $SERVICES[$name]
        $svcPid = Get-ServicePID $name
        $portStr = if ($svc.port) { $svc.port.ToString() } else { "N/A" }
        $urlStr = if ($svc.url) { $svc.url } else { "N/A" }
        $metricsStr = if ($svc.metricsPort) { $svc.metricsPort.ToString() } else { "N/A" }
        
        $line = "{0,-12} {1,-8} " -f $name, $portStr
        Write-Host $line -NoNewline
        
        if ($svcPid) {
            Write-Host ("{0,-10}" -f "Running") -NoNewline -ForegroundColor Green
            Write-Host (" {0,-8} {1,-25} {2}" -f $svcPid, $urlStr, $metricsStr)
        } else {
            Write-Host ("{0,-10}" -f "Stopped") -NoNewline -ForegroundColor Red
            Write-Host (" {0,-8} {1,-25} {2}" -f "---", "---", "---")
        }
    }
    Write-Host ""

    Write-Nexora "--- Infraestrutura Docker (Nexora) ---" "Magenta"
    $dockerOut = docker ps --filter "name=nexora" --format "table {{.Names}}\t{{.Status}}" 2>$null
    if ($dockerOut -and $dockerOut.Count -gt 1) {
        $dockerOut | ForEach-Object { Write-Host $_ }
    } else {
        Write-Nexora "Nenhum contentor Nexora activo." "Yellow"
    }
    
    # Identificar serviços MCP (Antigravity Support)
    $mcpOut = docker ps --filter "ancestor=ghcr.io/github/github-mcp-server" --format "{{.Names}} ({{.Status}})" 2>$null
    if ($mcpOut) {
        Write-Host ""
        Write-Nexora "--- Suporte IA (Antigravity MCP) ---" "Cyan"
        $mcpOut | ForEach-Object { Write-Host "  [IA] $_" -ForegroundColor DarkGray }
    }
    Write-Host ""
}

function Show-Logs([string]$name) {
    if (-not $SERVICES.ContainsKey($name)) {
        Write-Nexora "Servico desconhecido." "Red"
        return
    }
    $logFile = Join-Path $LOG_DIR $SERVICES[$name].log
    if (Test-Path $logFile) {
        Write-Nexora "A mostrar logs de $name (Ctrl+C para sair):" "Yellow"
        Get-Content $logFile -Wait -Tail 20
    } else {
        Write-Nexora "Ficheiro de log ainda nao criado." "Red"
    }
}

function Show-AllLogs {
    Write-Nexora "--- Modo Stream de Logs (Backend + Frontend + Worker) ---" "Yellow"
    Write-Nexora "Pressiona Ctrl+C para voltar ao menu." "Gray"
    
    $activeLogs = @()
    foreach ($svc in $SERVICES.Values) {
        $logPath = Join-Path $LOG_DIR $svc.log
        if (Test-Path $logPath) { $activeLogs += $logPath }
    }

    if ($activeLogs.Count -eq 0) {
        Write-Nexora "Nenhum servico a gerar logs no momento." "Red"
        Start-Sleep -s 2
        return
    }

    Get-Content -Path $activeLogs -Wait -Tail 10
}

function Show-SystemDetails {
    Write-Nexora "--- Detalhes de Memoria (Nexora) ---" "Magenta"
    $processes = @()
    foreach ($name in @("backend", "frontend", "worker")) {
        $svcPid = Get-ServicePID $name
        if ($svcPid) {
            $p = Get-Process -Id $svcPid -ErrorAction SilentlyContinue
            if ($p) {
                $mem = [Math]::Round($p.WorkingSet64 / 1MB, 2)
                $processes += New-Object PSObject -Property @{
                    "Servico"  = $name
                    "PID"      = $svcPid
                    "RAM (MB)" = $mem
                }
            }
        }
    }
    if ($processes.Count -gt 0) {
        $processes | Select-Object Servico, PID, "RAM (MB)" | Format-Table -AutoSize
    } else {
        Write-Nexora "Nenhum processo Node.js activo." "Yellow"
    }
}

function Reset-Nexora {
    Write-Nexora "ALERTA: Reset total (Docker + DB). Continuar? (S/N)" "Red"
    $choice = Read-Host
    if ($choice -ne "S" -and $choice -ne "s") { return }

    Write-Nexora "A parar tudo..."
    foreach ($name in $SERVICES.Keys) { Stop-NexoraService $name }
    docker-compose down -v --remove-orphans

    # Limpeza opcional de ferramentas de IA
    $mcpIds = docker ps -a --filter "ancestor=ghcr.io/github/github-mcp-server" --format "{{.ID}}"
    if ($mcpIds) {
        Write-Nexora "Limpar ferramentas de suporte IA (MCP)? (S/N)" "Yellow"
        $mcpChoice = Read-Host
        if ($mcpChoice -eq "S" -or $mcpChoice -eq "s") {
            Write-Nexora "A remover contentores MCP..."
            $mcpIds | ForEach-Object { docker rm -f $_ | Out-Null }
        }
    }

    Write-Nexora "A reiniciar infraestrutura..."
    docker-compose up -d
    Write-Nexora "A aguardar 5s..."
    Start-Sleep -s 5

    npm run db:generate
    npm run db:migrate:dev -- --name reset_cli

    # Limpar filas BullMQ (remove jobs falhados, concluidos e pendentes)
    Write-Nexora "A limpar filas BullMQ..."
    npm run queue:flush
    Write-Nexora "Filas BullMQ limpas." "Green"

    Write-Nexora "Reset concluido!" "Green"
}

# ── Entrada Principal ─────────────────────────────────────────────

$action = $args[0]
$target = $args[1]

switch ($action) {
    "start" {
        if ($target) { Start-NexoraService $target }
        else { foreach ($name in @("backend", "frontend", "worker")) { Start-NexoraService $name } }
        Write-Host ""
        Show-Status
    }
    "stop" {
        if ($target) { Stop-NexoraService $target }
        else { foreach ($name in @("backend", "frontend", "worker")) { Stop-NexoraService $name } }
        Write-Host ""
        Show-Status
    }
    "restart" {
        if ($target) { Stop-NexoraService $target; Start-NexoraService $target }
        else { foreach ($name in @("backend", "frontend", "worker")) { Stop-NexoraService $name; Start-NexoraService $name } }
        Write-Host ""
        Show-Status
    }
    "status" { Show-Status }
    "logs" { if ($target) { Show-Logs $target } else { Show-AllLogs } }
    "reset" { Reset-Nexora }
    "details" { Show-SystemDetails }
    Default {
        Clear-Host
        do {
            Write-Host ""
            Write-Host "  ==========================================================================" -ForegroundColor Cyan
            Write-Host "    NEXORA MANAGER v2.0 - Interface de Controlo                             " -ForegroundColor White -BackgroundColor DarkCyan
            Write-Host "  ==========================================================================" -ForegroundColor Cyan
            
            Show-Status

            Write-Host "  [ COMANDOS DE SERVICO ]" -ForegroundColor Yellow
            Write-Host "  1. Iniciar Tudo (Background)" -ForegroundColor White
            Write-Host "  2. Parar Tudo" -ForegroundColor White
            Write-Host "  3. Reiniciar Tudo" -ForegroundColor White
            Write-Host ""
            Write-Host "  [ MONITORIZACAO & LOGS ]" -ForegroundColor Yellow
            Write-Host "  4. Ver Logs Backend" -ForegroundColor Gray
            Write-Host "  5. Ver Logs Frontend" -ForegroundColor Gray
            Write-Host "  6. Ver Logs Worker" -ForegroundColor Gray
            Write-Host "  7. Modo Stream (Todos os Logs)" -ForegroundColor Green
            Write-Host "  8. Ver Detalhes RAM" -ForegroundColor Gray
            Write-Host ""
            Write-Host "  [ MANUTENCAO ]" -ForegroundColor Yellow
            Write-Host "  9. Reset Total (Docker + BD + Queues)" -ForegroundColor Red
            Write-Host ""
            Write-Host "  0. Sair" -ForegroundColor DarkGray
            Write-Host ""
            $menuInput = Read-Host "  Escolha uma opcao"

            Write-Host ""
            switch ($menuInput) {
                "1" { foreach ($name in @("backend", "frontend", "worker")) { Start-NexoraService $name } }
                "2" { foreach ($name in @("backend", "frontend", "worker")) { Stop-NexoraService $name } }
                "3" { foreach ($name in @("backend", "frontend", "worker")) { Stop-NexoraService $name; Start-NexoraService $name } }
                "4" { Show-Logs "backend"; Read-Host "`n  [Enter para voltar]" }
                "5" { Show-Logs "frontend"; Read-Host "`n  [Enter para voltar]" }
                "6" { Show-Logs "worker"; Read-Host "`n  [Enter para voltar]" }
                "7" { Show-AllLogs; Read-Host "`n  [Enter para voltar]" }
                "8" { Show-SystemDetails; Read-Host "`n  [Enter para voltar]" }
                "9" { Reset-Nexora; Read-Host "`n  [Enter para voltar]" }
                "0" { Write-Nexora "A sair..."; break }
            }
        } while ($menuInput -ne "0")
    }
}
