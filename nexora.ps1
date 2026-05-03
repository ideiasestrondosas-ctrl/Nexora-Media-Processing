# Nexora Media Processing - Environment Manager v1.2
# Fix: UTF-8 Encoding for Windows Terminal
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8

$PROJECT_ROOT = $PSScriptRoot
$LOG_DIR = Join-Path $PROJECT_ROOT ".logs"
$PID_DIR = Join-Path $PROJECT_ROOT ".nexora/pids"

if (-not (Test-Path $LOG_DIR)) { New-Item -ItemType Directory -Path $LOG_DIR -Force | Out-Null }
if (-not (Test-Path $PID_DIR)) { New-Item -ItemType Directory -Path $PID_DIR -Force | Out-Null }

$SERVICES = @{
    "backend"  = @{ "port" = 3000; "cmd" = "npm run dev"; "cwd" = $PROJECT_ROOT; "log" = "backend.log"; "url" = "http://localhost:3000" }
    "worker"   = @{ "port" = $null; "cmd" = "npm run worker"; "cwd" = $PROJECT_ROOT; "log" = "worker.log"; "url" = $null }
    "frontend" = @{ "port" = 3002; "cmd" = "npm run dev -- -p 3002"; "cwd" = (Join-Path $PROJECT_ROOT "frontend"); "log" = "frontend.log"; "url" = "http://localhost:3002" }
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
        return $true
    }
    return $false
}

function Start-NexoraService([string]$name) {
    $svc = $SERVICES[$name]
    if (Get-ServicePID $name) {
        Write-Nexora "$name ja esta a correr. Reiniciando..." "Yellow"
        Stop-NexoraService $name
    }

    if ($svc.port) {
        $portCheck = Get-NetTCPConnection -LocalPort $svc.port -ErrorAction SilentlyContinue
        if ($portCheck) {
            $process = Get-Process -Id $portCheck.OwningProcess -ErrorAction SilentlyContinue
            $owner = if ($process) { $process.Name } else { "Desconhecido" }
            Write-Nexora "ERRO: Porta $($svc.port) ocupada por '$owner'!" "Red"
            if ($owner -like "*docker*") {
                Write-Nexora "DICA: Um contentor Docker esta a usar esta porta. Verifica 'docker ps'." "Yellow"
            }
            return $false
        }
    }

    Write-Nexora "A iniciar $name em background..."
    $logFile = Join-Path $LOG_DIR $svc.log
    
    $process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c $($svc.cmd) > `"$logFile`" 2>&1" `
               -WorkingDirectory $svc.cwd -PassThru -WindowStyle Hidden

    if ($process) {
        $process.Id | Out-File (Join-Path $PID_DIR "$name.pid")
        Write-Nexora "$name iniciado (PID: $($process.Id))." "Green"
        if ($svc.url) { Write-Nexora "Aceder em: $($svc.url)" "Magenta" }
        return $true
    }
    return $false
}

function Show-Status {
    Write-Nexora "--- Processos de Desenvolvimento (Node.js) ---" "Magenta"
    $format = "{0,-12} | {1,-8} | {2,-10} | {3,-15}"
    Write-Host ($format -f "Servico", "Porta", "Estado", "PID") -ForegroundColor Gray
    Write-Host ("-" * 50) -ForegroundColor Gray

    foreach ($name in $SERVICES.Keys) {
        $svc = $SERVICES[$name]
        $svcPid = Get-ServicePID $name
        $status = if ($svcPid) { "Running" } else { "Stopped" }
        $color = if ($svcPid) { "Green" } else { "Red" }
        $portStr = if ($svc.port) { $svc.port.ToString() } else { "N/A" }
        
        Write-Host ($name.PadRight(12) + " | " + $portStr.PadRight(8) + " | ") -NoNewline
        Write-Host $status.PadRight(10) -NoNewline -ForegroundColor $color
        $pidStr = if ($svcPid) { $svcPid } else { "---" }
        Write-Host (" | " + $pidStr)
    }
    Write-Host ""

    Write-Nexora "--- Infraestrutura Docker (Nexora) ---" "Magenta"
    $dockerOut = docker ps --filter "name=nexora" --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
    if ($dockerOut -like "*NAMES*") {
        Write-Host $dockerOut
    } else {
        Write-Nexora "Nenhum contentor Nexora activo." "Yellow"
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
    foreach ($name in $SERVICES.Keys) {
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

    Write-Nexora "A reiniciar infraestrutura..."
    docker-compose up -d
    Write-Nexora "A aguardar 5s..."
    Start-Sleep -s 5

    npm run db:generate
    npm run db:migrate:dev -- --name reset_cli
    Write-Nexora "Reset concluido!" "Green"
}

$action = $args[0]
$target = $args[1]

switch ($action) {
    "start" {
        if ($target) { Start-NexoraService $target }
        else { foreach ($name in $SERVICES.Keys) { Start-NexoraService $name } }
    }
    "stop" {
        if ($target) { Stop-NexoraService $target }
        else { foreach ($name in $SERVICES.Keys) { Stop-NexoraService $name } }
    }
    "restart" {
        if ($target) { Stop-NexoraService $target; Start-NexoraService $target }
        else { foreach ($name in $SERVICES.Keys) { Stop-NexoraService $name; Start-NexoraService $name } }
    }
    "status" { Show-Status }
    "logs" { if ($target) { Show-Logs $target } else { Show-AllLogs } }
    "reset" { Reset-Nexora }
    "details" { Show-SystemDetails }
    Default {
        do {
            Clear-Host
            Write-Host "========================================" -ForegroundColor Blue
            Write-Host "   NEXORA MANAGER v1.2 (Clean)          " -ForegroundColor White -BackgroundColor Blue
            Write-Host "========================================" -ForegroundColor Blue
            Show-Status
            Write-Host "1. Iniciar Tudo (Background)"
            Write-Host "2. Parar Tudo"
            Write-Host "3. Ver Logs Backend" | Write-Host "4. Ver Logs Frontend" -NoNewline; Write-Host " | 5. Ver Logs Worker"
            Write-Host "6. Ver Detalhes RAM"
            Write-Host "7. Reset Total"
            Write-Host "8. Modo Stream (Todos os Logs)" -ForegroundColor Yellow
            Write-Host "0. Sair"
            Write-Host ""
            $input = Read-Host "Escolha"

            switch ($input) {
                "1" { foreach ($name in $SERVICES.Keys) { Start-NexoraService $name }; Read-Host "Enter..." }
                "2" { foreach ($name in $SERVICES.Keys) { Stop-NexoraService $name }; Read-Host "Enter..." }
                "3" { Show-Logs "backend" }
                "4" { Show-Logs "frontend" }
                "5" { Show-Logs "worker" }
                "6" { Show-SystemDetails; Read-Host "Enter..." }
                "7" { Reset-Nexora; Read-Host "Enter..." }
                "8" { Show-AllLogs }
                "0" { break }
            }
        } while ($input -ne "0")
    }
}
