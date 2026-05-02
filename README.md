# Nexora Media Processing

> Plataforma profissional de processamento de media para Broadcast & OTT
> Stack 100% Open Source

## Setup rápido (10 comandos)

```bash
git clone https://github.com/[utilizador]/nexora-media-processing.git
cd nexora-media-processing
bash scripts/nexora-setup.sh
cp .env.example .env
# Edita o .env
npm install
docker compose up -d postgres redis minio temporal temporal-ui
sleep 30 && npm run db:migrate
npm run dev          # Terminal 1
npm run worker       # Terminal 2
```

## Interfaces

| Interface | URL | Login |
|---|---|---|
| App | http://localhost:3000 | — |
| Temporal UI | http://localhost:8080 | — |
| Grafana | http://localhost:3001 | admin/nexora |
| MinIO | http://localhost:9001 | nexoraadmin/nexora_minio_secret |

## Documentação

- [Manual completo](docs/manual-v4.md)
- [Estado do projecto](PROGRESS.md)
- [ADRs](docs/adr/)
- [API Reference](openapi.yaml)

## Licença: MIT
