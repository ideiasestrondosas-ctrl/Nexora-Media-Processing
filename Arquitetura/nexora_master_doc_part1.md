# Nexora Media Processing
## Manual Técnico Completo — v4.0

> **Para quem é este manual:** Para qualquer pessoa, mesmo sem experiência em desenvolvimento ou IA, que queira construir e executar a plataforma Nexora Media Processing.
>
> **IDE principal:** Google Antigravity (fork do VS Code com Gemini, Claude e ChatGPT integrados)
>
> **Língua:** Português de Portugal
>
> **Versão:** 4.0 | Arquitecto: Claude Sonnet

---

# ═══════════════════════════════════════════
# ÍNDICE GERAL
# ═══════════════════════════════════════════

```
PARTE 0 — O QUE É O NEXORA E COMO FUNCIONA ESTE MANUAL
PARTE 1 — PREPARAÇÃO DO AMBIENTE (macOS · Windows · Linux)
PARTE 2 — GITHUB: REPOSITÓRIO E SINCRONIZAÇÃO NA CLOUD
PARTE 3 — GOOGLE ANTIGRAVITY: INSTALAÇÃO E CONFIGURAÇÃO
PARTE 4 — REGRA GERAL DO PROJECTO: FICHEIRO PROGRESS.MD
PARTE 5 — ARQUITECTURA TÉCNICA COMPLETA (6 CAMADAS)
PARTE 6 — PROMPTS DE DESENVOLVIMENTO (Agentes IA)
PARTE 7 — SCRIPTS DE AUTOMAÇÃO
PARTE 8 — GUIA PASSO A PASSO DE EXECUÇÃO
PARTE 9 — FERRAMENTAS OPEN SOURCE INTEGRADAS
PARTE 10 — CHEAT SHEETS E REFERÊNCIA TÉCNICA
PARTE 11 — APÊNDICES (Variáveis · Sizing · Troubleshooting · Glossário)
PARTE 12 — CHECKLIST DE ACEITAÇÃO FINAL
```

---

---

# ═══════════════════════════════════════════
# PARTE 0 — O QUE É O NEXORA
# ═══════════════════════════════════════════

## O que faz o Nexora Media Processing?

O **Nexora Media Processing** é uma plataforma profissional que recebe ficheiros de vídeo e áudio, valida-os automaticamente, corrige problemas de qualidade, converte-os para os formatos correctos e entrega-os prontos a emitir — seja em televisão, plataformas de streaming ou arquivo.

Imagina uma **linha de montagem automática para vídeo profissional**:

```
Ficheiro bruto (câmara/editor)
        ↓
   Nexora recebe
        ↓
   Verifica qualidade (QC)
        ↓
   Corrige problemas automaticamente
        ↓
   Converte para o formato pedido
        ↓
   Verifica o resultado
        ↓
   Entrega pronto a emitir
```

## Como está organizado este manual?

Este manual é um **guia passo a passo**. Podes segui-lo do início ao fim sem saltar nada. Cada secção diz-te exactamente o que fazer, onde clicar, o que escrever e o que esperar ver no ecrã.

> 💡 **Dica:** Quando vires uma caixa como esta, é informação importante que não deves saltar.

> ⚠️ **Atenção:** Quando vires este símbolo, é um aviso de algo que pode correr mal se não seguires as instruções.

> ✅ **Confirmação:** Quando vires este símbolo, é a confirmação de que o passo correu bem.

---

---

# ═══════════════════════════════════════════
# PARTE 1 — PREPARAÇÃO DO AMBIENTE
# ═══════════════════════════════════════════

> **O que vais fazer nesta parte:** Instalar todas as ferramentas necessárias no teu computador. Isto só precisas de fazer uma vez.

---

## 1.1 — Script de Setup Automático (RECOMENDADO)

Em vez de instalar tudo manualmente, podes usar o script de setup automático do Nexora. Ele instala tudo o que precisas de uma só vez.

**Para macOS e Linux**, abre o Terminal e cola este comando:
```bash
curl -fsSL https://raw.githubusercontent.com/nexora-media/nexora/main/scripts/nexora-setup.sh | bash
```

**Para Windows**, abre o PowerShell como Administrador e cola este comando:
```powershell
irm https://raw.githubusercontent.com/nexora-media/nexora/main/scripts/nexora-setup.ps1 | iex
```

O script demora cerca de 5 a 15 minutos e instala automaticamente:
- Node.js 20 LTS
- Git
- Docker Desktop
- FFmpeg com todas as bibliotecas necessárias
- HandBrake CLI
- MediaInfo
- BS1770GAIN
- MediaConch
- Google Antigravity

> ✅ No final do script, deves ver a mensagem: `✓ Nexora setup completo. Podes começar!`

---

## 1.2 — Instalação Manual (se o script não funcionar)

Se preferires instalar manualmente ou o script não funcionar, segue os passos abaixo para o teu sistema operativo.

---

### 🍎 macOS — Instalação Manual

#### Passo 1 — Abrir o Terminal

1. Prime `Cmd + Espaço` para abrir o Spotlight
2. Escreve `Terminal`
3. Prime `Enter`

O Terminal é uma janela onde podes escrever comandos ao computador. Não te preocupes — vais apenas copiar e colar os comandos deste manual.

#### Passo 2 — Instalar o Homebrew (gestor de pacotes)

O Homebrew é uma ferramenta que facilita a instalação de software no Mac. Cola este comando no Terminal:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Quando te perguntar a password do teu Mac, escreve-a (não verás os caracteres enquanto escreves — é normal) e prime `Enter`.

> ⚠️ Este processo pode demotar 5 a 10 minutos. Aguarda até ver o símbolo `$` na linha seguinte.

#### Passo 3 — Instalar as ferramentas

Cola cada linha no Terminal e prime `Enter` após cada uma:

```bash
# Node.js (motor de execução do código)
brew install node@20

# Git (controlo de versões)
brew install git

# FFmpeg (motor de processamento de vídeo)
brew install ffmpeg

# HandBrake CLI (encoding de proxies)
brew install handbrake

# MediaInfo (análise de ficheiros)
brew install mediainfo

# MediaConch (verificação de conformidade)
brew install mediaconch
```

Para o BS1770GAIN (medição de loudness de áudio):
```bash
brew install bs1770gain
```

#### Passo 4 — Instalar o Docker Desktop

1. Vai a **docker.com/products/docker-desktop**
2. Clica em "Download for Mac" (escolhe Intel ou Apple Silicon conforme o teu Mac)
3. Abre o ficheiro `.dmg` descarregado
4. Arrasta o Docker para a pasta Aplicações
5. Abre o Docker Desktop e aguarda até o ícone ficar verde

#### Passo 5 — Verificar a instalação

Cola este comando no Terminal para confirmar tudo está instalado:

```bash
node --version && git --version && docker --version && ffmpeg -version | head -1
```

> ✅ Deves ver 4 linhas com versões. Se alguma falhar, volta ao passo correspondente.

---

### 🪟 Windows — Instalação Manual

#### Passo 1 — Abrir o PowerShell como Administrador

1. Prime a tecla `Windows`
2. Escreve `PowerShell`
3. Clica com o botão direito em "Windows PowerShell"
4. Clica em "Executar como administrador"
5. Clica "Sim" na janela que aparece

#### Passo 2 — Instalar o Chocolatey (gestor de pacotes)

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

Fecha e reabre o PowerShell como Administrador depois disto.

#### Passo 3 — Instalar as ferramentas

```powershell
# Node.js
choco install nodejs-lts -y

# Git
choco install git -y

# FFmpeg
choco install ffmpeg -y

# HandBrake CLI
choco install handbrake -y

# MediaInfo
choco install mediainfo-cli -y
```

Para o BS1770GAIN no Windows:
1. Vai a **github.com/petterreinholdtsen/bs1770gain/releases**
2. Descarrega o ficheiro `.exe` para Windows
3. Copia para `C:\Program Files\bs1770gain\`
4. Adiciona esse caminho ao PATH do sistema:
   - Pesquisa "Variáveis de ambiente" no menu Iniciar
   - Clica em "Variáveis do Sistema" → "Path" → "Editar"
   - Clica "Novo" e escreve `C:\Program Files\bs1770gain\`
   - Clica "OK" em todas as janelas

#### Passo 4 — Instalar o Docker Desktop

1. Vai a **docker.com/products/docker-desktop**
2. Clica "Download for Windows"
3. Executa o instalador
4. Reinicia o computador quando pedido
5. Abre o Docker Desktop e aguarda o ícone verde

#### Passo 5 — Verificar

```powershell
node --version; git --version; docker --version; ffmpeg -version
```

> ✅ Deves ver versões de cada ferramenta.

---

### 🐧 Linux — Instalação Manual

#### Ubuntu / Debian / Linux Mint

```bash
# Actualizar o sistema
sudo apt update && sudo apt upgrade -y

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Git
sudo apt install -y git

# FFmpeg com todas as bibliotecas
sudo apt install -y ffmpeg

# HandBrake CLI
sudo apt install -y handbrake-cli

# MediaInfo
sudo apt install -y mediainfo

# MediaConch
sudo apt install -y mediaconch

# BS1770GAIN
sudo apt install -y bs1770gain

# Docker
curl -fsSL https://get.docker.com | sudo bash
sudo usermod -aG docker $USER
newgrp docker
```

#### Fedora / RHEL / CentOS

```bash
sudo dnf install -y nodejs git ffmpeg HandBrakeCLI mediainfo bs1770gain
# Docker
sudo dnf install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

#### Arch Linux / Manjaro

```bash
sudo pacman -S nodejs npm git ffmpeg handbrake mediainfo bs1770gain docker
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

#### Verificar (todas as distros)

```bash
node --version && git --version && docker --version && ffmpeg -version | head -1
```

> ✅ Deves ver 4 linhas com versões.

---

---

# ═══════════════════════════════════════════
# PARTE 2 — GITHUB: REPOSITÓRIO NA CLOUD
# ═══════════════════════════════════════════

> **O que vais fazer nesta parte:** Criar um repositório no GitHub para guardar o código do Nexora na cloud. Isto é como um "disco rígido online" para o teu projecto — nunca perdes trabalho e podes aceder de qualquer computador.

---

## 2.1 — Criar Conta no GitHub

1. Vai a **github.com**
2. Clica "Sign up"
3. Preenche o email, password e nome de utilizador
4. Verifica o email
5. Selecciona o plano gratuito

---

## 2.2 — Criar o Repositório Nexora

1. Faz login em **github.com**
2. Clica no botão `+` no canto superior direito
3. Clica "New repository"
4. Preenche:
   - **Repository name:** `nexora-media-processing`
   - **Description:** `Plataforma profissional de processamento de media broadcast & OTT`
   - **Visibility:** Private (ou Public se quiseres partilhar)
   - Marca ✅ "Add a README file"
   - Em "Add .gitignore" selecciona `Node`
5. Clica "Create repository"

> ✅ O teu repositório está criado. Guarda o URL — será algo como `https://github.com/teu-utilizador/nexora-media-processing`

---

## 2.3 — Configurar Git no teu Computador

No Terminal (macOS/Linux) ou PowerShell (Windows):

```bash
# Configurar o teu nome (aparece nos commits)
git config --global user.name "O Teu Nome"

# Configurar o teu email (o mesmo do GitHub)
git config --global user.email "teu@email.com"

# Configurar o editor padrão
git config --global core.editor "code"

# Verificar configuração
git config --global --list
```

---

## 2.4 — Clonar o Repositório para o teu Computador

```bash
# Ir para a pasta onde queres guardar o projecto
# macOS/Linux:
cd ~/Documents

# Windows (PowerShell):
cd $HOME\Documents

# Clonar o repositório
git clone https://github.com/teu-utilizador/nexora-media-processing.git

# Entrar na pasta
cd nexora-media-processing
```

> ✅ Agora tens a pasta `nexora-media-processing` no teu computador, ligada ao GitHub.

---

## 2.5 — Fluxo de Trabalho com Git (usar todos os dias)

Sempre que fizeres alterações ao código, usa estes 3 comandos:

```bash
# 1. Ver o que mudou
git status

# 2. Adicionar as alterações
git add .

# 3. Guardar com uma mensagem descritiva
git commit -m "Descrição do que fizeste (ex: Adiciona worker de transcode)"

# 4. Enviar para o GitHub (cloud)
git push origin main
```

> 💡 **Regra:** Faz commit e push sempre que terminares uma sessão de trabalho. Assim nunca perdes nada.

---

---

# ═══════════════════════════════════════════
# PARTE 3 — GOOGLE ANTIGRAVITY: INSTALAÇÃO
# ═══════════════════════════════════════════

> **O que é o Google Antigravity:** É um IDE (ambiente de desenvolvimento) baseado no VS Code, criado pela Google, com os assistentes de IA Gemini, Claude e ChatGPT integrados directamente. Trabalha com o teu workspace/pasta de projecto localmente.

---

## 3.1 — Instalar o Google Antigravity

### macOS
```bash
# Via Homebrew
brew install --cask google-antigravity

# Ou descarregar directamente de:
# antigravity.google.com/download
```

### Windows
1. Vai a **antigravity.google.com/download**
2. Clica "Download for Windows"
3. Executa o instalador `.exe`
4. Segue os passos (Next, Next, Install, Finish)

### Linux
```bash
# Ubuntu/Debian
wget -O antigravity.deb https://antigravity.google.com/download/linux/deb
sudo dpkg -i antigravity.deb

# Arch/Manjaro
yay -S google-antigravity

# AppImage (universal)
wget https://antigravity.google.com/download/linux/appimage
chmod +x GoogleAntigravity.AppImage
./GoogleAntigravity.AppImage
```

---

## 3.2 — Configuração Inicial do Antigravity

### Passo 1 — Abrir a pasta do projecto

1. Abre o Google Antigravity
2. Clica em "File" → "Open Folder"
3. Navega até `Documents/nexora-media-processing`
4. Clica "Select Folder" (ou "Abrir")

> ✅ Deves ver os ficheiros do projecto na barra lateral esquerda.

### Passo 2 — Fazer login com a conta Google

1. Clica no ícone de perfil no canto inferior esquerdo
2. Clica "Sign in with Google"
3. Faz login com a tua conta Google
4. Autoriza as permissões

### Passo 3 — Activar os assistentes de IA

1. Clica no ícone de IA na barra lateral (parece um robot ou estrela)
2. Verás os assistentes disponíveis: Gemini, Claude, ChatGPT
3. Para este projecto, usa **Claude** como assistente principal
4. Clica em "Claude" e faz login com a tua conta Anthropic (claude.ai)

> 💡 **Como usar o assistente de IA no Antigravity:**
> - Prime `Ctrl+Shift+I` (Windows/Linux) ou `Cmd+Shift+I` (macOS)
> - Ou clica no ícone de chat na barra lateral
> - Escreve ou cola o teu prompt
> - O assistente gera o código directamente nos ficheiros do projecto

### Passo 4 — Instalar extensões essenciais

No Antigravity, vai a Extensions (ícone de quadrados na barra lateral) e instala:

- **ESLint** — verificação de qualidade de código
- **Prettier** — formatação automática de código
- **Prisma** — suporte para base de dados
- **Docker** — gestão de containers
- **GitLens** — visualização do Git
- **Thunder Client** — testar a API (alternativa ao Postman)

---

## 3.3 — Como Interagir com os Agentes IA no Antigravity

Esta é a parte mais importante para quem não tem experiência em desenvolvimento.

### Como abrir o chat de IA

```
Atalho de teclado:
  macOS:         Cmd + Shift + I
  Windows/Linux: Ctrl + Shift + I

Ou: clica no ícone de chat na barra lateral esquerda
```

### Como colar um prompt

1. Copia o prompt da secção "PARTE 6 — PROMPTS" deste manual
2. Abre o chat de IA no Antigravity (atalho acima)
3. Cola o prompt (Cmd+V ou Ctrl+V)
4. Prima Enter
5. **Aguarda** — o agente vai criar/modificar ficheiros automaticamente

### Como verificar o que o agente fez

Após o agente terminar:
1. Olha para a barra lateral — verás ficheiros novos ou modificados (marcados a verde/amarelo)
2. Clica em cada ficheiro para ver o conteúdo
3. Se algo parecer errado, escreve no chat: *"Explica o que fizeste neste ficheiro"*

### Como pedir ajuda ao agente

Podes escrever em português normal:
- *"O que faz este ficheiro?"*
- *"Há algum erro aqui?"*
- *"Como corro isto no terminal?"*
- *"Explica-me este código como se eu não soubesse nada"*

### Como mudar de agente

Se estás a usar Claude e queres mudar para Gemini ou ChatGPT:
1. No chat de IA, clica no nome do agente actual (ex: "Claude")
2. Aparece um menu com os agentes disponíveis
3. Selecciona o agente que queres

> 💡 **Qual agente usar para quê:**
> - **Claude** — arquitectura, backend, segurança, revisão de código
> - **Gemini** — frontend, UI, análise de dados, integração Google
> - **ChatGPT** — debugging, explicações detalhadas, documentação

---

---

# ═══════════════════════════════════════════
# PARTE 4 — REGRA GERAL DO PROJECTO:
#           FICHEIRO PROGRESS.MD
# ═══════════════════════════════════════════

> **O que é isto:** Um ficheiro especial que regista tudo o que foi feito e o que falta fazer no projecto. É lido pelos agentes IA antes de qualquer trabalho, para que saibam exactamente o estado do projecto sem precisar de explicar tudo de novo.

---

## 4.1 — Criar o Ficheiro PROGRESS.md

Cria o ficheiro `PROGRESS.md` na raiz do projecto com este conteúdo inicial:

```markdown
# Nexora Media Processing — Estado do Projecto

> **REGRA OBRIGATÓRIA:** Este ficheiro DEVE ser actualizado no início e no fim
> de cada sessão de desenvolvimento. Todos os agentes IA devem ler este ficheiro
> ANTES de qualquer trabalho no projecto.

---

## 📋 Resumo do Projecto

**Nome:** Nexora Media Processing  
**Versão:** 0.1.0  
**Tipo:** Plataforma de processamento de media profissional (Broadcast & OTT)  
**Stack:** Node.js 20 + TypeScript + Fastify + BullMQ + PostgreSQL + Redis + MinIO  
**IDE:** Google Antigravity  
**Repositório:** https://github.com/[utilizador]/nexora-media-processing  

---

## ✅ O que está feito

<!-- Actualizar à medida que cada parte fica concluída -->

- [ ] Setup inicial do projecto (package.json, tsconfig, eslint)
- [ ] Docker Compose com todos os serviços
- [ ] Schema Prisma + migrações
- [ ] FFmpeg executor isolado com timeout
- [ ] QC rules engine (vídeo + áudio)
- [ ] BullMQ queues setup
- [ ] API routes base (assets + jobs)
- [ ] Temporal.io workflows
- [ ] Decision Engine
- [ ] REST API completa (OpenAPI 3.1)
- [ ] Auth JWT RS256
- [ ] Frontend Next.js 14
- [ ] Dashboard + charts
- [ ] Upload flow
- [ ] Two-pass EBU R128
- [ ] VMAF integration
- [ ] Log parser (Kimi)
- [ ] HandBrake + BS1770GAIN adapters
- [ ] Prometheus + Grafana
- [ ] Segurança completa
- [ ] Testes unitários e integração
- [ ] Testes E2E (Playwright)

---

## 🔄 Em progresso actualmente

<!-- Descreve o que estás a fazer AGORA -->

_Nada em progresso. A iniciar o projecto._

---

## 📁 Estrutura de ficheiros criada

<!-- Actualizar à medida que os ficheiros são criados -->

```
nexora-media-processing/
├── (vazio — projecto não iniciado)
```

---

## ⚠️ Problemas conhecidos

<!-- Regista aqui erros ou bloqueios que ainda não foram resolvidos -->

_Nenhum problema registado._

---

## 🏗️ Decisões de arquitectura tomadas (ADRs)

| # | Decisão | Motivo |
|---|---|---|
| ADR-01 | Temporal.io para orquestração | Workflows stateful com retry automático |
| ADR-02 | FFmpeg via execFile (nunca exec) | Segurança contra injecção |
| ADR-03 | SHA-256 para checksums | MD5 tem colisões conhecidas |
| ADR-04 | yuv420p obrigatório | Compatibilidade máxima de players |
| ADR-05 | Two-pass EBU R128 + BS1770GAIN | Verificação independente de loudness |
| ADR-06 | Closed GOP + IDR frames | Estabilidade em broadcast playout |
| ADR-07 | Audit trail append-only | Integridade de dados |
| ADR-08 | RS256 JWT | Mais seguro que HS256 |

---

## 📅 Histórico de sessões

| Data | O que foi feito | Agente usado |
|---|---|---|
| AAAA-MM-DD | Início do projecto, criação do repositório | — |

---

## 🎯 Próximos passos

1. Executar o script de scaffold (nexora-scaffold.js)
2. Correr o Prompt 1 (Claude) para criar o backend base
3. Correr o Prompt 5 (DeepSeek/Claude) para FFmpeg commands
4. Correr o Prompt 2 (Claude/Gemini) para Temporal + API
5. Correr o Prompt 6 para Docker + infra

---

*Última actualização: [data] por [nome]*
```

---

## 4.2 — Regra de Uso do PROGRESS.md

### Instrução para colocar no Antigravity (Regra Global)

No Antigravity, vai a `File → Preferences → Settings` e em "AI Instructions" (ou equivalente no Antigravity), adiciona esta instrução global para todos os agentes:

```
REGRA OBRIGATÓRIA PARA ESTE PROJECTO:
1. Antes de qualquer trabalho, lê o ficheiro PROGRESS.md na raiz do projecto
2. Após completares o teu trabalho, actualiza o PROGRESS.md:
   - Marca como ✅ o que ficou concluído
   - Actualiza a secção "Em progresso"
   - Adiciona ficheiros criados à estrutura
   - Regista decisões importantes nos ADRs
   - Adiciona uma linha ao histórico de sessões
3. Se encontrares algo que já está feito mas não está marcado, corrige o PROGRESS.md
4. Nunca refaças trabalho que já está marcado como ✅ — verifica primeiro
5. Se tiveres dúvidas sobre o estado do projecto, pergunta antes de agir
```

### Como o PROGRESS.md Reduz Custos e Melhora a Qualidade

```
SEM PROGRESS.md:
  Cada sessão com IA:
  → Agente não sabe o que existe
  → Re-lê todos os ficheiros (tokens $$$)
  → Pode refazer trabalho já feito
  → Pode introduzir inconsistências

COM PROGRESS.md:
  Cada sessão com IA:
  → Agente lê PROGRESS.md (pequeno, rápido)
  → Sabe exactamente o estado
  → Trabalha só no que falta
  → Mantém consistência
  → Custa muito menos tokens
```

---

---

# ═══════════════════════════════════════════
# PARTE 5 — ARQUITECTURA TÉCNICA COMPLETA
# ═══════════════════════════════════════════

> **O que é esta secção:** A descrição técnica de como o Nexora funciona internamente. Se não tens experiência técnica, podes saltar para a PARTE 6 e voltar aqui quando precisares de entender porquê algo funciona de determinada maneira.

---

## 5.1 — As 6 Camadas do Nexora

```
┌────────────────────────────────────────────────────────────────┐
│  CAMADA 1 — INGEST                                             │
│  Receção multi-origem + identificação + deduplicação           │
│  Watch folder · API HTTP/JWT · S3/MinIO · FTP · Live RTMP/SRT  │
│  → SHA-256 dedup · Perceptual hash · UUID interno              │
└─────────────────────────┬──────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────────┐
│  CAMADA 2 — QC & VALIDAÇÃO                                     │
│  Conformance check antes de qualquer processamento             │
│  MediaInfo + FFprobe + MediaConch + BS1770GAIN                 │
│  → GOP · CFR · PixelFormat · Loudness · Black/Freeze/Flash     │
│  → PASS / QUARANTINE / REJECT (com reason codes)              │
└─────────────────────────┬──────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────────┐
│  CAMADA 3 — INTELLIGENCE                                       │
│  SI/TI analysis · Classificação de conteúdo                    │
│  → Profile selector (Broadcast/OTT/Archive/Web)               │
│  → Bitrate ladder dinâmica (per-title encoding)               │
└─────────────────────────┬──────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────────┐
│  CAMADA 4 — PROCESSING (Workers Distribuídos)                 │
│  Temporal.io · Retry backoff · Dead-letter · FFmpeg isolado    │
│                                                                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐  │
│  │ Transcode    │ │ Audio R128   │ │ Legendas CEA-708/TTML │  │
│  │ H.264/H.265  │ │ Two-pass TP  │ │ WebVTT · Burn-in      │  │
│  └──────────────┘ └──────────────┘ └──────────────────────┘  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐  │
│  │ HDR/SDR Tone │ │ DRM Packaging│ │ Proxy + Thumb Sprites │  │
│  │ HLG·HDR10·PQ │ │ CMAF·Widevine│ │ LowRes·ProRes·VTT    │  │
│  └──────────────┘ └──────────────┘ └──────────────────────┘  │
└─────────────────────────┬──────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────────┐
│  CAMADA 5 — QC PÓS-ENCODE                                     │
│  VMAF ≥85/90/93 · SHA-256 · R128 final · MediaConch AS-11     │
└─────────────────────────┬──────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────────────┐
│  CAMADA 6 — DELIVERY                                           │
│  S3 Multipart · MXF/FTP · EBU Core XML · Playout API          │
│  → "ready_for_schedule" webhook trigger                        │
└────────────────────────────────────────────────────────────────┘

TRANSVERSAL: Prometheus · Grafana · Loki · Alertmanager · Jaeger
```

---

## 5.2 — Workers da Camada de Processing (Detalhe)

### Worker: Transcode Vídeo
```
Entrada:  Ficheiro validado + decisão de perfil
Processo: FFmpeg com Closed GOP + IDR + CFR obrigatório
Saída:    Ficheiro H.264/H.265 conforme ao perfil
Standards: yuv420p · -sc_threshold 0 · +faststart
```

### Worker: Audio Normalize
```
Entrada:  Stream de áudio do ficheiro
Processo: Two-pass EBU R128
  Pass 1: Medir LUFS integrado + True Peak
  Pass 2: Normalizar com valores medidos exactos
Verificação: BS1770GAIN independente
Targets: -23 LUFS broadcast EU · -14 LUFS streaming
         -1 dBTP True Peak obrigatório
```

### Worker: Legendas / Captions
```
Conversões suportadas:
  SRT → TTML/IMSC1 (broadcast EU, AS-11)
  SRT → WebVTT (HLS/DASH players)
  SRT → CEA-708 (broadcast US, embebido)
  EBU STL → TTML (arquivo broadcast EU)
Burn-in: opcional, para outputs de arquivo
```

### Worker: HDR / SDR
```
HDR → SDR: tone mapping obrigatório para displays SDR
  ffmpeg -vf "zscale=t=linear:npl=100,format=gbrpf32le,
              zscale=p=bt709,tonemap=hable:desat=0,
              zscale=t=bt709:m=bt709:r=tv,format=yuv420p"
SDR → HLG: uplift para broadcast (BBC, NHK standard)
```

### Worker: DRM Packaging
```
Multi-DRM para cobertura 100% de devices:
  Widevine  → Android, Chrome, Chromecast, SmartTV (CENC)
  FairPlay  → iOS, macOS, Safari, Apple TV (CBCS)
  PlayReady → Windows, Xbox, Edge, SmartTV (CENC)
Key Management: SPEKE / CPIX
Formato output: CMAF (fmp4 fragmentado)
```

### Worker: Proxy + Thumbnails
```
Proxy LowRes:    H.264 800kbps 1280x720 (revisão remota)
Proxy Mezzanine: ProRes 422 HQ (edição de alta qualidade)
Thumbnail sprites:
  - Grid 10x10, 1 thumbnail cada 10 segundos
  - Ficheiro VTT para scrubbing no player
```

---

## 5.3 — Stack Tecnológica Completa

| Componente | Tecnologia | Porquê |
|---|---|---|
| Core transcoding | FFmpeg 6.x | Standard da indústria universal |
| Batch encoding | HandBrake CLI | Presets optimizados, GPU nativa |
| Análise containers | MediaInfo + FFprobe | Complementares (cada um detecta coisas diferentes) |
| Conformance | MediaConch | Único tool com policy XML formal |
| Loudness | BS1770GAIN | Verificação independente do FFmpeg |
| Qualidade | libvmaf (integrado FFmpeg) | Métrica Netflix, melhor que PSNR/SSIM |
| Backend | Node.js 20 + TypeScript | Async nativo, ecosystem media |
| API | Fastify 4.x | 2× mais rápido que Express |
| Queue | BullMQ + Redis 7 | Retry nativo, dead-letter, priority |
| Orquestração | Temporal.io | Workflows stateful, replay, histórico |
| ORM | Prisma + PostgreSQL 15 | Type-safe, migrations automáticas |
| Storage | MinIO (S3-compatible) | Self-hosted sem custo cloud |
| Frontend | Next.js 14 App Router | SSR, Server Components |
| Observabilidade | Prometheus + Grafana + Loki | Stack de produção completo |
| Containers | Docker + Docker Compose | Dev/prod parity, zero config |

---

## 5.4 — Standards da Indústria Cobertos

```
Áudio:
  EBU R128          — loudness broadcast Europa
  ITU-R BS.1770-4   — loudness internacional
  ATSC A/85         — loudness broadcast EUA

Vídeo e Containers:
  AS-11 UK DPP      — entrega obrigatória BBC/ITV/Channel 4
  IMF SMPTE ST 2067 — masters OTT (Netflix, Amazon, Disney+)
  CMAF ISO 23000-19 — HLS e DASH unificados
  MXF OP1a          — broadcast profissional

Distribuição:
  Apple HLS Authoring Spec — streaming Apple
  DASH-IF IOP              — streaming DASH
  Harding FPA              — segurança epilepsia fotossensível

DRM e Segurança:
  SPEKE / CPIX      — gestão de chaves DRM
  SCTE-35           — marcadores de anúncios

Metadata:
  EBU Core          — metadata arquivo e MAM Europa
  SMPTE 330M (UMID) — identificador único de material
  EIDR              — Entertainment Identifier Registry

Encoding:
  Netflix per-title encoding spec — optimização por conteúdo
```

---

---

# ═══════════════════════════════════════════
# PARTE 6 — PROMPTS DE DESENVOLVIMENTO
# ═══════════════════════════════════════════

> **Como usar esta secção:**
> 1. Abre o Google Antigravity
> 2. Abre o chat de IA (Cmd/Ctrl + Shift + I)
> 3. Selecciona o agente indicado em cada prompt
> 4. Copia o prompt completo (do ``` até ao ```)
> 5. Cola no chat e prime Enter
> 6. Aguarda o agente criar os ficheiros
> 7. Actualiza o PROGRESS.md no fim

---

## ⚡ ORDEM DE EXECUÇÃO DOS PROMPTS

```
SEMANA 1:
  Prompt 1 (Claude)    → Backend base, workers, QC engine
  Prompt 5 (Claude)    → FFmpeg commands, GPU, VMAF, R128

SEMANA 2:
  Prompt 2 (Claude)    → Temporal workflows, Decision Engine, API
  Prompt 6 (qualquer)  → Docker, CI/CD, infra

SEMANA 3:
  Prompt 3 (Gemini)    → Frontend Next.js completo
  Prompt 4 (Claude)    → Log analysis, debug engine

SEMANA 4:
  Prompt 7 (Claude)    → Segurança completa
  Prompt 8 (Claude)    → Testes completos
  Prompt 9 (Claude)    → Integração open source
  Prompt 10 (qualquer) → Coordenação e protocolo
```

---

## PROMPT 1 — Claude | Backend Core + Workers + QC Engine

**Agente:** Claude  
**Onde executar:** Google Antigravity → Chat IA → seleccionar Claude  
**O que cria:** Toda a estrutura do backend, workers, regras QC, perfis de encoding

```
PROJECTO: Nexora Media Processing

Antes de começar, lê o ficheiro PROGRESS.md na raiz do projecto.

ROLE: Engenheiro sénior de backend — Nexora Media Processing

STACK (não alterar):
- Node.js 20 LTS + TypeScript strict mode
- Fastify 4.x
- BullMQ + Redis 7
- Prisma + PostgreSQL 15
- MinIO SDK (S3-compatible)
- Vitest + Testcontainers

FERRAMENTAS OPEN SOURCE (já instaladas):
- FFmpeg 6.x (com libvmaf, libx264, libx265, libfdk_aac)
- HandBrake CLI — presets de batch encoding
- MediaInfo CLI — análise de containers
- FFprobe — análise frame-level
- MediaConch — conformance checking com policy XML
- BS1770GAIN — medição EBU R128 standalone

ESTRUTURA A CRIAR:

src/
├── api/
│   ├── routes/
│   │   ├── assets.ts
│   │   ├── jobs.ts
│   │   └── webhooks.ts
│   └── middleware/
│       ├── auth.ts
│       └── rateLimiter.ts
├── workers/
│   ├── ingest.worker.ts
│   ├── qc.worker.ts
│   ├── analyzer.worker.ts
│   ├── transcode.worker.ts
│   ├── audio.worker.ts
│   ├── subtitle.worker.ts
│   ├── proxy.worker.ts
│   ├── qc-post.worker.ts
│   └── delivery.worker.ts
├── pipeline/
│   ├── orchestrator.ts
│   ├── profiles.ts
│   └── ffmpeg/
│       ├── builder.ts
│       ├── executor.ts
│       └── parser.ts
├── qc/
│   ├── rules/
│   │   ├── video.rules.ts
│   │   ├── audio.rules.ts
│   │   └── container.rules.ts
│   ├── vmaf.ts
│   └── mediaconch.ts
├── models/
│   ├── asset.model.ts
│   ├── job.model.ts
│   └── audit.model.ts
├── events/
│   ├── emitter.ts
│   └── webhooks.ts
└── observability/
    ├── metrics.ts
    ├── logger.ts
    └── tracing.ts

REGRAS OBRIGATÓRIAS:

1. FFmpeg NUNCA com exec() — sempre child_process.spawn isolado:
   - Timeout máximo configurável (default 4h)
   - SIGTERM → esperar 5s → SIGKILL
   - Capture stderr linha a linha

2. GOP SEMPRE Closed + IDR:
   -g [fps*2] -keyint_min [fps*2] -sc_threshold 0 -flags +cgop
   -x264-params "open-gop=0:bframes=0" -bf 0

3. Áudio: two-pass EBU R128:
   - Pass 1: análise com loudnorm print_format=json
   - Pass 2: normalização linear com valores medidos exactos
   - Verificação independente com BS1770GAIN
   - Falha se True Peak > -1 dBTP

4. QC rules composable e testáveis:
   (metadata) => { pass, severity: 'critical'|'warning'|'info', code, detail }
   'critical' → REJECT | múltiplos 'warning' → QUARANTINE

5. Audit trail: INSERT-only, nunca UPDATE/DELETE

6. Checksums: SHA-256 sempre (nunca MD5)

PERFIS DE ENCODING:

nexora_broadcast_hd:
  container: mxf_op1a
  video: h264 high 4.1 yuv420p 8000k closed-gop-50fr 0-bframes
  audio: pcm_s24le 48000 -23LUFS -1dBTP

nexora_ott_premium:
  container: cmaf (fmp4)
  video: h265 main yuv420p10le ladder dinâmica
  audio: eac3 -14LUFS -1dBTP

nexora_streaming_web:
  container: mp4 + faststart
  video: h264 high 4.0 yuv420p ladder 480p/720p/1080p
  audio: aac 192kbps 48000 -14LUFS

nexora_proxy_lowres:
  container: mp4 + faststart
  video: h264 baseline 1280x720 800kbps
  audio: aac 128kbps

nexora_archive:
  container: mxf_op1a
  video: prores_4444
  audio: pcm_s24le

MÉTRICAS PROMETHEUS:
  nexora_assets_ingested_total (counter)
  nexora_assets_rejected_total {reason} (counter)
  nexora_transcode_duration_seconds (histogram)
  nexora_queue_depth {worker_type} (gauge)
  nexora_vmaf_score (histogram)
  nexora_loudness_lufs (histogram)
  nexora_job_success_rate (gauge 5min)
  nexora_ffmpeg_timeout_total (counter)
  nexora_upload_duration_seconds (histogram)

SCHEMA PRISMA:

model Asset {
  id            String    @id @default(uuid())
  originalName  String
  sha256Input   String
  sha256Output  String?
  status        AssetStatus
  profile       String
  durationMs    Int?
  frameRate     Float?
  resolution    String?
  vmafScore     Float?
  loudnessLufs  Float?
  truePeakDbtp  Float?
  deliveryUrl   String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  jobs          Job[]
  auditLogs     AuditLog[]
}

enum AssetStatus {
  INGESTED QC_PENDING QC_PASS QC_QUARANTINE QC_REJECT
  ANALYZING TRANSCODING AUDIO_PROCESSING POST_QC
  DELIVERING READY FAILED
}

model AuditLog {
  id        String   @id @default(uuid())
  assetId   String
  eventType String
  operator  String
  payload   Json
  entryHash String
  createdAt DateTime @default(now())
}

ENTREGÁVEIS:
1. Estrutura de projecto completa com todos os ficheiros
2. Docker Compose base (app, postgres, redis, minio)
3. .env.example com todas as variáveis
4. Scripts npm: dev, build, test, lint, migrate, seed, worker, fixtures:generate
5. Testes unitários para QC rules (100% coverage)

COMEÇAR POR:
1. package.json + tsconfig.json + .eslintrc + .prettierrc
2. docker-compose.yml base
3. prisma/schema.prisma + migration inicial
4. src/pipeline/ffmpeg/executor.ts (isolamento FFmpeg)
5. src/qc/rules/ (video.rules.ts + audio.rules.ts)
6. BullMQ queues setup
7. API routes base

No final, actualiza o PROGRESS.md com o que foi criado.
```

---

## PROMPT 2 — Claude | Orquestração + Decision Engine + API REST

**Agente:** Claude  
**Onde executar:** Google Antigravity → Chat IA → Claude  
**O que cria:** Workflows Temporal.io, motor de decisão, API REST completa

```
PROJECTO: Nexora Media Processing

Antes de começar, lê o ficheiro PROGRESS.md.

ROLE: Arquitecto de sistemas — orquestração e API

TASK 1: TEMPORAL.IO WORKFLOWS

Workflow: processAssetWorkflow(assetId: string)

SEQUENCIAL:
1. validateQC()       timeout 5min, maxAttempts 3
2. analyzeContent()   timeout 10min, maxAttempts 2

PARALELO (após analyzeContent):
3a. transcodeVideo()  timeout 4h, maxAttempts 2
3b. normalizeAudio()  timeout 30min, maxAttempts 3
3c. processCaptions() timeout 20min, maxAttempts 2, opcional

SEQUENCIAL (após paralelo):
4. generateProxies()    timeout 1h, maxAttempts 2
5. generateThumbnails() timeout 10min, maxAttempts 3
6. runPostEncodeQC()    timeout 30min, maxAttempts 1
7. deliver()            timeout 2h, maxAttempts 3

FALHAS:
- validateQC REJECT → terminar, emitir NexoraAssetRejected
- validateQC QUARANTINE → pausar, aguardar sinal humano (timeout 48h)
- runPostEncodeQC falha VMAF → re-encode com parâmetros ajustados
- Todos os retries: backoff 1s, 10s, 60s

TASK 2: DECISION ENGINE

Regras de decisão (implementar exactamente):
1. VFR detectado → sempre TRANSCODE (CFR obrigatório)
2. Open GOP → sempre TRANSCODE
3. B-frames > 0 E target é broadcast → sempre TRANSCODE
4. pixelFormat != yuv420p E não é HDR → sempre TRANSCODE
5. True Peak > -1 dBTP → audio normalisation required
6. LUFS difere do target em > 1 LU → normalisation required
7. Codec OK + GOP compliant + CFR + sem issues → COPY ou REMUX
8. GOP size = Math.round(frameRate) * 2
9. bufsize = maxrateKbps * 2
10. 'sport' → +30% bitrate | 'animation' → -40% bitrate

Output: ProcessingDecision {
  action: 'COPY'|'REMUX'|'TRANSCODE'|'REJECT'
  targetProfile: string
  videoParams: { codec, gopSize, scThreshold: 0, closedGop: true, bFrames: 0, ... }
  audioParams: { sampleRate: 48000, truePeakLimit: -1, ... }
  ffmpegParams: string[]
}

TASK 3: REST API — Fastify + OpenAPI 3.1

POST   /api/v1/assets                     → Ingest (multipart ou URL)
GET    /api/v1/assets                     → Lista (paginação, filtros)
GET    /api/v1/assets/:id                 → Detalhe + status
GET    /api/v1/assets/:id/status          → SSE stream
GET    /api/v1/assets/:id/jobs            → Jobs do asset
GET    /api/v1/assets/:id/audit           → Audit trail
GET    /api/v1/assets/:id/qc-report       → Relatório QC JSON
GET    /api/v1/assets/:id/download/:type  → Presigned URL (1h TTL)
POST   /api/v1/assets/:id/reprocess       → Re-processar
POST   /api/v1/jobs                       → Submeter job manual
GET    /api/v1/jobs/:id                   → Status + logs
GET    /api/v1/profiles                   → Perfis disponíveis
GET    /api/v1/metrics/summary            → Métricas dashboard
GET    /api/v1/queue/stats                → Filas + workers
POST   /api/v1/webhooks/register          → Registar webhook

API STANDARDS:
- Respostas: { data: T, meta: { requestId, timestamp, version } }
- Erros: { error: { code, message, details }, meta: { requestId } }
- Auth: Bearer JWT RS256
- Rate limiting: 1000 req/min por utilizador, 5000 por API key

ENTREGÁVEIS:
1. src/pipeline/orchestrator.ts (Temporal workflows)
2. src/pipeline/decision-engine.ts
3. src/api/routes/ (todos os endpoints)
4. openapi.yaml (spec completa)
5. Testes de integração (Vitest + Supertest)

Actualiza o PROGRESS.md no final.
```

---

## PROMPT 3 — Gemini | Frontend Next.js 14

**Agente:** Gemini  
**Onde executar:** Google Antigravity → Chat IA → seleccionar Gemini  
**O que cria:** Interface web completa do Nexora

```
PROJECTO: Nexora Media Processing

Antes de começar, lê o ficheiro PROGRESS.md.

ROLE: Engenheiro frontend sénior — Nexora Media Processing

STACK:
- Next.js 14 (App Router, Server Components)
- TypeScript strict
- Tailwind CSS + shadcn/ui
- TanStack Query v5
- Zustand (estado cliente)
- Recharts (visualização dados)
- React Hook Form + Zod
- nuqs (URL state)

DESIGN:
- Dark mode first, light mode suportado
- Fonte: Inter (body), JetBrains Mono (métricas/código)
- Cor acento: blue-600
- Status: verde=ready, âmbar=processing, vermelho=failed, cinza=pending

PÁGINAS:

PAGE 1: Dashboard Overview
- 4 metric cards: assets hoje | taxa sucesso | tempo médio transcode | queue depth
- Line chart: assets/hora (últimas 24h)
- Bar chart: tipos de erro (últimos 7 dias)
- Tabela actividade recente (live update SSE 10s)

PAGE 2: Assets List
- Tabela: filename | status badge | perfil | resolução | duração | VMAF | data
- Filtros em URL params: status, perfil, date range, search
- Upload zone drag-and-drop ou URL input com progresso
- Bulk actions: reprocessar, download, arquivar
- Paginação: 25/50/100 por página

PAGE 3: Asset Detail (tabs)
- Overview: player vídeo (proxy lowres) + specs técnicas + VMAF gauge + timeline
- QC Report: tabela PASS/FAIL/WARN com severity + export PDF
- Jobs: timeline com logs expandíveis + live update
- Audit Trail: log cronológico imutável, JSON expandível
- Downloads: outputs disponíveis com presigned URL (1h TTL)

PAGE 4: Queue Monitor
- Worker health grid: nome | status | job actual | uptime
- Queue depth bars: ingest/qc/transcode/audio/delivery
- Throughput chart: jobs/hora (últimas 6h)
- Dead letter queue: retry/discard

PAGE 5: Upload Flow (wizard)
- Step 1: Drop zone (multi-ficheiro ou URL)
- Step 2: Profile selector (cards: Broadcast HD | OTT Premium | Web | Archive)
- Step 3: Opções (prioridade, webhook, metadata)
- Step 4: Progresso por ficheiro
- Step 5: Concluído → link para asset detail

COMPONENTES OBRIGATÓRIOS:
- NexoraStatusBadge (pulse animado para 'processing')
- NexoraVMAFGauge (semicírculo, red<70, amber<85, green≥85)
- NexoraLoudnessMeter (barra -40 a 0 LUFS)
- NexoraCodecBadge (H.264=blue, H.265=purple, ProRes=green)
- NexoraFileDropzone (validação MIME + tamanho)
- NexoraTimecodeDisplay (HH:MM:SS:FF)

REAL-TIME:
- Status: SSE /api/v1/assets/:id/status
- Queue stats: polling 5s
- Dashboard: polling 30s
- On READY: browser notification

ACESSIBILIDADE: WCAG 2.1 AA mínimo

ENTREGÁVEIS:
1. frontend/ com App Router completo
2. Todos os componentes TypeScript strict
3. Testes Playwright para upload flow + asset detail
4. README com: npm run dev, variáveis, estrutura

Actualiza o PROGRESS.md no final.
```

---

## PROMPT 4 — Claude | Log Analysis + Debug Engine

**Agente:** Claude  
**Onde executar:** Google Antigravity → Chat IA → Claude  
**O que cria:** Sistema de análise de logs e debugging automático

```
PROJECTO: Nexora Media Processing

Antes de começar, lê o ficheiro PROGRESS.md.

ROLE: Engenheiro de diagnóstico — análise de logs e debugging

FERRAMENTAS A ANALISAR:
- FFmpeg stderr (verbosidade total)
- MediaInfo JSON output
- MediaConch policy XML reports
- BullMQ job logs
- BS1770GAIN XML output

INPUT FORMAT:
{
  "asset_id": "uuid",
  "logs": {
    "ffmpeg_stderr": "...",
    "mediainfo_json": {...},
    "mediaconch_report": "...",
    "bullmq_job": {...}
  }
}

OUTPUT FORMAT:
{
  "asset_id": "uuid",
  "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
  "root_cause": {
    "category": "codec|container|audio|io|hardware|network|config|unknown",
    "description": "Descrição em português para operador",
    "technical_detail": "Detalhe técnico para engenheiro",
    "evidence": ["linha de log relevante"]
  },
  "issues_found": [
    {
      "code": "ERR_GOP_OPEN|ERR_VFR|ERR_LUFS|ERR_VMAF|ERR_CORRUPT|...",
      "severity": "critical|warning|info",
      "raw_evidence": "excerto exacto do log"
    }
  ],
  "fix_strategy": {
    "action": "retry|adjust_params|reject|manual_review|escalate",
    "automated_fix_possible": true|false,
    "steps": ["Passo 1", "Passo 2"],
    "ffmpeg_params_to_change": { "remove": [...], "add": [...] }
  },
  "retry_recommendation": {
    "should_retry": boolean,
    "max_retries": 0|1|2|3,
    "backoff_seconds": [1, 10, 60]
  }
}

PADRÕES DE ERRO A RECONHECER:

CRÍTICO:
  "moov atom not found" → container corrompido
  "Invalid data found" → stream corrompido
  "Conversion failed!" → encode falhou
  
ALTO (retry com ajuste):
  "DTS .* out of order" → problema timestamps → -fflags +igndts
  "Past duration .* too large" → ajustar VBV
  
ÁUDIO:
  True Peak > -1 dBTP → normalização falhou
  LUFS desvio > 1 LU → two-pass falhou

FERRAMENTAS A CONSTRUIR:
1. NexoraLogParser — parse FFmpeg stderr em eventos estruturados
2. NexoraPatternMatcher — match padrões + severity + code
3. NexoraDiagnosticEngine — correlacionar logs → root_cause
4. NexoraFixSuggester — root_cause + issues → fix_strategy
5. NexoraRetryAdvisor — fix_strategy → parâmetros de retry
6. NexoraDailyDigest — relatório 24h (top 10 erros)
7. NexoraAnomalyDetector — alerta se taxa de erro aumenta vs baseline

Actualiza o PROGRESS.md no final.
```

---

## PROMPT 5 — Claude | FFmpeg + GPU + VMAF + Performance

**Agente:** Claude  
**Onde executar:** Google Antigravity → Chat IA → Claude  
**O que cria:** Comandos FFmpeg optimizados, detecção GPU, two-pass R128

```
PROJECTO: Nexora Media Processing

Antes de começar, lê o ficheiro PROGRESS.md.

ROLE: Engenheiro de optimização FFmpeg e performance

FERRAMENTAS:
FFmpeg 6.x com: libx264, libx265, libvpx-vp9, libfdk_aac, libopus,
libvmaf, nvenc (NVIDIA), qsv (Intel), amf (AMD)

TASK 1: FFMPEG COMMAND BUILDER

Para cada perfil, gerar 2 comandos (GPU + CPU fallback):

NEXORA BROADCAST HD — CPU:
ffmpeg -y -i {input}
  -c:v libx264 -preset slow -tune film
  -profile:v high -level:v 4.1
  -pix_fmt yuv420p
  -g {gop} -keyint_min {gop} -sc_threshold 0 -flags +cgop
  -x264-params "open-gop=0:bframes=0:ref=4:nal-hrd=cbr:force-cfr=1"
  -b:v {bitrate}k -maxrate {maxrate}k -bufsize {bufsize}k
  -colorspace bt709 -color_primaries bt709 -color_trc bt709
  -r 25 -vsync cfr
  -c:a pcm_s24le -ar 48000
  {audio_loudnorm}
  -movflags +faststart {output}

NEXORA BROADCAST HD — GPU (NVENC):
ffmpeg -y -hwaccel cuda -hwaccel_output_format cuda -i {input}
  -c:v h264_nvenc -preset p4 -tune hq
  -profile:v high -level:v 4.1
  -pix_fmt yuv420p
  -g {gop} -keyint_min {gop} -forced-idr 1 -no-scenecut 1
  -b:v {bitrate}k -maxrate {maxrate}k -bufsize {bufsize}k -rc cbr
  -colorspace bt709 -color_primaries bt709 -color_trc bt709
  -c:a pcm_s24le -ar 48000
  {audio_loudnorm}
  -movflags +faststart {output}

NEXORA PROXY — HandBrake (mais rápido para proxies):
HandBrakeCLI --input {input} --output {output}
  --preset-import-file nexora-presets.json
  --preset "NexoraProxyLowRes" --json

TASK 2: GPU DETECTION

1. nvidia-smi → CUDA disponível?
2. vainfo → VAAPI disponível (Intel/AMD)?
3. Encode de teste (5 frames) → GPU funciona?
4. Fallback automático para CPU se falhar
5. Cache resultado (re-verificar cada 30min)

TASK 3: TWO-PASS EBU R128

Pass 1:
ffmpeg -i {input}
  -af "loudnorm=I=-{target}:TP=-1:LRA=11:print_format=json"
  -f null -

Parse: input_i, input_tp, input_lra, input_thresh, target_offset

Pass 2:
ffmpeg -i {input}
  -af "loudnorm=I=-{target}:TP=-1:LRA=11:
       measured_I={input_i}:measured_TP={input_tp}:
       measured_LRA={input_lra}:measured_thresh={input_thresh}:
       offset={target_offset}:linear=true" {output}

Validação BS1770GAIN:
bs1770gain --ebu --integrated --truepeak --xml {output}
→ LUFS ±0.5 do target E True Peak ≤ -1.0 dBTP
→ Se falhar: retry com offset ±0.5 LU, máx 3 tentativas

TASK 4: VMAF INTEGRATION

ffmpeg -i {reference} -i {encoded}
  -lavfi "[0:v][1:v]libvmaf=log_fmt=json:log_path={log}:
          n_subsample=5:model=version=vmaf_v0.6.1" -f null -

Thresholds: archive≥93 | broadcast≥90 | streaming≥85 | proxy≥70
Usar 1st percentile como floor

ENTREGÁVEIS:
1. NexoraFFmpegCommandBuilder (type-safe, nunca string shell)
2. NexoraGPUDetector com test-encode
3. NexoraLoudnessNormalizer (two-pass + BS1770GAIN verify)
4. NexoraVMAFScorer com threshold logic e retry
5. NexoraJobScheduler com priority queuing
6. nexora-presets.json (HandBrake presets)
7. Benchmarks GPU vs CPU

Actualiza o PROGRESS.md no final.
```

---

## PROMPT 6 — Claude | Docker + CI/CD + Infra

**Agente:** Claude  
**Onde executar:** Google Antigravity → Chat IA → Claude  
**O que cria:** Docker Compose completo, GitHub Actions, Grafana dashboards

```
PROJECTO: Nexora Media Processing

Antes de começar, lê o ficheiro PROGRESS.md.

ROLE: DevOps / Infrastructure Engineer

DOCKER COMPOSE — 10 serviços:
1.  nexora-api      → Fastify — port 3000
2.  nexora-worker   → BullMQ workers — sem port externo
3.  temporal        → Temporal.io server — port 7233
4.  temporal-ui     → Temporal web UI — port 8080
5.  postgres        → PostgreSQL 15 — port 5432
6.  redis           → Redis 7 — port 6379
7.  minio           → MinIO — ports 9000, 9001
8.  prometheus      → Métricas — port 9090
9.  grafana         → Dashboards — port 3001
10. loki            → Logs — port 3100

IMAGEM CUSTOM nexora-media-tools:
Base: ubuntu:22.04
Instalar: ffmpeg 6.x (libvmaf, libx264, libx265, libfdk_aac)
Instalar: mediainfo, ffprobe, mediaconch, bs1770gain, HandBrakeCLI
Instalar: Node.js 20 LTS
User não-root: nexora (UID 1001)

Resource limits:
  nexora-api: 1 CPU, 512MB RAM
  nexora-worker: 4 CPU, 8GB RAM
  postgres: 2 CPU, 2GB RAM
  redis: 0.5 CPU, 512MB RAM

GRAFANA DASHBOARDS (provisionar automaticamente):
1. Nexora Overview: jobs/min, success rate, queue depth, avg transcode time
2. Nexora Quality: VMAF distribution, loudness histogram, rejection rate
3. Nexora Infrastructure: CPU/RAM/disk, FFmpeg process count

ALERTAS PROMETHEUS:
  NexoraPipelineStalled: queue_depth > 50 por 10m → critical
  NexoraHighRejectionRate: rejection_rate > 0.20 por 5m → warning
  NexoraWorkerDown: heartbeat ausente 2m → critical
  NexoraLowVMAF: vmaf_p50 < 85 por 15m → warning
  NexoraFFmpegTimeout: timeout_total aumenta → critical
  NexoraDiskWarning: disk_usage > 80% → warning

GITHUB ACTIONS (.github/workflows/):
  test.yml: vitest + coverage ≥ 80%
  lint.yml: eslint + prettier
  build.yml: docker build + push
  deploy-staging.yml: docker compose pull + up
  deploy-prod.yml: aprovação manual → blue-green

HEALTH CHECKS:
  GET /health → { status, timestamp, version, uptime }
  GET /health/ready → DB + Redis + MinIO conectados
  GET /health/live → processo vivo

SCRIPTS npm:
dev, build, test, test:watch, test:coverage, lint,
db:migrate, db:seed, db:studio, queue:flush, worker, fixtures:generate

Actualiza o PROGRESS.md no final.
```

---

## PROMPT 7 — Claude | Segurança + Auth + Hardening

**Agente:** Claude  
**Onde executar:** Google Antigravity → Chat IA → Claude  
**O que cria:** JWT RS256, validação de ficheiros, prevenção de injecção

```
PROJECTO: Nexora Media Processing

Antes de começar, lê o ficheiro PROGRESS.md.

ROLE: Security Engineer — Nexora Media Processing

THREAT MODEL:
- Acesso não autorizado a assets (conteúdo pré-lançamento)
- Path traversal em ficheiros
- SSRF via URL ingest
- Injecção FFmpeg via nomes de ficheiro maliciosos
- Resource exhaustion (file bomb, uploads oversized)

TASK 1: AUTH RS256 JWT

interface NexoraJWTPayload {
  sub: string; org: string;
  roles: ('admin'|'operator'|'viewer'|'api')[];
  jti: string; iat: number; exp: number;
}

Implementar:
1. RSA key pair 4096-bit + rotação cada 30 dias (chave antiga válida 7 dias)
2. JWT middleware Fastify
3. Token revocation em Redis (por jti)
4. API key: hash+salt, nunca plaintext
5. Rate limiting por identidade: user 1000/min | api 5000/min

TASK 2: VALIDAÇÃO DE FICHEIROS

Layer 1 — Magic bytes:
  mp4: ftyp box | mxf: 06 0E 2B 34 | mpeg-ts: 0x47
  mkv: 1A 45 DF A3 | wav: RIFF | mp3: ID3/FF FB | aac: FF F1

Layer 2 — Limites:
  max 50GB | min 1KB | filename max 255 chars
  Rejeitar: ../ ./ \0 | & ; ` $ ( ) { }

Layer 3 — Sanitização:
  Apenas [a-zA-Z0-9._-] no filename
  UUID interno IMEDIATAMENTE no ingest
  NUNCA usar filename original em shell

Layer 4 — SSRF (URL ingest):
  http/https apenas
  Rejeitar IPs privados: 127.x | 10.x | 172.16-31.x | 192.168.x | ::1
  Max 3 redirects, re-verificar IPs após cada redirect

TASK 3: FFMPEG INJECTION PREVENTION

NUNCA: exec(`ffmpeg ${someString}`)
SEMPRE: execFile('ffmpeg', commandArray, options)

class NexoraFFmpegCommandBuilder {
  validateInputPath(p: string): string {
    const allowed = [process.env.NEXORA_INPUT_DIR, process.env.NEXORA_TEMP_DIR];
    const resolved = path.resolve(p);
    if (!allowed.some(dir => resolved.startsWith(path.resolve(dir!)))) {
      throw new NexoraSecurityError('Path fora das directorias permitidas');
    }
    return resolved;
  }
}

TASK 4: AUDIT TRAIL TAMPER-EVIDENT

entry_hash = SHA256(previous_entry_hash + entry_content)
Verificação periódica cada 6h
Cadeia quebrada → CRITICAL ALERT imediato

ENTREGÁVEIS:
1. Auth middleware com 100% coverage
2. File validation pipeline com testes de injecção
3. FFmpegCommandBuilder com injection prevention
4. Audit chain integrity system
5. Mapa OWASP Top 10 → implementação

Actualiza o PROGRESS.md no final.
```

---

## PROMPT 8 — Claude | Testes Completos + QA

**Agente:** Claude  
**Onde executar:** Google Antigravity → Chat IA → Claude  
**O que cria:** Testes unitários, integração, E2E, performance

```
PROJECTO: Nexora Media Processing

Antes de começar, lê o ficheiro PROGRESS.md.

ROLE: QA & Test Engineer

TEST STACK:
- Vitest + Testcontainers (unit + integration)
- Supertest (E2E API)
- Playwright (E2E Frontend)
- k6 (performance)

FIXTURES (gerar com FFmpeg — sem copyright):

# Referência perfeita broadcast-safe
ffmpeg -f lavfi -i "testsrc2=duration=30:size=1920x1080:rate=25" \
  -f lavfi -i "sine=frequency=1000:duration=30:sample_rate=48000" \
  -c:v libx264 -profile:v high -level:v 4.1 -pix_fmt yuv420p \
  -g 50 -keyint_min 50 -sc_threshold 0 -flags +cgop -bf 0 \
  -b:v 8000k -maxrate 8000k -bufsize 16000k -c:a pcm_s24le -ar 48000 \
  -movflags +faststart fixtures/nexora_reference_broadcast.mp4

# Problemas (cada um testa um erro específico):
- nexora_problem_open_gop.mp4    → -x264-params "open-gop=1:bframes=3"
- nexora_problem_vfr.mp4         → -vsync vfr
- nexora_problem_loud.mp4        → -af "volume=10dB"
- nexora_problem_corrupt.mp4     → head -c 1000000 reference.mp4

UNIT TESTS OBRIGATÓRIOS (100% coverage nas QC rules):

describe('NexoraVideoQCRules', () => {
  // gopRule: passes closed GOP, fails open GOP (critical, ERR_GOP_OPEN)
  // cfrRule: passes CFR, fails VFR (critical)
  // pixelFormatRule: passes yuv420p, fails yuv422p
})

describe('NexoraAudioQCRules', () => {
  // truePeakRule: passes -1.5dBTP, fails -0.5dBTP, fails 0.0dBTP (critical)
  // sampleRateRule: passes 48000Hz, fails 44100Hz (warning)
})

describe('NexoraFFmpegCommandBuilder', () => {
  // sempre inclui -sc_threshold 0
  // sempre inclui -flags +cgop
  // GOP = fps * 2
  // rejeita path traversal → NexoraSecurityError
  // nunca produz string de shell — sempre arg array
})

INTEGRATION TESTS (Testcontainers):
  'rejeita ficheiro corrompido e cria audit entry'
  'normaliza loudness para -23 LUFS ±0.5 LU'
  'verifica True Peak ≤ -1.0 dBTP com BS1770GAIN'
  'open GOP força re-encode'

PERFORMANCE (k6):
  p95 < 500ms | p99 status < 200ms | error rate < 1%
  stages: ramp 10 → sustain 50 → spike 100 → ramp down

TARGETS:
  Cobertura: linhas ≥ 80% | branches ≥ 75%
  QC rules: 100% branches (safety-critical)
  Mutation score ≥ 75% (Stryker)

ENTREGÁVEIS:
1. Suite completa unit tests
2. Integration tests Testcontainers
3. E2E API (Supertest)
4. E2E Frontend (Playwright)
5. Performance tests k6
6. generate-fixtures.sh

Actualiza o PROGRESS.md no final.
```

---

## PROMPT 9 — Claude | Integração Open Source

**Agente:** Claude  
**Onde executar:** Google Antigravity → Chat IA → Claude  
**O que cria:** Adaptadores HandBrake, BS1770GAIN, MediaInfo, VLC

```
PROJECTO: Nexora Media Processing

Antes de começar, lê o ficheiro PROGRESS.md.

ROLE: Open Source Integration Engineer

TOOL SELECTION MATRIX:
| Job                  | Tool primário   | Fallback      |
|----------------------|-----------------|---------------|
| Broadcast transcode  | FFmpeg          | —             |
| OTT / CMAF           | FFmpeg          | —             |
| Proxy / Web encode   | HandBrakeCLI    | FFmpeg        |
| Loudness measure     | BS1770GAIN      | FFmpeg ebur128|
| Container analysis   | MediaInfo       | FFprobe       |
| Conformance check    | MediaConch      | —             |
| VMAF scoring         | FFmpeg libvmaf  | —             |
| Playback sanity      | VLC headless    | opcional      |
| Thumbnail sprites    | FFmpeg -vf tile | —             |

HANDBRAKE PRESETS (nexora-presets.json):
  NexoraProxyLowRes: x264 veryfast, 800kbps, 1280x720, aac 128kbps, Mp4HttpOptimize
  NexoraWebOptimized1080p: x264 slow, 4000kbps, 1920x1080, two-pass

NOTA: HandBrake NÃO garante Closed GOP com o mesmo rigor do FFmpeg.
Para proxies é aceitável. Para broadcast → SEMPRE FFmpeg.
Verificar output com FFprobe e logar warning se GOP não for closed.

BS1770GAIN:
bs1770gain --ebu --integrated --range --truepeak --xml {file}
NUNCA confiar apenas na medição FFmpeg do seu próprio output.

VLC HEADLESS (sanity check final):
vlc --intf dummy --no-video-display --play-and-exit
    --no-loop --run-time 10 --verbose 2 {file}
Apenas para nexora_broadcast_hd e nexora_ott_premium.

VERIFICAÇÃO STARTUP:
- which {tool} && {tool} --version
- CRITICAL se FFmpeg ou MediaInfo em falta
- WARNING se HandBrake ou BS1770GAIN em falta (fallback disponível)

ENTREGÁVEIS:
1. NexoraHandBrakeWorker com progress parsing
2. NexoraBS1770GainAnalyzer com XML parser
3. NexoraMediaInfoParser → MediaAnalysis interface
4. NexoraVLCPlaybackTester (headless)
5. NexoraToolSelector (lógica de decisão)
6. NexoraToolAvailabilityChecker (startup)
7. nexora-presets.json
8. Testes de integração com fixtures

Actualiza o PROGRESS.md no final.
```

---

## PROMPT 10 — Claude | Protocolo Multi-Agente + Coordenação Final

**Agente:** Claude  
**Onde executar:** Google Antigravity → Chat IA → Claude  
**O que cria:** Tipos partilhados, state machine, ADRs, protocolo de handoff

```
PROJECTO: Nexora Media Processing

Antes de começar, lê o ficheiro PROGRESS.md.
Verifica que todos os prompts anteriores (1-9) estão marcados como ✅.

ROLE: Arquitecto de integração — verificação final e coordenação

TASK 1: SHARED TYPES (@nexora/shared-types)

Criar packages/shared-types/src/index.ts com:

type NexoraAssetStatus = 
  | 'INGESTED' | 'QC_PENDING' | 'QC_PASS' | 'QC_QUARANTINE' | 'QC_REJECT'
  | 'ANALYZING' | 'TRANSCODING' | 'AUDIO_PROCESSING' | 'POST_QC'
  | 'DELIVERING' | 'READY' | 'FAILED';

const NEXORA_VALID_TRANSITIONS: Record<NexoraAssetStatus, NexoraAssetStatus[]> = {
  INGESTED:         ['QC_PENDING', 'QC_REJECT'],
  QC_PENDING:       ['QC_PASS', 'QC_QUARANTINE', 'QC_REJECT'],
  QC_PASS:          ['ANALYZING'],
  QC_QUARANTINE:    ['QC_PASS', 'QC_REJECT'],
  ANALYZING:        ['TRANSCODING'],
  TRANSCODING:      ['AUDIO_PROCESSING', 'POST_QC', 'FAILED'],
  AUDIO_PROCESSING: ['POST_QC', 'FAILED'],
  POST_QC:          ['DELIVERING', 'TRANSCODING', 'FAILED'],
  DELIVERING:       ['READY', 'FAILED'],
  READY:            [],
  FAILED:           ['QC_PENDING'],
  QC_REJECT:        [],
};

interface NexoraAgentEvent {
  event_id: string; timestamp: string; asset_id: string;
  agent: string; event_type: string;
  payload: Record<string, unknown>; correlation_id?: string;
}

TASK 2: VERIFICAÇÃO FINAL

Verificar que todos os componentes estão integrados:
1. API → BullMQ enfileira jobs → Workers processam → Temporal orquestra
2. QC rules → retornam NexoraQCResult → Orchestrator decide
3. FFmpeg executor → usa NexoraFFmpegCommandBuilder (nunca exec())
4. BS1770GAIN verifica loudness independentemente
5. VMAF score calculado e guardado em DB
6. SHA-256 calculado antes e depois de cada processamento
7. Audit trail append-only com hash chain
8. Prometheus expõe todas as métricas definidas
9. Grafana provisiona dashboards automaticamente

TASK 3: ADRS FINAIS

Criar docs/adr/ com ficheiros para cada ADR:
ADR-001 a ADR-010 (ver lista na secção PROGRESS.md)

TASK 4: README FINAL

Criar README.md completo com:
- O que é o Nexora
- Setup em < 10 comandos
- Arquitectura resumida
- Links para documentação
- Como contribuir

ENTREGÁVEIS:
1. packages/shared-types/ completo
2. Verificação de integração completa (relatório)
3. docs/adr/ com todos os ADRs
4. README.md final
5. PROGRESS.md actualizado e completo

Este é o prompt final. Após completar, o Nexora está pronto para produção.
```

---

*[Continua na Parte 2/2 — Partes 7 a 12]*
