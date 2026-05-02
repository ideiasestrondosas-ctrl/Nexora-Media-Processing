// Nexora Media Processing — Rota: Review de Quarentena
// Ficheiro: src/api/routes/review.ts
//
// POST /api/v1/assets/:id/review — aprovar ou rejeitar asset em quarentena
// Envia sinal ao workflow Temporal para desbloquear o pipeline.

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../db/prisma';
import { sendQuarantineDecision } from '../../pipeline/temporal-client';
import { logger } from '../../observability/logger';
import { AssetStatus } from '@prisma/client';

interface ReviewParams {
  id: string;
}

interface ReviewBody {
  decision: 'approve' | 'reject';
  reason?: string;
}

export async function reviewRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Params: ReviewParams; Body: ReviewBody }>(
    '/assets/:id/review',
    {
      schema: {
        body: {
          type: 'object',
          required: ['decision'],
          properties: {
            decision: { type: 'string', enum: ['approve', 'reject'] },
            reason:   { type: 'string', maxLength: 1000 },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: ReviewParams; Body: ReviewBody }>,
      reply: FastifyReply
    ) => {
      const { id: assetId } = request.params;
      const { decision, reason } = request.body;
      const log = logger.child({ route: 'review', assetId, decision });

      // 1. Verificar que o asset existe e está em quarentena
      const asset = await prisma.asset.findUnique({
        where: { id: assetId, deletedAt: null },
        select: { id: true, status: true },
      });

      if (!asset) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Asset não encontrado' });
      }

      if (asset.status !== AssetStatus.QC_QUARANTINED) {
        return reply.status(409).send({
          error: 'INVALID_STATE',
          message: `Asset não está em quarentena (estado actual: ${asset.status})`,
          currentStatus: asset.status,
        });
      }

      // 2. Encontrar o workflow Temporal activo para este asset
      const workflowRun = await prisma.workflowRun.findFirst({
        where: { assetId, status: 'RUNNING' },
        orderBy: { startedAt: 'desc' },
      });

      if (!workflowRun) {
        return reply.status(409).send({
          error: 'NO_ACTIVE_WORKFLOW',
          message: 'Não existe workflow activo para este asset em quarentena',
        });
      }

      // 3. Enviar sinal ao Temporal
      await sendQuarantineDecision(workflowRun.workflowId, decision, reason);

      // 4. Audit log
      await prisma.auditLog.create({
        data: {
          action: `QUARANTINE_${decision.toUpperCase()}`,
          entityType: 'Asset',
          entityId: assetId,
          assetId,
          metadata: {
            decision,
            reason: reason ?? '',
            workflowId: workflowRun.workflowId,
          } as object,
        },
      });

      log.info({ decision, workflowId: workflowRun.workflowId }, 'Decisão de quarentena enviada');

      return {
        success: true,
        assetId,
        decision,
        workflowId: workflowRun.workflowId,
        message: decision === 'approve'
          ? 'Asset aprovado — pipeline a continuar'
          : 'Asset rejeitado — pipeline cancelada',
      };
    }
  );
}
