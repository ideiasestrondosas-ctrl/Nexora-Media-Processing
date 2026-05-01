// ═══════════════════════════════════════════════════════════════
// Nexora Media Processing — Prisma Schema Completo
// Ficheiro: prisma/schema.prisma
//
// ADR-007: Audit trail append-only — tabela AuditLog não tem
// operações UPDATE ou DELETE na política de base de dados.
// ═══════════════════════════════════════════════════════════════

// NOTA: Este ficheiro é TypeScript para efeitos de documentação.
// O conteúdo real vai no ficheiro prisma/schema.prisma sem extensão.

/*
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ── Asset: entidade principal ─────────────────────────────────

model Asset {
  id              String      @id @default(uuid())
  originalName    String
  sha256Input     String                          // ADR-003: SHA-256 obrigatório
  sha256Output    String?                         // calculado após processamento
  status          AssetStatus @default(INGESTED)
  profile         String                          // perfil de encoding
  
  // Metadados técnicos (preenchidos após QC pré-encode)
  durationMs      Int?
  frameRate       Float?
  resolution      String?                         // ex: "1920x1080"
  codec           String?
  pixelFormat     String?
  colorSpace      String?
  bitrate         Int?                            // kbps
  
  // Resultados de qualidade (preenchidos após processamento)
  vmafScore       Float?                          // score VMAF 0-100
  loudnessLufs    Float?                          // LUFS integrado
  truePeakDbtp    Float?                          // True Peak em dBTP
  loudnessRange   Float?                          // LRA em LU
  
  // Delivery
  deliveryUrl     String?                         // URL final do ficheiro processado
  proxyUrl        String?                         // URL do proxy lowres
  thumbnailUrl    String?                         // URL do sprite sheet VTT
  webhookUrl      String?                         // webhook para notificações
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  
  // Relações
  jobs            Job[]
  auditLogs       AuditLog[]
  processingSteps ProcessingStep[]
  
  @@index([status])
  @@index([createdAt])
  @@index([profile])
}

enum AssetStatus {
  INGESTED
  QC_PENDING
  QC_PASS
  QC_QUARANTINE
  QC_REJECT
  ANALYZING
  TRANSCODING
  AUDIO_PROCESSING
  POST_QC
  DELIVERING
  READY
  FAILED
}

// ── Job: registo de cada tarefa de processamento ─────────────

model Job {
  id          String    @id @default(uuid())
  assetId     String
  type        JobType
  status      JobStatus @default(PENDING)
  attempts    Int       @default(0)
  maxAttempts Int       @default(3)
  priority    String    @default("normal")        // high | normal | low
  
  payload     Json?                               // parâmetros de entrada
  result      Json?                               // resultado da execução
  error       String?                             // mensagem de erro se falhou
  errorCode   String?                             // código de erro estruturado
  
  startedAt   DateTime?
  finishedAt  DateTime?
  createdAt   DateTime  @default(now())
  
  asset       Asset     @relation(fields: [assetId], references: [id], onDelete: Cascade)
  
  @@index([assetId])
  @@index([status])
  @@index([type])
  @@index([createdAt])
}

enum JobType {
  INGEST
  QC_PRE
  ANALYZE
  TRANSCODE
  AUDIO_NORMALIZE
  SUBTITLE_PROCESS
  PROXY_GENERATE
  THUMBNAIL_GENERATE
  DRM_PACKAGE
  QC_POST
  DELIVER
}

enum JobStatus {
  PENDING
  ACTIVE
  COMPLETED
  FAILED
  CANCELLED
}

// ── AuditLog: registo imutável (ADR-007) ─────────────────────
// ATENÇÃO: Esta tabela é APPEND-ONLY.
// Nunca fazer UPDATE ou DELETE nesta tabela.
// A política de RLS no PostgreSQL pode enforçar isto:
//   CREATE POLICY audit_insert_only ON audit_logs FOR INSERT;

model AuditLog {
  id          String   @id @default(uuid())
  assetId     String
  eventType   String                              // tipo de evento
  operator    String                              // "api", "system", UUID do utilizador
  payload     Json?                               // dados do evento
  entryHash   String                              // SHA-256 para tamper-evidence
  createdAt   DateTime @default(now())
  
  asset       Asset    @relation(fields: [assetId], references: [id])
  
  @@index([assetId, createdAt])
  @@index([eventType])
}

// ── ProcessingStep: registo granular dos passos ──────────────
// Permite recovery de workflows interrompidos (Desktop mode)

model ProcessingStep {
  id          String    @id @default(uuid())
  assetId     String
  stepName    String                              // ex: "QC_PRE", "TRANSCODE"
  status      String    @default("pending")       // pending | running | done | failed
  startedAt   DateTime?
  completedAt DateTime?
  metadata    Json?
  
  asset       Asset     @relation(fields: [assetId], references: [id], onDelete: Cascade)
  
  @@unique([assetId, stepName])                  // cada step só existe uma vez por asset
  @@index([assetId])
}

// ── Settings: configurações da aplicação ─────────────────────

model Settings {
  key         String   @id
  value       String
  updatedAt   DateTime @updatedAt
}
*/


// ═══════════════════════════════════════════════════════════════
// Nexora — Prisma Client Singleton
// Ficheiro: src/db/prisma.ts
// ═══════════════════════════════════════════════════════════════

import { PrismaClient } from '@prisma/client';
import { logger } from '../observability/logger';

declare global {
  // eslint-disable-next-line no-var
  var __nexoraPrisma: PrismaClient | undefined;
}

// Singleton: em desenvolvimento, evitar múltiplas conexões com hot-reload
export const prisma =
  global.__nexoraPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' },
        ]
      : [
          { emit: 'event', level: 'error' },
        ],
  });

if (process.env.NODE_ENV === 'development') {
  global.__nexoraPrisma = prisma;

  // Log de queries em desenvolvimento
  (prisma as any).$on('query', (e: { query: string; duration: number }) => {
    if (e.duration > 1000) {
      logger.warn({ query: e.query, duration: e.duration }, 'Query lenta detectada');
    }
  });
}

/** Inicializar e verificar ligação à base de dados */
export async function initDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Base de dados PostgreSQL conectada');
  } catch (error) {
    logger.error(error, 'Falha na ligação à base de dados');
    throw error;
  }
}

/** Encerrar ligação à base de dados */
export async function closeDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Ligação à base de dados encerrada');
}


// ═══════════════════════════════════════════════════════════════
// Nexora — BullMQ Queues Setup
// Ficheiro: src/workers/queues.ts
// ═══════════════════════════════════════════════════════════════

import { Queue, Worker, QueueEvents, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../observability/logger';
import { queueDepth } from '../observability/metrics';
import type { NexoraProfile } from './transcode.worker';

const REDIS_URL    = process.env.REDIS_URL    ?? 'redis://localhost:6379';
const BULLMQ_PREFIX = process.env.BULLMQ_PREFIX ?? 'nexora';

// Conexão Redis partilhada
export const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,   // necessário para BullMQ
  enableReadyCheck: false,
});

// ── Definição das filas ────────────────────────────────────────

export const queues = {
  ingest:     new Queue('ingest',     { connection: redisConnection, prefix: BULLMQ_PREFIX }),
  qc:         new Queue('qc',         { connection: redisConnection, prefix: BULLMQ_PREFIX }),
  analyze:    new Queue('analyze',    { connection: redisConnection, prefix: BULLMQ_PREFIX }),
  transcode:  new Queue('transcode',  { connection: redisConnection, prefix: BULLMQ_PREFIX }),
  audio:      new Queue('audio',      { connection: redisConnection, prefix: BULLMQ_PREFIX }),
  subtitle:   new Queue('subtitle',   { connection: redisConnection, prefix: BULLMQ_PREFIX }),
  proxy:      new Queue('proxy',      { connection: redisConnection, prefix: BULLMQ_PREFIX }),
  thumbnail:  new Queue('thumbnail',  { connection: redisConnection, prefix: BULLMQ_PREFIX }),
  qcPost:     new Queue('qc-post',    { connection: redisConnection, prefix: BULLMQ_PREFIX }),
  delivery:   new Queue('delivery',   { connection: redisConnection, prefix: BULLMQ_PREFIX }),
} as const;

export type QueueName = keyof typeof queues;

// ── Tipos de payload por fila ──────────────────────────────────

export interface IngestJobPayload {
  assetId:    string;
  inputPath:  string;
  profile:    NexoraProfile;
  priority:   'high' | 'normal' | 'low';
  webhookUrl?: string;
}

export interface QCJobPayload {
  assetId:   string;
  inputPath: string;
  profile:   NexoraProfile;
}

export interface TranscodeJobPayload {
  assetId:    string;
  inputPath:  string;
  outputPath: string;
  profile:    NexoraProfile;
  fps:        number;
  durationMs: number;
}

export interface AudioJobPayload {
  assetId:    string;
  inputPath:  string;
  outputPath: string;
  profile:    NexoraProfile;
}

export interface DeliveryJobPayload {
  assetId:    string;
  outputPath: string;
  profile:    NexoraProfile;
  webhookUrl?: string;
}

// ── Opções por fila ────────────────────────────────────────────

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,  // 1s, 10s, 100s
  },
  removeOnComplete: { count: 1000 }, // manter últimos 1000 jobs completos
  removeOnFail:     { count: 5000 }, // manter últimos 5000 jobs falhados
};

// Jobs de transcode têm mais tentativas e menos agressividade
const transcodeJobOptions = {
  ...defaultJobOptions,
  attempts: 2,
  backoff: { type: 'exponential' as const, delay: 5000 },
};

// ── Funções de enqueue ─────────────────────────────────────────

export async function enqueueIngest(payload: IngestJobPayload): Promise<string> {
  const job = await queues.ingest.add('ingest', payload, {
    ...defaultJobOptions,
    priority: payload.priority === 'high' ? 1 : payload.priority === 'low' ? 10 : 5,
  });
  logger.info({ jobId: job.id, assetId: payload.assetId }, 'Job de ingest enfileirado');
  return job.id!;
}

export async function enqueueQC(payload: QCJobPayload): Promise<string> {
  const job = await queues.qc.add('qc', payload, defaultJobOptions);
  return job.id!;
}

export async function enqueueTranscode(payload: TranscodeJobPayload): Promise<string> {
  const job = await queues.transcode.add('transcode', payload, {
    ...transcodeJobOptions,
    jobId: `transcode_${payload.assetId}`, // ID único para evitar duplicados
  });
  return job.id!;
}

export async function enqueueAudio(payload: AudioJobPayload): Promise<string> {
  const job = await queues.audio.add('audio', payload, defaultJobOptions);
  return job.id!;
}

export async function enqueueDelivery(payload: DeliveryJobPayload): Promise<string> {
  const job = await queues.delivery.add('delivery', payload, {
    ...defaultJobOptions,
    attempts: 5, // mais tentativas para delivery (rede pode falhar)
  });
  return job.id!;
}

// ── Inicializar filas e monitorização ──────────────────────────

export async function initQueues(): Promise<void> {
  // Verificar ligação Redis
  await redisConnection.ping();
  logger.info('Redis conectado — filas BullMQ inicializadas');

  // Actualizar métricas de profundidade das filas a cada 30s
  setInterval(async () => {
    for (const [name, queue] of Object.entries(queues)) {
      try {
        const waiting = await queue.getWaitingCount();
        const active  = await queue.getActiveCount();
        queueDepth.set({ worker_type: name }, waiting + active);
      } catch {
        // Ignorar erros de monitorização
      }
    }
  }, 30000);
}

/** Limpar todas as filas — usar com cuidado! */
export async function flushAllQueues(): Promise<void> {
  logger.warn('A limpar todas as filas BullMQ — todos os jobs pendentes serão perdidos');
  await Promise.all(
    Object.values(queues).map(q => q.obliterate({ force: true }))
  );
  logger.info('Filas limpas');
}
