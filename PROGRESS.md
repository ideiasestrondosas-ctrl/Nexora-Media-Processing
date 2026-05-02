# Nexora Media Processing — Estado do Projecto

> **⚠️ LEITURA OBRIGATÓRIA PARA TODOS OS AGENTES IA**
> Este ficheiro deve ser lido ANTES de qualquer trabalho e actualizado no FIM de cada sessão.

---

## 📋 Identidade

| Campo | Valor |
|---|---|
| **Nome** | Nexora Media Processing |
| **Versão** | 0.1.0 |
| **IDE** | Google Antigravity |
| **Stack** | Node.js 20 + TypeScript + Fastify + BullMQ + Redis + PostgreSQL + MinIO |
| **Frontend** | Next.js 14 + React + Tailwind CSS |
| **Orquestração** | Temporal.io |
| **Media tools** | FFmpeg · HandBrakeCLI · MediaInfo · FFprobe · MediaConch · BS1770GAIN |

---

## ✅ O que está concluído

- [ ] Setup do ambiente (nexora-setup.sh executado)
- [ ] Scaffold do projecto (nexora-scaffold.js executado)
- [ ] PROGRESS.md criado
- [ ] .antigravity/rules.md criado
- [ ] Repositório GitHub configurado
- [ ] Prompt 1 executado (Backend Core — Claude)
- [ ] Prompt 5 executado (FFmpeg + Performance — Claude)
- [ ] Prompt 2 executado (API + Temporal — Claude)
- [ ] Prompt 6 executado (Docker + Infra — Claude)
- [ ] Prompt 3 executado (Frontend — Gemini)
- [ ] Prompt 4 executado (Logs/Debug — Claude)
- [ ] Prompt 7 executado (Segurança — Claude)
- [ ] Prompt 8 executado (Testes — Claude)
- [ ] Prompt 9 executado (Open Source adapters — Claude)
- [ ] Prompt 10 executado (Integração final — Claude)

---

## 🔄 Em progresso agora

```
Data: ___________
Agente: ___________
A trabalhar em: ___________
Bloqueios: ___________
```

---

## 📁 Estrutura de ficheiros

```
nexora-media-processing/   ← actualiza à medida que cresce
├── (scaffold inicial criado)
```

---

## ⚠️ Problemas conhecidos

| Data | Problema | Estado |
|---|---|---|
| — | Nenhum | — |

---

## 🏗️ ADRs Imutáveis

| ADR | Decisão |
|---|---|
| ADR-001 | Temporal.io para orquestração (não BullMQ standalone) |
| ADR-002 | FFmpeg via execFile/spawn (NUNCA exec() com string) |
| ADR-003 | SHA-256 para checksums (MD5 proibido) |
| ADR-004 | yuv420p obrigatório em outputs de distribuição |
| ADR-005 | Two-pass EBU R128 + BS1770GAIN verificação independente |
| ADR-006 | Closed GOP + IDR frames em todos os outputs broadcast |
| ADR-007 | Audit trail append-only (UPDATE/DELETE proibidos) |
| ADR-008 | RS256 JWT com rotação (HS256 proibido em produção) |
| ADR-009 | BS1770GAIN para verificação independente de loudness |
| ADR-010 | VMAF score calculado e guardado para todos os outputs |

---

## 📅 Histórico

| Data | Feito | Agente | Ficheiros |
|---|---|---|---|
| 2026-05-02 | Ficheiros de config criados | nexora-deploy-docs.js | PROGRESS.md, rules.md, ADRs |

---

## 🎯 Próximos passos

1. Executar Prompt 1 no Antigravity (agente: Claude)
2. Executar Prompt 5 no Antigravity (agente: Claude)
3. Executar Prompt 2 no Antigravity (agente: Claude)
4. Executar Prompt 6 no Antigravity (agente: Claude)
5. Executar Prompt 3 no Antigravity (agente: Gemini)

---

*Última actualização: 2026-05-02*
