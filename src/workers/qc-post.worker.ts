
// Nexora — QC Post-Encode Worker
// Ficheiro: src/workers/qc-post.worker.ts
//
// Verifica qualidade após encode: VMAF + loudness + SHA-256 + conformance.
// ADR-009: BS1770GAIN verifica loudness independentemente.
// ADR-010: VMAF calculado e guardado para todos os outputs.
