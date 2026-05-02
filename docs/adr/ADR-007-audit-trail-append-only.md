# ADR-007: Audit trail append-only

## Estado: ACCEPTED

## Contexto

O audit trail é a prova legal de que um ficheiro passou por determinadas etapas de processamento.

## Decisão

A tabela audit_logs só permite INSERT. UPDATE e DELETE são proibidos por política de base de dados.

## Consequências

### Positivas
- Integridade legal dos registos
- Detecção de tampering via hash chain

### Negativas
- A tabela cresce indefinidamente (gerir com particionamento por mês)

## Alternativas consideradas

- Tabela normal com UPDATE — rejeitado por risco de adulteração

---

*ADR criado automaticamente pelo nexora-deploy-docs.js*
*Data: 2026-05-02*
