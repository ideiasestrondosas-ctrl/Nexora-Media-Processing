# Nexora Media Processing — Regras Globais de Desenvolvimento

> Este ficheiro é lido automaticamente pelo Google Antigravity antes de qualquer
> interacção de IA neste workspace. Aplica-se a TODOS os agentes: Claude, Gemini, ChatGPT.

---

## REGRA 0 — Lê o PROGRESS.md primeiro

**ANTES de qualquer trabalho, lê o ficheiro `PROGRESS.md` na raiz do projecto.**

Isto é obrigatório. Não é opcional. Não é "se tiveres tempo".

O PROGRESS.md diz-te:
- O que já foi feito (não refaças)
- O que está em progresso (não duplica)
- As decisões de arquitectura tomadas (não reverte)
- Os problemas conhecidos (não ignora)
- O que fazer a seguir (segue a ordem)

---

## REGRA 1 — Actualiza o PROGRESS.md no fim

**No fim de cada resposta que crie ou modifique código, actualiza o PROGRESS.md:**

```
- Marca [x] nos itens concluídos
- Actualiza "Em progresso agora"
- Adiciona ficheiros criados à estrutura
- Adiciona linha ao histórico de sessões
- Regista problemas encontrados
```

Se não actualizares o PROGRESS.md, o próximo agente não sabe o que fizeste.

---

## REGRA 2 — Nunca refaças trabalho marcado como concluído

Se um item está marcado com `[x]` no PROGRESS.md:
- **Não o refaças**
- **Não o sobrescrevas**
- **Não o "melhoresses" sem perguntar**

Se precisas de modificar algo já concluído, pergunta primeiro e explica porquê.

---

## REGRA 3 — ADRs são imutáveis

As decisões listadas nos ADRs do PROGRESS.md **não podem ser revertidas**.

Exemplos do que NÃO deves fazer:
- ❌ Usar `exec()` com string para chamar FFmpeg (ADR-002 proíbe)
- ❌ Usar MD5 para checksums (ADR-003 proíbe)
- ❌ Fazer UPDATE ou DELETE na tabela audit_logs (ADR-007 proíbe)
- ❌ Usar HS256 para JWT em produção (ADR-008 proíbe)

Se precisares de uma excepção, cria um novo ADR e pede aprovação.

---

## REGRA 4 — Escreve código TypeScript strict

```typescript
// ✅ Correcto
async function processAsset(assetId: string): Promise<ProcessingResult> {
  // ...
}

// ❌ Errado — sem tipos
async function processAsset(assetId) {
  // ...
}

// ❌ Errado — any implícito
catch (e: any) { ... }

// ✅ Correcto
catch (error) {
  if (error instanceof NexoraError) { ... }
}
```

---

## REGRA 5 — FFmpeg só via execFile/spawn

```typescript
// ✅ Correcto
import { execFile } from 'child_process';
execFile('ffmpeg', ['-i', inputPath, ...params, outputPath], options, callback);

// ❌ PROIBIDO — command injection possível
exec(`ffmpeg -i ${inputPath} ${outputPath}`);
```

---

## REGRA 6 — Checksums são sempre SHA-256

```typescript
// ✅ Correcto
import { createHash } from 'crypto';
const hash = createHash('sha256').update(data).digest('hex');

// ❌ PROIBIDO
const hash = createHash('md5').update(data).digest('hex');
```

---

## REGRA 7 — Audit trail é append-only

```typescript
// ✅ Correcto — apenas INSERT
await prisma.auditLog.create({ data: { ... } });

// ❌ PROIBIDO
await prisma.auditLog.update({ ... });
await prisma.auditLog.delete({ ... });
await prisma.auditLog.deleteMany({ ... });
```

---

## REGRA 8 — Parâmetros FFmpeg broadcast obrigatórios

Todo o comando FFmpeg para perfil broadcast DEVE incluir:

```bash
-g [fps*2]          # GOP = 2 segundos
-keyint_min [fps*2] # Keyframe interval mínimo
-sc_threshold 0     # Sem keyframes em scene cuts
-flags +cgop        # Closed GOP
-x264-params "open-gop=0:bframes=0"  # Para H.264
-bf 0               # Sem B-frames
-pix_fmt yuv420p    # Pixel format obrigatório
-movflags +faststart # Fast Start para MP4
```

---

## REGRA 9 — Dois agentes não trabalham no mesmo ficheiro em simultâneo

Se o Gemini está a trabalhar em `frontend/src/components/`, o Claude não deve
modificar esses ficheiros até o Gemini terminar e marcar no PROGRESS.md.

Para coordenação, usa comentários no PROGRESS.md na secção "Em progresso agora".

---

## REGRA 10 — Lingua e formatação

- **Código:** em inglês (variáveis, funções, classes)
- **Comentários no código:** em português de Portugal
- **Mensagens de erro para utilizador:** em português de Portugal
- **Mensagens de log:** em inglês (para compatibilidade com ferramentas)
- **Commits Git:** em português de Portugal, descritivos

```typescript
// ✅ Exemplo correcto
// Verificar se o GOP está conforme o standard broadcast
function validateGOP(metadata: VideoMetadata): QCResult {
  // GOP tem de ser exactamente fps * 2
  const expectedGOP = Math.round(metadata.frameRate) * 2;
  ...
}
```

---

## CONTEXTO DO PROJECTO (resumo para IA)

```
Nexora Media Processing é uma plataforma de transcoding de vídeo profissional.
Recebe ficheiros de media, valida-os (QC), processa-os (transcode, normalização
de áudio, legendas, proxies) e entrega-os em formatos broadcast/OTT.

Pipeline: Ingest → QC pré → Análise → Transcode + Áudio (paralelo) →
          Proxy + Thumbnails → QC pós → Delivery

Stack: Node.js 20 + TypeScript + Fastify + BullMQ + Redis + PostgreSQL +
       MinIO + Temporal.io + Next.js 14

Media tools: FFmpeg (principal) · HandBrake (proxies) · MediaInfo · FFprobe ·
             MediaConch (conformance) · BS1770GAIN (loudness verify) · libvmaf

Standards: EBU R128 (loudness) · AS-11 (broadcast EU) · CMAF (streaming) ·
           IMF (OTT masters) · Harding FPA (flash safety)
```

---

*Versão: 1.0 | Nexora Media Processing*
