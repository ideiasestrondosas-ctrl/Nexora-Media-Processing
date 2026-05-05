// Nexora Media Processing — BullMQ Queues Setup
// Ficheiro: src/workers/queues.ts
//
// Configura as 6 filas de processamento + dead-letter queue.
// Prioridades: broadcast=10, ott=7, web=5, proxy=3
// Retry: 3 tentativas com backoff exponencial (1s, 10s, 60s)

import { Queue } from 'bullmq';
import { getRedisClient } from '../common/redis';
import { logger } from '../observability/logger';
import { prisma } from '../db/prisma';

// ── Nomes das filas ──────────────────────────────────────────────

export const QUEUE_NAMES = {
  INGEST:     'nexora-ingest',
  QC:         'nexora-qc',
  TRANSCODE:  'nexora-transcode',
  AUDIO:      'nexora-audio',
  PROXY:      'nexora-proxy',
  SUBTITLE:   'nexora-subtitle',
  DELIVERY:   'nexora-delivery',
  DEAD_LETTER: 'nexora-dead-letter',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ── Prioridades ──────────────────────────────────────────────────
// Nota: no BullMQ, prioridade mais alta = número menor (1=mais prioritário)
// Invertemos para que a API use valores mais intuitivos (10=mais prioritário)

export const PRIORITY = {
  BROADCAST: 1,   // exposto como 10 na API
  OTT:       4,   // exposto como 7  na API
  WEB:       6,   // exposto como 5  na API
  PROXY:     8,   // exposto como 3  na API
} as const;

/** Converte prioridade da API (10 = maior) para BullMQ (1 = maior) */
export function apiPriorityToBullMQ(apiPriority: number): number {
  const map: Record<number, number> = {
    10: PRIORITY.BROADCAST,
    7:  PRIORITY.OTT,
    5:  PRIORITY.WEB,
    3:  PRIORITY.PROXY,
  };
  return map[apiPriority] ?? PRIORITY.WEB;
}

// ── Configurações de retry ────────────────────────────────────────

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000, // 1s, 10s, 60s (com multiplier 3 implícito do exponential)
  },
  removeOnComplete: {
    age: 86400,   // manter 24h após conclusão
    count: 1000,  // máximo 1000 jobs concluídos por fila
  },
  removeOnFail: false, // preservar falhas para análise
} as const;

// ── Opções de conexão Redis para BullMQ ──────────────────────────
// BullMQ requer enableReadyCheck: false e maxRetriesPerRequest: null

const BULLMQ_CONNECTION_OPTIONS = {
  host: extractRedisHost(),
  port: extractRedisPort(),
  maxRetriesPerRequest: null as unknown as number,
  enableReadyCheck: false,
};

function extractRedisHost(): string {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  try {
    return new URL(url).hostname;
  } catch {
    return 'localhost';
  }
}

function extractRedisPort(): number {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  try {
    return Number(new URL(url).port) || 6379;
  } catch {
    return 6379;
  }
}

// ── Instâncias das filas ─────────────────────────────────────────

type NexoraQueues = {
  [K in keyof typeof QUEUE_NAMES]: Queue;
};

let _queues: NexoraQueues | null = null;

/**
 * Retorna todas as instâncias de filas BullMQ.
 * Cria as instâncias na primeira chamada (lazy init).
 */
export function getNexoraQueues(): NexoraQueues {
  if (_queues) return _queues;

  const connection = BULLMQ_CONNECTION_OPTIONS;

  _queues = {
    INGEST:      new Queue(QUEUE_NAMES.INGEST,      { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    QC:          new Queue(QUEUE_NAMES.QC,           { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    TRANSCODE:   new Queue(QUEUE_NAMES.TRANSCODE,    { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    AUDIO:       new Queue(QUEUE_NAMES.AUDIO,        { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    PROXY:       new Queue(QUEUE_NAMES.PROXY,        { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    SUBTITLE:    new Queue(QUEUE_NAMES.SUBTITLE,     { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    DELIVERY:    new Queue(QUEUE_NAMES.DELIVERY,     { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    DEAD_LETTER: new Queue(QUEUE_NAMES.DEAD_LETTER,  { connection, defaultJobOptions: {
      removeOnComplete: { age: 604800, count: 5000 }, // dead-letter: guardar 7 dias
      removeOnFail: false,
    }}),
  };

  return _queues;
}

// ── Helper: adicionar à dead-letter queue ─────────────────────────

export interface DeadLetterPayload {
  originalQueue: string;
  jobId: string;
  jobName: string;
  data: unknown;
  failedReason: string;
  stackTrace?: string;
  attempts: number;
  failedAt: string;
}

/**
 * Move um job falhado definitivamente para a dead-letter queue.
 * Chamado quando o job esgota todas as tentativas de retry.
 */
export async function addToDeadLetter(
  originalQueue: string,
  jobId: string,
  jobName: string,
  data: unknown,
  failedReason: string,
  stackTrace?: string,
  attempts: number = 3
): Promise<void> {
  const queues = getNexoraQueues();

  const payload: DeadLetterPayload = {
    originalQueue,
    jobId,
    jobName,
    data,
    failedReason,
    stackTrace,
    attempts,
    failedAt: new Date().toISOString(),
  };

  await queues.DEAD_LETTER.add('dead-letter', payload, {
    priority: 10, // dead-letter tem prioridade baixa
  });

  logger.error(
    { originalQueue, jobId, jobName, failedReason, attempts },
    'Job movido para dead-letter queue'
  );
}

// ── Inicialização ─────────────────────────────────────────────────

/**
 * Inicializa as filas e verifica a conexão ao Redis.
 * Deve ser chamado no startup da aplicação.
 */
export async function initQueues(): Promise<void> {
  // Verificar conexão ao Redis antes de criar filas
  const redis = getRedisClient();
  await redis.connect();
  await redis.ping();

  const queues = getNexoraQueues();

  logger.info(
    { queues: Object.values(QUEUE_NAMES) },
    'Filas BullMQ inicializadas'
  );

  // Log de estatísticas iniciais
  for (const [name, queue] of Object.entries(queues)) {
    const counts = await queue.getJobCounts('waiting', 'active', 'failed');
    logger.debug({ queue: name, ...counts }, 'Estado inicial da fila');
  }
}

/**
 * Encerra todas as filas de forma limpa.
 * Deve ser chamado no shutdown da aplicação.
 */
export async function closeQueues(): Promise<void> {
  if (!_queues) return;

  await Promise.all(Object.values(_queues).map(q => q.close()));
  _queues = null;
  logger.info('Filas BullMQ encerradas');
}

// ── Helpers para adicionar jobs ───────────────────────────────────

export interface IngestJobPayload {
  assetId?: string;
  filePath: string;
  filename: string;
  mimeType?: string;
  profile?: string;
  priority?: number; // prioridade API (10, 7, 5, 3)
}

export interface QCJobPayload {
  assetId: string;
  profile?: string;
}

export interface TranscodeJobPayload {
  assetId: string;
  profile: string;
  inputMinioKey: string;
}

export interface AudioJobPayload {
  assetId: string;
  inputMinioKey: string;
  targetLufs: number;
  truePeakLimit: number;
}

export interface ProxyJobPayload {
  assetId: string;
  inputMinioKey: string;
}

export interface SubtitleJobPayload {
  assetId: string;
  inputMinioKey: string;
  outputFormat: 'ttml' | 'webvtt' | 'srt';
  offsetMs?: number;
}

export interface DeliveryJobPayload {
  assetId: string;
  outputMinioKey: string;
  deliveryTargetId: string;
}

/**
 * Adiciona um job de ingest à fila com a prioridade correcta.
 */
export async function enqueueIngest(
  payload: IngestJobPayload,
  jobId?: string
): Promise<string> {
  const queues = getNexoraQueues();
  const bullPriority = apiPriorityToBullMQ(payload.priority ?? 5);

  const job = await queues.INGEST.add('ingest', payload, {
    jobId,
    priority: bullPriority,
  });

  // Criar registo no PostgreSQL para tracking histórico
  if (job.id) {
    await prisma.job.create({
      data: {
        id: job.id,
        assetId: payload.assetId || '',
        type: 'INGEST',
        status: 'PENDING',
        payload: payload as any,
        priority: payload.priority ?? 5
      }
    });
  }

  logger.info({ jobId: job.id, filename: payload.filename }, 'Job ingest enfileirado');
  return job.id ?? '';
}

/**
 * Adiciona um job de QC à fila.
 */
export async function enqueueQC(
  payload: QCJobPayload,
  jobId?: string
): Promise<string> {
  const queues = getNexoraQueues();

  const job = await queues.QC.add('qc', payload, { jobId });

  if (job.id) {
    await prisma.job.create({
      data: {
        id: job.id,
        assetId: payload.assetId,
        type: 'QC',
        status: 'PENDING',
        payload: payload as any
      }
    });
  }

  logger.info({ jobId: job.id, assetId: payload.assetId }, 'Job QC enfileirado');
  return job.id ?? '';
}

/**
 * Adiciona um job de transcode à fila.
 */
export async function enqueueTranscode(
  payload: TranscodeJobPayload,
  jobId?: string
): Promise<string> {
  const queues = getNexoraQueues();

  const job = await queues.TRANSCODE.add('transcode', payload, { jobId });

  if (job.id) {
    await prisma.job.create({
      data: {
        id: job.id,
        assetId: payload.assetId,
        type: 'TRANSCODE',
        status: 'PENDING',
        payload: payload as any
      }
    });
  }

  logger.info({ jobId: job.id, assetId: payload.assetId, profile: payload.profile }, 'Job transcode enfileirado');
  return job.id ?? '';
}

/**
 * Adiciona um job de normalização de áudio à fila.
 */
export async function enqueueAudio(
  payload: AudioJobPayload,
  jobId?: string
): Promise<string> {
  const queues = getNexoraQueues();

  const job = await queues.AUDIO.add('audio', payload, { jobId });

  if (job.id) {
    await prisma.job.create({
      data: {
        id: job.id,
        assetId: payload.assetId,
        type: 'AUDIO',
        status: 'PENDING',
        payload: payload as any
      }
    });
  }

  logger.info({ jobId: job.id, assetId: payload.assetId }, 'Job áudio enfileirado');
  return job.id ?? '';
}

/**
 * Adiciona um job de processamento de legendas à fila.
 */
export async function enqueueSubtitle(
  payload: SubtitleJobPayload,
  jobId?: string
): Promise<string> {
  const queues = getNexoraQueues();

  const job = await queues.SUBTITLE.add('subtitle', payload, { jobId });

  if (job.id) {
    await prisma.job.create({
      data: {
        id: job.id,
        assetId: payload.assetId,
        type: 'SUBTITLE',
        status: 'PENDING',
        payload: payload as any
      }
    });
  }

  logger.info({ jobId: job.id, assetId: payload.assetId, format: payload.outputFormat }, 'Job legendas enfileirado');
  return job.id ?? '';
}
