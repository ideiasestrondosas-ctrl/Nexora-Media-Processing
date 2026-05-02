# ADR-002: FFmpeg via execFile/spawn (nunca exec)

## Estado: ACCEPTED

## Contexto

O sistema executa FFmpeg com parâmetros que podem incluir paths de ficheiros fornecidos externamente.

## Decisão

FFmpeg é sempre chamado via child_process.execFile() ou spawn() com array de argumentos. exec() com string interpolada é PROIBIDO.

## Consequências

### Positivas
- Previne command injection via nomes de ficheiro maliciosos
- Permite timeout controlado
- Permite kill do processo

### Negativas
- Ligeiramente mais verboso

## Alternativas consideradas

- exec() com string — rejeitado por risco de injection

---

*ADR criado automaticamente pelo nexora-deploy-docs.js*
*Data: 2026-05-02*
