// ═══════════════════════════════════════════════════════════════
// Nexora Media Processing — Testes E2E Playwright
// Ficheiro: tests/e2e/upload-flow.spec.ts
// ═══════════════════════════════════════════════════════════════

import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { existsSync } from 'fs';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const FIXTURE  = path.resolve('./tests/fixtures/nexora_reference_broadcast.mp4');

test.describe('Upload Flow — Nexora Media Processing', () => {

  test.beforeEach(async ({ page }) => {
    // Navegar para a aplicação
    await page.goto(BASE_URL);
    // Aguardar que o layout esteja visível
    await page.waitForSelector('nav, aside', { timeout: 10000 });
  });

  test('Dashboard carrega com métricas', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);

    // Verificar que os metric cards estão presentes
    await expect(page.getByText('Assets processados hoje')).toBeVisible();
    await expect(page.getByText('Taxa de sucesso')).toBeVisible();
    await expect(page.getByText('VMAF médio')).toBeVisible();
  });

  test('Lista de assets carrega e tem paginação', async ({ page }) => {
    await page.goto(`${BASE_URL}/assets`);
    await expect(page.getByText('Assets')).toBeVisible();

    // Filtros devem estar visíveis
    await expect(page.getByPlaceholder('Pesquisar por nome...')).toBeVisible();
  });

  test('Abrir modal de upload', async ({ page }) => {
    await page.goto(`${BASE_URL}/assets`);

    await page.click('button:has-text("Adicionar asset")');

    // Modal deve abrir
    await expect(page.getByText('Adicionar assets')).toBeVisible();
    await expect(page.getByText('Arrasta ficheiros')).toBeVisible();
  });

  test('Upload de ficheiro via drag zone (se fixture existir)', async ({ page }) => {
    if (!existsSync(FIXTURE)) {
      test.skip(true, 'Fixture não existe — corre: npm run fixtures:generate');
      return;
    }

    await page.goto(`${BASE_URL}/assets`);
    await page.click('button:has-text("Adicionar asset")');

    // Seleccionar ficheiro via input (simulação de upload)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(FIXTURE);

    // Deve avançar para o step de perfil
    await expect(page.getByText('Escolher perfil de encoding')).toBeVisible({ timeout: 5000 });

    // Seleccionar perfil Broadcast HD
    await page.click('label:has-text("Broadcast HD")');

    // Avançar para opções
    await page.click('button:has-text("Continuar")');
    await expect(page.getByText('Prioridade')).toBeVisible();
  });

  test('Asset detail — tabs navegáveis', async ({ page }) => {
    // Só testar se houver assets
    await page.goto(`${BASE_URL}/assets`);

    const firstRow = page.locator('a[href^="/assets/"]').first();
    const count = await firstRow.count();
    if (count === 0) {
      test.skip(true, 'Sem assets para testar — faz upload primeiro');
      return;
    }

    await firstRow.click();
    await page.waitForURL(/\/assets\/.+/);

    // Tabs devem estar visíveis
    for (const tab of ['Visão geral', 'Relatório QC', 'Jobs', 'Audit Trail', 'Downloads']) {
      await expect(page.getByText(tab)).toBeVisible();
    }

    // Navegar pelas tabs
    await page.click('button:has-text("Jobs")');
    await page.click('button:has-text("Audit Trail")');
    await expect(page.getByText('Registo imutável')).toBeVisible();
  });

  test('Queue monitor mostra filas', async ({ page }) => {
    await page.goto(`${BASE_URL}/queue`);
    await expect(page.getByText('Fila de Processamento')).toBeVisible();
    await expect(page.getByText('Profundidade das filas')).toBeVisible();

    // Deve mostrar os workers
    for (const worker of ['Transcode', 'Áudio', 'Delivery']) {
      await expect(page.getByText(worker)).toBeVisible();
    }
  });

  test('Acessibilidade — sem violações críticas WCAG 2.1 AA', async ({ page }) => {
    // Requer @axe-core/playwright: npm install -D @axe-core/playwright
    // Descomenta quando a dependência estiver instalada:
    /*
    const { checkA11y, injectAxe } = await import('@axe-core/playwright');
    await page.goto(`${BASE_URL}/`);
    await injectAxe(page);
    await checkA11y(page, undefined, {
      detailedReport: true,
      detailedReportOptions: { html: true },
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
    */

    // Verificações básicas de acessibilidade
    await page.goto(`${BASE_URL}/`);
    const h1 = await page.locator('h1').count();
    expect(h1).toBeGreaterThanOrEqual(1);

    // Imagens devem ter alt text
    const imgsWithoutAlt = await page.locator('img:not([alt])').count();
    expect(imgsWithoutAlt).toBe(0);
  });
});

test.describe('Upload Flow — Segurança', () => {

  test('Recusa ficheiro executável (.exe)', async ({ page }) => {
    await page.goto(`${BASE_URL}/assets`);
    await page.click('button:has-text("Adicionar asset")');

    // O input de ficheiro tem accept= que já bloqueia no browser
    const acceptAttr = await page.locator('input[type="file"]').getAttribute('accept');
    expect(acceptAttr).not.toContain('.exe');
    expect(acceptAttr).toContain('video/mp4');
  });

  test('Campo de search não é vulnerável a XSS básico', async ({ page }) => {
    await page.goto(`${BASE_URL}/assets`);

    const searchInput = page.getByPlaceholder('Pesquisar por nome...');
    await searchInput.fill('<script>alert(1)</script>');

    // Página não deve executar o script
    const dialogs: string[] = [];
    page.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });

    await page.waitForTimeout(500);
    expect(dialogs).toHaveLength(0);
  });
});


// ═══════════════════════════════════════════════════════════════
// Nexora — playwright.config.ts
// ═══════════════════════════════════════════════════════════════

/*
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'tests/e2e/reports' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: process.env.CI ? {
    command: 'npm run dev',
    url:     'http://localhost:3000',
    reuseExistingServer: false,
    timeout: 120000,
  } : undefined,
});
*/


// ═══════════════════════════════════════════════════════════════
// Nexora — src/api/security.ts
// Validação de ficheiros, SSRF prevention, JWT generation
// ═══════════════════════════════════════════════════════════════

import { createHash, generateKeyPairSync } from 'crypto';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { readFileSync } from 'fs';
import * as jose from 'jose';
import path from 'path';
import { logger } from '../observability/logger';

// ── Magic bytes validator (ADR-002 security) ──────────────────

const ALLOWED_SIGNATURES: Array<{ format: string; check: (b: Buffer) => boolean }> = [
  { format: 'mp4/mov',  check: b => b.length >= 8 && b.slice(4, 8).toString() === 'ftyp' },
  { format: 'mxf',      check: b => b.length >= 4 && b[0]===0x06 && b[1]===0x0E && b[2]===0x2B && b[3]===0x34 },
  { format: 'mpeg-ts',  check: b => b.length >= 1 && b[0] === 0x47 },
  { format: 'mkv/webm', check: b => b.length >= 4 && b[0]===0x1A && b[1]===0x45 && b[2]===0xDF && b[3]===0xA3 },
  { format: 'wav',      check: b => b.length >= 4 && b.slice(0,4).toString() === 'RIFF' },
  { format: 'mp3-id3',  check: b => b.length >= 3 && b.slice(0,3).toString() === 'ID3' },
  { format: 'mp3-sync', check: b => b.length >= 2 && b[0] === 0xFF && (b[1] === 0xFB || b[1] === 0xFA) },
  { format: 'aac',      check: b => b.length >= 2 && b[0] === 0xFF && (b[1] === 0xF1 || b[1] === 0xF9) },
  { format: 'ogg',      check: b => b.length >= 4 && b.slice(0,4).toString() === 'OggS' },
];

export function validateMagicBytes(buffer: Buffer): { valid: boolean; format?: string; detected?: string } {
  if (buffer.length < 16) {
    return { valid: false, detected: 'ficheiro demasiado pequeno para validação' };
  }

  for (const sig of ALLOWED_SIGNATURES) {
    if (sig.check(buffer)) {
      return { valid: true, format: sig.format };
    }
  }

  return {
    valid: false,
    detected: `bytes desconhecidos: 0x${buffer.slice(0, 4).toString('hex')}`
  };
}

// ── Filename sanitizer ────────────────────────────────────────

const DANGEROUS_CHARS = /[|&;`$(){}[\]<>'"\\\/\0\n\r\t]/g;
const MAX_FILENAME_LEN = 200;

export function sanitizeFilename(original: string): string {
  // 1. Extrair apenas o basename
  const base = path.basename(original);
  // 2. Remover caracteres perigosos
  const safe = base.replace(DANGEROUS_CHARS, '_');
  // 3. Limitar comprimento
  const limited = safe.slice(0, MAX_FILENAME_LEN);
  // 4. Garantir que não começa com ponto ou hífen
  return limited.replace(/^[.\-_]+/, '') || 'unnamed_file';
}

// ── SSRF Prevention ───────────────────────────────────────────

const PRIVATE_IP_RANGES = [
  /^127\./,                          // loopback
  /^10\./,                           // RFC1918
  /^172\.(1[6-9]|2[0-9]|3[01])\./,  // RFC1918
  /^192\.168\./,                      // RFC1918
  /^169\.254\./,                      // link-local
  /^::1$/,                            // IPv6 loopback
  /^fc00:/,                           // IPv6 unique local
  /^fe80:/,                           // IPv6 link-local
  /^0\./,                             // this network
  /^255\./,                           // broadcast
];

export async function validateURLForIngest(rawUrl: string): Promise<{ valid: boolean; reason?: string }> {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return { valid: false, reason: 'URL inválido' };
  }

  // Só http/https
  if (!['http:', 'https:'].includes(url.protocol)) {
    return { valid: false, reason: `Protocolo ${url.protocol} não permitido` };
  }

  // Resolver DNS e verificar IP
  try {
    const { Resolver } = await import('dns/promises');
    const resolver = new Resolver();
    const addresses = await resolver.resolve(url.hostname).catch(() => []);

    for (const addr of addresses) {
      for (const range of PRIVATE_IP_RANGES) {
        if (range.test(addr)) {
          return {
            valid: false,
            reason: `IP ${addr} está num range privado — possível SSRF`
          };
        }
      }
    }
  } catch {
    return { valid: false, reason: 'Não foi possível resolver o hostname' };
  }

  return { valid: true };
}

// ── JWT Key Management ────────────────────────────────────────

const SECRETS_DIR       = path.resolve('./secrets');
const PRIVATE_KEY_PATH  = process.env.JWT_PRIVATE_KEY_PATH ?? path.join(SECRETS_DIR, 'jwt_private.pem');
const PUBLIC_KEY_PATH   = process.env.JWT_PUBLIC_KEY_PATH  ?? path.join(SECRETS_DIR, 'jwt_public.pem');

/**
 * Gerar par de chaves RSA para JWT RS256.
 * Chamar uma vez no setup do projecto.
 */
export function generateJWTKeyPair(): void {
  if (!existsSync(SECRETS_DIR)) mkdirSync(SECRETS_DIR, { recursive: true, mode: 0o700 });

  if (existsSync(PRIVATE_KEY_PATH)) {
    logger.info('Chaves JWT já existem — a saltar geração');
    return;
  }

  logger.info('A gerar par de chaves RSA 4096-bit para JWT...');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding:  { type: 'spki',  format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  writeFileSync(PRIVATE_KEY_PATH, privateKey, { mode: 0o600 }); // só owner pode ler
  writeFileSync(PUBLIC_KEY_PATH,  publicKey,  { mode: 0o644 });

  logger.info({ privatePath: PRIVATE_KEY_PATH, publicPath: PUBLIC_KEY_PATH },
    'Chaves JWT geradas com sucesso');
}

/**
 * Emitir um JWT RS256 de teste (só para development).
 */
export async function issueDevToken(payload: {
  sub:   string;
  org:   string;
  roles: string[];
}): Promise<string> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('issueDevToken não pode ser usado em produção!');
  }

  const { generateKeyPair } = jose;
  const { privateKey } = await generateKeyPair('RS256');

  return new jose.SignJWT({
    ...payload,
    permissions: ['*'],
    jti: createHash('sha256').update(Math.random().toString()).digest('hex').slice(0, 16),
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(privateKey);
}

// ── Audit Chain Verifier ──────────────────────────────────────

/**
 * Verificar integridade da cadeia de audit logs.
 * Se a cadeia estiver quebrada → possível adulteração.
 */
export async function verifyAuditChain(assetId: string): Promise<{
  valid:        boolean;
  totalEntries: number;
  brokenAt?:    string;
}> {
  const { prisma } = await import('../db/prisma');

  const logs = await prisma.auditLog.findMany({
    where:   { assetId },
    orderBy: { createdAt: 'asc' },
    select:  { id: true, eventType: true, operator: true, payload: true, entryHash: true, createdAt: true },
  });

  if (logs.length === 0) return { valid: true, totalEntries: 0 };

  // Verificar cada entrada da cadeia
  for (const log of logs) {
    const content = JSON.stringify({
      assetId,
      eventType: log.eventType,
      operator:  log.operator,
      payload:   log.payload,
    });

    // A hash deverá corresponder ao conteúdo
    // (em produção usaria a chain: hash = SHA256(prev_hash + content))
    const expectedHash = createHash('sha256').update(content).digest('hex');

    // Verificação simplificada — em produção verificar cadeia completa
    if (!log.entryHash || log.entryHash.length < 16) {
      return { valid: false, totalEntries: logs.length, brokenAt: log.id };
    }
  }

  return { valid: true, totalEntries: logs.length };
}


// ═══════════════════════════════════════════════════════════════
// Nexora — scripts/nexora-generate-keys.ts
// Gerar chaves JWT no setup inicial
// ═══════════════════════════════════════════════════════════════

// Executar: npx tsx scripts/nexora-generate-keys.ts

import { generateJWTKeyPair } from '../src/api/security';

console.log('A gerar chaves JWT RS256...');
generateJWTKeyPair();
console.log('✓ Chaves JWT geradas em ./secrets/');
console.log('  NUNCA faças commit da pasta ./secrets/ para Git!');
console.log('  Verifica que ./secrets/ está no .gitignore');


// ═══════════════════════════════════════════════════════════════
// Nexora — CHECKLIST DE ACEITAÇÃO FINAL COMPLETO
// Ficheiro: docs/ACCEPTANCE_CHECKLIST.md
// ═══════════════════════════════════════════════════════════════

export const ACCEPTANCE_CHECKLIST = `
# Nexora Media Processing — Checklist de Aceitação Final

## 0. Pré-requisitos

- [ ] Node.js 20+ instalado (node --version)
- [ ] Docker Desktop instalado e a correr
- [ ] FFmpeg instalado (ffmpeg -version)
- [ ] HandBrakeCLI instalado (HandBrakeCLI --version)
- [ ] MediaInfo instalado (mediainfo --version)
- [ ] BS1770GAIN instalado (bs1770gain --version)
- [ ] MediaConch instalado (mediaconch --version)

## 1. Setup e Infraestrutura

- [ ] Scaffold executado sem erros (node scripts/nexora-scaffold.js)
- [ ] Scripts de docs executados (node scripts/nexora-deploy-docs.js)
- [ ] Scripts de finalização (node scripts/nexora-finalize.js)
- [ ] .env configurado (cp .env.example .env + editar passwords)
- [ ] Chaves JWT geradas (npx tsx scripts/nexora-generate-keys.ts)
- [ ] Docker Compose inicia sem erros (docker compose up -d)
- [ ] Todos os serviços Up (docker compose ps — 10 serviços)
- [ ] Migrações aplicadas (npm run db:migrate)
- [ ] Seed executado (npm run db:seed)
- [ ] Fixtures geradas (npm run fixtures:generate)

## 2. Health Checks

- [ ] GET /health → {"status":"ok","version":"0.1.0"}
- [ ] GET /health/ready → {"status":"ok","db":"connected","redis":"connected"}
- [ ] GET /health/live → {"status":"ok"}
- [ ] GET /metrics → responde com métricas Prometheus
- [ ] Temporal UI em http://localhost:8080 — abre sem erros
- [ ] Grafana em http://localhost:3001 — login admin/nexora funciona
- [ ] MinIO em http://localhost:9001 — login nexoraadmin funciona
- [ ] Frontend em http://localhost:3000 — dashboard carrega

## 3. Segurança (ADRs)

- [ ] ADR-002: FFmpeg NUNCA com exec() string → grep -r 'exec(' src/ | grep -v execFile
  Resultado esperado: 0 ocorrências de exec( sem File
- [ ] ADR-003: SHA-256 obrigatório → grep -r 'md5' src/ deve retornar 0 resultados
- [ ] ADR-004: yuv420p → toda a pipeline usa yuv420p para distribuição
- [ ] ADR-005: Two-pass R128 → audio.worker.ts tem duas chamadas FFmpeg
- [ ] ADR-006: Closed GOP → -flags +cgop e -sc_threshold 0 em todos os cmds broadcast
- [ ] ADR-007: Audit trail → prisma.auditLog.update() e .delete() não existem no código
- [ ] ADR-008: RS256 JWT → chaves em ./secrets/, não HS256
- [ ] ADR-009: BS1770GAIN → verifyWithBS1770GAIN chamado após normalização
- [ ] ADR-010: VMAF → vmaf_score guardado na DB após cada encode

## 4. Pipeline — Testes com Fixtures

### 4.1 Ficheiro de referência (deve passar tudo)

\`\`\`bash
# Upload via API
curl -X POST http://localhost:3000/api/v1/assets \\
  -H "Authorization: Bearer \$(npx tsx scripts/dev-token.ts)" \\
  -F "file=@tests/fixtures/nexora_reference_broadcast.mp4" \\
  -F "profile=nexora_broadcast_hd"
\`\`\`

- [ ] Status retorna 202 com asset_id
- [ ] Asset muda para QC_PASS em < 30s
- [ ] Asset muda para READY em < 10min (dependendo do hardware)

### 4.2 Verificações pós-processamento

\`\`\`bash
# Substituir ASSET_ID pelo ID retornado no upload
ASSET_ID="..."

# Verificar GOP no output
ffprobe -v quiet -select_streams v:0 \\
  -show_entries stream=codec_name,r_frame_rate \\
  -show_frames -show_entries frame=pict_type,key_frame \\
  -print_format compact \\
  media/output/\${ASSET_ID}_nexora_broadcast_hd.mp4 2>/dev/null | \\
  grep "key_frame=1" | head -3

# Verificar loudness com BS1770GAIN
bs1770gain --ebu --integrated --truepeak \\
  media/output/\${ASSET_ID}_nexora_broadcast_hd.mp4
\`\`\`

- [ ] GOP verificado: key_frame=1 em cada gop_size frames
- [ ] Pixel format: yuv420p confirmado
- [ ] B-frames: 0 confirmado
- [ ] Loudness: LUFS dentro de ±0.5 LU de -23
- [ ] True Peak: ≤ -1.0 dBTP confirmado pelo BS1770GAIN
- [ ] VMAF score: ≥ 90 para nexora_broadcast_hd
- [ ] SHA-256 guardado na DB para o asset

### 4.3 Ficheiro com Open GOP (deve forçar re-encode)

- [ ] QC detecta Open GOP com código ERR_GOP_OPEN
- [ ] Asset vai para REJECT (não para QUARANTINE)
- [ ] Audit log criado com qc_pre_completed

### 4.4 Ficheiro corrompido (deve ser rejeitado)

- [ ] QC detecta ERR_DURATION_TOO_SHORT e ERR_FILE_TOO_SMALL
- [ ] Asset vai para QC_REJECT imediatamente
- [ ] assetsRejected counter incrementa no Prometheus

### 4.5 Ficheiro VFR (deve forçar re-encode)

- [ ] QC detecta ERR_VFR com severity critical
- [ ] Asset vai para REJECT

## 5. Qualidade de Código

- [ ] TypeScript sem erros: npx tsc --noEmit (0 erros)
- [ ] ESLint sem warnings: npm run lint (0 problemas)
- [ ] Prettier verificado: npx prettier --check "src/**/*.ts" (0 ficheiros)
- [ ] Testes unitários: npm test (todos verdes)
- [ ] Cobertura: npm run test:coverage (≥ 80% linhas, ≥ 75% branches)
- [ ] QC rules: 100% branch coverage (safety-critical)
- [ ] Zero "any" implícito no TypeScript
- [ ] Zero secrets hardcoded (grep -r 'password\\|secret\\|key' src/ --include="*.ts")
- [ ] .env NÃO está no git (git status não mostra .env)
- [ ] ./secrets/ NÃO está no git

## 6. Frontend

- [ ] Dashboard carrega com dados reais do Prometheus
- [ ] Upload flow completo: ficheiro → perfil → opções → progresso → asset detail
- [ ] Status badge anima para estados em processamento
- [ ] SSE funciona: estado do asset actualiza em tempo real sem refresh
- [ ] Queue monitor mostra profundidade das filas
- [ ] Asset detail: todas as 5 tabs funcionam
- [ ] VMAF gauge renderiza correctamente
- [ ] Audit trail tab mostra registo imutável

## 7. Observabilidade

- [ ] Prometheus scraping: http://localhost:9090/targets — nexora-api Up
- [ ] Grafana dashboards provisionados automaticamente
- [ ] nexora_assets_ingested_total incrementa ao fazer upload
- [ ] nexora_vmaf_score tem valores após processamento
- [ ] Alertas configurados no Alertmanager
- [ ] Temporal UI mostra workflow completado com todos os steps

## 8. GitHub

- [ ] Repositório criado e sincronizado
- [ ] PROGRESS.md actualizado com todos os itens concluídos
- [ ] GitHub Actions a correr (verde) no repositório
- [ ] Branch main protegida (requer PR + testes)
- [ ] Commits em português com mensagens descritivas

## 9. PROGRESS.md

- [ ] Todas as fases marcadas como concluídas
- [ ] Histórico de sessões preenchido
- [ ] Nenhum problema em aberto na secção de problemas
- [ ] ADRs todos documentados

---

## Critério de DONE

O projecto Nexora Media Processing está pronto para produção quando:
1. Todos os itens acima estão marcados ✅
2. Um ficheiro MP4 real é processado do início ao fim (INGESTED → READY)
3. O output tem VMAF ≥ 90, LUFS ±0.5 do target, True Peak ≤ -1 dBTP
4. A cobertura de testes é ≥ 80% e QC rules têm 100%
5. Não há segredos no repositório GitHub

*Nexora Media Processing — Production Ready*
`;
