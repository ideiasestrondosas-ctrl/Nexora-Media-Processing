# Nexora Media Processing — Frontend

Aplicação SPA baseada no Next.js 14 App Router, construída para gestão, monitorização e ingestão de media para o pipeline Nexora.

## Stack Técnica

- **Framework**: Next.js 14 (React 18)
- **Estilos**: Tailwind CSS
- **Componentes**: shadcn/ui (Radix UI) + Lucide Icons
- **Gestão de Estado Global**: Zustand
- **Gestão de Dados do Servidor**: TanStack Query
- **Testes E2E**: Playwright

## Comandos de Desenvolvimento

```bash
# Instalar dependências
npm install

# Correr servidor de desenvolvimento
npm run dev

# Fazer lint ao código
npm run lint

# Fazer build de produção
npm run build

# Correr testes end-to-end
npm run test:e2e
```

## Arquitetura de Componentes

- `src/components/ui`: Componentes isolados e independentes (fornecidos pelo shadcn).
- `src/components/layout`: Estrutura global da página (Sidebar, Header).
- `src/components/assets`: Componentes de domínio multimédia (AssetCard, UploadZone, etc).
- `src/components/dashboard`: Gráficos (Recharts).
- `src/components/queue`: Painéis de monitorização do BullMQ.
- `src/store`: Gestão de estado Zustand (`auth.ts` e `ui.ts`).
