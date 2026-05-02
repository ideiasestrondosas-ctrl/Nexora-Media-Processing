// Nexora Media Processing — Middleware: Rate Limiter
// Ficheiro: src/api/middleware/rateLimiter.ts
//
// Rate limiting por IP com store Redis para distribuição entre instâncias.
// 100 req/min por IP (configurável por variável de ambiente).
// Headers X-RateLimit-* nas respostas.

import type { FastifyInstance } from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';
import { getRedisClient } from '../../common/redis';
import { logger } from '../../observability/logger';

/**
 * Regista o plugin de rate limiting no Fastify.
 * Usa Redis como store para funcionar em ambiente multi-instância.
 */
export async function registerRateLimit(fastify: FastifyInstance): Promise<void> {
  const maxRequests = Number(process.env.RATE_LIMIT_USER_RPM ?? 100);
  const windowMs = 60 * 1000; // 1 minuto

  await fastify.register(fastifyRateLimit, {
    max: maxRequests,
    timeWindow: windowMs,

    // Store Redis para distribuição entre instâncias (horizontal scaling)
    redis: getRedisClient() as Parameters<typeof fastifyRateLimit>[0] extends { redis?: infer R } ? R : never,

    // Chave: IP do cliente (ou X-Forwarded-For atrás de proxy)
    keyGenerator: (request) => {
      const forwarded = request.headers['x-forwarded-for'];
      if (forwarded) {
        const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
        return ip?.trim() ?? request.ip;
      }
      return request.ip;
    },

    // Resposta quando limite atingido
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: 'TOO_MANY_REQUESTS',
      message: `Limite de ${maxRequests} requests/min excedido. Tenta novamente em ${Math.ceil(context.ttl / 1000)} segundos.`,
      retryAfter: Math.ceil(context.ttl / 1000),
    }),

    // Adicionar headers informativos nas respostas
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },

    // Rotas excluídas do rate limiting
    allowList: ['/health', '/health/live', '/health/ready'],

    // Log quando limite atingido
    onExceeding: (request) => {
      logger.warn(
        { ip: request.ip, url: request.url },
        'Rate limit quase atingido'
      );
    },

    onExceeded: (request) => {
      logger.warn(
        { ip: request.ip, url: request.url },
        'Rate limit excedido — request bloqueado'
      );
    },
  });

  logger.info(
    { maxRequests, windowSeconds: windowMs / 1000 },
    'Rate limiting registado'
  );
}
