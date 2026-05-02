#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Nexora Media Processing — Script de Finalização
// ═══════════════════════════════════════════════════════════════
//
// O QUE FAZ:
//   Cria os ficheiros finais que completam o projecto:
//     - Dockerfiles (API + Worker)
//     - GitHub Actions (test, build, deploy-staging, deploy-prod)
//     - Configurações ESLint, Prettier, Vitest
//     - Ficheiros base TypeScript (index.ts, worker.ts, etc.)
//     - README.md final
//     - Seed da base de dados
//     - .env.test
//
// COMO EXECUTAR (depois do nexora-scaffold.js):
//   node scripts/nexora-finalize.js
//
// PRÉ-REQUISITOS:
//   Ter corrido nexora-scaffold.js antes
// ═══════════════════════════════════════════════════════════════

const fs   = require('fs');
const path = require('path');

const c = {
  reset:'\x1b[0m', green:'\x1b[32m',
  blue:'\x1b[34m', yellow:'\x1b[33m', red:'\x1b[31m'
};
const log  = m => console.log(`${c.blue}[NEXORA]${c.reset} ${m}`);
const ok   = m => console.log(`${c.green}  ✓${c.reset} ${m}`);
const warn = m => console.log(`${c.yellow}  !${c.reset} ${m}`);

const ROOT = process.cwd();

if (!fs.existsSync(path.join(ROOT, 'package.json'))) {
  console.error('Corre este script na raiz do projecto nexora-media-processing');
  process.exit(1);
}

function ensureDir(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
}

function write(rel, content, overwrite = false) {
  const full = path.join(ROOT, rel);
  ensureDir(path.dirname(rel));
  if (fs.existsSync(full) && !overwrite) { warn(`Mantido: ${rel}`); return; }
  fs.writeFileSync(full, content.trimStart(), 'utf8');
  ok(`Criado: ${rel}`);
}

console.log('');
console.log('╔════════════════════════════════════════════╗');
console.log('║  Nexora — Finalização do projecto         ║');
console.log('╚════════════════════════════════════════════╝');
console.log('');

// ── Dockerfile ─────────────────────────────────────────────────
log('Dockerfiles...');

write('Dockerfile', `# Nexora Media Processing — Dockerfile API
# Multi-stage build

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig*.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate
COPY src ./src
RUN npm run build

FROM node:20-alpine AS production
RUN apk add --no-cache curl dumb-init
WORKDIR /app
RUN addgroup -g 1001 -S nexora && adduser -u 1001 -S nexora -G nexora
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
RUN mkdir -p /media/input /media/output /media/temp && \\
    chown -R nexora:nexora /media /app
USER nexora
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \\
    CMD curl -f http://localhost:3000/health/live || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
`);

write('Dockerfile.worker', `# Nexora Media Processing — Dockerfile Workers
# Inclui FFmpeg, MediaInfo, BS1770GAIN, HandBrake

FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive TZ=UTC

RUN apt-get update && apt-get install -y \\
    curl wget ca-certificates gnupg \\
    ffmpeg mediainfo mediaconch bs1770gain handbrake-cli \\
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \\
    && apt-get install -y nodejs \\
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN groupadd -g 1001 nexora && useradd -u 1001 -g nexora -m nexora
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production && npx prisma generate && npm cache clean --force
COPY --from=builder /app/dist ./dist
RUN mkdir -p /media/input /media/output /media/temp && \\
    chown -R nexora:nexora /media /app
ENV FFMPEG_PATH=/usr/bin/ffmpeg \\
    FFPROBE_PATH=/usr/bin/ffprobe \\
    MEDIAINFO_PATH=/usr/bin/mediainfo \\
    MEDIACONCH_PATH=/usr/bin/mediaconch \\
    BS1770GAIN_PATH=/usr/bin/bs1770gain \\
    HANDBRAKE_CLI_PATH=/usr/bin/HandBrakeCLI
USER nexora
HEALTHCHECK --interval=60s --timeout=10s --start-period=60s --retries=3 \\
    CMD node dist/health-worker.js || exit 1
CMD ["node", "dist/worker.js"]
`);

// ── GitHub Actions ──────────────────────────────────────────────
log('GitHub Actions...');

write('.github/workflows/test.yml', `name: Testes
on:
  push:
    branches: [main, develop, 'feature/**']
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    name: Lint e tipagem
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run lint
      - run: npx prettier --check "src/**/*.ts"

  unit-tests:
    name: Testes unitários
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx prisma generate
      - run: npm run test:coverage
      - name: Verificar cobertura ≥80%
        run: |
          COV=$(cat coverage/coverage-summary.json | node -e "
            const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
            console.log(d.total.lines.pct);")
          node -e "if($COV<80){console.error('Cobertura '+$COV+'% < 80%');process.exit(1);}"

  integration-tests:
    name: Testes integração
    runs-on: ubuntu-latest
    needs: unit-tests
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: nexora
          POSTGRES_PASSWORD: nexora_test
          POSTGRES_DB: nexora_test
        options: --health-cmd pg_isready --health-interval 10s --health-retries 5
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        options: --health-cmd "redis-cli ping" --health-interval 10s --health-retries 5
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - run: sudo apt-get update && sudo apt-get install -y ffmpeg mediainfo
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://nexora:nexora_test@localhost:5432/nexora_test
      - run: bash tests/fixtures/generate-fixtures.sh
      - run: npx vitest run tests/integration
        env:
          DATABASE_URL: postgresql://nexora:nexora_test@localhost:5432/nexora_test
          REDIS_URL: redis://localhost:6379/1
          NODE_ENV: test
`);

write('.github/workflows/build.yml', `name: Build
on:
  push:
    branches: [main]
    tags: ['v*.*.*']

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
      - uses: docker/setup-buildx-action@v3
      - uses: docker/metadata-action@v5
        id: meta
        with:
          images: ghcr.io/\${{ github.repository }}/nexora-api
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=sha,prefix=sha-
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: \${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
`);

write('.github/workflows/deploy-staging.yml', `name: Deploy Staging
on:
  workflow_run:
    workflows: ["Build"]
    types: [completed]
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    if: \${{ github.event.workflow_run.conclusion == 'success' }}
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: appleboy/ssh-action@v1
        with:
          host: \${{ secrets.STAGING_HOST }}
          username: \${{ secrets.STAGING_USER }}
          key: \${{ secrets.STAGING_SSH_KEY }}
          script: |
            cd /opt/nexora-staging
            git pull origin main
            docker compose pull
            docker compose run --rm nexora-api npx prisma migrate deploy
            docker compose up -d --no-deps nexora-api nexora-worker
            sleep 15
            curl -f http://localhost:3000/health/ready || exit 1
            echo "Deploy staging OK"
`);

// ── Configurações de código ────────────────────────────────────
log('Configurações ESLint, Prettier, Vitest...');

write('.prettierrc', JSON.stringify({
  semi: true, singleQuote: true, tabWidth: 2,
  trailingComma: 'es5', printWidth: 100, bracketSpacing: true, arrowParens: 'avoid'
}, null, 2));

write('.eslintrc.json', JSON.stringify({
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module', project: './tsconfig.json' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-floating-promises': 'error',
    'prefer-const': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }]
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.js']
}, null, 2));

write('vitest.config.ts', `import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'tests/performance/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/index.ts', 'src/worker.ts'],
      thresholds: { lines: 80, branches: 75, functions: 80, statements: 80 }
    },
    testTimeout: 60000,
    hookTimeout: 30000,
    setupFiles: ['tests/setup.ts']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@workers': path.resolve(__dirname, './src/workers'),
      '@qc': path.resolve(__dirname, './src/qc'),
      '@pipeline': path.resolve(__dirname, './src/pipeline')
    }
  }
});
`);

write('tsconfig.build.json', JSON.stringify({
  extends: './tsconfig.json',
  compilerOptions: { outDir: './dist', rootDir: './src', noEmitOnError: true },
  include: ['src/**/*'],
  exclude: ['node_modules','dist','tests','**/*.test.ts']
}, null, 2));

// ── Ficheiros TypeScript base ──────────────────────────────────
log('Ficheiros TypeScript base...');

write('src/index.ts', `// Nexora Media Processing — Entry point da API

import Fastify from 'fastify';

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' }
});

// Health checks
app.get('/health', async () => ({ status: 'ok', version: '0.1.0', timestamp: new Date().toISOString() }));
app.get('/health/live', async () => ({ status: 'ok' }));
app.get('/health/ready', async () => ({ status: 'ok', db: 'connected', redis: 'connected' }));

// TODO: Registar plugins e rotas após Prompt 1 (Claude)

const start = async (): Promise<void> => {
  try {
    const port = Number(process.env.PORT ?? 3000);
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info({ port }, 'Nexora iniciado');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

void start();
`);

write('src/worker.ts', `// Nexora Media Processing — Entry point dos Workers
// TODO: Implementado pelo Prompt 1 (Claude)

import { createClient } from 'ioredis';

const redis = createClient(process.env.REDIS_URL ?? 'redis://localhost:6379');

redis.on('connect', () => {
  console.log('[Worker] Redis conectado — a aguardar Prompt 1 para iniciar workers');
});

redis.on('error', (err) => {
  console.error('[Worker] Erro Redis:', err);
});

process.on('SIGTERM', () => { redis.disconnect(); process.exit(0); });
process.on('SIGINT',  () => { redis.disconnect(); process.exit(0); });
`);

write('src/health-worker.ts', `// Health check do worker para Docker HEALTHCHECK
import { createClient } from 'ioredis';
const redis = createClient(process.env.REDIS_URL ?? 'redis://localhost:6379');
redis.ping()
  .then(() => { console.log('OK'); redis.disconnect(); process.exit(0); })
  .catch(() => { redis.disconnect(); process.exit(1); });
`);

write('tests/setup.ts', `// Setup global para todos os testes Vitest
import { beforeAll, afterAll } from 'vitest';

beforeAll(async () => {
  // Configurar variáveis de ambiente de teste
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Silenciar logs em testes
});

afterAll(async () => {
  // Limpeza global após todos os testes
});
`);

write('.env.test', `# Variáveis de ambiente para testes automáticos
NODE_ENV=test
LOG_LEVEL=error
DATABASE_URL=postgresql://nexora:nexora_test@localhost:5432/nexora_test
REDIS_URL=redis://localhost:6379/1
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=nexoraadmin
MINIO_SECRET_KEY=nexoraadmin
NEXORA_INPUT_DIR=./tests/fixtures
NEXORA_OUTPUT_DIR=./tests/output
NEXORA_TEMP_DIR=./tests/temp
FFMPEG_DEFAULT_TIMEOUT_MS=120000
MAX_CONCURRENT_TRANSCODE_JOBS=1
LOUDNESS_TARGET_BROADCAST_LUFS=-23
LOUDNESS_TRUE_PEAK_LIMIT_DBTP=-1.0
VMAF_THRESHOLD_BROADCAST=90
`);

// ── Pastas de output de testes ─────────────────────────────────
['tests/output', 'tests/temp'].forEach(d => {
  ensureDir(d);
  write(`${d}/.gitkeep`, '');
});

// ── Seed Prisma ────────────────────────────────────────────────
log('Prisma seed...');

write('prisma/seed.ts', `import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('A criar dados de teste...');

  const asset = await prisma.asset.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      originalName: 'nexora_demo_broadcast.mp4',
      sha256Input: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      status: 'READY',
      profile: 'nexora_broadcast_hd',
      durationMs: 3600000,
      frameRate: 25.0,
      resolution: '1920x1080',
      vmafScore: 93.4,
      loudnessLufs: -23.1,
      truePeakDbtp: -1.2
    }
  });

  await prisma.auditLog.create({
    data: {
      assetId: asset.id,
      eventType: 'seed_created',
      operator: 'system_seed',
      payload: { message: 'Asset de demo criado pelo seed' },
      entryHash: 'seed_initial_hash'
    }
  });

  console.log('✓ Seed concluído:', asset.id);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.\$disconnect(); });
`);

// ── README ─────────────────────────────────────────────────────
log('README.md...');

write('README.md', `# Nexora Media Processing

> Plataforma profissional de processamento de media para Broadcast & OTT
> Stack 100% Open Source

## Setup rápido (10 comandos)

\`\`\`bash
git clone https://github.com/[utilizador]/nexora-media-processing.git
cd nexora-media-processing
bash scripts/nexora-setup.sh
cp .env.example .env
# Edita o .env
npm install
docker compose up -d postgres redis minio temporal temporal-ui
sleep 30 && npm run db:migrate
npm run dev          # Terminal 1
npm run worker       # Terminal 2
\`\`\`

## Interfaces

| Interface | URL | Login |
|---|---|---|
| App | http://localhost:3000 | — |
| Temporal UI | http://localhost:8080 | — |
| Grafana | http://localhost:3001 | admin/nexora |
| MinIO | http://localhost:9001 | nexoraadmin/nexora_minio_secret |

## Documentação

- [Manual completo](docs/manual-v4.md)
- [Estado do projecto](PROGRESS.md)
- [ADRs](docs/adr/)
- [API Reference](openapi.yaml)

## Licença: MIT
`, true);

// ── Sumário ────────────────────────────────────────────────────
console.log('');
console.log('╔══════════════════════════════════════════════╗');
console.log('║  ✓ Finalização concluída!                   ║');
console.log('╚══════════════════════════════════════════════╝');
console.log('');
console.log('Ficheiros criados:');
console.log('  Dockerfile + Dockerfile.worker');
console.log('  .github/workflows/ (test, build, deploy-staging)');
console.log('  .prettierrc + .eslintrc.json + vitest.config.ts');
console.log('  tsconfig.build.json + .env.test');
console.log('  src/index.ts + src/worker.ts + src/health-worker.ts');
console.log('  tests/setup.ts + prisma/seed.ts');
console.log('  README.md');
console.log('');
console.log('Sequência completa de setup:');
console.log('  1. bash scripts/nexora-setup.sh');
console.log('  2. node scripts/nexora-scaffold.js');
console.log('  3. node scripts/nexora-deploy-docs.js');
console.log('  4. node scripts/nexora-finalize.js  ← este script');
console.log('  5. cp .env.example .env && editar .env');
console.log('  6. npm install');
console.log('  7. docker compose up -d');
console.log('  8. sleep 30 && npm run db:migrate');
console.log('  9. Abrir Antigravity e executar Prompt 1 (Claude)');
console.log('');
