// Nexora Media Processing — Job Scheduler
// Ficheiro: src/pipeline/ffmpeg/scheduler.ts
//
// Controlo de concorrência para jobs de encoding.
// Semáforos Redis para coordenação entre múltiplos workers.
//
// Limites:
//   GPU: máx 2 simultâneos (partilha de VRAM)
//   CPU broadcast: Math.floor(cores / 4) — preset slow é intensivo
//   CPU OTT/web: Math.floor(cores / 2)
//   Proxy: sem limite prático (preset fast)
//
// Os semáforos usam SETNX + TTL para evitar deadlocks se um worker crashar.

import { cpus } from 'os';
import { logger } from '../../observability/logger';

// ── Tipos públicos ───────────────────────────────────────────────

export type JobType = 'gpu' | 'cpu-broadcast' | 'cpu-ott' | 'cpu-web' | 'proxy';

export interface SchedulerSlot {
  slotId: string;
  jobType: JobType;
  encoder: string;
  acquiredAt: Date;
}

export interface AcquireResult {
  acquired: boolean;
  slot?: SchedulerSlot;
  /** Número de slots actualmente em uso */
  currentUsage: number;
  /** Capacidade máxima do tipo */
  maxCapacity: number;
}

// ── Interface minimal do Redis para o scheduler ──────────────────

interface RedisSchedulerClient {
  set(key: string, value: string, mode: string, ttl: number, condition: 'NX'): Promise<'OK' | null>;
  del(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  get(key: string): Promise<string | null>;
}

// ── Constantes ───────────────────────────────────────────────────

/** TTL dos slots Redis — se worker crashar, liberta automaticamente */
const SLOT_TTL_SECONDS = 4 * 60 * 60; // 4 horas (transcode máximo)

/** Prefixo das chaves de slot no Redis */
const SLOT_PREFIX = 'nexora:scheduler:slot:';

// ── Scheduler ────────────────────────────────────────────────────

export class NexoraJobScheduler {

  private readonly maxCapacity: Record<JobType, number>;

  constructor(private readonly redis: RedisSchedulerClient) {
    const cores = cpus().length;

    this.maxCapacity = {
      'gpu':           2,                             // Partilha de VRAM
      'cpu-broadcast': Math.max(1, Math.floor(cores / 4)), // Preset slow
      'cpu-ott':       Math.max(1, Math.floor(cores / 2)), // Preset medium
      'cpu-web':       Math.max(1, Math.floor(cores / 2)), // Preset medium
      'proxy':         Math.max(2, cores - 1),             // Preset fast, sem bloqueio
    };

    logger.info(
      { maxCapacity: this.maxCapacity, cores },
      'NexoraJobScheduler inicializado'
    );
  }

  /**
   * Resolve o tipo de job baseado no perfil e encoder.
   */
  static resolveJobType(profile: string, encoder: 'cpu' | 'nvenc' | 'qsv' | 'amf'): JobType {
    if (encoder !== 'cpu') return 'gpu';

    switch (profile) {
      case 'broadcast-hd': return 'cpu-broadcast';
      case 'ott-hd':       return 'cpu-ott';
      case 'web-sd':       return 'cpu-web';
      case 'proxy':        return 'proxy';
      default:             return 'cpu-ott';
    }
  }

  /**
   * Tenta adquirir um slot de encoding.
   * @returns AcquireResult com slot preenchido se bem sucedido
   */
  async acquire(
    jobId: string,
    jobType: JobType,
    encoder: string
  ): Promise<AcquireResult> {
    const max = this.maxCapacity[jobType];
    const currentUsage = await this.countActiveSlots(jobType);

    if (currentUsage >= max) {
      logger.debug(
        { jobId, jobType, currentUsage, max },
        'Slot não disponível — a aguardar'
      );
      return { acquired: false, currentUsage, maxCapacity: max };
    }

    // Tentar adquirir slot via SETNX atómico
    const slotId = `${SLOT_PREFIX}${jobType}:${jobId}`;
    const slot: SchedulerSlot = {
      slotId,
      jobType,
      encoder,
      acquiredAt: new Date(),
    };

    const acquired = await this.redis.set(
      slotId,
      JSON.stringify(slot),
      'EX',
      SLOT_TTL_SECONDS,
      'NX'
    );

    if (!acquired) {
      // Race condition — outro worker ganhou o slot
      return { acquired: false, currentUsage, maxCapacity: max };
    }

    logger.debug(
      { jobId, jobType, encoder, slotId, currentUsage: currentUsage + 1, max },
      'Slot de encoding adquirido'
    );

    return { acquired: true, slot, currentUsage: currentUsage + 1, maxCapacity: max };
  }

  /**
   * Liberta um slot de encoding adquirido anteriormente.
   */
  async release(slotId: string): Promise<void> {
    await this.redis.del(slotId);
    logger.debug({ slotId }, 'Slot de encoding libertado');
  }

  /**
   * Retorna o número de slots activos de um tipo.
   */
  async countActiveSlots(jobType: JobType): Promise<number> {
    const pattern = `${SLOT_PREFIX}${jobType}:*`;
    const keys = await this.redis.keys(pattern);
    return keys.length;
  }

  /**
   * Retorna estatísticas de uso de todos os tipos.
   */
  async getUsageStats(): Promise<Record<JobType, { current: number; max: number; utilization: number }>> {
    const types: JobType[] = ['gpu', 'cpu-broadcast', 'cpu-ott', 'cpu-web', 'proxy'];
    const stats: Record<string, { current: number; max: number; utilization: number }> = {};

    for (const type of types) {
      const current = await this.countActiveSlots(type);
      const max = this.maxCapacity[type];
      stats[type] = {
        current,
        max,
        utilization: max > 0 ? Math.round((current / max) * 100) : 0,
      };
    }

    return stats as Record<JobType, { current: number; max: number; utilization: number }>;
  }

  /**
   * Retorna a capacidade máxima para um tipo de job.
   */
  getMaxCapacity(jobType: JobType): number {
    return this.maxCapacity[jobType];
  }
}

// ── Factory ──────────────────────────────────────────────────────

let _scheduler: NexoraJobScheduler | null = null;

/**
 * Cria ou retorna o singleton do Job Scheduler.
 * Requer um cliente Redis com suporte a SETNX.
 */
export function getJobScheduler(redis: RedisSchedulerClient): NexoraJobScheduler {
  if (!_scheduler) {
    _scheduler = new NexoraJobScheduler(redis);
  }
  return _scheduler;
}
