// Nexora Media Processing — Plugins Fastify (v2)
// Ficheiro: src/api/plugins.ts
//
// Registo centralizado de todos os plugins Fastify.
// Ordem: Helmet → CORS → Multipart → RateLimit → Swagger → Auth → Audit
// Prompt 7: +helmet (security headers) + CORS configurável por ambiente

import type { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifySwagger from '@fastify/swagger';
import helmet from '@fastify/helmet';
import { registerRateLimit } from './middleware/rateLimiter';
import { registerAuthHook } from './middleware/auth';
import { registerAuditHook } from './middleware/audit';
import { logger } from '../observability/logger';
import { isNexoraError } from '../common/errors';
import { httpRequestDuration, httpRequestsTotal } from '../observability/metrics';

const MAX_UPLOAD_SIZE = Number(process.env.MAX_UPLOAD_SIZE_BYTES ?? 53687091200); // 50 GB

/**
 * Regista todos os plugins e middleware Fastify.
 * Chamado uma vez no startup, antes de registerRoutes().
 */
export async function registerPlugins(fastify: FastifyInstance): Promise<void> {

  // 1. Security Headers — Helmet (deve ser o primeiro plugin)
  // crossOriginEmbedderPolicy: false necessário para streams de media
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc:     ["'self'"],
        scriptSrc:      ["'self'"],
        styleSrc:       ["'self'", "'unsafe-inline'"],
        imgSrc:         ["'self'", 'data:'],
        connectSrc:     ["'self'"],
        frameSrc:       ["'none'"],
        objectSrc:      ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    hsts: process.env.NODE_ENV === 'production'
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
      : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: false,  // necessário para media streams
    crossOriginResourcePolicy: { policy: 'same-site' },
    xFrameOptions: { action: 'deny' },
    xContentTypeOptions: true,
  });

  // 2. CORS — whitelist configurável por ambiente
  // Produção: CORS_ORIGINS=https://app.nexora.io,https://admin.nexora.io
  // Desenvolvimento: aceitar localhost de qualquer porta
  const corsOrigins: (string | RegExp)[] = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
    : process.env.NODE_ENV === 'production'
      ? []
      : [/^https?:\/\/localhost(:\d+)?$/, /^https?:\/\/127\.0\.0\.1(:\d+)?$/];

  await fastify.register(fastifyCors, {
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Forwarded-For'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
    maxAge: 86_400, // 24h preflight cache
  });

  // 3. Multipart para upload de ficheiros
  await fastify.register(fastifyMultipart, {
    limits: {
      fileSize:      MAX_UPLOAD_SIZE,
      files:         1,
      fieldNameSize: 200,
      headerPairs:   2000,
    },
  });

  // 4. Rate limiting (com store Redis)
  await registerRateLimit(fastify);

  // 5. Swagger / OpenAPI
  await fastify.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Nexora Media Processing API',
        description: 'Plataforma profissional de ingest, transcoding e entrega de media para broadcast e OTT',
        version: process.env.npm_package_version ?? '0.1.0',
        contact: { name: 'Nexora Engineering' },
      },
      servers: [
        { url: 'http://localhost:3000', description: 'Desenvolvimento' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT RS256 (access token 15min) — obter via POST /api/v1/auth/login',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  // 6. Hook de autenticação JWT RS256 (ADR-008)
  await registerAuthHook(fastify);

  // 7. Hook de auditoria (ADR-007)
  await registerAuditHook(fastify);

  // 8. Handler global de erros NexoraError
  fastify.setErrorHandler((error, request, reply) => {
    if (isNexoraError(error)) {
      logger.warn(
        { error: error.toJSON(), url: request.url, method: request.method },
        'NexoraError'
      );
      return reply.status(error.statusCode).send({
        error:     error.code,
        message:   error.message,
        details:   error.details,
        timestamp: error.timestamp,
      });
    }

    if (error.validation) {
      return reply.status(400).send({
        error:   'VALIDATION_ERROR',
        message: 'Dados de input inválidos',
        details: error.validation,
      });
    }

    logger.error(
      { err: error, url: request.url, method: request.method },
      'Erro interno não esperado'
    );

    return reply.status(500).send({
      error:   'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'Erro interno do servidor'
        : error.message,
    });
  });

  // 9. Hook de métricas HTTP (Prompt 10) — mede latência por rota
  fastify.addHook('onSend', async (request, reply) => {
    const route = request.routerPath ?? request.url.split('?')[0] ?? 'unknown';
    const method = request.method;
    const statusCode = String(reply.statusCode);

    // Excluir rotas de sistema para não poluir métricas
    if (route.startsWith('/health') || route === '/metrics') return;

    // Calcular duração desde o início da request
    const startTime = (request as unknown as { _startTime?: number })._startTime;
    if (typeof startTime === 'number') {
      const duration = (Date.now() - startTime) / 1000;
      httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
    }
    httpRequestsTotal.inc({ method, route, status_code: statusCode });
  });

  fastify.addHook('onRequest', async (request) => {
    (request as unknown as { _startTime: number })._startTime = Date.now();
  });

  logger.info('Todos os plugins Fastify registados (v2 — helmet + CORS configurável)');
}
