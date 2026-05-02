# Navegar para o projecto
cd "C:\Dev\Nexora Media Processing"

# 1 — Instalar Node.js, Docker, FFmpeg (demora 10-15 min)
Set-ExecutionPolicy Bypass -Scope Process -Force
.\arquitetura\nexora-setup.ps1

# 2 — Criar estrutura de pastas e ficheiros base
node arquitetura\nexora-scaffold.js

# 3 — Criar PROGRESS.md, ADRs, Prometheus, Grafana
node arquitetura\nexora-deploy-docs.js

# 4 — Criar Dockerfiles, GitHub Actions, configs
node arquitetura\nexora-finalize.js

# 5 — Mover TUDO para as directorias correctas (automático!)
.\nexora-mover-tudo.ps1

# 6 — Configurar ambiente
copy .env.example .env
# Abre o .env no Antigravity e muda as passwords se quiseres

# 7 — Instalar dependências Node.js
npm install

# 8 — Iniciar Docker (base de dados, Redis, MinIO, Temporal...)
docker compose up -d

# 9 — Aguardar e aplicar migrações
Start-Sleep -Seconds 30
npm run db:migrate
npm run db:seed

# 10 — Verificar que tudo está a correr
curl http://localhost:3000/health