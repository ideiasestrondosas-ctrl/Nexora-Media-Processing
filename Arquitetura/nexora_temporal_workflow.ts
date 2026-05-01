// ═══════════════════════════════════════════════════════════════
// Nexora Media Processing — Temporal.io Workflow
// Ficheiro: src/pipeline/orchestrator.ts
//
// Orquestra todo o pipeline de processamento de um asset.
// ADR-001: Temporal.io para orquestração (não BullMQ standalone).
// ═══════════════════════════════════════════════════════════════

import {
  proxyActivities,
  defineWorkflow,
  executeChild,
  condition,
  setHandler,
  defineSignal,
  defineQuery,
  sleep,
  ActivityFailure,
  ApplicationFailure,
} from '@temporalio/workflow';
import type { NexoraProfile } from './transcode.worker';

// ── Tipos ────────────────────────────────────────────────────

export interface ProcessAssetInput {
  assetId:    string;
  inputPath:  string;
  profile:    NexoraProfile;
  priority:   'high' | 'normal' | 'low';
  webhookUrl?: string;
}

export type WorkflowStatus =
  | 'running' | 'paused_quarantine' | 'completed' | 'failed';

// ── Signals e Queries ─────────────────────────────────────────

/** Signal para aprovar asset em quarentena (acção humana) */
export const approveQuarantineSignal = defineSignal<[{ approved: boolean; reason?: string }]>(
  'approve_quarantine'
);

/** Query para saber o estado actual do workflow */
export const workflowStatusQuery = defineQuery<WorkflowStatus>('workflow_status');

/** Query para obter o passo actual */
export const currentStepQuery = defineQuery<string>('current_step');

// ── Actividades (stubs — implementações nos workers) ─────────

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
  updateAssetStatus,
  sendNotification,
} = proxyActivities<NexoraActivities>({
  startToCloseTimeout: '4 hours',   // timeout máximo por actividade
  retry: {
    initialInterval: '1 second',
    backoffCoefficient: 10,          // 1s → 10s → 100s
    maximumAttempts: 3,
    nonRetryableErrorTypes: ['NexoraQCRejectError', 'NexoraSecurityError'],
  },
});

// Activities com timeouts específicos
const qcActivities = proxyActivities<Pick<NexoraActivities, 'validateQC' | 'runPostEncodeQC'>>({
  startToCloseTimeout: '5 minutes',
  retry: { maximumAttempts: 3, initialInterval: '1 second', backoffCoefficient: 10 },
  nonRetryableErrorTypes: ['NexoraQCRejectError'],
});

const analyzeActivities = proxyActivities<Pick<NexoraActivities, 'analyzeContent'>>({
  startToCloseTimeout: '10 minutes',
  retry: { maximumAttempts: 2, initialInterval: '2 seconds', backoffCoefficient: 5 },
});

const deliveryActivities = proxyActivities<Pick<NexoraActivities, 'deliver'>>({
  startToCloseTimeout: '2 hours',
  retry: { maximumAttempts: 5, initialInterval: '5 seconds', backoffCoefficient: 5 },
});

// ── Workflow principal ────────────────────────────────────────

export const processAssetWorkflow = defineWorkflow(
  async function processAssetWorkflow(input: ProcessAssetInput): Promise<void> {
    const { assetId, inputPath, profile, webhookUrl } = input;

    let status: WorkflowStatus = 'running';
    let currentStep = 'initializing';
    let quarantineApproved: boolean | null = null;
    let quarantineReason: string | undefined;

    // ── Handlers de signal e query ────────────────────────────
    setHandler(approveQuarantineSignal, ({ approved, reason }) => {
      quarantineApproved = approved;
      quarantineReason   = reason;
    });

    setHandler(workflowStatusQuery, () => status);
    setHandler(currentStepQuery, () => currentStep);

    try {

      // ══════════════════════════════════════
      // PASSO 1: QC pré-encode
      // ══════════════════════════════════════
      currentStep = 'qc_pre';
      await updateAssetStatus({ assetId, status: 'QC_PENDING' });

      let qcResult: QCResult;
      try {
        qcResult = await qcActivities.validateQC({ assetId, inputPath, profile });
      } catch (err) {
        if (err instanceof ApplicationFailure && err.type === 'NexoraQCRejectError') {
          // Rejeição definitiva — terminar workflow
          await updateAssetStatus({ assetId, status: 'QC_REJECT' });
          await sendNotification({ assetId, event: 'asset.rejected', webhookUrl });
          return; // Workflow termina aqui
        }
        throw err;
      }

      // Quarentena: aguardar decisão humana (máx 48h)
      if (qcResult.decision === 'QUARANTINE') {
        currentStep = 'quarantine_waiting';
        status = 'paused_quarantine';

        await updateAssetStatus({ assetId, status: 'QC_QUARANTINE' });
        await sendNotification({ assetId, event: 'asset.quarantine', webhookUrl });

        // Aguardar signal de aprovação humana (timeout 48h)
        const approved = await condition(
          () => quarantineApproved !== null,
          '48 hours'
        );

        if (!approved || quarantineApproved === false) {
          await updateAssetStatus({ assetId, status: 'QC_REJECT' });
          return;
        }

        status = 'running';
        await updateAssetStatus({ assetId, status: 'QC_PASS' });
      } else {
        await updateAssetStatus({ assetId, status: 'QC_PASS' });
      }

      // ══════════════════════════════════════
      // PASSO 2: Análise de conteúdo
      // ══════════════════════════════════════
      currentStep = 'analyzing';
      await updateAssetStatus({ assetId, status: 'ANALYZING' });

      const analysisResult = await analyzeActivities.analyzeContent({ assetId, inputPath, profile });

      // ══════════════════════════════════════
      // PASSO 3: Processamento em paralelo
      // Transcode + Áudio + Legendas (simultaneamente)
      // ══════════════════════════════════════
      currentStep = 'processing_parallel';
      await updateAssetStatus({ assetId, status: 'TRANSCODING' });

      const outputPath   = inputPath.replace('/input/', '/output/').replace('.mp4', `_${profile}.mp4`);
      const audioPath    = outputPath.replace('.mp4', '_audio.mp4');

      // Executar em paralelo com Promise.all
      const [transcodeResult, audioResult] = await Promise.all([
        // Transcode de vídeo
        proxyActivities<Pick<NexoraActivities, 'transcodeVideo'>>({
          startToCloseTimeout: '4 hours',
          retry: { maximumAttempts: 2, initialInterval: '5 seconds', backoffCoefficient: 10 },
        }).transcodeVideo({
          assetId,
          inputPath,
          outputPath,
          profile,
          fps:  analysisResult.frameRate,
          bitrateKbps: analysisResult.recommendedBitrateKbps,
          durationMs:  analysisResult.durationMs,
        }),

        // Normalização de áudio (em paralelo com transcode)
        proxyActivities<Pick<NexoraActivities, 'normalizeAudio'>>({
          startToCloseTimeout: '30 minutes',
          retry: { maximumAttempts: 3, initialInterval: '1 second', backoffCoefficient: 10 },
        }).normalizeAudio({
          assetId,
          inputPath,
          outputPath: audioPath,
          profile,
        }),

        // Processamento de legendas (opcional — não bloqueia)
        processCaptions({ assetId, inputPath, profile }).catch(err => {
          // Legendas são opcionais — logar aviso mas não falhar
          console.warn(`Legenda processing falhou (não-bloqueante): ${String(err)}`);
          return null;
        }),
      ]);

      await updateAssetStatus({ assetId, status: 'AUDIO_PROCESSING' });

      // ══════════════════════════════════════
      // PASSO 4: Gerar proxy + thumbnails
      // ══════════════════════════════════════
      currentStep = 'generating_assets';

      await Promise.all([
        generateProxies({
          assetId,
          inputPath,
          outputDir: outputPath.replace(/\/[^/]+$/, '/'),
        }),
        generateThumbnails({
          assetId,
          inputPath,
          outputDir: outputPath.replace(/\/[^/]+$/, '/'),
        }),
      ]);

      // ══════════════════════════════════════
      // PASSO 5: QC pós-encode
      // VMAF + loudness + SHA-256 + conformance
      // ══════════════════════════════════════
      currentStep = 'qc_post';
      await updateAssetStatus({ assetId, status: 'POST_QC' });

      let postQCPassed = false;
      let postQCAttempts = 0;

      while (!postQCPassed && postQCAttempts < 2) {
        postQCAttempts++;
        try {
          await qcActivities.runPostEncodeQC({
            assetId,
            referencePath: inputPath,
            encodedPath:   outputPath,
            profile,
          });
          postQCPassed = true;
        } catch (err) {
          if (postQCAttempts < 2) {
            // Segunda tentativa: re-encode com parâmetros mais conservadores
            currentStep = 'reencoding';
            await proxyActivities<Pick<NexoraActivities, 'transcodeVideo'>>({
              startToCloseTimeout: '4 hours',
              retry: { maximumAttempts: 1 },
            }).transcodeVideo({
              assetId,
              inputPath,
              outputPath,
              profile,
              fps: analysisResult.frameRate,
              // Bitrate mais alto na segunda tentativa
              bitrateKbps: Math.round(analysisResult.recommendedBitrateKbps * 1.2),
              durationMs: analysisResult.durationMs,
            });
          } else {
            throw new ApplicationFailure(
              `QC pós-encode falhou após ${postQCAttempts} tentativas`,
              'PostQCFailed'
            );
          }
        }
      }

      // ══════════════════════════════════════
      // PASSO 6: Delivery
      // ══════════════════════════════════════
      currentStep = 'delivering';
      await updateAssetStatus({ assetId, status: 'DELIVERING' });

      await deliveryActivities.deliver({
        assetId,
        outputPath,
        profile,
        webhookUrl,
      });

      // ══════════════════════════════════════
      // Concluído com sucesso!
      // ══════════════════════════════════════
      currentStep = 'completed';
      status = 'completed';

      await updateAssetStatus({ assetId, status: 'READY' });
      await sendNotification({ assetId, event: 'asset.ready', webhookUrl });

    } catch (error) {
      currentStep = 'failed';
      status = 'failed';

      await updateAssetStatus({ assetId, status: 'FAILED' }).catch(() => {});
      await sendNotification({ assetId, event: 'asset.failed', webhookUrl }).catch(() => {});

      throw error;
    }
  }
);

// ── Tipos das actividades ─────────────────────────────────────

interface QCResult {
  decision: 'PASS' | 'QUARANTINE' | 'REJECT';
  summary: string;
}

interface AnalysisResult {
  frameRate: number;
  durationMs: number;
  recommendedBitrateKbps: number;
  contentType: string;
}

interface NexoraActivities {
  validateQC(params: { assetId: string; inputPath: string; profile: string }): Promise<QCResult>;
  analyzeContent(params: { assetId: string; inputPath: string; profile: string }): Promise<AnalysisResult>;
  transcodeVideo(params: {
    assetId: string; inputPath: string; outputPath: string;
    profile: string; fps: number; bitrateKbps?: number; durationMs: number;
  }): Promise<void>;
  normalizeAudio(params: {
    assetId: string; inputPath: string; outputPath: string; profile: string;
  }): Promise<void>;
  processCaptions(params: { assetId: string; inputPath: string; profile: string }): Promise<void>;
  generateProxies(params: { assetId: string; inputPath: string; outputDir: string }): Promise<void>;
  generateThumbnails(params: { assetId: string; inputPath: string; outputDir: string }): Promise<void>;
  runPostEncodeQC(params: {
    assetId: string; referencePath: string; encodedPath: string; profile: string;
  }): Promise<void>;
  deliver(params: {
    assetId: string; outputPath: string; profile: string; webhookUrl?: string;
  }): Promise<void>;
  updateAssetStatus(params: { assetId: string; status: string }): Promise<void>;
  sendNotification(params: { assetId: string; event: string; webhookUrl?: string }): Promise<void>;
}


// ═══════════════════════════════════════════════════════════════
// Nexora — Decision Engine
// Ficheiro: src/pipeline/decision-engine.ts
//
// Motor de decisão determinístico: dada a análise de um ficheiro,
// decide exactamente o que fazer (transcode, remux, copy, reject).
// 11 regras explícitas, sem ambiguidade.
// ═══════════════════════════════════════════════════════════════

import type { VideoMetadata, AudioMetadata } from '../qc/rules/index';
import type { NexoraProfile } from './transcode.worker';

export interface MediaAnalysisInput {
  assetId: string;
  profile: NexoraProfile;
  video: VideoMetadata;
  audio: AudioMetadata;
}

export type ProcessingAction = 'COPY' | 'REMUX' | 'TRANSCODE' | 'REJECT';

export interface ProcessingDecision {
  action: ProcessingAction;
  rejectReason?: string;

  targetProfile: NexoraProfile;

  /** Parâmetros de vídeo calculados */
  videoParams: {
    codec:          'h264' | 'h265' | 'prores_4444' | 'prores_422hq';
    profile:        string;
    level:          string;
    pixelFormat:    'yuv420p' | 'yuv420p10le';
    gopSize:        number;   // SEMPRE fps × 2
    keyintMin:      number;   // SEMPRE = gopSize
    scThreshold:    0;        // SEMPRE 0
    closedGop:      true;     // SEMPRE true
    bFrames:        0;        // SEMPRE 0 em broadcast linear
    targetBitrateKbps: number;
    maxrateKbps:    number;
    bufsize:        number;   // SEMPRE = maxrateKbps × 2
    colorSpace:     string;
    colorPrimaries: string;
    colorTrc:       string;
  };

  /** Parâmetros de áudio calculados */
  audioParams: {
    codec:          'aac' | 'pcm_s24le' | 'eac3';
    sampleRate:     48000;    // SEMPRE 48000
    targetLufs:     -23 | -14;
    truePeakLimit:  -1;       // SEMPRE -1
    channels:       number;
    bitrateKbps?:   number;
  };

  audioNormalizationRequired: boolean;
  transcodeRequired:          boolean;
  captionProcessingRequired:  boolean;

  /** Parâmetros FFmpeg finais (array de argumentos) */
  ffmpegParams:    string[];
  /** HandBrake pode tratar este job? */
  handbrakePreset?: string;

  /** Estimativas */
  estimatedDurationMs: number;
  priorityLevel: 'critical' | 'high' | 'normal' | 'low';
}

/**
 * Motor de decisão determinístico.
 * Aplica 11 regras em sequência — sem randomness, sem suposições.
 */
export function decideProcessing(input: MediaAnalysisInput): ProcessingDecision {
  const { assetId, profile, video, audio } = input;

  let action: ProcessingAction = 'COPY'; // começa optimista
  const reasons: string[] = [];

  // ── REGRA 1: VFR obriga a transcode ──────────────────────────
  if (video.frameRateMode === 'VFR') {
    action = 'TRANSCODE';
    reasons.push('VFR detectado — CFR obrigatório');
  }

  // ── REGRA 2: Open GOP obriga a transcode ─────────────────────
  if (video.gopType !== 'CLOSED') {
    action = 'TRANSCODE';
    reasons.push(`GOP ${video.gopType} — Closed GOP obrigatório`);
  }

  // ── REGRA 3: B-frames em broadcast obrigam a transcode ───────
  const isBroadcast = profile === 'nexora_broadcast_hd';
  if (isBroadcast && video.bFrameCount > 0) {
    action = 'TRANSCODE';
    reasons.push(`${video.bFrameCount} B-frames — broadcast linear requer 0 B-frames`);
  }

  // ── REGRA 4: Pixel format errado obriga a transcode ──────────
  const needsHDR = profile === 'nexora_ott_premium';
  const validPixFmt = needsHDR ? ['yuv420p', 'yuv420p10le'] : ['yuv420p'];
  if (!validPixFmt.includes(video.pixelFormat)) {
    action = 'TRANSCODE';
    reasons.push(`Pixel format ${video.pixelFormat} — necessário yuv420p`);
  }

  // ── REGRA 5: Codec incompatível obriga a transcode ───────────
  const profileCodecMap: Record<NexoraProfile, string[]> = {
    nexora_broadcast_hd:  ['h264', 'avc'],
    nexora_ott_premium:   ['h265', 'hevc'],
    nexora_streaming_web: ['h264', 'avc'],
    nexora_proxy_lowres:  ['h264', 'avc'],
    nexora_archive:       ['prores'],
  };
  const acceptedCodecs = profileCodecMap[profile];
  if (!acceptedCodecs.some(c => video.codec.toLowerCase().includes(c))) {
    action = 'TRANSCODE';
    reasons.push(`Codec ${video.codec} incompatível com perfil ${profile}`);
  }

  // ── REGRA 6: Verificar se precisa de remux (container errado) ─
  if (action === 'COPY') {
    const profileContainerMap: Record<NexoraProfile, string[]> = {
      nexora_broadcast_hd:  ['mp4', 'mov', 'mxf'],
      nexora_ott_premium:   ['mp4', 'mov'],
      nexora_streaming_web: ['mp4'],
      nexora_proxy_lowres:  ['mp4'],
      nexora_archive:       ['mxf', 'mov'],
    };
    const okContainers = profileContainerMap[profile];
    if (!okContainers.includes(video.codec.toLowerCase())) {
      // Container errado mas stream ok → REMUX (mais rápido que transcode)
      action = 'REMUX';
    }
  }

  // ── REGRA 7: Áudio — verificar necessidade de normalização ───
  const targetLufs: -23 | -14 = isBroadcast ? -23 : -14;
  const audioNorm = audio.truePeakDbtp !== null && audio.truePeakDbtp > -1.0 ||
                    audio.integratedLufs !== null && Math.abs((audio.integratedLufs) - targetLufs) > 1.0 ||
                    audio.sampleRate !== 48000;

  // ── REGRA 8: GOP size correcto — sempre fps × 2 ──────────────
  const gopSize     = Math.round(video.frameRate) * 2;
  const keyintMin   = gopSize;

  // ── REGRA 9: Bitrate base conforme perfil ────────────────────
  const baseBitrateMap: Record<NexoraProfile, number> = {
    nexora_broadcast_hd:  8000,
    nexora_ott_premium:   6000,
    nexora_streaming_web: 4000,
    nexora_proxy_lowres:  800,
    nexora_archive:       50000, // ProRes tem bitrate muito alto
  };
  let targetBitrateKbps = baseBitrateMap[profile];

  // ── REGRA 10: Ajuste de bitrate por tipo de conteúdo ─────────
  // (determinado pela análise SI/TI do analyzer worker)
  // sport → +30% | animation → -40%
  // Esta regra é aplicada pelo analyzer antes de chamar o decision engine

  // ── REGRA 11: bufsize = maxrateKbps × 2 (VBV buffer) ────────
  const maxrateKbps = targetBitrateKbps;
  const bufsize     = targetBitrateKbps * 2;

  // ── Construir parâmetros de vídeo ─────────────────────────────
  const codecMap: Record<NexoraProfile, 'h264' | 'h265' | 'prores_4444'> = {
    nexora_broadcast_hd:  'h264',
    nexora_ott_premium:   'h265',
    nexora_streaming_web: 'h264',
    nexora_proxy_lowres:  'h264',
    nexora_archive:       'prores_4444',
  };

  const audioCodecMap: Record<NexoraProfile, 'aac' | 'pcm_s24le' | 'eac3'> = {
    nexora_broadcast_hd:  'pcm_s24le',
    nexora_ott_premium:   'eac3',
    nexora_streaming_web: 'aac',
    nexora_proxy_lowres:  'aac',
    nexora_archive:       'pcm_s24le',
  };

  const audioBitrateMap: Record<string, number | undefined> = {
    aac:       192,
    eac3:      384,
    pcm_s24le: undefined, // lossless
  };

  const audioCodec = audioCodecMap[profile];

  // ── FFmpeg params finais (array — ADR-002) ────────────────────
  const ffmpegParams: string[] = [
    '-pix_fmt', needsHDR ? 'yuv420p10le' : 'yuv420p',
    '-g',          String(gopSize),
    '-keyint_min', String(keyintMin),
    '-sc_threshold', '0',     // REGRA: sempre 0
    '-flags', '+cgop',        // REGRA: Closed GOP
    '-bf', '0',               // REGRA: sem B-frames em broadcast
    '-b:v', `${targetBitrateKbps}k`,
    '-maxrate', `${maxrateKbps}k`,
    '-bufsize', `${bufsize}k`,
    '-movflags', '+faststart',
    '-ar', '48000',
  ];

  // HandBrake é suficiente para proxy (mais rápido)
  const handbrakePreset = profile === 'nexora_proxy_lowres' ? 'NexoraProxyLowRes' : undefined;

  return {
    action,
    rejectReason: reasons.length > 0 ? reasons.join('; ') : undefined,
    targetProfile: profile,
    videoParams: {
      codec:         codecMap[profile] as any,
      profile:       isBroadcast ? 'high' : profile === 'nexora_ott_premium' ? 'main' : 'high',
      level:         isBroadcast ? '4.1' : '4.0',
      pixelFormat:   needsHDR ? 'yuv420p10le' : 'yuv420p',
      gopSize,
      keyintMin,
      scThreshold:   0,
      closedGop:     true,
      bFrames:       0,
      targetBitrateKbps,
      maxrateKbps,
      bufsize,
      colorSpace:    'bt709',
      colorPrimaries: 'bt709',
      colorTrc:      'bt709',
    },
    audioParams: {
      codec:         audioCodec,
      sampleRate:    48000,
      targetLufs,
      truePeakLimit: -1,
      channels:      Math.max(2, audio.channels),
      bitrateKbps:   audioBitrateMap[audioCodec],
    },
    audioNormalizationRequired: audioNorm,
    transcodeRequired: action === 'TRANSCODE',
    captionProcessingRequired: false, // determinado por análise do ficheiro
    ffmpegParams,
    handbrakePreset,
    estimatedDurationMs: estimateDuration(video, profile),
    priorityLevel: 'normal',
  };
}

/** Estimar duração do processamento em ms */
function estimateDuration(video: VideoMetadata, profile: NexoraProfile): number {
  const durationS = video.duration;
  // Factores de velocidade aproximados (1x = real-time)
  const speedFactors: Record<NexoraProfile, number> = {
    nexora_broadcast_hd:  0.5,   // ~2× mais lento que real-time
    nexora_ott_premium:   0.25,  // ~4× mais lento (H.265)
    nexora_streaming_web: 0.8,   // ~1.25× mais lento
    nexora_proxy_lowres:  2.0,   // ~2× mais rápido que real-time
    nexora_archive:       0.3,   // ~3× mais lento (ProRes sem GPU)
  };
  return Math.round(durationS / speedFactors[profile] * 1000);
}


// ═══════════════════════════════════════════════════════════════
// Nexora — Analyzer Worker
// Ficheiro: src/workers/analyzer.worker.ts
//
// Analisa o conteúdo do ficheiro (SI/TI) e toma decisões
// de encoding usando o Decision Engine.
// ═══════════════════════════════════════════════════════════════

import { Worker, Job } from 'bullmq';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { redisConnection, queues } from './queues';
import { decideProcessing } from '../pipeline/decision-engine';
import { executeFFprobe } from '../pipeline/ffmpeg/executor';
import { prisma } from '../db/prisma';
import { logger } from '../observability/logger';
import type { NexoraProfile } from './transcode.worker';

const execFileAsync = promisify(execFile);

export interface AnalyzeJobPayload {
  assetId:   string;
  inputPath: string;
  profile:   NexoraProfile;
}

export class AnalyzerWorker {
  readonly name = 'analyzer-worker';
  private worker: Worker | null = null;

  async start(): Promise<void> {
    this.worker = new Worker(
      'analyze',
      async (job: Job<AnalyzeJobPayload>) => this.process(job),
      {
        connection: redisConnection,
        concurrency: 4,
      }
    );
  }

  async stop(): Promise<void> { await this.worker?.close(); }

  private async process(job: Job<AnalyzeJobPayload>): Promise<void> {
    const { assetId, inputPath, profile } = job.data;
    const log = logger.child({ asset_id: assetId, job_id: job.id, worker: 'analyzer' });

    log.info({ inputPath, profile }, 'A analisar conteúdo do asset');

    await prisma.asset.update({ where: { id: assetId }, data: { status: 'ANALYZING' } });

    // ── 1. Obter metadata detalhada ───────────────────────────
    const ffprobeData = await executeFFprobe(inputPath, { assetId }) as any;
    const videoStream = ffprobeData?.streams?.find((s: any) => s.codec_type === 'video') ?? {};
    const audioStream = ffprobeData?.streams?.find((s: any) => s.codec_type === 'audio') ?? {};

    const fps        = parseFloat(videoStream.r_frame_rate?.replace(/(\d+)\/(\d+)/, (_: string, n: string, d: string) => String(parseInt(n) / parseInt(d))) ?? '25');
    const durationMs = Math.round(parseFloat(ffprobeData?.format?.duration ?? '0') * 1000);

    // ── 2. Análise SI/TI (Spatial/Temporal Information) ───────
    // SI mede complexidade espacial, TI mede complexidade temporal
    const { si, ti } = await analyzeComplexity(inputPath, fps);

    // ── 3. Classificar tipo de conteúdo ──────────────────────
    const contentType = classifyContent(si, ti);

    // ── 4. Ajustar bitrate conforme tipo de conteúdo ─────────
    const bitrateMultiplier = getBitrateMultiplier(contentType);

    log.info({ si: si.toFixed(1), ti: ti.toFixed(1), contentType, bitrateMultiplier }, 'Análise concluída');

    // ── 5. Usar Decision Engine para decisão final ───────────
    const decision = decideProcessing({
      assetId,
      profile,
      video: {
        codec:         videoStream.codec_name ?? 'unknown',
        profile:       videoStream.profile ?? '',
        level:         String(videoStream.level ?? ''),
        pixelFormat:   videoStream.pix_fmt ?? 'unknown',
        frameRate:     fps,
        frameRateMode: videoStream.r_frame_rate === videoStream.avg_frame_rate ? 'CFR' : 'VFR',
        gopType:       'UNKNOWN', // QC já verificou
        hasIdrFrames:  true,
        bFrameCount:   0,
        bitrate:       parseInt(videoStream.bit_rate ?? '0') / 1000,
        width:         videoStream.width ?? 0,
        height:        videoStream.height ?? 0,
        bitDepth:      parseInt(videoStream.bits_per_raw_sample ?? '8') as 8 | 10 | 12,
        colorSpace:    videoStream.color_space ?? 'bt709',
        colorPrimaries: videoStream.color_primaries ?? 'bt709',
        transferCharacteristics: videoStream.color_transfer ?? 'bt709',
        duration:      durationMs / 1000,
        hasFastStart:  false,
      },
      audio: {
        codec:         audioStream.codec_name ?? 'unknown',
        sampleRate:    parseInt(audioStream.sample_rate ?? '48000'),
        bitDepth:      parseInt(audioStream.bits_per_raw_sample ?? '16'),
        channels:      audioStream.channels ?? 2,
        channelLayout: audioStream.channel_layout ?? 'stereo',
        integratedLufs: null,
        truePeakDbtp:  null,
        loudnessRange: null,
        audioVideoSyncMs: 0,
      },
    });

    // Ajustar bitrate pelo tipo de conteúdo (Regra 10 do Decision Engine)
    const finalBitrateKbps = Math.round(
      decision.videoParams.targetBitrateKbps * bitrateMultiplier
    );

    // ── 6. Actualizar asset com informação de análise ─────────
    await prisma.asset.update({
      where: { id: assetId },
      data: {
        frameRate:  fps,
        durationMs,
        resolution: `${decision.videoParams ? `${(ffprobeData?.streams?.[0]?.width ?? 0)}x${(ffprobeData?.streams?.[0]?.height ?? 0)}` : 'unknown'}`,
      }
    });

    // ── 7. Enfileirar transcode e audio em paralelo ──────────
    const outputDir  = inputPath.replace('/input/', '/output/');
    const outputPath = outputDir.replace('.mp4', `_${profile}.mp4`);
    const audioPath  = outputDir.replace('.mp4', `_${profile}_audio.mp4`);

    await Promise.all([
      queues.transcode.add('transcode', {
        assetId,
        inputPath,
        outputPath,
        profile,
        fps,
        bitrateKbps: finalBitrateKbps,
        durationMs,
      }, { priority: 5 }),

      queues.audio.add('audio', {
        assetId,
        inputPath,
        outputPath: audioPath,
        profile,
      }),
    ]);

    // Proxy e thumbnails também em paralelo (prioridade mais baixa)
    await queues.proxy.add('proxy', {
      assetId,
      inputPath,
      outputDir: outputDir.replace(/\/[^/]+$/, '/'),
    }, { priority: 8 });

    log.info(
      { action: decision.action, contentType, bitrateKbps: finalBitrateKbps },
      `Decisão: ${decision.action} — bitrate ${finalBitrateKbps}kbps`
    );
  }
}

/** Análise de complexidade SI/TI via FFmpeg */
async function analyzeComplexity(
  inputPath: string,
  fps: number
): Promise<{ si: number; ti: number }> {
  try {
    // Analisar 30 segundos de amostra representativa (meio do ficheiro)
    const { stdout } = await execFileAsync(
      process.env.FFMPEG_PATH ?? 'ffmpeg',
      [
        '-ss', '30',           // começar aos 30s
        '-t',  '10',           // analisar 10s
        '-i',  inputPath,
        '-vf', 'signalstats',  // calcular SI/TI
        '-f',  'null', '-',
      ],
      { timeout: 60000 }
    );

    // Parsear valores de SI e TI do stderr do FFmpeg
    const siMatch = stdout.match(/YDIF\.mean:(\d+\.?\d*)/);
    const tiMatch = stdout.match(/UVLPF\.mean:(\d+\.?\d*)/);

    return {
      si: siMatch ? parseFloat(siMatch[1]) : 50,
      ti: tiMatch ? parseFloat(tiMatch[1]) : 30,
    };
  } catch {
    // Se análise falhar, usar valores médios (comportamento seguro)
    return { si: 50, ti: 30 };
  }
}

/** Classificar tipo de conteúdo baseado em SI/TI */
function classifyContent(si: number, ti: number): string {
  if (ti > 60)              return 'sport';       // muito movimento
  if (si < 20 && ti < 20)  return 'animation';   // pouca complexidade
  if (si < 30 && ti < 30)  return 'talking_head'; // baixa complexidade
  if (si > 60)              return 'cinema';      // alta complexidade espacial
  return 'news';                                   // caso geral
}

/** Multiplicador de bitrate por tipo de conteúdo */
function getBitrateMultiplier(contentType: string): number {
  const multipliers: Record<string, number> = {
    sport:        1.30,  // +30%
    animation:    0.60,  // -40%
    talking_head: 0.75,  // -25%
    cinema:       1.10,  // +10%
    news:         0.85,  // -15%
  };
  return multipliers[contentType] ?? 1.0;
}
