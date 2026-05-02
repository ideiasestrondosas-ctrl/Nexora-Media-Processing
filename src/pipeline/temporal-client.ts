// Nexora Media Processing — Temporal Client
// Ficheiro: src/pipeline/temporal-client.ts
//
// Singleton do cliente Temporal.io para submeter workflows e enviar sinais.
// Usado pela API REST para iniciar e controlar o processamento de assets.

import { Client, Connection, WorkflowNotFoundError } from '@temporalio/client';
import { logger } from '../observability/logger';

// ── Tipos públicos ────────────────────────────────────────────────

export interface WorkflowStatus {
  workflowId: string;
  runId: string;
  status: string;
  startTime: Date | null;
  closeTime: Date | null;
}

export const TASK_QUEUE = 'nexora-media-pipeline';

// ── Singleton ────────────────────────────────────────────────────

let _client: Client | null = null;

async function getClient(): Promise<Client> {
  if (_client) return _client;

  const address = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
  const namespace = process.env.TEMPORAL_NAMESPACE ?? 'default';

  const connection = await Connection.connect({ address });

  _client = new Client({ connection, namespace });

  logger.info({ address, namespace }, 'Temporal client conectado');
  return _client;
}

// ── API pública ───────────────────────────────────────────────────

/**
 * Inicia o workflow de processamento de um asset.
 * Retorna o workflowId gerado para rastreio.
 */
export async function startAssetProcessing(
  assetId: string,
  workflowId?: string
): Promise<{ workflowId: string; runId: string }> {
  const client = await getClient();
  const wfId = workflowId ?? `nexora-asset-${assetId}-${Date.now()}`;

  const handle = await client.workflow.start('processAssetWorkflow', {
    taskQueue: TASK_QUEUE,
    workflowId: wfId,
    args: [assetId],
    // Timeout total do workflow — 8h para dar margem a activos longos
    workflowExecutionTimeout: '8h',
  });

  logger.info({ workflowId: wfId, runId: handle.firstExecutionRunId, assetId }, 'Workflow iniciado');

  return {
    workflowId: wfId,
    runId: handle.firstExecutionRunId,
  };
}

/**
 * Envia sinal de aprovação/rejeição para um asset em quarentena.
 */
export async function sendQuarantineDecision(
  workflowId: string,
  decision: 'approve' | 'reject',
  reason?: string
): Promise<void> {
  const client = await getClient();
  const handle = client.workflow.getHandle(workflowId);

  const signalName = decision === 'approve'
    ? 'approveQuarantinedAsset'
    : 'rejectQuarantinedAsset';

  await handle.signal(signalName, { reason: reason ?? '' });

  logger.info({ workflowId, decision, reason }, 'Sinal de quarentena enviado');
}

/**
 * Consulta o estado actual do workflow.
 */
export async function getWorkflowStatus(
  workflowId: string
): Promise<WorkflowStatus | null> {
  const client = await getClient();

  try {
    const handle = client.workflow.getHandle(workflowId);
    const desc = await handle.describe();

    return {
      workflowId: desc.workflowId,
      runId: desc.runId,
      status: desc.status.name,
      startTime: desc.startTime ?? null,
      closeTime: desc.closeTime ?? null,
    };
  } catch (err) {
    if (err instanceof WorkflowNotFoundError) return null;
    throw err;
  }
}

/**
 * Cancela um workflow em execução.
 */
export async function cancelWorkflow(workflowId: string): Promise<void> {
  const client = await getClient();
  const handle = client.workflow.getHandle(workflowId);
  await handle.cancel();
  logger.info({ workflowId }, 'Workflow cancelado');
}

/**
 * Encerra a conexão com o Temporal server (para graceful shutdown).
 */
export async function closeTemporalClient(): Promise<void> {
  if (_client) {
    await _client.connection.close();
    _client = null;
    logger.info('Temporal client desconectado');
  }
}
