// Nexora Media Processing — Entry point da API
// Ficheiro: src/index.ts
//
// Inicializa o servidor Fastify, regista plugins e rotas.
// Validação de variáveis de ambiente obrigatórias no startup.

import Fastify, { FastifyInstance } from 'fastify';
import { registerPlugins } from './api/plugins';
import { registerRoutes } from './api/routes/index';
import { initDatabase, closeDatabase } from './db/prisma';
import { initQueues, closeQueues } from './workers/queues';
import { ensureBuckets } from './common/minio';
import { closeRedis } from './common/redis';
import { metricsServer } from './observability/metrics';
import { logger } from './observability/logger';

// Usar o logger do Pino em vez do logger nativo do Fastify
// para consistência com o resto da aplicação
const app: FastifyInstance = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    transport: process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
      : undefined,
  },
});

async function start(): Promise<void> {
  try {
    // 1. Validar variáveis de ambiente obrigatórias (falha rápida)
    validateEnvironment();

    // 2. Inicializar base de dados (verificar conectividade)
    await initDatabase();

    // 3. Garantir que os buckets MinIO existem
    await ensureBuckets();
    logger.info('Buckets MinIO verificados');

    // 4. Registar plugins Fastify (auth, CORS, multipart, rate limit, swagger)
    await registerPlugins(app);

    // 5. Registar rotas da API
    await registerRoutes(app);

    // 6. Rotas de sistema (health checks — sem prefixo /api/v1)
    app.get('/health', async () => {
      const { toolRegistry } = await import('./pipeline/tools/availability-checker');
      const report = toolRegistry.getReport();
      return {
        status: 'ok',
        service: 'nexora-media-processing',
        version: process.env.npm_package_version ?? '0.1.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        tools: {
          available: report.tools.filter(t => t.available).map(t => t.name),
          missing: report.optionalMissing,
          criticalMissing: report.criticalMissing,
        },
      };
    });

    app.get('/health/live', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

    app.get('/health/ready', async (_, reply) => {
      const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};

      // 1. PostgreSQL
      const pgStart = Date.now();
      try {
        const { prisma } = await import('./db/prisma');
        await prisma.$queryRaw`SELECT 1`;
        checks['postgresql'] = { ok: true, latencyMs: Date.now() - pgStart };
      } catch (err) {
        checks['postgresql'] = { ok: false, error: String(err) };
      }

      // 2. Redis
      const redisStart = Date.now();
      try {
        const { getRedisClient } = await import('./common/redis');
        const pong = await getRedisClient().ping();
        checks['redis'] = { ok: pong === 'PONG', latencyMs: Date.now() - redisStart };
      } catch (err) {
        checks['redis'] = { ok: false, error: String(err) };
      }

      // 3. MinIO
      const minioStart = Date.now();
      try {
        const { getMinioClient } = await import('./common/minio');
        await getMinioClient().listBuckets();
        checks['minio'] = { ok: true, latencyMs: Date.now() - minioStart };
      } catch (err) {
        checks['minio'] = { ok: false, error: String(err) };
      }

      const allOk = Object.values(checks).every(c => c.ok);
      return reply
        .status(allOk ? 200 : 503)
        .send({ status: allOk ? 'ok' : 'degraded', timestamp: new Date().toISOString(), checks });
    });

    // 7. Inicializar filas BullMQ
    await initQueues();

    // 8. Iniciar servidor de métricas Prometheus numa porta separada
    const prometheusPort = Number(process.env.PROMETHEUS_PORT ?? 9100);
    await metricsServer.start(prometheusPort);
    logger.info({ port: prometheusPort }, 'Servidor de métricas Prometheus iniciado');

    // 9. Iniciar servidor API principal
    const port = Number(process.env.PORT ?? 3000);
    await app.listen({ port, host: '0.0.0.0' });
    logger.info({ port }, 'Nexora Media Processing API iniciada');

  } catch (error) {
    logger.error(error, 'Erro fatal ao iniciar o servidor');
    process.exit(1);
  }
}

// ── Gestão limpa de encerramento ─────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'A encerrar Nexora graciosamente...');

  try {
    await app.close();
    await closeQueues();
    await closeDatabase();
    await closeRedis();
    logger.info('Nexora encerrado com sucesso');
    process.exit(0);
  } catch (error) {
    logger.error(error, 'Erro durante o shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT',  () => void shutdown('SIGINT'));

// ── Validação de ambiente ────────────────────────────────────────

function validateEnvironment(): void {
  const required: string[] = [
    'DATABASE_URL',
    'REDIS_URL',
    'MINIO_ENDPOINT',
    'NEXORA_INPUT_DIR',
    'NEXORA_OUTPUT_DIR',
    'NEXORA_TEMP_DIR',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente em falta: ${missing.join(', ')}\n` +
      'Copia .env.example para .env e preenche os valores.'
    );
  }

  // Verificar chaves JWT (warning, não erro — pode estar a usar modo dev)
  if (!process.env.JWT_PUBLIC_KEY_PATH) {
    logger.warn('JWT_PUBLIC_KEY_PATH não definido — autenticação pode falhar');
  }
}

void start();
