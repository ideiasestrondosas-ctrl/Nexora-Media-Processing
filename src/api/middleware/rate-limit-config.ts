// Nexora Media Processing — Rate Limit Configuration
// Ficheiro: src/api/middleware/rate-limit-config.ts
//
// Limites granulares por rota para @fastify/rate-limit.
// Protecção de brute force em auth + throttling de uploads pesados.

export interface RouteRateLimit {
  max: number;          // máximo de requests
  timeWindow: number;   // janela em milissegundos
  description: string;
}

// ── Tabela de limites por rota ─────────────────────────────────────
//
// Chave: "METHOD:path" (ex: "POST:/assets/upload")
// Rota não mapeada usa o limite global (100/min)

export const ROUTE_RATE_LIMITS: Record<string, RouteRateLimit> = {
  // Auth — brute force protection
  'POST:/api/v1/auth/login':        { max: 10,  timeWindow: 60_000,  description: 'Login brute force limit' },
  'POST:/api/v1/auth/refresh':      { max: 20,  timeWindow: 60_000,  description: 'Token refresh limit' },
  'POST:/api/v1/auth/logout':       { max: 20,  timeWindow: 60_000,  description: 'Logout limit' },
  'POST:/api/v1/auth/logout-all':   { max: 5,   timeWindow: 60_000,  description: 'Logout-all strict limit' },

  // Upload — operação cara (I/O + validação)
  'POST:/api/v1/assets/upload':     { max: 5,   timeWindow: 60_000,  description: 'Upload throttle (expensive I/O)' },

  // Webhooks — gestão de configuração
  'POST:/api/v1/webhooks':          { max: 10,  timeWindow: 60_000,  description: 'Webhook registration limit' },
  'DELETE:/api/v1/webhooks':        { max: 10,  timeWindow: 60_000,  description: 'Webhook deletion limit' },

  // Leituras — mais permissivas
  'GET:/api/v1/assets':             { max: 200, timeWindow: 60_000,  description: 'Asset list (read-heavy)' },
  'GET:/api/v1/jobs':               { max: 200, timeWindow: 60_000,  description: 'Job list (read-heavy)' },
  'GET:/api/v1/queue-stats':        { max: 60,  timeWindow: 60_000,  description: 'Queue stats polling' },
  'GET:/api/v1/metrics-summary':    { max: 60,  timeWindow: 60_000,  description: 'Metrics polling' },

  // SSE (Server-Sent Events) — conexão persistente
  'GET:/api/v1/status-sse':         { max: 5,   timeWindow: 60_000,  description: 'SSE connection limit (persistent)' },
};

// Limite global por defeito (rotas não mapeadas)
export const DEFAULT_RATE_LIMIT: RouteRateLimit = {
  max: 100,
  timeWindow: 60_000,
  description: 'Default global limit',
};

/**
 * Obtém o limite configurado para uma dada rota.
 * Suporta wildcards — tenta match exacto, depois apenas o path.
 */
export function getRateLimit(method: string, path: string): RouteRateLimit {
  // Normalizar path — remover query string e UUIDs
  const normalizedPath = path.split('?')[0]!;
  // Substituir UUIDs por placeholder para match mais permissivo
  const genericPath = normalizedPath.replace(
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/|$)/gi,
    '/:id$1'
  );

  const key = `${method.toUpperCase()}:${normalizedPath}`;
  const genericKey = `${method.toUpperCase()}:${genericPath}`;

  return ROUTE_RATE_LIMITS[key]
    ?? ROUTE_RATE_LIMITS[genericKey]
    ?? DEFAULT_RATE_LIMIT;
}
