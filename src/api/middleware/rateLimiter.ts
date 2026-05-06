// Nexora Media Processing — Middleware: Rate Limiter (v2)
// Ficheiro: src/api/middleware/rateLimiter.ts
//
// Rate limiting por utilizador autenticado (ou IP como fallback).
// Limites granulares por rota via rate-limit-config.ts.

import type { FastifyInstance } from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';
import { getRedisClient } from '../../common/redis';
import { logger } from '../../observability/logger';
import { DEFAULT_RATE_LIMIT } from './rate-limit-config';

/**
 * Regista o plugin de rate limiting no Fastify.
 * Usa Redis como store para funcionar em ambiente multi-instância.
 *
 * Chave de rate limiting (por ordem de prioridade):
 *   1. user ID autenticado (request.user.sub) — per-user limit
 *   2. X-Forwarded-For — atrás de proxy
 *   3. request.ip — fallback
 */
export async function registerRateLimit(fastify: FastifyInstance): Promise<void> {
  const { max, timeWindow } = DEFAULT_RATE_LIMIT;

  await fastify.register(fastifyRateLimit, {
    global: true,
    max,
    timeWindow,

    // Store Redis para distribuição entre instâncias (horizontal scaling)
    redis: getRedisClient() as Parameters<typeof fastifyRateLimit>[0] extends { redis?: infer R } ? R : never,

    // Chave: userId autenticado > X-Forwarded-For > IP directo
    keyGenerator: (request) => {
      // Utilizador autenticado — rate limit por identidade, não por IP
      if (request.user?.sub) {
        return `user:${request.user.sub}`;
      }

      // Atrás de proxy/load balancer
      const forwarded = request.headers['x-forwarded-for'];
      if (forwarded) {
        const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
        return `ip:${ip?.trim() ?? request.ip}`;
      }

      return `ip:${request.ip}`;
    },

    // Resposta quando limite atingido
    errorResponseBuilder: (request, context) => ({
      statusCode: 429,
      error: 'TOO_MANY_REQUESTS',
      message: `Limite de requests excedido. Tenta novamente em ${Math.ceil(context.ttl / 1000)} segundos.`,
      retryAfter: Math.ceil(context.ttl / 1000),
    }),

    // Headers informativos nas respostas
    addHeaders: {
      'x-ratelimit-limit':     true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset':     true,
      'retry-after':           true,
    },

    // Rotas excluídas do rate limiting
    allowList: [
      '/health', 
      '/health/live', 
      '/health/ready', 
      '/api/v1/system/version',
      '/system/version'
    ],

    onExceeding: (request) => {
      logger.warn(
        { key: request.user?.sub ?? request.ip, url: request.url },
        'Rate limit quase atingido'
      );
    },

    onExceeded: (request) => {
      logger.warn(
        { key: request.user?.sub ?? request.ip, url: request.url },
        'Rate limit excedido — request bloqueado'
      );
    },
  });

  logger.info(
    { defaultMax: max, windowSeconds: timeWindow / 1000 },
    'Rate limiting v2 registado (per-user key + limites granulares por rota)'
  );
}
