// Nexora Media Processing — Logger Pino
// Ficheiro: src/observability/logger.ts
//
// Logger estruturado com Pino — todos os logs em JSON (produção)
// ou pretty-print (desenvolvimento).
// Inclui helpers para contexto de asset e job.

import pino from 'pino';
import { logStreamer } from './log-streamer';

// Stream customizado para capturar logs em memória para o dashboard
const memoryStream = {
  write(msg: string) {
    try {
      const log = JSON.parse(msg);
      logStreamer.pushLog(log);
    } catch {
      // Ignorar erros de parsing
    }
  }
};

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    service: 'nexora-media-processing',
    version: process.env.npm_package_version ?? '0.0.0',
    env: process.env.NODE_ENV ?? 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
}, pino.multistream([
  { stream: process.stdout }, // Mantém output original
  { stream: memoryStream }    // Adiciona stream para o dashboard
]));

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
