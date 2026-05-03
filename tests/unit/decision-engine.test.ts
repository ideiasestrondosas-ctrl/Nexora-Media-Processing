import { describe, it, expect, vi, beforeEach } from 'vitest';
import { diagnosticEngine } from '../../src/observability/diagnostic-engine';
import { patternMatcher } from '../../src/observability/pattern-matcher';
import { fixSuggester } from '../../src/observability/fix-suggester';
import { retryAdvisor } from '../../src/observability/retry-advisor';

describe('Diagnostic Engine (Decision Engine)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve diagnosticar e decidir falha não classificada quando não há logs', () => {
    const result = diagnosticEngine.diagnose({
      jobId: 'job-1',
      assetId: 'asset-1',
      error: new Error('Unknown JS error'),
    });

    expect(result.jobId).toBe('job-1');
    expect(result.patterns).toHaveLength(0);
    expect(result.severity).toBeNull();
    expect(result.fixes).toHaveLength(0);
    expect(result.summary).toContain('nenhum padrão conhecido');
  });

  it('deve identificar erro MOOV_NOT_FOUND como crítico e recusar retry', () => {
    const ffmpegStderr = `
      [mov,mp4,m4a,3gp,3g2,mj2 @ 0x12345] moov atom not found
      tests/fixtures/data/corrupted.mp4: Invalid data found when processing input
    `;

    const result = diagnosticEngine.diagnose({
      jobId: 'job-2',
      assetId: 'asset-2',
      ffmpegStderr,
    });

    expect(result.severity).toBe('critical');
    const hasMoovPattern = result.patterns.some(p => p.pattern.id === 'MOOV_NOT_FOUND');
    expect(hasMoovPattern).toBe(true);

    // Erros críticos terminais (como moov not found) geralmente não têm retry.
    expect(result.retryConfig.shouldRetry).toBe(false);
  });

  it('deve identificar erro NVENC_ERROR e sugerir FIX_CPU_FALLBACK com retry', () => {
    const ffmpegStderr = `
      [h264_nvenc @ 0x560] InitializeEncoder failed: 12 (NVENC unsupported device)
      Error initializing output stream 0:0 -- Error while opening encoder for output stream #0:0
    `;

    const result = diagnosticEngine.diagnose({
      jobId: 'job-3',
      assetId: 'asset-3',
      ffmpegStderr,
    });

    expect(result.severity).toBe('high');
    const hasNvencError = result.patterns.some(p => p.pattern.id === 'NVENC_ERROR');
    expect(hasNvencError).toBe(true);

    const hasCpuFallbackFix = result.fixes.some(f => f.id === 'FIX_CPU_FALLBACK');
    expect(hasCpuFallbackFix).toBe(true);

    expect(result.retryConfig.shouldRetry).toBe(true);
  });

  it('deve identificar TRUE_PEAK_EXCEEDED num log BS1770GAIN', () => {
    const bs1770gainXml = `
      <bs1770gain>
        <track total="1">
          <integrated lufs="-23.5" />
          <true-peak dbtp="1.5" />
        </track>
      </bs1770gain>
    `;

    const result = diagnosticEngine.diagnose({
      jobId: 'job-4',
      assetId: 'asset-4',
      bs1770gainXml,
      truePeakLimit: -1.0,
    });

    expect(result.severity).toBe('high');
    const hasTruePeakPattern = result.patterns.some(p => p.pattern.id === 'TRUE_PEAK_EXCEEDED');
    expect(hasTruePeakPattern).toBe(true);

    const hasAggressivePeakFix = result.fixes.some(f => f.id === 'FIX_TRUE_PEAK_AGGRESSIVE');
    expect(hasAggressivePeakFix).toBe(true);
  });

  it('deve identificar VFR através de log de erro do MediaInfo', () => {
    const mediaInfoJson = JSON.stringify({
      media: {
        track: [
          {
            '@type': 'Video',
            FrameRate_Mode: 'VFR',
          }
        ]
      }
    });

    const result = diagnosticEngine.diagnose({
      jobId: 'job-5',
      assetId: 'asset-5',
      mediaInfoJson,
    });

    // O MediaInfo log parser cria um source='mediainfo'
    const hasVfrPattern = result.patterns.some(p => p.pattern.id === 'VFR_DETECTED');
    expect(hasVfrPattern).toBe(true);
    expect(result.fixes.some(f => f.id === 'FIX_FORCE_CFR')).toBe(true);
  });
});
