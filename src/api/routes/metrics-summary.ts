// Nexora Media Processing — Rota: Métricas Resumo
// Ficheiro: src/api/routes/metrics-summary.ts
//
// GET /api/v1/metrics/summary — estatísticas globais do sistema

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../db/prisma';
import { AssetStatus, JobStatus } from '@prisma/client';

export async function metricsSummaryRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    '/metrics/summary',
    async (_request: FastifyRequest, _reply: FastifyReply) => {
      const [
        totalAssets,
        assetsByStatus,
        totalJobs,
        jobsByStatus,
        recentCompletedJobs,
        recentFailedJobs,
        auditLogCount,
      ] = await Promise.all([
        prisma.asset.count({ where: { deletedAt: null } }),

        prisma.asset.groupBy({
          by: ['status'],
          _count: { _all: true },
          where: { deletedAt: null },
        }),

        prisma.job.count(),

        prisma.job.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),

        // Jobs concluídos nas últimas 24h
        prisma.job.count({
          where: {
            status: JobStatus.COMPLETED,
            completedAt: { gte: new Date(Date.now() - 86400_000) },
          },
        }),

        // Jobs falhados nas últimas 24h
        prisma.job.count({
          where: {
            status: JobStatus.FAILED,
            updatedAt: { gte: new Date(Date.now() - 86400_000) },
          },
        }),

        prisma.auditLog.count(),
      ]);

      const statusMap = Object.fromEntries(
        assetsByStatus.map(s => [s.status, s._count._all])
      ) as Partial<Record<AssetStatus, number>>;

      const jobStatusMap = Object.fromEntries(
        jobsByStatus.map(s => [s.status, s._count._all])
      ) as Partial<Record<JobStatus, number>>;

      const successRate24h =
        recentCompletedJobs + recentFailedJobs > 0
          ? Math.round((recentCompletedJobs / (recentCompletedJobs + recentFailedJobs)) * 100)
          : 100;

      return {
        assets: {
          total: totalAssets,
          byStatus: {
            pending:         statusMap.PENDING        ?? 0,
            ingesting:       statusMap.INGESTING      ?? 0,
            qcRunning:       statusMap.QC_RUNNING     ?? 0,
            qcPassed:        statusMap.QC_PASSED      ?? 0,
            qcQuarantined:   statusMap.QC_QUARANTINED ?? 0,
            qcRejected:      statusMap.QC_REJECTED    ?? 0,
            transcoding:     statusMap.TRANSCODING    ?? 0,
            audioProcessing: statusMap.AUDIO_PROCESSING ?? 0,
            delivering:      statusMap.DELIVERING     ?? 0,
            completed:       statusMap.COMPLETED      ?? 0,
            failed:          statusMap.FAILED         ?? 0,
          },
        },
        jobs: {
          total: totalJobs,
          byStatus: {
            pending:   jobStatusMap.PENDING   ?? 0,
            active:    jobStatusMap.ACTIVE    ?? 0,
            completed: jobStatusMap.COMPLETED ?? 0,
            failed:    jobStatusMap.FAILED    ?? 0,
            cancelled: jobStatusMap.CANCELLED ?? 0,
          },
          last24h: {
            completed: recentCompletedJobs,
            failed:    recentFailedJobs,
            successRate: successRate24h,
          },
        },
        auditLog: { totalEntries: auditLogCount },
        generatedAt: new Date().toISOString(),
      };
    }
  );
}
