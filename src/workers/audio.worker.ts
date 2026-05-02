
// Nexora Media Processing — Audio Worker
// Ficheiro: src/workers/audio.worker.ts
//
// Normalização de loudness EBU R128 em dois passos.
// ADR-005: Two-pass obrigatório + BS1770GAIN verificação independente.
// ADR-009: BS1770GAIN é a verificação final — nunca só o FFmpeg.
