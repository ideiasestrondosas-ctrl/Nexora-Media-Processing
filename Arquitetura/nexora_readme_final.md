# Nexora Media Processing — Ficheiros base da aplicação

---

## README.md (raiz do projecto)

```markdown
# Nexora Media Processing

> Plataforma profissional de processamento de media para Broadcast & OTT  
> Stack 100% Open Source · EBU R128 · AS-11 · CMAF · VMAF

[![Tests](https://github.com/[utilizador]/nexora-media-processing/actions/workflows/test.yml/badge.svg)](https://github.com/[utilizador]/nexora-media-processing/actions/workflows/test.yml)
[![Coverage](https://codecov.io/gh/[utilizador]/nexora-media-processing/branch/main/graph/badge.svg)](https://codecov.io/gh/[utilizador]/nexora-media-processing)

---

## O que é

O Nexora Media Processing recebe ficheiros de vídeo e áudio, valida-os automaticamente
contra os standards de broadcast, corrige problemas de qualidade, converte-os para os
formatos pedidos e entrega-os prontos a emitir.

**Pipeline:** Ingest → QC pré → Análise → Transcode + Áudio → Proxy → QC pós → Delivery

---

## Começar em 10 comandos

```bash
# 1. Clonar o repositório
git clone https://github.com/[utilizador]/nexora-media-processing.git
cd nexora-media-processing

# 2. Executar setup do ambiente (instala todas as ferramentas)
bash scripts/nexora-setup.sh

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Edita o .env com as tuas configurações

# 4. Instalar dependências Node.js
npm install

# 5. Iniciar serviços de infra
docker compose up -d postgres redis minio temporal temporal-ui

# 6. Aguardar serviços iniciarem (~30 segundos)
sleep 30

# 7. Aplicar migrações da base de dados
npm run db:migrate

# 8. Colocar dados de teste (opcional)
npm run db:seed

# 9. Iniciar a API
npm run dev

# 10. Iniciar os workers (em novo terminal)
npm run worker
```

Aceder em:
- **App:** http://localhost:3000
- **Temporal UI:** http://localhost:8080
- **Grafana:** http://localhost:3001 (admin/nexora)
- **MinIO:** http://localhost:9001 (nexoraadmin/nexora_minio_secret)

---

## Arquitectura

```
Ingest → QC & Validação → Intelligence → Processing → QC Pós-encode → Delivery
                                              ↓
                              Workers distribuídos (Temporal.io):
                              Transcode · Áudio · Legendas · DRM · Proxy
```

**Stack:** Node.js 20 + TypeScript + Fastify + BullMQ + Redis + PostgreSQL + MinIO + Temporal.io  
**Frontend:** Next.js 14 + React + Tailwind CSS  
**Media tools:** FFmpeg · HandBrakeCLI · MediaInfo · FFprobe · MediaConch · BS1770GAIN

---

## Perfis de encoding

| Perfil | Formato | Uso |
|---|---|---|
| `nexora_broadcast_hd` | MXF OP1a + H.264 | Broadcasters (RTP, SIC, TVI, BBC...) |
| `nexora_ott_premium` | CMAF + H.265 + DRM | Netflix, Amazon, Disney+ |
| `nexora_streaming_web` | MP4 + H.264 ladder | YouTube, web players |
| `nexora_proxy_lowres` | MP4 720p 800kbps | Revisão editorial |
| `nexora_archive` | MXF + ProRes 4444 | Arquivo profissional |

---

## Standards cobertos

EBU R128 · ITU-R BS.1770-4 · AS-11 UK DPP · IMF SMPTE ST 2067 ·
CMAF ISO 23000-19 · EBU Core · Apple HLS Authoring · DASH-IF IOP ·
Harding FPA · SCTE-35 · SPEKE/CPIX · Netflix per-title encoding

---

## Desenvolvimento

```bash
npm run dev              # API em modo desenvolvimento
npm run worker           # Workers BullMQ
npm test                 # Testes unitários
npm run test:coverage    # Testes com cobertura
npm run test:e2e         # Testes E2E (Playwright)
npm run lint             # ESLint
npm run db:studio        # Prisma Studio (UI da base de dados)
```

---

## Documentação

- [Manual técnico completo](docs/manual-v4.md)
- [Arquitectura detalhada](docs/architecture.md)
- [Architecture Decision Records](docs/adr/)
- [API Reference](openapi.yaml)
- [Estado do projecto](PROGRESS.md)

---

## Licença

MIT — ver [LICENSE](LICENSE)
```

---

## src/index.ts — Entry point da API

```typescript
// Nexora Media Processing — Entry point da API
// Inicializa o servidor Fastify, regista plugins e rotas

import Fastify, { FastifyInstance } from 'fastify';
import { registerPlugins } from './api/plugins';
import { registerRoutes } from './api/routes';
import { initDatabase } from './db/prisma';
import { initQueues } from './workers/queues';
import { metricsServer } from './observability/metrics';
import { logger } from './observability/logger';

const app: FastifyInstance = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    transport: process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined
  }
});

async function start(): Promise<void> {
  try {
    // Verificar variáveis de ambiente obrigatórias
    validateEnvironment();

    // Inicializar base de dados
    await initDatabase();
    logger.info('Base de dados conectada');

    // Registar plugins Fastify (auth, CORS, multipart, etc.)
    await registerPlugins(app);

    // Registar rotas da API
    await registerRoutes(app);

    // Inicializar filas BullMQ
    await initQueues();
    logger.info('Filas BullMQ inicializadas');

    // Iniciar servidor de métricas Prometheus na porta separada
    await metricsServer.start(Number(process.env.PROMETHEUS_PORT ?? 9100));

    // Iniciar servidor principal
    const port = Number(process.env.PORT ?? 3000);
    await app.listen({ port, host: '0.0.0.0' });
    logger.info({ port }, 'Nexora Media Processing iniciado');

  } catch (error) {
    logger.error(error, 'Erro ao iniciar o servidor');
    process.exit(1);
  }
}

// Gestão limpa de encerramento
process.on('SIGTERM', async () => {
  logger.info('SIGTERM recebido — a encerrar graciosamente');
  await app.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT recebido — a encerrar graciosamente');
  await app.close();
  process.exit(0);
});

function validateEnvironment(): void {
  const required = [
    'DATABASE_URL',
    'REDIS_URL',
    'MINIO_ENDPOINT',
    'NEXORA_INPUT_DIR',
    'NEXORA_OUTPUT_DIR',
    'NEXORA_TEMP_DIR'
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente em falta: ${missing.join(', ')}\n` +
      'Copia .env.example para .env e preenche os valores.'
    );
  }
}

void start();
```

---

## src/worker.ts — Entry point dos Workers

```typescript
// Nexora Media Processing — Entry point dos Workers BullMQ
// Inicializa todos os workers de processamento de media

import { logger } from './observability/logger';
import { IngestWorker } from './workers/ingest.worker';
import { QCWorker } from './workers/qc.worker';
import { AnalyzerWorker } from './workers/analyzer.worker';
import { TranscodeWorker } from './workers/transcode.worker';
import { AudioWorker } from './workers/audio.worker';
import { ProxyWorker } from './workers/proxy.worker';
import { QCPostWorker } from './workers/qc-post.worker';
import { DeliveryWorker } from './workers/delivery.worker';
import { SubtitleWorker } from './workers/subtitle.worker';
import { checkToolAvailability } from './pipeline/tools/availability-checker';
import { metricsServer } from './observability/metrics';

async function startWorkers(): Promise<void> {
  try {
    logger.info('A iniciar workers Nexora...');

    // Verificar disponibilidade das ferramentas de media
    const toolStatus = await checkToolAvailability();
    logToolStatus(toolStatus);

    // Falhar se FFmpeg não estiver disponível (obrigatório)
    if (!toolStatus.ffmpeg) {
      throw new Error(
        'FFmpeg não encontrado. Instala com:\n' +
        '  macOS:  brew install ffmpeg\n' +
        '  Ubuntu: sudo apt install ffmpeg\n' +
        '  Windows: choco install ffmpeg'
      );
    }

    // Iniciar métricas na porta separada
    await metricsServer.start(Number(process.env.PROMETHEUS_PORT ?? 9101));

    // Iniciar todos os workers
    const workers = [
      new IngestWorker(),
      new QCWorker(),
      new AnalyzerWorker(),
      new TranscodeWorker(),
      new AudioWorker(),
      new SubtitleWorker(),
      new ProxyWorker(),
      new QCPostWorker(),
      new DeliveryWorker()
    ];

    for (const worker of workers) {
      await worker.start();
      logger.info({ worker: worker.name }, 'Worker iniciado');
    }

    logger.info(
      { count: workers.length },
      'Todos os workers iniciados com sucesso'
    );

    // Manter o processo vivo
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM — a encerrar workers graciosamente');
      await Promise.all(workers.map(w => w.stop()));
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT — a encerrar workers graciosamente');
      await Promise.all(workers.map(w => w.stop()));
      process.exit(0);
    });

  } catch (error) {
    logger.error(error, 'Erro fatal ao iniciar workers');
    process.exit(1);
  }
}

function logToolStatus(status: Record<string, boolean>): void {
  for (const [tool, available] of Object.entries(status)) {
    if (available) {
      logger.info({ tool }, '✓ Ferramenta disponível');
    } else {
      logger.warn({ tool }, '⚠ Ferramenta não encontrada (usando fallback se disponível)');
    }
  }
}

void startWorkers();
```

---

## src/health-worker.ts — Health check dos workers (para Docker)

```typescript
// Verificação de saúde do worker — usado pelo HEALTHCHECK do Docker

import { createConnection } from 'ioredis';

async function check(): Promise<void> {
  const redis = createConnection(process.env.REDIS_URL ?? 'redis://localhost:6379');

  try {
    await redis.ping();
    console.log('OK');
    process.exit(0);
  } catch {
    console.error('Redis não disponível');
    process.exit(1);
  } finally {
    redis.disconnect();
  }
}

void check();
```

---

## src/observability/logger.ts — Logger estruturado

```typescript
// Logger estruturado com Pino — todos os logs em JSON
// Inclui asset_id e job_id em todos os logs quando disponível

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    service: 'nexora-media-processing',
    version: process.env.npm_package_version ?? '0.0.0',
    env: process.env.NODE_ENV ?? 'development'
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Em produção, logs em JSON puro (para Loki/ELK)
  // Em desenvolvimento, logs formatados (pino-pretty)
  transport: process.env.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname,service,version,env'
        }
      }
    : undefined
});

// Helper para criar logger filho com contexto de asset
export function assetLogger(assetId: string): pino.Logger {
  return logger.child({ asset_id: assetId });
}

// Helper para criar logger filho com contexto de job
export function jobLogger(jobId: string, assetId?: string): pino.Logger {
  return logger.child({ job_id: jobId, ...(assetId ? { asset_id: assetId } : {}) });
}
```

---

## src/observability/metrics.ts — Métricas Prometheus

```typescript
// Métricas Prometheus para o Nexora
// Expõe endpoint /metrics para scraping

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import Fastify from 'fastify';

// Registry dedicado para métricas Nexora
export const nexoraRegistry = new Registry();

// Recolher métricas padrão do Node.js (CPU, memória, etc.)
collectDefaultMetrics({ register: nexoraRegistry, prefix: 'nexora_node_' });

// ── Contadores ────────────────────────────────────────
export const assetsIngested = new Counter({
  name: 'nexora_assets_ingested_total',
  help: 'Total de assets recebidos pelo sistema',
  registers: [nexoraRegistry]
});

export const assetsRejected = new Counter({
  name: 'nexora_assets_rejected_total',
  help: 'Total de assets rejeitados no QC',
  labelNames: ['reason'] as const,
  registers: [nexoraRegistry]
});

export const ffmpegTimeouts = new Counter({
  name: 'nexora_ffmpeg_timeout_total',
  help: 'Total de timeouts do FFmpeg',
  registers: [nexoraRegistry]
});

// ── Histogramas ───────────────────────────────────────
export const transcodeDuration = new Histogram({
  name: 'nexora_transcode_duration_seconds',
  help: 'Duração do transcode em segundos',
  labelNames: ['profile'] as const,
  buckets: [30, 120, 600, 1800, 3600, 14400],
  registers: [nexoraRegistry]
});

export const vmafScore = new Histogram({
  name: 'nexora_vmaf_score',
  help: 'Distribuição dos scores VMAF',
  labelNames: ['profile'] as const,
  buckets: [60, 70, 75, 80, 85, 90, 93, 95, 98, 100],
  registers: [nexoraRegistry]
});

export const loudnessLufs = new Histogram({
  name: 'nexora_loudness_lufs',
  help: 'Distribuição de LUFS integrado',
  buckets: [-30, -25, -23, -20, -16, -14, -10],
  registers: [nexoraRegistry]
});

export const uploadDuration = new Histogram({
  name: 'nexora_upload_duration_seconds',
  help: 'Duração de uploads para storage',
  labelNames: ['destination'] as const,
  buckets: [1, 5, 15, 30, 60, 120, 300],
  registers: [nexoraRegistry]
});

// ── Gauges ────────────────────────────────────────────
export const queueDepth = new Gauge({
  name: 'nexora_queue_depth',
  help: 'Número de jobs na fila por tipo de worker',
  labelNames: ['worker_type'] as const,
  registers: [nexoraRegistry]
});

export const jobSuccessRate = new Gauge({
  name: 'nexora_job_success_rate',
  help: 'Taxa de sucesso de jobs nos últimos 5 minutos',
  registers: [nexoraRegistry]
});

// ── Servidor de métricas (porta separada) ────────────
export const metricsServer = {
  async start(port: number): Promise<void> {
    const app = Fastify({ logger: false });

    app.get('/metrics', async (_, reply) => {
      reply.header('Content-Type', nexoraRegistry.contentType);
      return nexoraRegistry.metrics();
    });

    app.get('/health', async () => ({ status: 'ok' }));

    await app.listen({ port, host: '0.0.0.0' });
  }
};
```

---

## prisma/seed.ts — Dados de teste

```typescript
// Seed da base de dados com dados iniciais de teste

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('A criar dados de teste...');

  // Criar um asset de exemplo no estado READY
  const asset = await prisma.asset.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      originalName: 'nexora_demo_broadcast.mp4',
      sha256Input: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      sha256Output: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
      status: 'READY',
      profile: 'nexora_broadcast_hd',
      durationMs: 3600000,
      frameRate: 25.0,
      resolution: '1920x1080',
      vmafScore: 93.4,
      loudnessLufs: -23.1,
      truePeakDbtp: -1.2,
      deliveryUrl: 's3://nexora-output/demo/nexora_demo_broadcast.mp4'
    }
  });

  console.log(`✓ Asset de demo criado: ${asset.id}`);

  // Criar audit log inicial
  await prisma.auditLog.create({
    data: {
      assetId: asset.id,
      eventType: 'seed_created',
      operator: 'system_seed',
      payload: { message: 'Asset criado pelo seed de desenvolvimento' },
      entryHash: 'seed_hash_initial'
    }
  });

  console.log('✓ Seed concluído');
}

main()
  .catch(e => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## tsconfig.build.json — Build de produção

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false,
    "noEmitOnError": true
  },
  "include": ["src/**/*"],
  "exclude": [
    "node_modules",
    "dist",
    "tests",
    "**/*.test.ts",
    "**/*.spec.ts"
  ]
}
```

---

## .env.test — Variáveis para testes

```bash
# Variáveis de ambiente para testes automáticos
# Este ficheiro pode ser commitado (não tem secrets reais)

NODE_ENV=test
LOG_LEVEL=error

DATABASE_URL=postgresql://nexora:nexora_test@localhost:5432/nexora_test
REDIS_URL=redis://localhost:6379/1

MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=nexoraadmin
MINIO_SECRET_KEY=nexoraadmin
MINIO_BUCKET_INPUT=nexora-test-input
MINIO_BUCKET_OUTPUT=nexora-test-output
MINIO_BUCKET_TEMP=nexora-test-temp

NEXORA_INPUT_DIR=./tests/fixtures
NEXORA_OUTPUT_DIR=./tests/output
NEXORA_TEMP_DIR=./tests/temp

FFMPEG_DEFAULT_TIMEOUT_MS=120000
MAX_CONCURRENT_TRANSCODE_JOBS=1

LOUDNESS_TARGET_BROADCAST_LUFS=-23
LOUDNESS_TRUE_PEAK_LIMIT_DBTP=-1.0
VMAF_THRESHOLD_BROADCAST=90
```
