# Nexora Media Processing

> Plataforma profissional de processamento de media para Broadcast & OTT  
> Stack 100% Open Source · EBU R128 · AS-11 · CMAF · VMAF

[![Tests](https://github.com/ideiasestrondosas-ctrl/Nexora-Media-Processing/actions/workflows/test.yml/badge.svg)](https://github.com/ideiasestrondosas-ctrl/Nexora-Media-Processing/actions/workflows/test.yml)
[![Build Docker](https://github.com/ideiasestrondosas-ctrl/Nexora-Media-Processing/actions/workflows/build.yml/badge.svg)](https://github.com/ideiasestrondosas-ctrl/Nexora-Media-Processing/actions/workflows/build.yml)

---

## O que é

O Nexora Media Processing recebe ficheiros de vídeo e áudio, valida-os automaticamente contra os standards de broadcast, corrige problemas de qualidade, converte-os para os formatos pedidos e entrega-os prontos a emitir.

**Pipeline:** Ingest → QC pré → Análise → Transcode + Áudio → Proxy → QC pós → Delivery

---

## Começar em 10 comandos

```bash
# 1. Clonar o repositório
git clone https://github.com/ideiasestrondosas-ctrl/Nexora-Media-Processing.git
cd nexora-media-processing

# 2. Executar setup do ambiente (instala todas as ferramentas)
bash scripts/nexora-setup.sh

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Edita o .env com as tuas configurações

# 4. Instalar dependências Node.js
npm install

# 5. Iniciar serviços de infra via Docker
docker compose up -d postgres redis minio temporal temporal-ui

# 6. Aguardar serviços iniciarem (~30 segundos)
sleep 30

# 7. Aplicar migrações da base de dados
npm run db:migrate

# 8. Colocar dados de teste (opcional)
npm run db:seed

# 9. Iniciar a API
npm run dev

# 10. Iniciar os workers (em novo terminal)
npm run worker
```

---

---
19: 
20: ## 🛠️ Gestão do Ambiente (CLI)
21: 
22: O Nexora inclui um gestor de ambiente em PowerShell para facilitar o desenvolvimento local sem necessidade de múltiplos terminais abertos.
23: 
24: ### Comandos Rápidos
25: ```powershell
26: .\nexora.ps1          # Abre o menu interactivo
27: .\nexora.ps1 start    # Inicia tudo em background
28: .\nexora.ps1 stop     # Pára tudo
29: .\nexora.ps1 status   # Verifica o estado dos serviços
30: .\nexora.ps1 logs backend  # Segue os logs do backend
31: .\nexora.ps1 reset    # Limpa tudo (Docker, DB, Logs) e reinicia
32: ```
33: 
34: Os logs de execução em background são guardados na pasta `.logs/`.
35: 
36: ---
37: 
38: ## Interfaces e Acessos

| Interface | URL | Credenciais (Padrão) |
|---|---|---|
| **App / Dashboard** | http://localhost:3000 | — |
| **Temporal UI** | http://localhost:8080 | — |
| **Grafana** | http://localhost:3001 | `admin` / `nexora` |
| **MinIO Console** | http://localhost:9001 | `nexoraadmin` / `nexora_minio_secret` |
| **Prometheus** | http://localhost:9090 | — |

---

## Arquitectura

```
Ingest → QC & Validação → Intelligence → Processing → QC Pós-encode → Delivery
                                              ↓
                              Workers distribuídos (Temporal.io):
                              Transcode · Áudio · Legendas · DRM · Proxy
```

**Stack:** Node.js 20 + TypeScript + Fastify + BullMQ + Redis + PostgreSQL + MinIO + Temporal.io  
**Frontend:** Next.js 14 + React + Tailwind CSS  
**Media tools:** FFmpeg · HandBrakeCLI · MediaInfo · FFprobe · MediaConch · BS1770GAIN

---

## Perfis de encoding profissionais

| Perfil | Formato | Uso |
|---|---|---|
| `nexora_broadcast_hd` | MXF OP1a + H.264 | Broadcasters (RTP, SIC, TVI, BBC...) |
| `nexora_ott_premium` | CMAF + H.265 + DRM | Netflix, Amazon, Disney+ |
| `nexora_streaming_web` | MP4 + H.264 ladder | YouTube, web players |
| `nexora_proxy_lowres` | MP4 480p 800kbps | Revisão editorial |
| `nexora_archive` | MXF + ProRes 4444 | Arquivo profissional |

---

## Standards cobertos

EBU R128 · ITU-R BS.1770-4 · AS-11 UK DPP · IMF SMPTE ST 2067 ·
CMAF ISO 23000-19 · EBU Core · Apple HLS Authoring · DASH-IF IOP ·
Harding FPA · SCTE-35 · SPEKE/CPIX · Netflix per-title encoding

---

## Comandos de Desenvolvimento

```bash
npm run dev              # API em modo desenvolvimento
npm run worker           # Workers BullMQ / Temporal
npm test                 # Testes unitários e de integração
npm run test:coverage    # Testes com relatório de cobertura
npm run lint             # Verificação de estilo (ESLint)
npm run db:studio        # Interface visual da base de dados (Prisma)
bash scripts/healthcheck.sh  # Verificação de saúde de todos os serviços
```

---

## Documentação

- [Manual técnico completo](docs/manual-v4.md)
- [Estado do projecto](PROGRESS.md)
- [Architecture Decision Records (ADRs)](docs/adr/)
- [API Reference (Swagger/OpenAPI)](openapi.yaml)

---

## Licença

Este projecto está licenciado sob a Licença MIT — ver o ficheiro [LICENSE](LICENSE) para detalhes.
