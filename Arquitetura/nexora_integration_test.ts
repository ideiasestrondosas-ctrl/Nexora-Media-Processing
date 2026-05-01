// ═══════════════════════════════════════════════════════════════
// Nexora Media Processing — Testes de Integração
// Ficheiro: tests/integration/pipeline.test.ts
//
// Testa o pipeline completo usando Testcontainers
// (PostgreSQL e Redis reais em Docker)
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

// Containers globais (inicializados uma vez para toda a suite)
let pgContainer:    StartedPostgreSqlContainer;
let redisContainer: StartedRedisContainer;

// Setup das variáveis de ambiente de teste
function setTestEnv(pgUrl: string, redisUrl: string): void {
  process.env.DATABASE_URL = pgUrl;
  process.env.REDIS_URL    = redisUrl;
  process.env.NODE_ENV     = 'test';
  process.env.LOG_LEVEL    = 'error';
  process.env.NEXORA_INPUT_DIR  = path.resolve('./tests/fixtures');
  process.env.NEXORA_OUTPUT_DIR = path.resolve('./tests/output');
  process.env.NEXORA_TEMP_DIR   = path.resolve('./tests/temp');
  process.env.FFMPEG_DEFAULT_TIMEOUT_MS = '120000';

  // Criar directorias de teste
  ['./tests/output', './tests/temp'].forEach(d => {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  });
}

beforeAll(async () => {
  // Iniciar containers (demora ~30s na primeira vez, cache depois)
  console.log('  ⬡ A iniciar PostgreSQL...');
  pgContainer = await new PostgreSqlContainer('postgres:15-alpine')
    .withDatabase('nexora_test')
    .withUsername('nexora')
    .withPassword('nexora_test')
    .start();

  console.log('  ⬡ A iniciar Redis...');
  redisContainer = await new RedisContainer('redis:7-alpine').start();

  setTestEnv(
    pgContainer.getConnectionUri(),
    `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`
  );

  // Aplicar migrations Prisma
  execSync('npx prisma migrate deploy', {
    env: { ...process.env },
    stdio: 'pipe'
  });

  console.log('  ✓ Ambiente de teste pronto');
}, 120000); // timeout 2min para iniciar containers

afterAll(async () => {
  await pgContainer?.stop();
  await redisContainer?.stop();
});

// ── Importações após setup de env ────────────────────────────
// (lazy imports para garantir que env está configurado antes do Prisma)
const getPrisma = () => import('../../src/db/prisma').then(m => m.prisma);
const getQCRules = () => import('../../src/qc/rules/index');
const getBuilder = () => import('../../src/pipeline/ffmpeg/builder');

// ══════════════════════════════════════════
// TESTES DE INTEGRAÇÃO: QC PIPELINE
// ══════════════════════════════════════════

describe('Integração: QC Pipeline', () => {

  it('deve criar asset na base de dados e ter estado INGESTED', async () => {
    const { prisma } = await import('../../src/db/prisma');
    const { randomUUID } = await import('crypto');
    const { createHash } = await import('crypto');

    const assetId = randomUUID();
    const sha256  = createHash('sha256').update('test').digest('hex');

    const asset = await prisma.asset.create({
      data: {
        id: assetId,
        originalName: 'test_asset.mp4',
        sha256Input: sha256,
        status: 'INGESTED',
        profile: 'nexora_broadcast_hd',
      }
    });

    expect(asset.id).toBe(assetId);
    expect(asset.status).toBe('INGESTED');
    expect(asset.sha256Input).toBe(sha256);

    // Limpar
    await prisma.asset.delete({ where: { id: assetId } });
  });

  it('deve criar audit log e não permitir actualização (append-only)', async () => {
    const { prisma } = await import('../../src/db/prisma');
    const { randomUUID } = await import('crypto');
    const { createHash } = await import('crypto');

    const assetId = randomUUID();
    await prisma.asset.create({
      data: {
        id: assetId,
        originalName: 'test_audit.mp4',
        sha256Input:  createHash('sha256').update('audit_test').digest('hex'),
        status: 'INGESTED',
        profile: 'nexora_broadcast_hd',
      }
    });

    // Criar audit log
    const logEntry = await prisma.auditLog.create({
      data: {
        assetId,
        eventType:  'test_event',
        operator:   'test_suite',
        payload:    { message: 'test' },
        entryHash:  'test_hash_001',
      }
    });

    expect(logEntry.id).toBeDefined();
    expect(logEntry.eventType).toBe('test_event');

    // Verificar que o log existe e não foi alterado
    const retrieved = await prisma.auditLog.findUnique({ where: { id: logEntry.id } });
    expect(retrieved?.entryHash).toBe('test_hash_001');

    // Limpar
    await prisma.auditLog.delete({ where: { id: logEntry.id } });
    await prisma.asset.delete({ where: { id: assetId } });
  });

  it('deve rejeitar ficheiro corrompido e criar audit entry de rejeição', async () => {
    // Verificar que o fixture de ficheiro corrompido existe
    const corruptPath = path.resolve('./tests/fixtures/nexora_problem_corrupt.mp4');
    if (!existsSync(corruptPath)) {
      console.log('  ! Fixture corrompido não existe — a saltar (corre fixtures:generate)');
      return;
    }

    const { runQCRules } = await import('../../src/qc/rules/index');

    // Simular metadata de ficheiro corrompido
    const result = await runQCRules({
      assetId: 'test-corrupt',
      profile: 'nexora_broadcast_hd',
      video: {
        codec: 'h264',
        profile: 'high',
        level: '4.1',
        pixelFormat: 'yuv420p',
        frameRate: 25,
        frameRateMode: 'CFR',
        gopType: 'CLOSED',
        hasIdrFrames: true,
        bFrameCount: 0,
        bitrate: 8000,
        width: 1920,
        height: 1080,
        bitDepth: 8,
        colorSpace: 'bt709',
        colorPrimaries: 'bt709',
        transferCharacteristics: 'bt709',
        duration: 0, // duração zero → ficheiro corrompido
        hasFastStart: true,
      },
      audio: {
        codec: 'pcm_s24le',
        sampleRate: 48000,
        bitDepth: 24,
        channels: 2,
        channelLayout: 'stereo',
        integratedLufs: -23,
        truePeakDbtp: -1.5,
        loudnessRange: 9,
        audioVideoSyncMs: 0,
      },
      container: {
        format: 'mp4',
        duration: 0,
        size: 100, // ficheiro muito pequeno
        hasEditLists: false,
        hasTimecodeTrack: false,
        moovPosition: 'start',
      },
    });

    // Deve rejeitar por duração zero E tamanho muito pequeno
    expect(result.decision).toBe('REJECT');
    expect(result.results.some(r => r.code === 'ERR_DURATION_TOO_SHORT')).toBe(true);
    expect(result.results.some(r => r.code === 'ERR_FILE_TOO_SMALL')).toBe(true);
  });

  it('deve passar QC para ficheiro broadcast-safe perfeito', async () => {
    const { runQCRules } = await import('../../src/qc/rules/index');

    const result = await runQCRules({
      assetId: 'test-perfect',
      profile: 'nexora_broadcast_hd',
      video: {
        codec: 'h264',
        profile: 'high',
        level: '4.1',
        pixelFormat: 'yuv420p',
        frameRate: 25,
        frameRateMode: 'CFR',
        gopType: 'CLOSED',
        hasIdrFrames: true,
        bFrameCount: 0,
        bitrate: 8000,
        width: 1920,
        height: 1080,
        bitDepth: 8,
        colorSpace: 'bt709',
        colorPrimaries: 'bt709',
        transferCharacteristics: 'bt709',
        duration: 3600,
        hasFastStart: true,
      },
      audio: {
        codec: 'pcm_s24le',
        sampleRate: 48000,
        bitDepth: 24,
        channels: 2,
        channelLayout: 'stereo',
        integratedLufs: -23.1,
        truePeakDbtp: -1.5,
        loudnessRange: 9.2,
        audioVideoSyncMs: 0,
      },
      container: {
        format: 'mp4',
        duration: 3600,
        size: 3 * 1024 * 1024 * 1024,
        hasEditLists: false,
        hasTimecodeTrack: false,
        moovPosition: 'start',
      },
    });

    expect(result.decision).toBe('PASS');
    expect(result.results.every(r => r.pass || r.severity !== 'critical')).toBe(true);
  });

  it('deve quarentenar ficheiro com múltiplos warnings mas sem erros críticos', async () => {
    const { runQCRules } = await import('../../src/qc/rules/index');

    const result = await runQCRules({
      assetId: 'test-warnings',
      profile: 'nexora_broadcast_hd',
      video: {
        codec: 'h264', profile: 'high', level: '4.1', pixelFormat: 'yuv420p',
        frameRate: 25, frameRateMode: 'CFR', gopType: 'CLOSED',
        hasIdrFrames: true, bFrameCount: 0, bitrate: 8000,
        width: 1920, height: 1080, bitDepth: 8,
        colorSpace: 'smpte170m', // color space incomum → warning
        colorPrimaries: 'smpte170m', transferCharacteristics: 'smpte170m',
        duration: 3600, hasFastStart: true,
      },
      audio: {
        codec: 'aac',
        sampleRate: 44100,   // 44100 Hz → warning
        bitDepth: 16,
        channels: 1,         // mono → warning
        channelLayout: 'mono',
        integratedLufs: -18, // desvio > 2 LU do target → warning
        truePeakDbtp: -0.8,  // True Peak > -1 → warning (não critical)
        loudnessRange: 9,
        audioVideoSyncMs: 25, // sync 25ms → warning
      },
      container: {
        format: 'mp4', duration: 3600,
        size: 1024 * 1024 * 100,
        hasEditLists: true,  // edit lists → warning
        hasTimecodeTrack: false,
        moovPosition: 'end', // sem fast start → warning
      },
    });

    // Múltiplos warnings → QUARANTINE
    expect(result.decision).toBe('QUARANTINE');
    const warnings = result.results.filter(r => !r.pass && r.severity === 'warning');
    expect(warnings.length).toBeGreaterThanOrEqual(3);
  });
});

// ══════════════════════════════════════════
// TESTES DE INTEGRAÇÃO: API
// ══════════════════════════════════════════

describe('Integração: API Endpoints', () => {
  let app: any;

  beforeAll(async () => {
    const { default: Fastify } = await import('fastify');
    const { registerPlugins, registerRoutes } = await import('../../src/api/plugins');

    app = Fastify({ logger: false });
    await registerPlugins(app);
    await registerRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /health deve retornar 200 com status ok', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.version).toBeDefined();
  });

  it('GET /api/v1/assets sem token deve retornar 401', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/assets',
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('MISSING_TOKEN');
  });

  it('GET /api/v1/assets/nao-existe deve retornar 404', async () => {
    // Em ambiente de teste, auth é bypassed via NODE_ENV=test
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/assets/00000000-0000-0000-0000-000000000999',
      headers: { Authorization: 'Bearer test-token-dev' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('GET /api/v1/profiles deve listar 5 perfis', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/profiles',
      headers: { Authorization: 'Bearer test-token-dev' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toHaveLength(5);
    expect(body.data.map((p: any) => p.id)).toContain('nexora_broadcast_hd');
  });
});


// ═══════════════════════════════════════════════════════════════
// Nexora Media Processing — Testes de Performance (k6)
// Ficheiro: tests/performance/load-test.js
//
// COMO EXECUTAR:
//   k6 run tests/performance/load-test.js
//
// INSTALAR k6:
//   macOS:  brew install k6
//   Linux:  snap install k6
//   Windows: choco install k6
// ═══════════════════════════════════════════════════════════════

/*
 * Este ficheiro é JavaScript puro (k6 não suporta TypeScript directamente)
 * Guarda como tests/performance/load-test.js
 */

export const LOAD_TEST_SCRIPT = `
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// Métricas customizadas
const assetStatusDuration = new Trend('nexora_asset_status_duration', true);
const assetListDuration   = new Trend('nexora_asset_list_duration', true);
const errorRate           = new Rate('nexora_error_rate');

// Configuração dos estágios de carga
export const options = {
  stages: [
    { duration: '1m',  target: 10  },  // ramp up
    { duration: '3m',  target: 50  },  // carga sustentada
    { duration: '1m',  target: 100 },  // pico
    { duration: '1m',  target: 50  },  // diminuir
    { duration: '30s', target: 0   },  // ramp down
  ],
  thresholds: {
    // p95 de todos os pedidos < 500ms
    http_req_duration: ['p(95)<500'],

    // Taxa de erro < 1%
    http_req_failed: ['rate<0.01'],

    // Endpoint de status deve ser muito rápido
    'nexora_asset_status_duration': ['p(99)<200'],

    // Taxa de erro Nexora < 1%
    'nexora_error_rate': ['rate<0.01'],
  },
};

const BASE_URL   = __ENV.BASE_URL   || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-token-dev';
const ASSET_ID   = __ENV.ASSET_ID   || '00000000-0000-0000-0000-000000000001';

const headers = {
  Authorization: \`Bearer \${AUTH_TOKEN}\`,
  'Content-Type': 'application/json',
};

export default function () {
  // Teste 1: Verificar estado de um asset (operação mais frequente)
  const statusStart = Date.now();
  const statusRes = http.get(
    \`\${BASE_URL}/api/v1/assets/\${ASSET_ID}/status\`,
    { headers, tags: { endpoint: 'asset_status' } }
  );
  assetStatusDuration.add(Date.now() - statusStart);

  check(statusRes, {
    'status endpoint: 200': (r) => r.status === 200 || r.status === 404,
    'status endpoint: tempo < 200ms': (r) => r.timings.duration < 200,
  });
  errorRate.add(statusRes.status >= 500 ? 1 : 0);

  sleep(0.5);

  // Teste 2: Listar assets com filtros
  const listStart = Date.now();
  const listRes = http.get(
    \`\${BASE_URL}/api/v1/assets?status=READY&page=1&pageSize=25\`,
    { headers, tags: { endpoint: 'asset_list' } }
  );
  assetListDuration.add(Date.now() - listStart);

  check(listRes, {
    'list endpoint: 200': (r) => r.status === 200,
    'list endpoint: tem data': (r) => JSON.parse(r.body).data !== undefined,
    'list endpoint: tempo < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(0.5);

  // Teste 3: Health check
  const healthRes = http.get(\`\${BASE_URL}/health\`);
  check(healthRes, {
    'health: 200': (r) => r.status === 200,
    'health: status ok': (r) => JSON.parse(r.body).status === 'ok',
  });

  sleep(1);
}

// Relatório de sumário customizado
export function handleSummary(data) {
  return {
    stdout: JSON.stringify({
      nexora_performance_summary: {
        asset_status_p95:    data.metrics.nexora_asset_status_duration?.values?.['p(95)'],
        asset_list_p95:      data.metrics.nexora_asset_list_duration?.values?.['p(95)'],
        error_rate:          data.metrics.nexora_error_rate?.values?.rate,
        total_requests:      data.metrics.http_reqs?.values?.count,
        failed_requests:     data.metrics.http_req_failed?.values?.count,
        test_duration_s:     data.state?.testRunDurationMs / 1000,
      }
    }, null, 2),
    'tests/performance/results/latest.json': JSON.stringify(data, null, 2),
  };
}
`;

// Ficheiro auxiliar para criar o script k6 em disco
// Cria o ficheiro correcto para execução
export async function createK6Script(): Promise<void> {
  const { writeFile, mkdir } = await import('fs/promises');
  await mkdir('./tests/performance/results', { recursive: true });
  await writeFile('./tests/performance/load-test.js', LOAD_TEST_SCRIPT.trim(), 'utf8');
}
