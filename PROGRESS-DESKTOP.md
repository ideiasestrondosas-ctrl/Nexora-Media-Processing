# Nexora Media Processing — Desktop Nativo — Estado do Projecto

> **⚠️ LEITURA OBRIGATÓRIA PARA TODOS OS AGENTES IA**
>
> Este ficheiro DEVE ser lido ANTES de qualquer trabalho no módulo Desktop.
> DEVE ser actualizado no FIM de cada sessão de desenvolvimento.
> Existe para reduzir tokens, evitar retrabalho, e manter consistência.
>
> **Documento de referência:** `arquitetura/nexora-desktop-documento.md`

---

## 📋 Identidade

| Campo | Valor |
|---|---|
| **Nome** | Nexora Media Processing — Desktop Nativo |
| **Versão** | 0.1.0 |
| **IDE** | Google Antigravity (fork VS Code com Gemini, Claude, ChatGPT) |
| **Stack Shell** | Tauri 2.x (Rust) |
| **Stack Frontend** | React 18 + TypeScript + Tailwind CSS + Zustand |
| **Stack Sidecar** | Node.js 20 + TypeScript + esbuild |
| **Base de dados** | SQLite via better-sqlite3 |
| **Media tools** | FFmpeg · FFprobe · MediaInfo · BS1770GAIN · MediaConch · HandBrakeCLI |
| **Build** | GitHub Actions (Tauri Action) |
| **Plataformas alvo** | Windows x64 · macOS Universal (Intel+ARM) · Linux x64 |
| **Relação com Server** | Módulo separado, mesma base de qualidade e standards |

---

## ✅ O que está concluído

### Fase 0 — Documentação e Arquitectura
- [x] Documento de especificação Desktop criado (nexora-desktop-documento.md)
- [x] PROGRESS-DESKTOP.md criado
- [x] ADRs Desktop definidos (ADR-D001 a ADR-D012)
- [x] Estrutura de directórios definida
- [x] Prompts Desktop 1-4 redigidos
- [x] Checklist de aceitação definida
- [x] Mapeamento funcional Cloud → Desktop documentado

### Fase 1 — Setup do Ambiente
- [ ] Script nexora-desktop-setup.sh/ps1 executado
- [ ] Node.js 20 instalado e verificado
- [ ] Rust (stable) instalado e verificado
- [ ] Git instalado e verificado
- [ ] FFmpeg instalado e verificado (para testes)
- [ ] Dependências Tauri instaladas (libwebkit2gtk no Linux, Xcode CLI no macOS, VS Build Tools no Windows)

### Fase 2 — Estrutura do Projecto
- [ ] Projecto Tauri criado (npm create tauri-app)
- [ ] Dependências npm instaladas (zustand, better-sqlite3, esbuild, concurrently)
- [ ] Pastas criadas (sidecar/, src-tauri/binaries/, tests/)
- [ ] tauri.conf.json configurado

### Fase 3 — Prompt Desktop 1 (Tauri + SQLite + IPC)
- [ ] tauri.conf.json completo com bundle, icons, externalBin
- [ ] schema.sql criado com todas as tabelas
- [ ] migrations.rs implementado (auto-migration no startup)
- [ ] commands/assets.rs (ingest_asset, list_assets, get_asset)
- [ ] commands/jobs.rs (submit_job, cancel_job, get_job_status)
- [ ] commands/settings.rs (get_settings, update_settings)
- [ ] commands/system.rs (detect_gpu, get_disk_space, get_app_version)
- [ ] tray.rs (system tray com menu contextual)
- [ ] sidecar.rs (gestão do processo Node.js)

### Fase 4 — Prompt Desktop 2 (Sidecar + Queue + Orchestrator + Workers)
- [ ] NexoraSimpleQueue implementado (memória + SQLite, prioridades, retry)
- [ ] NexoraDesktopOrchestrator implementado (idempotente, step-by-step)
- [ ] ingest-worker.ts
- [ ] qc-pre-worker.ts
- [ ] transcode-worker.ts (GPU auto-detect, todos os perfis)
- [ ] audio-worker.ts (two-pass R128 + BS1770GAIN verificação)
- [ ] proxy-worker.ts
- [ ] thumbnail-worker.ts
- [ ] qc-post-worker.ts (VMAF, SHA-256, MediaConch)
- [ ] delivery-worker.ts (mover + notificação + audit log)
- [ ] 6 perfis de transcode JSON criados
- [ ] Comunicação sidecar ↔ Tauri via stdout/JSON funcional

### Fase 5 — Prompt Desktop 3 (Frontend React)
- [ ] App.tsx com navegação por tabs (Processar, Histórico, Definições)
- [ ] DropZone.tsx (drag-and-drop + file dialog)
- [ ] JobCard.tsx + ProgressBar.tsx
- [ ] NexoraStatusBadge.tsx + VMAFGauge.tsx
- [ ] ProcessPage.tsx (drop zone + jobs activos)
- [ ] HistoryPage.tsx (assets processados + filtros)
- [ ] SettingsPage.tsx (todas as definições)
- [ ] useTauriCommand.ts hook
- [ ] useJobStatus.ts hook (polling 1s)
- [ ] useNotification.ts hook
- [ ] useGPU.ts hook
- [ ] Stores Zustand (jobs, settings, assets)
- [ ] Tema claro/escuro funcional
- [ ] Paleta Nexora aplicada (#1A6FD4, #4FB8A0)

### Fase 6 — Prompt Desktop 4 (Build + Testes + Distribuição)
- [ ] build-desktop.yml (GitHub Actions 3 plataformas)
- [ ] download-media-binaries.js funcional
- [ ] generate-fixtures.sh (ficheiros de teste)
- [ ] queue.test.ts
- [ ] orchestrator.test.ts
- [ ] workers.test.ts
- [ ] package.json com todos os scripts
- [ ] README-DESKTOP.md
- [ ] Auto-updater configurado

### Fase 7 — Integração e Validação Final
- [ ] Testar localmente (tauri dev) — funcional em 3 plataformas
- [ ] Testes unitários passam (>80% cobertura)
- [ ] Build funciona para Windows (.exe)
- [ ] Build funciona para macOS (.dmg universal)
- [ ] Build funciona para Linux (.AppImage + .deb)
- [ ] Checklist de aceitação completa (PARTE 11 do documento)
- [ ] GitHub Release criado com artefactos das 3 plataformas

---

## 🔄 Em progresso agora

```
Data:          ___________
Agente:        ___________
A trabalhar em: ___________
Bloqueios:     ___________
```

---

## 📁 Estrutura de ficheiros actual

```
nexora-desktop/           ← actualiza à medida que cresce
├── (scaffold inicial a criar — ver Fase 2)
```

---

## ⚠️ Problemas conhecidos

| Data | Problema | Estado |
|---|---|---|
| — | Nenhum registado | — |

---

## 🏗️ ADRs Desktop (Imutáveis)

| ADR | Decisão | Justificação |
|---|---|---|
| ADR-D001 | Tauri 2.x como shell nativa | Instalador 10x menor, RAM 6x menor que Electron |
| ADR-D002 | Node.js sidecar para lógica media | Reutiliza workers do Server sem duplicação |
| ADR-D003 | SQLite como única base de dados | Zero configuração, ficheiro local, backup trivial |
| ADR-D004 | Fila em memória + SQLite | Substituição simples do BullMQ+Redis |
| ADR-D005 | Orchestrator local step-by-step | Substituição simples do Temporal.io |
| ADR-D006 | Binários media incluídos no instalador | Zero dependências para o utilizador |
| ADR-D007 | GPU auto-detectada no startup | NVENC/AMF/QSV sem config manual |
| ADR-D008 | Notificações nativas do SO | Substituição de webhooks HTTP |
| ADR-D009 | Auto-updater via Tauri built-in | Updates automáticos |
| ADR-D010 | Mesmos parâmetros FFmpeg que Server | Compatibilidade de outputs |
| ADR-D011 | IPC via Tauri Commands | Sem servidor HTTP local |
| ADR-D012 | Deep links nexora:// | Integração nativa com SO |

---

## 📅 Histórico de sessões

> Nunca apagar linhas antigas. Adicionar sempre no final.

| Data | O que foi feito | Agente usado | Ficheiros criados/modificados |
|---|---|---|---|
| 2026-05-02 | Documentação Desktop criada, PROGRESS-DESKTOP.md criado, ADRs definidos, Prompts 1-4 redigidos | Claude Opus | nexora-desktop-documento.md, PROGRESS-DESKTOP.md |

---

## 🎯 Próximos passos (ordenados por prioridade)

1. [ ] Executar script de setup: `bash scripts/nexora-desktop-setup.sh` (ou `.ps1` no Windows)
2. [ ] Criar projecto Tauri: `npm create tauri-app@latest nexora-desktop -- --template react-ts`
3. [ ] Instalar dependências: `npm install zustand better-sqlite3 esbuild concurrently`
4. [ ] Executar **Prompt Desktop 1** (agente: Claude/Gemini) — Tauri + SQLite + IPC
5. [ ] Executar **Prompt Desktop 2** (agente: Claude) — Sidecar + Workers
6. [ ] Executar **Prompt Desktop 3** (agente: Claude/Gemini) — Frontend React
7. [ ] Executar **Prompt Desktop 4** (agente: Claude) — Build + Testes
8. [ ] Descarregar binários: `npm run download:binaries`
9. [ ] Testar: `npm run dev`
10. [ ] Build final + tag + GitHub Release

---

## 📐 Contexto técnico rápido (para agentes IA)

> Lê isto antes de gerar código para não introduzir inconsistências.

**Portas em uso (desenvolvimento):**
- 1420 → Vite dev server (frontend React)
- Sem servidor HTTP em produção (IPC directo Tauri)

**Convenções de código:**
- TypeScript strict mode — sem `any` implícito
- Nomes em inglês no código, comentários em português
- Imports absolutos via paths aliases (`@/components/`, `@/hooks/`, etc.)
- Todos os erros são typed (nunca `catch(e: any)`)
- Todos os IDs são UUID v4
- FFmpeg SEMPRE via execFile (NUNCA exec com string concatenada)
- Parâmetros FFmpeg: sempre arrays, nunca strings

**Limites de recursos:**
- Max jobs simultâneos: configurável (default 2, max 4)
- FFmpeg timeout: 4h (14400000ms)
- SQLite max size: sem limite prático
- Sidecar: 1 processo Node.js, multi-threaded via worker_threads se necessário

**Relação com o Server:**
- Mesmos perfis de transcode (JSON iguais)
- Mesmos parâmetros FFmpeg
- Mesmos thresholds VMAF (85/90/93)
- Mesmos targets LUFS (-23/-14) e True Peak (-1 dBTP)
- Código dos workers reutilizável (adaptação mínima para SQLite/sidecar)

---

*Este ficheiro é a fonte de verdade do projecto Desktop.*
*Em caso de dúvida, consulta aqui.*
*Última actualização: 2026-05-02 por Claude Opus*
