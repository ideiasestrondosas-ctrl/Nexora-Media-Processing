// Nexora Media Processing — Decision Engine
// Ficheiro: src/pipeline/decision-engine.ts
//
// Motor de decisão determinístico: 9 regras explícitas, sem ambiguidade.
// Dado o resultado da análise QC de um ficheiro, decide exactamente o que fazer.
//
// Regras (implementadas exactamente como especificado no ADR/prompt):
// 1. VFR detectado → TRANSCODE (CFR obrigatório)
// 2. Open GOP → TRANSCODE
// 3. B-frames > 0 AND target broadcast → TRANSCODE
// 4. pixelFormat != yuv420p AND não é HDR → TRANSCODE
// 5. True Peak > -1 dBTP → AUDIO_NORMALIZE
// 6. LUFS difere do target > 1 LU → AUDIO_NORMALIZE
// 7. Codec OK + GOP compliant + CFR + sem issues → COPY ou REMUX
// 8. GOP size = Math.round(frameRate) * 2
// 9. bufsize = maxrateKbps * 2

import type { NexoraQCInput } from '../qc/rules/index';

// ── Tipos públicos ───────────────────────────────────────────────

/** Acção de vídeo decidida pelo engine */
export type VideoAction = 'TRANSCODE' | 'COPY' | 'REMUX';

/** Acção de áudio decidida pelo engine */
export type AudioAction = 'NORMALIZE' | 'COPY' | 'REMUX';

/** Resultado completo da decisão */
export interface DecisionResult {
  /** Acção primária (vídeo) */
  videoAction: VideoAction;
  /** Acção de áudio */
  audioAction: AudioAction;
  /** Lista de razões que motivaram a decisão (para audit/debug) */
  reasons: string[];
  /** GOP size calculado pela regra 8 */
  calculatedGopSize: number;
  /** bufsize calculado pela regra 9 (kbps) */
  calculatedBufsizeKbps: number;
  /** true se a decisão final requer transcode de vídeo */
  requiresVideoTranscode: boolean;
  /** true se a decisão final requer normalização de áudio */
  requiresAudioNormalization: boolean;
}

/** Targets de encoding e loudness por perfil */
interface ProfileConfig {
  isBroadcast: boolean;
  targetLufs: number;
  maxrateKbps: number;
}

// ── Configuração de perfis ────────────────────────────────────────

const PROFILE_CONFIGS: Record<string, ProfileConfig> = {
  'broadcast-hd': { isBroadcast: true,  targetLufs: -23, maxrateKbps: 10000 },
  'ott-hd':       { isBroadcast: false, targetLufs: -16, maxrateKbps:  7000 },
  'web-sd':       { isBroadcast: false, targetLufs: -16, maxrateKbps:  3000 },
  'proxy':        { isBroadcast: false, targetLufs: -23, maxrateKbps:  1000 },
};

/** Formatos HDR — excluídos da regra 4 (não forçar yuv420p em HDR) */
const HDR_PIXEL_FORMATS = new Set([
  'yuv420p10le', 'yuv420p12le',
  'yuv422p10le', 'yuv422p12le',
  'yuv444p10le', 'yuv444p12le',
  'gbrp10le', 'gbrp12le',
]);

/** Codecs que suportam REMUX sem transcode */
const REMUX_COMPATIBLE_CODECS = new Set(['h264', 'hevc', 'av1']);

// ── Engine ───────────────────────────────────────────────────────

export class NexoraDecisionEngine {

  /**
   * Executa as 9 regras de decisão e retorna a acção determinística.
   *
   * @param input   - Metadados técnicos do ficheiro (da análise QC)
   * @param profile - Perfil de encoding alvo (ex: 'broadcast-hd')
   */
  decide(input: NexoraQCInput, profile?: string): DecisionResult {
    const targetProfile = profile ?? input.profile ?? 'broadcast-hd';
    const config = PROFILE_CONFIGS[targetProfile] ?? PROFILE_CONFIGS['broadcast-hd']!;
    const reasons: string[] = [];

    let requiresVideoTranscode = false;
    let requiresAudioNormalization = false;

    const { video, audio } = input;

    // ── Regra 1: VFR detectado → TRANSCODE ───────────────────────
    if (video.frameRateMode === 'VFR') {
      requiresVideoTranscode = true;
      reasons.push(`Regra 1: VFR detectado (frameRateMode=${video.frameRateMode}) — CFR obrigatório`);
    }

    // ── Regra 2: Open GOP → TRANSCODE ────────────────────────────
    if (video.gopType === 'OPEN') {
      requiresVideoTranscode = true;
      reasons.push(`Regra 2: Open GOP detectado — Closed GOP obrigatório (ADR-006)`);
    }

    // ── Regra 3: B-frames > 0 AND target broadcast → TRANSCODE ──
    if (video.bFrameCount > 0 && config.isBroadcast) {
      requiresVideoTranscode = true;
      reasons.push(
        `Regra 3: B-frames=${video.bFrameCount} > 0 em perfil broadcast — 0 B-frames obrigatório (ADR-006)`
      );
    }

    // ── Regra 4: pixelFormat != yuv420p AND não é HDR → TRANSCODE
    const isHDR = HDR_PIXEL_FORMATS.has(video.pixelFormat);
    if (video.pixelFormat !== 'yuv420p' && !isHDR) {
      requiresVideoTranscode = true;
      reasons.push(
        `Regra 4: pixelFormat=${video.pixelFormat} != yuv420p e não é HDR — conversão obrigatória (ADR-004)`
      );
    }

    // ── Regra 5: True Peak > -1 dBTP → AUDIO_NORMALIZE ──────────
    if (audio.truePeakDbtp !== null && audio.truePeakDbtp > -1.0) {
      requiresAudioNormalization = true;
      reasons.push(
        `Regra 5: True Peak=${audio.truePeakDbtp} dBTP > -1.0 dBTP — normalização obrigatória (ADR-005)`
      );
    }

    // ── Regra 6: LUFS difere do target > 1 LU → NORMALIZE ────────
    if (audio.integratedLufs !== null) {
      const lufsDeviation = Math.abs(audio.integratedLufs - config.targetLufs);
      if (lufsDeviation > 1.0) {
        requiresAudioNormalization = true;
        reasons.push(
          `Regra 6: LUFS=${audio.integratedLufs} difere do target ${config.targetLufs} em ${lufsDeviation.toFixed(2)} LU > 1 LU`
        );
      }
    }

    // ── Regra 7: Codec OK + GOP compliant + CFR + sem issues → COPY/REMUX
    const codecOk = REMUX_COMPATIBLE_CODECS.has(video.codec.toLowerCase());
    const gopCompliant = video.gopType === 'CLOSED' || video.gopType === 'UNKNOWN';
    const isCfr = video.frameRateMode === 'CFR';
    const noBFrameIssue = !config.isBroadcast || video.bFrameCount === 0;
    const pixFmtOk = video.pixelFormat === 'yuv420p' || isHDR;

    if (!requiresVideoTranscode) {
      if (reasons.length === 0) {
        // Sem problemas detectados
        if (codecOk && gopCompliant && isCfr && noBFrameIssue && pixFmtOk) {
          reasons.push(`Regra 7: Codec=${video.codec}, GOP=compliant, CFR — COPY/REMUX possível`);
        }
      }
    }

    // ── Regra 8: GOP size = Math.round(frameRate) * 2 ────────────
    const calculatedGopSize = Math.round(video.frameRate) * 2;

    // ── Regra 9: bufsize = maxrateKbps * 2 ───────────────────────
    const calculatedBufsizeKbps = config.maxrateKbps * 2;

    // ── Resolução final das acções ────────────────────────────────
    let videoAction: VideoAction;
    if (requiresVideoTranscode) {
      videoAction = 'TRANSCODE';
    } else if (codecOk) {
      // Mesmo codec — pode COPY (sem re-encode) ou REMUX (novo container)
      videoAction = 'REMUX';
    } else {
      videoAction = 'TRANSCODE';
    }

    const audioAction: AudioAction = requiresAudioNormalization ? 'NORMALIZE' : 'COPY';

    // Sem razões = ficheiro está em conformidade
    if (reasons.length === 0) {
      reasons.push('Ficheiro conforme — nenhuma transformação necessária');
    }

    return {
      videoAction,
      audioAction,
      reasons,
      calculatedGopSize,
      calculatedBufsizeKbps,
      requiresVideoTranscode,
      requiresAudioNormalization,
    };
  }
}

// ── Singleton ────────────────────────────────────────────────────

export const decisionEngine = new NexoraDecisionEngine();
