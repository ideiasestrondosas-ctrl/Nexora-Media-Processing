
// Nexora Media Processing — Transcode Worker
// Ficheiro: src/workers/transcode.worker.ts
//
// Worker de transcoding de vídeo com todos os perfis Nexora.
// ADR-002: FFmpeg sempre via executor isolado com timeout.
// ADR-006: Parâmetros GOP obrigatórios em todos os perfis broadcast.
