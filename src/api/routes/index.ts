// Nexora Media Processing — Registo Central de Rotas
// Ficheiro: src/api/routes/index.ts
//
// Regista todas as rotas da API com prefixo /api/v1.

import type { FastifyInstance } from 'fastify';
import { assetsRoutes } from './assets';
import { jobsRoutes } from './jobs';
import { profilesRoutes } from './profiles';
import { metricsSummaryRoutes } from './metrics-summary';
import { queueStatsRoutes } from './queue-stats';
import { webhooksRoutes } from './webhooks';
import { statusSseRoutes } from './status-sse';
import { reviewRoutes } from './review';
import { authRoutes } from './auth-routes';
import { usersRoutes } from './users';
import { metricsDashboardRoutes } from './metrics-dashboard';
import { settingsRoutes } from './settings';
import { resetRoutes } from './reset';
import { systemRoutes } from './system';
import { logsRoutes } from './logs';

/**
 * Regista todas as rotas da API no Fastify.
 * Todas as rotas de negócio ficam sob /api/v1.
 * As rotas de sistema (/health, /metrics) são registadas directamente no index.ts.
 */
export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  const prefix = `/api/${process.env.API_VERSION ?? 'v1'}`;

  // ── Prompt 7 — Auth (login, refresh, logout) ─────────────────────
  await fastify.register(authRoutes, { prefix });

  // ── Prompt 1 — Rotas base ────────────────────────────────────────
  await fastify.register(assetsRoutes,  { prefix });
  await fastify.register(jobsRoutes,    { prefix });

  // ── Prompt 2 — Rotas adicionais ──────────────────────────────────
  await fastify.register(profilesRoutes,      { prefix });
  await fastify.register(metricsSummaryRoutes, { prefix });
  await fastify.register(queueStatsRoutes,    { prefix });
  await fastify.register(webhooksRoutes,      { prefix });
  await fastify.register(statusSseRoutes,     { prefix });
  await fastify.register(reviewRoutes,        { prefix });
  await fastify.register(usersRoutes,         { prefix });
  await fastify.register(metricsDashboardRoutes, { prefix });
  await fastify.register(settingsRoutes,          { prefix });
  await fastify.register(resetRoutes,            { prefix });
  await fastify.register(systemRoutes,           { prefix });
  await fastify.register(logsRoutes,             { prefix });
}
