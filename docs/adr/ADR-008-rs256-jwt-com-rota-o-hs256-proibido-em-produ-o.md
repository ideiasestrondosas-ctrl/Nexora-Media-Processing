# ADR-008: RS256 JWT com rotação (HS256 proibido em produção)

## Estado: ACCEPTED

## Contexto

O sistema precisa de autenticação segura para a API.

## Decisão

JWT usa RS256 (chave assimétrica). HS256 é proibido em produção. Rotação de chaves a cada 30 dias.

## Consequências

### Positivas
- Chave pública pode ser partilhada sem risco
- Rotação sem downtime

### Negativas
- Mais complexo que HS256

## Alternativas consideradas

- HS256 — rejeitado por risco de comprometer secret key

---

*ADR criado automaticamente pelo nexora-deploy-docs.js*
*Data: 2026-05-02*
