#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// Nexora Media Processing — Deploy de Ficheiros de Documentação
// ═══════════════════════════════════════════════════════════════════
//
// O QUE FAZ ESTE SCRIPT:
//   Lê o documento técnico unificado (nexora-manual-v4.md) e cria
//   automaticamente todos os ficheiros de configuração e regras
//   nas directorias correctas do projecto.
//
//   Ficheiros criados:
//     PROGRESS.md                  → raiz do projecto
//     .antigravity/rules.md        → regras globais para todos os agentes IA
//     .antigravity/settings.json   → configuração do Antigravity
//     docs/adr/ADR-001.md a ADR-010.md → Architecture Decision Records
//     config/prometheus/prometheus.yml → configuração do Prometheus
//     config/grafana/dashboards/nexora-overview.json → dashboard Grafana
//     .vscode/settings.json        → configuração VS Code / Antigravity
//     .vscode/extensions.json      → extensões recomendadas
//
// COMO EXECUTAR:
//   node scripts/nexora-deploy-docs.js
//
// PRÉ-REQUISITOS:
//   Node.js 18+ instalado (node --version para verificar)
//   Estar na raiz do projecto nexora-media-processing
// ═══════════════════════════════════════════════════════════════════

const fs   = require('fs');
const path = require('path');

// ── Utilitários de output ──────────────────────────────────────────
const c = {
  reset: '\x1b[0m', green: '\x1b[32m',
  blue: '\x1b[34m', yellow: '\x1b[33m', red: '\x1b[31m'
};
const log  = m => console.log(`${c.blue}[NEXORA]${c.reset} ${m}`);
const ok   = m => console.log(`${c.green}  ✓${c.reset} ${m}`);
const warn = m => console.log(`${c.yellow}  !${c.reset} ${m}`);
const fail = m => { console.log(`${c.red}  ✗${c.reset} ${m}`); };

const ROOT = process.cwd();

// ── Funções base ──────────────────────────────────────────────────
function ensureDir(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    fs.mkdirSync(full, { recursive: true });
  }
}

function writeFile(rel, content, overwrite = false) {
  const full = path.join(ROOT, rel);
  ensureDir(path.dirname(rel));
  if (fs.existsSync(full) && !overwrite) {
    warn(`Já existe (mantido): ${rel}`);
    return false;
  }
  fs.writeFileSync(full, content.trimStart(), 'utf8');
  ok(`Criado: ${rel}`);
  return true;
}

// ── Verificar que estamos na raiz correcta ─────────────────────────
if (!fs.existsSync(path.join(ROOT, 'package.json'))) {
  fail('Este script deve ser executado na raiz do projecto nexora-media-processing');
  fail('Certifica-te que fizeste: cd nexora-media-processing');
  process.exit(1);
}

console.log('');
console.log('╔══════════════════════════════════════════╗');
console.log('║  Nexora — Deploy de ficheiros de config ║');
console.log('╚══════════════════════════════════════════╝');
console.log('');

// ══════════════════════════════════════════
// 1. PROGRESS.md
// ══════════════════════════════════════════
log('A criar PROGRESS.md...');

writeFile('PROGRESS.md', `
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

\`\`\`
Data: ___________
Agente: ___________
A trabalhar em: ___________
Bloqueios: ___________
\`\`\`

---

## 📁 Estrutura de ficheiros

\`\`\`
nexora-media-processing/   ← actualiza à medida que cresce
├── (scaffold inicial criado)
\`\`\`

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
| ${new Date().toISOString().split('T')[0]} | Ficheiros de config criados | nexora-deploy-docs.js | PROGRESS.md, rules.md, ADRs |

---

## 🎯 Próximos passos

1. Executar Prompt 1 no Antigravity (agente: Claude)
2. Executar Prompt 5 no Antigravity (agente: Claude)
3. Executar Prompt 2 no Antigravity (agente: Claude)
4. Executar Prompt 6 no Antigravity (agente: Claude)
5. Executar Prompt 3 no Antigravity (agente: Gemini)

---

*Última actualização: ${new Date().toISOString().split('T')[0]}*
`, true);

// ══════════════════════════════════════════
// 2. REGRAS GLOBAIS PARA O ANTIGRAVITY
// ══════════════════════════════════════════
log('A criar .antigravity/rules.md...');

writeFile('.antigravity/rules.md', `
# Nexora Media Processing — Regras Globais de Desenvolvimento

> Lido automaticamente pelo Google Antigravity antes de qualquer interacção de IA.
> Aplica-se a TODOS os agentes: Claude, Gemini, ChatGPT.

## REGRA 0 — Lê o PROGRESS.md primeiro

ANTES de qualquer trabalho, lê o ficheiro \`PROGRESS.md\` na raiz do projecto.
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
- exec(\`ffmpeg \${param}\`) ← ADR-002 proíbe
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
`);

// ══════════════════════════════════════════
// 3. CONFIGURAÇÃO DO ANTIGRAVITY
// ══════════════════════════════════════════
log('A criar .antigravity/settings.json...');

writeFile('.antigravity/settings.json', JSON.stringify({
  "ai": {
    "defaultAgent": "claude",
    "contextFiles": ["PROGRESS.md", ".antigravity/rules.md"],
    "autoReadContext": true,
    "language": "pt-PT"
  },
  "rules": {
    "file": ".antigravity/rules.md",
    "enforceOnEverySession": true
  },
  "agents": {
    "claude": {
      "role": "arquitectura, backend, segurança, testes",
      "prompts": [1, 2, 4, 5, 6, 7, 8, 9, 10]
    },
    "gemini": {
      "role": "frontend, UI, dashboard",
      "prompts": [3]
    }
  }
}, null, 2));

// ══════════════════════════════════════════
// 4. CONFIGURAÇÃO VS CODE / ANTIGRAVITY
// ══════════════════════════════════════════
log('A criar .vscode/settings.json...');

writeFile('.vscode/settings.json', JSON.stringify({
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.tabSize": 2,
  "editor.rulers": [100],
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.tsdk": "node_modules/typescript/lib",
  "eslint.validate": ["typescript"],
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.next": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/coverage": true
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "github.copilot.enable": {
    "*": false
  }
}, null, 2));

writeFile('.vscode/extensions.json', JSON.stringify({
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "prisma.prisma",
    "ms-azuretools.vscode-docker",
    "eamodio.gitlens",
    "rangav.vscode-thunder-client",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next"
  ]
}, null, 2));

// ══════════════════════════════════════════
// 5. ADRs (Architecture Decision Records)
// ══════════════════════════════════════════
log('A criar docs/adr/...');

const ADRS = [
  { num:'001', title:'Temporal.io para orquestração', status:'ACCEPTED',
    context:'O sistema precisa de orquestrar workflows complexos com múltiplos passos, retry automático, e capacidade de recovery após falhas.',
    decision:'Usar Temporal.io como orquestrador principal. BullMQ continua a ser usado para filas simples, mas toda a lógica de workflow usa Temporal.',
    positives:['Workflows stateful com histórico completo','Retry automático com backoff configurável','Recovery após crash sem perda de estado','Dashboard de monitorização nativo'],
    negatives:['Infraestrutura adicional (servidor Temporal)','Curva de aprendizagem'],
    alternatives:['BullMQ standalone — rejeitado porque não tem estado de workflow persistente','Airflow — rejeitado por ser Python e não ter tipagem TypeScript'] },
  { num:'002', title:'FFmpeg via execFile/spawn (nunca exec)', status:'ACCEPTED',
    context:'O sistema executa FFmpeg com parâmetros que podem incluir paths de ficheiros fornecidos externamente.',
    decision:'FFmpeg é sempre chamado via child_process.execFile() ou spawn() com array de argumentos. exec() com string interpolada é PROIBIDO.',
    positives:['Previne command injection via nomes de ficheiro maliciosos','Permite timeout controlado','Permite kill do processo'],
    negatives:['Ligeiramente mais verboso'],
    alternatives:['exec() com string — rejeitado por risco de injection'] },
  { num:'003', title:'SHA-256 para checksums (MD5 proibido)', status:'ACCEPTED',
    context:'O sistema calcula checksums de ficheiros de media para verificar integridade.',
    decision:'Todos os checksums usam SHA-256. MD5 está proibido.',
    positives:['SHA-256 sem colisões conhecidas','Standard da indústria para integridade de dados'],
    negatives:['Ligeiramente mais lento que MD5 (negligenciável para ficheiros de media)'],
    alternatives:['MD5 — rejeitado por colisões conhecidas desde 2004'] },
  { num:'004', title:'yuv420p obrigatório em outputs de distribuição', status:'ACCEPTED',
    context:'Diferentes pixel formats têm diferentes níveis de compatibilidade com decoders.',
    decision:'Todos os outputs de distribuição usam yuv420p. Para HDR usa-se yuv420p10le.',
    positives:['Compatibilidade máxima com hardware decoders, STBs, mobile','Standard para H.264/H.265 broadcast'],
    negatives:['Menor fidelidade de cor que yuv444p (aceitável para distribuição)'],
    alternatives:['yuv422p — rejeitado por incompatibilidade com maioria dos decoders hardware'] },
  { num:'005', title:'Two-pass EBU R128 + BS1770GAIN verificação', status:'ACCEPTED',
    context:'A normalização de loudness em dois passos é mais precisa. BS1770GAIN verifica independentemente.',
    decision:'Two-pass EBU R128 obrigatório. BS1770GAIN verifica o resultado independentemente do FFmpeg.',
    positives:['Two-pass garante linear=true (sem compressão dinâmica)','BS1770GAIN é ferramenta independente do FFmpeg — não pode verificar o próprio output'],
    negatives:['Requer dois passes (2× o tempo de encoding de áudio)','BS1770GAIN é dependência extra'],
    alternatives:['Single-pass — rejeitado por menor precisão'] },
  { num:'006', title:'Closed GOP + IDR frames obrigatório', status:'ACCEPTED',
    context:'Playout systems broadcast requerem que possam começar a decodificar em qualquer ponto do stream.',
    decision:'Todos os outputs broadcast têm Closed GOP, IDR frames obrigatórios, e sc_threshold=0.',
    positives:['Compatibilidade com todos os playout systems','Permite switching e seeking sem artefactos'],
    negatives:['Ligeiramente menos eficiente que Open GOP (negligenciável)'],
    alternatives:['Open GOP — rejeitado por causar artefactos em playout switching'] },
  { num:'007', title:'Audit trail append-only', status:'ACCEPTED',
    context:'O audit trail é a prova legal de que um ficheiro passou por determinadas etapas de processamento.',
    decision:'A tabela audit_logs só permite INSERT. UPDATE e DELETE são proibidos por política de base de dados.',
    positives:['Integridade legal dos registos','Detecção de tampering via hash chain'],
    negatives:['A tabela cresce indefinidamente (gerir com particionamento por mês)'],
    alternatives:['Tabela normal com UPDATE — rejeitado por risco de adulteração'] },
  { num:'008', title:'RS256 JWT com rotação (HS256 proibido em produção)', status:'ACCEPTED',
    context:'O sistema precisa de autenticação segura para a API.',
    decision:'JWT usa RS256 (chave assimétrica). HS256 é proibido em produção. Rotação de chaves a cada 30 dias.',
    positives:['Chave pública pode ser partilhada sem risco','Rotação sem downtime'],
    negatives:['Mais complexo que HS256'],
    alternatives:['HS256 — rejeitado por risco de comprometer secret key'] },
  { num:'009', title:'BS1770GAIN para verificação independente', status:'ACCEPTED',
    context:'O FFmpeg não deve ser o único a verificar o output que ele próprio criou.',
    decision:'BS1770GAIN é a ferramenta de verificação final de loudness, independente do FFmpeg.',
    positives:['Validação cruzada por ferramenta diferente','Detecta erros no FFmpeg que o próprio não detectaria'],
    negatives:['Dependência extra de software'],
    alternatives:['FFmpeg ebur128 para verificação — rejeitado por ser a mesma ferramenta a verificar o próprio output'] },
  { num:'010', title:'VMAF score calculado para todos os outputs', status:'ACCEPTED',
    context:'É necessário garantir qualidade verificável de todos os ficheiros processados.',
    decision:'VMAF é calculado pós-encode para todos os perfis e o score é guardado na base de dados.',
    positives:['Qualidade verificável e rastreável','Permite deteção de regressões de qualidade'],
    negatives:['Requer ficheiro de referência (mezzanine)','Adiciona tempo ao pipeline'],
    alternatives:['PSNR/SSIM — rejeitados por menor correlação com perceção humana'] },
];

ADRS.forEach(adr => {
  writeFile(`docs/adr/ADR-${adr.num}-${adr.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'')}.md`, `
# ADR-${adr.num}: ${adr.title}

## Estado: ${adr.status}

## Contexto

${adr.context}

## Decisão

${adr.decision}

## Consequências

### Positivas
${adr.positives.map(p => `- ${p}`).join('\n')}

### Negativas
${adr.negatives.map(n => `- ${n}`).join('\n')}

## Alternativas consideradas

${adr.alternatives.map(a => `- ${a}`).join('\n')}

---

*ADR criado automaticamente pelo nexora-deploy-docs.js*
*Data: ${new Date().toISOString().split('T')[0]}*
`);
});

// ══════════════════════════════════════════
// 6. PROMETHEUS CONFIG
// ══════════════════════════════════════════
log('A criar config/prometheus/prometheus.yml...');

writeFile('config/prometheus/prometheus.yml', `
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    project: 'nexora-media-processing'

rule_files:
  - "alerts.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

scrape_configs:
  - job_name: 'nexora-api'
    static_configs:
      - targets: ['nexora-api:9100']
    metrics_path: '/metrics'

  - job_name: 'nexora-worker'
    static_configs:
      - targets: ['nexora-worker:9101']
    metrics_path: '/metrics'

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
`);

writeFile('config/prometheus/alerts.yml', `
groups:
  - name: nexora_pipeline
    rules:
      - alert: NexoraPipelineStalled
        expr: nexora_queue_depth > 50
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "Pipeline parado — fila com mais de 50 jobs"
          description: "Queue {{ $labels.worker_type }} tem {{ $value }} jobs pendentes há 10 minutos"

      - alert: NexoraHighRejectionRate
        expr: rate(nexora_assets_rejected_total[5m]) / rate(nexora_assets_ingested_total[5m]) > 0.20
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Taxa de rejeição alta (>20%)"

      - alert: NexoraWorkerDown
        expr: up{job="nexora-worker"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Worker Nexora offline há 2 minutos"

      - alert: NexoraLowVMAF
        expr: histogram_quantile(0.5, nexora_vmaf_score) < 85
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "VMAF mediano abaixo de 85"

      - alert: NexoraFFmpegTimeout
        expr: increase(nexora_ffmpeg_timeout_total[5m]) > 0
        labels:
          severity: critical
        annotations:
          summary: "FFmpeg timeout detectado"

      - alert: NexoraDiskWarning
        expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) < 0.20
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Disco abaixo de 20% disponível"
`);

// ══════════════════════════════════════════
// 7. GRAFANA DASHBOARD BASE
// ══════════════════════════════════════════
log('A criar config/grafana/...');

writeFile('config/grafana/provisioning/datasources/prometheus.yml', `
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    editable: false
`);

writeFile('config/grafana/provisioning/dashboards/dashboard.yml', `
apiVersion: 1

providers:
  - name: 'Nexora Dashboards'
    orgId: 1
    folder: 'Nexora'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
`);

// ══════════════════════════════════════════
// 8. FICHEIROS PLACEHOLDER PARA GIT
// ══════════════════════════════════════════
log('A criar ficheiros .gitkeep...');
['media/input','media/output','media/temp','logs'].forEach(d => {
  writeFile(`${d}/.gitkeep`, '');
});

// ══════════════════════════════════════════
// SUMÁRIO FINAL
// ══════════════════════════════════════════
console.log('');
console.log('╔══════════════════════════════════════════════╗');
console.log('║  ✓ Deploy de ficheiros concluído!           ║');
console.log('╚══════════════════════════════════════════════╝');
console.log('');
console.log('Ficheiros criados:');
console.log('  PROGRESS.md                  → registo de progresso');
console.log('  .antigravity/rules.md        → regras para todos os agentes IA');
console.log('  .antigravity/settings.json   → configuração do Antigravity');
console.log('  .vscode/settings.json        → configuração do IDE');
console.log('  .vscode/extensions.json      → extensões recomendadas');
console.log('  docs/adr/ADR-001 a ADR-010   → decisões de arquitectura');
console.log('  config/prometheus/           → métricas e alertas');
console.log('  config/grafana/              → dashboards');
console.log('');
console.log('Próximo passo:');
console.log('  Abre o Google Antigravity na pasta do projecto');
console.log('  e executa o Prompt 1 (agente: Claude)');
console.log('');
