#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Nexora Media Processing — Script de organização de ficheiros
// Versão Node.js — sem problemas de sintaxe PowerShell
//
// GUARDAR EM: C:\Dev\Nexora Media Processing\nexora-mover-tudo.js
//
// EXECUTAR:
//   cd "C:\Dev\Nexora Media Processing"
//   node nexora-mover-tudo.js
// ═══════════════════════════════════════════════════════════════

const fs   = require('fs');
const path = require('path');

const ROOT = process.cwd();
const ARCH = path.join(ROOT, 'arquitetura');

// Verificar que estamos no sitio certo
if (!fs.existsSync(ARCH)) {
  console.error('ERRO: Pasta "arquitetura" não encontrada.');
  console.error('Executa este script a partir de: C:\\Dev\\Nexora Media Processing\\');
  process.exit(1);
}

const c = { reset:'\x1b[0m', green:'\x1b[32m', blue:'\x1b[34m', yellow:'\x1b[33m', red:'\x1b[31m' };
const step  = t  => console.log(`\n${c.blue}>> ${t}${c.reset}`);
const ok    = t  => { console.log(`${c.green}  ✓${c.reset} ${t}`); created++; };
const warn  = t  => console.log(`${c.yellow}  !${c.reset} ${t}`);
const info  = t  => console.log(`${c.blue}  i${c.reset} ${t}`);

let created = 0;

// ── Utilitários ────────────────────────────────────────────────

function writeFile(rel, content) {
  if (!content || content.trim().length < 5) { warn(`Conteúdo vazio, ignorado: ${rel}`); return; }
  const full = path.join(ROOT, rel.replace(/\//g, path.sep));
  const dir  = path.dirname(full);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(full)) { warn(`Já existe (mantido): ${rel}`); return; }
  fs.writeFileSync(full, content, 'utf8');
  ok(`Criado: ${rel}`);
}

function readArq(name) {
  const p = path.join(ARCH, name);
  if (!fs.existsSync(p)) { warn(`Não encontrado: ${name}`); return ''; }
  return fs.readFileSync(p, 'utf8');
}

// Separar ficheiro em secções pelo marcador // ═══...═══
// e identificar cada secção pelo comentário // Ficheiro: caminho
function getSections(content) {
  const divider = /\/\/ [=═]{20,}/g;
  const parts   = content.split(divider).filter(s => s.trim().length > 50);
  return parts;
}

function getSectionPath(section) {
  const m = section.match(/\/\/ Ficheiro:\s*(.+)/);
  return m ? m[1].trim() : null;
}

function placeSections(content, fallback) {
  const sections = getSections(content);
  let placed = false;
  for (const s of sections) {
    const fp = getSectionPath(s);
    if (fp && !fp.includes('ACCEPTANCE') && !fp.includes('presets')) {
      writeFile(fp, s);
      placed = true;
    }
  }
  if (!placed && fallback) writeFile(fallback, content);
}

// ══════════════════════════════════════════════════════════════

console.log('');
console.log('╔════════════════════════════════════════════════╗');
console.log('║  Nexora — Organização de ficheiros (Node.js)  ║');
console.log('╚════════════════════════════════════════════════╝');

// ── 1. QC Rules ───────────────────────────────────────────────
step('1/11 — QC Rules Engine');
writeFile('src/qc/rules/index.ts', readArq('nexora_qc_rules.ts'));

// ── 2. FFmpeg executor + builder + parser ─────────────────────
step('2/11 — FFmpeg (executor + builder + parser)');
placeSections(readArq('nexora_ffmpeg_executor.ts'), 'src/pipeline/ffmpeg/executor.ts');

// ── 3. Audio worker + Transcode worker + GPU detector ─────────
step('3/11 — Workers: audio + transcode + gpu');
placeSections(readArq('nexora_audio_worker.ts'), 'src/workers/audio.worker.ts');

// ── 4. QC worker + Ingest + Proxy + Delivery + QC-Post ────────
step('4/11 — Workers: qc + ingest + proxy + delivery + qc-post');
placeSections(readArq('nexora_qc_worker.ts'), 'src/workers/qc.worker.ts');

// ── 5. Tool availability + Subtitle worker ────────────────────
step('5/11 — Tools: availability checker + subtitle worker');
placeSections(readArq('nexora_tool_availability.ts'), 'src/pipeline/tools/availability-checker.ts');

// Nexora presets JSON
writeFile('nexora-presets.json', JSON.stringify({
  PresetList: [
    {
      PresetName: "NexoraProxyLowRes",
      Type: 1, FileFormat: "av_mp4", Mp4HttpOptimize: true,
      VideoEncoder: "x264", VideoPreset: "veryfast",
      VideoProfile: "high", VideoLevel: "3.1",
      VideoQualityType: 1, VideoAvgBitrate: 800,
      VideoTwoPass: true, VideoTurboTwoPass: true,
      PictureWidth: 1280, PictureHeight: 720, PictureKeepRatio: true,
      AudioList: [{ AudioEncoder: "copy:aac", AudioFallbackEncoder: "av_aac",
        AudioBitrate: 128, AudioSamplerate: "48", AudioMixdown: "stereo" }],
      ChapterMarkers: false
    },
    {
      PresetName: "NexoraWebOptimized1080p",
      Type: 1, FileFormat: "av_mp4", Mp4HttpOptimize: true,
      VideoEncoder: "x264", VideoPreset: "slow",
      VideoProfile: "high", VideoLevel: "4.0",
      VideoQualityType: 1, VideoAvgBitrate: 4000, VideoTwoPass: true,
      PictureWidth: 1920, PictureHeight: 1080,
      AudioList: [{ AudioEncoder: "av_aac", AudioBitrate: 192,
        AudioSamplerate: "48", AudioMixdown: "stereo" }],
      ChapterMarkers: false
    }
  ]
}, null, 2));

// ── 6. Temporal workflow + Decision Engine + Analyzer ─────────
step('6/11 — Pipeline: temporal workflow + decision engine + analyzer');
placeSections(readArq('nexora_temporal_workflow.ts'), 'src/pipeline/orchestrator.ts');

// ── 7. Temporal activities + worker + client ──────────────────
step('7/11 — Pipeline: activities + temporal worker + client');
placeSections(readArq('nexora_temporal_activities.ts'), 'src/pipeline/activities.ts');

// ── 8. API routes + middleware ────────────────────────────────
step('8/11 — API: routes + middleware');
placeSections(readArq('nexora_api_routes.ts'), 'src/api/routes/assets.ts');

// ── 9. DB: prisma client + queues + observability ─────────────
step('9/11 — DB: prisma client + queues + observability');
placeSections(readArq('nexora_prisma_schema_full.ts'), 'src/db/prisma.ts');

// Schema Prisma real
const migContent = readArq('nexora_prisma_migration.md');
if (migContent) {
  const schemaMatcher = /```prisma\r?\n([\s\S]*?)```/;
  const schemaMatch   = migContent.match(schemaMatcher);
  if (schemaMatch) writeFile('prisma/schema.prisma', schemaMatch[1]);

  const sqlMatcher = /```sql\r?\n([\s\S]*?)```/;
  const sqlMatch   = migContent.match(sqlMatcher);
  if (sqlMatch) writeFile('prisma/migrations/audit_rls.sql', sqlMatch[1]);
}

// Ficheiros do readme_final (src/observability/*, prisma/seed.ts, etc.)
const readmeFinal = readArq('nexora_readme_final.md');
if (readmeFinal) {
  // Extrair blocos: ## src/caminho/ficheiro.ts seguido de ```typescript ... ```
  const blockRe = /## (src\/[^\r\n]+)\r?\n\r?\n```typescript\r?\n([\s\S]*?)```/g;
  let m;
  while ((m = blockRe.exec(readmeFinal)) !== null) {
    writeFile(m[1].trim(), m[2]);
  }
}

// ── 10. Segurança + Testes ────────────────────────────────────
step('10/11 — Segurança + Testes');
placeSections(readArq('nexora_playwright_security.ts'), 'src/api/security.ts');

writeFile('tests/unit/qc-rules.test.ts',         readArq('nexora_unit_tests.ts'));
placeSections(readArq('nexora_integration_test.ts'), 'tests/integration/pipeline.test.ts');

// playwright.config.ts
writeFile('playwright.config.ts', `import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
`);

// ── 11. Frontend ──────────────────────────────────────────────
step('11/11 — Frontend');

// package.json frontend
writeFile('frontend/package.json', JSON.stringify({
  name: "nexora-frontend", version: "0.1.0", private: true,
  scripts: { dev: "next dev", build: "next build", start: "next start",
             lint: "next lint", "test:e2e": "playwright test" },
  dependencies: {
    "next": "14.2.0", "react": "^18.3.0", "react-dom": "^18.3.0",
    "@tanstack/react-query": "^5.32.0", "zustand": "^4.5.0",
    "recharts": "^2.12.0", "react-hook-form": "^7.51.0",
    "zod": "^3.22.0", "@hookform/resolvers": "^3.3.0",
    "nuqs": "^1.17.0", "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0", "lucide-react": "^0.378.0",
    "date-fns": "^3.6.0"
  },
  devDependencies: {
    "@types/react": "^18.3.0", "@types/react-dom": "^18.3.0",
    "@types/node": "^20.12.0", "typescript": "^5.4.0",
    "tailwindcss": "^3.4.0", "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0", "@playwright/test": "^1.44.0"
  }
}, null, 2));

// tsconfig frontend
writeFile('frontend/tsconfig.json', JSON.stringify({
  compilerOptions: {
    target: "es5", lib: ["dom","dom.iterable","esnext"],
    allowJs: true, skipLibCheck: true, strict: true, noEmit: true,
    esModuleInterop: true, module: "esnext", moduleResolution: "bundler",
    resolveJsonModule: true, isolatedModules: true, jsx: "preserve",
    incremental: true, plugins: [{ name: "next" }],
    paths: { "@/*": ["./src/*"] }
  },
  include: ["next-env.d.ts","**/*.ts","**/*.tsx",".next/types/**/*.ts"],
  exclude: ["node_modules"]
}, null, 2));

// next.config.js
writeFile('frontend/next.config.js',
`/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: { NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000' }
}
module.exports = nextConfig
`);

// tailwind + postcss
writeFile('frontend/tailwind.config.ts',
`import type { Config } from 'tailwindcss'
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: []
}
export default config
`);

writeFile('frontend/postcss.config.js',
`module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } }
`);

// globals.css
writeFile('frontend/src/app/globals.css',
`@tailwind base;
@tailwind components;
@tailwind utilities;
:root { --font-sans: system-ui, sans-serif; --font-mono: monospace; }
* { scrollbar-width: thin; scrollbar-color: #404040 transparent; }
html { color-scheme: dark; }
body { min-height: 100vh; }
`);

// Extrair componentes frontend dos .ts
for (const fname of ['nexora_frontend_core.ts', 'nexora_frontend_upload.ts']) {
  const content = readArq(fname);
  if (!content) continue;
  const sections = getSections(content);
  for (const s of sections) {
    const fp = getSectionPath(s);
    if (fp && fp.startsWith('frontend/')) writeFile(fp, s);
  }
}

// ── Ficheiros de infra (Dockerfiles extraídos do .md) ─────────
const dockerMd = readArq('nexora_dockerfile.md');
if (dockerMd) {
  // Extrair Dockerfile (bloco após "## Dockerfile (raiz")
  const dfMatch = dockerMd.match(/## Dockerfile \(raiz[^)]*\)[^\n]*\n\n```dockerfile\n([\s\S]*?)```/);
  if (dfMatch) writeFile('Dockerfile', dfMatch[1]);

  // Extrair Dockerfile.worker
  const dfwMatch = dockerMd.match(/## Dockerfile\.worker[^\n]*\n\n```dockerfile\n([\s\S]*?)```/);
  if (dfwMatch) writeFile('Dockerfile.worker', dfwMatch[1]);

  // Extrair GitHub Actions YAMLs
  const yamlRe = /## \.github\/workflows\/([^\n]+)\n\n```yaml\n([\s\S]*?)```/g;
  let ym;
  while ((ym = yamlRe.exec(dockerMd)) !== null) {
    writeFile(`.github/workflows/${ym[1].trim()}`, ym[2]);
  }

  // .prettierrc
  const prMatch = dockerMd.match(/## \.prettierrc\n\n```json\n([\s\S]*?)```/);
  if (prMatch) writeFile('.prettierrc', prMatch[1]);

  // .eslintrc.json
  const esMatch = dockerMd.match(/## \.eslintrc\.json\n\n```json\n([\s\S]*?)```/);
  if (esMatch) writeFile('.eslintrc.json', esMatch[1]);

  // vitest.config.ts
  const vtMatch = dockerMd.match(/## vitest\.config\.ts\n\n```typescript\n([\s\S]*?)```/);
  if (vtMatch) writeFile('vitest.config.ts', vtMatch[1]);
}

// ── Resumo ─────────────────────────────────────────────────────
console.log('');
console.log('╔══════════════════════════════════════════════════╗');
console.log(`║  ✓ Concluído! ${created} ficheiros criados.`.padEnd(51) + '║');
console.log('╠══════════════════════════════════════════════════╣');
console.log('║  PRÓXIMOS PASSOS:                               ║');
console.log('║  1. copy .env.example .env                      ║');
console.log('║  2. npm install                                  ║');
console.log('║  3. docker compose up -d                         ║');
console.log('║  4. npm run db:migrate                           ║');
console.log('║  5. Abrir Antigravity → Prompt 1 (Claude)       ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log('');
