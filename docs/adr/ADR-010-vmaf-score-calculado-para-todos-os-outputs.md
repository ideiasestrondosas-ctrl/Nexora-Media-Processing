# ADR-010: VMAF score calculado para todos os outputs

## Estado: ACCEPTED

## Contexto

É necessário garantir qualidade verificável de todos os ficheiros processados.

## Decisão

VMAF é calculado pós-encode para todos os perfis e o score é guardado na base de dados.

## Consequências

### Positivas
- Qualidade verificável e rastreável
- Permite deteção de regressões de qualidade

### Negativas
- Requer ficheiro de referência (mezzanine)
- Adiciona tempo ao pipeline

## Alternativas consideradas

- PSNR/SSIM — rejeitados por menor correlação com perceção humana

---

*ADR criado automaticamente pelo nexora-deploy-docs.js*
*Data: 2026-05-02*
