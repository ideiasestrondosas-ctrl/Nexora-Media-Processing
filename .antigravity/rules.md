# Nexora Media Processing — Regras Globais de Desenvolvimento

> Lido automaticamente pelo Google Antigravity antes de qualquer interacção de IA.
> Aplica-se a TODOS os agentes: Claude, Gemini, ChatGPT.

## REGRA 0 — Lê o PROGRESS.md primeiro

ANTES de qualquer trabalho, lê o ficheiro `PROGRESS.md` na raiz do projecto.
Não é opcional. Não é "se tiveres tempo".

## REGRA 1 — Actualiza o PROGRESS.md no fim

No fim de cada resposta que crie ou modifique código, actualiza o PROGRESS.md:
- Marca [x] nos itens concluídos
- Actualiza "Em progresso agora"
- Adiciona linha ao histórico de sessões

## REGRA 2 — Nunca refaças trabalho marcado como concluído

Se um item está marcado [x] no PROGRESS.md, não o refaças nem sobrescrevas.

## REGRA 3 — ADRs são imutáveis

Ver lista no PROGRESS.md. As decisões ADR-001 a ADR-010 não podem ser revertidas.

Exemplos do que NÃO deves fazer:
- exec(`ffmpeg ${param}`) ← ADR-002 proíbe
- createHash('md5') ← ADR-003 proíbe
- prisma.auditLog.update() ← ADR-007 proíbe
- JWT com HS256 em produção ← ADR-008 proíbe

## REGRA 4 — TypeScript strict, sem any implícito

## REGRA 5 — Parâmetros FFmpeg broadcast obrigatórios

Sempre incluir em comandos broadcast:
  -g [fps*2] -keyint_min [fps*2] -sc_threshold 0 -flags +cgop
  -x264-params "open-gop=0:bframes=0" -bf 0 -pix_fmt yuv420p -movflags +faststart

## REGRA 6 — Língua

- Código: inglês
- Comentários no código: português de Portugal
- Mensagens de erro para utilizador: português de Portugal
- Commits Git: português de Portugal

## CONTEXTO DO PROJECTO

Nexora Media Processing é uma plataforma de transcoding de vídeo profissional.
Pipeline: Ingest → QC pré → Análise → Transcode + Áudio → Proxy → QC pós → Delivery
Stack: Node.js 20 + TypeScript + Fastify + BullMQ + Redis + PostgreSQL + MinIO + Temporal.io
Media tools: FFmpeg · HandBrake · MediaInfo · FFprobe · MediaConch · BS1770GAIN
