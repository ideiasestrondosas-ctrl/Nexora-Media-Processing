
// Nexora Media Processing — FFmpeg Command Builder
// Ficheiro: src/pipeline/ffmpeg/builder.ts
//
// SEGURANÇA (ADR-002):
// - Todos os paths são validados contra allowlist de directorias
// - Todos os parâmetros são tipados — sem interpolação de strings
// - Retorna string[] (array), nunca string única para exec()
