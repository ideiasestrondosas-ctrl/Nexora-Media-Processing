# ADR-006: Closed GOP + IDR frames obrigatório

## Estado: ACCEPTED

## Contexto

Playout systems broadcast requerem que possam começar a decodificar em qualquer ponto do stream.

## Decisão

Todos os outputs broadcast têm Closed GOP, IDR frames obrigatórios, e sc_threshold=0.

## Consequências

### Positivas
- Compatibilidade com todos os playout systems
- Permite switching e seeking sem artefactos

### Negativas
- Ligeiramente menos eficiente que Open GOP (negligenciável)

## Alternativas consideradas

- Open GOP — rejeitado por causar artefactos em playout switching

---

*ADR criado automaticamente pelo nexora-deploy-docs.js*
*Data: 2026-05-02*
