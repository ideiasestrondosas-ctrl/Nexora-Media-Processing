#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Nexora Media Processing — Script de Scaffold
// Guardar em: C:\Dev\Nexora Media Processing\arquitetura\nexora-scaffold.js
// ═══════════════════════════════════════════════════════════════
// O que faz:
//   1. Cria toda a estrutura de pastas do projecto
//   2. Cria ficheiros base com conteúdo inicial
//   3. Cria .env.example com todas as variáveis
//   4. Cria docker-compose.yml base
//   5. Cria package.json com todos os scripts
//   6. Cria PROGRESS.md inicial
//   7. Cria .gitignore
//
// Como executar (na pasta C:\Dev\Nexora Media Processing):
//   node arquitetura\nexora-scaffold.js
// ═══════════════════════════════════════════════════════════════

const fs   = require('fs');
const path = require('path');

const c = {
  reset:  '\x1b[0m', green:  '\x1b[32m',
  blue:   '\x1b[34m', yellow: '\x1b[33m', red: '\x1b[31m'
};
const log  = m => console.log(`${c.blue}[NEXORA]${c.reset} ${m}`);
const ok   = m => console.log(`${c.green}  ✓${c.reset} ${m}`);
const warn = m => console.log(`${c.yellow}  !${c.reset} ${m}`);

const ROOT = process.cwd();

function ensureDir(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) { fs.mkdirSync(full, { recursive: true }); ok(`Dir: ${rel}`); }
}

function write(rel, content, overwrite = false) {
  const full = path.join(ROOT, rel);
  ensureDir(path.dirname(rel));
  if (fs.existsSync(full) && !overwrite) { warn(`Já existe: ${rel}`); return; }
  fs.writeFileSync(full, content.trimStart(), 'utf8');
  ok(`Ficheiro: ${rel}`);
}

console.log('');
console.log('╔══════════════════════════════════════╗');
console.log('║  Nexora Media Processing — Scaffold ║');
console.log('╚══════════════════════════════════════╝');
console.log('');

// ── Estrutura de pastas ────────────────────────────────────────
log('A criar estrutura de pastas...');
const dirs = [
  'src/api/routes', 'src/api/middleware',
  'src/workers', 'src/pipeline/ffmpeg', 'src/pipeline/tools',
  'src/qc/rules', 'src/models', 'src/events', 'src/observability', 'src/db',
  'frontend/src/app/(dashboard)/assets', 'frontend/src/app/(dashboard)/queue',
  'frontend/src/app/api', 'frontend/src/components/ui',
  'frontend/src/components/assets', 'frontend/src/components/dashboard',
  'frontend/src/components/layout', 'frontend/src/hooks', 'frontend/src/store',
  'frontend/src/lib',
  'tests/unit', 'tests/integration', 'tests/e2e', 'tests/fixtures',
  'tests/performance/results', 'tests/output', 'tests/temp',
  'config/grafana/provisioning/datasources',
  'config/grafana/provisioning/dashboards',
  'config/prometheus', 'config/alertmanager',
  'docs/adr', 'scripts',
  '.github/workflows', '.antigravity',
  'logs', 'media/input', 'media/output', 'media/temp',
  'secrets', 'prisma/migrations',
];
dirs.forEach(ensureDir);

// ── package.json ──────────────────────────────────────────────
write('package.json', JSON.stringify({
  name: "nexora-media-processing",
  version: "0.1.0",
  description: "Plataforma profissional de processamento de media broadcast & OTT",
  main: "dist/index.js",
  scripts: {
    "dev":            "tsx watch src/index.ts",
    "build":          "tsc --noEmit && tsc -p tsconfig.build.json",
    "start":          "node dist/index.js",
    "worker":         "tsx src/worker.ts",
    "test":           "vitest run",
    "test:watch":     "vitest",
    "test:coverage":  "vitest run --coverage",
    "test:e2e":       "playwright test",
    "lint":           "eslint src --ext .ts",
    "lint:fix":       "eslint src --ext .ts --fix",
    "format":         "prettier --write \"src/**/*.ts\"",
    "db:migrate":     "prisma migrate deploy",
    "db:migrate:dev": "prisma migrate dev",
    "db:seed":        "tsx prisma/seed.ts",
    "db:studio":      "prisma studio",
    "db:generate":    "prisma generate",
    "queue:flush":    "tsx scripts/flush-queues.ts",
    "fixtures:generate": "bash tests/fixtures/generate-fixtures.sh",
    "keys:generate":  "npx tsx scripts/nexora-generate-keys.ts",
    "setup":          "node arquitetura/nexora-scaffold.js"
  },
  dependencies: {
    "@temporalio/client":   "^1.9.0",
    "@temporalio/worker":   "^1.9.0",
    "@temporalio/workflow":  "^1.9.0",
    "@temporalio/activity":  "^1.9.0",
    "fastify":              "^4.26.0",
    "@fastify/cors":        "^9.0.0",
    "@fastify/jwt":         "^8.0.0",
    "@fastify/multipart":   "^8.3.0",
    "@fastify/rate-limit":  "^9.1.0",
    "@fastify/swagger":     "^8.14.0",
    "bullmq":               "^5.7.0",
    "ioredis":              "^5.3.0",
    "@prisma/client":       "^5.11.0",
    "minio":                "^8.0.0",
    "pino":                 "^9.1.0",
    "pino-pretty":          "^11.0.0",
    "prom-client":          "^15.1.0",
    "zod":                  "^3.22.0",
    "uuid":                 "^9.0.0",
    "jose":                 "^5.2.0"
  },
  devDependencies: {
    "typescript":                          "^5.4.0",
    "tsx":                                 "^4.7.0",
    "@types/node":                         "^20.11.0",
    "vitest":                              "^1.4.0",
    "@vitest/coverage-v8":                 "^1.4.0",
    "prisma":                              "^5.11.0",
    "eslint":                              "^8.57.0",
    "@typescript-eslint/parser":           "^7.4.0",
    "@typescript-eslint/eslint-plugin":    "^7.4.0",
    "prettier":                            "^3.2.0",
    "@playwright/test":                    "^1.44.0",
    "@testcontainers/postgresql":          "^10.7.0",
    "@testcontainers/redis":               "^10.7.0"
  }
}, null, 2));

// ── tsconfig.json ─────────────────────────────────────────────
write('tsconfig.json', JSON.stringify({
  compilerOptions: {
    target: "ES2022", module: "commonjs",
    lib: ["ES2022"], outDir: "./dist", rootDir: "./src",
    strict: true, esModuleInterop: true, skipLibCheck: true,
    forceConsistentCasingInFileNames: true, resolveJsonModule: true,
    declaration: true, declarationMap: true, sourceMap: true,
    paths: {
      "@/*":          ["./src/*"],
      "@workers/*":   ["./src/workers/*"],
      "@qc/*":        ["./src/qc/*"],
      "@pipeline/*":  ["./src/pipeline/*"]
    }
  },
  include: ["src/**/*"],
  exclude: ["node_modules", "dist", "tests", "frontend"]
}, null, 2));

// ── tsconfig.build.json ───────────────────────────────────────
write('tsconfig.build.json', JSON.stringify({
  extends: "./tsconfig.json",
  compilerOptions: { outDir: "./dist", rootDir: "./src", noEmitOnError: true },
  include: ["src/**/*"],
  exclude: ["node_modules","dist","tests","**/*.test.ts"]
}, null, 2));

// ── .gitignore ────────────────────────────────────────────────
write('.gitignore', `
node_modules/
dist/
build/
.next/
.env
.env.local
.env.*.local
!.env.example
logs/*.log
*.log
media/input/*
media/output/*
media/temp/*
!media/input/.gitkeep
!media/output/.gitkeep
!media/temp/.gitkeep
secrets/
*.db
*.db-shm
*.db-wal
.DS_Store
Thumbs.db
.vscode/settings.json
coverage/
tests/output/*
tests/temp/*
!tests/output/.gitkeep
!tests/temp/.gitkeep
`);

// ── .env.example ─────────────────────────────────────────────
write('.env.example', `
# ═══════════════════════════════════════════
# Nexora Media Processing — Variáveis de Ambiente
# cp .env.example .env  →  editar passwords
# ═══════════════════════════════════════════

# Base de dados
DATABASE_URL=postgresql://nexora:nexora_password@localhost:5432/nexora_media
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Redis
REDIS_URL=redis://localhost:6379
BULLMQ_PREFIX=nexora
QUEUE_DEFAULT_ATTEMPTS=3

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=nexoraadmin
MINIO_SECRET_KEY=nexora_minio_secret
MINIO_BUCKET_INPUT=nexora-input
MINIO_BUCKET_OUTPUT=nexora-output
MINIO_BUCKET_TEMP=nexora-temp

# Temporal.io
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=nexora-production
TEMPORAL_TASK_QUEUE=nexora-media-tasks

# Auth JWT
JWT_PRIVATE_KEY_PATH=./secrets/jwt_private.pem
JWT_PUBLIC_KEY_PATH=./secrets/jwt_public.pem
JWT_ALGORITHM=RS256
JWT_ACCESS_TOKEN_EXPIRY=1h

# Media tools
NEXORA_INPUT_DIR=./media/input
NEXORA_OUTPUT_DIR=./media/output
NEXORA_TEMP_DIR=./media/temp
FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe
MEDIAINFO_PATH=mediainfo
MEDIACONCH_PATH=mediaconch
BS1770GAIN_PATH=bs1770gain
HANDBRAKE_CLI_PATH=HandBrakeCLI
HANDBRAKE_PRESETS_FILE=./nexora-presets.json

# Limites
MAX_CONCURRENT_TRANSCODE_JOBS=4
FFMPEG_DEFAULT_TIMEOUT_MS=14400000
MAX_UPLOAD_SIZE_BYTES=53687091200

# Loudness
LOUDNESS_TARGET_BROADCAST_LUFS=-23
LOUDNESS_TARGET_STREAMING_LUFS=-14
LOUDNESS_TRUE_PEAK_LIMIT_DBTP=-1.0
LOUDNESS_TOLERANCE_LU=0.5

# VMAF
VMAF_THRESHOLD_ARCHIVE=93
VMAF_THRESHOLD_BROADCAST=90
VMAF_THRESHOLD_STREAMING=85
VMAF_THRESHOLD_PROXY=70

# Observabilidade
LOG_LEVEL=info
PROMETHEUS_PORT=9100

# API
PORT=3000
NODE_ENV=development
API_VERSION=v1
RATE_LIMIT_USER_RPM=1000
RATE_LIMIT_API_RPM=5000

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3000
`);

// ── docker-compose.yml ────────────────────────────────────────
write('docker-compose.yml', `version: "3.9"

services:
  nexora-api:
    build: .
    image: nexora/api:latest
    ports: ["3000:3000"]
    env_file: .env
    environment:
      DATABASE_URL: postgresql://nexora:\${DB_PASSWORD:-nexora_password}@postgres:5432/nexora_media
      REDIS_URL: redis://redis:6379
      MINIO_ENDPOINT: minio
      TEMPORAL_ADDRESS: temporal:7233
    volumes:
      - nexora_input:/media/input
      - nexora_output:/media/output
      - nexora_temp:/media/temp
    depends_on: [postgres, redis, minio, temporal]
    restart: unless-stopped

  nexora-worker:
    build: { context: ., dockerfile: Dockerfile.worker }
    image: nexora/worker:latest
    env_file: .env
    environment:
      DATABASE_URL: postgresql://nexora:\${DB_PASSWORD:-nexora_password}@postgres:5432/nexora_media
      REDIS_URL: redis://redis:6379
    volumes:
      - nexora_input:/media/input
      - nexora_output:/media/output
      - nexora_temp:/media/temp
    depends_on: [postgres, redis]
    restart: unless-stopped
    deploy:
      resources:
        limits: { cpus: "4", memory: "8G" }

  temporal:
    image: temporalio/auto-setup:1.23
    ports: ["7233:7233"]
    environment:
      DB: postgresql
      POSTGRES_USER: nexora
      POSTGRES_PWD: \${DB_PASSWORD:-nexora_password}
      POSTGRES_SEEDS: postgres
    depends_on: [postgres]

  temporal-ui:
    image: temporalio/ui:2.26
    ports: ["8080:8080"]
    environment:
      TEMPORAL_ADDRESS: temporal:7233

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: nexora
      POSTGRES_PASSWORD: \${DB_PASSWORD:-nexora_password}
      POSTGRES_DB: nexora_media
    volumes: [postgres_data:/var/lib/postgresql/data]
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    command: redis-server --save 60 1 --loglevel warning
    volumes: [redis_data:/data]
    ports: ["6379:6379"]

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    ports: ["9000:9000", "9001:9001"]
    environment:
      MINIO_ROOT_USER: nexoraadmin
      MINIO_ROOT_PASSWORD: \${MINIO_PASSWORD:-nexora_minio_secret}
    volumes: [minio_data:/data]

  prometheus:
    image: prom/prometheus:latest
    ports: ["9090:9090"]
    volumes:
      - ./config/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus

  grafana:
    image: grafana/grafana:latest
    ports: ["3001:3000"]
    environment:
      GF_SECURITY_ADMIN_PASSWORD: \${GRAFANA_PASSWORD:-nexora}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./config/grafana/provisioning:/etc/grafana/provisioning

  loki:
    image: grafana/loki:latest
    ports: ["3100:3100"]

volumes:
  postgres_data: redis_data: minio_data:
  nexora_input: nexora_output: nexora_temp:
  prometheus_data: grafana_data:
`);

// ── Placeholders .gitkeep ─────────────────────────────────────
['media/input','media/output','media/temp','logs',
 'secrets','tests/output','tests/temp'].forEach(d => {
  write(`${d}/.gitkeep`, '');
});

// ── src/index.ts base ─────────────────────────────────────────
write('src/index.ts', `import Fastify from 'fastify';
const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
app.get('/health',       async () => ({ status: 'ok', version: '0.1.0', timestamp: new Date().toISOString() }));
app.get('/health/live',  async () => ({ status: 'ok' }));
app.get('/health/ready', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
// TODO: registerPlugins e registerRoutes após Prompt 1 (Claude)
const start = async () => {
  try {
    await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
    app.log.info('Nexora iniciado');
  } catch (err) { app.log.error(err); process.exit(1); }
};
void start();
`);

// ── src/worker.ts base ────────────────────────────────────────
write('src/worker.ts', `// Nexora Workers — aguarda Prompt 1 (Claude) para implementação completa
import { createClient } from 'ioredis';
const redis = createClient(process.env.REDIS_URL ?? 'redis://localhost:6379');
redis.on('connect', () => console.log('[Nexora Worker] Redis conectado'));
redis.on('error', (err) => console.error('[Nexora Worker] Redis erro:', err));
process.on('SIGTERM', () => { redis.disconnect(); process.exit(0); });
process.on('SIGINT',  () => { redis.disconnect(); process.exit(0); });
`);

// ── prisma/schema.prisma base ─────────────────────────────────
write('prisma/schema.prisma', `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Schema completo adicionado pelo Prompt 1 (Claude)
// Ver arquivo nexora_prisma_schema_full.ts na pasta arquitetura
`);

// ── tests/setup.ts ────────────────────────────────────────────
write('tests/setup.ts', `import { beforeAll, afterAll } from 'vitest';
beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
});
afterAll(async () => {});
`);

// ── .env.test ─────────────────────────────────────────────────
write('.env.test', `NODE_ENV=test
LOG_LEVEL=error
DATABASE_URL=postgresql://nexora:nexora_test@localhost:5432/nexora_test
REDIS_URL=redis://localhost:6379/1
NEXORA_INPUT_DIR=./tests/fixtures
NEXORA_OUTPUT_DIR=./tests/output
NEXORA_TEMP_DIR=./tests/temp
FFMPEG_DEFAULT_TIMEOUT_MS=120000
MAX_CONCURRENT_TRANSCODE_JOBS=1
LOUDNESS_TARGET_BROADCAST_LUFS=-23
LOUDNESS_TRUE_PEAK_LIMIT_DBTP=-1.0
VMAF_THRESHOLD_BROADCAST=90
`);

// ── .vscode/settings.json ─────────────────────────────────────
write('.vscode/settings.json', JSON.stringify({
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.tabSize": 2,
  "editor.rulers": [100],
  "typescript.tsdk": "node_modules/typescript/lib",
  "files.exclude": { "**/node_modules": true, "**/dist": true, "**/.next": true }
}, null, 2));

write('.vscode/extensions.json', JSON.stringify({
  "recommendations": [
    "dbaeumer.vscode-eslint", "esbenp.prettier-vscode", "prisma.prisma",
    "ms-azuretools.vscode-docker", "eamodio.gitlens",
    "rangav.vscode-thunder-client", "bradlc.vscode-tailwindcss"
  ]
}, null, 2));

// ── tests/fixtures/generate-fixtures.sh ──────────────────────
write('tests/fixtures/generate-fixtures.sh', `#!/bin/bash
# Gerar ficheiros de vídeo para testes usando FFmpeg (sem copyright)
FIXTURES_DIR="$(dirname "$0")"
echo "A gerar fixtures de teste..."

ffmpeg -y -f lavfi -i "testsrc2=duration=30:size=1920x1080:rate=25" \\
  -f lavfi -i "sine=frequency=1000:duration=30:sample_rate=48000" \\
  -c:v libx264 -profile:v high -level:v 4.1 -pix_fmt yuv420p \\
  -g 50 -keyint_min 50 -sc_threshold 0 -flags +cgop -bf 0 \\
  -b:v 8000k -maxrate 8000k -bufsize 16000k -c:a pcm_s24le -ar 48000 \\
  -movflags +faststart "$FIXTURES_DIR/nexora_reference_broadcast.mp4"

ffmpeg -y -f lavfi -i "testsrc2=duration=10:size=1920x1080:rate=25" \\
  -c:v libx264 -g 50 -x264-params "open-gop=1:bframes=3" \\
  "$FIXTURES_DIR/nexora_problem_open_gop.mp4"

ffmpeg -y -f lavfi -i "testsrc2=duration=10:size=1920x1080:rate=25" \\
  -c:v libx264 -vsync vfr "$FIXTURES_DIR/nexora_problem_vfr.mp4"

ffmpeg -y -f lavfi -i "testsrc2=duration=10:size=1920x1080:rate=25" \\
  -f lavfi -i "sine=frequency=440:duration=10" -af "volume=10dB" \\
  "$FIXTURES_DIR/nexora_problem_loud.mp4"

head -c 1000000 "$FIXTURES_DIR/nexora_reference_broadcast.mp4" \\
  > "$FIXTURES_DIR/nexora_problem_corrupt.mp4"

echo "✓ Fixtures geradas em $FIXTURES_DIR/"
`);

// ── README.md ─────────────────────────────────────────────────
write('README.md', `# Nexora Media Processing

> Plataforma profissional de processamento de media broadcast & OTT — Stack 100% Open Source

## Setup rápido

\`\`\`bash
# 1. Instalar ferramentas (Windows PowerShell como Admin)
.\\\\arquitetura\\\\nexora-setup.ps1

# 2. Scaffold do projecto
node arquitetura\\\\nexora-scaffold.js

# 3. Deploy de docs e configuração
node arquitetura\\\\nexora-deploy-docs.js

# 4. Finalização
node arquitetura\\\\nexora-finalize.js

# 5. Configurar ambiente
copy .env.example .env
# Editar .env

# 6. Instalar dependências
npm install

# 7. Iniciar serviços
docker compose up -d

# 8. Migrações
npm run db:migrate && npm run db:seed
\`\`\`

## Interfaces

| Interface    | URL                        | Login                        |
|--------------|----------------------------|------------------------------|
| App          | http://localhost:3000      | —                            |
| Temporal UI  | http://localhost:8080      | —                            |
| Grafana      | http://localhost:3001      | admin/nexora                 |
| MinIO        | http://localhost:9001      | nexoraadmin/nexora_minio_secret |

## Documentação

- [Manual completo](arquitetura/nexora_master_doc_part1.md)
- [Estado do projecto](PROGRESS.md)
- [Decisões de arquitectura](docs/adr/)

## Licença: MIT
`, true);

console.log('');
console.log('╔══════════════════════════════════════════╗');
console.log('║  ✓ Scaffold concluído!                  ║');
console.log('╠══════════════════════════════════════════╣');
console.log('║  Próximo passo:                         ║');
console.log('║  node arquitetura\\nexora-deploy-docs.js ║');
console.log('╚══════════════════════════════════════════╝');
console.log('');
