// Nexora Media Processing — Logger Pino
// Ficheiro: src/observability/logger.ts
//
// Logger estruturado com Pino — todos os logs em JSON (produção)
// ou pretty-print (desenvolvimento).
// Inclui helpers para contexto de asset e job.

import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';
import { logStreamer } from './log-streamer';

// Garantir diretório de logs
const LOG_DIR = path.join(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Stream para ficheiro local (para persistência e rotação)
const fileStream = fs.createWriteStream(path.join(LOG_DIR, 'nexora.log'), { flags: 'a' });

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

// Stream para publicar logs no Redis para que outros serviços (ex: API) os recebam
const redisStream = {
  write(msg: string) {
    try {
      // Import dinâmico para evitar circular dependency total no arranque
      const { getRedisClient } = require('../common/redis');
      const client = getRedisClient();
      client.publish('nexora:logs:stream', msg).catch(() => {});
    } catch {
      // Silencioso para não crashar o processo por causa do logger
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
  { stream: memoryStream },    // Adiciona stream para o dashboard local
  { stream: redisStream },     // Publica no Redis para stream global
  { stream: fileStream }       // Persistência em disco
]));

// Iniciar rotação de logs (apenas se for o processo principal ou worker relevante)
if (process.env.ENABLE_LOG_ROTATION === 'true') {
  const { logRotationManager } = require('./log-rotation');
  logRotationManager.start();
}

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
