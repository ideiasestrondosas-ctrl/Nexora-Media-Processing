#!/bin/bash
# Nexora Media Processing - Generate Test Fixtures

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
DATA_DIR="$DIR/data"

mkdir -p "$DATA_DIR"

echo "[Nexora] Gerando base fixture..."
# Gera um video base de 2 segundos com audio SMPTE e color bars, CFR 25fps, yuv420p, ebu r128 loudness em torno de -23 LUFS
ffmpeg -y -f lavfi -i testsrc=duration=2:size=1280x720:rate=25 -f lavfi -i aevalsrc="sin(440*2*PI*t)":duration=2 -c:v libx264 -pix_fmt yuv420p -preset ultrafast -c:a aac -b:a 128k "$DATA_DIR/base.mp4" 2>/dev/null

echo "[Nexora] Gerando fixture VFR (Variable Framerate)..."
# Copia o base e forca VFR. Em ultrafast as vezes e dificil, mas dropando frames ajuda
ffmpeg -y -i "$DATA_DIR/base.mp4" -vf "select='mod(n\,2)'" -vsync vfr -c:v libx264 -preset ultrafast -c:a copy "$DATA_DIR/vfr.mp4" 2>/dev/null

echo "[Nexora] Gerando fixture Low Quality (VMAF < Threshold)..."
# Usa CRF 51 para qualidade horrivel
ffmpeg -y -i "$DATA_DIR/base.mp4" -c:v libx264 -crf 51 -preset ultrafast -c:a copy "$DATA_DIR/low_quality.mp4" 2>/dev/null

echo "[Nexora] Gerando fixture Audio Low LUFS..."
# Reduz o volume do audio em 20dB
ffmpeg -y -i "$DATA_DIR/base.mp4" -c:v copy -c:a aac -filter:a "volume=-20dB" "$DATA_DIR/low_lufs.mp4" 2>/dev/null

echo "[Nexora] Gerando fixture Open GOP..."
# Forca cgop=0 para Open GOP
ffmpeg -y -i "$DATA_DIR/base.mp4" -c:v libx264 -flags -cgop -g 50 -preset ultrafast -c:a copy "$DATA_DIR/open_gop.mp4" 2>/dev/null

echo "[Nexora] Gerando fixture Corrupted (Truncated)..."
# Copia metade dos bytes do base.mp4 para simular um moov atom em falta ou truncado (se moov estiver no final)
# Como libx264 mete moov no fim por default, truncar corrompe o ficheiro
dd if="$DATA_DIR/base.mp4" of="$DATA_DIR/corrupted.mp4" bs=1024 count=10 2>/dev/null

echo "[Nexora] Fixtures geradas com sucesso em $DATA_DIR!"
ls -la "$DATA_DIR"
