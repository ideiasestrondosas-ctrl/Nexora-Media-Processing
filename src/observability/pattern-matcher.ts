// Nexora Media Processing — Pattern Matcher
// Ficheiro: src/observability/pattern-matcher.ts
//
// Catálogo de padrões de erro conhecidos da pipeline Nexora.
// Cada padrão tem regex, severidade, categoria e indicação de retryability.
//
// Fontes analisadas:
//   FFmpeg stderr, MediaInfo JSON, MediaConch XML, BullMQ logs, BS1770GAIN XML

import type { ParsedLogEntry, LogSource } from './log-parser';

// ── Tipos Públicos ────────────────────────────────────────────────

export type PatternSeverity = 'critical' | 'high' | 'medium' | 'low';

export type PatternCategory =
  | 'container'    // Problemas de container/muxing
  | 'stream'       // Stream corrompido ou inválido
  | 'encode'       // Falha durante encoding
  | 'timestamp'    // Problemas de DTS/PTS
  | 'audio'        // Loudness, True Peak, sincronismo
  | 'resource'     // GPU, memória, CPU
  | 'compliance'   // Conformidade com standards (MediaConch)
  | 'queue';       // BullMQ queue events

/** Definição de um padrão de erro no catálogo */
export interface ErrorPattern {
  /** Identificador único do padrão */
  id: string;
  /** Regex a aplicar à mensagem normalizada */
  regex: RegExp;
  /** Pode também testar nos metadados (error_code) */
  errorCode?: string;
  /** Fontes onde este padrão é relevante */
  sources: LogSource[];
  /** Severidade classificada */
  severity: PatternSeverity;
  /** Categoria funcional */
  category: PatternCategory;
  /** Descrição legível por humanos */
  description: string;
  /** Se o erro permite retry com ajuste de parâmetros */
  isRetryable: boolean;
  /** ID do fix sugerido no NexoraFixSuggester */
  suggestedFixId?: string;
}

/** Resultado de uma correspondência de padrão */
export interface PatternMatch {
  /** Padrão que correspondeu */
  pattern: ErrorPattern;
  /** Entrada de log onde o padrão foi detectado */
  entry: ParsedLogEntry;
  /** Texto que correspondeu ao regex */
  matchedText: string;
  /** Grupos de captura nomeados */
  captureGroups: Record<string, string>;
  /** Score de confiança [0-1] */
  confidence: number;
}

// ── Catálogo de Padrões ───────────────────────────────────────────

export const ERROR_PATTERNS: ErrorPattern[] = [

  // ── CRÍTICOS: Terminam o job sem retry útil ────────────────────

  {
    id: 'MOOV_NOT_FOUND',
    regex: /moov atom not found/i,
    errorCode: 'MOOV_NOT_FOUND',
    sources: ['ffmpeg'],
    severity: 'critical',
    category: 'container',
    description: 'Container MP4/MOV corrompido — atom moov ausente. Ficheiro incompleto ou truncado.',
    isRetryable: false,
    suggestedFixId: undefined,
  },

  {
    id: 'INVALID_DATA',
    regex: /Invalid data found when processing input/i,
    errorCode: 'INVALID_DATA',
    sources: ['ffmpeg'],
    severity: 'critical',
    category: 'stream',
    description: 'Stream corrompido ou formato inválido. O FFmpeg não consegue ler os dados.',
    isRetryable: false,
    suggestedFixId: undefined,
  },

  {
    id: 'CONVERSION_FAILED',
    regex: /Conversion failed!/i,
    errorCode: 'CONVERSION_FAILED',
    sources: ['ffmpeg'],
    severity: 'critical',
    category: 'encode',
    description: 'FFmpeg terminou com falha terminal. Ver stderr anterior para causa raiz.',
    isRetryable: false,
    suggestedFixId: undefined,
  },

  {
    id: 'OUT_OF_MEMORY',
    regex: /Cannot allocate memory|ENOMEM|out of memory/i,
    errorCode: 'OUT_OF_MEMORY',
    sources: ['ffmpeg'],
    severity: 'critical',
    category: 'resource',
    description: 'Sistema sem memória disponível para completar o encode.',
    isRetryable: true,
    suggestedFixId: 'FIX_REDUCE_THREADS',
  },

  // ── ALTO: Retry com ajuste de parâmetros ──────────────────────

  {
    id: 'DTS_OUT_OF_ORDER',
    regex: /DTS\s+[-\d.]+,\s*next:[-\d.]+\s+out of order/i,
    errorCode: 'DTS_OUT_OF_ORDER',
    sources: ['ffmpeg'],
    severity: 'high',
    category: 'timestamp',
    description: 'DTS fora de ordem — timestamps não monotónicos. Corrigir com -fflags +igndts.',
    isRetryable: true,
    suggestedFixId: 'FIX_IGNDTS',
  },

  {
    id: 'PAST_DURATION_LARGE',
    regex: /Past duration\s+[-\d.]+\s+too large/i,
    errorCode: 'PAST_DURATION_LARGE',
    sources: ['ffmpeg'],
    severity: 'high',
    category: 'timestamp',
    description: 'VBV buffer overflow — past duration muito grande. Ajustar bufsize.',
    isRetryable: true,
    suggestedFixId: 'FIX_VBV_BUFFER',
  },

  {
    id: 'NVENC_ERROR',
    regex: /Cannot load nvcuda\.dll|InitializeEncoder failed|Error creating a CUDA context|nvenc.*error|NVENC.*not.*supported/i,
    errorCode: 'NVENC_ERROR',
    sources: ['ffmpeg'],
    severity: 'high',
    category: 'resource',
    description: 'Falha no encoder NVENC/GPU. Fazer fallback para encoder CPU.',
    isRetryable: true,
    suggestedFixId: 'FIX_CPU_FALLBACK',
  },

  {
    id: 'PIPE_BROKEN',
    regex: /Broken pipe|EPIPE/i,
    errorCode: 'PIPE_BROKEN',
    sources: ['ffmpeg'],
    severity: 'high',
    category: 'stream',
    description: 'Pipe de output interrompido. Possível timeout ou encerramento forçado.',
    isRetryable: true,
    suggestedFixId: 'FIX_INCREASE_TIMEOUT',
  },

  // ── ÁUDIO: Problemas de loudness/normalização ─────────────────

  {
    id: 'TRUE_PEAK_EXCEEDED',
    regex: /True Peak\s+([-\d.]+)\s+dBTP excede limite/i,
    errorCode: 'TRUE_PEAK_EXCEEDED',
    sources: ['bs1770gain'],
    severity: 'high',
    category: 'audio',
    description: 'True Peak excede -1 dBTP (EBU R128). Normalização de loudness falhou.',
    isRetryable: true,
    suggestedFixId: 'FIX_TRUE_PEAK_AGGRESSIVE',
  },

  {
    id: 'LUFS_DEVIATION',
    regex: /LUFS integrado\s+([-\d.]+)\s+desvia\s+([\d.]+)\s+LU/i,
    errorCode: 'LUFS_DEVIATION',
    sources: ['bs1770gain'],
    severity: 'high',
    category: 'audio',
    description: 'LUFS integrado desvia mais de 1 LU do target. Two-pass EBU R128 falhou.',
    isRetryable: true,
    suggestedFixId: 'FIX_LUFS_OFFSET',
  },

  // ── MÉDIO: Conformidade e warnings ────────────────────────────

  {
    id: 'MEDIACONCH_FAIL',
    regex: /MediaConch regra "([^"]+)": FAIL/i,
    errorCode: 'MEDIACONCH_FAIL',
    sources: ['mediaconch'],
    severity: 'medium',
    category: 'compliance',
    description: 'Ficheiro não conforme com política MediaConch. Verificar regra falhada.',
    isRetryable: false,
    suggestedFixId: undefined,
  },

  {
    id: 'BS1770_PARSE_ERROR',
    regex: /Falha ao parsear XML do BS1770GAIN/i,
    errorCode: 'BS1770_PARSE_ERROR',
    sources: ['bs1770gain'],
    severity: 'medium',
    category: 'audio',
    description: 'BS1770GAIN não retornou XML válido — ferramenta pode não estar instalada.',
    isRetryable: true,
    suggestedFixId: 'FIX_FFMPEG_LOUDNESS_FALLBACK',
  },

  {
    id: 'MEDIAINFO_NO_TRACKS',
    regex: /MediaInfo não retornou tracks/i,
    errorCode: 'MEDIAINFO_NO_TRACKS',
    sources: ['mediainfo'],
    severity: 'medium',
    category: 'container',
    description: 'MediaInfo não detectou streams — ficheiro possivelmente vazio ou corrompido.',
    isRetryable: false,
    suggestedFixId: undefined,
  },

  {
    id: 'VFR_DETECTED',
    regex: /Frame Rate variável \(VFR\)/i,
    errorCode: 'VFR_DETECTED',
    sources: ['mediainfo'],
    severity: 'medium',
    category: 'stream',
    description: 'Stream com frame rate variável — problemas esperados em outputs broadcast.',
    isRetryable: true,
    suggestedFixId: 'FIX_FORCE_CFR',
  },

  // ── BullMQ: Queue events ──────────────────────────────────────

  {
    id: 'BULLMQ_JOB_STALLED',
    regex: /BullMQ .* stalled/i,
    errorCode: 'BULLMQ_JOB_STALLED',
    sources: ['bullmq'],
    severity: 'high',
    category: 'queue',
    description: 'Job BullMQ em stall — worker pode ter crashado ou ficado sem memória.',
    isRetryable: true,
    suggestedFixId: undefined,
  },

  {
    id: 'BULLMQ_JOB_FAILED',
    regex: /BullMQ .* failed/i,
    errorCode: 'BULLMQ_JOB_FAILED',
    sources: ['bullmq'],
    severity: 'high',
    category: 'queue',
    description: 'Job BullMQ falhou após todas as tentativas — enviado para dead-letter queue.',
    isRetryable: false,
    suggestedFixId: undefined,
  },

  // ── STREAM CORROMPIDO: Análise de fluxos de vídeo corrompidos ──

  {
    id: 'CORRUPTED_HEADER',
    regex: /Header missing|Could not find codec parameters|missing codec parameters|Invalid codec tag|codec not found/i,
    errorCode: 'CORRUPTED_HEADER',
    sources: ['ffmpeg', 'mediainfo'],
    severity: 'critical',
    category: 'container',
    description: 'Header do stream corrompido ou parâmetros de codec em falta. O ficheiro pode ter sido truncado no início.',
    isRetryable: false,
    suggestedFixId: undefined,
  },

  {
    id: 'TRUNCATED_FILE',
    regex: /Discarding\s+\d+\s+bytes.*truncat|Unexpected end of file|unexpected EOF|End of file while reading|no such file or directory.*\.part/i,
    errorCode: 'TRUNCATED_FILE',
    sources: ['ffmpeg', 'mediainfo'],
    severity: 'critical',
    category: 'container',
    description: 'Ficheiro truncado ou incompleto — transmissão interrompida ou download incompleto.',
    isRetryable: false,
    suggestedFixId: undefined,
  },

  {
    id: 'CORRUPTED_FRAMES',
    regex: /error while decoding MB|decode_slice_header error|non-existing PPS|Concealment\s+\d+\s+MBs|slice type.*not implemented|SEI type.*not implemented|cabac_init_idc overflow/i,
    errorCode: 'CORRUPTED_FRAMES',
    sources: ['ffmpeg'],
    severity: 'high',
    category: 'stream',
    description: 'Frames corrompidos no stream de vídeo — dados de slice inválidos ou macroblocos em falta.',
    isRetryable: true,
    suggestedFixId: 'FIX_ERR_DETECT',
  },

  {
    id: 'MISSING_REFERENCE_FRAMES',
    regex: /Missing reference picture|short-term ref.*missing|long-term ref.*missing|reference picture list|no reference frame/i,
    errorCode: 'MISSING_REFERENCE_FRAMES',
    sources: ['ffmpeg'],
    severity: 'high',
    category: 'stream',
    description: 'Reference frames em falta — estrutura GOP corrompida. Comum em ficheiros com segmentos em falta.',
    isRetryable: true,
    suggestedFixId: 'FIX_ERR_DETECT',
  },

  {
    id: 'BITSTREAM_CORRUPTION',
    regex: /Invalid NAL unit size|illegal temporal_id|non-existing SPS|forbidden_zero_bit|SPS id.*out of range|PPS id.*out of range|slice.*NAL.*corrupted/i,
    errorCode: 'BITSTREAM_CORRUPTION',
    sources: ['ffmpeg'],
    severity: 'critical',
    category: 'stream',
    description: 'Bitstream H.264/H.265 estruturalmente corrompido — NAL units inválidas ou parâmetros fora de range.',
    isRetryable: true,
    suggestedFixId: 'FIX_COPY_UNKNOWN',
  },

  {
    id: 'AUDIO_SYNC_DRIFT',
    regex: /discarding\s+\d+\s+audio (packets|frames)|audio timestamp discontinuity|A\/V sync.*lost|av_interleaved_write_frame.*Audio|pts.*not monotonically.*audio/i,
    errorCode: 'AUDIO_SYNC_DRIFT',
    sources: ['ffmpeg'],
    severity: 'medium',
    category: 'audio',
    description: 'Drift ou dessincronização de áudio detectados — timestamps de áudio não monotónicos ou saltos no PTS.',
    isRetryable: true,
    suggestedFixId: 'FIX_ASYNC_AUDIO',
  },

  {
    id: 'INTERLACE_MISMATCH',
    regex: /Discarding mismatched.*field order|interlacing.*mismatch|field dominance.*mismatch|interlaced.*conflict|top field first.*mismatch/i,
    errorCode: 'INTERLACE_MISMATCH',
    sources: ['ffmpeg', 'mediainfo'],
    severity: 'medium',
    category: 'stream',
    description: 'Conflito de interlacing detectado — a source declara field order diferente do que está nos dados.',
    isRetryable: true,
    suggestedFixId: 'FIX_DEINTERLACE',
  },

  {
    id: 'CONTAINER_CORRUPTION',
    regex: /corrupt input|mdat.*corrupt|ftyp.*invalid|fragment.*overlap|index.*corrupt|stco.*out of range|moov.*corrupt|chunk offset.*invalid/i,
    errorCode: 'CONTAINER_CORRUPTION',
    sources: ['ffmpeg', 'mediainfo'],
    severity: 'critical',
    category: 'container',
    description: 'Container MP4/MKV estruturalmente danificado — atoms/boxes com offsets inválidos ou overlapping.',
    isRetryable: false,
    suggestedFixId: undefined,
  },
];


// Índice por ID para acesso O(1)
const PATTERN_INDEX = new Map<string, ErrorPattern>(
  ERROR_PATTERNS.map(p => [p.id, p])
);

// ── Matcher ───────────────────────────────────────────────────────

export class NexoraPatternMatcher {

  /**
   * Analisa uma lista de entradas de log e retorna todas as correspondências.
   * Cada entrada pode corresponder a zero ou mais padrões.
   */
  match(entries: ParsedLogEntry[]): PatternMatch[] {
    const matches: PatternMatch[] = [];

    for (const entry of entries) {
      const entryMatches = this.matchSingle(entry);
      matches.push(...entryMatches);
    }

    // Ordenar por severidade (mais grave primeiro) e depois por timestamp
    return matches.sort((a, b) => {
      const severityOrder: Record<PatternSeverity, number> = {
        critical: 0, high: 1, medium: 2, low: 3,
      };
      const diff = severityOrder[a.pattern.severity] - severityOrder[b.pattern.severity];
      return diff !== 0 ? diff : a.entry.timestamp.localeCompare(b.entry.timestamp);
    });
  }

  /**
   * Analisa uma única entrada de log e retorna todos os padrões que correspondem.
   */
  matchSingle(entry: ParsedLogEntry): PatternMatch[] {
    const results: PatternMatch[] = [];

    for (const pattern of ERROR_PATTERNS) {
      // Verificar se a fonte é relevante para este padrão
      if (!pattern.sources.includes(entry.source)) continue;

      // Testar regex contra a mensagem
      const regexMatch = pattern.regex.exec(entry.message);

      // Testar também por error_code nos metadados
      const errorCodeMatch =
        pattern.errorCode &&
        entry.metadata['error_code'] === pattern.errorCode;

      if (!regexMatch && !errorCodeMatch) continue;

      // Extrair grupos de captura nomeados
      const captureGroups: Record<string, string> = {};
      if (regexMatch) {
        for (let i = 1; i < regexMatch.length; i++) {
          captureGroups[`group${i}`] = regexMatch[i] ?? '';
        }
        // Tentar grupos nomeados (se o regex os suportar)
        if (regexMatch.groups) {
          Object.assign(captureGroups, regexMatch.groups);
        }
      }

      // Confiança: mais alta se ambos regex E error_code correspondem
      const confidence = regexMatch && errorCodeMatch ? 1.0 : 0.85;

      results.push({
        pattern,
        entry,
        matchedText: regexMatch?.[0] ?? entry.message.slice(0, 100),
        captureGroups,
        confidence,
      });
    }

    return results;
  }

  /**
   * Obtém um padrão pelo ID.
   */
  getPattern(id: string): ErrorPattern | undefined {
    return PATTERN_INDEX.get(id);
  }

  /**
   * Retorna todos os padrões com uma determinada severidade.
   */
  getPatternsBySeverity(severity: PatternSeverity): ErrorPattern[] {
    return ERROR_PATTERNS.filter(p => p.severity === severity);
  }

  /**
   * Retorna todos os padrões de uma categoria.
   */
  getPatternsByCategory(category: PatternCategory): ErrorPattern[] {
    return ERROR_PATTERNS.filter(p => p.category === category);
  }

  /**
   * Determina a severidade máxima de um conjunto de correspondências.
   */
  getMaxSeverity(matches: PatternMatch[]): PatternSeverity | null {
    if (matches.length === 0) return null;
    const order: Record<PatternSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return matches.reduce((max, m) =>
      order[m.pattern.severity] < order[max.pattern.severity] ? m : max,
      matches[0]!
    ).pattern.severity;
  }

  /**
   * Verifica se há algum padrão crítico não-retryable no conjunto.
   */
  hasTerminalError(matches: PatternMatch[]): boolean {
    return matches.some(m => m.pattern.severity === 'critical' && !m.pattern.isRetryable);
  }

  /**
   * Filtra correspondências retryable (críticos não-retryable excluídos).
   */
  getRetryableMatches(matches: PatternMatch[]): PatternMatch[] {
    return matches.filter(m => m.pattern.isRetryable);
  }
}

// ── Singleton ─────────────────────────────────────────────────────

export const patternMatcher = new NexoraPatternMatcher();
