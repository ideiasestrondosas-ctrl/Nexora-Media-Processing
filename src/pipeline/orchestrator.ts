// Nexora Media Processing — Temporal.io Workflow Principal
// Ficheiro: src/pipeline/orchestrator.ts
//
// Orquestra todo o pipeline de processamento de um asset.
// ADR-001: Temporal.io para orquestração (não BullMQ standalone).
//
// ARQUITECTURA DO WORKFLOW:
// ╔══════════════════════════════════════════════════════════════╗
// ║ FASE 1 (Sequencial)                                         ║
// ║   1. validateQC()      timeout 5min,  3 tentativas          ║
// ║   2. analyzeContent()  timeout 10min, 2 tentativas          ║
// ╠══════════════════════════════════════════════════════════════╣
// ║ DECISÃO QC                                                   ║
// ║   REJECT    → emitir NexoraAssetRejected, terminar          ║
// ║   QUARANTINE → aguardar sinal humano (48h timeout)          ║
// ║   PASS      → continuar                                     ║
// ╠══════════════════════════════════════════════════════════════╣
// ║ FASE 2 (Paralelo)                                           ║
// ║   3a. transcodeVideo()    timeout 4h,   2 tentativas        ║
// ║   3b. normalizeAudio()    timeout 30min, 3 tentativas       ║
// ║   3c. processCaptions()   timeout 20min, 2 tent. (opcional) ║
// ╠══════════════════════════════════════════════════════════════╣
// ║ FASE 3 (Sequencial)                                         ║
// ║   4. generateProxies()    timeout 1h,   2 tentativas        ║
// ║   5. generateThumbnails() timeout 10min, 3 tentativas       ║
// ║   6. runPostEncodeQC()    timeout 30min, 1 tentativa        ║
// ║      → VMAF falha → re-encode CRF ajustado (max 2x)        ║
// ║   7. deliver()            timeout 2h,   3 tentativas        ║
// ╚══════════════════════════════════════════════════════════════╝

import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  condition,
  ApplicationFailure,
} from '@temporalio/workflow';

import type * as activities from './activities';

// ── Tipo de actividades (apenas types — sem import de node modules) ──

const {
  validateQC,
  analyzeContent,
  transcodeVideo,
  normalizeAudio,
  processCaptions,
  generateProxies,
  generateThumbnails,
  runPostEncodeQC,
  deliver,
} = proxyActivities<typeof activities>({
  // Retry policy global (todas as activities herdam, salvo override)
  retry: {
    backoffCoefficient: 10,
    initialInterval: '1s',
    maximumInterval: '60s',
    maximumAttempts: 3,
  },
  startToCloseTimeout: '10m', // default; cada activity faz override
});

// ── Signals ───────────────────────────────────────────────────────

/** Sinal para aprovar um asset em quarentena */
export const approveQuarantinedAssetSignal = defineSignal<[{ reason: string }]>(
  'approveQuarantinedAsset'
);

/** Sinal para rejeitar um asset em quarentena */
export const rejectQuarantinedAssetSignal = defineSignal<[{ reason: string }]>(
  'rejectQuarantinedAsset'
);

// ── Queries ───────────────────────────────────────────────────────

/** Query para obter o estado actual do workflow */
export const getWorkflowStatusQuery = defineQuery<WorkflowState>('getWorkflowStatus');

// ── Estado interno do workflow ────────────────────────────────────

interface WorkflowState {
  phase: string;
  assetId: string;
  startedAt: string;
  qcDecision?: string;
  quarantineApproved?: boolean;
  transcodeOutputKey?: string;
  vmafScore?: number;
  completedAt?: string;
  error?: string;
}

// ── Workflow principal ────────────────────────────────────────────

/**
 * Workflow principal de processamento de um asset.
 * Parametros: assetId — ID do asset a processar (UUID)
 */
export async function processAssetWorkflow(assetId: string): Promise<void> {
  const state: WorkflowState = {
    phase: 'STARTING',
    assetId,
    startedAt: new Date().toISOString(),
  };

  // Sinal de aprovação de quarentena
  let quarantineApproved: boolean | null = null;
  let quarantineDecisionReason = '';

  setHandler(approveQuarantinedAssetSignal, ({ reason }) => {
    quarantineApproved = true;
    quarantineDecisionReason = reason;
  });

  setHandler(rejectQuarantinedAssetSignal, ({ reason }) => {
    quarantineApproved = false;
    quarantineDecisionReason = reason;
  });

  setHandler(getWorkflowStatusQuery, () => state);

  const baseInput = { assetId, profile: 'broadcast-hd', workflowId: '' };

  // ╔══════════════════════════════════════════════════════════════╗
  // ║ FASE 1 — Sequencial: QC + Análise                           ║
  // ╚══════════════════════════════════════════════════════════════╝

  state.phase = 'QC_RUNNING';

  // Activity 1: validateQC — timeout 5min, 3 tentativas
  const qcResult = await validateQC(
    { ...baseInput },
    // Override de opções para esta activity específica
  );

  state.qcDecision = qcResult.decision;

  // ── Decisão QC ─────────────────────────────────────────────────

  if (qcResult.decision === 'REJECT') {
    state.phase = 'REJECTED';
    state.error = qcResult.summary;
    state.completedAt = new Date().toISOString();
    // Lançar falha de aplicação não-retryable para sinalizar rejeição
    throw ApplicationFailure.nonRetryable(
      `Asset ${assetId} rejeitado pelo QC: ${qcResult.summary}`,
      'NexoraAssetRejected',
      { assetId, qcSummary: qcResult.summary }
    );
  }

  if (qcResult.decision === 'QUARANTINE') {
    state.phase = 'QUARANTINE_PENDING';

    // Aguardar sinal humano com timeout de 48h
    const gotSignal = await condition(
      () => quarantineApproved !== null,
      '48h'
    );

    if (!gotSignal || quarantineApproved === false) {
      // Timeout ou rejeição humana
      state.phase = 'REJECTED';
      state.completedAt = new Date().toISOString();
      throw ApplicationFailure.nonRetryable(
        quarantineApproved === false
          ? `Asset ${assetId} rejeitado por revisão humana: ${quarantineDecisionReason}`
          : `Asset ${assetId} rejeitado: timeout de quarentena (48h) excedido`,
        'NexoraAssetRejected',
        { assetId, reason: quarantineDecisionReason }
      );
    }

    // Aprovado pelo revisor — continua o pipeline
    state.quarantineApproved = true;
    state.phase = 'QC_APPROVED_AFTER_QUARANTINE';
  }

  // Activity 2: analyzeContent — timeout 10min, 2 tentativas
  state.phase = 'ANALYZING';
  const qcInput = await analyzeContent({ ...baseInput });
  // Actualizar perfil com base na análise (se necessário)
  const profile = qcInput.profile ?? 'broadcast-hd';
  const fullInput = { ...baseInput, profile };

  // ╔══════════════════════════════════════════════════════════════╗
  // ║ FASE 2 — Paralelo: Transcode + Áudio + Legendas             ║
  // ╚══════════════════════════════════════════════════════════════╝

  state.phase = 'PROCESSING';

  const [transcodeResult, audioResult] = await Promise.all([
    // 3a. transcodeVideo — timeout 4h, 2 tentativas
    transcodeVideo({ ...fullInput, inputMinioKey: undefined }),

    // 3b. normalizeAudio — timeout 30min, 3 tentativas
    normalizeAudio({ ...fullInput }),

    // 3c. processCaptions — opcional (erro não bloqueia)
    processCaptions({ ...fullInput }).catch(() => null),
  ]);

  state.transcodeOutputKey = transcodeResult.outputKey;
  if (transcodeResult.vmafMean !== undefined) {
    state.vmafScore = transcodeResult.vmafMean;
  }

  // ╔══════════════════════════════════════════════════════════════╗
  // ║ FASE 3 — Sequencial: Proxies → Thumbnails → QC → Delivery  ║
  // ╚══════════════════════════════════════════════════════════════╝

  // Activity 4: generateProxies — timeout 1h, 2 tentativas
  state.phase = 'GENERATING_PROXIES';
  await generateProxies({ ...fullInput });

  // Activity 5: generateThumbnails — timeout 10min, 3 tentativas
  state.phase = 'GENERATING_THUMBNAILS';
  await generateThumbnails({ ...fullInput });

  // Activity 6: runPostEncodeQC — timeout 30min, 1 tentativa
  // Se VMAF falha → re-encode com CRF ajustado (max 2x)
  state.phase = 'POST_QC';
  let postQcResult = await runPostEncodeQC({
    ...fullInput,
    videoOutputKey: transcodeResult.outputKey,
  });

  if (!postQcResult.passed && postQcResult.reEncodeRequired) {
    // Re-encode 1ª vez com CRF ajustado
    state.phase = 'RE_ENCODING';
    const reEncodeResult = await transcodeVideo({
      ...fullInput,
      inputMinioKey: undefined,
    });

    // QC pós re-encode (apenas 1 tentativa adicional)
    postQcResult = await runPostEncodeQC({
      ...fullInput,
      videoOutputKey: reEncodeResult.outputKey,
      currentCrf: postQcResult.adjustedCrf,
    });

    if (!postQcResult.passed) {
      // 2ª re-encode com CRF ainda mais baixo
      state.phase = 'RE_ENCODING_2';
      const reEncodeResult2 = await transcodeVideo({ ...fullInput, inputMinioKey: undefined });
      postQcResult = await runPostEncodeQC({
        ...fullInput,
        videoOutputKey: reEncodeResult2.outputKey,
        currentCrf: postQcResult.adjustedCrf,
      });
    }
  }

  state.vmafScore = postQcResult.vmafMean;

  // Activity 7: deliver — timeout 2h, 3 tentativas
  state.phase = 'DELIVERING';
  await deliver({
    ...fullInput,
    outputKeys: [
      transcodeResult.outputKey,
      audioResult.outputKey,
    ],
  });

  // Workflow concluído
  state.phase = 'COMPLETED';
  state.completedAt = new Date().toISOString();
}
