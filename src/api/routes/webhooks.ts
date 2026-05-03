// Nexora Media Processing — Rota: Webhooks
// Ficheiro: src/api/routes/webhooks.ts
//
// CRUD de webhooks para notificações de eventos.
// POST   /api/v1/webhooks       — registar webhook
// GET    /api/v1/webhooks       — listar webhooks
// DELETE /api/v1/webhooks/:id  — remover webhook

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WebhookEvent, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { ssrfGuard } from '../../security/ssrf-guard';
import { auditSecurityEvent } from '../middleware/audit';
import { logger } from '../../observability/logger';

// ── Schemas de validação ─────────────────────────────────────────

const VALID_EVENTS = Object.values(WebhookEvent);

interface CreateWebhookBody {
  url: string;
  events: WebhookEvent[];
  secret?: string;
  metadata?: Record<string, unknown>;
}

// ── Rota ─────────────────────────────────────────────────────────

export async function webhooksRoutes(fastify: FastifyInstance): Promise<void> {

  // POST /webhooks — registar novo webhook
  fastify.post<{ Body: CreateWebhookBody }>(
    '/webhooks',
    {
      schema: {
        body: {
          type: 'object',
          required: ['url', 'events'],
          properties: {
            url:    { type: 'string', format: 'uri', maxLength: 2048 },
            events: {
              type: 'array',
              items: { type: 'string', enum: VALID_EVENTS },
              minItems: 1,
            },
            secret:   { type: 'string', maxLength: 256 },
            metadata: { type: 'object' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateWebhookBody }>, reply: FastifyReply) => {
      const { url, events, secret, metadata } = request.body;

      // Validar URL contra SSRF antes de registar
      const ssrfCheck = await ssrfGuard.validateWebhookUrl(url);
      if (!ssrfCheck.safe) {
        await auditSecurityEvent('SSRF_BLOCKED', url, 'WebhookRegistration', {
          userId:    request.user?.sub,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          severity:  'warn',
          metadata:  { reason: ssrfCheck.reason, url },
        });
        return reply.status(400).send({
          error:   'SSRF_BLOCKED',
          message: `URL de webhook rejeitado por razões de segurança: ${ssrfCheck.reason}`,
        });
      }

      const webhook = await prisma.webhookRegistration.create({
        data: {
          url,
          events,
          secret: secret ?? null,
          ...(metadata !== undefined && { metadata: metadata as Prisma.InputJsonValue }),
          isActive: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          action: 'WEBHOOK_CREATED',
          entityType: 'WebhookRegistration',
          entityId: webhook.id,
          userId: request.user?.sub ?? null,
          metadata: { url, events } as object,
        },
      });

      return reply.status(201).send(webhook);
    }
  );

  // GET /webhooks — listar todos os webhooks activos
  fastify.get(
    '/webhooks',
    async (_request: FastifyRequest, _reply: FastifyReply) => {
      const webhooks = await prisma.webhookRegistration.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          url: true,
          events: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          // Não expor secret na listagem
          secret: false,
          metadata: true,
        },
      });

      return { webhooks, count: webhooks.length };
    }
  );

  // GET /webhooks/:id — obter webhook específico
  fastify.get<{ Params: { id: string } }>(
    '/webhooks/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const webhook = await prisma.webhookRegistration.findUnique({
        where: { id: request.params.id },
        select: {
          id: true,
          url: true,
          events: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          metadata: true,
          secret: false,
        },
      });

      if (!webhook) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Webhook não encontrado' });
      }

      return webhook;
    }
  );

  // DELETE /webhooks/:id — desactivar webhook (soft delete)
  fastify.delete<{ Params: { id: string } }>(
    '/webhooks/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const existing = await prisma.webhookRegistration.findUnique({
        where: { id: request.params.id },
      });

      if (!existing) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Webhook não encontrado' });
      }

      await prisma.webhookRegistration.update({
        where: { id: request.params.id },
        data: { isActive: false },
      });

      await prisma.auditLog.create({
        data: {
          action: 'WEBHOOK_DELETED',
          entityType: 'WebhookRegistration',
          entityId: request.params.id,
          metadata: { url: existing.url } as object,
        },
      });

      return reply.status(204).send();
    }
  );
}

// ── Helper: disparar notificação para todos os webhooks activos ──

/**
 * Envia notificação para todos os webhooks registados para um evento.
 * Falha silenciosa — webhook notifications não bloqueiam o pipeline.
 */
export async function notifyWebhooks(
  event: WebhookEvent,
  payload: Record<string, unknown>
): Promise<void> {
  const webhooks = await prisma.webhookRegistration.findMany({
    where: { isActive: true, events: { has: event } },
  });

  const body = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  await Promise.allSettled(
    webhooks.map(async (wh) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Nexora-Event': event,
        'X-Nexora-Delivery': `${wh.id}-${Date.now()}`,
      };

      // HMAC signature se secret configurado
      if (wh.secret) {
        const { createHmac } = await import('crypto');
        const sig = createHmac('sha256', wh.secret).update(body).digest('hex');
        headers['X-Nexora-Signature'] = `sha256=${sig}`;
      }

      try {
        // safeFetch valida SSRF antes de enviar (previne DNS rebinding em tempo de envio)
        await ssrfGuard.safeFetch(wh.url, { method: 'POST', headers, body });
      } catch (err) {
        logger.warn({ webhookId: wh.id, url: wh.url, err: String(err) }, 'Notificação webhook falhada');
      }
    })
  );
}
