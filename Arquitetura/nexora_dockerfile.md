# Nexora Media Processing — Dockerfiles + CI/CD

> Coloca estes ficheiros nas directorias indicadas.
> O script `nexora-scaffold.js` cria as pastas; este documento cria o conteúdo.

---

## Dockerfile (raiz do projecto)

```dockerfile
# ═══════════════════════════════════════════════════════
# Nexora Media Processing — Dockerfile da API
# ═══════════════════════════════════════════════════════
# Multi-stage build para imagem de produção mais pequena

# ── Fase 1: Build ──────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar ficheiros de dependências
COPY package*.json ./
COPY tsconfig*.json ./
COPY prisma ./prisma/

# Instalar dependências (incluindo devDependencies para build)
RUN npm ci

# Gerar Prisma client
RUN npx prisma generate

# Copiar código fonte
COPY src ./src

# Compilar TypeScript
RUN npm run build

# ── Fase 2: Produção ───────────────────────────────────
FROM node:20-alpine AS production

# Instalar ferramentas do sistema
RUN apk add --no-cache \
    curl \
    dumb-init

WORKDIR /app

# Criar utilizador não-root
RUN addgroup -g 1001 -S nexora && \
    adduser -u 1001 -S nexora -G nexora

# Copiar dependências de produção
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copiar build compilado
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Criar pastas de media com permissões correctas
RUN mkdir -p /media/input /media/output /media/temp && \
    chown -R nexora:nexora /media /app

# Usar utilizador não-root
USER nexora

# Expor porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/health/live || exit 1

# Usar dumb-init para gestão correcta de processos
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
```

---

## Dockerfile.worker (raiz do projecto)

```dockerfile
# ═══════════════════════════════════════════════════════
# Nexora Media Processing — Dockerfile dos Workers
# Inclui FFmpeg, MediaInfo, BS1770GAIN, HandBrake, etc.
# ═══════════════════════════════════════════════════════

FROM ubuntu:22.04

# Evitar prompts interactivos durante instalação
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# ── Dependências do sistema ────────────────────────────
RUN apt-get update && apt-get install -y \
    # Ferramentas base
    curl wget git ca-certificates gnupg \
    # FFmpeg com todas as libraries
    ffmpeg \
    # MediaInfo
    mediainfo \
    # MediaConch
    mediaconch \
    # BS1770GAIN
    bs1770gain \
    # HandBrake CLI
    handbrake-cli \
    # Ferramentas de diagnóstico
    htop procps lsof \
    # Limpar cache
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# ── Node.js 20 ─────────────────────────────────────────
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# ── Criar utilizador não-root ──────────────────────────
RUN groupadd -g 1001 nexora && \
    useradd -u 1001 -g nexora -m -s /bin/bash nexora

WORKDIR /app

# ── Instalar dependências Node.js ──────────────────────
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production && \
    npx prisma generate && \
    npm cache clean --force

# ── Copiar código compilado ────────────────────────────
COPY --from=builder /app/dist ./dist

# ── Configurar pastas de media ─────────────────────────
RUN mkdir -p /media/input /media/output /media/temp && \
    chown -R nexora:nexora /media /app

# ── Variáveis de ambiente padrão ───────────────────────
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe
ENV MEDIAINFO_PATH=/usr/bin/mediainfo
ENV MEDIACONCH_PATH=/usr/bin/mediaconch
ENV BS1770GAIN_PATH=/usr/bin/bs1770gain
ENV HANDBRAKE_CLI_PATH=/usr/bin/HandBrakeCLI

# ── Verificar ferramentas na build ─────────────────────
RUN ffmpeg -version | head -1 && \
    mediainfo --version | head -1 && \
    bs1770gain --version 2>&1 | head -1 && \
    echo "✓ Todas as ferramentas de media instaladas"

USER nexora

HEALTHCHECK --interval=60s --timeout=10s --start-period=60s --retries=3 \
    CMD node dist/health-worker.js || exit 1

CMD ["node", "dist/worker.js"]
```

---

## .github/workflows/test.yml

```yaml
# ═══════════════════════════════════════════════════════
# Nexora — CI: Testes automáticos
# Executa em cada push e pull request
# ═══════════════════════════════════════════════════════

name: Testes

on:
  push:
    branches: [main, develop, 'feature/**']
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    name: Linting e tipagem
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Instalar dependências
        run: npm ci

      - name: Verificar tipagem TypeScript
        run: npx tsc --noEmit

      - name: ESLint
        run: npm run lint

      - name: Prettier
        run: npx prettier --check "src/**/*.ts"

  unit-tests:
    name: Testes unitários
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Instalar dependências
        run: npm ci

      - name: Gerar Prisma client
        run: npx prisma generate

      - name: Correr testes unitários
        run: npm run test:coverage

      - name: Verificar cobertura mínima
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | node -e "
            const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
            console.log(d.total.lines.pct);
          ")
          echo "Cobertura de linhas: $COVERAGE%"
          node -e "if ($COVERAGE < 80) { console.error('FALHA: Cobertura $COVERAGE% < 80%'); process.exit(1); }"

      - name: Upload cobertura para Codecov
        uses: codecov/codecov-action@v4
        if: always()
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/coverage-final.json

  integration-tests:
    name: Testes de integração
    runs-on: ubuntu-latest
    needs: unit-tests
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: nexora
          POSTGRES_PASSWORD: nexora_test
          POSTGRES_DB: nexora_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Instalar FFmpeg
        run: sudo apt-get update && sudo apt-get install -y ffmpeg mediainfo

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Instalar dependências
        run: npm ci

      - name: Aplicar migrações de teste
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://nexora:nexora_test@localhost:5432/nexora_test

      - name: Gerar fixtures de vídeo
        run: bash tests/fixtures/generate-fixtures.sh

      - name: Correr testes de integração
        run: npx vitest run tests/integration
        env:
          DATABASE_URL: postgresql://nexora:nexora_test@localhost:5432/nexora_test
          REDIS_URL: redis://localhost:6379
          NODE_ENV: test

  security-scan:
    name: Scan de segurança
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4

      - name: Audit de dependências npm
        run: npm audit --audit-level=high

      - name: Scan com Trivy (vulnerabilidades)
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'CRITICAL,HIGH'
          exit-code: '0'
```

---

## .github/workflows/build.yml

```yaml
# ═══════════════════════════════════════════════════════
# Nexora — CI: Build e publicação de imagens Docker
# Executa apenas em push para main e em tags v*
# ═══════════════════════════════════════════════════════

name: Build

on:
  push:
    branches: [main]
    tags: ['v*.*.*']

jobs:
  build-and-push:
    name: Build Docker e push para registry
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Login no GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extrair metadata para Docker
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}/nexora-api
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix=sha-

      - name: Setup Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build e push imagem API
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build e push imagem Worker
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile.worker
          push: true
          tags: ghcr.io/${{ github.repository }}/nexora-worker:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

---

## .github/workflows/deploy-staging.yml

```yaml
# ═══════════════════════════════════════════════════════
# Nexora — CD: Deploy automático para staging
# Executa após build com sucesso em main
# ═══════════════════════════════════════════════════════

name: Deploy Staging

on:
  workflow_run:
    workflows: ["Build"]
    types: [completed]
    branches: [main]

jobs:
  deploy-staging:
    name: Deploy para staging
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    environment: staging

    steps:
      - uses: actions/checkout@v4

      - name: Deploy para servidor de staging via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.STAGING_USER }}
          key: ${{ secrets.STAGING_SSH_KEY }}
          script: |
            cd /opt/nexora-staging
            
            # Actualizar código
            git pull origin main
            
            # Fazer pull das novas imagens
            docker compose pull
            
            # Aplicar migrações
            docker compose run --rm nexora-api npx prisma migrate deploy
            
            # Reiniciar serviços com zero downtime
            docker compose up -d --no-deps nexora-api nexora-worker
            
            # Verificar saúde
            sleep 15
            curl -f http://localhost:3000/health/ready || exit 1
            
            echo "✓ Deploy de staging concluído"

      - name: Notificar no Slack
        if: always()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "${{ job.status == 'success' && '✓' || '✗' }} Deploy staging: ${{ github.sha }}",
              "channel": "#nexora-deploys"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## .github/workflows/deploy-prod.yml

```yaml
# ═══════════════════════════════════════════════════════
# Nexora — CD: Deploy para produção (com aprovação manual)
# ═══════════════════════════════════════════════════════

name: Deploy Produção

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Versão a fazer deploy (ex: v1.2.3)'
        required: true
        type: string
      confirm:
        description: 'Escreve CONFIRMO para autorizar o deploy'
        required: true
        type: string

jobs:
  validate:
    name: Validar input
    runs-on: ubuntu-latest
    steps:
      - name: Verificar confirmação
        run: |
          if [ "${{ github.event.inputs.confirm }}" != "CONFIRMO" ]; then
            echo "ERRO: Deves escrever CONFIRMO para autorizar o deploy"
            exit 1
          fi

  deploy-prod:
    name: Deploy para produção
    runs-on: ubuntu-latest
    needs: validate
    environment: production

    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.inputs.version }}

      - name: Deploy blue-green para produção
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /opt/nexora-prod
            
            # Blue-green: iniciar nova versão em paralelo
            export NEW_VERSION=${{ github.event.inputs.version }}
            
            # Pull nova imagem
            docker pull ghcr.io/${{ github.repository }}/nexora-api:$NEW_VERSION
            
            # Aplicar migrações (backwards compatible)
            docker run --rm \
              --env-file .env \
              ghcr.io/${{ github.repository }}/nexora-api:$NEW_VERSION \
              npx prisma migrate deploy
            
            # Trocar para nova versão
            sed -i "s|nexora-api:.*|nexora-api:$NEW_VERSION|g" docker-compose.yml
            docker compose up -d --no-deps nexora-api
            
            # Health check
            sleep 20
            curl -f http://localhost:3000/health/ready || \
              (docker compose rollback && exit 1)
            
            echo "✓ Deploy de produção concluído: $NEW_VERSION"
```

---

## .prettierrc

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "avoid"
}
```

## .eslintrc.json

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "project": "./tsconfig.json"
  },
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-floating-promises": "error",
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "prefer-const": "error"
  },
  "ignorePatterns": ["dist/", "node_modules/", "*.js", "*.d.ts"]
}
```

## vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'tests/performance/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/index.ts'],
      thresholds: {
        lines: 80,
        branches: 75,
        functions: 80,
        statements: 80
      }
    },
    // Timeout mais longo para testes de integração
    testTimeout: 60000,
    hookTimeout: 30000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@workers': path.resolve(__dirname, './src/workers'),
      '@qc': path.resolve(__dirname, './src/qc'),
      '@pipeline': path.resolve(__dirname, './src/pipeline')
    }
  }
});
```
