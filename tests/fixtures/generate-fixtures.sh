#!/bin/bash
# Gerar ficheiros de vídeo para testes usando FFmpeg (sem copyright)
FIXTURES_DIR="$(dirname "$0")"
echo "A gerar fixtures de teste..."

ffmpeg -y -f lavfi -i "testsrc2=duration=30:size=1920x1080:rate=25" \
  -f lavfi -i "sine=frequency=1000:duration=30:sample_rate=48000" \
  -c:v libx264 -profile:v high -level:v 4.1 -pix_fmt yuv420p \
  -g 50 -keyint_min 50 -sc_threshold 0 -flags +cgop -bf 0 \
  -b:v 8000k -maxrate 8000k -bufsize 16000k -c:a pcm_s24le -ar 48000 \
  -movflags +faststart "$FIXTURES_DIR/nexora_reference_broadcast.mp4"

ffmpeg -y -f lavfi -i "testsrc2=duration=10:size=1920x1080:rate=25" \
  -c:v libx264 -g 50 -x264-params "open-gop=1:bframes=3" \
  "$FIXTURES_DIR/nexora_problem_open_gop.mp4"

ffmpeg -y -f lavfi -i "testsrc2=duration=10:size=1920x1080:rate=25" \
  -c:v libx264 -vsync vfr "$FIXTURES_DIR/nexora_problem_vfr.mp4"

ffmpeg -y -f lavfi -i "testsrc2=duration=10:size=1920x1080:rate=25" \
  -f lavfi -i "sine=frequency=440:duration=10" -af "volume=10dB" \
  "$FIXTURES_DIR/nexora_problem_loud.mp4"

head -c 1000000 "$FIXTURES_DIR/nexora_reference_broadcast.mp4" \
  > "$FIXTURES_DIR/nexora_problem_corrupt.mp4"

echo "✓ Fixtures geradas em $FIXTURES_DIR/"
