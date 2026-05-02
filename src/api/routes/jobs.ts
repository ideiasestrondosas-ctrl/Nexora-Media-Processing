// Nexora Media Processing — API Routes: Jobs
// Ficheiro: src/api/routes/jobs.ts
//
// CRUD de jobs com suporte a criação manual, listagem e cancelamento.
// Cancelamento via BullMQ (remove da fila ou abort se activo).

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { JobStatus, JobType } from '@prisma/client';

import { prisma } from '../../db/prisma';
import { logger } from '../../observability/logger';
import { getNexoraQueues, QUEUE_NAMES } from '../../workers/queues';
import {
  NotFoundError,
  JobCancellationError,
} from '../../common/errors';

// ── Schemas de validação ─────────────────────────────────────────

const listJobsSchema = z.object({
  page:    z.coerce.number().int().min(1).default(1),
  limit:   z.coerce.number().int().min(1).max(100).default(20),
  status:  z.nativeEnum(JobStatus).optional(),
  type:    z.nativeEnum(JobType).optional(),
  assetId: z.string().uuid().optional(),
});

const getJobSchema = z.object({
  id: z.string().uuid(),
});

const createJobSchema = z.object({
  assetId:  z.string().uuid(),
  type:     z.nativeEnum(JobType),
  priority: z.number().int().min(1).max(10).default(5),
  payload:  z.record(z.unknown()).optional(),
});

// Mapeamento de JobType para nome da fila BullMQ
const JOB_TYPE_TO_QUEUE: Partial<Record<JobType, string>> = {
  [JobType.QC]:       QUEUE_NAMES.QC,
  [JobType.TRANSCODE]: QUEUE_NAMES.TRANSCODE,
  [JobType.AUDIO]:    QUEUE_NAMES.AUDIO,
  [JobType.PROXY]:    QUEUE_NAMES.PROXY,
  [JobType.DELIVERY]: QUEUE_NAMES.DELIVERY,
};

// ── Helpers ──────────────────────────────────────────────────────

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function paginate<T>(data: T[], total: number, page: number, limit: number): PaginatedResponse<T> {
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ── Registo das rotas ────────────────────────────────────────────

export async function jobsRoutes(fastify: FastifyInstance): Promise<void> {

  // ── POST /jobs — Criar job manualmente ────────────────────────

  fastify.post('/jobs', {
    schema: {
      description: 'Cria um job de processamento manualmente',
      tags: ['Jobs'],
      body: {
        type: 'object',
        required: ['assetId', 'type'],
        properties: {
          assetId:  { type: 'string', format: 'uuid' },
          type:     { type: 'string', enum: Object.values(JobType) },
          priority: { type: 'integer', minimum: 1, maximum: 10, default: 5 },
          payload:  { type: 'object' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {

    const { assetId, type, priority, payload } = createJobSchema.parse(request.body);

    // Verificar que o asset existe
    const asset = await prisma.asset.findUnique({
      where: { id: assetId, deletedAt: null },
      select: { id: true },
    });

    if (!asset) {
      throw new NotFoundError('Asset', assetId);
    }

    // Criar Job no PostgreSQL
    const job = await prisma.job.create({
      data: {
        type,
        status: JobStatus.PENDING,
        priority,
        payload: payload as object ?? {},
        assetId,
        maxAttempts: 3,
      },
    });

    // Enfileirar na fila BullMQ correcta (se disponível para este tipo)
    const queueName = JOB_TYPE_TO_QUEUE[type];
    if (queueName) {
      const queues = getNexoraQueues();
      const queueKey = Object.keys(QUEUE_NAMES).find(
        k => QUEUE_NAMES[k as keyof typeof QUEUE_NAMES] === queueName
      ) as keyof typeof QUEUE_NAMES | undefined;

      if (queueKey && queues[queueKey]) {
        await queues[queueKey].add(type.toLowerCase(), {
          ...payload,
          assetId,
          jobId: job.id,
        }, {
          jobId: job.id,
          priority: 10 - priority, // BullMQ: prioridade invertida
        });
      }
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'JOB_CREATED',
        entityType: 'Job',
        entityId: job.id,
        assetId,
        userId: (request as FastifyRequest & { user?: { sub: string } }).user?.sub,
        metadata: { type, priority, payload } as object,
      },
    });

    logger.info({ jobId: job.id, assetId, type }, 'Job criado manualmente');

    return reply.status(201).send(job);
  });

  // ── GET /jobs — Listagem com filtros ──────────────────────────

  fastify.get('/jobs', {
    schema: {
      description: 'Listagem paginada de jobs com filtros',
      tags: ['Jobs'],
      querystring: {
        type: 'object',
        properties: {
          page:    { type: 'integer', minimum: 1, default: 1 },
          limit:   { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          status:  { type: 'string' },
          type:    { type: 'string' },
          assetId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {

    const { page, limit, status, type, assetId } = listJobsSchema.parse(request.query);
    const skip = (page - 1) * limit;

    const where = {
      ...(status  ? { status } : {}),
      ...(type    ? { type } : {}),
      ...(assetId ? { assetId } : {}),
    };

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        include: {
          asset: {
            select: { id: true, filename: true, status: true },
          },
        },
      }),
      prisma.job.count({ where }),
    ]);

    return reply.send(paginate(jobs, total, page, limit));
  });

  // ── GET /jobs/:id — Detalhes + logs BullMQ ───────────────────

  fastify.get('/jobs/:id', {
    schema: {
      description: 'Detalhes de um job com logs da fila BullMQ',
      tags: ['Jobs'],
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
        required: ['id'],
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {

    const { id } = getJobSchema.parse(request.params);

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        asset: {
          select: { id: true, filename: true, status: true, mimeType: true },
        },
        workflowRun: {
          select: { id: true, workflowId: true, status: true },
        },
      },
    });

    if (!job) {
      throw new NotFoundError('Job', id);
    }

    // Tentar obter logs da fila BullMQ (se disponível)
    let bullmqLogs: unknown[] = [];
    const queueName = JOB_TYPE_TO_QUEUE[job.type];
    if (queueName) {
      try {
        const queues = getNexoraQueues();
        const queueKey = Object.keys(QUEUE_NAMES).find(
          k => QUEUE_NAMES[k as keyof typeof QUEUE_NAMES] === queueName
        ) as keyof typeof QUEUE_NAMES | undefined;

        if (queueKey && queues[queueKey]) {
          const bullJob = await queues[queueKey].getJob(id);
          if (bullJob) {
            bullmqLogs = bullJob.stacktrace ?? [];
          }
        }
      } catch {
        // Logs do BullMQ opcionais — não falhar se fila não disponível
      }
    }

    return reply.send({ ...job, bullmqLogs });
  });

  // ── POST /jobs/:id/cancel — Cancelar job ─────────────────────

  fastify.post('/jobs/:id/cancel', {
    schema: {
      description: 'Cancela um job pendente ou activo',
      tags: ['Jobs'],
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
        required: ['id'],
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {

    const { id } = getJobSchema.parse(request.params);

    const job = await prisma.job.findUnique({
      where: { id },
      select: { id: true, type: true, status: true, assetId: true },
    });

    if (!job) {
      throw new NotFoundError('Job', id);
    }

    // Apenas jobs PENDING ou ACTIVE podem ser cancelados
    if (!['PENDING', 'ACTIVE'].includes(job.status)) {
      throw new JobCancellationError(
        id,
        `Job está em estado '${job.status}' — apenas PENDING ou ACTIVE podem ser cancelados`
      );
    }

    // Tentar remover da fila BullMQ
    const queueName = JOB_TYPE_TO_QUEUE[job.type];
    if (queueName) {
      try {
        const queues = getNexoraQueues();
        const queueKey = Object.keys(QUEUE_NAMES).find(
          k => QUEUE_NAMES[k as keyof typeof QUEUE_NAMES] === queueName
        ) as keyof typeof QUEUE_NAMES | undefined;

        if (queueKey && queues[queueKey]) {
          const bullJob = await queues[queueKey].getJob(id);
          if (bullJob) {
            await bullJob.remove();
          }
        }
      } catch {
        // Se não conseguir remover do BullMQ, apenas actualiza o DB
        logger.warn({ jobId: id }, 'Não foi possível remover job do BullMQ');
      }
    }

    // Actualizar status no PostgreSQL
    await prisma.job.update({
      where: { id },
      data: {
        status: JobStatus.CANCELLED,
        completedAt: new Date(),
        error: 'Cancelado pelo utilizador',
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: 'JOB_CANCELLED',
        entityType: 'Job',
        entityId: id,
        assetId: job.assetId,
        userId: (request as FastifyRequest & { user?: { sub: string } }).user?.sub,
        metadata: { previousStatus: job.status },
      },
    });

    logger.info({ jobId: id, type: job.type }, 'Job cancelado');

    return reply.send({ message: `Job '${id}' cancelado com sucesso` });
  });
}
