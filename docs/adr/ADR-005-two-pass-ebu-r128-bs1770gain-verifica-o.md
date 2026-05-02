# ADR-005: Two-pass EBU R128 + BS1770GAIN verificação

## Estado: ACCEPTED

## Contexto

A normalização de loudness em dois passos é mais precisa. BS1770GAIN verifica independentemente.

## Decisão

Two-pass EBU R128 obrigatório. BS1770GAIN verifica o resultado independentemente do FFmpeg.

## Consequências

### Positivas
- Two-pass garante linear=true (sem compressão dinâmica)
- BS1770GAIN é ferramenta independente do FFmpeg — não pode verificar o próprio output

### Negativas
- Requer dois passes (2× o tempo de encoding de áudio)
- BS1770GAIN é dependência extra

## Alternativas consideradas

- Single-pass — rejeitado por menor precisão

---

*ADR criado automaticamente pelo nexora-deploy-docs.js*
*Data: 2026-05-02*
