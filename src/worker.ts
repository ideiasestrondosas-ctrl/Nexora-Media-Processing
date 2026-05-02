// Nexora Media Processing — Entry point dos Workers BullMQ
// Ficheiro: src/worker.ts
//
// Inicializa todos os workers de processamento de media.
// Verifica disponibilidade das ferramentas (FFmpeg obrigatório).
// Graceful shutdown: aguarda jobs activos antes de encerrar.

import { logger } from './observability/logger';
import { IngestWorker } from './workers/ingest.worker';
import { QCWorker } from './workers/qc.worker';
import { TranscodeWorker } from './workers/transcode.worker';
import { AudioWorker } from './workers/audio.worker';
import { initDatabase, closeDatabase } from './db/prisma';
import { ensureBuckets } from './common/minio';
import { closeRedis } from './common/redis';
import { metricsServer } from './observability/metrics';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// Interface partilhada por todos os workers
interface NexoraWorker {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}

// ── Verificação de ferramentas ────────────────────────────────────

interface ToolStatus {
  ffmpeg: boolean;
  ffprobe: boolean;
  mediainfo: boolean;
  bs1770gain: boolean;
  handbrake: boolean;
}

async function checkToolAvailability(): Promise<ToolStatus> {
  const tools: Array<{ key: keyof ToolStatus; envKey: string; defaultName: string; args: string[] }> = [
    { key: 'ffmpeg',    envKey: 'FFMPEG_PATH',    defaultName: 'ffmpeg',    args: ['-version'] },
    { key: 'ffprobe',   envKey: 'FFPROBE_PATH',   defaultName: 'ffprobe',   args: ['-version'] },
    { key: 'mediainfo', envKey: 'MEDIAINFO_PATH',  defaultName: 'mediainfo', args: ['--version'] },
    { key: 'bs1770gain',envKey: 'BS1770GAIN_PATH', defaultName: 'bs1770gain',args: ['--version'] },
    { key: 'handbrake', envKey: 'HANDBRAKE_CLI_PATH', defaultName: 'HandBrakeCLI', args: ['--version'] },
  ];

  const status: ToolStatus = {
    ffmpeg: false, ffprobe: false, mediainfo: false, bs1770gain: false, handbrake: false,
  };

  await Promise.all(tools.map(async ({ key, envKey, defaultName, args }) => {
    const toolPath = process.env[envKey] ?? defaultName;
    try {
      await execFileAsync(toolPath, args, { timeout: 5000 });
      status[key] = true;
    } catch {
      status[key] = false;
    }
  }));

  return status;
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
    const toolStatus = await checkToolAvailability();

    for (const [tool, available] of Object.entries(toolStatus)) {
      if (available) {
        logger.info({ tool }, `✓ Ferramenta disponível: ${tool}`);
      } else {
        logger.warn({ tool }, `⚠ Ferramenta não encontrada: ${tool}`);
      }
    }

    // FFmpeg é obrigatório — sem ele não há processamento
    if (!toolStatus.ffmpeg) {
      throw new Error(
        'FFmpeg não encontrado. Instala com:\n' +
        '  Windows: choco install ffmpeg\n' +
        '  macOS:   brew install ffmpeg\n' +
        '  Ubuntu:  sudo apt install ffmpeg'
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
      // Os workers seguintes serão implementados nos Prompts 2 e 9:
      // new ProxyWorker()    — Prompt 9
      // new DeliveryWorker() — Prompt 9
      // new AnalyzerWorker() — Prompt 9
      // new SubtitleWorker() — Prompt 9
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
