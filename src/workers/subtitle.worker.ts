// Nexora Media Processing — Subtitle Worker
// Ficheiro: src/workers/subtitle.worker.ts
//
// Processamento de legendas: conversão SRT→TTML, SRT→WebVTT,
// validação de timing (overlap, CPS, duração), e re-sync com offset.

import { Worker, Job as BullJob } from 'bullmq';
import { mkdtemp, rm, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { prisma } from '../db/prisma';
import { logger, jobLogger } from '../observability/logger';
import { subtitlesProcessed } from '../observability/metrics';
import { downloadFile, uploadFile, BUCKETS } from '../common/minio';
import { QUEUE_NAMES, addToDeadLetter } from './queues';
import { SubtitleError } from '../common/errors';
import type { SubtitleJobPayload } from './queues';

// ── Tipos ────────────────────────────────────────────────────────

export interface SubtitleCue {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

export interface SubtitleValidation {
  valid: boolean;
  warnings: string[];
  errors: string[];
  cueCount: number;
  totalDurationMs: number;
}

// ── Constantes ───────────────────────────────────────────────────

const MIN_CUE_DURATION_MS = 800;
const MAX_CUE_DURATION_MS = 7000;
const MAX_CPS = 25; // caracteres por segundo
const MAX_GAP_WARNING_MS = 5000;

// ── Worker ───────────────────────────────────────────────────────

export class SubtitleWorker {
  public readonly name = 'SubtitleWorker';
  private worker: Worker | null = null;

  async start(): Promise<void> {
    this.worker = new Worker(
      QUEUE_NAMES.SUBTITLE,
      async (job: BullJob<SubtitleJobPayload>) => this.process(job),
      {
        connection: {
          host: this.extractRedisHost(),
          port: this.extractRedisPort(),
          maxRetriesPerRequest: null as unknown as number,
          enableReadyCheck: false,
        },
        concurrency: 8, // legendas são CPU-leve
      }
    );

    this.worker.on('failed', async (job, err) => {
      if (!job) return;
      if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
        await addToDeadLetter(
          QUEUE_NAMES.SUBTITLE, job.id ?? '', job.name,
          job.data, err.message, err.stack, job.attemptsMade
        );
      }
    });

    logger.info({ worker: this.name }, 'SubtitleWorker iniciado');
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      logger.info({ worker: this.name }, 'SubtitleWorker encerrado');
    }
  }

  private async process(job: BullJob<SubtitleJobPayload>): Promise<void> {
    const { assetId, inputMinioKey, outputFormat, offsetMs } = job.data;
    const log = jobLogger(job.id ?? 'unknown', assetId);

    log.info({ outputFormat, offsetMs }, 'A processar legendas');

    const tmpDir = await mkdtemp(join(tmpdir(), 'nexora-sub-'));
    const inputPath = join(tmpDir, 'input.srt');

    try {
      // 1. Descarregar ficheiro SRT do MinIO
      await downloadFile(BUCKETS.INPUT, inputMinioKey, inputPath);

      // 2. Ler e parsear SRT
      const srtContent = await readFile(inputPath, 'utf8');
      let cues = this.parseSRT(srtContent);

      // 3. Aplicar offset se solicitado
      if (offsetMs && offsetMs !== 0) {
        cues = this.applyOffset(cues, offsetMs);
        log.info({ offsetMs, cueCount: cues.length }, 'Offset aplicado');
      }

      // 4. Validar timing
      const validation = this.validateCues(cues);
      if (validation.errors.length > 0) {
        throw new SubtitleError(
          `Legendas inválidas: ${validation.errors.join('; ')}`,
          { errors: validation.errors, warnings: validation.warnings }
        );
      }
      if (validation.warnings.length > 0) {
        log.warn({ warnings: validation.warnings }, 'Legendas com warnings');
      }

      // 5. Converter para formato de saída
      let outputContent: string;
      let outputExt: string;

      switch (outputFormat) {
        case 'ttml':
          outputContent = this.convertToTTML(cues);
          outputExt = '.ttml';
          break;
        case 'webvtt':
          outputContent = this.convertToWebVTT(cues);
          outputExt = '.vtt';
          break;
        case 'srt':
          // Re-serializar (útil após offset ou limpeza)
          outputContent = this.convertToSRT(cues);
          outputExt = '.srt';
          break;
        default:
          throw new SubtitleError(`Formato de saída não suportado: ${outputFormat}`);
      }

      // 6. Escrever ficheiro de saída
      const outputPath = join(tmpDir, `output${outputExt}`);
      await writeFile(outputPath, outputContent, 'utf8');

      // 7. Upload para MinIO
      const outputKey = inputMinioKey
        .replace(/\.[^.]+$/, outputExt)
        .replace('/original/', `/subtitles/${outputFormat}/`);

      await uploadFile(BUCKETS.OUTPUT, outputKey, outputPath, {
        contentType: this.getMimeType(outputFormat),
        metadata: {
          'x-nexora-asset-id': assetId,
          'x-nexora-format': outputFormat,
          'x-nexora-cue-count': String(cues.length),
        },
      });

      // 8. Audit log
      await prisma.auditLog.create({
        data: {
          action: 'SUBTITLE_PROCESSED',
          entityType: 'Asset',
          entityId: assetId,
          assetId,
          metadata: {
            inputFormat: 'srt',
            outputFormat,
            cueCount: cues.length,
            offsetMs: offsetMs ?? 0,
            warnings: validation.warnings,
            outputKey,
            jobId: job.id,
          },
        },
      });

      // 9. Prometheus
      subtitlesProcessed.inc({ format_in: 'srt', format_out: outputFormat });

      log.info(
        { outputKey, cueCount: cues.length, outputFormat },
        'Legendas processadas com sucesso'
      );

    } finally {
      try {
        await rm(tmpDir, { recursive: true, force: true });
      } catch (err) {
        log.warn({ tmpDir, err }, 'Erro ao limpar directoria temporária');
      }
    }
  }

  // ── SRT Parser ────────────────────────────────────────────────

  parseSRT(content: string): SubtitleCue[] {
    const cues: SubtitleCue[] = [];
    // Normalizar line endings
    const blocks = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split(/\n\n+/);

    for (const block of blocks) {
      const lines = block.split('\n').filter(l => l.trim().length > 0);
      if (lines.length < 3) continue;

      const index = Number(lines[0]);
      if (isNaN(index)) continue;

      const timeLine = lines[1];
      const timeMatch = timeLine.match(
        /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
      );
      if (!timeMatch) continue;

      const startMs = this.timeToMs(
        Number(timeMatch[1]), Number(timeMatch[2]),
        Number(timeMatch[3]), Number(timeMatch[4])
      );
      const endMs = this.timeToMs(
        Number(timeMatch[5]), Number(timeMatch[6]),
        Number(timeMatch[7]), Number(timeMatch[8])
      );

      const text = lines.slice(2).join('\n');

      cues.push({ index, startMs, endMs, text });
    }

    return cues;
  }

  // ── Validação ─────────────────────────────────────────────────

  validateCues(cues: SubtitleCue[]): SubtitleValidation {
    const warnings: string[] = [];
    const errors: string[] = [];

    if (cues.length === 0) {
      errors.push('Nenhuma legenda encontrada no ficheiro');
      return { valid: false, warnings, errors, cueCount: 0, totalDurationMs: 0 };
    }

    for (let i = 0; i < cues.length; i++) {
      const cue = cues[i];
      const duration = cue.endMs - cue.startMs;

      // Duração negativa ou zero
      if (duration <= 0) {
        errors.push(`Cue #${cue.index}: duração negativa ou zero (${duration}ms)`);
      }

      // Duração mínima
      if (duration > 0 && duration < MIN_CUE_DURATION_MS) {
        warnings.push(`Cue #${cue.index}: duração ${duration}ms < mínimo ${MIN_CUE_DURATION_MS}ms`);
      }

      // Duração máxima
      if (duration > MAX_CUE_DURATION_MS) {
        warnings.push(`Cue #${cue.index}: duração ${duration}ms > máximo ${MAX_CUE_DURATION_MS}ms`);
      }

      // CPS (caracteres por segundo)
      if (duration > 0) {
        const plainText = cue.text.replace(/<[^>]+>/g, '').replace(/\n/g, ' ');
        const cps = (plainText.length / duration) * 1000;
        if (cps > MAX_CPS) {
          warnings.push(`Cue #${cue.index}: ${cps.toFixed(1)} CPS > máximo ${MAX_CPS} CPS`);
        }
      }

      // Overlap com a legenda seguinte
      if (i < cues.length - 1) {
        const next = cues[i + 1];
        if (cue.endMs > next.startMs) {
          warnings.push(`Cue #${cue.index}\u2192#${next.index}: overlap de ${cue.endMs - next.startMs}ms`);
        }

        // Gap grande
        const gap = next.startMs - cue.endMs;
        if (gap > MAX_GAP_WARNING_MS) {
          warnings.push(`Cue #${cue.index}\u2192#${next.index}: gap de ${(gap / 1000).toFixed(1)}s`);
        }
      }
    }

    const totalDurationMs = cues[cues.length - 1].endMs - cues[0].startMs;

    return {
      valid: errors.length === 0,
      warnings,
      errors,
      cueCount: cues.length,
      totalDurationMs,
    };
  }

  // ── Conversões ────────────────────────────────────────────────

  convertToTTML(cues: SubtitleCue[]): string {
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<tt xmlns="http://www.w3.org/ns/ttml"',
      '    xmlns:ttp="http://www.w3.org/ns/ttml#parameter"',
      '    xmlns:tts="http://www.w3.org/ns/ttml#styling"',
      '    ttp:timeBase="media">',
      '  <head>',
      '    <styling>',
      '      <style xml:id="defaultStyle" tts:fontFamily="proportionalSansSerif"',
      '             tts:fontSize="100%" tts:textAlign="center"/>',
      '    </styling>',
      '    <layout>',
      '      <region xml:id="bottom" tts:origin="10% 80%" tts:extent="80% 20%"',
      '              tts:displayAlign="after" tts:textAlign="center"/>',
      '    </layout>',
      '  </head>',
      '  <body>',
      '    <div>',
    ];

    for (const cue of cues) {
      const begin = this.msToTTMLTime(cue.startMs);
      const end = this.msToTTMLTime(cue.endMs);
      // Converter tags HTML inline para TTML
      const text = this.srtStylesToTTML(cue.text);
      lines.push(`      <p begin="${begin}" end="${end}" region="bottom">${text}</p>`);
    }

    lines.push('    </div>');
    lines.push('  </body>');
    lines.push('</tt>');

    return lines.join('\n') + '\n';
  }

  convertToWebVTT(cues: SubtitleCue[]): string {
    const lines = ['WEBVTT', ''];

    for (const cue of cues) {
      lines.push(String(cue.index));
      lines.push(`${this.msToWebVTTTime(cue.startMs)} --> ${this.msToWebVTTTime(cue.endMs)}`);
      lines.push(cue.text);
      lines.push('');
    }

    return lines.join('\n');
  }

  convertToSRT(cues: SubtitleCue[]): string {
    const lines: string[] = [];

    for (let i = 0; i < cues.length; i++) {
      const cue = cues[i];
      lines.push(String(i + 1));
      lines.push(`${this.msToSRTTime(cue.startMs)} --> ${this.msToSRTTime(cue.endMs)}`);
      lines.push(cue.text);
      lines.push('');
    }

    return lines.join('\n');
  }

  // ── Offset ────────────────────────────────────────────────────

  applyOffset(cues: SubtitleCue[], offsetMs: number): SubtitleCue[] {
    return cues
      .map(cue => ({
        ...cue,
        startMs: Math.max(0, cue.startMs + offsetMs),
        endMs: Math.max(0, cue.endMs + offsetMs),
      }))
      .filter(cue => cue.endMs > 0); // remover cues que ficaram com end <= 0
  }

  // ── Utilitários de tempo ──────────────────────────────────────

  private timeToMs(h: number, m: number, s: number, ms: number): number {
    return h * 3600000 + m * 60000 + s * 1000 + ms;
  }

  private msToSRTTime(ms: number): string {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const millis = ms % 1000;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
  }

  private msToWebVTTTime(ms: number): string {
    // WebVTT usa ponto em vez de vírgula
    return this.msToSRTTime(ms).replace(',', '.');
  }

  private msToTTMLTime(ms: number): string {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const millis = ms % 1000;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }

  /** Converte estilos inline SRT (<b>, <i>, <u>) para TTML */
  private srtStylesToTTML(text: string): string {
    return text
      .replace(/<b>/gi, '<span tts:fontWeight="bold">')
      .replace(/<\/b>/gi, '</span>')
      .replace(/<i>/gi, '<span tts:fontStyle="italic">')
      .replace(/<\/i>/gi, '</span>')
      .replace(/<u>/gi, '<span tts:textDecoration="underline">')
      .replace(/<\/u>/gi, '</span>')
      .replace(/\n/g, '<br/>');
  }

  private getMimeType(format: string): string {
    switch (format) {
      case 'ttml': return 'application/ttml+xml';
      case 'webvtt': return 'text/vtt';
      case 'srt': return 'application/x-subrip';
      default: return 'text/plain';
    }
  }

  private extractRedisHost(): string {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    try { return new URL(url).hostname; } catch { return 'localhost'; }
  }

  private extractRedisPort(): number {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    try { return Number(new URL(url).port) || 6379; } catch { return 6379; }
  }
}
