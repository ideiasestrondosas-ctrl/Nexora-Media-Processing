$ErrorActionPreference = "Stop"

$Dir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$DataDir = Join-Path $Dir "data"

if (-Not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
}

Write-Host "[Nexora] Gerando base fixture..."
ffmpeg -y -f lavfi -i testsrc=duration=2:size=1280x720:rate=25 -f lavfi -i aevalsrc="sin(440*2*PI*t)":duration=2 -c:v libx264 -pix_fmt yuv420p -preset ultrafast -c:a aac -b:a 128k "$DataDir\base.mp4"

Write-Host "`n[Nexora] Gerando fixture VFR (Variable Framerate)..."
ffmpeg -y -i "$DataDir\base.mp4" -vf "select='mod(n\,2)'" -vsync vfr -c:v libx264 -preset ultrafast -c:a copy "$DataDir\vfr.mp4"

Write-Host "`n[Nexora] Gerando fixture Low Quality (VMAF < Threshold)..."
ffmpeg -y -i "$DataDir\base.mp4" -c:v libx264 -crf 51 -preset ultrafast -c:a copy "$DataDir\low_quality.mp4"

Write-Host "`n[Nexora] Gerando fixture Audio Low LUFS..."
ffmpeg -y -i "$DataDir\base.mp4" -c:v copy -c:a aac -filter:a "volume=-20dB" "$DataDir\low_lufs.mp4"

Write-Host "`n[Nexora] Gerando fixture Open GOP..."
ffmpeg -y -i "$DataDir\base.mp4" -c:v libx264 -flags -cgop -g 50 -preset ultrafast -c:a copy "$DataDir\open_gop.mp4"

Write-Host "`n[Nexora] Gerando fixture Corrupted (Truncated)..."
$Bytes = Get-Content "$DataDir\base.mp4" -Encoding Byte -ReadCount 0
$Truncated = $Bytes[0..($Bytes.Length / 2)]
Set-Content "$DataDir\corrupted.mp4" -Value $Truncated -Encoding Byte

Write-Host "`n[Nexora] Fixtures geradas com sucesso em $DataDir!"
