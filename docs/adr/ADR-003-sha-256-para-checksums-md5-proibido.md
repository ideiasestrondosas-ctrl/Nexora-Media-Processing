# ADR-003: SHA-256 para checksums (MD5 proibido)

## Estado: ACCEPTED

## Contexto

O sistema calcula checksums de ficheiros de media para verificar integridade.

## Decisão

Todos os checksums usam SHA-256. MD5 está proibido.

## Consequências

### Positivas
- SHA-256 sem colisões conhecidas
- Standard da indústria para integridade de dados

### Negativas
- Ligeiramente mais lento que MD5 (negligenciável para ficheiros de media)

## Alternativas consideradas

- MD5 — rejeitado por colisões conhecidas desde 2004

---

*ADR criado automaticamente pelo nexora-deploy-docs.js*
*Data: 2026-05-02*
