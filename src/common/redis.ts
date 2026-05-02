// Nexora Media Processing — Redis Client Singleton
// Ficheiro: src/common/redis.ts
//
// Duas instâncias IORedis separadas:
//   - redisClient: uso geral + BullMQ
//   - redisPubSub: pub/sub para progresso de transcode em tempo real
// Necessário porque uma conexão em modo subscribe não pode ser
// usada para outros comandos Redis.

import Redis, { type RedisOptions } from 'ioredis';
import { logger } from '../observability/logger';

// ── Configuração ─────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

const REDIS_CONNECT_OPTIONS: RedisOptions = {
  maxRetriesPerRequest: 3,
  enableReadyCheck: false, // BullMQ requer false
  retryStrategy: (times: number) => {
    // Reconectar com backoff exponencial até 30s
    const delay = Math.min(times * 500, 30000);
    logger.warn({ attempt: times, delayMs: delay }, 'Redis a reconectar...');
    return delay;
  },
  lazyConnect: true,
};

// ── Singleton principal (BullMQ + comandos gerais) ───────────────

let _redisClient: Redis | null = null;

/**
 * Retorna a instância principal do cliente Redis.
 * Usada pelo BullMQ e para operações gerais (get/set/del).
 */
export function getRedisClient(): Redis {
  if (_redisClient) return _redisClient;

  _redisClient = new Redis(REDIS_URL, REDIS_CONNECT_OPTIONS);

  _redisClient.on('connect', () =>
    logger.info('Redis conectado')
  );
  _redisClient.on('ready', () =>
    logger.debug('Redis pronto')
  );
  _redisClient.on('error', (err: Error) =>
    logger.error({ err }, 'Erro Redis')
  );
  _redisClient.on('close', () =>
    logger.warn('Conexão Redis encerrada')
  );
  _redisClient.on('reconnecting', () =>
    logger.warn('Redis a reconectar')
  );

  return _redisClient;
}

// ── Singleton para Pub/Sub ───────────────────────────────────────

let _redisPubSub: Redis | null = null;

/**
 * Retorna a instância Redis dedicada a pub/sub.
 * Necessária porque subscribe() bloqueia a conexão para outros comandos.
 * Usada para emitir progresso de transcode em tempo real.
 */
export function getRedisPubSub(): Redis {
  if (_redisPubSub) return _redisPubSub;

  _redisPubSub = new Redis(REDIS_URL, {
    ...REDIS_CONNECT_OPTIONS,
    // Pub/sub não precisa de retry automático de comandos
    maxRetriesPerRequest: null as unknown as number,
  });

  _redisPubSub.on('connect', () =>
    logger.info('Redis PubSub conectado')
  );
  _redisPubSub.on('error', (err: Error) =>
    logger.error({ err }, 'Erro Redis PubSub')
  );

  return _redisPubSub;
}

// ── Channels de Pub/Sub ──────────────────────────────────────────

/** Gera o nome do channel para progresso de um job específico */
export function transcodeProgressChannel(jobId: string): string {
  return `nexora:transcode:progress:${jobId}`;
}

/** Gera o nome do channel para eventos de um asset específico */
export function assetStatusChannel(assetId: string): string {
  return `nexora:asset:status:${assetId}`;
}

// ── Helpers de progresso ─────────────────────────────────────────

export interface TranscodeProgress {
  jobId: string;
  assetId: string;
  percent: number;      // 0-100
  fps?: number;
  speed?: string;       // ex: "1.5x"
  eta?: number;         // segundos restantes
  frame?: number;
  totalFrames?: number;
}

/**
 * Publica progresso de transcode via Redis pub/sub.
 * Consumido pelo endpoint SSE /assets/:id/status.
 */
export async function publishTranscodeProgress(
  progress: TranscodeProgress
): Promise<void> {
  const publisher = getRedisClient();
  const channel = transcodeProgressChannel(progress.jobId);
  await publisher.publish(channel, JSON.stringify(progress));
}

/**
 * Encerra ambas as conexões Redis de forma limpa.
 * Deve ser chamado no shutdown da aplicação.
 */
export async function closeRedis(): Promise<void> {
  if (_redisPubSub) {
    await _redisPubSub.quit();
    _redisPubSub = null;
  }
  if (_redisClient) {
    await _redisClient.quit();
    _redisClient = null;
  }
  logger.info('Redis desconectado');
}
