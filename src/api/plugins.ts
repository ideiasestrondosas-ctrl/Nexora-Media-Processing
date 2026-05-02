// Nexora Media Processing — Plugins Fastify
// Ficheiro: src/api/plugins.ts
//
// Registo centralizado de todos os plugins Fastify.
// Ordem importa: CORS → Multipart → RateLimit → Swagger → Auth → Audit

import type { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifySwagger from '@fastify/swagger';
import { registerRateLimit } from './middleware/rateLimiter';
import { registerAuthHook } from './middleware/auth';
import { registerAuditHook } from './middleware/audit';
import { logger } from '../observability/logger';
import { isNexoraError } from '../common/errors';

const MAX_UPLOAD_SIZE = Number(process.env.MAX_UPLOAD_SIZE_BYTES ?? 53687091200); // 50 GB

/**
 * Regista todos os plugins e middleware Fastify.
 * Chamado uma vez no startup, antes de registerRoutes().
 */
export async function registerPlugins(fastify: FastifyInstance): Promise<void> {

  // 1. CORS — configurável por ambiente
  await fastify.register(fastifyCors, {
    origin: process.env.CORS_ORIGIN ?? (
      process.env.NODE_ENV === 'production'
        ? false  // produção: sem CORS wildcard
        : true   // desenvolvimento: aceitar todas as origens
    ),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // 2. Multipart para upload de ficheiros
  await fastify.register(fastifyMultipart, {
    limits: {
      fileSize: MAX_UPLOAD_SIZE,
      files: 1,             // máximo 1 ficheiro por request
      fieldNameSize: 200,   // tamanho máximo do nome do campo
      headerPairs: 2000,    // máximo de pares header
    },
  });

  // 3. Rate limiting (com store Redis)
  await registerRateLimit(fastify);

  // 4. Swagger / OpenAPI
  await fastify.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Nexora Media Processing API',
        description: 'Plataforma profissional de ingest, transcoding e entrega de media para broadcast e OTT',
        version: process.env.npm_package_version ?? '0.1.0',
        contact: {
          name: 'Nexora Engineering',
        },
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
            description: 'JWT RS256 — obter token via /auth/token',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  // 5. Hook de autenticação JWT RS256 (ADR-008)
  await registerAuthHook(fastify);

  // 6. Hook de auditoria (ADR-007)
  await registerAuditHook(fastify);

  // 7. Handler global de erros NexoraError
  fastify.setErrorHandler((error, request, reply) => {
    if (isNexoraError(error)) {
      // Erro tipado do Nexora — resposta estruturada
      logger.warn(
        { error: error.toJSON(), url: request.url, method: request.method },
        'NexoraError'
      );
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
        details: error.details,
        timestamp: error.timestamp,
      });
    }

    // Erro de validação do Fastify (body/query/params inválidos)
    if (error.validation) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Dados de input inválidos',
        details: error.validation,
      });
    }

    // Erro genérico — não expor detalhes em produção
    logger.error(
      { err: error, url: request.url, method: request.method },
      'Erro interno não esperado'
    );

    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'Erro interno do servidor'
        : error.message,
    });
  });

  logger.info('Todos os plugins Fastify registados');
}
