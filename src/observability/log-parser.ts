// Nexora Media Processing — Log Parser
// Ficheiro: src/observability/log-parser.ts
//
// Parser unificado que normaliza outputs de todas as ferramentas da pipeline
// num formato estruturado e consistente.
//
// Suporta:
//   - FFmpeg stderr (progresso, warnings, erros)
//   - MediaInfo JSON (streams, container, metadata)
//   - MediaConch XML (resultados de conformidade)
//   - BullMQ events (falhas, stalls, retries)
//   - BS1770GAIN XML (loudness, true peak, LRA)

// ── Tipos Públicos ────────────────────────────────────────────────

export type LogSource = 'ffmpeg' | 'mediainfo' | 'mediaconch' | 'bullmq' | 'bs1770gain';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/** Entrada de log normalizada — saída de todos os parsers */
export interface ParsedLogEntry {
  /** Identificador único desta entrada */
  id: string;
  /** Ferramenta que gerou o log */
  source: LogSource;
  /** Timestamp ISO 8601 */
  timestamp: string;
  /** Nível de severidade normalizado */
  level: LogLevel;
  /** Mensagem principal (limpa de prefixos e noise) */
  message: string;
  /** Linha/texto original não processado */
  raw: string;
  /** Metadados extraídos específicos da fonte */
  metadata: Record<string, unknown>;
  /** Contexto Nexora — job associado */
  jobId?: string;
  /** Contexto Nexora — asset associado */
  assetId?: string;
}

/** Progresso de FFmpeg parseado */
export interface FFmpegProgress {
  frame?: number;
  fps?: number;
  quality?: number;
  size?: number;
  timeSeconds?: number;
  bitrate?: string;
  speed?: string;
  percent?: number;
}

/** Resultado de conformidade MediaConch por regra */
export interface MediaConchRuleResult {
  ruleName: string;
  outcome: 'pass' | 'fail' | 'warn';
  value?: string;
  expected?: string;
  actual?: string;
}

/** Resultado BS1770GAIN parseado */
export interface BS1770GainParsed {
  integratedLufs?: number;
  truePeakDbtp?: number;
  loudnessRange?: number;
  filename?: string;
}

// ── Constantes ────────────────────────────────────────────────────

let _entryCounter = 0;

function nextId(): string {
  return `log-${Date.now()}-${++_entryCounter}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

// ── Parser Principal ──────────────────────────────────────────────

export class NexoraLogParser {

  // ── FFmpeg stderr ─────────────────────────────────────────────

  /**
   * Parseia o stderr completo do FFmpeg em múltiplas entradas normalizadas.
   * Separa: metadata de input, progresso, warnings, erros, linha de conclusão.
   */
  parseFFmpegStderr(
    stderr: string,
    jobId?: string,
    assetId?: string
  ): ParsedLogEntry[] {
    const entries: ParsedLogEntry[] = [];
    const lines = stderr.split('\n').filter(l => l.trim().length > 0);
    let totalDuration: number | null = null;

    for (const raw of lines) {
      const entry = this.classifyFFmpegLine(raw, totalDuration, jobId, assetId);
      if (!entry) continue;

      // Extrair duração total para calcular progresso relativo
      if (entry.metadata['duration_seconds']) {
        totalDuration = entry.metadata['duration_seconds'] as number;
      }
      if (entry.metadata['progress']) {
        const prog = entry.metadata['progress'] as FFmpegProgress;
        if (totalDuration && prog.timeSeconds !== undefined) {
          prog.percent = Math.min(
            Math.round((prog.timeSeconds / totalDuration) * 100),
            99
          );
        }
      }

      entries.push(entry);
    }

    return entries;
  }

  private classifyFFmpegLine(
    raw: string,
    _totalDuration: number | null,
    jobId?: string,
    assetId?: string
  ): ParsedLogEntry | null {
    const now = nowISO();
    const base = { id: nextId(), source: 'ffmpeg' as LogSource, timestamp: now, raw, jobId, assetId };

    // ── Erros fatais ──────────────────────────────────────────
    if (/moov atom not found/i.test(raw)) {
      return { ...base, level: 'fatal', message: 'moov atom not found — container corrompido ou incompleto', metadata: { error_code: 'MOOV_NOT_FOUND' } };
    }
    if (/Invalid data found when processing input/i.test(raw)) {
      return { ...base, level: 'fatal', message: 'Invalid data found — stream corrompido', metadata: { error_code: 'INVALID_DATA' } };
    }
    if (/Conversion failed!/i.test(raw)) {
      return { ...base, level: 'fatal', message: 'Conversion failed — encode falhou terminalmente', metadata: { error_code: 'CONVERSION_FAILED' } };
    }
    if (/Cannot allocate memory|ENOMEM/i.test(raw)) {
      return { ...base, level: 'fatal', message: 'Memória insuficiente para o encode', metadata: { error_code: 'OUT_OF_MEMORY' } };
    }

    // ── Erros GPU ─────────────────────────────────────────────
    if (/Cannot load nvcuda\.dll|InitializeEncoder failed|nvenc|Error creating a CUDA context/i.test(raw)) {
      return { ...base, level: 'error', message: `GPU/NVENC error: ${raw.trim()}`, metadata: { error_code: 'NVENC_ERROR' } };
    }

    // ── Erros de rede/IO ──────────────────────────────────────
    if (/Broken pipe|EPIPE/i.test(raw)) {
      return { ...base, level: 'error', message: 'Broken pipe — pipe de output interrompido', metadata: { error_code: 'PIPE_BROKEN' } };
    }

    // ── Erros de timestamp ────────────────────────────────────
    const dtsMatch = raw.match(/DTS\s+([-\d.]+),\s*next:([-\d.]+)\s+out of order/i);
    if (dtsMatch) {
      return {
        ...base,
        level: 'warn',
        message: `DTS out of order: ${dtsMatch[1]} → ${dtsMatch[2]}`,
        metadata: { error_code: 'DTS_OUT_OF_ORDER', dts_current: dtsMatch[1], dts_next: dtsMatch[2] },
      };
    }

    const pastDurMatch = raw.match(/Past duration\s+([-\d.]+)\s+too large/i);
    if (pastDurMatch) {
      return {
        ...base,
        level: 'warn',
        message: `Past duration ${pastDurMatch[1]} too large — VBV buffer overflow`,
        metadata: { error_code: 'PAST_DURATION_LARGE', value: pastDurMatch[1] },
      };
    }

    // ── Metadata de input ─────────────────────────────────────
    const durationMatch = raw.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
    if (durationMatch) {
      const h = Number(durationMatch[1]);
      const m = Number(durationMatch[2]);
      const s = Number(durationMatch[3]);
      const totalSec = h * 3600 + m * 60 + s;
      return {
        ...base,
        level: 'debug',
        message: `Input duration: ${durationMatch[0].trim()}`,
        metadata: { duration_seconds: totalSec },
      };
    }

    // ── Linhas de progresso ───────────────────────────────────
    if (/frame=\s*\d+/.test(raw)) {
      const frameM = raw.match(/frame=\s*(\d+)/);
      const fpsM = raw.match(/fps=\s*([\d.]+)/);
      const timeM = raw.match(/time=(\d+):(\d+):(\d+\.?\d*)/);
      const bitrateM = raw.match(/bitrate=\s*([\d.]+\w+)/);
      const speedM = raw.match(/speed=\s*([\d.]+x)/);

      const progress: FFmpegProgress = {
        frame: frameM ? Number(frameM[1]) : undefined,
        fps: fpsM ? Number(fpsM[1]) : undefined,
        bitrate: bitrateM?.[1],
        speed: speedM?.[1],
      };
      if (timeM) {
        progress.timeSeconds = Number(timeM[1]) * 3600 + Number(timeM[2]) * 60 + Number(timeM[3]);
      }

      return { ...base, level: 'debug', message: `FFmpeg progress: frame=${progress.frame ?? '?'} fps=${progress.fps ?? '?'} speed=${progress.speed ?? '?'}`, metadata: { progress } };
    }

    // ── Warnings genéricos FFmpeg ─────────────────────────────
    if (/\[warning\]|deprecated|not officially supported/i.test(raw)) {
      return { ...base, level: 'warn', message: raw.trim(), metadata: {} };
    }

    // ── Erros genéricos FFmpeg ────────────────────────────────
    if (/\[error\]|\[fatal\]|Error while/i.test(raw)) {
      return { ...base, level: 'error', message: raw.trim(), metadata: {} };
    }

    // Linha ignorada (ruído de codec info, etc.)
    return null;
  }

  // ── MediaInfo JSON ────────────────────────────────────────────

  /**
   * Parseia output JSON do MediaInfo (`mediainfo --Output=JSON`).
   * Extrai streams, container info e possíveis warnings de conformidade.
   */
  parseMediaInfoJSON(
    json: string,
    assetId?: string
  ): ParsedLogEntry[] {
    const entries: ParsedLogEntry[] = [];
    const now = nowISO();

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(json) as Record<string, unknown>;
    } catch {
      entries.push({
        id: nextId(),
        source: 'mediainfo',
        timestamp: now,
        level: 'error',
        message: 'Falha ao parsear MediaInfo JSON — output inválido',
        raw: json.slice(0, 200),
        metadata: { error_code: 'MEDIAINFO_PARSE_ERROR' },
        assetId,
      });
      return entries;
    }

    // MediaInfo JSON wrapper: { "media": { "track": [...] } }
    const media = data['media'] as Record<string, unknown> | undefined;
    const tracks = (media?.['track'] as unknown[] | undefined) ?? [];

    for (const track of tracks) {
      const t = track as Record<string, unknown>;
      const trackType = String(t['@type'] ?? 'Unknown');

      const metadata: Record<string, unknown> = {
        track_type: trackType,
        codec: t['CodecID'] ?? t['Format'],
        duration: t['Duration'],
        bitrate: t['BitRate'],
      };

      if (trackType === 'General') {
        Object.assign(metadata, {
          format: t['Format'],
          file_size: t['FileSize'],
          overall_bitrate: t['OverallBitRate'],
          encoded_date: t['Encoded_Date'],
        });
      } else if (trackType === 'Video') {
        Object.assign(metadata, {
          width: t['Width'],
          height: t['Height'],
          frame_rate: t['FrameRate'],
          frame_rate_mode: t['FrameRate_Mode'],
          color_space: t['ColorSpace'],
          scan_type: t['ScanType'],
        });

        // Warning: VFR em conteúdo broadcast
        if (String(t['FrameRate_Mode'] ?? '').toUpperCase() === 'VFR') {
          entries.push({
            id: nextId(),
            source: 'mediainfo',
            timestamp: now,
            level: 'warn',
            message: 'MediaInfo: stream de vídeo com Frame Rate variável (VFR) — pode causar problemas em broadcast',
            raw: json.slice(0, 100),
            metadata: { error_code: 'VFR_DETECTED', ...metadata },
            assetId,
          });
        }
      } else if (trackType === 'Audio') {
        Object.assign(metadata, {
          channels: t['Channels'],
          sample_rate: t['SamplingRate'],
          bit_depth: t['BitDepth'],
        });
      }

      entries.push({
        id: nextId(),
        source: 'mediainfo',
        timestamp: now,
        level: 'info',
        message: `MediaInfo track: ${trackType} — ${String(t['Format'] ?? t['CodecID'] ?? 'unknown')}`,
        raw: JSON.stringify(t).slice(0, 200),
        metadata,
        assetId,
      });
    }

    if (entries.length === 0) {
      entries.push({
        id: nextId(),
        source: 'mediainfo',
        timestamp: now,
        level: 'warn',
        message: 'MediaInfo não retornou tracks — ficheiro possivelmente corrompido',
        raw: json.slice(0, 100),
        metadata: { error_code: 'MEDIAINFO_NO_TRACKS' },
        assetId,
      });
    }

    return entries;
  }

  // ── MediaConch XML ────────────────────────────────────────────

  /**
   * Parseia output XML do MediaConch (`mediaconch --ImplementationReport`).
   * Extrai resultado de cada regra com pass/fail/warn.
   */
  parseMediaConchXML(
    xml: string,
    assetId?: string
  ): ParsedLogEntry[] {
    const entries: ParsedLogEntry[] = [];
    const now = nowISO();

    // Extrair resultado global
    const globalOutcome = xml.match(/outcome\s*=\s*["']?(pass|fail|warn)["']?/i)?.[1]?.toLowerCase() as 'pass' | 'fail' | 'warn' | undefined;

    // Parsear cada regra individual
    // Formato: <rule name="..." outcome="pass|fail" ...>
    const ruleRegex = /<rule[^>]*name\s*=\s*["']([^"']+)["'][^>]*outcome\s*=\s*["']([^"']+)["'][^>]*/gi;
    let match: RegExpExecArray | null;

    while ((match = ruleRegex.exec(xml)) !== null) {
      const ruleName = match[1] ?? 'unknown';
      const outcome = (match[2] ?? 'pass').toLowerCase() as 'pass' | 'fail' | 'warn';

      // Tentar extrair valor actual vs esperado da tag <rule>
      const ruleBlock = xml.slice(match.index, match.index + 500);
      const actualM = ruleBlock.match(/<actual[^>]*>(.*?)<\/actual>/is);
      const expectedM = ruleBlock.match(/<expected[^>]*>(.*?)<\/expected>/is);

      const ruleResult: MediaConchRuleResult = {
        ruleName,
        outcome,
        actual: actualM?.[1]?.trim(),
        expected: expectedM?.[1]?.trim(),
      };

      const level: LogLevel = outcome === 'fail' ? 'error' : outcome === 'warn' ? 'warn' : 'info';

      entries.push({
        id: nextId(),
        source: 'mediaconch',
        timestamp: now,
        level,
        message: `MediaConch regra "${ruleName}": ${outcome.toUpperCase()}`,
        raw: ruleBlock.slice(0, 200),
        metadata: {
          rule: ruleResult,
          error_code: outcome === 'fail' ? 'MEDIACONCH_FAIL' : undefined,
        },
        assetId,
      });
    }

    // Resultado global se não encontrou regras individuais
    if (entries.length === 0) {
      const level: LogLevel = globalOutcome === 'fail' ? 'error' : globalOutcome === 'warn' ? 'warn' : 'info';
      entries.push({
        id: nextId(),
        source: 'mediaconch',
        timestamp: now,
        level,
        message: `MediaConch resultado global: ${globalOutcome?.toUpperCase() ?? 'UNKNOWN'}`,
        raw: xml.slice(0, 200),
        metadata: { global_outcome: globalOutcome, error_code: globalOutcome === 'fail' ? 'MEDIACONCH_FAIL' : undefined },
        assetId,
      });
    }

    return entries;
  }

  // ── BullMQ Events ─────────────────────────────────────────────

  /**
   * Normaliza um evento BullMQ (failed, stalled, error) em ParsedLogEntry.
   */
  parseBullMQEvent(
    event: Record<string, unknown>,
    jobId?: string,
    assetId?: string
  ): ParsedLogEntry {
    const now = nowISO();
    const eventType = String(event['event'] ?? event['type'] ?? 'unknown');
    const failedReason = String(event['failedReason'] ?? event['message'] ?? event['error'] ?? '');
    const attemptsMade = Number(event['attemptsMade'] ?? 0);
    const queueName = String(event['queueName'] ?? event['queue'] ?? 'unknown');

    let level: LogLevel = 'info';
    let errorCode: string | undefined;

    if (eventType === 'failed' || eventType === 'error') {
      level = attemptsMade >= 3 ? 'fatal' : 'error';
      errorCode = 'BULLMQ_JOB_FAILED';
    } else if (eventType === 'stalled') {
      level = 'warn';
      errorCode = 'BULLMQ_JOB_STALLED';
    } else if (eventType === 'retrying') {
      level = 'warn';
      errorCode = 'BULLMQ_JOB_RETRYING';
    }

    return {
      id: nextId(),
      source: 'bullmq',
      timestamp: now,
      level,
      message: `BullMQ [${queueName}] ${eventType}: ${failedReason}`.slice(0, 300),
      raw: JSON.stringify(event).slice(0, 500),
      metadata: {
        error_code: errorCode,
        event_type: eventType,
        queue_name: queueName,
        attempts_made: attemptsMade,
        failed_reason: failedReason,
      },
      jobId: jobId ?? String(event['jobId'] ?? ''),
      assetId,
    };
  }

  // ── BS1770GAIN XML ────────────────────────────────────────────

  /**
   * Parseia output XML do BS1770GAIN.
   * Extrai LUFS integrado, True Peak, e Loudness Range.
   * Gera entradas de warning quando os valores excedem limites EBU R128.
   */
  parseBS1770GainXML(
    xml: string,
    assetId?: string,
    targetLufs: number = -23,
    truePeakLimit: number = -1.0
  ): ParsedLogEntry[] {
    const entries: ParsedLogEntry[] = [];
    const now = nowISO();

    let parsed: BS1770GainParsed;
    try {
      parsed = this.extractBS1770GainValues(xml);
    } catch {
      entries.push({
        id: nextId(),
        source: 'bs1770gain',
        timestamp: now,
        level: 'error',
        message: 'Falha ao parsear XML do BS1770GAIN — output inválido',
        raw: xml.slice(0, 200),
        metadata: { error_code: 'BS1770_PARSE_ERROR' },
        assetId,
      });
      return entries;
    }

    // Entrada de informação com todos os valores medidos
    entries.push({
      id: nextId(),
      source: 'bs1770gain',
      timestamp: now,
      level: 'info',
      message: `BS1770GAIN: LUFS=${parsed.integratedLufs?.toFixed(1) ?? 'N/A'} TP=${parsed.truePeakDbtp?.toFixed(1) ?? 'N/A'} LRA=${parsed.loudnessRange?.toFixed(1) ?? 'N/A'}`,
      raw: xml.slice(0, 300),
      metadata: {
        integrated_lufs: parsed.integratedLufs,
        true_peak_dbtp: parsed.truePeakDbtp,
        loudness_range: parsed.loudnessRange,
        filename: parsed.filename,
      },
      assetId,
    });

    // Warning: True Peak excede -1 dBTP (EBU R128)
    if (parsed.truePeakDbtp !== undefined && parsed.truePeakDbtp > truePeakLimit) {
      entries.push({
        id: nextId(),
        source: 'bs1770gain',
        timestamp: now,
        level: 'warn',
        message: `True Peak ${parsed.truePeakDbtp.toFixed(2)} dBTP excede limite ${truePeakLimit} dBTP — normalização falhou`,
        raw: xml.slice(0, 100),
        metadata: {
          error_code: 'TRUE_PEAK_EXCEEDED',
          measured: parsed.truePeakDbtp,
          limit: truePeakLimit,
          excess_db: +(parsed.truePeakDbtp - truePeakLimit).toFixed(2),
        },
        assetId,
      });
    }

    // Warning: Desvio LUFS > 1 LU do target
    if (parsed.integratedLufs !== undefined) {
      const deviation = Math.abs(parsed.integratedLufs - targetLufs);
      if (deviation > 1.0) {
        entries.push({
          id: nextId(),
          source: 'bs1770gain',
          timestamp: now,
          level: 'warn',
          message: `LUFS integrado ${parsed.integratedLufs.toFixed(1)} desvia ${deviation.toFixed(1)} LU do target ${targetLufs} — two-pass falhou`,
          raw: xml.slice(0, 100),
          metadata: {
            error_code: 'LUFS_DEVIATION',
            measured: parsed.integratedLufs,
            target: targetLufs,
            deviation: +deviation.toFixed(2),
          },
          assetId,
        });
      }
    }

    return entries;
  }

  private extractBS1770GainValues(xml: string): BS1770GainParsed {
    // Vários formatos possíveis do BS1770GAIN XML
    const lufsMatch =
      xml.match(/integrated[^>]*?lufs=['\"]([-\d.]+)['\"]/)  ??
      xml.match(/integrated[^>]*?value=['\"]([-\d.]+)['\"]/) ??
      xml.match(/<integrated[^>]*>([-\d.]+)<\/integrated>/i) ??
      xml.match(/lufs=['\"]([-\d.]+)['\"]/) ;

    const tpMatch =
      xml.match(/true[_-]?peak[^>]*?dbtp=['\"]([-\d.]+)['\"]/) ??
      xml.match(/true[_-]?peak[^>]*?value=['\"]([-\d.]+)['\"]/) ??
      xml.match(/<true[_-]?peak[^>]*>([-\d.]+)<\/true[_-]?peak>/i) ??
      xml.match(/dbtp=['\"]([-\d.]+)['\"]/) ;

    const lraMatch =
      xml.match(/lra[^>]*?lu=['\"]([-\d.]+)['\"]/) ??
      xml.match(/lra[^>]*?value=['\"]([-\d.]+)['\"]/) ??
      xml.match(/<lra[^>]*>([-\d.]+)<\/lra>/i) ;

    const fileMatch = xml.match(/file=['\""]([^'"]+)['\""]/) ;

    return {
      integratedLufs: lufsMatch ? Number(lufsMatch[1]) : undefined,
      truePeakDbtp: tpMatch ? Number(tpMatch[1]) : undefined,
      loudnessRange: lraMatch ? Number(lraMatch[1]) : undefined,
      filename: fileMatch?.[1],
    };
  }
}

// ── Singleton ─────────────────────────────────────────────────────

export const logParser = new NexoraLogParser();
