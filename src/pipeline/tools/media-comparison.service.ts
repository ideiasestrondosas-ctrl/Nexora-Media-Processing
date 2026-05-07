// Nexora Media Processing — Media Comparison Service
// Ficheiro: src/pipeline/tools/media-comparison.service.ts
//
// Serviço dedicado para comparação de análises MediaInfo antes/depois do encode.
// Detecta regressões de qualidade e gera relatórios diferenciais.

import type {
  NexoraFullMediaInfo,
  MediaComparisonResult,
  MediaFieldDiff,
} from './mediainfo-adapter';
import type { QCResult } from '../../qc/rules/index';
import { mediainfoAdapter } from './mediainfo-adapter';
import { logger } from '../../observability/logger';

// ── Service ──────────────────────────────────────────────────────

export class MediaComparisonService {

  /**
   * Analisa input e output e compara os resultados.
   */
  async compare(
    inputPath: string,
    outputPath: string
  ): Promise<MediaComparisonResult> {
    const [beforeFull, afterFull] = await Promise.all([
      mediainfoAdapter.analyzeFullMetadata(inputPath),
      mediainfoAdapter.analyzeFullMetadata(outputPath),
    ]);

    return mediainfoAdapter.compareAnalysis(beforeFull, afterFull);
  }

  /**
   * Compara duas análises já obtidas (evita re-análise).
   */
  compareAnalyses(
    before: NexoraFullMediaInfo,
    after: NexoraFullMediaInfo
  ): MediaComparisonResult {
    return mediainfoAdapter.compareAnalysis(before, after);
  }

  /**
   * Gera um relatório human-readable em Markdown a partir do resultado comparativo.
   */
  generateReport(
    comparison: MediaComparisonResult,
    inputPath?: string,
    outputPath?: string
  ): string {
    const lines: string[] = [];
    const { videoChanged, audioChanged, containerChanged, qualityIndicators } = comparison;
    const qi = qualityIndicators;

    lines.push('# Relatório de Comparação MediaInfo');
    lines.push('');
    if (inputPath) lines.push(`**Input:** \`${inputPath}\``);
    if (outputPath) lines.push(`**Output:** \`${outputPath}\``);
    lines.push('');

    // Indicadores de qualidade
    lines.push('## Indicadores de Qualidade');
    lines.push('');
    lines.push(`| Indicador | Valor |`);
    lines.push(`|---|---|`);
    lines.push(`| Bitrate ratio (output/input) | ${qi.bitrateRatio.toFixed(3)}x |`);
    lines.push(`| File size ratio (output/input) | ${qi.fileSizeRatio.toFixed(3)}x |`);
    lines.push(`| Duração delta | ${qi.durationDelta >= 0 ? '+' : ''}${qi.durationDelta.toFixed(3)}s |`);
    lines.push(`| Resolução alterada | ${qi.resolutionChanged ? '⚠️ Sim' : '✅ Não'} |`);
    lines.push(`| Codec alterado | ${qi.codecChanged ? '⚠️ Sim' : '✅ Não'} |`);
    lines.push('');

    const appendDiffs = (title: string, diffs: MediaFieldDiff[]) => {
      if (diffs.length === 0) {
        lines.push(`## ${title}`);
        lines.push('');
        lines.push('✅ Sem alterações.');
        lines.push('');
        return;
      }
      lines.push(`## ${title} (${diffs.length} alteração(ões))`);
      lines.push('');
      lines.push('| Campo | Antes | Depois |');
      lines.push('|---|---|---|');
      for (const diff of diffs) {
        lines.push(`| \`${diff.field}\` | ${diff.before ?? '—'} | ${diff.after ?? '—'} |`);
      }
      lines.push('');
    };

    appendDiffs('Vídeo', videoChanged);
    appendDiffs('Áudio', audioChanged);
    appendDiffs('Container', containerChanged);

    return lines.join('\n');
  }

  /**
   * Verifica se houve regressão de qualidade significativa.
   * Retorna QCResult[] com warnings/erros para incluir no relatório QC.
   */
  checkQualityRegression(comparison: MediaComparisonResult): QCResult[] {
    const results: QCResult[] = [];
    const qi = comparison.qualityIndicators;

    // Bitrate muito baixo em relação ao input pode indicar perda de qualidade
    if (qi.bitrateRatio < 0.3 && qi.bitrateRatio > 0) {
      results.push({
        pass: false,
        severity: 'warning',
        code: 'WARN_BITRATE_RATIO_LOW',
        detail: `Bitrate do output é ${(qi.bitrateRatio * 100).toFixed(1)}% do input — possível degradação de qualidade`,
        measuredValue: qi.bitrateRatio,
        expectedValue: '≥ 0.3x',
      });
    }

    // Duração muito diferente (> 2s de desvio) sugere problema de encode
    if (Math.abs(qi.durationDelta) > 2.0) {
      results.push({
        pass: false,
        severity: 'warning',
        code: 'WARN_DURATION_MISMATCH',
        detail: `Duração do output difere do input em ${qi.durationDelta.toFixed(3)}s (threshold: ±2s)`,
        measuredValue: qi.durationDelta,
        expectedValue: '±2s',
      });
    }

    // Codec alterado quando não era suposto
    if (qi.codecChanged) {
      results.push({
        pass: false,
        severity: 'warning',
        code: 'WARN_CODEC_CHANGED',
        detail: `Codec foi alterado no output — verificar se era intencional`,
      });
    }

    // File size muito maior que o input (possível problema de configuração)
    if (qi.fileSizeRatio > 5.0) {
      results.push({
        pass: false,
        severity: 'warning',
        code: 'WARN_FILE_SIZE_INFLATED',
        detail: `Ficheiro de output é ${qi.fileSizeRatio.toFixed(1)}x maior que o input — verificar configuração do encode`,
        measuredValue: qi.fileSizeRatio,
        expectedValue: '≤ 5x',
      });
    }

    // Verificar se há diff nos campos de vídeo que indicam problema
    const criticalFields = ['width', 'height', 'frameRate', 'bitDepth'];
    for (const diff of comparison.videoChanged) {
      if (criticalFields.includes(diff.field)) {
        results.push({
          pass: false,
          severity: 'warning',
          code: `WARN_VIDEO_${diff.field.toUpperCase()}_CHANGED`,
          detail: `Campo de vídeo "${diff.field}" foi alterado: ${diff.before} → ${diff.after}`,
          measuredValue: String(diff.after),
          expectedValue: String(diff.before),
        });
      }
    }

    if (results.length === 0) {
      results.push({
        pass: true,
        severity: 'info',
        code: 'POST_ENCODE_QC_OK',
        detail: 'Sem regressões de qualidade detectadas no output',
      });
    }

    logger.debug(
      { results: results.length, warnings: results.filter(r => !r.pass).length },
      'MediaComparisonService: checkQualityRegression concluído'
    );

    return results;
  }
}

// ── Singleton ────────────────────────────────────────────────────

export const mediaComparisonService = new MediaComparisonService();
