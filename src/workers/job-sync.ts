import { QueueEvents } from 'bullmq';
import { prisma } from '../db/prisma';
import { logger } from '../observability/logger';
import { QUEUE_NAMES } from './queues';

const REDIS_OPTIONS = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

export function setupJobSync() {
  const queues = Object.values(QUEUE_NAMES);

  queues.forEach((queueName) => {
    const queueEvents = new QueueEvents(queueName, { connection: REDIS_OPTIONS });

    queueEvents.on('active', async ({ jobId }) => {
      try {
        await prisma.job.updateMany({
          where: { id: jobId },
          data: { 
            status: 'ACTIVE',
            startedAt: new Date()
          }
        });
        logger.debug({ jobId, queueName }, 'Job sync: status set to ACTIVE');
      } catch (err) {
        logger.error({ jobId, queueName, err }, 'Job sync error on active');
      }
    });

    queueEvents.on('completed', async ({ jobId, returnvalue }) => {
      try {
        await prisma.job.updateMany({
          where: { id: jobId },
          data: { 
            status: 'COMPLETED',
            completedAt: new Date(),
            result: returnvalue as any
          }
        });
        logger.debug({ jobId, queueName }, 'Job sync: status set to COMPLETED');
      } catch (err) {
        logger.error({ jobId, queueName, err }, 'Job sync error on completed');
      }
    });

    queueEvents.on('failed', async ({ jobId, failedReason }) => {
      try {
        await prisma.job.updateMany({
          where: { id: jobId },
          data: { 
            status: 'FAILED',
            completedAt: new Date(),
            error: failedReason
          }
        });
        logger.debug({ jobId, queueName }, 'Job sync: status set to FAILED');
      } catch (err) {
        logger.error({ jobId, queueName, err }, 'Job sync error on failed');
      }
    });

    queueEvents.on('progress', async ({ jobId, data }) => {
      try {
        // O progresso pode ser guardado no result ou num campo específico se existisse
        // Por agora, vamos apenas logar ou atualizar o result
        await prisma.job.updateMany({
          where: { id: jobId },
          data: { 
            result: { progress: data } as any
          }
        });
      } catch (err) {
        logger.error({ jobId, queueName, err }, 'Job sync error on progress');
      }
    });
  });

  logger.info('Serviço de sincronização de Jobs (BullMQ -> Prisma) iniciado');
}
