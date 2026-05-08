# Nexora Media Processing — Desktop Nativo
## Guia de Execução: Claude Code & Google Antigravity IDE
### Passo a Passo Completo — v1.0

> **Para quem é:** Para qualquer pessoa, mesmo sem experiência, que quer construir
> o Nexora Desktop usando Claude Code (terminal) ou Google Antigravity (IDE visual).
>
> **O que vais construir:** A aplicação nativa Windows/macOS/Linux do Nexora Desktop,
> conforme especificado em `arquitetura/nexora-desktop-documento.md`.
>
> **Tempo estimado:** 2-3 semanas de desenvolvimento assistido por IA.
>
> **Versão:** 1.0 | Maio 2026

---

# ════════════════════════════════════════
# ÍNDICE
# ════════════════════════════════════════

```
SECÇÃO 0 — ANTES DE COMEÇAR: O QUE SÃO ESTES DOIS MODOS?
SECÇÃO 1 — PREPARAÇÃO COMUM (obrigatória para ambos)
SECÇÃO 2 — MODO A: GOOGLE ANTIGRAVITY IDE (visual, recomendado)
SECÇÃO 3 — MODO B: CLAUDE CODE (terminal, para mais experientes)
SECÇÃO 4 — FLUXO DE TRABALHO DIÁRIO (após configuração inicial)
SECÇÃO 5 — RESOLVER PROBLEMAS COMUNS
SECÇÃO 6 — VERIFICAR SE CORREU TUDO BEM
```

---

---

# ════════════════════════════════════════
# SECÇÃO 0 — ANTES DE COMEÇAR
# ════════════════════════════════════════

## O que são estes dois modos?

Existem duas formas de executar os prompts do documento Desktop:

```
┌─────────────────────────────────────────────────────────────┐
│  MODO A — Google Antigravity IDE                            │
│                                                             │
│  Interface visual. Parece o VS Code.                        │
│  Tens um painel de chat com IA (Claude, Gemini, ChatGPT)    │
│  ao lado do código.                                         │
│  ✓ Vês os ficheiros a serem criados em tempo real           │
│  ✓ Podes editar o que a IA gera antes de aceitar            │
│  ✓ Mais fácil para iniciantes                               │
│  ✓ Melhor para trabalho visual (UI, componentes React)      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  MODO B — Claude Code                                       │
│                                                             │
│  Interface de terminal (linha de comandos).                 │
│  Escreves "claude" no terminal e falas com o Claude.        │
│  ✓ Claude acede directamente a todos os teus ficheiros      │
│  ✓ Executa comandos no terminal por si só                   │
│  ✓ Mais autónomo — menos intervenção tua                    │
│  ✓ Melhor para backend, Rust, scripts complexos             │
└─────────────────────────────────────────────────────────────┘
```

## Qual escolher?

**Se és iniciante absoluto** → começa pelo **Antigravity** (Modo A). É mais visual.

**Se já usas o terminal** → usa **Claude Code** (Modo B) para as partes de backend (Rust, sidecar) e o Antigravity para o frontend (React).

**Combinação ideal (recomendada):**

| Prompt | Ferramenta ideal |
|---|---|
| Prompt Desktop 1 (Tauri + SQLite + Rust) | Claude Code |
| Prompt Desktop 2 (Sidecar + Workers) | Claude Code |
| Prompt Desktop 3 (Frontend React) | Antigravity (Gemini ou Claude) |
| Prompt Desktop 4 (Build + Testes) | Claude Code |

---

---

# ════════════════════════════════════════
# SECÇÃO 1 — PREPARAÇÃO COMUM
# (obrigatória para ambos os modos)
# ════════════════════════════════════════

> **Faz isto primeiro, independentemente de usares Antigravity ou Claude Code.**

---

## PASSO 1.1 — Instalar as ferramentas base

### Se estás no macOS

Abre o **Terminal** (procura "Terminal" no Spotlight com Cmd+Espaço) e corre estes comandos **um a um**:

```bash
# Instalar Homebrew (gestor de pacotes do macOS)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Instalar Node.js 20, Git
brew install node@20 git

# Instalar Rust
brew install rustup-init
rustup-init -y
source "$HOME/.cargo/env"

# Instalar Xcode CLI tools (necessário para compilar Rust)
xcode-select --install

# Instalar FFmpeg e MediaInfo (para testes)
brew install ffmpeg mediainfo

# Adicionar targets de compilação macOS
rustup target add x86_64-apple-darwin
rustup target add aarch64-apple-darwin
```

### Se estás no Windows

Abre o **PowerShell como Administrador** (clica com botão direito no PowerShell → "Executar como Administrador") e corre:

```powershell
# Instalar Chocolatey (gestor de pacotes Windows)
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Instalar Node.js, Git, Rust
choco install nodejs-lts git rustup.install -y

# FECHAR o PowerShell e REABRIR como Administrador

# Instalar Visual Studio Build Tools (necessário para compilar Rust)
choco install visualstudio2022buildtools -y
choco install visualstudio2022-workload-vctools -y

# Instalar FFmpeg
choco install ffmpeg mediainfo-cli -y
```

### Se estás no Linux (Ubuntu/Debian)

Abre um **Terminal** e corre:

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git build-essential

# Instalar Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

# Instalar dependências do Tauri (OBRIGATÓRIO no Linux)
sudo apt install -y \
  libwebkit2gtk-4.1-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev \
  pkg-config libssl-dev

# Instalar FFmpeg e MediaInfo
sudo apt install -y ffmpeg mediainfo
```

---

## PASSO 1.2 — Verificar que tudo está instalado

Corre estes comandos no terminal. **Todos devem responder com números de versão:**

```bash
node --version
# Deve mostrar: v20.x.x

cargo --version
# Deve mostrar: cargo 1.77.x (ou superior)

git --version
# Deve mostrar: git version 2.x.x

ffmpeg -version
# Deve mostrar: ffmpeg version 6.x (ou superior)
```

Se algum falhar, volta ao Passo 1.1 e repete a instalação desse item.

---

## PASSO 1.3 — Ir para o workspace do projecto

O projecto Nexora já existe no teu computador. Vai para a pasta:

```bash
# macOS/Linux:
cd ~/Documents/nexora-media-processing

# Windows (PowerShell):
cd "C:\Dev\Nexora Media Processing"
```

Se ainda não tens a pasta, clona do GitHub primeiro:

```bash
git clone https://github.com/TEU-USERNAME/nexora-media-processing.git
cd nexora-media-processing
```

---

## PASSO 1.4 — Copiar os documentos do Desktop para o workspace

Os documentos que criámos precisam de estar na pasta `arquitetura/`:

```bash
# Verificar que os documentos estão lá
ls arquitetura/

# Deve ver (entre outros ficheiros):
# nexora-desktop-documento.md
# (se não estiver, copia manualmente do local onde o descarregaste)
```

Copia também o `PROGRESS-DESKTOP.md` para a raiz:

```bash
# O ficheiro deve estar em:
ls PROGRESS-DESKTOP.md

# Se não estiver, copia de onde o descarregaste:
cp /caminho/para/PROGRESS-DESKTOP.md .
```

---

## PASSO 1.5 — Criar a pasta do projecto Desktop

```bash
# Ainda dentro do workspace principal
npm create tauri-app@latest nexora-desktop -- --template react-ts
```

O terminal vai fazer várias perguntas. Responde assim:

```
? Project name: nexora-desktop
? Choose which language to use for your frontend: TypeScript / JavaScript → TypeScript
? Choose your package manager: npm
? Choose your UI template: React
? Choose your UI flavor: TypeScript
```

Depois:

```bash
# Entrar na pasta do desktop
cd nexora-desktop

# Instalar dependências base do Tauri
npm install

# Instalar dependências adicionais do Nexora Desktop
npm install zustand better-sqlite3 esbuild concurrently
npm install -D @types/better-sqlite3 vitest @vitest/coverage-v8 eslint

# Criar estrutura de pastas necessária
mkdir -p sidecar/queue sidecar/pipeline sidecar/workers sidecar/profiles sidecar/db sidecar/dist
mkdir -p src-tauri/binaries
mkdir -p tests/fixtures
mkdir -p scripts

# Verificar que o Tauri funciona (abre uma janela de teste)
npm run tauri dev
# Deverá abrir uma janela com "Welcome to Tauri"
# Fecha a janela e volta ao terminal (Ctrl+C)
```

Se chegaste aqui e tudo funcionou — **estás pronto** para escolher o teu modo.

---

---

# ════════════════════════════════════════
# SECÇÃO 2 — MODO A: GOOGLE ANTIGRAVITY IDE
# (Recomendado para iniciantes)
# ════════════════════════════════════════

## O que é o Google Antigravity?

É um editor de código (parecido com o VS Code) que tem o **Claude, Gemini e ChatGPT integrados directamente**. Podes abrir um chat com qualquer um deles e eles vêem os teus ficheiros, criam código, e explicam o que estão a fazer.

---

## PASSO 2.1 — Instalar o Google Antigravity

1. Vai ao site do Google Antigravity e faz download
2. Instala como uma aplicação normal
3. Abre o Antigravity

---

## PASSO 2.2 — Abrir o projecto Desktop no Antigravity

1. No Antigravity, clica em **File → Open Folder** (ou **Ficheiro → Abrir Pasta**)
2. Navega até à pasta `nexora-desktop` que criaste no Passo 1.5
3. Clica em "Abrir" / "Select Folder"

Deverás ver a árvore de ficheiros à esquerda com a pasta `nexora-desktop`.

---

## PASSO 2.3 — Configurar as regras do projecto no Antigravity

Este passo é **muito importante** — diz ao Antigravity para ler o `PROGRESS-DESKTOP.md` antes de trabalhar.

1. No Antigravity, vai a **File → Preferences → Settings** (ou prima `Ctrl+,` / `Cmd+,`)
2. Procura por **"AI Instructions"** ou **"Custom Instructions"** ou **"Rules"**
3. Adiciona este texto:

```
REGRA OBRIGATÓRIA PARA ESTE PROJECTO (Nexora Media Processing Desktop):

1. Antes de qualquer trabalho, lê o ficheiro PROGRESS-DESKTOP.md na raiz do projecto
2. Também lê arquitetura/nexora-desktop-documento.md para contexto completo
3. Após completares o teu trabalho, actualiza o PROGRESS-DESKTOP.md:
   - Marca como ✓ o que ficou concluído
   - Adiciona uma linha ao histórico de sessões com data e ficheiros criados
4. Nunca refaças trabalho que já está marcado como concluído
5. Código em inglês, comentários em português de Portugal
6. FFmpeg sempre via execFile (NUNCA exec com string)
7. TypeScript strict mode — sem "any" implícito
```

4. Guarda as definições.

---

## PASSO 2.4 — Abrir o painel de IA

No Antigravity, o painel de chat com IA abre-se de formas diferentes conforme a versão:

- Prima `Ctrl+Shift+I` (Windows/Linux) ou `Cmd+Shift+I` (macOS)
- Ou clica no ícone de IA na barra lateral (geralmente parece um robot ou uma estrela)
- Ou vai a **View → AI Panel**

Selecciona o agente: **Claude** (preferido para backend/Rust) ou **Gemini** (bom para frontend React).

---

## PASSO 2.5 — Executar o Prompt Desktop 1 (Tauri + SQLite + IPC)

**Quando executar:** Semana 1, Dias 1-2.

1. No painel de IA, **certifica-te que o agente é Claude**
2. Cola o seguinte texto no chat e prime Enter:

```
Lê primeiro o ficheiro PROGRESS-DESKTOP.md na raiz do projecto e o ficheiro 
arquitetura/nexora-desktop-documento.md (especialmente a PARTE 5.1).

Agora executa a PARTE 5.1 — Prompt Desktop 1 do documento:
- Configura o tauri.conf.json completo conforme especificado
- Cria src-tauri/src/db/schema.sql com todas as tabelas
- Implementa migrations.rs com sistema automático de migrations
- Implementa todos os Tauri Commands em commands/assets.rs, jobs.rs, settings.rs, system.rs
- Implementa tray.rs com system tray e menu contextual
- Implementa sidecar.rs para gestão do processo Node.js

Segue exactamente as especificações do documento. Quando terminares,
actualiza o PROGRESS-DESKTOP.md marcando o que foi feito.
```

3. **Aguarda** — o agente vai criar os ficheiros. Podes ver cada ficheiro a aparecer na árvore à esquerda.

4. Se o agente pedir confirmação para criar/editar ficheiros, **clica em "Accept"** ou "Aceitar".

5. Quando terminar, verifica no terminal que o Rust compila:

```bash
# No terminal integrado do Antigravity (Ver → Terminal, ou Ctrl+`)
cd src-tauri
cargo check
# Deve mostrar: Finished ou warning mínimos, sem errors
cd ..
```

6. Se houver erros, cola a mensagem de erro de volta no chat do Antigravity:
```
Obtive este erro ao correr "cargo check":
[cola aqui o erro]
Corrige por favor.
```

---

## PASSO 2.6 — Executar o Prompt Desktop 2 (Sidecar + Workers)

**Quando executar:** Semana 1, Dias 3-5.

1. No painel de IA (ainda com Claude), cola:

```
Lê o PROGRESS-DESKTOP.md actualizado e continua o trabalho.

Executa agora a PARTE 5.2 — Prompt Desktop 2 do documento arquitetura/nexora-desktop-documento.md:
- Implementa NexoraSimpleQueue em sidecar/queue/simple-queue.ts
- Implementa NexoraDesktopOrchestrator em sidecar/pipeline/desktop-orchestrator.ts
- Implementa todos os 8 workers em sidecar/workers/
- Cria os 6 perfis de transcode JSON em sidecar/profiles/
- Implementa a comunicação sidecar ↔ Tauri via stdout/JSON

Segue exactamente as especificações. Actualiza o PROGRESS-DESKTOP.md no fim.
```

2. Aguarda. Este prompt é o mais longo — pode demorar vários minutos.

3. Quando terminar, verifica que o sidecar compila:

```bash
# No terminal integrado
npx esbuild sidecar/index.ts --bundle --platform=node --outfile=sidecar/dist/sidecar.js
# Deve terminar sem erros
```

---

## PASSO 2.7 — Executar o Prompt Desktop 3 (Frontend React)

**Quando executar:** Semana 2, Dias 1-3.

Para o frontend, podes usar **Gemini** (excelente para UI) ou Claude.

1. No painel de IA, **muda para Gemini** se quiseres (ou fica com Claude)
2. Cola:

```
Lê o PROGRESS-DESKTOP.md actualizado e continua o trabalho.

Executa agora a PARTE 5.3 — Prompt Desktop 3 do documento arquitetura/nexora-desktop-documento.md:
- Cria todos os componentes UI em src/components/
- Cria as 3 páginas em src/pages/ (ProcessPage, HistoryPage, SettingsPage)
- Implementa os hooks em src/hooks/
- Configura os stores Zustand em src/store/
- A interface deve ser simples, com 3 tabs, paleta Nexora (#1A6FD4, #4FB8A0)
- Suporte a tema claro/escuro do sistema operativo
- Drag-and-drop funcional para ficheiros de media

Segue exactamente o layout e as especificações do documento.
Actualiza o PROGRESS-DESKTOP.md no fim.
```

3. Quando terminar, verifica que o frontend compila:

```bash
npm run build
# Deve criar a pasta dist/ sem erros
```

---

## PASSO 2.8 — Executar o Prompt Desktop 4 (Build + Testes)

**Quando executar:** Semana 2, Dias 4-5.

1. De volta ao Claude no painel de IA:

```
Lê o PROGRESS-DESKTOP.md actualizado e continua o trabalho.

Executa agora a PARTE 5.4 — Prompt Desktop 4 do documento arquitetura/nexora-desktop-documento.md:
- Cria .github/workflows/build-desktop.yml para build das 3 plataformas
- Cria scripts/download-media-binaries.js
- Cria tests/fixtures/generate-fixtures.sh
- Cria os ficheiros de teste (queue.test.ts, orchestrator.test.ts, workers.test.ts)
- Configura o package.json com todos os scripts necessários
- Cria README-DESKTOP.md

Actualiza o PROGRESS-DESKTOP.md no fim.
```

---

## PASSO 2.9 — Testar a aplicação em modo desenvolvimento

```bash
# No terminal integrado do Antigravity

# 1. Descarregar binários de media (FFmpeg, MediaInfo, etc.)
npm run download:binaries
# Aguarda — pode demorar alguns minutos

# 2. Iniciar a aplicação em modo desenvolvimento
npm run dev
# Vai abrir a janela do Nexora Desktop
```

Se tudo correr bem, verás:
- A janela do Nexora abre com 3 tabs (Processar, Histórico, Definições)
- No canto superior aparece a GPU detectada (ex: "NVIDIA RTX 3060")
- A drop zone está visível no tab "Processar"
- O ícone do Nexora aparece na barra do sistema (system tray)

---

## PASSO 2.10 — Testar com um ficheiro real

1. Arrasta um ficheiro de vídeo (MP4, MOV, MKV) para a drop zone
2. Selecciona o perfil desejado (ex: "Broadcast H.264 1080p")
3. O processamento inicia automaticamente
4. Acompanha o progresso na barra
5. Quando terminar, recebes uma notificação do sistema operativo
6. Clica em "Abrir pasta de saída" para ver o ficheiro processado

---

## PASSO 2.11 — Correr os testes

```bash
# Gerar ficheiros de teste
npm run fixtures:generate

# Correr todos os testes
npm test

# Ver cobertura
npm run test:coverage
```

---

## PASSO 2.12 — Build final

```bash
# Build para a tua plataforma
npm run build

# O instalador ficará em:
# src-tauri/target/release/bundle/
```

---

---

# ════════════════════════════════════════
# SECÇÃO 3 — MODO B: CLAUDE CODE
# (Terminal — para mais autónomo)
# ════════════════════════════════════════

## O que é o Claude Code?

É uma ferramenta de terminal criada pela Anthropic. Corres `claude` no terminal, e o Claude:
- Lê todos os teus ficheiros automaticamente
- Escreve código directamente nos ficheiros
- Executa comandos no terminal por si mesmo
- Pede confirmação antes de fazer coisas importantes

---

## PASSO 3.1 — Instalar o Claude Code

```bash
# Instalar globalmente via npm
npm install -g @anthropic-ai/claude-code

# Verificar instalação
claude --version
# Deve mostrar a versão instalada

# Autenticar (abre o browser para fazer login)
claude login
```

Se tiveres uma chave de API da Anthropic:

```bash
# Alternativa: usar variável de ambiente
export ANTHROPIC_API_KEY="sk-ant-api03-..."
# No Windows PowerShell:
$env:ANTHROPIC_API_KEY = "sk-ant-api03-..."
```

---

## PASSO 3.2 — Configurar o Claude Code para o projecto

1. Vai para a pasta do Desktop:

```bash
cd caminho/para/nexora-media-processing/nexora-desktop
```

2. Cria um ficheiro de configuração local do Claude Code:

```bash
# macOS/Linux
cat > .claude/config.json << 'EOF'
{
  "project_name": "Nexora Media Processing Desktop",
  "language": "pt-PT",
  "always_read_files": ["../PROGRESS-DESKTOP.md", "../arquitetura/nexora-desktop-documento.md"],
  "pre_task_instructions": "Antes de qualquer trabalho: 1) Lê PROGRESS-DESKTOP.md na raiz do workspace. 2) Lê arquitetura/nexora-desktop-documento.md. 3) Actualiza PROGRESS-DESKTOP.md no fim com o que fizeste.",
  "code_rules": [
    "TypeScript strict mode — sem any implícito",
    "FFmpeg sempre via execFile (NUNCA exec com string)",
    "Código em inglês, comentários em português de Portugal",
    "Todos os IDs são UUID v4",
    "Todos os erros são typed"
  ]
}
EOF
```

```powershell
# Windows PowerShell
New-Item -ItemType Directory -Force -Path ".claude"
@'
{
  "project_name": "Nexora Media Processing Desktop",
  "language": "pt-PT",
  "always_read_files": ["../PROGRESS-DESKTOP.md", "../arquitetura/nexora-desktop-documento.md"],
  "pre_task_instructions": "Antes de qualquer trabalho: 1) Lê PROGRESS-DESKTOP.md na raiz do workspace. 2) Lê arquitetura/nexora-desktop-documento.md. 3) Actualiza PROGRESS-DESKTOP.md no fim com o que fizeste.",
  "code_rules": [
    "TypeScript strict mode — sem any implícito",
    "FFmpeg sempre via execFile (NUNCA exec com string)",
    "Código em inglês, comentários em português de Portugal",
    "Todos os IDs são UUID v4",
    "Todos os erros são typed"
  ]
}
'@ | Out-File -FilePath ".claude\config.json" -Encoding UTF8
```

3. Cria também um ficheiro `CLAUDE.md` na raiz do workspace (o Claude Code lê este ficheiro automaticamente):

```bash
# Vai para a raiz do workspace (não para nexora-desktop)
cd ..

cat > CLAUDE.md << 'EOF'
# Nexora Media Processing — Instruções para Claude Code

## Leitura obrigatória antes de qualquer trabalho
1. Lê `PROGRESS-DESKTOP.md` para o estado do módulo Desktop
2. Lê `PROGRESS.md` para o estado do módulo Server
3. Lê `arquitetura/nexora-desktop-documento.md` para especificação Desktop completa

## Regras invioláveis
- TypeScript strict mode — sem `any` implícito
- FFmpeg SEMPRE via execFile (NUNCA exec com string)
- Código em inglês, comentários em português de Portugal
- Todos os IDs são UUID v4
- Nunca refaças trabalho já marcado como concluído no PROGRESS

## Após cada sessão
Actualiza o PROGRESS-DESKTOP.md:
- Marca ✓ o que foi concluído
- Adiciona linha ao histórico com data + ficheiros criados

## Stack Desktop
- Shell: Tauri 2.x (Rust)
- Frontend: React 18 + TypeScript + Tailwind + Zustand
- Sidecar: Node.js 20 + TypeScript
- DB: SQLite via better-sqlite3
- Build: GitHub Actions (Tauri Action)
EOF
```

---

## PASSO 3.3 — Abrir o Claude Code no projecto Desktop

```bash
# Vai para a pasta do Desktop
cd caminho/para/nexora-media-processing/nexora-desktop

# Iniciar o Claude Code
claude
```

O terminal muda — agora estás a falar directamente com o Claude. Verás um prompt como:

```
Claude Code v1.x.x
Workspace: nexora-desktop
Type your message (or /help for commands)

>
```

---

## PASSO 3.4 — Executar o Prompt Desktop 1 (Tauri + SQLite + IPC)

**Quando executar:** Semana 1, Dias 1-2.

No prompt do Claude Code, escreve:

```
Lê o ../PROGRESS-DESKTOP.md e o ../arquitetura/nexora-desktop-documento.md 
(especialmente a PARTE 5.1 — Prompt Desktop 1).

Depois executa exactamente o Prompt Desktop 1:
- Configura tauri.conf.json completo
- Cria schema.sql com todas as tabelas
- Implementa migrations.rs
- Implementa todos os Tauri Commands (assets.rs, jobs.rs, settings.rs, system.rs)
- Implementa tray.rs com system tray
- Implementa sidecar.rs

Quando o Claude Code pedir confirmação para criar ficheiros, responde "yes".
Quando terminar, actualiza ../PROGRESS-DESKTOP.md.
```

O Claude Code vai:
1. Ler os documentos automaticamente
2. Criar os ficheiros um a um
3. Pedir confirmação antes de executar comandos no terminal
4. Mostrar o que está a fazer em cada passo

**Para aceitar cada acção**, escreve `yes` ou prime Enter quando pedido.

**Para rejeitar uma acção**, escreve `no` e explica o porquê.

Depois de terminar, verifica:

```bash
# Ainda dentro do Claude Code, pede para verificar:
Corre "cargo check" dentro de src-tauri/ e mostra-me o resultado.
```

Ou sai do Claude Code (`/exit` ou `Ctrl+C`) e verifica manualmente:

```bash
cd src-tauri
cargo check
cd ..
```

---

## PASSO 3.5 — Executar o Prompt Desktop 2 (Sidecar + Workers)

**Quando executar:** Semana 1, Dias 3-5.

```bash
# Reiniciar o Claude Code (ou continua se já estás dentro)
claude
```

No prompt:

```
Lê o ../PROGRESS-DESKTOP.md actualizado.

Executa agora o Prompt Desktop 2 da PARTE 5.2 do documento 
../arquitetura/nexora-desktop-documento.md:
- Cria NexoraSimpleQueue em sidecar/queue/simple-queue.ts
- Cria NexoraDesktopOrchestrator em sidecar/pipeline/desktop-orchestrator.ts
- Cria todos os 8 workers em sidecar/workers/
- Cria os 6 perfis de transcode JSON em sidecar/profiles/
- Configura a comunicação sidecar ↔ Tauri

Quando terminar, corre "npx esbuild sidecar/index.ts --bundle --platform=node 
--outfile=sidecar/dist/sidecar.js" para verificar que compila.
Actualiza ../PROGRESS-DESKTOP.md.
```

---

## PASSO 3.6 — Executar o Prompt Desktop 3 (Frontend React)

**Quando executar:** Semana 2, Dias 1-3.

```
Lê o ../PROGRESS-DESKTOP.md actualizado.

Executa o Prompt Desktop 3 da PARTE 5.3 do documento 
../arquitetura/nexora-desktop-documento.md:
- Cria todos os componentes em src/components/
- Cria as 3 páginas em src/pages/
- Implementa os hooks em src/hooks/
- Configura os stores Zustand
- Interface com 3 tabs, paleta Nexora (#1A6FD4, #4FB8A0)
- Suporte tema claro/escuro
- Drag-and-drop funcional

Quando terminar, corre "npm run build" para verificar.
Actualiza ../PROGRESS-DESKTOP.md.
```

---

## PASSO 3.7 — Executar o Prompt Desktop 4 (Build + Testes)

**Quando executar:** Semana 2, Dias 4-5.

```
Lê o ../PROGRESS-DESKTOP.md actualizado.

Executa o Prompt Desktop 4 da PARTE 5.4 do documento 
../arquitetura/nexora-desktop-documento.md:
- Cria .github/workflows/build-desktop.yml
- Cria scripts/download-media-binaries.js
- Cria tests/fixtures/generate-fixtures.sh
- Cria os testes (queue.test.ts, orchestrator.test.ts, workers.test.ts)
- Configura o package.json com todos os scripts
- Cria README-DESKTOP.md

Actualiza ../PROGRESS-DESKTOP.md.
```

---

## PASSO 3.8 — Testar tudo no Claude Code

Podes pedir ao Claude Code para testar directamente:

```
Corre os seguintes passos em sequência e mostra-me o resultado de cada um:
1. npm run download:binaries
2. npm run fixtures:generate
3. npm test
4. npm run build
```

O Claude Code vai executar os comandos e mostrar-te os resultados. Se algo falhar, vai tentar corrigir automaticamente.

---

## PASSO 3.9 — Comandos úteis do Claude Code

```bash
# Dentro do Claude Code:

/help             # Ver todos os comandos disponíveis
/files            # Ver todos os ficheiros que o Claude leu
/undo             # Desfazer a última acção
/diff             # Ver o que mudou nos ficheiros
/exit             # Sair do Claude Code

# Pedir ao Claude Code para fazer coisas específicas:
"Mostra-me o conteúdo do PROGRESS-DESKTOP.md"
"Quais os ficheiros que foram criados até agora?"
"Há erros no TypeScript? Corre tsc --noEmit e mostra-me"
"O cargo check está a dar erro X. Corrige."
```

---

---

# ════════════════════════════════════════
# SECÇÃO 4 — FLUXO DE TRABALHO DIÁRIO
# (após configuração inicial)
# ════════════════════════════════════════

Depois de ter tudo configurado, cada sessão de trabalho segue este padrão:

## No Antigravity

```
1. Abre o Antigravity
2. Abre a pasta nexora-desktop
3. Abre o painel de IA (Ctrl+Shift+I)
4. Primeira mensagem SEMPRE:
   "Lê o PROGRESS-DESKTOP.md e diz-me o que está por fazer."
5. O agente diz o que falta
6. Pedes para fazer o próximo item
7. No fim: "Actualiza o PROGRESS-DESKTOP.md com o que fizeste hoje."
```

## No Claude Code

```bash
cd nexora-desktop
claude

# Primeira mensagem SEMPRE:
> Lê ../PROGRESS-DESKTOP.md e diz-me o estado actual e o que falta fazer.

# O Claude responde com o estado
# Pedes para continuar o próximo passo
# No fim pedes para actualizar o PROGRESS-DESKTOP.md
```

## Guardar o trabalho no GitHub (fazer a todos os dias)

```bash
# Fora do Claude Code (no terminal normal)
cd caminho/para/nexora-media-processing

git add .
git commit -m "Desktop: [descreve o que fizeste hoje]"
git push origin main
```

---

---

# ════════════════════════════════════════
# SECÇÃO 5 — RESOLVER PROBLEMAS COMUNS
# ════════════════════════════════════════

## "cargo check dá erro"

Cola o erro no chat do Antigravity ou no Claude Code:
```
O cargo check deu este erro. Corrige:
[cola o erro aqui]
```

## "npm install falha"

```bash
# Limpar cache e tentar novamente
npm cache clean --force
rm -rf node_modules
npm install
```

## "A janela Tauri abre em branco"

```bash
# Verificar se o Vite dev server está a correr
npm run dev:sidecar &
npm run tauri dev
```

Se continuar em branco, actualiza os drivers de GPU.

## "FFmpeg not found ao processar"

```bash
# Verificar que os binários foram descarregados
ls src-tauri/binaries/
# Deve ter: ffmpeg-*, ffprobe-*, etc.

# Se não tiver:
npm run download:binaries
```

## "No Linux: libwebkit2gtk not found"

```bash
sudo apt install -y libwebkit2gtk-4.1-0 libgtk-3-0
```

## "No macOS: 'App cannot be opened'"

Ctrl+clique na app → "Abrir" (bypass do Gatekeeper).

## "O agente IA está a fazer coisas erradas"

Para qualquer agente (Antigravity ou Claude Code):
```
Para. Lê novamente o PROGRESS-DESKTOP.md e o arquitetura/nexora-desktop-documento.md
antes de continuar. O que fizeste não está correcto porque [explica].
Desfaz o que fizeste e recomeça seguindo exactamente o documento.
```

## "Perdi o histórico do que foi feito"

O `PROGRESS-DESKTOP.md` tem tudo registado. Abre-o e lê a secção "Histórico de sessões".

---

---

# ════════════════════════════════════════
# SECÇÃO 6 — VERIFICAR SE CORREU TUDO BEM
# ════════════════════════════════════════

No final do desenvolvimento, verifica estes pontos antes de considerar o Desktop pronto:

## Verificação rápida (terminal)

```bash
# 1. Rust compila sem erros
cd src-tauri && cargo check && cd ..

# 2. Sidecar compila
npx esbuild sidecar/index.ts --bundle --platform=node --outfile=sidecar/dist/sidecar.js

# 3. Frontend compila
npm run build

# 4. Testes passam
npm test

# 5. App abre em desenvolvimento
npm run dev
```

## Verificação funcional (manual)

```
[ ] A app abre sem erros
[ ] GPU aparece no cabeçalho (ex: "NVIDIA RTX 3060")
[ ] Drag-and-drop de um MP4 inicia o processamento
[ ] Barra de progresso mostra step + percentagem + ETA
[ ] Recebo notificação do SO quando termina
[ ] O ficheiro output está na pasta configurada
[ ] "Abrir pasta de saída" abre o explorador de ficheiros
[ ] Tab Histórico mostra o asset processado com VMAF score
[ ] Tab Definições permite mudar pasta de output
[ ] System tray mostra ícone Nexora
```

## Verificação de qualidade do output

```bash
# Verificar que o output tem GOP correcto
ffprobe -v quiet -print_format json -show_streams output.mp4 | grep -E "gop|keyframe"

# Verificar LUFS do output
bs1770gain output.mp4
# Deve mostrar próximo de -23 LUFS (broadcast) ou -14 LUFS (streaming)
```

---

---

# ════════════════════════════════════════
# RESUMO VISUAL: SEQUÊNCIA COMPLETA
# ════════════════════════════════════════

```
┌─────────────────────────────────────────────────────────────┐
│  SEMANA 0 (1-2 dias) — PREPARAÇÃO                           │
│                                                             │
│  [todos os SO]  Instalar Node.js + Rust + Git + FFmpeg      │
│  [terminal]     npm create tauri-app nexora-desktop         │
│  [terminal]     npm install (deps adicionais)               │
│  [Antigravity]  Configurar regras de IA                     │
│  [terminal]     claude (instalar Claude Code)               │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  SEMANA 1 (5 dias) — BACKEND                                │
│                                                             │
│  Dias 1-2: Prompt Desktop 1                                 │
│    → Tauri setup + SQLite schema + migrations               │
│    → Tauri Commands (IPC) + System Tray                     │
│    Ferramenta: Claude Code ou Antigravity (Claude)          │
│    Verificar: cargo check ✓                                 │
│                                                             │
│  Dias 3-5: Prompt Desktop 2                                 │
│    → NexoraSimpleQueue + NexoraDesktopOrchestrator          │
│    → 8 workers de media + 6 perfis de transcode             │
│    Ferramenta: Claude Code ou Antigravity (Claude)          │
│    Verificar: esbuild sidecar ✓                             │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  SEMANA 2 (5 dias) — FRONTEND + BUILD                       │
│                                                             │
│  Dias 1-3: Prompt Desktop 3                                 │
│    → Componentes React + 3 páginas + hooks + stores         │
│    → Drag-and-drop + tema claro/escuro                      │
│    Ferramenta: Antigravity (Gemini ou Claude)               │
│    Verificar: npm run build ✓                               │
│                                                             │
│  Dias 4-5: Prompt Desktop 4                                 │
│    → GitHub Actions + script binários + testes              │
│    Ferramenta: Claude Code ou Antigravity                   │
│    Verificar: npm test ✓                                    │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  SEMANA 3 (5 dias) — INTEGRAÇÃO E LANÇAMENTO                │
│                                                             │
│  Dias 1-3: Testar em desenvolvimento (npm run dev)          │
│    → Testar com ficheiros reais                             │
│    → Corrigir bugs com ajuda da IA                          │
│                                                             │
│  Dia 4: Build final                                         │
│    → npm run build (instalador da tua plataforma)           │
│                                                             │
│  Dia 5: GitHub Release                                      │
│    → git tag v0.1.0                                         │
│    → git push origin v0.1.0                                 │
│    → GitHub Actions faz build das 3 plataformas             │
│    → Download dos instaladores em GitHub Releases           │
└─────────────────────────────────────────────────────────────┘
```

---

*Nexora Media Processing — Guia de Execução Desktop v1.0*
*Para usar em conjunto com: arquitetura/nexora-desktop-documento.md*
*Língua: Português de Portugal · Maio 2026*
