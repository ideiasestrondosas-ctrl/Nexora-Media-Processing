# Nexora Media Processing
## Apêndices Finais

> Este documento completa o Documento Técnico principal.  
> Inclui: Cheat Sheets · Ferramentas Open Source · Sizing · Troubleshooting

---

# APÊNDICE A — FERRAMENTAS OPEN SOURCE INTEGRADAS

## A.1 Comparação e Decisão de Uso

O Nexora usa ferramentas 100% open source. Esta é a análise de cada uma e onde se encaixam no sistema.

| Ferramenta | Tipo | Papel no Nexora | Limitação conhecida |
|---|---|---|---|
| **FFmpeg** | CLI | Motor principal de transcoding, normalização, VMAF | Sem GUI — apenas CLI |
| **HandBrakeCLI** | CLI | Proxies e outputs web (mais rápido que FFmpeg para estes casos) | Não garante Closed GOP com o mesmo rigor que FFmpeg |
| **MediaInfo** | CLI | Análise de containers (melhor que FFprobe para containers) | Não faz conformance checking formal |
| **FFprobe** | CLI | Análise frame-level e metadata de streams | Menos preciso em container parsing que MediaInfo |
| **MediaConch** | CLI | Conformance checking formal com policy XML (AS-11, MXF) | Não faz transcoding |
| **BS1770GAIN** | CLI | Medição EBU R128 independente do FFmpeg | Só mede — não normaliza |
| **libvmaf** | Lib. integrada no FFmpeg | VMAF scoring pós-encode | Requer ficheiro de referência (mezzanine) |
| **VLC** | Headless | Sanity check de playback final | Apenas verificação — não processa |

## A.2 HandBrake — Quando Usar e Quando Não Usar

**✅ Usar HandBrakeCLI no Nexora para:**
- Geração de proxies LowRes (720p, 800kbps)
- Outputs web optimizados para conteúdo de animação
- Batch encoding com presets standard
- Jobs onde velocidade é mais importante que conformance rigorosa

**❌ Nunca usar HandBrakeCLI no Nexora para:**
- Perfil `nexora_broadcast_hd` — FFmpeg obrigatório
- Perfil `nexora_ott_premium` — FFmpeg obrigatório (CMAF/DRM)
- Qualquer output que vai para um playout system — FFmpeg obrigatório
- Qualquer output que precisa de conformidade AS-11 — FFmpeg obrigatório

**Por quê:** HandBrake não expõe `-sc_threshold 0` nem `-x264-params "open-gop=0"` com o mesmo nível de controlo que o FFmpeg CLI. Para proxies editoriais, um Open GOP ocasional é aceitável. Para broadcast, nunca.

## A.3 Alternativas GUI (para utilizadores que precisam de interface gráfica)

Estas ferramentas não são integradas no pipeline automático, mas são úteis para operadores que precisam de processar ficheiros manualmente ou verificar resultados.

**HandBrake GUI** (handbrake.fr)
- Interface gráfica do HandBrakeCLI
- Útil para operadores verificarem outputs ou processarem ficheiros isolados
- Não substituí o pipeline automático do Nexora

**Shutter Encoder** (shutter-encoder.com)
- GUI profissional sobre FFmpeg
- Suporta normalização de loudness, subtítulos, múltiplos formatos
- Útil para pré-processamento manual antes de ingest no Nexora
- Alternativa ao Adobe Media Encoder para tarefas manuais

**VLC Media Player** (videolan.org)
- Além de player, tem "Converter/Guardar" para transcodificações simples
- Útil para verificação rápida de ficheiros processados pelo Nexora
- Não recomendado para processamento em volume

**Avidemux** (avidemux.sourceforge.net)
- Editor de vídeo simples para cortes sem re-encode
- Útil para trimming lossless de ficheiros antes de ingest
- Suporta stream copy (sem degradação de qualidade)

---

# APÊNDICE B — CHEAT SHEET: COMANDOS FFMPEG NEXORA

## B.1 Comandos de Diagnóstico

```bash
# Analisar um ficheiro (informação completa)
ffprobe -v quiet -print_format json -show_format -show_streams input.mp4

# Verificar GOP structure (keyframes)
ffprobe -v quiet -select_streams v:0 \
  -show_frames -show_entries frame=pict_type,key_frame,pts_time \
  input.mp4 | grep -E "key_frame|pict_type"

# Verificar se é CFR ou VFR
ffprobe -v quiet -select_streams v:0 \
  -show_entries stream=r_frame_rate,avg_frame_rate,codec_name \
  -print_format json input.mp4

# Medir loudness (sem processar)
ffmpeg -i input.mp4 \
  -af "ebur128=peak=true" \
  -f null - 2>&1 | grep -E "Integrated|True peak"

# Verificar pixel format e colorimetry
ffprobe -v quiet -select_streams v:0 \
  -show_entries stream=pix_fmt,color_space,color_primaries,color_transfer \
  -print_format json input.mp4

# Gerar thumbnail rápido para preview
ffmpeg -i input.mp4 -ss 00:00:10 -frames:v 1 preview.jpg

# Verificar moov atom position (Fast Start check)
ffprobe -v trace input.mp4 2>&1 | grep -i "moov\|mdat" | head -5
# Se 'moov' aparece ANTES de 'mdat' → Fast Start OK
# Se 'moov' aparece DEPOIS de 'mdat' → NOT Fast Start → problema
```

## B.2 Transcode Nexora Broadcast HD (CPU)

```bash
# Determinar GOP size (sempre = fps * 2)
# Para 25fps: GOP = 50
# Para 29.97fps: GOP = 60
# Para 50fps: GOP = 100
# Para 59.94fps: GOP = 120

ffmpeg -y \
  -i "input.mp4" \
  -c:v libx264 \
  -preset slow \
  -tune film \
  -profile:v high \
  -level:v 4.1 \
  -pix_fmt yuv420p \
  -g 50 \
  -keyint_min 50 \
  -sc_threshold 0 \
  -flags +cgop \
  -x264-params "open-gop=0:bframes=0:ref=4:nal-hrd=cbr:force-cfr=1" \
  -b:v 8000k -maxrate 8000k -bufsize 16000k \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -r 25 -vsync cfr \
  -c:a pcm_s24le \
  -ar 48000 \
  -movflags +faststart \
  "output_broadcast.mp4"

# Verificar o output
ffprobe -v quiet -select_streams v:0 \
  -show_entries stream=codec_name,profile,level,pix_fmt,r_frame_rate,bit_rate \
  -print_format json output_broadcast.mp4
```

## B.3 Normalização EBU R128 Two-Pass

```bash
# PASSO 1: Análise (guardar o output JSON)
ffmpeg -i "input.mp4" \
  -af "loudnorm=I=-23:TP=-1:LRA=11:print_format=json" \
  -f null - 2>&1 | grep -A 12 '"input_i"'

# O output será algo assim:
# {
#   "input_i" : "-18.34",
#   "input_tp" : "-3.27",
#   "input_lra" : "7.45",
#   "input_thresh" : "-28.57",
#   "output_i" : "-23.04",
#   "output_tp" : "-4.02",
#   "output_lra" : "7.45",
#   "output_thresh" : "-33.42",
#   "normalization_type" : "linear",
#   "target_offset" : "-0.04"
# }

# PASSO 2: Normalização (substituir os valores pelos medidos no Passo 1)
ffmpeg -y -i "input.mp4" \
  -af "loudnorm=I=-23:TP=-1:LRA=11:\
measured_I=-18.34:\
measured_TP=-3.27:\
measured_LRA=7.45:\
measured_thresh=-28.57:\
offset=-0.04:\
linear=true" \
  -c:v copy \
  "output_normalized.mp4"

# VERIFICAÇÃO com BS1770GAIN (ferramenta independente)
bs1770gain --ebu --integrated --truepeak --xml output_normalized.mp4
# Deve mostrar: Integrated ≈ -23 LUFS, True Peak ≤ -1.0 dBTP
```

## B.4 VMAF Scoring Pós-Encode

```bash
# Comparar mezzanine (referência) com o encode
ffmpeg \
  -i "mezzanine_reference.mp4" \
  -i "nexora_encoded_output.mp4" \
  -lavfi "[0:v][1:v]libvmaf=\
log_fmt=json:\
log_path=/tmp/vmaf_result.json:\
n_subsample=5:\
model=version=vmaf_v0.6.1" \
  -f null -

# Ver resultado
cat /tmp/vmaf_result.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
mean = data['pooled_metrics']['vmaf']['mean']
p1   = data['pooled_metrics']['vmaf']['min']
print(f'VMAF Mean: {mean:.2f}')
print(f'VMAF Min (1st pct): {p1:.2f}')
print('Status:', 'PASS' if p1 >= 85 else 'FAIL')
"
```

## B.5 Geração de Thumbnails Sprite Sheet

```bash
# Gerar thumbnail a cada 10 segundos e organizar em grid 10x10
ffmpeg -i "input.mp4" \
  -vf "fps=0.1,scale=160:90,tile=10x10" \
  -frames:v 1 \
  "thumbnail_sprite.jpg"

# Gerar VTT para scrubbing no player
python3 - << 'EOF'
import subprocess, json, math

# Obter duração
result = subprocess.run(
    ['ffprobe', '-v', 'quiet', '-print_format', 'json',
     '-show_format', 'input.mp4'],
    capture_output=True, text=True
)
duration = float(json.loads(result.stdout)['format']['duration'])

interval = 10  # segundos entre thumbnails
thumb_w, thumb_h = 160, 90
cols = 10

with open('thumbnails.vtt', 'w') as f:
    f.write('WEBVTT\n\n')
    for i, t in enumerate(range(0, int(duration), interval)):
        col = i % cols
        row = i // cols
        x, y = col * thumb_w, row * thumb_h
        ts_start = f'{t//3600:02d}:{(t%3600)//60:02d}:{t%60:02d}.000'
        ts_end_s = min(t + interval, int(duration))
        ts_end = f'{ts_end_s//3600:02d}:{(ts_end_s%3600)//60:02d}:{ts_end_s%60:02d}.000'
        f.write(f'{ts_start} --> {ts_end}\n')
        f.write(f'thumbnail_sprite.jpg#xywh={x},{y},{thumb_w},{thumb_h}\n\n')

print('thumbnails.vtt gerado com sucesso')
EOF
```

---

# APÊNDICE C — CHEAT SHEET: REGRAS QC BROADCAST

## C.1 Tabela de Conformidade

| Parâmetro | Valor obrigatório | Valor problemático | Acção |
|---|---|---|---|
| Frame rate mode | CFR | VFR | TRANSCODE obrigatório |
| GOP type | Closed | Open | TRANSCODE obrigatório |
| Keyframe type | IDR | I-frame simples | TRANSCODE obrigatório |
| sc_threshold | 0 (sem keyframes extra) | Qualquer outro | TRANSCODE obrigatório |
| B-frames | 0 (broadcast linear) | > 0 | TRANSCODE obrigatório |
| Pixel format | yuv420p | yuv422p, yuv444p | TRANSCODE obrigatório |
| GOP size | fps × 2 (ex: 50 @ 25fps) | Qualquer outro | TRANSCODE obrigatório |
| Audio sample rate | 48000 Hz | 44100 Hz | NORMALIZAR |
| Loudness integrado | -23 LUFS ±0.5 (broadcast) | Desvio > 1 LU | NORMALIZAR |
| True Peak | ≤ -1.0 dBTP | > -1.0 dBTP | NORMALIZAR |
| moov atom | Início do ficheiro (Fast Start) | No final | REMUX |
| Color space (HD) | BT.709 | BT.601 (SD) | TRANSCODE + color convert |

## C.2 Perfis de Loudness por Destino

| Destino | Loudness Integrado | True Peak | Standard |
|---|---|---|---|
| Broadcast EU (RTP, SIC, TVI...) | -23 LUFS ±0.5 | -1 dBTP | EBU R128 |
| Broadcast US | -24 LUFS ±0.5 | -2 dBTP | ATSC A/85 |
| Netflix / Amazon Prime | -14 LUFS ±1 | -2 dBTP | OTT spec |
| YouTube | -14 LUFS (normaliza automaticamente) | -1 dBTP | YouTube spec |
| Spotify Podcasts | -16 LUFS ±1 | -1 dBTP | Spotify spec |
| Apple Podcasts | -16 LUFS ±1 | -1 dBTP | Apple spec |

---

# APÊNDICE D — TROUBLESHOOTING GUIA

## D.1 Problemas Comuns e Soluções

### "O vídeo tem artefactos no player depois do transcode"

**Causa provável:** Open GOP ou B-frames no output.

Verificar:
```bash
ffprobe -v quiet -select_streams v:0 \
  -show_frames -show_entries frame=pict_type,key_frame \
  output.mp4 | grep "key_frame=1" | head -20
```

Se vires `pict_type=I` mas `key_frame=0` → I-frame que não é IDR. Confirmar parâmetros FFmpeg têm `-flags +cgop` e `-x264-params "open-gop=0"`.

---

### "O áudio está muito alto / muito baixo após normalização"

**Causa provável:** O Pass 2 não usou os valores medidos do Pass 1, ou `linear=true` não foi especificado.

Verificar o output do Pass 1 e garantir que os campos `measured_I`, `measured_TP`, `measured_LRA`, `measured_thresh` e `offset` foram passados ao Pass 2 com os valores EXACTOS do JSON de análise.

---

### "O ficheiro não carrega no browser / streaming player"

**Causa provável:** moov atom no final do ficheiro (sem Fast Start).

Diagnóstico:
```bash
ffprobe -v trace input.mp4 2>&1 | grep -E "moov|mdat" | head -3
```
Se `mdat` aparecer antes de `moov` → problema. Corrigir:
```bash
ffmpeg -i input.mp4 -c copy -movflags +faststart output_fixed.mp4
```

---

### "VMAF muito baixo (< 70) mesmo com bitrate alto"

**Causa provável:** A referência (mezzanine) não é a versão correcta, ou há um problema de resolução/color space entre referência e encode.

Verificar:
1. Ambos os ficheiros têm a mesma resolução (`ffprobe -show_streams`)
2. Ambos os ficheiros têm o mesmo pixel format
3. A referência é a versão ANTES do encode atual, não uma versão já comprimida

---

### "Workers ficam parados sem processar"

**Causa provável:** Redis não está a correr, ou a fila BullMQ está num estado bloqueado.

Diagnóstico:
```bash
docker compose ps          # verificar se redis está running
docker compose logs redis  # ver logs do Redis
npm run queue:flush        # limpar a fila (ATENÇÃO: perde jobs pendentes)
```

---

### "FFmpeg termina com código de saída não-zero mas não há erro visível"

**Causa provável:** O ficheiro de input está corrompido ou truncado.

Diagnóstico:
```bash
ffmpeg -v error -i input.mp4 -f null - 2>errors.txt
cat errors.txt
```

Se mostrar `moov atom not found` → o MP4 está corrompido.
Se mostrar `Invalid data found` → o stream está truncado ou corrompido.
→ Acção: REJECT o ficheiro, notificar operador.

---

# APÊNDICE E — SIZING GUIDE

## E.1 Hardware Mínimo para Produção

| Configuração | CPU | RAM | Disco | GPU | Capacidade |
|---|---|---|---|---|---|
| **Dev / Teste** | 4 cores | 8 GB | 100 GB SSD | Não necessária | 2-3 jobs simultâneos |
| **Produção Pequena** | 8 cores | 32 GB | 1 TB SSD | NVIDIA RTX 3060 | 4-6 jobs simultâneos |
| **Produção Média** | 16 cores | 64 GB | 2 TB NVMe | NVIDIA RTX 4070 | 8-12 jobs simultâneos |
| **Produção Grande** | 32 cores | 128 GB | 4 TB NVMe | NVIDIA RTX 4090 | 16-24 jobs simultâneos |

## E.2 Estimativas de Tempo de Transcode

Tempos aproximados para 1 hora de conteúdo HD 1080p:

| Perfil Nexora | CPU (8 cores) | GPU (RTX 3060) | GPU (RTX 4090) |
|---|---|---|---|
| nexora_broadcast_hd | ~45 min | ~12 min | ~5 min |
| nexora_ott_premium (H.265) | ~90 min | ~20 min | ~8 min |
| nexora_streaming_web | ~20 min | ~8 min | ~3 min |
| nexora_proxy_lowres | ~8 min | ~3 min | ~1.5 min |
| VMAF scoring | ~15 min | N/A (CPU) | N/A (CPU) |

*Tempos estimados. Dependem do conteúdo (complexidade), bitrate alvo e preset de velocidade.*

## E.3 Estimativas de Armazenamento

Por 1 hora de conteúdo processado (todos os outputs):

| Output | Tamanho aproximado |
|---|---|
| nexora_broadcast_hd (MP4, 8 Mbps) | ~3.6 GB |
| nexora_broadcast_hd (MXF) | ~4.0 GB |
| nexora_ott_premium (H.265 CMAF) | ~2.0 GB |
| nexora_streaming_web (ladder 3 qualidades) | ~3.0 GB |
| nexora_proxy_lowres | ~360 MB |
| nexora_archive (ProRes 4444) | ~75 GB |
| Thumbnail sprites | ~5 MB |
| **Total sem archive** | **~13 GB / hora** |
| **Total com archive** | **~88 GB / hora** |

---

# APÊNDICE F — VARIÁVEIS DE AMBIENTE (.env COMPLETO)

```bash
# ─── Base de dados ───────────────────────────────────────
DATABASE_URL=postgresql://nexora:change_me@postgres:5432/nexora_media
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# ─── Redis / Queue ──────────────────────────────────────
REDIS_URL=redis://redis:6379
BULLMQ_PREFIX=nexora
QUEUE_DEFAULT_ATTEMPTS=3
QUEUE_BACKOFF_DELAY_MS=1000

# ─── MinIO / Storage ────────────────────────────────────
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=nexoraadmin
MINIO_SECRET_KEY=change_in_production
MINIO_BUCKET_INPUT=nexora-input
MINIO_BUCKET_OUTPUT=nexora-output
MINIO_BUCKET_TEMP=nexora-temp

# ─── Temporal.io ────────────────────────────────────────
TEMPORAL_ADDRESS=temporal:7233
TEMPORAL_NAMESPACE=nexora-production
TEMPORAL_TASK_QUEUE=nexora-media-tasks

# ─── Auth ───────────────────────────────────────────────
JWT_PRIVATE_KEY_PATH=/secrets/jwt_private.pem
JWT_PUBLIC_KEY_PATH=/secrets/jwt_public.pem
JWT_ALGORITHM=RS256
JWT_ACCESS_TOKEN_EXPIRY=1h
JWT_API_TOKEN_EXPIRY=24h

# ─── Media processing ───────────────────────────────────
NEXORA_INPUT_DIR=/media/input
NEXORA_OUTPUT_DIR=/media/output
NEXORA_TEMP_DIR=/media/temp
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe
MEDIAINFO_PATH=/usr/bin/mediainfo
MEDIACONCH_PATH=/usr/bin/mediaconch
BS1770GAIN_PATH=/usr/bin/bs1770gain
HANDBRAKE_CLI_PATH=/usr/bin/HandBrakeCLI
HANDBRAKE_PRESETS_FILE=/app/config/nexora-presets.json

# ─── Job limits ─────────────────────────────────────────
MAX_CONCURRENT_TRANSCODE_JOBS=4
MAX_CONCURRENT_AUDIO_JOBS=8
MAX_CONCURRENT_PROXY_JOBS=4
FFMPEG_DEFAULT_TIMEOUT_MS=14400000
FFMPEG_SIGTERM_WAIT_MS=5000
MAX_UPLOAD_SIZE_BYTES=53687091200

# ─── Loudness targets ───────────────────────────────────
LOUDNESS_TARGET_BROADCAST_LUFS=-23
LOUDNESS_TARGET_STREAMING_LUFS=-14
LOUDNESS_TRUE_PEAK_LIMIT_DBTP=-1.0
LOUDNESS_TOLERANCE_LU=0.5

# ─── VMAF thresholds ────────────────────────────────────
VMAF_THRESHOLD_ARCHIVE=93
VMAF_THRESHOLD_BROADCAST=90
VMAF_THRESHOLD_STREAMING=85
VMAF_THRESHOLD_PROXY=70

# ─── Observabilidade ────────────────────────────────────
LOG_LEVEL=info
PROMETHEUS_PORT=9100
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
OTEL_SERVICE_NAME=nexora-media-processing

# ─── Alertas ────────────────────────────────────────────
ALERTMANAGER_WEBHOOK_URL=https://alerts.internal/nexora
SLACK_ALERT_WEBHOOK_URL=https://hooks.slack.com/services/...
PAGERDUTY_INTEGRATION_KEY=...

# ─── API ────────────────────────────────────────────────
PORT=3000
NODE_ENV=production
API_VERSION=v1
RATE_LIMIT_USER_RPM=1000
RATE_LIMIT_API_RPM=5000

# ─── Data governance ────────────────────────────────────
ASSET_RETENTION_DAYS=90
AUDIT_LOG_RETENTION_MONTHS=24
```

---

# APÊNDICE G — GLOSSÁRIO TÉCNICO

Para utilizadores que encontram termos desconhecidos no documento.

| Termo | Definição simples |
|---|---|
| **GOP** | Grupo de imagens — pacote de frames de vídeo que formam uma unidade independente |
| **IDR frame** | Frame especial que permite ao decoder começar do zero sem depender do que veio antes |
| **CFR** | Constant Frame Rate — o vídeo tem sempre o mesmo número de frames por segundo |
| **VFR** | Variable Frame Rate — o número de frames por segundo varia (problemático em broadcast) |
| **B-frame** | Tipo de frame que depende de informação do passado E do futuro — problemático em playout linear |
| **LUFS** | Unidade de medida de loudness (volume percebido) — Loudness Units Full Scale |
| **True Peak** | Pico máximo do sinal de áudio após reconstrução analógica — mais rigoroso que peak simples |
| **EBU R128** | Standard europeu de normalização de loudness de áudio |
| **VMAF** | Mérica de qualidade de vídeo desenvolvida pela Netflix — mais precisa que PSNR/SSIM |
| **MXF** | Material eXchange Format — formato de contentor para broadcast profissional |
| **CMAF** | Common Media Application Format — formato unificado para HLS e DASH streaming |
| **DRM** | Digital Rights Management — protecção de conteúdo contra cópia |
| **Widevine** | Sistema DRM da Google (Android, Chrome) |
| **FairPlay** | Sistema DRM da Apple (iOS, macOS, Safari) |
| **AS-11** | Standard de entrega para broadcasters britânicos (BBC, ITV, Channel 4) |
| **IMF** | Interoperable Master Format — standard de masters de arquivo para OTT (Netflix, Amazon) |
| **Temporal.io** | Sistema de orquestração de workflows com estado, retry e histórico |
| **BullMQ** | Sistema de filas de jobs baseado em Redis para Node.js |
| **Prometheus** | Sistema de colecção de métricas de produção |
| **Grafana** | Dashboard para visualização de métricas |
| **SCTE-35** | Standard para inserção de marcadores de anúncios em streams de vídeo |
| **yuv420p** | Formato de pixel — 4:2:0 chroma subsampling, obrigatório para compatibilidade máxima |
| **Fast Start** | Optimização MP4 onde o moov atom fica no início do ficheiro para streaming imediato |
| **Mezzanine** | Ficheiro de alta qualidade usado como referência/master antes do encode final |
| **Proxy** | Versão de baixa resolução usada para edição e preview sem usar o ficheiro master |

---

*Nexora Media Processing — Documentação Técnica Completa.*  
*Versão 2.0 — Stack 100% open source — Broadcast & OTT Grade.*
