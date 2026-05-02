// Nexora Media Processing — GPU Detector
// Ficheiro: src/pipeline/ffmpeg/gpu-detector.ts
//
// Detecta GPU disponível e verifica se funciona com FFmpeg.
// Sequência: nvidia-smi → vainfo → encode test (5 frames) → fallback CPU.
// Cache Redis com TTL de 30 minutos para evitar re-detecção frequente.
//
// ADR-002: todos os processos externos via execFile (nunca exec+string)

import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../observability/logger';

const execFileAsync = promisify(execFile);

// ── Tipos públicos ───────────────────────────────────────────────

export type GPUType = 'nvenc' | 'qsv' | 'amf' | 'none';

export interface GPUCapability {
  available: boolean;
  type: GPUType;
  /** Nome do dispositivo (ex: 'NVIDIA GeForce RTX 3090') */
  device?: string;
  /** Driver version se disponível */
  driverVersion?: string;
  /** Timestamp da detecção */
  testedAt: Date;
}

// ── Constantes ───────────────────────────────────────────────────

/** TTL do cache em segundos (30 minutos) */
const CACHE_TTL_SECONDS = 30 * 60;

/** Chave Redis para cache da capacidade GPU */
const REDIS_CACHE_KEY = 'nexora:gpu:capability';

/** Timeout para processos de detecção (ms) */
const DETECTION_TIMEOUT_MS = 10_000;

/** Timeout para encode de teste (ms) */
const TEST_ENCODE_TIMEOUT_MS = 15_000;

// ── Detector ─────────────────────────────────────────────────────

export class NexoraGPUDetector {

  private redisClient: { get: (key: string) => Promise<string | null>; set: (key: string, value: string, mode: string, ttl: number) => Promise<unknown> } | null = null;

  constructor(redisClient?: { get: (key: string) => Promise<string | null>; set: (key: string, value: string, mode: string, ttl: number) => Promise<unknown> }) {
    this.redisClient = redisClient ?? null;
  }

  /**
   * Detecta a GPU disponível, com cache Redis.
   * @param forceRefresh - Ignora cache e re-detecta
   */
  async detect(forceRefresh = false): Promise<GPUCapability> {
    // 1. Verificar cache Redis
    if (!forceRefresh && this.redisClient) {
      const cached = await this.getFromCache();
      if (cached) {
        logger.debug({ gpu: cached.type, device: cached.device }, 'GPU capability from cache');
        return cached;
      }
    }

    // 2. Executar detecção
    const capability = await this.runDetection();

    // 3. Guardar em cache
    if (this.redisClient) {
      await this.saveToCache(capability);
    }

    return capability;
  }

  /** Orquestra a sequência de detecção */
  private async runDetection(): Promise<GPUCapability> {
    logger.info('A detectar capacidade GPU...');

    // Passo 1: Tentar NVIDIA (nvidia-smi)
    const nvidia = await this.detectNvidia();
    if (nvidia) {
      // Passo 3: Teste de encode real para confirmar NVENC
      const nvencWorks = await this.testEncode('h264_nvenc');
      if (nvencWorks) {
        logger.info({ device: nvidia.device, driver: nvidia.driverVersion }, 'GPU NVIDIA NVENC disponível');
        return { available: true, type: 'nvenc', ...nvidia, testedAt: new Date() };
      }
      logger.warn('NVIDIA detectada mas NVENC encode falhou — a tentar CPU fallback');
    }

    // Passo 2: Tentar VAAPI (Intel QSV / AMD)
    const vaapi = await this.detectVAAPI();
    if (vaapi) {
      const qsvWorks = await this.testEncode('h264_qsv');
      if (qsvWorks) {
        logger.info({ device: vaapi.device }, 'GPU Intel QSV disponível');
        return { available: true, type: 'qsv', device: vaapi.device, testedAt: new Date() };
      }

      // Tentar AMF (AMD via VAAPI)
      const amfWorks = await this.testEncode('h264_amf');
      if (amfWorks) {
        logger.info({ device: vaapi.device }, 'GPU AMD AMF disponível');
        return { available: true, type: 'amf', device: vaapi.device, testedAt: new Date() };
      }
    }

    // Fallback: CPU
    logger.info('Nenhuma GPU disponível — usando CPU (libx264)');
    return { available: false, type: 'none', testedAt: new Date() };
  }

  /** Detecta NVIDIA via nvidia-smi */
  private async detectNvidia(): Promise<{ device: string; driverVersion: string } | null> {
    try {
      const { stdout } = await execFileAsync(
        'nvidia-smi',
        ['--query-gpu=name,driver_version', '--format=csv,noheader'],
        { timeout: DETECTION_TIMEOUT_MS }
      );

      const lines = stdout.trim().split('\n');
      if (lines.length === 0) return null;

      const [device, driverVersion] = lines[0].split(', ').map(s => s.trim());
      return { device: device ?? 'NVIDIA GPU', driverVersion: driverVersion ?? 'unknown' };

    } catch {
      logger.debug('nvidia-smi não disponível');
      return null;
    }
  }

  /** Detecta VAAPI (Intel/AMD) via vainfo */
  private async detectVAAPI(): Promise<{ device: string } | null> {
    try {
      const { stdout } = await execFileAsync(
        'vainfo',
        [],
        { timeout: DETECTION_TIMEOUT_MS }
      );

      // vainfo output contém o driver no início
      const driverMatch = stdout.match(/VA-API version.*?using driver (.+)/i);
      const device = driverMatch?.[1]?.trim() ?? 'VAAPI GPU';

      return { device };

    } catch {
      logger.debug('vainfo não disponível');
      return null;
    }
  }

  /**
   * Testa encode real com 5 frames para confirmar que o encoder funciona.
   * ADR-002: execFile com array de argumentos.
   */
  private async testEncode(encoder: string): Promise<boolean> {
    const ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg';

    try {
      await execFileAsync(
        ffmpegPath,
        [
          '-y',
          '-f', 'lavfi',
          '-i', 'testsrc2=duration=1:size=320x240:rate=5',  // 5 frames
          '-c:v', encoder,
          '-frames:v', '5',
          '-f', 'null',
          '-',
        ],
        { timeout: TEST_ENCODE_TIMEOUT_MS }
      );

      logger.debug({ encoder }, 'Teste de encode GPU bem sucedido');
      return true;

    } catch (err) {
      logger.debug({ encoder, err: String(err) }, 'Teste de encode GPU falhou');
      return false;
    }
  }

  // ── Cache Redis ────────────────────────────────────────────────

  private async getFromCache(): Promise<GPUCapability | null> {
    try {
      const raw = await this.redisClient!.get(REDIS_CACHE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as GPUCapability & { testedAt: string };
      return { ...parsed, testedAt: new Date(parsed.testedAt) };

    } catch {
      return null;
    }
  }

  private async saveToCache(capability: GPUCapability): Promise<void> {
    try {
      await this.redisClient!.set(
        REDIS_CACHE_KEY,
        JSON.stringify(capability),
        'EX',
        CACHE_TTL_SECONDS
      );
    } catch (err) {
      logger.warn({ err: String(err) }, 'Falha ao guardar GPU capability em cache');
    }
  }
}

// ── Singleton ────────────────────────────────────────────────────

let _detector: NexoraGPUDetector | null = null;

/** Retorna o singleton do GPU detector, com Redis client opcional */
export function getGPUDetector(redisClient?: Parameters<typeof NexoraGPUDetector.prototype.detect>[0] extends never ? never : ConstructorParameters<typeof NexoraGPUDetector>[0]): NexoraGPUDetector {
  if (!_detector) {
    _detector = new NexoraGPUDetector(redisClient);
  }
  return _detector;
}

/** Cache em memória para evitar re-instanciação do singleton */
let _cachedCapability: GPUCapability | null = null;

/**
 * Retorna a capacidade GPU, usando cache em memória se disponível.
 * Conveniente para uso nos workers sem precisar de injectar Redis.
 */
export async function detectGPU(forceRefresh = false): Promise<GPUCapability> {
  if (!forceRefresh && _cachedCapability) {
    const ageMs = Date.now() - _cachedCapability.testedAt.getTime();
    if (ageMs < CACHE_TTL_SECONDS * 1000) {
      return _cachedCapability;
    }
  }

  const detector = new NexoraGPUDetector();
  _cachedCapability = await detector.detect(forceRefresh);
  return _cachedCapability;
}
