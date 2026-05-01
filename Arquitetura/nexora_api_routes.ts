// ═══════════════════════════════════════════════════════════════
// Nexora Media Processing — API Routes: Assets
// Ficheiro: src/api/routes/assets.ts
// ═══════════════════════════════════════════════════════════════

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { prisma } from '../db/prisma';
import { enqueueIngest } from '../workers/queues';
import { logger } from '../observability/logger';
import { assetsIngested } from '../observability/metrics';

// ── Schemas de validação (Zod) ─────────────────────────────────

const IngestBodySchema = z.object({
  profile: z.enum([
    'nexora_broadcast_hd',
    'nexora_ott_premium',
    'nexora_streaming_web',
    'nexora_proxy_lowres',
    'nexora_archive',
  ]).default('nexora_broadcast_hd'),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
  webhookUrl: z.string().url().optional(),
  metadata: z.record(z.string()).optional(),
});

const ListAssetsQuerySchema = z.object({
  status: z.string().optional(),
  profile: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(25),
  search: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

// ── Registo das rotas ──────────────────────────────────────────

export async function assetsRoutes(app: FastifyInstance): Promise<void> {

  // POST /api/v1/assets — Ingest de novo asset
  app.post('/assets', {
    schema: {
      summary: 'Ingest de novo asset',
      tags: ['assets'],
      consumes: ['multipart/form-data'],
      response: {
        202: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            meta: { type: 'object' },
          }
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const assetId    = randomUUID();
    const requestId  = randomUUID();

    try {
      // Processar multipart upload
      const data = await req.file();
      if (!data) {
        return reply.status(422).send({
          error: {
            code: 'MISSING_FILE',
            message: 'Nenhum ficheiro foi enviado',
            details: 'Envia o ficheiro no campo "file" do multipart form'
          },
          meta: { requestId, timestamp: new Date().toISOString(), version: '1' }
        });
      }

      // Validar campos do form
      const bodyResult = IngestBodySchema.safeParse(Object.fromEntries(
        Object.entries(data.fields).map(([k, v]) => [k, (v as any)?.value ?? v])
      ));

      if (!bodyResult.success) {
        return reply.status(422).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Parâmetros inválidos',
            details: bodyResult.error.issues
          },
          meta: { requestId, timestamp: new Date().toISOString(), version: '1' }
        });
      }

      const { profile, priority, webhookUrl } = bodyResult.data;

      // Validar magic bytes (SEGURANÇA — ver ADR-002)
      const buffer = await data.toBuffer();
      const magicCheck = validateMagicBytes(buffer);
      if (!magicCheck.valid) {
        return reply.status(422).send({
          error: {
            code: 'INVALID_FILE_TYPE',
            message: `Tipo de ficheiro não suportado: ${magicCheck.detected ?? 'desconhecido'}`,
            details: 'Formatos aceites: MP4, MOV, MXF, MKV, TS, WAV, MP3, AAC'
          },
          meta: { requestId, timestamp: new Date().toISOString(), version: '1' }
        });
      }

      // Sanitizar filename (SEGURANÇA)
      const safeFilename = sanitizeFilename(data.filename ?? 'unknown');
      const internalFilename = `${assetId}_${safeFilename}`;
      const inputDir = process.env.NEXORA_INPUT_DIR ?? './media/input';
      const savedPath = path.join(inputDir, internalFilename);

      // Guardar ficheiro com UUID interno (nunca usar filename original em paths)
      await pipeline(
        data.file,
        createWriteStream(savedPath)
      );

      // Calcular SHA-256 (ADR-003)
      const sha256 = createHash('sha256').update(buffer).digest('hex');

      // Criar asset na base de dados
      const asset = await prisma.asset.create({
        data: {
          id: assetId,
          originalName: safeFilename,
          sha256Input: sha256,
          status: 'INGESTED',
          profile,
          ...(webhookUrl && { webhookUrl }),
        }
      });

      // Audit log imutável (ADR-007)
      await writeAuditLog(assetId, 'asset_ingested', 'api', {
        originalName: safeFilename,
        profile,
        priority,
        sha256,
        size: buffer.length,
      });

      // Enfileirar para processamento
      await enqueueIngest({
        assetId,
        inputPath: savedPath,
        profile,
        priority,
        webhookUrl,
      });

      // Métrica Prometheus
      assetsIngested.inc();

      logger.info({ assetId, profile, priority }, 'Asset recebido e enfileirado');

      return reply.status(202).send({
        data: {
          id: asset.id,
          status: 'INGESTED',
          profile,
          originalName: safeFilename,
          createdAt: asset.createdAt,
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          version: '1',
          message: 'Asset recebido e em processamento'
        }
      });

    } catch (error) {
      logger.error({ error, assetId }, 'Erro no ingest do asset');
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Erro interno ao processar o upload' },
        meta: { requestId, timestamp: new Date().toISOString(), version: '1' }
      });
    }
  });

  // GET /api/v1/assets — Listar assets com paginação e filtros
  app.get('/assets', async (req: FastifyRequest, reply: FastifyReply) => {
    const requestId = randomUUID();
    const queryResult = ListAssetsQuerySchema.safeParse(req.query);

    if (!queryResult.success) {
      return reply.status(422).send({
        error: { code: 'VALIDATION_ERROR', message: 'Parâmetros de query inválidos', details: queryResult.error.issues },
        meta: { requestId, timestamp: new Date().toISOString(), version: '1' }
      });
    }

    const { status, profile, page, pageSize, search, dateFrom, dateTo } = queryResult.data;
    const skip = (page - 1) * pageSize;

    const where = {
      ...(status && { status: { in: status.split(',') } }),
      ...(profile && { profile }),
      ...(search && {
        originalName: { contains: search, mode: 'insensitive' as const }
      }),
      ...(dateFrom || dateTo) && {
        createdAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        }
      },
    };

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true, originalName: true, status: true, profile: true,
          resolution: true, durationMs: true, vmafScore: true,
          loudnessLufs: true, createdAt: true, updatedAt: true,
        }
      }),
      prisma.asset.count({ where })
    ]);

    return reply.send({
      data: assets,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        version: '1',
        total,
        page,
        pageSize,
        hasMore: skip + assets.length < total,
      }
    });
  });

  // GET /api/v1/assets/:id — Detalhe de um asset
  app.get('/assets/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const requestId = randomUUID();
    const { id } = req.params;

    const asset = await prisma.asset.findUnique({
      where: { id },
      include: { jobs: { orderBy: { createdAt: 'desc' }, take: 10 } }
    });

    if (!asset) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: `Asset ${id} não encontrado` },
        meta: { requestId, timestamp: new Date().toISOString(), version: '1' }
      });
    }

    return reply.send({
      data: asset,
      meta: { requestId, timestamp: new Date().toISOString(), version: '1' }
    });
  });

  // GET /api/v1/assets/:id/status — SSE stream de status
  app.get('/assets/:id/status', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = req.params;

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // desactivar buffering nginx
    });

    const sendEvent = (data: object): void => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Enviar estado actual imediatamente
    const asset = await prisma.asset.findUnique({
      where: { id },
      select: { id: true, status: true, vmafScore: true, loudnessLufs: true, updatedAt: true }
    });

    if (!asset) {
      sendEvent({ error: 'Asset não encontrado' });
      reply.raw.end();
      return;
    }

    sendEvent({ type: 'status', data: asset });

    // Polling periódico de estado (a cada 2 segundos)
    let lastStatus = asset.status;
    const intervalId = setInterval(async () => {
      try {
        const updated = await prisma.asset.findUnique({
          where: { id },
          select: { id: true, status: true, vmafScore: true, loudnessLufs: true, updatedAt: true }
        });

        if (!updated) {
          clearInterval(intervalId);
          reply.raw.end();
          return;
        }

        if (updated.status !== lastStatus) {
          lastStatus = updated.status;
          sendEvent({ type: 'status', data: updated });
        }

        // Terminar SSE quando asset chega a estado final
        if (['READY', 'FAILED', 'QC_REJECT'].includes(updated.status)) {
          sendEvent({ type: 'complete', data: updated });
          clearInterval(intervalId);
          reply.raw.end();
        }
      } catch {
        clearInterval(intervalId);
        reply.raw.end();
      }
    }, 2000);

    // Limpar quando cliente desligar
    req.socket.on('close', () => { clearInterval(intervalId); });
  });

  // GET /api/v1/assets/:id/qc-report — Relatório QC completo
  app.get('/assets/:id/qc-report', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const requestId = randomUUID();
    const { id } = req.params;

    const jobs = await prisma.job.findMany({
      where: { assetId: id, type: { in: ['QC_PRE', 'QC_POST'] } },
      orderBy: { createdAt: 'desc' },
    });

    if (jobs.length === 0) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Relatório QC não disponível para este asset' },
        meta: { requestId, timestamp: new Date().toISOString(), version: '1' }
      });
    }

    return reply.send({
      data: jobs.map(j => ({ ...j, result: j.result })),
      meta: { requestId, timestamp: new Date().toISOString(), version: '1' }
    });
  });

  // POST /api/v1/assets/:id/reprocess — Re-processar com novo perfil
  app.post('/assets/:id/reprocess', async (
    req: FastifyRequest<{ Params: { id: string }; Body: { profile?: string } }>,
    reply: FastifyReply
  ) => {
    const requestId = randomUUID();
    const { id } = req.params;

    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: `Asset ${id} não encontrado` },
        meta: { requestId, timestamp: new Date().toISOString(), version: '1' }
      });
    }

    const newProfile = req.body?.profile ?? asset.profile;

    // Resetar estado
    await prisma.asset.update({
      where: { id },
      data: { status: 'INGESTED', profile: newProfile, vmafScore: null, loudnessLufs: null }
    });

    await writeAuditLog(id, 'asset_reprocess_requested', 'api', {
      newProfile,
      previousProfile: asset.profile,
    });

    await enqueueIngest({
      assetId: id,
      inputPath: path.join(process.env.NEXORA_INPUT_DIR ?? './media/input', `${id}_${asset.originalName}`),
      profile: newProfile as any,
      priority: 'normal',
    });

    return reply.status(202).send({
      data: { id, status: 'INGESTED', profile: newProfile },
      meta: { requestId, timestamp: new Date().toISOString(), version: '1' }
    });
  });

  // GET /api/v1/assets/:id/audit — Audit trail imutável
  app.get('/assets/:id/audit', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const requestId = randomUUID();
    const { id } = req.params;

    const logs = await prisma.auditLog.findMany({
      where: { assetId: id },
      orderBy: { createdAt: 'asc' },
    });

    return reply.send({
      data: logs,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        version: '1',
        total: logs.length,
        note: 'Registo imutável — só leitura (ADR-007)'
      }
    });
  });
}

// ── Utilitários de segurança ──────────────────────────────────

/** Magic bytes para validar tipo de ficheiro (SEGURANÇA) */
function validateMagicBytes(buffer: Buffer): { valid: boolean; detected?: string } {
  if (buffer.length < 16) return { valid: false, detected: 'ficheiro muito pequeno' };

  // MP4/MOV: ftyp box (bytes 4-7)
  if (buffer.slice(4, 8).toString('ascii') === 'ftyp') return { valid: true, detected: 'mp4/mov' };

  // MXF: UL header
  if (buffer[0] === 0x06 && buffer[1] === 0x0E && buffer[2] === 0x2B && buffer[3] === 0x34)
    return { valid: true, detected: 'mxf' };

  // MPEG-TS: sync byte 0x47
  if (buffer[0] === 0x47) return { valid: true, detected: 'mpeg-ts' };

  // MKV/WebM: EBML header
  if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3)
    return { valid: true, detected: 'mkv' };

  // WAV: RIFF
  if (buffer.slice(0, 4).toString('ascii') === 'RIFF') return { valid: true, detected: 'wav' };

  // MP3: ID3 tag
  if (buffer.slice(0, 3).toString('ascii') === 'ID3') return { valid: true, detected: 'mp3' };

  // MP3: sync word FF FB
  if (buffer[0] === 0xFF && (buffer[1] === 0xFB || buffer[1] === 0xFA))
    return { valid: true, detected: 'mp3' };

  // AAC: ADTS sync FF F1 ou FF F9
  if (buffer[0] === 0xFF && (buffer[1] === 0xF1 || buffer[1] === 0xF9))
    return { valid: true, detected: 'aac' };

  return { valid: false, detected: `hex: ${buffer.slice(0, 4).toString('hex')}` };
}

/** Sanitizar filename — remover caracteres perigosos */
function sanitizeFilename(filename: string): string {
  return path.basename(filename)
    .replace(/[^a-zA-Z0-9._\-]/g, '_')
    .slice(0, 255);
}

/** Escrever audit log imutável (ADR-007) */
async function writeAuditLog(
  assetId: string,
  eventType: string,
  operator: string,
  payload: object
): Promise<void> {
  // Hash chain: SHA-256 do conteúdo actual (simplificado)
  const content = JSON.stringify({ assetId, eventType, operator, payload, ts: Date.now() });
  const entryHash = createHash('sha256').update(content).digest('hex');

  await prisma.auditLog.create({
    data: { assetId, eventType, operator, payload, entryHash }
  });
}


// ═══════════════════════════════════════════════════════════════
// Nexora — API Routes: Jobs
// Ficheiro: src/api/routes/jobs.ts
// ═══════════════════════════════════════════════════════════════

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { prisma } from '../db/prisma';
import { logger } from '../observability/logger';

export async function jobsRoutes(app: FastifyInstance): Promise<void> {

  // GET /api/v1/jobs/:id — Estado e logs de um job
  app.get('/jobs/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const requestId = randomUUID();
    const { id } = req.params;

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: `Job ${id} não encontrado` },
        meta: { requestId, timestamp: new Date().toISOString(), version: '1' }
      });
    }

    return reply.send({
      data: job,
      meta: { requestId, timestamp: new Date().toISOString(), version: '1' }
    });
  });

  // GET /api/v1/assets/:id/jobs — Todos os jobs de um asset
  app.get('/assets/:id/jobs', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const requestId = randomUUID();
    const { id } = req.params;

    const jobs = await prisma.job.findMany({
      where: { assetId: id },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send({
      data: jobs,
      meta: { requestId, timestamp: new Date().toISOString(), version: '1', total: jobs.length }
    });
  });

  // GET /api/v1/queue/stats — Estatísticas das filas
  app.get('/queue/stats', async (_req, reply: FastifyReply) => {
    const requestId = randomUUID();

    // Contar jobs por estado
    const stats = await prisma.job.groupBy({
      by: ['status', 'type'],
      _count: { id: true },
    });

    // Assets por estado
    const assetStats = await prisma.asset.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    return reply.send({
      data: {
        jobs: stats,
        assets: assetStats,
        timestamp: new Date().toISOString(),
      },
      meta: { requestId, timestamp: new Date().toISOString(), version: '1' }
    });
  });

  // GET /api/v1/metrics/summary — Resumo de métricas para dashboard
  app.get('/metrics/summary', async (_req, reply: FastifyReply) => {
    const requestId = randomUUID();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalToday,
      successToday,
      failedToday,
      avgVmaf,
    ] = await Promise.all([
      prisma.asset.count({ where: { createdAt: { gte: since24h } } }),
      prisma.asset.count({ where: { status: 'READY', updatedAt: { gte: since24h } } }),
      prisma.asset.count({ where: { status: 'FAILED', updatedAt: { gte: since24h } } }),
      prisma.asset.aggregate({
        where: { vmafScore: { not: null } },
        _avg: { vmafScore: true }
      }),
    ]);

    const successRate = totalToday > 0 ? Math.round((successToday / totalToday) * 100) : 0;

    return reply.send({
      data: {
        today: { total: totalToday, success: successToday, failed: failedToday, successRate },
        quality: { avgVmaf: avgVmaf._avg.vmafScore?.toFixed(1) ?? null },
        timestamp: new Date().toISOString(),
      },
      meta: { requestId, timestamp: new Date().toISOString(), version: '1' }
    });
  });

  // GET /api/v1/profiles — Perfis de encoding disponíveis
  app.get('/profiles', async (_req, reply: FastifyReply) => {
    const requestId = randomUUID();

    return reply.send({
      data: [
        {
          id: 'nexora_broadcast_hd',
          name: 'Broadcast HD',
          description: 'H.264 High Profile para emissão broadcast (RTP, SIC, TVI, BBC...)',
          container: 'MP4 (MXF via conversão)',
          codec: 'H.264',
          bitrate: '8 Mbps',
          loudness: '-23 LUFS (EBU R128)',
          standards: ['EBU R128', 'AS-11 UK DPP'],
        },
        {
          id: 'nexora_ott_premium',
          name: 'OTT Premium',
          description: 'H.265 com DRM para plataformas OTT (Netflix, Amazon, Disney+)',
          container: 'CMAF (fMP4)',
          codec: 'H.265',
          bitrate: 'Dinâmica (per-title)',
          loudness: '-14 LUFS',
          standards: ['IMF SMPTE ST 2067', 'CMAF ISO 23000-19'],
        },
        {
          id: 'nexora_streaming_web',
          name: 'Streaming Web',
          description: 'H.264 optimizado para YouTube, Vimeo e web players',
          container: 'MP4 (Fast Start)',
          codec: 'H.264',
          bitrate: '4 Mbps (1080p)',
          loudness: '-14 LUFS',
          standards: ['Apple HLS Authoring Spec'],
        },
        {
          id: 'nexora_proxy_lowres',
          name: 'Proxy LowRes',
          description: 'H.264 baixa resolução para revisão editorial',
          container: 'MP4',
          codec: 'H.264',
          bitrate: '800 kbps',
          loudness: '-14 LUFS',
          standards: [],
        },
        {
          id: 'nexora_archive',
          name: 'Arquivo',
          description: 'ProRes 4444 para arquivo profissional de longa duração',
          container: 'MXF OP1a',
          codec: 'ProRes 4444',
          bitrate: 'Lossless quality',
          loudness: '-23 LUFS',
          standards: ['IMF SMPTE ST 2067'],
        },
      ],
      meta: { requestId, timestamp: new Date().toISOString(), version: '1' }
    });
  });
}


// ═══════════════════════════════════════════════════════════════
// Nexora — API Middleware: Auth JWT RS256
// Ficheiro: src/api/middleware/auth.ts
// ADR-008: RS256 JWT com rotação — HS256 proibido em produção
// ═══════════════════════════════════════════════════════════════

import { FastifyRequest, FastifyReply } from 'fastify';
import { readFileSync } from 'fs';
import * as jose from 'jose';
import { logger } from '../observability/logger';

const PUBLIC_KEY_PATH = process.env.JWT_PUBLIC_KEY_PATH ?? './secrets/jwt_public.pem';

let publicKey: jose.KeyLike;

async function getPublicKey(): Promise<jose.KeyLike> {
  if (publicKey) return publicKey;
  try {
    const pem = readFileSync(PUBLIC_KEY_PATH, 'utf8');
    publicKey = await jose.importSPKI(pem, 'RS256');
    return publicKey;
  } catch {
    // Em desenvolvimento, gerar chaves temporárias
    if (process.env.NODE_ENV === 'development') {
      const { publicKey: pk, privateKey: sk } = await jose.generateKeyPair('RS256');
      publicKey = pk;
      logger.warn('A usar chaves JWT temporárias — NÃO usar em produção!');
      return publicKey;
    }
    throw new Error(
      `Não foi possível carregar a chave pública JWT em ${PUBLIC_KEY_PATH}. ` +
      'Gera as chaves com: openssl genrsa -out ./secrets/jwt_private.pem 4096 && ' +
      'openssl rsa -in ./secrets/jwt_private.pem -pubout -out ./secrets/jwt_public.pem'
    );
  }
}

export interface NexoraJWTPayload {
  sub: string;
  org: string;
  roles: ('admin' | 'operator' | 'viewer' | 'api')[];
  permissions: string[];
  jti: string;
  iat: number;
  exp: number;
}

/** Middleware de autenticação JWT RS256 */
export async function authMiddleware(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Rotas públicas (health checks, metrics)
  const publicPaths = ['/health', '/health/live', '/health/ready', '/metrics'];
  if (publicPaths.some(p => req.url.startsWith(p))) return;

  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: {
        code: 'MISSING_TOKEN',
        message: 'Token de autenticação em falta — usa Bearer Token no header Authorization'
      }
    });
  }

  const token = authorization.slice(7);

  try {
    const key = await getPublicKey();
    const { payload } = await jose.jwtVerify(token, key, {
      algorithms: ['RS256'],
    });

    // Adicionar payload ao request para uso nas rotas
    (req as any).user = payload as NexoraJWTPayload;

  } catch (error) {
    const message = error instanceof jose.errors.JWTExpired
      ? 'Token expirado'
      : error instanceof jose.errors.JWTInvalid
      ? 'Token inválido'
      : 'Falha na verificação do token';

    return reply.status(401).send({
      error: { code: 'INVALID_TOKEN', message }
    });
  }
}

/** Verificar se o utilizador tem a permissão necessária */
export function requirePermission(permission: string) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = (req as any).user as NexoraJWTPayload | undefined;
    if (!user) {
      return reply.status(401).send({
        error: { code: 'UNAUTHENTICATED', message: 'Autenticação necessária' }
      });
    }

    const hasPermission =
      user.roles.includes('admin') ||
      user.permissions.includes(permission) ||
      user.permissions.includes('*');

    if (!hasPermission) {
      return reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: `Sem permissão: ${permission}`,
          details: `O teu role (${user.roles.join(', ')}) não tem permissão para esta operação`
        }
      });
    }
  };
}


// ═══════════════════════════════════════════════════════════════
// Nexora — API Middleware: Rate Limiter
// Ficheiro: src/api/middleware/rateLimiter.ts
// ═══════════════════════════════════════════════════════════════

import { FastifyInstance } from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';

export async function registerRateLimiter(app: FastifyInstance): Promise<void> {
  await app.register(fastifyRateLimit, {
    max: Number(process.env.RATE_LIMIT_USER_RPM ?? 1000),
    timeWindow: '1 minute',
    // Identificar utilizador pelo JWT sub ou IP como fallback
    keyGenerator: (req: FastifyRequest) => {
      const user = (req as any).user;
      return user?.sub ?? req.ip;
    },
    // Aumentar limite para API keys
    allowList: async (req: FastifyRequest) => {
      const user = (req as any).user;
      return user?.roles?.includes('api') === true;
    },
    errorResponseBuilder: (_req, context) => ({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Demasiados pedidos — limite: ${context.max} por minuto`,
        retryAfter: context.after
      }
    }),
  });
}


// ═══════════════════════════════════════════════════════════════
// Nexora — Registo de todos os plugins e rotas
// Ficheiro: src/api/plugins.ts + src/api/routes.ts
// ═══════════════════════════════════════════════════════════════

import { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import { authMiddleware } from './middleware/auth';
import { registerRateLimiter } from './middleware/rateLimiter';
import { assetsRoutes } from './routes/assets';
import { jobsRoutes } from './routes/jobs';

export async function registerPlugins(app: FastifyInstance): Promise<void> {
  // CORS
  await app.register(fastifyCors, {
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Multipart (upload de ficheiros)
  await app.register(fastifyMultipart, {
    limits: {
      fileSize: Number(process.env.MAX_UPLOAD_SIZE_BYTES ?? 53687091200), // 50GB
      files: 10,
    }
  });

  // Rate limiter
  await registerRateLimiter(app);

  // Auth middleware — aplicar a todos os pedidos
  app.addHook('preHandler', authMiddleware);

  // Health checks (sem auth)
  app.get('/health', async () => ({
    status: 'ok',
    version: process.env.npm_package_version ?? '0.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  app.get('/health/live',  async () => ({ status: 'ok' }));
  app.get('/health/ready', async () => {
    // Verificar conectividade com serviços críticos
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', db: 'connected', timestamp: new Date().toISOString() };
  });
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Registar todas as rotas sob /api/v1
  await app.register(async (v1) => {
    await v1.register(assetsRoutes);
    await v1.register(jobsRoutes);
  }, { prefix: '/api/v1' });
}
