// Nexora Media Processing — Middleware: Audit Logging
// Ficheiro: src/api/middleware/audit.ts
//
// Regista todas as operações de escrita (POST/PUT/PATCH/DELETE)
// no AuditLog do PostgreSQL. ADR-007: audit trail append-only.
// Prompt 7: severity, userAgent, auth events, security events.

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

// Mapeamento de status HTTP para severity do audit log
function statusToSeverity(statusCode: number, action: string): string {
  if (statusCode >= 500) return 'critical';
  if (statusCode === 429) return 'warn';           // rate limit
  if (statusCode >= 400) return 'warn';
  // Eventos de segurança elevados
  if (['AUTH_LOGIN_FAILED', 'SSRF_BLOCKED', 'INVALID_FILE_REJECTED', 'AUTH_LOGOUT_ALL'].includes(action)) return 'warn';
  if (['RATE_LIMIT_EXCEEDED', 'AUTH_TOKEN_EXPIRED'].includes(action)) return 'warn';
  return 'info';
}

/**
 * Extrai o ID de entidade da URL (ex: /assets/uuid → uuid)
 */
function extractEntityId(url: string): string | null {
  const match = url.match(/\/([0-9a-f-]{36})(?:\/|$)/);
  return match ? match[1] : null;
}

/**
 * Extrai o tipo de entidade da URL (ex: /assets/... → Asset)
 */
function extractEntityType(url: string): string {
  const resourceMap: Record<string, string> = {
    'assets':   'Asset',
    'jobs':     'Job',
    'queues':   'Queue',
    'webhooks': 'WebhookRegistration',
    'auth':     'Auth',
    'profiles': 'Profile',
    'review':   'Review',
  };

  const pathPart = url.split('?')[0]!;
  const segments = pathPart.split('/').filter(Boolean);

  for (const segment of segments) {
    if (resourceMap[segment]) return resourceMap[segment]!;
  }
  return 'Unknown';
}

/**
 * Mapeia método HTTP + URL para nome de acção de auditoria
 */
function buildActionName(method: string, url: string, statusCode: number): string {
  const success = statusCode < 400;
  if (!success) {
    if (statusCode === 429) return 'RATE_LIMIT_EXCEEDED';
    if (statusCode === 401) return 'AUTH_FAILED';
    if (statusCode === 403) return 'AUTH_FORBIDDEN';
    return `${method}_FAILED`;
  }

  const path = url.split('?')[0]!;

  // Auth events
  if (path.includes('/auth/login'))      return 'AUTH_LOGIN_SUCCESS';
  if (path.includes('/auth/refresh'))    return 'AUTH_REFRESH';
  if (path.includes('/auth/logout-all')) return 'AUTH_LOGOUT_ALL';
  if (path.includes('/auth/logout'))     return 'AUTH_LOGOUT';

  // Asset events
  if (method === 'POST' && path.includes('/upload'))  return 'ASSET_UPLOADED';
  if (method === 'DELETE' && path.includes('/assets')) return 'ASSET_DELETED';
  if (method === 'POST'   && path.includes('/cancel')) return 'JOB_CANCELLED';

  // Genérico
  if (method === 'DELETE') return 'DELETED';
  if (method === 'POST')   return 'CREATED';
  if (method === 'PUT' || method === 'PATCH') return 'UPDATED';

  return `${method}_${extractEntityType(path).toUpperCase()}`;
}

/**
 * Extrai o IP real do cliente (atrás de proxy/load balancer)
 */
function getClientIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ip?.trim() ?? request.ip;
  }
  return request.ip;
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
      if (!AUDITED_METHODS.has(request.method)) return;

      const url = request.url.split('?')[0]!;
      if (EXCLUDED_PATHS.has(url)) return;

      try {
        const entityId = extractEntityId(url) ?? '';
        const entityType = extractEntityType(url);
        const action = buildActionName(request.method, url, reply.statusCode);
        const severity = statusToSeverity(reply.statusCode, action);

        await prisma.auditLog.create({
          data: {
            action,
            entityType,
            entityId,
            userId:    request.user?.sub ?? null,
            ipAddress: getClientIp(request),
            userAgent: request.headers['user-agent'] ?? null,
            severity,
            metadata: {
              method:         request.method,
              url:            request.url,
              statusCode:     reply.statusCode,
              responseTimeMs: (reply as any).elapsedTime ?? 0,
              requestId:      request.headers['x-request-id'] ?? null,
            },
          },
        });
      } catch (err) {
        // Não falhar o request por causa do audit log
        logger.warn({ err, url, method: request.method }, 'Erro ao criar AuditLog');
      }
    }
  );

  logger.info('Hook de auditoria registado (v2 — severity + userAgent + security events)');
}

// ── Helper para registar eventos de segurança directamente ─────────

/**
 * Regista um evento de segurança específico no audit log.
 * Uso: SSRF_BLOCKED, INVALID_FILE_REJECTED, etc.
 */
export async function auditSecurityEvent(
  action: string,
  entityId: string,
  entityType: string,
  details: {
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
    severity?: 'info' | 'warn' | 'critical';
  }
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId,
        userId:    details.userId    ?? null,
        ipAddress: details.ipAddress ?? null,
        userAgent: details.userAgent ?? null,
        severity:  details.severity  ?? 'warn',
        metadata:  details.metadata !== undefined ? (details.metadata as import('@prisma/client').Prisma.InputJsonValue) : undefined,
      },
    });
  } catch (err) {
    logger.warn({ err, action }, 'Erro ao registar evento de segurança no audit log');
  }
}
