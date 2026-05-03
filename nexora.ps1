# Nexora Media Processing — Environment Manager (CLI)
# Ficheiro: nexora.ps1

$PROJECT_ROOT = Get-Location
$LOG_DIR = Join-Path $PROJECT_ROOT ".logs"
$PID_DIR = Join-Path $PROJECT_ROOT ".nexora/pids"

# Garantir directorias base
if (-not (Test-Path $LOG_DIR)) { New-Item -ItemType Directory -Path $LOG_DIR | Out-Null }
if (-not (Test-Path $PID_DIR)) { New-Item -ItemType Directory -Path $PID_DIR -Force | Out-Null }

$SERVICES = @{
    "backend"  = @{ "port" = 3000; "cmd" = "npm run dev"; "cwd" = $PROJECT_ROOT; "log" = "backend.log" }
    "worker"   = @{ "port" = $null; "cmd" = "npm run worker"; "cwd" = $PROJECT_ROOT; "log" = "worker.log" }
    "frontend" = @{ "port" = 3001; "cmd" = "npm run dev"; "cwd" = (Join-Path $PROJECT_ROOT "frontend"); "log" = "frontend.log" }
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
    if (Get-ServicePID $name) {
        Write-Nexora "$name já está a correr. Reiniciando..." "Yellow"
        Stop-NexoraService $name
    }

    $svc = $SERVICES[$name]
    if ($svc.port) {
        # Verificar se a porta está ocupada
        $portCheck = Get-NetTCPConnection -LocalPort $svc.port -ErrorAction SilentlyContinue
        if ($portCheck) {
            Write-Nexora "ERRO: Porta $($svc.port) já está em uso por outro processo externo!" "Red"
            return $false
        }
    }

    Write-Nexora "A iniciar $name em background..."
    $logFile = Join-Path $LOG_DIR $svc.log
    
    # Comando para iniciar em background e redireccionar output
    # Usamos o cmd /c para garantir que o npm corre correctamente em background
    $process = Start-Process -FilePath "cmd.exe" -ArgumentList "/c $($svc.cmd) > `"$logFile`" 2>&1" `
               -WorkingDirectory $svc.cwd -PassThru -WindowStyle Hidden

    if ($process) {
        $process.Id | Out-File (Join-Path $PID_DIR "$name.pid")
        Write-Nexora "$name iniciado com sucesso (PID: $($process.Id))." "Green"
        return $true
    }
    return $false
}

function Show-Status {
    Write-Nexora "--- Estado do Sistema Nexora ---" "Magenta"
    $format = "{0,-12} | {1,-8} | {2,-10} | {3,-15}"
    Write-Host ($format -f "Serviço", "Porta", "Estado", "PID") -ForegroundColor Gray
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
}

function Show-Logs([string]$name) {
    if (-not $SERVICES.ContainsKey($name)) {
        Write-Nexora "Serviço desconhecido." "Red"
        return
    }
    $logFile = Join-Path $LOG_DIR $SERVICES[$name].log
    if (Test-Path $logFile) {
        Write-Nexora "A mostrar logs de $name (Ctrl+C para sair):" "Yellow"
        Get-Content $logFile -Wait -Tail 20
    } else {
        Write-Nexora "Ficheiro de log ainda não criado." "Red"
    }
}

function Reset-Nexora {
    Write-Nexora "ALERTA: Isto vai apagar todos os dados e reiniciar o ambiente. Continuar? (S/N)" "Red"
    $choice = Read-Host
    if ($choice -ne "S" -and $choice -ne "s") { return }

    Write-Nexora "A parar todos os serviços..."
    foreach ($name in $SERVICES.Keys) { Stop-NexoraService $name }

    Write-Nexora "A limpar contentores Docker..."
    docker-compose down -v --remove-orphans

    Write-Nexora "A iniciar infraestrutura..."
    docker-compose up -d

    Write-Nexora "A aguardar base de dados (5s)..."
    Start-Sleep -s 5

    Write-Nexora "A aplicar migrações Prisma..."
    npm run db:generate
    npm run db:migrate:dev -- --name reset_cli

    Write-Nexora "Reset concluído com sucesso!" "Green"
}

# --- Menu Lógica ---
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
    "logs" { Show-Logs $target }
    "reset" { Reset-Nexora }
    Default {
        do {
            Clear-Host
            Write-Host "========================================" -ForegroundColor Blue
            Write-Host "   NEXORA MEDIA PROCESSING MANAGER      " -ForegroundColor White -BackgroundColor Blue
            Write-Host "========================================" -ForegroundColor Blue
            Show-Status
            Write-Host "1. Iniciar Tudo"
            Write-Host "2. Parar Tudo"
            Write-Host "3. Reiniciar Tudo"
            Write-Host "4. Ver Logs Backend"
            Write-Host "5. Ver Logs Worker"
            Write-Host "6. Ver Logs Frontend"
            Write-Host "7. Reset Total (Nuclear)"
            Write-Host "0. Sair"
            Write-Host ""
            $input = Read-Host "Escolha uma opção"

            switch ($input) {
                "1" { foreach ($name in $SERVICES.Keys) { Start-NexoraService $name }; Read-Host "Pressione Enter para continuar" }
                "2" { foreach ($name in $SERVICES.Keys) { Stop-NexoraService $name }; Read-Host "Pressione Enter para continuar" }
                "3" { foreach ($name in $SERVICES.Keys) { Stop-NexoraService $name; Start-NexoraService $name }; Read-Host "Pressione Enter para continuar" }
                "4" { Show-Logs "backend" }
                "5" { Show-Logs "worker" }
                "6" { Show-Logs "frontend" }
                "7" { Reset-Nexora; Read-Host "Pressione Enter para continuar" }
                "0" { break }
            }
        } while ($input -ne "0")
    }
}
