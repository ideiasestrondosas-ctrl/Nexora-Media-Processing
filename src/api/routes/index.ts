// Nexora Media Processing — Registo Central de Rotas
// Ficheiro: src/api/routes/index.ts
//
// Regista todas as rotas da API com prefixo /api/v1.
// Adicionar aqui novas rotas à medida que o projecto cresce.

import type { FastifyInstance } from 'fastify';
import { assetsRoutes } from './assets';
import { jobsRoutes } from './jobs';

/**
 * Regista todas as rotas da API no Fastify.
 * Todas as rotas de negócio ficam sob /api/v1.
 * As rotas de sistema (/health, /metrics) são registadas directamente no index.ts.
 */
export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  const prefix = `/api/${process.env.API_VERSION ?? 'v1'}`;

  // Rotas de Assets
  await fastify.register(assetsRoutes, { prefix: `${prefix}` });

  // Rotas de Jobs
  await fastify.register(jobsRoutes, { prefix: `${prefix}` });
}
