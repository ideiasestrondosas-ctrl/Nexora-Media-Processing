# Media Processing Hub
## Especificação Técnica Completa — v2.0

> Documento consolidado e reestruturado a partir da análise original (GPT/Gemini) com correções técnicas, adições de standards de indústria e arquitetura de produção.

---

# PARTE I — DIAGNÓSTICO DO SISTEMA ATUAL

## 1.1 O que está bem

A base do sistema demonstra maturidade em três áreas:

**Filosofia de "gatekeeper"** — a decisão de rejeitar conteúdo não conforme antes do processamento é a abordagem correta. A maioria dos problemas em emissão ao vivo tem origem em conteúdo que entrou no pipeline sem validação adequada.

**Normalização antes do playout** — forçar normalização de audio e formato antes de qualquer saída evita 80% dos incidentes técnicos em emissão. Esta decisão de design é sólida.

**Consciência de LUFS** — ter métricas de loudness no sistema é o ponto de partida correto. A implementação precisa de ser corrigida (ver 2.2), mas a intenção é a certa.

## 1.2 Erros técnicos críticos identificados

### Erro 1 — GOP "fixo" sem Closed GOP e IDR frames

Forçar um GOP de tamanho fixo não é suficiente. Em broadcast e OTT existem três requisitos distintos que têm de ser cumpridos simultaneamente:

**Closed GOP** — cada grupo de imagens tem de ser autossuficiente, sem referências cruzadas para o GOP anterior ou seguinte. Um Open GOP permite que frames B de um GOP referenciem frames I do GOP seguinte, o que causa falhas de decodificação em switching e seeking.

**IDR frames** (Instantaneous Decoder Refresh) — não são o mesmo que I-frames. Um IDR frame garante que o decoder reseta completamente o estado, enquanto um I-frame simples pode ainda depender de informação anterior no buffer. Em playout com switching ou recuperação de falhas, apenas IDR frames garantem arranque limpo.

**Alinhamento com segmentos** — o tamanho do GOP tem de ser divisor exato da duração do segmento HLS/DASH. Se o segmento é de 4 segundos a 25fps (100 frames), o GOP tem de ser 25, 50 ou 100 frames. Um GOP de 48 frames num segmento de 100 frames produz fracturas de segmento que causam artefactos visíveis no player.

Parâmetros FFmpeg corretos:
```bash
-g 50 -keyint_min 50 -sc_threshold 0 -flags +cgop -bf 0 -x264-params "open-gop=0"
```

Sem `-sc_threshold 0`, o FFmpeg insere keyframes extra em mudanças de cena, quebrando o GOP fixo silenciosamente.

### Erro 2 — LUFS sem True Peak limiting

O standard EBU R128 define dois parâmetros obrigatórios que são frequentemente confundidos:

**Loudness integrado** — medição da energia sonora percebida ao longo de toda a duração do ficheiro. Alvo: -23 LUFS para broadcast europeu, -16 LUFS para broadcast americano (ATSC A/85), -14 LUFS para streaming (Spotify, YouTube, Apple Music).

**True Peak** — o pico máximo do sinal após reconstrução analógica. Não é o mesmo que peak de sample. O True Peak usa oversampling de 4x para detetar inter-sample peaks que o peak de amostra simples não vê. Um ficheiro com sample peak de -1 dBFS pode ter True Peak de +0.5 dBTP, causando clipping no DAC do recetor. O limite correto é -1 dBTP (True Peak), não -1 dBFS.

Parâmetros FFmpeg corretos para dois-pass loudness normalization:
```bash
# Pass 1 — análise
ffmpeg -i input.mp4 -af "loudnorm=I=-23:TP=-1:LRA=11:print_format=json" -f null -

# Pass 2 — normalização com valores medidos
ffmpeg -i input.mp4 -af "loudnorm=I=-23:TP=-1:LRA=11:\
  measured_I=-18.3:measured_TP=-2.1:measured_LRA=9.2:\
  measured_thresh=-28.7:offset=-4.3:linear=true" output.mp4
```

O modo `linear=true` aplica ganho linear quando possível, preservando a dinâmica original. O modo não-linear (padrão) aplica compressão dinâmica, que altera o caráter do som.

### Erro 3 — MP4 tratado como formato universal

MP4 é um formato de entrega web. Em contexto profissional existem três níveis de contentor com propósitos distintos:

| Nível | Formato | Uso |
|---|---|---|
| Master de arquivo | MXF OP1a (AS-11), IMF | Preservação, re-versioning, re-edit |
| Ingest broadcast | MXF OP1a, MPEG-TS | Playout systems (Harmonic, Grass Valley, Avid) |
| Distribuição OTT | CMAF (fMP4), MPEG-TS | HLS, DASH, streaming |
| Distribuição web | MP4 (Fast Start) | Browser players, download |

Um sistema que só produz MP4 não consegue servir um playout system broadcast, não tem conformance para entrega a broadcasters europeus (AS-11 UK DPP obrigatório para BBC/ITV/Channel 4), e não suporta packaging DRM correto.

O MP4 obrigatório tem de ter o **moov atom no início do ficheiro** (Fast Start / Web Optimized), caso contrário players web têm de descarregar o ficheiro inteiro antes de começar a reproduzir.

```bash
ffmpeg -i input.mp4 -movflags +faststart output.mp4
```

---

# PARTE II — STANDARDS DA INDÚSTRIA

## 2.1 Standards de encoding

### H.264 / AVC para broadcast e OTT

```
Perfil:        High Profile (compatibilidade máxima)
Level:         4.1 (HD 1080p) / 5.1 (4K)
Pixel format:  yuv420p  ← obrigatório, nunca yuv422p ou yuv444p para distribuição
Colorimetry:   bt709 (HD), bt2020 (HDR)
GOP:           Closed, IDR-only keyframes, alinhado com segmento
B-frames:      0 para linear broadcast / até 2 para file-based VoD
VBV buffer:    = 2× bitrate target (controlo de buffer para STB compatibility)
```

### H.265 / HEVC

```
Perfil:        Main (SDR) / Main 10 (HDR)
Tier:          Main (até 40 Mbps) / High (acima de 40 Mbps)
GOP:           Mesmas regras que H.264
Pixel format:  yuv420p (SDR) / yuv420p10le (HDR/10-bit)
```

### Audio codecs

```
Broadcast:    Dolby E, PCM 24-bit (mezzanine) / Dolby Digital (AC-3) 5.1 (entrega)
OTT premium:  Dolby Digital Plus (E-AC-3) / Dolby Atmos
Streaming:    AAC-LC 192kbps (stereo), AAC-LC 384kbps (5.1)
Loudness:     EBU R128 / ATSC A/85 / ITU-R BS.1770-4
```

## 2.2 Standards de qualidade

### EBU R128 (loudness)

| Target | Loudness Integrado | True Peak | LRA máx |
|---|---|---|---|
| Broadcast EU | -23 LUFS | -1 dBTP | 20 LU |
| Broadcast US | -24 LUFS | -2 dBTP | 20 LU |
| Streaming | -14 LUFS | -1 dBTP | — |
| Podcast | -16 LUFS | -1 dBTP | — |

### VMAF (qualidade perceptual)

VMAF (Video Multi-method Assessment Fusion) é a métrica desenvolvida pela Netflix que melhor correlaciona com a perceção humana de qualidade de vídeo, superior a PSNR e SSIM.

| Contexto | Score mínimo |
|---|---|
| Arquivo / master | ≥ 93 |
| Broadcast / OTT premium | ≥ 90 |
| Streaming adaptativo (topo da ladder) | ≥ 85 |
| Streaming adaptativo (fundo da ladder) | ≥ 70 |

Integração no pipeline pós-encode:
```bash
ffmpeg -i reference.mp4 -i encoded.mp4 \
  -lavfi "[0:v][1:v]libvmaf=log_fmt=json:log_path=vmaf_result.json" \
  -f null -
```

## 2.3 Standards de entrega

### AS-11 UK DPP (Digital Production Partnership)
Perfil de entrega obrigatório para broadcasters britânicos. Define:
- Contentor: MXF OP1a
- Vídeo: AVC Intra / XDCAM HD 422
- Audio: PCM 24-bit, 8 canais mínimo
- Closed captions: CEA-708 embebido ou sidecar TTML
- Metadata: XML sidecar conforme DPP spec

### IMF (Interoperable Master Format) — SMPTE ST 2067
Standard moderno para masters de arquivo OTT. Usado por Netflix, Amazon, Disney+.
- Contentor: MXF OP1a em pacote CPL (Composition Playlist)
- Suporta múltiplas versões (idiomas, ratings, aspect ratios) sem re-encode
- Metadata: IMSC1 para legendas, SMPTE timecode frame-accurate

### CMAF (Common Media Application Format) — ISO 23000-19
Formato unificado para HLS e DASH. Elimina a necessidade de dois packagings separados.
- Contentor: fMP4 (fragmented MP4)
- Encriptação: `cbcs` (Apple/FairPlay compatível) ou `cenc` (Widevine/PlayReady)
- Segmentos: 2s ou 4s, alinhados com GOP

---

# PARTE III — ARQUITETURA EM 6 CAMADAS

## Camada 1 — Ingest

**Objetivo:** Receção de conteúdo de múltiplas origens com identificação e deduplicação.

### Origens suportadas
- Watch folder local com inotify/FSEvents
- API HTTP/S com autenticação JWT
- S3-compatible (AWS S3, MinIO, Wasabi)
- FTP/SFTP com polling configurável
- Live ingest via RTMP/SRT (para conteúdo ao vivo)
- Aspera FASP para transferências de alta velocidade de longa distância

### Deduplicação
Duas camadas de dedup devem ser implementadas em sequência:

**Dedup por hash criptográfico** — SHA-256 do ficheiro completo. Deteta duplicados exatos.

**Dedup perceptual** — fingerprint de conteúdo baseado em features visuais e de áudio (ex: Chromaprint para áudio, pHash para vídeo). Deteta re-encodes do mesmo conteúdo.

### Metadados de ingest
Cada ficheiro recebe um Asset ID único (UUID v4) e um registo de proveniência:
```json
{
  "asset_id": "a1b2c3d4-...",
  "source": "watch_folder",
  "ingest_timestamp": "2025-01-15T14:32:00Z",
  "original_filename": "episodio_01_raw.mp4",
  "sha256": "e3b0c44298fc1c149afb...",
  "file_size_bytes": 4294967296,
  "ingest_operator": "system"
}
```

---

## Camada 2 — QC & Validação

**Objetivo:** Garantir que nenhum ficheiro não-conforme avança no pipeline.

### 2.1 Análise técnica

Usar **MediaInfo** e **FFprobe** em conjunto — não são redundantes. MediaInfo é mais fiável em container parsing, FFprobe em stream-level analysis. Discrepâncias entre os dois são um sinal de alerta.

Campos obrigatórios a verificar:

```
Vídeo:
  - Codec (H.264/H.265)
  - Perfil e Level
  - Pixel format (deve ser yuv420p)
  - Frame rate (deve ser CFR — Constant Frame Rate)
  - Resolution (verificar contra perfis aceites)
  - Color space / Color primaries / Transfer characteristics
  - Bit depth (8-bit SDR, 10-bit HDR)
  - GOP structure (presença de B-frames, Open/Closed GOP)
  - Duração declarada vs duração real (deteção de truncamento)

Áudio:
  - Codec
  - Sample rate (48000 Hz obrigatório para broadcast)
  - Bit depth (mínimo 16-bit, preferível 24-bit)
  - Número de canais e layout
  - Sync desvio áudio/vídeo (< 20ms tolerável, < 5ms para broadcast)

Container:
  - Conformance MXF/MP4/MPEG-TS
  - moov atom position (MP4 Fast Start check)
  - Edit lists (presença de edit lists suspeitas em MP4)
  - Timecode tracks
```

### 2.2 Conformance checking formal

Para perfis de entrega broadcast, usar **MediaConch** com regras de conformance formais:
```bash
mediaconch --policy=AS11_UK_DPP.xml --format=json input.mxf
```

### 2.3 Content QC

**Black frames** — deteção de frames com brilho médio < 16 (escala 0-255). Sequências de black > 2 frames no início/fim são aceitáveis; no meio do conteúdo são um erro.

**Freeze frames** — deteção de frames idênticas consecutivas. Tolerância: 0 frames idênticas em sequência > 1s fora de créditos.

**Flash detection** — conformance com Harding FPA (Photosensitive Epilepsy Analysis). Obrigatório para broadcast. Ferramenta de referência: Harding Flash and Pattern Analyzer.

**Telecine detection** — conteúdo 23.976fps com 3:2 pulldown inserido precisa de inverse telecine antes de qualquer processamento.

### 2.4 Decisões de QC

```
PASS        → avança para Camada 3
QUARANTINE  → ficheiro isolado para revisão humana, notificação enviada
REJECT      → ficheiro rejeitado, log detalhado com reason codes, notificação enviada
```

Todos os resultados de QC são escritos num registo imutável (append-only log com timestamp e asset_id).

---

## Camada 3 — Intelligence

**Objetivo:** Analisar o conteúdo e tomar decisões automáticas de encoding sem intervenção humana.

### 3.1 Classificação de conteúdo

```
Talking head   → low motion complexity, alto detail estático
Desporto       → high motion, low spatial complexity
Cinema         → mixed, grain, low bitrate per scene
Animation      → very low complexity, beneficia muito de CRF encoding
News           → similar a talking head mas com lower-thirds
```

A classificação usa análise de:
- Spatial Information (SI) — complexidade espacial frame a frame
- Temporal Information (TI) — movimento entre frames
- Scene change frequency

### 3.2 Per-Title Encoding (bitrate ladder dinâmica)

Em vez de uma ladder fixa (720p/3Mbps, 1080p/6Mbps), o per-title encoding calibra a ladder para cada título:

1. **Pilot encode** — encode de 1-2 minutos representativos a múltiplos CRF values
2. **VMAF calibration** — medir VMAF por CRF value para este conteúdo específico
3. **Ladder decision** — determinar o bitrate mínimo que atinge o target VMAF em cada resolução
4. **Full encode** — encode completo com parâmetros calibrados

Resultado típico: conteúdo de baixa complexidade (talking head) pode atingir VMAF 93 a 1.5 Mbps em 1080p, enquanto desporto pode necessitar de 6 Mbps para o mesmo score.

### 3.3 Profile selector

```yaml
profiles:
  broadcast:
    container: mxf_op1a
    video_codec: h264
    profile: high
    level: "4.1"
    gop: closed_idr
    gop_size: 50
    bframes: 0
    audio: pcm_s24le
    loudness_target: -23
    true_peak_limit: -1

  ott_premium:
    container: cmaf
    video_codec: h265
    profile: main10
    gop: closed_idr
    drm: [widevine, fairplay, playready]
    audio: eac3
    loudness_target: -14
    true_peak_limit: -1

  streaming_web:
    container: mp4_faststart
    video_codec: h264
    profile: high
    level: "4.0"
    gop: closed_idr
    audio: aac_lc
    loudness_target: -14
    true_peak_limit: -1

  archive:
    container: mxf_op1a
    video_codec: prores_4444
    audio: pcm_s24le
    vmaf_minimum: 93
    checksum: sha256
```

---

## Camada 4 — Processing (Workers Distribuídos)

**Objetivo:** Execução paralela e resiliente de todas as tarefas de processamento.

### 4.1 Orquestração de workflows

**Temporal.io** é a escolha correta para um Media Processing Hub. Diferença em relação a filas simples:

| Redis/RabbitMQ | Temporal.io |
|---|---|
| Fire-and-forget | Workflow stateful com histórico completo |
| Retry manual | Retry automático com backoff exponencial |
| Sem visibilidade de estado | Dashboard com estado de cada step |
| Sem timeout por step | Timeout configurável por atividade |
| Dead-letter manual | Dead-letter automático com replay |

Exemplo de workflow Temporal para um asset:
```
workflow: process_asset(asset_id)
  → activity: validate_qc()          timeout: 5min, retry: 3
  → activity: analyze_content()      timeout: 10min, retry: 2
  → parallel:
      → activity: transcode_video()  timeout: 4h, retry: 2
      → activity: normalize_audio()  timeout: 30min, retry: 3
      → activity: process_captions() timeout: 20min, retry: 2
  → activity: generate_proxies()     timeout: 1h, retry: 2
  → activity: generate_thumbnails()  timeout: 10min, retry: 2
  → activity: package_drm()         timeout: 30min, retry: 2
  → activity: qc_post_encode()      timeout: 30min, retry: 1
  → activity: deliver()             timeout: 2h, retry: 3
```

### 4.2 Isolamento do FFmpeg

FFmpeg não deve ser executado diretamente no processo principal. Problemas comuns:
- Memory leaks em long-running processes
- Crashes que matam o worker inteiro
- Bloqueios em streams corrompidos sem timeout

Solução: cada job FFmpeg é executado num processo filho isolado com:
- Timeout máximo por job (configurable, ex: 4h para transcode full HD)
- Kill automático ao timeout com SIGTERM → SIGKILL
- Capture de stderr para log estruturado
- Exit code parsing para deteção de erro vs warning

```python
async def run_ffmpeg(cmd: list[str], timeout_s: int = 14400) -> FFmpegResult:
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(), timeout=timeout_s
        )
    except asyncio.TimeoutError:
        proc.kill()
        raise FFmpegTimeoutError(f"Job exceeded {timeout_s}s")
    
    return FFmpegResult(
        returncode=proc.returncode,
        stderr=parse_ffmpeg_stderr(stderr.decode()),
        success=proc.returncode == 0
    )
```

Para produção de alto volume, FFmpeg em containers Docker com resource limits é o standard:
```yaml
resources:
  limits:
    memory: "8Gi"
    cpu: "4"
  requests:
    memory: "4Gi"
    cpu: "2"
```

### 4.3 Transcode

**Regras absolutas de encoding broadcast:**

```bash
# H.264 broadcast-safe (25fps PAL)
ffmpeg -i input \
  -c:v libx264 \
  -profile:v high -level:v 4.1 \
  -pix_fmt yuv420p \
  -g 50 -keyint_min 50 \     # GOP = 2s @ 25fps
  -sc_threshold 0 \           # sem keyframes extra em scene cuts
  -flags +cgop \              # Closed GOP
  -x264-params "open-gop=0:bframes=0:ref=4:nal-hrd=cbr" \
  -b:v 8000k -maxrate 8000k -bufsize 16000k \  # CBR com VBV
  -r 25 -vsync cfr \          # CFR obrigatório
  -c:a aac -b:a 256k -ar 48000 \
  -movflags +faststart \
  output.mp4
```

**Pixel format** — `yuv420p` é obrigatório para compatibilidade máxima. `yuv422p` e `yuv444p` não são suportados por muitos decoders de hardware e STBs. Conteúdo 10-bit deve usar `yuv420p10le`.

**Color space tagging** — obrigatório para display correto:
```bash
-colorspace bt709 -color_primaries bt709 -color_trc bt709   # HD SDR
-colorspace bt2020nc -color_primaries bt2020 -color_trc smpte2084  # HDR10/PQ
-colorspace bt2020nc -color_primaries bt2020 -color_trc arib-std-b67  # HLG
```

### 4.4 HDR / SDR

O pipeline tem de suportar conversão bidirecional:

**SDR → HDR uplift** — não recomendado sem material criativo original HDR. Em casos de arquivo:
- HLG uplift para broadcast (BBC, NHK standard)
- Tone mapping com LUT criativa (Hable, Reinhard)

**HDR → SDR tone mapping** — obrigatório para garantir compatibilidade com displays SDR:
```bash
-vf "zscale=t=linear:npl=100,\
     format=gbrpf32le,\
     zscale=p=bt709,\
     tonemap=hable:desat=0,\
     zscale=t=bt709:m=bt709:r=tv,\
     format=yuv420p"
```

### 4.5 Legendas e Closed Captions

Formatos suportados e conversões necessárias:

| Formato de entrada | Formato de saída | Uso |
|---|---|---|
| SRT | TTML/IMSC1 | Broadcast EU, AS-11 |
| SRT | WebVTT | HLS/DASH players |
| SRT | CEA-708 | Broadcast US, embebido |
| TTML | SRT | Trabalho editorial |
| EBU STL | TTML | Arquivo broadcast EU |

**Burn-in** deve ser suportado como opção para:
- Outputs de arquivo em versão "textless"
- SDHi (Subtitles for the Deaf and Hard of Hearing) em alguns mercados
- Versões de segurança para conteúdo em que a track de legendas pode ser perdida

### 4.6 DRM

**Multi-DRM** é obrigatório para OTT. Os três DRM systems cobrem 100% dos devices:

| DRM | Plataformas | Protocolo |
|---|---|---|
| Widevine | Android, Chrome, Chromecast, SmartTV | CENC |
| PlayReady | Windows, Xbox, Edge, SmartTV | CENC |
| FairPlay | iOS, macOS, Safari, Apple TV | CBCS |

**Key Management** via SPEKE (Secure Packager and Encoder Key Exchange) ou integração direta com AWS MediaConvert / Axinom / EzDRM.

Packaging CMAF com multi-DRM:
```bash
packager \
  "in=video.mp4,stream=video,output=video_enc.mp4" \
  "in=audio.mp4,stream=audio,output=audio_enc.mp4" \
  --enable_widevine_encryption \
  --enable_playready_encryption \
  --protection_scheme cbcs \
  --keys label=:key=<key_hex>:key_id=<kid_hex> \
  --hls_master_playlist_output playlist.m3u8 \
  --mpd_output manifest.mpd
```

### 4.7 Proxy Workflow

Três tipos de proxy com propósitos distintos:

```
Proxy LowRes:
  Codec:      H.264 High Profile
  Resolution: 1280×720 (ou 640×360 para conteúdo SD)
  Bitrate:    800 kbps
  Audio:      AAC 128kbps
  Uso:        Revisão remota, aprovação editorial, MAM preview

Proxy Mezzanine:
  Codec:      Apple ProRes 422 HQ ou DNxHD 145
  Resolution: Full resolution do master
  Uso:        Edição local de alta qualidade, color grading

Thumbnail Sprite Sheet:
  Formato:    JPEG grid (ex: 10×10 = 100 thumbnails)
  Intervalo:  1 thumbnail por 10 segundos
  VTT:        Sidecar WebVTT com timestamps e coordenadas de sprite
  Uso:        Player scrubbing (hover na timeline)
```

Geração de sprite sheet + VTT:
```bash
# Gerar thumbnails a cada 10s
ffmpeg -i input.mp4 -vf "fps=0.1,scale=160:90,tile=10x10" \
  -frames:v 1 sprite_%03d.jpg

# Gerar VTT com coordenadas
python generate_sprite_vtt.py \
  --input sprite_%03d.jpg \
  --interval 10 \
  --tile-cols 10 \
  --output thumbnails.vtt
```

---

## Camada 5 — QC Pós-encode

**Objetivo:** Verificar que o output do encoding cumpre os requisitos antes da entrega.

### 5.1 VMAF scoring

```bash
ffmpeg -i source_mezzanine.mp4 -i encoded_output.mp4 \
  -lavfi "[0:v][1:v]libvmaf=log_fmt=json:log_path=vmaf.json:n_subsample=5" \
  -f null -
```

O parâmetro `n_subsample=5` analisa 1 em cada 5 frames, reduzindo o tempo de análise em 80% com impacto negligenciável na precisão.

Decisão automática:
```python
if vmaf_score >= VMAF_THRESHOLD[profile]:
    advance_to_delivery()
elif vmaf_score >= VMAF_THRESHOLD[profile] - 2:
    flag_for_review()  # warning, mas avança
else:
    reject_and_requeue()  # re-encode com parâmetros ajustados
```

### 5.2 Verificação de integridade

```python
# SHA-256 do ficheiro completo
sha256_output = hashlib.sha256(open(output_path, 'rb').read()).hexdigest()

# Verificar contra hash calculado antes do upload
assert sha256_output == expected_sha256, "Integrity check failed"
```

Para ficheiros muito grandes (>50GB), usar SHA-256 por segmentos de 1GB com verificação paralela.

### 5.3 Loudness final

Re-verificar loudness do output final com medição independente (não confiar só nos parâmetros de encoding):
```bash
ffmpeg -i output.mp4 \
  -af "ebur128=peak=true:framelog=verbose" \
  -f null - 2>&1 | grep "Integrated loudness\|True peak"
```

### 5.4 Conformance final

Para perfis broadcast, executar MediaConch contra o policy XML do standard de entrega:
```bash
mediaconch --policy=AS11_DPP_HD.xml --format=xml output.mxf > conformance_report.xml
```

O report XML é arquivado junto ao asset como prova de conformance.

---

## Camada 6 — Delivery

**Objetivo:** Entrega do conteúdo processado com metadata e triggers de automação.

### 6.1 Upload resiliente

**S3 Multipart Upload** para ficheiros > 100MB:
```python
mpu = s3.create_multipart_upload(Bucket=bucket, Key=key,
    ChecksumAlgorithm='SHA256')

parts = []
for i, chunk in enumerate(read_chunks(file_path, chunk_size=100*1024*1024)):
    part = s3.upload_part(
        Bucket=bucket, Key=key,
        UploadId=mpu['UploadId'],
        PartNumber=i+1,
        Body=chunk,
        ChecksumSHA256=base64.b64encode(hashlib.sha256(chunk).digest()).decode()
    )
    parts.append({'PartNumber': i+1, 'ETag': part['ETag'],
                  'ChecksumSHA256': part['ChecksumSHA256']})

s3.complete_multipart_upload(
    Bucket=bucket, Key=key, UploadId=mpu['UploadId'],
    MultipartUpload={'Parts': parts}
)
```

**Verificação pós-upload** — comparar SHA-256 local com ETag/checksum S3 após upload. Não assumir que o upload foi bem-sucedido sem verificação.

### 6.2 Metadata de entrega

**EBU Core** é o standard de metadata para arquivo e MAM europeu:
```xml
<ebucore:ebuCoreMain>
  <ebucore:coreMetadata>
    <ebucore:identifier typeLabel="EIDR">10.5240/xxxx-xxxx</ebucore:identifier>
    <ebucore:title>
      <ebucore:titleMain>Episódio 01</ebucore:titleMain>
    </ebucore:title>
    <ebucore:format>
      <ebucore:videoFormat videoFormatName="HD 1080i">
        <ebucore:frameRate factorNumerator="25" factorDenominator="1"/>
        <ebucore:aspectRatio typeLabel="display">16:9</ebucore:aspectRatio>
        <ebucore:videoEncoding typeLabel="H.264"/>
        <ebucore:bitRate>8000000</ebucore:bitRate>
      </ebucore:videoFormat>
      <ebucore:audioFormat audioFormatName="Stereo">
        <ebucore:audioEncoding typeLabel="AAC"/>
        <ebucore:audioTrackConfiguration typeLabel="2.0"/>
        <ebucore:loudness>
          <ebucore:integratedLoudness>-23</ebucore:integratedLoudness>
          <ebucore:loudnessTruePeak>-1.2</ebucore:loudnessTruePeak>
        </ebucore:loudness>
      </ebucore:audioFormat>
    </ebucore:format>
    <ebucore:technicalAttributeString typeLabel="VMAF">93.4</ebucore:technicalAttributeString>
    <ebucore:technicalAttributeString typeLabel="SHA256">e3b0c44...</ebucore:technicalAttributeString>
  </ebucore:coreMetadata>
</ebucore:ebuCoreMain>
```

### 6.3 Playout integration

O sistema deve expor uma API de status que os playout systems podem consultar:

```http
GET /assets/{asset_id}/status
→ 200 OK
{
  "asset_id": "a1b2c3d4-...",
  "status": "ready_for_schedule",
  "profiles_available": ["broadcast_hd", "ott_premium", "web"],
  "duration_frames": 137500,
  "duration_tc": "01:31:40:00",
  "frame_rate": "25",
  "audio_tracks": [
    {"index": 0, "language": "pt", "channels": 2, "loudness_lufs": -23.1}
  ],
  "subtitles": [
    {"language": "pt", "format": "ttml", "uri": "s3://..."}
  ],
  "thumbnail_sprite": "s3://...",
  "proxy_lowres": "s3://...",
  "delivery_timestamp": "2025-01-15T16:45:00Z"
}
```

Webhook automático ao completar:
```http
POST {playout_webhook_url}
{
  "event": "asset.ready",
  "asset_id": "a1b2c3d4-...",
  "timestamp": "2025-01-15T16:45:00Z"
}
```

---

# PARTE IV — OBSERVABILIDADE E OPERAÇÕES

## 4.1 Stack de monitorização

```
Métricas:  Prometheus com scrape interval 15s
Dashboard: Grafana com alerting integrado
Logs:      Loki (estruturados em JSON, indexados por asset_id)
Tracing:   Jaeger ou Tempo (traces distribuídos por workflow step)
Alertas:   Alertmanager → PagerDuty / Slack / email
```

## 4.2 Métricas obrigatórias

```
Pipeline:
  media_assets_ingested_total          (counter)
  media_assets_rejected_total          (counter, com label reason)
  media_transcode_duration_seconds     (histogram)
  media_pipeline_queue_depth           (gauge, por worker type)
  media_job_success_rate               (gauge, 5min window)

Qualidade:
  media_vmaf_score                     (histogram, por profile)
  media_loudness_lufs                  (histogram)
  media_bitrate_actual_kbps            (histogram)
  media_qc_failures_total              (counter, com label check_type)

Infraestrutura:
  media_ffmpeg_process_duration_seconds (histogram)
  media_upload_duration_seconds        (histogram, por destination)
  media_storage_bytes_total            (gauge, por tier)
  media_worker_cpu_utilization         (gauge)
```

## 4.3 Alertas críticos

| Alerta | Condição | Severidade | Ação |
|---|---|---|---|
| Pipeline stalled | queue_depth > 50 por 10min | Critical | PagerDuty |
| High rejection rate | rejection_rate > 20% por 5min | Warning | Slack |
| FFmpeg timeout | ffmpeg_timeout_total aumenta | Critical | PagerDuty |
| Low VMAF | vmaf_score_p50 < 85 | Warning | Slack |
| Upload failure | upload_error_rate > 5% | Critical | PagerDuty |
| Worker down | worker_heartbeat ausente 2min | Critical | PagerDuty |

## 4.4 Audit trail

Cada operação sobre um asset gera um registo imutável (append-only, nunca DELETE ou UPDATE):

```json
{
  "audit_id": "uuid",
  "timestamp": "2025-01-15T14:32:00Z",
  "asset_id": "a1b2c3d4-...",
  "event_type": "qc_completed",
  "operator": "system",
  "result": "pass",
  "details": {
    "checks_passed": 12,
    "checks_failed": 0,
    "vmaf_score": 93.4,
    "loudness_lufs": -23.1,
    "true_peak_dbtp": -1.2
  }
}
```

---

# PARTE V — ROADMAP DE IMPLEMENTAÇÃO

## Sprint 0 — Correções imediatas (sem novas features)

Estas correções devem ser feitas antes de qualquer novo desenvolvimento porque são bugs que afetam a qualidade do output atual:

1. Corrigir parâmetros FFmpeg para Closed GOP + IDR + `-sc_threshold 0`
2. Corrigir loudness para True Peak com two-pass EBU R128
3. Adicionar `yuv420p` como pixel format obrigatório
4. Adicionar `-movflags +faststart` a todos os outputs MP4
5. Adicionar SHA-256 (substituir MD5 onde existir)

Esforço estimado: 3-5 dias.

## Sprint 1 — Qualidade e validação (4-6 semanas)

1. QC pós-encode com VMAF scoring
2. MediaConch para conformance checking formal
3. Detecção de black frames, freeze frames e loudness scan pré-encode
4. Dashboard básico de monitorização (Prometheus + Grafana)
5. Audit trail imutável

## Sprint 2 — Pipeline robusto (6-8 semanas)

1. Temporal.io para orquestração de workflows
2. Isolamento do FFmpeg em processo filho com timeout
3. Retry automático com backoff exponencial
4. Dead-letter queue com interface de revisão
5. Suporte a MXF OP1a como output (para ingest broadcast)
6. Proxy generation (LowRes + Thumbnail sprite)

## Sprint 3 — OTT e distribuição (8-10 semanas)

1. CMAF packaging com multi-DRM (Widevine + FairPlay + PlayReady)
2. Subtitle pipeline estruturado (SRT → TTML/WebVTT/CEA-708)
3. Profile system completo (broadcast / ott / archive / web)
4. API de status para integração com playout e MAM
5. Webhook notifications
6. Upload resiliente com multipart S3

## Sprint 4 — Inteligência e escala (10-12 semanas)

1. Per-title encoding com VMAF calibration
2. Classificação automática de conteúdo (SI/TI analysis)
3. HDR/SDR tone mapping
4. Workers em containers Docker com auto-scaling
5. EBU Core metadata sidecar
6. SCTE-35 markers (se aplicável ao negócio)

---

# PARTE VI — SUMÁRIO EXECUTIVO

## O que o sistema é hoje
Um normalizador de media funcional com boas intenções de design mas com erros técnicos que afetam a qualidade do output e lacunas que impedem uso em contexto broadcast ou OTT profissional.

## O que o sistema pode ser
Uma plataforma de ingest-to-delivery end-to-end capaz de servir broadcasters, plataformas OTT e arquivos de media, com qualidade verificável em cada etapa, auditabilidade completa e integração com os standards da indústria.

## Os 5 princípios que devem guiar a evolução

1. **Qualidade verificável** — cada output tem um VMAF score, um loudness report e um checksum. Nunca se assume que está bom.
2. **Fail loudly** — um ficheiro não-conforme deve ser rejeitado com reason codes claros, nunca silenciosamente degradado.
3. **Standards, não convenções** — EBU R128, AS-11, CMAF, EBU Core. Não inventar formatos.
4. **Resiliência por design** — retry automático, dead-letter, timeout, isolamento de processos. Nenhuma falha deve ser catastrófica.
5. **Observabilidade first** — se não consegues medir, não consegues melhorar.

---

*Documento preparado com base na análise crítica do sistema existente e nos standards EBU, SMPTE, DVB, Apple HLS Authoring Spec, Netflix Partner Help e DASH-IF.*
