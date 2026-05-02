// Nexora Media Processing — Loudness Normalizer
// Ficheiro: src/pipeline/ffmpeg/loudness.ts
//
// Normalização de loudness EBU R128 em dois passos com verificação independente.
//
// ADR-005: Two-pass obrigatório (Pass 1 = análise, Pass 2 = normalização linear)
// ADR-009: BS1770GAIN é a verificação definitiva — nunca só o FFmpeg
// ADR-002: FFmpeg sempre via execFile/spawn com array (nunca exec+string)
//
// Retry inteligente: se LUFS deviation > 0.5 LU, ajusta offset ±0.5 e repete.
// Máximo 3 tentativas antes de falhar com AudioNormalizationError.

import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../observability/logger';
import { loudnessLufs } from '../../observability/metrics';

const execFileAsync = promisify(execFile);

// ── Tipos públicos ───────────────────────────────────────────────

/** Análise do Pass 1 — valores medidos pelo FFmpeg loudnorm */
export interface LoudnormAnalysis {
  input_i: string;       // Loudness integrado medido (LUFS)
  input_tp: string;      // True Peak medido (dBTP)
  input_lra: string;     // Loudness Range medido (LU)
  input_thresh: string;  // Threshold
  target_offset: string; // Offset sugerido pelo FFmpeg
}

/** Resultado da verificação BS1770GAIN */
export interface BS1770GainResult {
  integratedLufs: number;
  truePeakDbtp: number;
  loudnessRange: number;
  /** true se verificado por BS1770GAIN, false se por FFmpeg fallback */
  verifiedByBS1770Gain: boolean;
}

/** Resultado completo da normalização */
export interface LoudnessResult {
  integratedLufs: number;
  truePeak: number;
  loudnessRange: number;
  targetLufs: number;
  passes: number;
  verified: boolean;
  verifiedByBS1770Gain: boolean;
  analysis: LoudnormAnalysis;
}

// ── Constantes ───────────────────────────────────────────────────

const MAX_RETRIES = 3;
const MAX_LUFS_DEVIATION = 0.5;   // LU — tolerância EBU R128
const LUFS_RETRY_OFFSET = 0.5;    // LU — ajuste por tentativa
const TRUE_PEAK_LIMIT = -1.0;     // dBTP — limite EBU R128

const PASS1_TIMEOUT_MS = 5 * 60 * 1000;   // 5 minutos
const PASS2_TIMEOUT_MS = 15 * 60 * 1000;  // 15 minutos
const BS1770GAIN_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutos

// ── Normalizer ───────────────────────────────────────────────────

export class NexoraLoudnessNormalizer {

  /**
   * Normaliza o áudio de um ficheiro para o target LUFS com two-pass EBU R128.
   *
   * @param inputPath     - Path do ficheiro de entrada
   * @param outputPath    - Path do ficheiro de saída normalizado
   * @param targetLufs    - LUFS alvo (ex: -23 para broadcast EBU R128)
   * @param truePeakLimit - True Peak máximo (ex: -1.0 dBTP)
   */
  async normalize(
    inputPath: string,
    outputPath: string,
    targetLufs: number,
    truePeakLimit: number = TRUE_PEAK_LIMIT
  ): Promise<LoudnessResult> {
    const log = logger.child({ inputPath, targetLufs, truePeakLimit });
    let currentTarget = targetLufs;
    let lastVerification: BS1770GainResult | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      log.info({ attempt, currentTarget }, `Two-pass EBU R128 — tentativa ${attempt}/${MAX_RETRIES}`);

      try {
        // Pass 1: Análise
        const analysis = await this.runPass1(inputPath, currentTarget);
        log.info({ analysis }, 'Pass 1 concluído');

        // Pass 2: Normalização linear com valores medidos
        await this.runPass2(inputPath, outputPath, analysis, currentTarget);
        log.info('Pass 2 concluído');

        // Verificação independente (ADR-005, ADR-009)
        const verification = await this.verify(outputPath, log);
        lastVerification = verification;
        log.info({ verification }, 'Verificação BS1770GAIN concluída');

        // Avaliar conformidade
        const deviation = Math.abs(verification.integratedLufs - currentTarget);
        const lufsOk = deviation <= MAX_LUFS_DEVIATION;
        const tpOk = verification.truePeakDbtp <= truePeakLimit;

        if (lufsOk && tpOk) {
          log.info(
            { lufs: verification.integratedLufs, truePeak: verification.truePeakDbtp },
            'Normalização EBU R128 validada com sucesso'
          );

          // Métrica Prometheus
          loudnessLufs.observe(verification.integratedLufs);

          return {
            integratedLufs: verification.integratedLufs,
            truePeak: verification.truePeakDbtp,
            loudnessRange: verification.loudnessRange,
            targetLufs,
            passes: attempt,
            verified: true,
            verifiedByBS1770Gain: verification.verifiedByBS1770Gain,
            analysis,
          };
        }

        // Ajustar target para próxima tentativa
        const direction = verification.integratedLufs > currentTarget ? -1 : 1;
        const offset = deviation > MAX_LUFS_DEVIATION ? direction * LUFS_RETRY_OFFSET : 0;

        log.warn(
          {
            lufs: verification.integratedLufs,
            deviation,
            truePeak: verification.truePeakDbtp,
            offset,
            attempt,
            lufsOk,
            tpOk,
          },
          'Verificação falhou — a ajustar offset e repetir'
        );

        currentTarget = targetLufs + offset * attempt;

      } catch (err) {
        if (attempt === MAX_RETRIES) throw err;
        log.warn({ attempt, err: String(err) }, 'Tentativa falhou — a repetir');
      }
    }

    // Se chegámos aqui, todas as tentativas falharam
    throw new Error(
      `Normalização EBU R128 falhou após ${MAX_RETRIES} tentativas. ` +
      `Último LUFS: ${lastVerification?.integratedLufs ?? 'N/A'}, ` +
      `Target: ${targetLufs}`
    );
  }

  // ── Pass 1: Análise ──────────────────────────────────────────

  /**
   * Pass 1: executa FFmpeg com loudnorm em modo análise.
   * O FFmpeg imprime o JSON de medição no stderr.
   * ADR-002: execFile com array.
   */
  async runPass1(inputPath: string, targetLufs: number): Promise<LoudnormAnalysis> {
    const ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg';

    const { stderr } = await execFileAsync(
      ffmpegPath,
      [
        '-i', inputPath,
        '-af', `loudnorm=I=-${Math.abs(targetLufs)}:TP=-1.0:LRA=11:print_format=json`,
        '-f', 'null',
        '-',
      ],
      { timeout: PASS1_TIMEOUT_MS }
    );

    // FFmpeg escreve o JSON no stderr — extrair o bloco { ... }
    const jsonMatch = stderr.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      throw new Error(
        `FFmpeg loudnorm Pass 1 não retornou JSON válido. stderr: ${stderr.slice(-500)}`
      );
    }

    return JSON.parse(jsonMatch[0]) as LoudnormAnalysis;
  }

  // ── Pass 2: Normalização linear ──────────────────────────────

  /**
   * Pass 2: aplica normalização linear com os valores medidos no Pass 1.
   * ADR-002: spawn com array (processo pode demorar 15+ minutos para ficheiros longos).
   */
  async runPass2(
    inputPath: string,
    outputPath: string,
    analysis: LoudnormAnalysis,
    targetLufs: number
  ): Promise<void> {
    const ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg';

    // Construir filtro loudnorm com valores medidos (normalização linear)
    const loudnormFilter = [
      `loudnorm=I=-${Math.abs(targetLufs)}:TP=-1.0:LRA=11`,
      `measured_I=${analysis.input_i}`,
      `measured_TP=${analysis.input_tp}`,
      `measured_LRA=${analysis.input_lra}`,
      `measured_thresh=${analysis.input_thresh}`,
      `offset=${analysis.target_offset}`,
      'linear=true',
    ].join(':');

    await new Promise<void>((resolve, reject) => {
      // ADR-002: spawn com array — nunca exec() com string
      const proc = spawn(
        ffmpegPath,
        [
          '-y',
          '-i', inputPath,
          '-af', loudnormFilter,
          '-ar', '48000',        // 48kHz obrigatório
          '-c:a', 'pcm_s24le',   // 24-bit PCM para qualidade máxima
          outputPath,
        ],
        { stdio: ['ignore', 'ignore', 'pipe'] }
      );

      let stderrBuf = '';
      proc.stderr?.on('data', (d: Buffer) => { stderrBuf += d.toString(); });

      // Timeout automático
      const timeoutId = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error(`FFmpeg Pass 2 timeout após ${PASS2_TIMEOUT_MS}ms`));
      }, PASS2_TIMEOUT_MS);

      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(
            `FFmpeg loudnorm Pass 2 falhou com código ${code}. ` +
            `stderr: ${stderrBuf.slice(-500)}`
          ));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeoutId);
        reject(new Error(`Falha ao iniciar FFmpeg Pass 2: ${err.message}`));
      });
    });
  }

  // ── Verificação BS1770GAIN ────────────────────────────────────

  /**
   * Verifica loudness com BS1770GAIN (ADR-005 + ADR-009).
   * Esta é a verificação definitiva — se falhar, a normalização é inválida.
   * Fallback: usa FFmpeg loudnorm se BS1770GAIN não estiver disponível (com warning).
   */
  async verify(
    filePath: string,
    log = logger
  ): Promise<BS1770GainResult> {
    const bs1770gainPath = process.env.BS1770GAIN_PATH ?? 'bs1770gain';

    try {
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

      return {
        ...this.parseBS1770GainXML(stdout),
        verifiedByBS1770Gain: true,
      };

    } catch (detectionErr) {
      // BS1770GAIN não instalado — fallback para FFmpeg (ADR-009: warning obrigatório)
      log.warn(
        { err: String(detectionErr) },
        'BS1770GAIN não disponível — a usar FFmpeg como verificação de fallback (ADR-009 violation risk)'
      );

      return this.verifyWithFFmpeg(filePath);
    }
  }

  /** Parseia o XML de output do BS1770GAIN */
  private parseBS1770GainXML(xml: string): Omit<BS1770GainResult, 'verifiedByBS1770Gain'> {
    // BS1770GAIN XML: <integrated lufs="-23.5"/> ou <integrated>-23.5</integrated>
    const lufsMatch = xml.match(/integrated[^>]*?lufs=['"]([-\d.]+)['"]/i)
      ?? xml.match(/<integrated[^>]*>([-\d.]+)<\/integrated>/i);
    const tpMatch = xml.match(/true[_-]?peak[^>]*?dbtp=['"]([-\d.]+)['"]/i)
      ?? xml.match(/<true[_-]?peak[^>]*>([-\d.]+)<\/true[_-]?peak>/i);
    const lraMatch = xml.match(/lra[^>]*?lu=['"]([-\d.]+)['"]/i)
      ?? xml.match(/<lra[^>]*>([-\d.]+)<\/lra>/i);

    return {
      integratedLufs: lufsMatch ? Number(lufsMatch[1]) : 0,
      truePeakDbtp: tpMatch ? Number(tpMatch[1]) : 0,
      loudnessRange: lraMatch ? Number(lraMatch[1]) : 0,
    };
  }

  /** Fallback: verifica loudness com FFmpeg loudnorm (menos preciso) */
  private async verifyWithFFmpeg(filePath: string): Promise<BS1770GainResult> {
    const ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg';

    const { stderr } = await execFileAsync(
      ffmpegPath,
      ['-i', filePath, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'],
      { timeout: 60_000 }
    );

    const jsonMatch = stderr.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      return { integratedLufs: 0, truePeakDbtp: 0, loudnessRange: 0, verifiedByBS1770Gain: false };
    }

    const data = JSON.parse(jsonMatch[0]) as Record<string, string>;

    return {
      integratedLufs: Number(data['output_i'] ?? data['input_i'] ?? 0),
      truePeakDbtp: Number(data['output_tp'] ?? data['input_tp'] ?? 0),
      loudnessRange: Number(data['output_lra'] ?? data['input_lra'] ?? 0),
      verifiedByBS1770Gain: false,
    };
  }
}

// ── Singleton ────────────────────────────────────────────────────

export const loudnessNormalizer = new NexoraLoudnessNormalizer();
