# ADR-009: BS1770GAIN para verificação independente

## Estado: ACCEPTED

## Contexto

O FFmpeg não deve ser o único a verificar o output que ele próprio criou.

## Decisão

BS1770GAIN é a ferramenta de verificação final de loudness, independente do FFmpeg.

## Consequências

### Positivas
- Validação cruzada por ferramenta diferente
- Detecta erros no FFmpeg que o próprio não detectaria

### Negativas
- Dependência extra de software

## Alternativas consideradas

- FFmpeg ebur128 para verificação — rejeitado por ser a mesma ferramenta a verificar o próprio output

---

*ADR criado automaticamente pelo nexora-deploy-docs.js*
*Data: 2026-05-02*
