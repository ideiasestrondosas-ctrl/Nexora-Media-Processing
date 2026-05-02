// Nexora Media Processing — Temporal Worker
// Ficheiro: src/pipeline/temporal-worker.ts
//
// Regista o workflow processAssetWorkflow e as 8 actividades no Temporal server.
// Task queue: nexora-media-pipeline
// ADR-001: Temporal.io para orquestração.

import path from 'path';
import { Worker } from '@temporalio/worker';
import { logger } from '../observability/logger';
import * as activities from './activities';

export const TEMPORAL_TASK_QUEUE = 'nexora-media-pipeline';

/**
 * Cria e inicia o Temporal Worker.
 * O worker regista:
 *   - Workflow: processAssetWorkflow (de orchestrator.ts)
 *   - Activities: todas as funções exportadas de activities.ts
 */
export async function startTemporalWorker(): Promise<Worker> {
  const address = process.env.TEMPORAL_ADDRESS ?? 'localhost:7233';
  const namespace = process.env.TEMPORAL_NAMESPACE ?? 'default';

  logger.info({ address, namespace, taskQueue: TEMPORAL_TASK_QUEUE }, 'A iniciar Temporal Worker...');

  const worker = await Worker.create({
    // Caminho para o bundle do workflow (compilado pelo Temporal bundler)
    // Em desenvolvimento usa workflowsPath; em produção usa bundle pré-compilado
    workflowsPath: path.join(__dirname, 'orchestrator'),
    activities,
    taskQueue: TEMPORAL_TASK_QUEUE,
    connection: await (async () => {
      const { NativeConnection } = await import('@temporalio/worker');
      return NativeConnection.connect({ address });
    })(),
    namespace,

    // Concorrência: 10 actividades simultâneas, 5 workflow tasks
    maxConcurrentActivityTaskExecutions: 10,
    maxConcurrentWorkflowTaskExecutions: 5,
  });

  worker.run().catch((err) => {
    logger.error({ err }, 'Temporal Worker encerrado com erro');
  });

  logger.info({ taskQueue: TEMPORAL_TASK_QUEUE }, 'Temporal Worker iniciado');
  return worker;
}
