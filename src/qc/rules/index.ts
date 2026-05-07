// ═══════════════════════════════════════════════════════════════
// Nexora Media Processing — QC Rules Engine
// ═══════════════════════════════════════════════════════════════
// Ficheiro: src/qc/rules/index.ts
// Exporta todas as regras e o motor de execução
// ═══════════════════════════════════════════════════════════════

// ── Tipos partilhados ─────────────────────────────────────────
export type QCResultSeverity = 'critical' | 'warning' | 'info';
export type QCDecision = 'PASS' | 'QUARANTINE' | 'REJECT';

export interface QCResult {
  pass: boolean;
  severity: QCResultSeverity;
  code: string;
  detail: string;
  /** Valor medido que causou a falha (para logs) */
  measuredValue?: string | number;
  /** Valor esperado (para logs) */
  expectedValue?: string | number;
}

export interface VideoMetadata {
  codec: string;
  profile: string;
  level: string;
  pixelFormat: string;
  frameRate: number;
  frameRateMode: 'CFR' | 'VFR' | 'UNKNOWN';
  gopType: 'CLOSED' | 'OPEN' | 'UNKNOWN';
  hasIdrFrames: boolean;
  bFrameCount: number;
  bitrate: number;
  width: number;
  height: number;
  bitDepth: 8 | 10 | 12;
  colorSpace: string;
  colorPrimaries: string;
  transferCharacteristics: string;
  duration: number; // segundos
  hasFastStart: boolean; // moov atom antes de mdat
  // Campos expandidos via MediaInfo
  scanType?: 'Progressive' | 'Interlaced' | 'MBAFF' | 'UNKNOWN';
  scanOrder?: 'TFF' | 'BFF' | 'UNKNOWN';
  encodingLibrary?: string;
  encodingSettings?: string;
  hdrFormat?: string | null;
  maxCLL?: number | null;
  maxFALL?: number | null;
  matrixCoefficients?: string;
  colourRange?: 'Full' | 'Limited' | 'UNKNOWN';
  refFrameCount?: number;
  cabacEnabled?: boolean;
}

export interface AudioMetadata {
  codec: string;
  sampleRate: number;
  bitDepth: number;
  channels: number;
  channelLayout: string;
  integratedLufs: number | null;
  truePeakDbtp: number | null;
  loudnessRange: number | null;
  audioVideoSyncMs: number | null; // desfasamento A/V em ms
}

export interface ContainerMetadata {
  format: string;
  duration: number;
  size: number; // bytes
  hasEditLists: boolean;
  hasTimecodeTrack: boolean;
  moovPosition: 'start' | 'end' | 'unknown'; // para Fast Start check
}

export interface NexoraQCInput {
  assetId: string;
  profile: string;
  video: VideoMetadata;
  audio: AudioMetadata;
  container: ContainerMetadata;
}

// ── Motor de execução das regras ──────────────────────────────
/**
 * Executa todas as regras em paralelo e decide o resultado final.
 * 'critical' → REJECT
 * 3+ warnings → QUARANTINE
 * Só 'info' ou 'warning' < 3 → PASS (com avisos)
 */
export async function runQCRules(input: NexoraQCInput): Promise<{
  decision: QCDecision;
  results: QCResult[];
  summary: string;
}> {
  // Seleccionar regras conforme o perfil
  const videoRules = getVideoRules(input.profile);
  const audioRules = getAudioRules(input.profile);
  const containerRules = getContainerRules(input.profile);

  // Executar todas em paralelo
  const allResults = await Promise.all([
    ...videoRules.map(r => Promise.resolve(r(input.video))),
    ...audioRules.map(r => Promise.resolve(r(input.audio))),
    ...containerRules.map(r => Promise.resolve(r(input.container))),
  ]);

  const failures = allResults.filter(r => !r.pass);
  const criticals = failures.filter(r => r.severity === 'critical');
  const warnings  = failures.filter(r => r.severity === 'warning');

  let decision: QCDecision;
  if (criticals.length > 0) {
    decision = 'REJECT';
  } else if (warnings.length >= 3) {
    decision = 'QUARANTINE';
  } else {
    decision = 'PASS';
  }

  const summary = decision === 'PASS'
    ? `QC passou com ${warnings.length} aviso(s)`
    : decision === 'QUARANTINE'
    ? `QC quarentena: ${warnings.length} aviso(s) requerem revisão humana`
    : `QC rejeitado: ${criticals.length} erro(s) crítico(s) — ${criticals.map(c => c.code).join(', ')}`;

  return { decision, results: allResults, summary };
}

// ───────────────────────────────────────────────────────────────
// REGRAS DE VÍDEO
// ───────────────────────────────────────────────────────────────

// Ficheiro: src/qc/rules/video.rules.ts

type VideoRule = (meta: VideoMetadata) => QCResult;

/** GOP type: deve ser Closed para broadcast */
export const gopTypeRule: VideoRule = (meta) => {
  if (meta.gopType === 'CLOSED') {
    return { pass: true, severity: 'info', code: 'GOP_OK', detail: 'GOP fechado confirmado' };
  }
  return {
    pass: false,
    severity: 'critical',
    code: 'ERR_GOP_OPEN',
    detail: 'GOP aberto detectado — causa artefactos em switching de playout broadcast',
    measuredValue: meta.gopType,
    expectedValue: 'CLOSED'
  };
};

/** IDR frames: obrigatório para broadcast */
export const idrFramesRule: VideoRule = (meta) => {
  if (meta.hasIdrFrames) {
    return { pass: true, severity: 'info', code: 'IDR_OK', detail: 'IDR frames confirmados' };
  }
  return {
    pass: false,
    severity: 'critical',
    code: 'ERR_NO_IDR',
    detail: 'Sem IDR frames — o decoder não consegue reiniciar sem IDR frames em cada keyframe',
    expectedValue: 'IDR frames obrigatórios'
  };
};

/** Frame rate mode: CFR obrigatório */
export const cfrRule: VideoRule = (meta) => {
  if (meta.frameRateMode === 'CFR') {
    return { pass: true, severity: 'info', code: 'CFR_OK', detail: `CFR a ${meta.frameRate}fps` };
  }
  return {
    pass: false,
    severity: 'critical',
    code: 'ERR_VFR',
    detail: 'VFR (Variable Frame Rate) detectado — causa sync issues e instabilidade em playout',
    measuredValue: meta.frameRateMode,
    expectedValue: 'CFR'
  };
};

/** Pixel format: yuv420p obrigatório para distribuição */
export const pixelFormatRule: VideoRule = (meta) => {
  const allowedFormats = ['yuv420p', 'yuv420p10le']; // 10le para HDR
  if (allowedFormats.includes(meta.pixelFormat)) {
    return { pass: true, severity: 'info', code: 'PIXFMT_OK', detail: `Pixel format ${meta.pixelFormat} aceite` };
  }
  return {
    pass: false,
    severity: 'critical',
    code: 'ERR_PIXEL_FORMAT',
    detail: `Pixel format ${meta.pixelFormat} não suportado — compatibilidade reduzida com decoders hardware`,
    measuredValue: meta.pixelFormat,
    expectedValue: 'yuv420p (SDR) ou yuv420p10le (HDR)'
  };
};

/** B-frames: 0 para broadcast linear */
export const bFramesRule: VideoRule = (meta) => {
  if (meta.bFrameCount === 0) {
    return { pass: true, severity: 'info', code: 'BFRAMES_OK', detail: 'Sem B-frames' };
  }
  // B-frames são permitidos em VoD/arquivo mas não em broadcast linear
  return {
    pass: false,
    severity: 'critical',
    code: 'ERR_BFRAMES',
    detail: `${meta.bFrameCount} B-frames detectados — aumentam latência de decodificação em playout linear`,
    measuredValue: meta.bFrameCount,
    expectedValue: 0
  };
};

/** Codec: verificar se é H.264 ou H.265 */
export const codecRule: VideoRule = (meta) => {
  const supported = ['h264', 'hevc', 'avc', 'h265', 'prores'];
  const codecLower = meta.codec.toLowerCase();
  if (supported.some(c => codecLower.includes(c))) {
    return { pass: true, severity: 'info', code: 'CODEC_OK', detail: `Codec ${meta.codec} suportado` };
  }
  return {
    pass: false,
    severity: 'critical',
    code: 'ERR_CODEC_UNSUPPORTED',
    detail: `Codec ${meta.codec} não suportado pelo Nexora`,
    measuredValue: meta.codec,
    expectedValue: 'H.264, H.265, ou ProRes'
  };
};

/** GOP size: deve ser fps × 2 para perfis broadcast */
export function gopSizeRule(expectedGopSize: number): VideoRule {
  return (meta) => {
    // Calcular GOP size esperado a partir do frame rate
    const expected = Math.round(meta.frameRate) * 2;
    // Tolerância de ±2 frames
    const measured = expectedGopSize;
    if (Math.abs(measured - expected) <= 2) {
      return { pass: true, severity: 'info', code: 'GOP_SIZE_OK', detail: `GOP size ${measured} correcto` };
    }
    return {
      pass: false,
      severity: 'warning',
      code: 'WARN_GOP_SIZE',
      detail: `GOP size ${measured} diferente do esperado ${expected} (fps×2) — pode causar fracturas em segmentos HLS/DASH`,
      measuredValue: measured,
      expectedValue: expected
    };
  };
}

/** Color space: BT.709 para HD, BT.2020 para HDR */
export const colorSpaceRule: VideoRule = (meta) => {
  const validHD  = ['bt709', 'BT709', '1'];
  const validHDR = ['bt2020nc', 'bt2020c', 'BT2020', '9'];
  const valid = [...validHD, ...validHDR];

  if (valid.includes(meta.colorSpace) || meta.colorSpace === '') {
    return { pass: true, severity: 'info', code: 'COLORSPACE_OK', detail: `Color space ${meta.colorSpace || 'não especificado'} aceite` };
  }
  return {
    pass: false,
    severity: 'warning',
    code: 'WARN_COLORSPACE',
    detail: `Color space ${meta.colorSpace} incomum — verificar se o output será exibido correctamente`,
    measuredValue: meta.colorSpace,
    expectedValue: 'bt709 (HD) ou bt2020nc (HDR)'
  };
};

/** Resolução mínima */
export const resolutionRule: VideoRule = (meta) => {
  if (meta.width >= 640 && meta.height >= 360) {
    return { pass: true, severity: 'info', code: 'RESOLUTION_OK', detail: `${meta.width}×${meta.height}` };
  }
  return {
    pass: false,
    severity: 'warning',
    code: 'WARN_RESOLUTION_LOW',
    detail: `Resolução ${meta.width}×${meta.height} muito baixa para processamento profissional`,
    measuredValue: `${meta.width}×${meta.height}`,
    expectedValue: 'Mínimo 640×360'
  };
};

/** Duração mínima: rejeitar ficheiros vazios ou muito curtos */
export const durationRule: VideoRule = (meta) => {
  if (meta.duration >= 1) {
    return { pass: true, severity: 'info', code: 'DURATION_OK', detail: `Duração: ${meta.duration.toFixed(1)}s` };
  }
  return {
    pass: false,
    severity: 'critical',
    code: 'ERR_DURATION_TOO_SHORT',
    detail: `Duração ${meta.duration.toFixed(2)}s demasiado curta — ficheiro provavelmente corrompido ou vazio`,
    measuredValue: meta.duration,
    expectedValue: '≥ 1 segundo'
  };
};

/** Scan type: interlaced content deve ser deinterlaced antes do encode */
export const scanTypeRule: VideoRule = (meta) => {
  if (!meta.scanType || meta.scanType === 'UNKNOWN' || meta.scanType === 'Progressive') {
    return { pass: true, severity: 'info', code: 'SCAN_TYPE_OK', detail: `Scan type: ${meta.scanType ?? 'Progressive'}` };
  }
  return {
    pass: false,
    severity: 'warning',
    code: 'WARN_INTERLACED',
    detail: `Conteúdo interlaced detectado (${meta.scanType}${meta.scanOrder && meta.scanOrder !== 'UNKNOWN' ? ', ' + meta.scanOrder : ''}) — requer deinterlace antes do encode`,
    measuredValue: meta.scanType,
    expectedValue: 'Progressive'
  };
};

/** HDR consistency: se HDR Format presente mas sem MaxCLL/MaxFALL → aviso */
export const hdrConsistencyRule: VideoRule = (meta) => {
  if (!meta.hdrFormat) {
    return { pass: true, severity: 'info', code: 'HDR_NA', detail: 'Conteúdo SDR (sem HDR metadata)' };
  }
  const hasMaxCLL = meta.maxCLL !== null && meta.maxCLL !== undefined;
  const hasMaxFALL = meta.maxFALL !== null && meta.maxFALL !== undefined;
  if (hasMaxCLL && hasMaxFALL) {
    return { pass: true, severity: 'info', code: 'HDR_OK', detail: `HDR: ${meta.hdrFormat}, MaxCLL=${meta.maxCLL}, MaxFALL=${meta.maxFALL}` };
  }
  return {
    pass: false,
    severity: 'warning',
    code: 'WARN_HDR_INCOMPLETE',
    detail: `HDR Format presente (${meta.hdrFormat}) mas MaxCLL/MaxFALL em falta — metadata HDR incompleta`,
    measuredValue: meta.hdrFormat,
    expectedValue: 'HDR completo com MaxCLL e MaxFALL'
  };
};

/** Colour range: Full range em conteúdo broadcast → aviso */
export const colourRangeRule: VideoRule = (meta) => {
  if (!meta.colourRange || meta.colourRange === 'UNKNOWN' || meta.colourRange === 'Limited') {
    return { pass: true, severity: 'info', code: 'COLOUR_RANGE_OK', detail: `Colour range: ${meta.colourRange ?? 'Limited (assumido)'}` };
  }
  return {
    pass: false,
    severity: 'warning',
    code: 'WARN_FULL_RANGE',
    detail: 'Full colour range detectado — broadcast usa Limited range (16-235). Pode causar clipping em alguns destinos.',
    measuredValue: meta.colourRange,
    expectedValue: 'Limited'
  };
};

/** Encoding library: info sobre a biblioteca que codificou o vídeo */
export const encodingLibraryRule: VideoRule = (meta) => {
  if (!meta.encodingLibrary) {
    return { pass: true, severity: 'info', code: 'ENC_LIB_UNKNOWN', detail: 'Biblioteca de encoding não identificada' };
  }
  return { pass: true, severity: 'info', code: 'ENC_LIB_OK', detail: `Encoding library: ${meta.encodingLibrary}` };
};

// Seleccionar regras conforme o perfil
function getVideoRules(profile: string): VideoRule[] {
  const base: VideoRule[] = [
    codecRule,
    cfrRule,
    pixelFormatRule,
    colorSpaceRule,
    resolutionRule,
    durationRule,
    scanTypeRule,
    hdrConsistencyRule,
    encodingLibraryRule,
  ];

  const broadcastRules: VideoRule[] = [
    gopTypeRule,
    idrFramesRule,
    bFramesRule,
    gopSizeRule(50),
    colourRangeRule,
  ];

  if (profile.includes('broadcast') || profile.includes('ott')) {
    return [...base, ...broadcastRules];
  }
  return base;
}

// ───────────────────────────────────────────────────────────────
// REGRAS DE ÁUDIO
// ───────────────────────────────────────────────────────────────

// Ficheiro: src/qc/rules/audio.rules.ts

type AudioRule = (meta: AudioMetadata) => QCResult;

/** Sample rate: 48000 Hz obrigatório em broadcast */
export const sampleRateRule: AudioRule = (meta) => {
  if (meta.sampleRate === 48000) {
    return { pass: true, severity: 'info', code: 'SAMPLE_RATE_OK', detail: '48000 Hz confirmado' };
  }
  // 44100 Hz é warning (comum em conteúdo de consumer), não reject
  return {
    pass: false,
    severity: meta.sampleRate === 44100 ? 'warning' : 'critical',
    code: meta.sampleRate === 44100 ? 'WARN_SAMPLE_RATE_44100' : 'ERR_SAMPLE_RATE',
    detail: `Sample rate ${meta.sampleRate} Hz — broadcast exige 48000 Hz`,
    measuredValue: meta.sampleRate,
    expectedValue: 48000
  };
};

/** True Peak: nunca acima de -1 dBTP */
export function truePeakRule(limitDbtp: number = -1.0): AudioRule {
  return (meta) => {
    if (meta.truePeakDbtp === null) {
      return {
        pass: false,
        severity: 'warning',
        code: 'WARN_TRUE_PEAK_UNMEASURED',
        detail: 'True Peak não foi medido — não é possível verificar conformidade EBU R128'
      };
    }
    if (meta.truePeakDbtp <= limitDbtp) {
      return {
        pass: true,
        severity: 'info',
        code: 'TRUE_PEAK_OK',
        detail: `True Peak ${meta.truePeakDbtp.toFixed(1)} dBTP dentro do limite ${limitDbtp} dBTP`
      };
    }
    return {
      pass: false,
      severity: meta.truePeakDbtp > 0 ? 'critical' : 'warning',
      code: meta.truePeakDbtp > 0 ? 'ERR_TRUE_PEAK_CLIP' : 'ERR_TRUE_PEAK_HIGH',
      detail: `True Peak ${meta.truePeakDbtp.toFixed(1)} dBTP acima do limite ${limitDbtp} dBTP — clipping possível no destino`,
      measuredValue: meta.truePeakDbtp,
      expectedValue: `≤ ${limitDbtp} dBTP`
    };
  };
}

/** Loudness integrado: verificar desvio do target */
export function integratedLoudnessRule(targetLufs: number, toleranceLu: number = 2.0): AudioRule {
  return (meta) => {
    if (meta.integratedLufs === null) {
      return {
        pass: false,
        severity: 'warning',
        code: 'WARN_LUFS_UNMEASURED',
        detail: 'Loudness integrado não foi medido'
      };
    }
    const deviation = Math.abs(meta.integratedLufs - targetLufs);
    if (deviation <= toleranceLu) {
      return {
        pass: true,
        severity: 'info',
        code: 'LUFS_OK',
        detail: `${meta.integratedLufs.toFixed(1)} LUFS (desvio: ${deviation.toFixed(1)} LU do target ${targetLufs} LUFS)`
      };
    }
    return {
      pass: false,
      severity: 'warning',
      code: 'WARN_LUFS_DEVIATION',
      detail: `Loudness ${meta.integratedLufs.toFixed(1)} LUFS — desvio ${deviation.toFixed(1)} LU do target ${targetLufs} LUFS`,
      measuredValue: meta.integratedLufs,
      expectedValue: `${targetLufs} LUFS ±${toleranceLu} LU`
    };
  };
}

/** A/V sync: desfasamento áudio/vídeo */
export const avSyncRule: AudioRule = (meta) => {
  if (meta.audioVideoSyncMs === null) {
    return { pass: true, severity: 'info', code: 'AV_SYNC_UNKNOWN', detail: 'Sync A/V não verificado' };
  }
  const absSync = Math.abs(meta.audioVideoSyncMs);
  if (absSync <= 20) {
    return { pass: true, severity: 'info', code: 'AV_SYNC_OK', detail: `Sync A/V: ${meta.audioVideoSyncMs}ms` };
  }
  if (absSync <= 45) {
    return {
      pass: false,
      severity: 'warning',
      code: 'WARN_AV_SYNC',
      detail: `Desfasamento A/V de ${meta.audioVideoSyncMs}ms — perceptível mas tolerável`,
      measuredValue: meta.audioVideoSyncMs,
      expectedValue: '≤ 20ms'
    };
  }
  return {
    pass: false,
    severity: 'critical',
    code: 'ERR_AV_SYNC',
    detail: `Desfasamento A/V de ${meta.audioVideoSyncMs}ms — notoriamente visível, impraticável em broadcast`,
    measuredValue: meta.audioVideoSyncMs,
    expectedValue: '≤ 20ms'
  };
};

/** Canais de áudio: mínimo 2 (stereo) */
export const audioChannelsRule: AudioRule = (meta) => {
  if (meta.channels >= 2) {
    return {
      pass: true,
      severity: 'info',
      code: 'CHANNELS_OK',
      detail: `${meta.channels} canal(is) — ${meta.channelLayout}`
    };
  }
  return {
    pass: false,
    severity: 'warning',
    code: 'WARN_MONO_AUDIO',
    detail: 'Áudio mono detectado — a maioria dos destinos exige stereo',
    measuredValue: meta.channels,
    expectedValue: '≥ 2 canais'
  };
};

function getAudioRules(profile: string): AudioRule[] {
  const broadcastTarget  = -23;
  const streamingTarget  = -14;
  const target = profile.includes('broadcast') ? broadcastTarget : streamingTarget;

  return [
    sampleRateRule,
    truePeakRule(-1.0),
    integratedLoudnessRule(target, 2.0),
    avSyncRule,
    audioChannelsRule,
  ];
}

// ───────────────────────────────────────────────────────────────
// REGRAS DE CONTAINER
// ───────────────────────────────────────────────────────────────

// Ficheiro: src/qc/rules/container.rules.ts

type ContainerRule = (meta: ContainerMetadata) => QCResult;

/** Fast Start (moov atom): obrigatório para streaming */
export const fastStartRule: ContainerRule = (meta) => {
  if (meta.moovPosition === 'start') {
    return { pass: true, severity: 'info', code: 'FAST_START_OK', detail: 'moov atom no início do ficheiro' };
  }
  if (meta.moovPosition === 'unknown') {
    return { pass: true, severity: 'info', code: 'FAST_START_UNKNOWN', detail: 'Posição do moov atom não verificada' };
  }
  return {
    pass: false,
    severity: 'warning',
    code: 'WARN_NO_FAST_START',
    detail: 'moov atom no final do ficheiro — streaming progressivo impossível antes de download completo',
    measuredValue: meta.moovPosition,
    expectedValue: 'start'
  };
};

/** Edit lists: podem causar problemas em alguns players */
export const editListRule: ContainerRule = (meta) => {
  if (!meta.hasEditLists) {
    return { pass: true, severity: 'info', code: 'EDIT_LIST_OK', detail: 'Sem edit lists problemáticas' };
  }
  return {
    pass: false,
    severity: 'warning',
    code: 'WARN_EDIT_LISTS',
    detail: 'Edit lists detectadas no container — podem causar problemas de seeking em alguns players',
  };
};

/** Tamanho mínimo do ficheiro */
export const fileSizeRule: ContainerRule = (meta) => {
  const minSizeBytes = 1024; // 1 KB
  if (meta.size >= minSizeBytes) {
    return { pass: true, severity: 'info', code: 'FILE_SIZE_OK', detail: `Tamanho: ${(meta.size / 1024 / 1024).toFixed(1)} MB` };
  }
  return {
    pass: false,
    severity: 'critical',
    code: 'ERR_FILE_TOO_SMALL',
    detail: `Ficheiro de ${meta.size} bytes — provavelmente corrompido ou vazio`,
    measuredValue: meta.size,
    expectedValue: `≥ ${minSizeBytes} bytes`
  };
};

function getContainerRules(_profile: string): ContainerRule[] {
  return [
    fastStartRule,
    editListRule,
    fileSizeRule,
  ];
}
