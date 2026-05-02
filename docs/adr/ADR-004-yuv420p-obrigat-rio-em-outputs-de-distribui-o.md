# ADR-004: yuv420p obrigatório em outputs de distribuição

## Estado: ACCEPTED

## Contexto

Diferentes pixel formats têm diferentes níveis de compatibilidade com decoders.

## Decisão

Todos os outputs de distribuição usam yuv420p. Para HDR usa-se yuv420p10le.

## Consequências

### Positivas
- Compatibilidade máxima com hardware decoders, STBs, mobile
- Standard para H.264/H.265 broadcast

### Negativas
- Menor fidelidade de cor que yuv444p (aceitável para distribuição)

## Alternativas consideradas

- yuv422p — rejeitado por incompatibilidade com maioria dos decoders hardware

---

*ADR criado automaticamente pelo nexora-deploy-docs.js*
*Data: 2026-05-02*
