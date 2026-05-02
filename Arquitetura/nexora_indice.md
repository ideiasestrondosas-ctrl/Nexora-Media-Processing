# Nexora Media Processing — Índice de Ficheiros

> Mapa completo: o que existe em `arquitetura\` e para onde vai cada ficheiro no projecto.
> O script `nexora-mover-tudo.ps1` faz isto automaticamente.

---

## Ficheiros na pasta `arquitetura\` → Destino no projecto

| Ficheiro em `arquitetura\` | Cria estes ficheiros no projecto |
|---|---|
| `nexora_antigravity_rules.md` | `.antigravity/rules.md` |
| `nexora_api_routes.ts` | `src/api/routes/assets.ts` · `src/api/routes/jobs.ts` · `src/api/middleware/auth.ts` · `src/api/middleware/rateLimiter.ts` · `src/api/plugins.ts` |
| `nexora_audio_worker.ts` | `src/workers/audio.worker.ts` · `src/workers/transcode.worker.ts` · `src/pipeline/gpu-detector.ts` |
| `nexora_deploy_files_script.js` | `scripts/nexora-deploy-docs.js` ← **renomear ao copiar** |
| `nexora_dockerfile.md` | `Dockerfile` · `Dockerfile.worker` · `.github/workflows/test.yml` · `.github/workflows/build.yml` · `.github/workflows/deploy-staging.yml` · `.prettierrc` · `.eslintrc.json` · `vitest.config.ts` |
| `nexora_ffmpeg_executor.ts` | `src/pipeline/ffmpeg/executor.ts` · `src/pipeline/ffmpeg/builder.ts` · `src/pipeline/ffmpeg/parser.ts` |
| `nexora_final_scaffold_update.js` | `scripts/nexora-finalize.js` ← **renomear ao copiar** |
| `nexora_frontend_core.ts` | `frontend/src/app/layout.tsx` · `frontend/src/app/(dashboard)/layout.tsx` · `frontend/src/app/(dashboard)/page.tsx` · `frontend/src/app/(dashboard)/assets/page.tsx` · `frontend/src/app/(dashboard)/assets/[id]/page.tsx` · `frontend/src/components/ui/status-badge.tsx` · `frontend/src/components/ui/vmaf-gauge.tsx` · `frontend/src/hooks/useAssetStatusSSE.ts` · `frontend/src/lib/api.ts` · `frontend/src/components/providers.tsx` |
| `nexora_frontend_upload.ts` | `frontend/src/components/assets/upload-modal.tsx` · `frontend/src/app/(dashboard)/queue/page.tsx` · `frontend/src/components/layout/sidebar.tsx` · `frontend/src/components/layout/topbar.tsx` · `frontend/src/components/assets/assets-table.tsx` · `frontend/src/components/assets/asset-filters.tsx` · `frontend/src/components/dashboard/metric-card.tsx` · `frontend/src/components/dashboard/recent-activity.tsx` |
| `nexora_integration_test.ts` | `tests/integration/pipeline.test.ts` · `tests/performance/load-test.js` |
| `nexora_master_doc_part1.md` | Documentação — fica em `arquitetura\` |
| `nexora_master_doc_part2.md` | Documentação — fica em `arquitetura\` |
| `nexora_playwright_security.ts` | `tests/e2e/upload-flow.spec.ts` · `src/api/security.ts` · `playwright.config.ts` · `docs/ACCEPTANCE_CHECKLIST.md` · `scripts/nexora-generate-keys.ts` |
| `nexora_prisma_migration.md` | `prisma/schema.prisma` (real) · `prisma/migrations/audit_rls.sql` |
| `nexora_prisma_schema_full.ts` | `src/db/prisma.ts` · `src/workers/queues.ts` |
| `nexora_progress_template.md` | `PROGRESS.md` |
| `nexora_qc_rules.ts` | `src/qc/rules/index.ts` |
| `nexora_qc_worker.ts` | `src/workers/qc.worker.ts` · `src/workers/ingest.worker.ts` · `src/workers/proxy.worker.ts` · `src/workers/delivery.worker.ts` · `src/workers/qc-post.worker.ts` |
| `nexora_readme_final.md` | `src/index.ts` · `src/worker.ts` · `src/health-worker.ts` · `src/observability/logger.ts` · `src/observability/metrics.ts` · `prisma/seed.ts` · `tsconfig.build.json` · `.env.test` |
| `nexora_temporal_activities.ts` | `src/pipeline/activities.ts` · `src/pipeline/temporal-worker.ts` · `src/pipeline/temporal-client.ts` |
| `nexora_temporal_workflow.ts` | `src/pipeline/orchestrator.ts` · `src/pipeline/decision-engine.ts` · `src/workers/analyzer.worker.ts` |
| `nexora_tool_availability.ts` | `src/pipeline/tools/availability-checker.ts` · `src/workers/subtitle.worker.ts` · `nexora-presets.json` |
| `nexora_unit_tests.ts` | `tests/unit/qc-rules.test.ts` |

---

## Ficheiros criados pelos scripts de scaffold

Estes ficheiros **não existem em `arquitetura\`** — são criados automaticamente pelos scripts:

| Script | Ficheiros criados |
|---|---|
| `nexora-scaffold.js` | `package.json` · `tsconfig.json` · `tsconfig.build.json` · `.gitignore` · `.env.example` · `docker-compose.yml` · `src/index.ts` · `src/worker.ts` · `prisma/schema.prisma` (base) · `tests/setup.ts` · `.env.test` · `tests/fixtures/generate-fixtures.sh` · `README.md` · `.vscode/settings.json` · Todas as pastas |
| `nexora-deploy-docs.js` | `PROGRESS.md` · `.antigravity/rules.md` · `.antigravity/settings.json` · `.vscode/settings.json` · `docs/adr/ADR-001.md` a `ADR-010.md` · `config/prometheus/prometheus.yml` · `config/grafana/provisioning/` |
| `nexora-finalize.js` | `Dockerfile` · `Dockerfile.worker` · `.github/workflows/*.yml` · `.prettierrc` · `.eslintrc.json` · `vitest.config.ts` · `README.md` (final) |
| `nexora-mover-tudo.ps1` | **Todos os ficheiros acima** + os que vêm dos `.ts` da pasta `arquitetura\` |

---

## Sequência de execução (resumo)

```
PowerShell (como Administrador):

cd "C:\Dev\Nexora Media Processing"

# Passo 1 — Instalar ferramentas (Node.js, Docker, FFmpeg...)
Set-ExecutionPolicy Bypass -Scope Process -Force
.\arquitetura\nexora-setup.ps1

# Passo 2 — Criar estrutura de pastas e ficheiros base
node arquitetura\nexora-scaffold.js

# Passo 3 — Criar docs, ADRs, Prometheus, Grafana
node arquitetura\nexora-deploy-docs.js

# Passo 4 — Criar Dockerfiles, GitHub Actions, configs de código
node arquitetura\nexora-finalize.js

# Passo 5 — Mover todos os ficheiros de código para as directorias certas
.\nexora-mover-tudo.ps1

# Passo 6 — Configurar ambiente
copy .env.example .env
# Abre .env e edita as passwords

# Passo 7 — Instalar dependências Node.js
npm install

# Passo 8 — Iniciar serviços Docker
docker compose up -d

# Passo 9 — Aguardar e aplicar migrações
Start-Sleep 30
npm run db:migrate
npm run db:seed

# Passo 10 — Abrir no Antigravity e começar os Prompts!
```

---

## Notas importantes

1. **O script `nexora-mover-tudo.ps1` só funciona DEPOIS** dos passos 2, 3 e 4 (scaffold + deploy-docs + finalize), porque precisa das pastas já criadas.

2. **Os ficheiros `.ts` na pasta `arquitetura\`** contêm múltiplas secções separadas por comentários do tipo `// ════════...`. O script PowerShell separa-os automaticamente.

3. **Após o passo 5**, a pasta `arquitetura\` pode ficar como está — serve de referência mas já não é necessária para o projecto correr.

4. **O Antigravity lê `.antigravity/rules.md`** automaticamente antes de qualquer sessão de IA — garante que o Claude, Gemini e ChatGPT lêem sempre o `PROGRESS.md` antes de trabalhar.
