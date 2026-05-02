// Nexora Media Processing — Middleware: Audit Logging
// Ficheiro: src/api/middleware/audit.ts
//
// Regista todas as operações de escrita (POST/PUT/PATCH/DELETE)
// no AuditLog do PostgreSQL. ADR-007: audit trail append-only.

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../db/prisma';
import { logger } from '../../observability/logger';

// Métodos HTTP que requerem auditoria
const AUDITED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Rotas excluídas da auditoria (health checks, métricas)
const EXCLUDED_PATHS = new Set([
  '/health',
  '/health/live',
  '/health/ready',
  '/metrics',
]);

/**
 * Extrai o ID de entidade da URL (ex: /assets/uuid → uuid)
 */
function extractEntityId(url: string): string | null {
  // Padrão: /recurso/uuid ou /api/v1/recurso/uuid
  const match = url.match(/\/([0-9a-f-]{36})(?:\/|$)/);
  return match ? match[1] : null;
}

/**
 * Extrai o tipo de entidade da URL (ex: /assets/... → Asset)
 */
function extractEntityType(url: string): string {
  const resourceMap: Record<string, string> = {
    'assets': 'Asset',
    'jobs':   'Job',
    'queues': 'Queue',
  };

  const pathPart = url.split('?')[0];
  const segments = pathPart.split('/').filter(Boolean);

  // Procurar segmento que corresponde a um recurso conhecido
  for (const segment of segments) {
    if (resourceMap[segment]) {
      return resourceMap[segment];
    }
  }
  return 'Unknown';
}

/**
 * Mapeia método HTTP + URL para nome de acção de auditoria
 */
function buildActionName(method: string, url: string, statusCode: number): string {
  const success = statusCode < 400;
  if (!success) return `${method}_FAILED`;

  const path = url.split('?')[0];

  // Casos específicos
  if (method === 'POST' && path.includes('/cancel')) return 'JOB_CANCELLED';
  if (method === 'POST' && path.includes('/upload')) return 'ASSET_UPLOADED';
  if (method === 'DELETE') return 'DELETED';
  if (method === 'POST') return 'CREATED';
  if (method === 'PUT' || method === 'PATCH') return 'UPDATED';

  return `${method}_${extractEntityType(path).toUpperCase()}`;
}

/**
 * Regista o hook de auditoria no Fastify.
 * Executado após cada response (onResponse).
 * Apenas para métodos de escrita — não afecta performance de leituras.
 */
export async function registerAuditHook(fastify: FastifyInstance): Promise<void> {
  fastify.addHook(
    'onResponse',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Apenas auditar métodos de escrita
      if (!AUDITED_METHODS.has(request.method)) return;

      // Excluir rotas de sistema
      const url = request.url.split('?')[0];
      if (EXCLUDED_PATHS.has(url)) return;

      try {
        const entityId = extractEntityId(url) ?? '';
        const entityType = extractEntityType(url);
        const action = buildActionName(request.method, url, reply.statusCode);

        await prisma.auditLog.create({
          data: {
            action,
            entityType,
            entityId,
            userId: request.user?.sub ?? null,
            ipAddress: request.ip,
            metadata: {
              method: request.method,
              url: request.url,
              statusCode: reply.statusCode,
              userAgent: request.headers['user-agent'],
              responseTimeMs: reply.getResponseTime(),
            },
          },
        });
      } catch (err) {
        // Não falhar o request por causa do audit log
        logger.warn({ err, url, method: request.method }, 'Erro ao criar AuditLog');
      }
    }
  );

  logger.info('Hook de auditoria registado');
}
