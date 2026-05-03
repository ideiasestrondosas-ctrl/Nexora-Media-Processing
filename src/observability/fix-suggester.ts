// Nexora Media Processing — Fix Suggester
// Ficheiro: src/observability/fix-suggester.ts
//
// Mapeia padrões de erro reconhecidos para correcções concretas de FFmpeg.
// Cada sugestão inclui flags a adicionar/remover, overrides de configuração
// e explicação técnica da razão da correcção.
//
// ADR-002: Todas as flags sugeridas são arrays — nunca strings de shell.

import type { PatternMatch } from './pattern-matcher';

// ── Tipos Públicos ────────────────────────────────────────────────

export type FixConfidence = 'high' | 'medium' | 'low';
export type FixRiskLevel = 'safe' | 'moderate' | 'risky';

/** Sugestão de correcção para um padrão de erro */
export interface FixSuggestion {
  /** Identificador único desta correcção */
  id: string;
  /** Padrão(ões) a que esta correcção se aplica */
  patternIds: string[];
  /** Título curto da correcção */
  title: string;
  /** Explicação técnica detalhada */
  explanation: string;
  /** Flags FFmpeg a ADICIONAR (ADR-002: sempre array) */
  ffmpegFlagsAdd?: string[];
  /** Flags FFmpeg a REMOVER do comando base */
  ffmpegFlagsRemove?: string[];
  /** Flags de input FFmpeg (antes do -i) */
  ffmpegInputFlags?: string[];
  /** Filtros de áudio FFmpeg para -af */
  ffmpegAudioFilter?: string;
  /** Overrides de variáveis de ambiente */
  envOverrides?: Record<string, string>;
  /** Forçar encoder específico */
  encoderOverride?: 'cpu' | 'nvenc' | 'qsv' | 'amf';
  /** Confiança de que esta correcção resolve o problema */
  confidence: FixConfidence;
  /** Risco de alteração de qualidade ou comportamento */
  riskLevel: FixRiskLevel;
  /** Se esta correcção altera a qualidade do output */
  affectsQuality: boolean;
}

// ── Catálogo de Correcções ────────────────────────────────────────

const FIX_CATALOG: FixSuggestion[] = [

  // ── Timestamps ────────────────────────────────────────────────

  {
    id: 'FIX_IGNDTS',
    patternIds: ['DTS_OUT_OF_ORDER'],
    title: 'Ignorar timestamps DTS fora de ordem (-fflags +igndts)',
    explanation:
      'O ficheiro tem timestamps DTS não monotónicos. ' +
      'A flag -fflags +igndts instrui o FFmpeg a ignorar DTS inválidos ' +
      'e recalculá-los a partir do PTS. ' +
      'Safe para a maioria dos conteúdos; pode causar drift mínimo em streams longas.',
    ffmpegInputFlags: ['-fflags', '+igndts'],
    confidence: 'high',
    riskLevel: 'safe',
    affectsQuality: false,
  },

  {
    id: 'FIX_VBV_BUFFER',
    patternIds: ['PAST_DURATION_LARGE'],
    title: 'Duplicar VBV buffer para evitar past-duration overflow',
    explanation:
      'O VBV buffer está a transbordar causando warnings de "past duration too large". ' +
      'Duplicar o bufsize resolve o problema para conteúdo de alta variância bitrate. ' +
      'Nota: o bufsize específico depende do perfil — o worker deve ajustar dinamicamente.',
    ffmpegFlagsAdd: ['-x264-params', 'vbv-bufsize=40000:vbv-maxrate=15000'],
    confidence: 'medium',
    riskLevel: 'safe',
    affectsQuality: false,
  },

  {
    id: 'FIX_FORCE_CFR',
    patternIds: ['VFR_DETECTED'],
    title: 'Forçar CFR no input com -vsync cfr',
    explanation:
      'Stream de entrada com VFR (Variable Frame Rate). ' +
      'Para outputs broadcast é obrigatório CFR. ' +
      'A flag -vsync cfr força frame rate constante inserindo frames duplicados conforme necessário.',
    ffmpegFlagsAdd: ['-vsync', 'cfr', '-r', '25'],
    confidence: 'high',
    riskLevel: 'safe',
    affectsQuality: false,
  },

  // ── GPU / Recursos ────────────────────────────────────────────

  {
    id: 'FIX_CPU_FALLBACK',
    patternIds: ['NVENC_ERROR'],
    title: 'Fallback para encoder CPU (libx264)',
    explanation:
      'O encoder GPU NVENC falhou (driver incompatível, VRAM insuficiente, ou GPU não disponível). ' +
      'Mudar para libx264 em CPU garante compatibilidade total. ' +
      'Performance reduzida em ~4× mas output idêntico em qualidade.',
    ffmpegFlagsRemove: ['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda'],
    encoderOverride: 'cpu',
    confidence: 'high',
    riskLevel: 'safe',
    affectsQuality: false,
  },

  {
    id: 'FIX_REDUCE_THREADS',
    patternIds: ['OUT_OF_MEMORY'],
    title: 'Reduzir threads FFmpeg para aliviar pressão de memória',
    explanation:
      'Sistema sem memória disponível para o encode. ' +
      'Limitar o FFmpeg a 2 threads reduz o footprint de memória em ~60-70% ' +
      'ao custo de velocidade de encode mais lenta.',
    ffmpegFlagsAdd: ['-threads', '2'],
    confidence: 'medium',
    riskLevel: 'safe',
    affectsQuality: false,
  },

  {
    id: 'FIX_INCREASE_TIMEOUT',
    patternIds: ['PIPE_BROKEN'],
    title: 'Duplicar timeout FFmpeg e aumentar buffer de pipe',
    explanation:
      'Broken pipe sugere que o processo foi terminado por timeout ou por falta de ' +
      'consumo do output. Duplicar o timeout e o buffer resolve a maioria dos casos.',
    envOverrides: {
      FFMPEG_DEFAULT_TIMEOUT_MS: String(14400000 * 2), // 8h
    },
    confidence: 'medium',
    riskLevel: 'moderate',
    affectsQuality: false,
  },

  // ── Áudio / Loudness ──────────────────────────────────────────

  {
    id: 'FIX_TRUE_PEAK_AGGRESSIVE',
    patternIds: ['TRUE_PEAK_EXCEEDED'],
    title: 'Aplicar limiter mais agressivo para True Peak ≤ -2 dBTP',
    explanation:
      'O True Peak medido excede o limite EBU R128 de -1 dBTP. ' +
      'Usar TP=-2.0 no loudnorm em vez de -1.0 cria margem de segurança adicional ' +
      'para lidar com rounding errors no encoder de destino. ' +
      'Impacto na loudness percebida: negligenciável (<0.5 dB).',
    ffmpegAudioFilter: 'loudnorm=I=-23:TP=-2.0:LRA=11:linear=true',
    confidence: 'high',
    riskLevel: 'safe',
    affectsQuality: true,
  },

  {
    id: 'FIX_LUFS_OFFSET',
    patternIds: ['LUFS_DEVIATION'],
    title: 'Ajustar offset LUFS no two-pass para corrigir desvio',
    explanation:
      'O LUFS integrado desvia mais de 1 LU do target após normalização two-pass. ' +
      'O módulo NexoraLoudnessNormalizer já implementa retry com offset ±0.5 LU. ' +
      'Esta sugestão confirma que a lógica de retry deve ser activada para este job.',
    confidence: 'high',
    riskLevel: 'safe',
    affectsQuality: true,
  },

  {
    id: 'FIX_FFMPEG_LOUDNESS_FALLBACK',
    patternIds: ['BS1770_PARSE_ERROR'],
    title: 'Usar FFmpeg como verificação de loudness em fallback',
    explanation:
      'BS1770GAIN não está disponível ou retornou XML inválido. ' +
      'O sistema já tem fallback para FFmpeg loudnorm implementado em loudness.ts. ' +
      'Verificar instalação do BS1770GAIN para conformidade total com ADR-009.',
    confidence: 'medium',
    riskLevel: 'safe',
    affectsQuality: false,
  },
];

// Índice por ID para acesso O(1)
const FIX_INDEX = new Map<string, FixSuggestion>(
  FIX_CATALOG.map(f => [f.id, f])
);

// Índice por patternId → lista de fixes
const FIX_BY_PATTERN = new Map<string, FixSuggestion[]>();
for (const fix of FIX_CATALOG) {
  for (const pid of fix.patternIds) {
    const existing = FIX_BY_PATTERN.get(pid) ?? [];
    existing.push(fix);
    FIX_BY_PATTERN.set(pid, existing);
  }
}

// ── Fix Suggester ─────────────────────────────────────────────────

export class NexoraFixSuggester {

  /**
   * Retorna sugestões de correcção para um conjunto de correspondências de padrões.
   * Deduplica por fix ID — um fix pode ser sugerido por múltiplos padrões.
   */
  suggest(matches: PatternMatch[]): FixSuggestion[] {
    const seen = new Set<string>();
    const suggestions: FixSuggestion[] = [];

    for (const match of matches) {
      const fixes = FIX_BY_PATTERN.get(match.pattern.id) ?? [];
      for (const fix of fixes) {
        if (seen.has(fix.id)) continue;
        seen.add(fix.id);
        suggestions.push(fix);
      }

      // Também tentar pelo suggestedFixId directo do padrão
      if (match.pattern.suggestedFixId) {
        const directFix = FIX_INDEX.get(match.pattern.suggestedFixId);
        if (directFix && !seen.has(directFix.id)) {
          seen.add(directFix.id);
          suggestions.push(directFix);
        }
      }
    }

    // Ordenar: high confidence + safe primeiro
    return suggestions.sort((a, b) => {
      const confOrder: Record<FixConfidence, number> = { high: 0, medium: 1, low: 2 };
      const riskOrder: Record<FixRiskLevel, number> = { safe: 0, moderate: 1, risky: 2 };
      const confDiff = confOrder[a.confidence] - confOrder[b.confidence];
      return confDiff !== 0 ? confDiff : riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    });
  }

  /**
   * Obtém uma sugestão de correcção pelo ID.
   */
  getSuggestionById(id: string): FixSuggestion | null {
    return FIX_INDEX.get(id) ?? null;
  }

  /**
   * Retorna todos os fixes disponíveis para um padrão específico.
   */
  getFixesForPattern(patternId: string): FixSuggestion[] {
    return FIX_BY_PATTERN.get(patternId) ?? [];
  }

  /**
   * Agrega os flags FFmpeg de múltiplas sugestões num único conjunto.
   * Remove duplicados e trata conflitos (ex: flags em add E remove).
   */
  aggregateFFmpegFlags(suggestions: FixSuggestion[]): {
    inputFlags: string[];
    outputFlags: string[];
    flagsToRemove: string[];
    audioFilter?: string;
    encoderOverride?: string;
    envOverrides: Record<string, string>;
  } {
    const inputFlags = new Set<string>();
    const outputFlags = new Set<string>();
    const flagsToRemove = new Set<string>();
    const envOverrides: Record<string, string> = {};
    let audioFilter: string | undefined;
    let encoderOverride: string | undefined;

    for (const fix of suggestions) {
      // Input flags (-fflags, -hwaccel etc. que vão antes do -i)
      if (fix.ffmpegInputFlags) {
        for (const f of fix.ffmpegInputFlags) inputFlags.add(f);
      }
      // Output flags
      if (fix.ffmpegFlagsAdd) {
        for (const f of fix.ffmpegFlagsAdd) outputFlags.add(f);
      }
      // Flags a remover
      if (fix.ffmpegFlagsRemove) {
        for (const f of fix.ffmpegFlagsRemove) flagsToRemove.add(f);
      }
      // Env
      if (fix.envOverrides) {
        Object.assign(envOverrides, fix.envOverrides);
      }
      // Audio filter (última sugestão ganha)
      if (fix.ffmpegAudioFilter) {
        audioFilter = fix.ffmpegAudioFilter;
      }
      // Encoder override (última sugestão ganha)
      if (fix.encoderOverride) {
        encoderOverride = fix.encoderOverride;
      }
    }

    // Remover flags do outputFlags que estão em flagsToRemove
    for (const f of flagsToRemove) {
      outputFlags.delete(f);
    }

    return {
      inputFlags: [...inputFlags],
      outputFlags: [...outputFlags],
      flagsToRemove: [...flagsToRemove],
      audioFilter,
      encoderOverride,
      envOverrides,
    };
  }
}

// ── Singleton ─────────────────────────────────────────────────────

export const fixSuggester = new NexoraFixSuggester();
