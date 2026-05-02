// Nexora Media Processing — Logger Pino
// Ficheiro: src/observability/logger.ts
//
// Logger estruturado com Pino — todos os logs em JSON (produção)
// ou pretty-print (desenvolvimento).
// Inclui helpers para contexto de asset e job.

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    service: 'nexora-media-processing',
    version: process.env.npm_package_version ?? '0.0.0',
    env: process.env.NODE_ENV ?? 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Em produção: logs JSON puro (para Loki/ELK)
  // Em desenvolvimento: logs formatados com pino-pretty
  transport: process.env.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname,service,version,env',
        },
      }
    : undefined,
});

/** Helper para criar logger filho com contexto de asset */
export function assetLogger(assetId: string): pino.Logger {
  return logger.child({ asset_id: assetId });
}

/** Helper para criar logger filho com contexto de job */
export function jobLogger(jobId: string, assetId?: string): pino.Logger {
  return logger.child({
    job_id: jobId,
    ...(assetId ? { asset_id: assetId } : {}),
  });
}
