// Nexora Media Processing — Rota: Queue Stats
// Ficheiro: src/api/routes/queue-stats.ts
//
// GET /api/v1/queue/stats — estado actual das filas BullMQ

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getNexoraQueues, QUEUE_NAMES } from '../../workers/queues';

export async function queueStatsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/queue/stats',
    async (_request: FastifyRequest, _reply: FastifyReply) => {
      const queues = getNexoraQueues();

      const stats = await Promise.all(
        Object.entries(queues).map(async ([name, queue]) => {
          const [waiting, active, completed, failed, delayed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
            queue.getDelayedCount(),
          ]);

          const activeJobs = await queue.getJobs(['active']);
          const progressList = activeJobs.map(job => ({
            id: job.id,
            progress: job.progress,
            data: { assetId: job.data?.assetId, filename: job.data?.filename }
          }));

          return {
            name,
            queueKey: (QUEUE_NAMES as Record<string, string>)[name] ?? name,
            waiting,
            active,
            completed,
            failed,
            delayed,
            progressList,
            total: waiting + active + completed + failed + delayed,
          };
        })
      );

      const totals = stats.reduce(
        (acc, q) => ({
          waiting:   acc.waiting   + q.waiting,
          active:    acc.active    + q.active,
          completed: acc.completed + q.completed,
          failed:    acc.failed    + q.failed,
        }),
        { waiting: 0, active: 0, completed: 0, failed: 0 }
      );

      return {
        queues: stats,
        totals,
        generatedAt: new Date().toISOString(),
      };
    }
  );
}
