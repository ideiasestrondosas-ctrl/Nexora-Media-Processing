// ═══════════════════════════════════════════════════════════════
// Nexora Media Processing — Temporal.io Activities
// Ficheiro: src/pipeline/activities.ts
//
// Implementações das actividades usadas pelo workflow Temporal.
// Cada actividade é uma função assíncrona que executa um passo
// do pipeline. O Temporal gere retry, timeout e estado.
// ═══════════════════════════════════════════════════════════════

import { ApplicationFailure, activityInfo, heartbeat } from '@temporalio/activity';
import { createHash } from 'crypto';
import path from 'path';

import { runQCRules, type NexoraQCInput } from '../qc/rules/index';
import { executeFFprobe } from '../pipeline/ffmpeg/executor';
import { transcodeAsset }  from '../workers/transcode.worker';
import { normalizeAudio }  from '../workers/audio.worker';
import { prisma }          from '../db/prisma';
import { logger }          from '../observability/logger';
import { queues }          from '../workers/queues';
import type { NexoraProfile } from '../workers/transcode.worker';

// ── Activity: Validar QC ──────────────────────────────────────

export async function validateQC(params: {
  assetId:   string;
  inputPath: string;
  profile:   string;
}): Promise<{ decision: 'PASS' | 'QUARANTINE' | 'REJECT'; summary: string }> {
  const { assetId, inputPath, profile } = params;
  const log = logger.child({ asset_id: assetId, activity: 'validateQC' });

  // Heartbeat para o Temporal saber que estamos vivos
  heartbeat('A analisar ficheiro com MediaInfo + FFprobe');

  log.info({ inputPath, profile }, 'Activity: validateQC iniciado');

  // Recolher metadata
  let ffprobeData: any;
  try {
    ffprobeData = await executeFFprobe(inputPath, { assetId });
  } catch (err) {
    // FFprobe não conseguiu analisar → ficheiro corrompido
    throw ApplicationFailure.create({
      message: `Ficheiro inanalisável: ${String(err)}`,
      type: 'NexoraQCRejectError',
      nonRetryable: true,
    });
  }

  const videoStream  = (ffprobeData as any)?.streams?.find((s: any) => s.codec_type === 'video') ?? {};
  const audioStream  = (ffprobeData as any)?.streams?.find((s: any) => s.codec_type === 'audio') ?? {};
  const formatInfo   = (ffprobeData as any)?.format ?? {};

  const fps        = parseFloat(videoStream.r_frame_rate?.replace(/(\d+)\/(\d+)/,
    (_: string, n: string, d: string) => String(parseInt(n) / parseInt(d))) ?? '25');
  const durationS  = parseFloat(formatInfo.duration ?? '0');
  const fileSize   = parseInt(formatInfo.size ?? '0');

  const qcInput: NexoraQCInput = {
    assetId,
    profile,
    video: {
      codec:          videoStream.codec_name ?? 'unknown',
      profile:        videoStream.profile ?? '',
      level:          String(videoStream.level ?? ''),
      pixelFormat:    videoStream.pix_fmt ?? 'unknown',
      frameRate:      fps,
      frameRateMode:  videoStream.r_frame_rate === videoStream.avg_frame_rate ? 'CFR' : 'VFR',
      gopType:        'UNKNOWN',
      hasIdrFrames:   true,
      bFrameCount:    0,
      bitrate:        parseInt(videoStream.bit_rate ?? '0') / 1000,
      width:          videoStream.width  ?? 0,
      height:         videoStream.height ?? 0,
      bitDepth:       8,
      colorSpace:     videoStream.color_space    ?? 'bt709',
      colorPrimaries: videoStream.color_primaries ?? 'bt709',
      transferCharacteristics: videoStream.color_transfer ?? 'bt709',
      duration:       durationS,
      hasFastStart:   false,
    },
    audio: {
      codec:          audioStream.codec_name ?? 'unknown',
      sampleRate:     parseInt(audioStream.sample_rate ?? '48000'),
      bitDepth:       parseInt(audioStream.bits_per_raw_sample ?? '16'),
      channels:       audioStream.channels ?? 2,
      channelLayout:  audioStream.channel_layout ?? 'stereo',
      integratedLufs: null,
      truePeakDbtp:   null,
      loudnessRange:  null,
      audioVideoSyncMs: 0,
    },
    container: {
      format:          formatInfo.format_name ?? '',
      duration:        durationS,
      size:            fileSize,
      hasEditLists:    false,
      hasTimecodeTrack: false,
      moovPosition:    'unknown',
    },
  };

  heartbeat('A executar regras QC');
  const { decision, results, summary } = await runQCRules(qcInput);

  // Escrever audit log
  const content = JSON.stringify({ assetId, decision, summary });
  const entryHash = createHash('sha256').update(content).digest('hex');
  await prisma.auditLog.create({
    data: { assetId, eventType: 'qc_pre_completed', operator: 'temporal_activity', payload: { decision, summary }, entryHash }
  });

  if (decision === 'REJECT') {
    const criticalError = results.find(r => !r.pass && r.severity === 'critical');
    throw ApplicationFailure.create({
      message: `QC rejeitado: ${criticalError?.detail ?? summary}`,
      type: 'NexoraQCRejectError',
      nonRetryable: true,
      details: [results],
    });
  }

  log.info({ decision, summary }, 'Activity: validateQC concluído');
  return { decision, summary };
}

// ── Activity: Analisar conteúdo ───────────────────────────────

export async function analyzeContent(params: {
  assetId:   string;
  inputPath: string;
  profile:   string;
}): Promise<{
  frameRate:              number;
  durationMs:             number;
  recommendedBitrateKbps: number;
  contentType:            string;
}> {
  const { assetId, inputPath, profile } = params;

  heartbeat('A analisar complexidade do conteúdo (SI/TI)');

  const ffprobeData = await executeFFprobe(inputPath, { assetId }) as any;
  const videoStream = ffprobeData?.streams?.find((s: any) => s.codec_type === 'video') ?? {};

  const fps        = parseFloat(videoStream.r_frame_rate?.replace(/(\d+)\/(\d+)/,
    (_: string, n: string, d: string) => String(parseInt(n)/parseInt(d))) ?? '25');
  const durationMs = Math.round(parseFloat(ffprobeData?.format?.duration ?? '0') * 1000);

  // Bitrates base por perfil
  const baseBitrates: Record<string, number> = {
    nexora_broadcast_hd:  8000,
    nexora_ott_premium:   6000,
    nexora_streaming_web: 4000,
    nexora_proxy_lowres:  800,
    nexora_archive:       50000,
  };

  // Sem análise SI/TI completa aqui (isso fica no analyzer worker)
  // A activity do Temporal faz uma análise mais simples e rápida
  const recommendedBitrateKbps = baseBitrates[profile] ?? 4000;

  await prisma.asset.update({
    where: { id: assetId },
    data:  { frameRate: fps, durationMs, status: 'ANALYZING' }
  });

  return { frameRate: fps, durationMs, recommendedBitrateKbps, contentType: 'unknown' };
}

// ── Activity: Transcodificar vídeo ────────────────────────────

export async function transcodeVideo(params: {
  assetId:         string;
  inputPath:       string;
  outputPath:      string;
  profile:         string;
  fps:             number;
  bitrateKbps?:    number;
  durationMs:      number;
}): Promise<void> {
  const { assetId, inputPath, outputPath, profile, fps, bitrateKbps, durationMs } = params;

  await prisma.asset.update({ where: { id: assetId }, data: { status: 'TRANSCODING' } });

  heartbeat(`A transcodificar para ${profile}...`);

  await transcodeAsset({
    inputPath,
    outputPath,
    profile:   profile as NexoraProfile,
    assetId,
    jobId:     activityInfo().activityId,
    fps,
    bitrateKbps,
    durationMs,
    onProgress: (pct) => heartbeat(`Transcode ${Math.round(pct)}%`),
  });
}

// ── Activity: Normalizar áudio ────────────────────────────────

export async function normalizeAudioActivity(params: {
  assetId:    string;
  inputPath:  string;
  outputPath: string;
  profile:    string;
}): Promise<void> {
  const { assetId, inputPath, outputPath, profile } = params;

  heartbeat('A normalizar áudio EBU R128...');

  await prisma.asset.update({ where: { id: assetId }, data: { status: 'AUDIO_PROCESSING' } });

  const isStreaming = profile.includes('streaming') || profile.includes('ott');

  await normalizeAudio({
    inputPath,
    outputPath,
    profile: isStreaming ? 'streaming' : 'broadcast',
    assetId,
    jobId: activityInfo().activityId,
  });
}

// ── Activity: Processar legendas ──────────────────────────────

export async function processCaptions(params: {
  assetId:   string;
  inputPath: string;
  profile:   string;
}): Promise<void> {
  // Enfileirar no worker de legendas (não bloqueante no Temporal)
  const { assetId, inputPath, profile } = params;
  const outputDir = path.dirname(inputPath).replace('/input', '/output');

  await queues.subtitle.add('subtitle', {
    assetId,
    inputPath,
    outputDir,
    profile,
    burnIn: profile === 'nexora_archive',
  });
}

// ── Activity: Gerar proxies ───────────────────────────────────

export async function generateProxies(params: {
  assetId:   string;
  inputPath: string;
  outputDir: string;
}): Promise<void> {
  heartbeat('A gerar proxy LowRes...');
  await queues.proxy.add('proxy', params, { priority: 8 });
  // Aguardar via polling (simplificado — em produção usar signal Temporal)
  await waitForStep(params.assetId, 'PROXY');
}

// ── Activity: Gerar thumbnails ────────────────────────────────

export async function generateThumbnails(params: {
  assetId:   string;
  inputPath: string;
  outputDir: string;
}): Promise<void> {
  heartbeat('A gerar thumbnail sprites...');
  // Os thumbnails são gerados pelo proxy worker em paralelo
}

// ── Activity: QC pós-encode ───────────────────────────────────

export async function runPostEncodeQC(params: {
  assetId:       string;
  referencePath: string;
  encodedPath:   string;
  profile:       string;
}): Promise<void> {
  const { assetId, referencePath, encodedPath, profile } = params;

  heartbeat('A executar QC pós-encode (VMAF + loudness)...');

  await prisma.asset.update({ where: { id: assetId }, data: { status: 'POST_QC' } });

  await queues.qcPost.add('qc-post', {
    assetId,
    referencePath,
    encodedPath,
    profile,
  }, { attempts: 1 }); // 1 tentativa — o Temporal gere os retries

  await waitForStep(assetId, 'QC_POST');
}

// ── Activity: Delivery ────────────────────────────────────────

export async function deliver(params: {
  assetId:     string;
  outputPath:  string;
  profile:     string;
  webhookUrl?: string;
}): Promise<void> {
  heartbeat('A fazer upload para MinIO...');

  await queues.delivery.add('delivery', params, { attempts: 5 });
  await waitForStep(params.assetId, 'READY');
}

// ── Activity: Actualizar estado do asset ──────────────────────

export async function updateAssetStatus(params: {
  assetId: string;
  status:  string;
}): Promise<void> {
  await prisma.asset.update({
    where: { id: params.assetId },
    data:  { status: params.status as any }
  });
}

// ── Activity: Enviar notificação ──────────────────────────────

export async function sendNotification(params: {
  assetId:     string;
  event:       string;
  webhookUrl?: string;
}): Promise<void> {
  const { assetId, event, webhookUrl } = params;

  logger.info({ assetId, event }, `Notificação: ${event}`);

  if (!webhookUrl) return;

  const asset = await prisma.asset.findUnique({
    where:  { id: assetId },
    select: { id: true, status: true, profile: true, vmafScore: true, deliveryUrl: true }
  });

  try {
    await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ event, assetId, asset, timestamp: new Date().toISOString() }),
      signal:  AbortSignal.timeout(10000),
    });
  } catch (err) {
    // Webhook falhou — logar mas não falhar o workflow
    logger.warn({ assetId, webhookUrl, err: String(err) }, 'Webhook falhou (não-bloqueante)');
  }
}

// ── Utilitário: aguardar que o asset chegue a determinado estado ──

async function waitForStep(assetId: string, targetStatus: string, maxWaitMs = 14400000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const asset = await prisma.asset.findUnique({
      where: { id: assetId }, select: { status: true }
    });

    if (asset?.status === targetStatus || asset?.status === 'READY') return;
    if (asset?.status === 'FAILED' || asset?.status === 'QC_REJECT') {
      throw ApplicationFailure.create({
        message: `Asset ${assetId} entrou em estado ${asset.status}`,
        type: 'AssetProcessingFailed',
      });
    }

    heartbeat(`A aguardar ${targetStatus}... estado actual: ${asset?.status}`);
    await new Promise(r => setTimeout(r, 5000)); // polling 5s
  }
  throw new Error(`Timeout a aguardar estado ${targetStatus} para asset ${assetId}`);
}


// ═══════════════════════════════════════════════════════════════
// Nexora — Temporal Worker (regista workflow + activities)
// Ficheiro: src/pipeline/temporal-worker.ts
// ═══════════════════════════════════════════════════════════════

import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './activities';
import { logger } from '../observability/logger';

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS    ?? 'localhost:7233';
const TASK_QUEUE       = process.env.TEMPORAL_TASK_QUEUE ?? 'nexora-media-tasks';

export async function startTemporalWorker(): Promise<void> {
  logger.info({ address: TEMPORAL_ADDRESS, taskQueue: TASK_QUEUE }, 'A iniciar Temporal worker...');

  const connection = await NativeConnection.connect({ address: TEMPORAL_ADDRESS });

  const worker = await Worker.create({
    connection,
    namespace:  'nexora-production',
    taskQueue:  TASK_QUEUE,
    activities,                       // registar todas as actividades
    workflowsPath: require.resolve('./orchestrator'), // workflow definitions
    maxConcurrentActivityTaskExecutions:  10,
    maxConcurrentWorkflowTaskExecutions:  20,
  });

  logger.info('Temporal worker registado — a aguardar tarefas');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM — a encerrar Temporal worker');
    await worker.shutdown();
  });

  await worker.run(); // bloqueia até shutdown
}


// ═══════════════════════════════════════════════════════════════
// Nexora — Temporal Client (para submeter workflows)
// Ficheiro: src/pipeline/temporal-client.ts
// ═══════════════════════════════════════════════════════════════

import { Client, Connection } from '@temporalio/client';
import { processAssetWorkflow } from './orchestrator';
import { logger } from '../observability/logger';

let temporalClient: Client | null = null;

export async function getTemporalClient(): Promise<Client> {
  if (temporalClient) return temporalClient;

  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
  });

  temporalClient = new Client({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE ?? 'nexora-production',
  });

  return temporalClient;
}

/**
 * Submeter um asset para processamento via Temporal.io.
 * Retorna o workflow ID para tracking.
 */
export async function submitAssetForProcessing(params: {
  assetId:     string;
  inputPath:   string;
  profile:     string;
  priority:    'high' | 'normal' | 'low';
  webhookUrl?: string;
}): Promise<string> {
  const client = await getTemporalClient();
  const workflowId = `nexora-asset-${params.assetId}`;

  const handle = await client.workflow.start(processAssetWorkflow, {
    taskQueue: process.env.TEMPORAL_TASK_QUEUE ?? 'nexora-media-tasks',
    workflowId,
    args: [params],
    // Prevenir workflows duplicados para o mesmo asset
    workflowIdReusePolicy: 'REJECT_DUPLICATE',
  });

  logger.info({ workflowId, assetId: params.assetId }, 'Workflow Temporal submetido');
  return workflowId;
}

/**
 * Aprovar um asset em quarentena via signal Temporal.
 */
export async function approveQuarantine(assetId: string, approved: boolean, reason?: string): Promise<void> {
  const client = await getTemporalClient();
  const workflowId = `nexora-asset-${assetId}`;

  const handle = client.workflow.getHandle(workflowId);
  await handle.signal('approve_quarantine', { approved, reason });

  logger.info({ assetId, approved }, 'Signal de quarentena enviado');
}

/**
 * Obter estado do workflow de um asset.
 */
export async function getWorkflowStatus(assetId: string): Promise<{
  status:      string;
  currentStep: string;
} | null> {
  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(`nexora-asset-${assetId}`);

    const [status, currentStep] = await Promise.all([
      handle.query('workflow_status'),
      handle.query('current_step'),
    ]);

    return { status: status as string, currentStep: currentStep as string };
  } catch {
    return null;
  }
}
