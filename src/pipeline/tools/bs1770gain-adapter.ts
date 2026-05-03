// Nexora Media Processing — BS1770GAIN Adapter
// Ficheiro: src/pipeline/tools/bs1770gain-adapter.ts
//
// Medição EBU R128 independente do FFmpeg (ADR-009).
// Consolida a lógica de parsing XML do BS1770GAIN que estava
// duplicada entre loudness.ts e log-parser.ts.
//
// ADR-002: execFile com array — nunca string concatenada.
// ADR-009: BS1770GAIN é a verificação definitiva de loudness.

import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../observability/logger';
import { bs1770gainMeasurements, bs1770gainDuration } from '../../observability/metrics';
import { toolRegistry } from './availability-checker';

const execFileAsync = promisify(execFile);

// ── Tipos ────────────────────────────────────────────────────────

export interface BS1770GainMeasurement {
  integratedLufs: number;
  truePeakDbtp: number;
  loudnessRange: number;
  samplePeak: number | null;
  duration: number | null;
  filename: string | null;
  /** Sempre true quando medido por BS1770GAIN (vs FFmpeg fallback) */
  verifiedByBS1770Gain: true;
}

export interface LoudnessVerification {
  compliant: boolean;
  measurement: BS1770GainMeasurement;
  targetLufs: number;
  truePeakLimit: number;
  lufsDeviation: number;
  lufsOk: boolean;
  truePeakOk: boolean;
}

// ── Constantes ───────────────────────────────────────────────────

const BS1770GAIN_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutos
const DEFAULT_CONCURRENCY = 4;

// ── Adapter ──────────────────────────────────────────────────────

export class NexoraBS1770GainAdapter {

  /**
   * Mede loudness EBU R128 de um ficheiro com BS1770GAIN.
   * @throws ToolNotAvailableError se BS1770GAIN não estiver instalado.
   */
  async measure(filePath: string): Promise<BS1770GainMeasurement> {
    toolRegistry.requireTool('bs1770gain');
    const bs1770gainPath = toolRegistry.getPath('bs1770gain');
    const startTime = Date.now();

    const { stdout } = await execFileAsync(
      bs1770gainPath,
      [
        '--integrated',
        '--true-peak',
        '--lra',
        '-o', 'xml',
        filePath,
      ],
      { timeout: BS1770GAIN_TIMEOUT_MS }
    );

    const measurement = this.parseXML(stdout);
    const durationSec = (Date.now() - startTime) / 1000;

    // Prometheus
    bs1770gainMeasurements.inc();
    bs1770gainDuration.observe(durationSec);

    logger.debug(
      {
        filePath,
        lufs: measurement.integratedLufs,
        truePeak: measurement.truePeakDbtp,
        lra: measurement.loudnessRange,
        durationSec,
      },
      'BS1770GAIN medição concluída'
    );

    return measurement;
  }

  /**
   * Mede múltiplos ficheiros em paralelo com concurrency controlada.
   */
  async measureBatch(filePaths: string[]): Promise<BS1770GainMeasurement[]> {
    const concurrency = Number(process.env.LOUDNESS_CONCURRENCY ?? DEFAULT_CONCURRENCY);
    const results: BS1770GainMeasurement[] = [];

    // Processar em chunks de `concurrency`
    for (let i = 0; i < filePaths.length; i += concurrency) {
      const chunk = filePaths.slice(i, i + concurrency);
      const chunkResults = await Promise.all(
        chunk.map(fp => this.measure(fp))
      );
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Verifica se um ficheiro está conforme EBU R128.
   * @param filePath       - Ficheiro a verificar
   * @param targetLufs     - LUFS alvo (ex: -23)
   * @param truePeakLimit  - True Peak máximo (ex: -1.0 dBTP)
   * @param maxDeviation   - Desvio LUFS máximo (ex: 0.5 LU)
   */
  async verify(
    filePath: string,
    targetLufs: number = -23,
    truePeakLimit: number = -1.0,
    maxDeviation: number = 0.5
  ): Promise<LoudnessVerification> {
    const measurement = await this.measure(filePath);

    const lufsDeviation = Math.abs(measurement.integratedLufs - targetLufs);
    const lufsOk = lufsDeviation <= maxDeviation;
    const truePeakOk = measurement.truePeakDbtp <= truePeakLimit;

    return {
      compliant: lufsOk && truePeakOk,
      measurement,
      targetLufs,
      truePeakLimit,
      lufsDeviation,
      lufsOk,
      truePeakOk,
    };
  }

  // ── Parsing XML ───────────────────────────────────────────────

  /**
   * Parseia o XML de output do BS1770GAIN.
   * Consolidação da lógica que estava em loudness.ts e log-parser.ts.
   */
  parseXML(xml: string): BS1770GainMeasurement {
    const lufsMatch =
      xml.match(/integrated[^>]*?lufs=['"]([-\d.]+)['"]/i) ??
      xml.match(/integrated[^>]*?value=['"]([-\d.]+)['"]/i) ??
      xml.match(/<integrated[^>]*>([-\d.]+)<\/integrated>/i) ??
      xml.match(/lufs=['"]([-\d.]+)['"]/i);

    const tpMatch =
      xml.match(/true[_-]?peak[^>]*?dbtp=['"]([-\d.]+)['"]/i) ??
      xml.match(/true[_-]?peak[^>]*?value=['"]([-\d.]+)['"]/i) ??
      xml.match(/<true[_-]?peak[^>]*>([-\d.]+)<\/true[_-]?peak>/i) ??
      xml.match(/dbtp=['"]([-\d.]+)['"]/i);

    const lraMatch =
      xml.match(/lra[^>]*?lu=['"]([-\d.]+)['"]/i) ??
      xml.match(/lra[^>]*?value=['"]([-\d.]+)['"]/i) ??
      xml.match(/<lra[^>]*>([-\d.]+)<\/lra>/i);

    const samplePeakMatch =
      xml.match(/sample[_-]?peak[^>]*?value=['"]([-\d.]+)['"]/i) ??
      xml.match(/<sample[_-]?peak[^>]*>([-\d.]+)<\/sample[_-]?peak>/i);

    const durationMatch = xml.match(/duration=['"]([\d.]+)['"]/i);
    const fileMatch = xml.match(/file=['""]([^'"]+)['"]/i);

    return {
      integratedLufs: lufsMatch ? Number(lufsMatch[1]) : 0,
      truePeakDbtp: tpMatch ? Number(tpMatch[1]) : 0,
      loudnessRange: lraMatch ? Number(lraMatch[1]) : 0,
      samplePeak: samplePeakMatch ? Number(samplePeakMatch[1]) : null,
      duration: durationMatch ? Number(durationMatch[1]) : null,
      filename: fileMatch?.[1] ?? null,
      verifiedByBS1770Gain: true,
    };
  }
}

// ── Singleton ────────────────────────────────────────────────────

export const bs1770gainAdapter = new NexoraBS1770GainAdapter();
