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
import { setupJobSync } from './workers/job-sync';
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
  setConcurrency(n: number): void;
}

import os from 'os';
import fs from 'fs';
import path from 'path';

// ── Startup ──────────────────────────────────────────────────────

const CONFIG_PATH = path.join(process.cwd(), 'nexora-config.json');

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

    // 4. Iniciar sincronização de jobs (BullMQ -> Postgres)
    setupJobSync();

    // 5. Verificar disponibilidade das ferramentas de media
    const report = await toolRegistry.checkAllTools();

    if (report.criticalMissing.length > 0) {
      throw new Error(
        `Ferramentas críticas não encontradas: ${report.criticalMissing.join(', ')}.\n` +
        'Instala com:\n' +
        '  Windows: choco install ffmpeg'
      );
    }

    if (report.optionalMissing.length > 0) {
      logger.warn(
        { missing: report.optionalMissing },
        `Ferramentas opcionais não disponíveis: ${report.optionalMissing.join(', ')}`
      );
    }

    // 5. Iniciar métricas Prometheus
    const prometheusPort = Number(process.env.PROMETHEUS_WORKER_PORT ?? 9101);
    await metricsServer.start(prometheusPort);

    // 6. Criar e iniciar todos os workers
    const workers: NexoraWorker[] = [
      new IngestWorker(),
      new QCWorker(),
      new TranscodeWorker(),
      new AudioWorker(),
      new SubtitleWorker(),
    ];

    for (const worker of workers) {
      await worker.start();
      logger.info({ worker: worker.name }, `Worker ${worker.name} iniciado`);
    }

    // 7. Dynamic Resource Management (Web Priority)
    const totalCpus = os.cpus().length;
    let lastPriority = -1;

    const updateConcurrency = () => {
      try {
        if (!fs.existsSync(CONFIG_PATH)) return;
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        const priority = config.webPriorityPercentage ?? 20;

        if (priority === lastPriority) return;
        lastPriority = priority;

        // Cálculo de concorrência:
        // Se priority = 20% (reserva para web), sobram 80% para workers.
        // n = Math.floor(totalCpus * (1 - priority/100))
        // Garantimos pelo menos 1 worker.
        const availableRatio = 1 - (priority / 100);
        const transcodeConcurrency = Math.max(1, Math.floor(totalCpus * availableRatio));
        
        // Outros workers (ingest, subtitle) são menos pesados, usamos o mesmo ratio ou fixo
        const lightConcurrency = Math.max(1, Math.round(transcodeConcurrency * 1.5));

        logger.info({ priority, transcodeConcurrency, lightConcurrency }, 'Ajustando recursos de hardware');

        for (const worker of workers) {
          if (worker.name === 'TranscodeWorker' || worker.name === 'QCWorker') {
            worker.setConcurrency(transcodeConcurrency);
          } else {
            worker.setConcurrency(lightConcurrency);
          }
        }
      } catch (err) {
        logger.error({ err }, 'Erro ao atualizar concorrência dinâmica');
      }
    };

    // Poll a cada 30 segundos
    const interval = setInterval(updateConcurrency, 30000);
    updateConcurrency(); // Execução inicial

    logger.info({ count: workers.length, cpus: totalCpus }, 'Todos os workers iniciados com gestão dinâmica');

    // 8. Manter processo vivo e shutdown gracioso
    const shutdown = async (signal: string): Promise<void> => {
      logger.info({ signal }, 'A encerrar workers graciosamente...');
      clearInterval(interval);

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

    process.stdin.resume();

  } catch (error) {
    logger.error(error, 'Erro fatal ao iniciar workers');
    process.exit(1);
  }
}

void startWorkers();
