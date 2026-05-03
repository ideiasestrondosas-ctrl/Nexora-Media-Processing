// Nexora Media Processing — Entry point dos Workers BullMQ
// Ficheiro: src/worker.ts
//
// Inicializa todos os workers de processamento de media.
// Verifica disponibilidade das ferramentas via NexoraToolRegistry.
// Graceful shutdown: aguarda jobs activos antes de encerrar.

import { logger } from './observability/logger';
import { IngestWorker } from './workers/ingest.worker';
import { QCWorker } from './workers/qc.worker';
import { TranscodeWorker } from './workers/transcode.worker';
import { AudioWorker } from './workers/audio.worker';
import { SubtitleWorker } from './workers/subtitle.worker';
import { initDatabase, closeDatabase } from './db/prisma';
import { ensureBuckets } from './common/minio';
import { closeRedis } from './common/redis';
import { metricsServer } from './observability/metrics';
import { toolRegistry } from './pipeline/tools/availability-checker';

// Interface partilhada por todos os workers
interface NexoraWorker {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}

// ── Startup ──────────────────────────────────────────────────────

async function startWorkers(): Promise<void> {
  try {
    logger.info('A iniciar Nexora Workers...');

    // 1. Verificar variáveis de ambiente mínimas
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL não definido');
    }
    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL não definido');
    }

    // 2. Inicializar base de dados
    await initDatabase();

    // 3. Garantir que buckets MinIO existem
    await ensureBuckets();

    // 4. Verificar disponibilidade das ferramentas de media
    //    Substituição do checkToolAvailability() inline pelo NexoraToolRegistry (Prompt 9)
    const report = await toolRegistry.checkAllTools();

    // Ferramentas críticas (FFmpeg/FFprobe) — startup falha se ausentes
    if (report.criticalMissing.length > 0) {
      throw new Error(
        `Ferramentas críticas não encontradas: ${report.criticalMissing.join(', ')}.\n` +
        'Instala com:\n' +
        '  Windows: choco install ffmpeg\n' +
        '  macOS:   brew install ffmpeg\n' +
        '  Ubuntu:  sudo apt install ffmpeg'
      );
    }

    // Log de ferramentas opcionais em falta (aviso, não bloqueia)
    if (report.optionalMissing.length > 0) {
      logger.warn(
        { missing: report.optionalMissing },
        `Ferramentas opcionais não disponíveis: ${report.optionalMissing.join(', ')}`
      );
    }

    // 5. Iniciar métricas Prometheus (porta separada dos workers: 9101)
    const prometheusPort = Number(process.env.PROMETHEUS_PORT ?? 9101);
    await metricsServer.start(prometheusPort);
    logger.info({ port: prometheusPort }, 'Prometheus workers iniciado');

    // 6. Criar e iniciar todos os workers
    const workers: NexoraWorker[] = [
      new IngestWorker(),
      new QCWorker(),
      new TranscodeWorker(),
      new AudioWorker(),
      new SubtitleWorker(),
      // Os workers seguintes serão implementados em prompts futuros:
      // new ProxyWorker()    — Prompt futuro
      // new DeliveryWorker() — Prompt futuro
    ];

    for (const worker of workers) {
      await worker.start();
      logger.info({ worker: worker.name }, `Worker ${worker.name} iniciado`);
    }

    logger.info({ count: workers.length }, 'Todos os workers iniciados com sucesso');

    // 7. Manter processo vivo e shutdown gracioso
    const shutdown = async (signal: string): Promise<void> => {
      logger.info({ signal }, 'A encerrar workers graciosamente...');

      // Parar todos os workers (aguardam jobs activos)
      await Promise.all(workers.map(async w => {
        try {
          await w.stop();
        } catch (err) {
          logger.error({ worker: w.name, err }, 'Erro ao encerrar worker');
        }
      }));

      await closeDatabase();
      await closeRedis();

      logger.info('Workers encerrados com sucesso');
      process.exit(0);
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT',  () => void shutdown('SIGINT'));

    // Manter o processo vivo
    process.stdin.resume();

  } catch (error) {
    logger.error(error, 'Erro fatal ao iniciar workers');
    process.exit(1);
  }
}

void startWorkers();
