# ADR-001: Temporal.io para orquestração

## Estado: ACCEPTED

## Contexto

O sistema precisa de orquestrar workflows complexos com múltiplos passos, retry automático, e capacidade de recovery após falhas.

## Decisão

Usar Temporal.io como orquestrador principal. BullMQ continua a ser usado para filas simples, mas toda a lógica de workflow usa Temporal.

## Consequências

### Positivas
- Workflows stateful com histórico completo
- Retry automático com backoff configurável
- Recovery após crash sem perda de estado
- Dashboard de monitorização nativo

### Negativas
- Infraestrutura adicional (servidor Temporal)
- Curva de aprendizagem

## Alternativas consideradas

- BullMQ standalone — rejeitado porque não tem estado de workflow persistente
- Airflow — rejeitado por ser Python e não ter tipagem TypeScript

---

*ADR criado automaticamente pelo nexora-deploy-docs.js*
*Data: 2026-05-02*
