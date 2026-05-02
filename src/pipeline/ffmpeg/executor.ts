
// Nexora Media Processing — FFmpeg Executor
// Ficheiro: src/pipeline/ffmpeg/executor.ts
//
// REGRA ADR-002: FFmpeg NUNCA é chamado com exec() + string.
// Sempre usa execFile() ou spawn() com array de argumentos.
// Isolado em processo filho com timeout e kill automático.
