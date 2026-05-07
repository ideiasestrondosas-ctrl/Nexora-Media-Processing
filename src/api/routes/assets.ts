// Nexora Media Processing — API Routes: Assets
// Ficheiro: src/api/routes/assets.ts
//
// CRUD completo de assets com upload multipart para MinIO ou armazenamento local.
// Todos os inputs validados com Zod.
// Soft delete (campo deletedAt) — ADR-007.

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { AssetStatus } from '@prisma/client';

import { prisma } from '../../db/prisma';
import { logger } from '../../observability/logger';
import {
  uploadBuffer,
  uploadFile,
  getPresignedUrl,
  BUCKETS,
} from '../../common/minio';
import { enqueueIngest } from '../../workers/queues';
import {
  NotFoundError,
  ValidationError,
  FileTooLargeError,
  InvalidFileTypeError,
} from '../../common/errors';
import { fileValidator } from '../../security/file-validator';
import { pathSanitizer } from '../../security/path-sanitizer';
import { auditSecurityEvent } from '../middleware/audit';
import { readConfig } from './settings';

// ── Schemas de validação ─────────────────────────────────────────

const listAssetsSchema = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(100).default(20),
  status:   z.nativeEnum(AssetStatus).optional(),
  mimeType: z.string().optional(),
  search:   z.string().max(200).optional(),
});

const getAssetSchema = z.object({
  id: z.string().uuid(),
});

// Tipos de ficheiro permitidos
const ALLOWED_MIME_TYPES = [
  'video/mp4', 'video/quicktime', 'video/x-msvideo',
  'video/x-matroska', 'video/mp2t', 'application/mxf',
  'audio/wav', 'audio/aiff', 'audio/mpeg', 'audio/aac',
];

const MAX_UPLOAD_SIZE = Number(process.env.MAX_UPLOAD_SIZE_BYTES ?? 53687091200); // 50 GB default

// ── Helpers de resposta ──────────────────────────────────────────

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function paginate<T>(data: T[], total: number, page: number, limit: number): PaginatedResponse<T> {
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// ── Registo das rotas ────────────────────────────────────────────

export async function assetsRoutes(fastify: FastifyInstance): Promise<void> {

  // ── POST /assets/upload — Upload multipart ─────────────────────

  fastify.post('/assets/upload', {
    schema: {
      description: 'Upload de ficheiro de media para ingest',
      tags: ['Assets'],
      consumes: ['multipart/form-data'],
      response: {
        201: {
          description: 'Asset criado e enfileirado para ingest',
          type: 'object',
          properties: {
            assetId: { type: 'string' },
            jobId:   { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {

    // ── Parâmetros de estratégia de armazenamento ────────────────
    const query = request.query as Record<string, string>;
    const strategy = (query['storageStrategy'] === 'LOCAL') ? 'LOCAL' : 'MINIO';
    const keepOriginal = query['keepOriginal'] === 'true';

    // Obter parte multipart
    const data = await request.file();
    if (!data) {
      throw new ValidationError('Nenhum ficheiro enviado na request');
    }

    const { filename: rawFilename, mimetype, file } = data;

    // 1. Sanitizar o nome de ficheiro (prevenir path traversal)
    const filenameResult = pathSanitizer.sanitizeFilename(rawFilename);
    if (filenameResult.rejected) {
      await auditSecurityEvent('INVALID_FILE_REJECTED', rawFilename, 'Asset', {
        userId:    request.user?.sub,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        severity:  'warn',
        metadata:  { reason: filenameResult.reason, rawFilename },
      });
      throw new ValidationError(`Nome de ficheiro rejeitado: ${filenameResult.reason}`);
    }
    const filename = filenameResult.sanitized;

    // 2. Validar tipo de ficheiro por MIME declarado
    if (!fileValidator.isMimeAllowed(mimetype)) {
      throw new InvalidFileTypeError(mimetype, fileValidator.getAllowedMimes());
    }

    // 3. Stream do ficheiro para disco temporário (previne OOM em ficheiros grandes)
    const assetId = uuidv4();
    const nodePath = require('path');
    const UPLOAD_DIR = process.env.NEXORA_TEMP_DIR || '/media/temp';
    const tempFilePath = nodePath.join(UPLOAD_DIR, `nexora_upload_${assetId}.tmp`);
    const fs = require('fs');
    const { pipeline } = require('stream/promises');

    let fileSize = 0;
    let minioKey = '';
    let localPath = '';

    try {
      await pipeline(file, fs.createWriteStream(tempFilePath));
      fileSize = fs.statSync(tempFilePath).size;

      // 4. Validar tamanho
      if (fileSize > MAX_UPLOAD_SIZE) {
        throw new FileTooLargeError(fileSize, MAX_UPLOAD_SIZE);
      }

      // 5. Validar magic bytes (tipo real do ficheiro) lendo apenas o cabeçalho
      const fd = fs.openSync(tempFilePath, 'r');
      const magicBuffer = Buffer.alloc(4100);
      const bytesRead = fs.readSync(fd, magicBuffer, 0, 4100, 0);
      fs.closeSync(fd);

      const magicResult = fileValidator.validateMagicBytes(magicBuffer.subarray(0, bytesRead), mimetype);
      if (!magicResult.valid) {
        await auditSecurityEvent('INVALID_FILE_REJECTED', filename, 'Asset', {
          userId:    request.user?.sub,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
          severity:  'warn',
          metadata:  { reason: magicResult.reason, declaredType: mimetype, detectedType: magicResult.detectedType },
        });
        throw new InvalidFileTypeError(mimetype, fileValidator.getAllowedMimes());
      }

      if (strategy === 'LOCAL') {
        // ── 6a. Armazenamento Local ──────────────────────────────
        const config = readConfig();
        const storagePath = nodePath.resolve(config.localStoragePath);

        // Garantir que a pasta existe
        if (!fs.existsSync(storagePath)) {
          fs.mkdirSync(storagePath, { recursive: true });
        }

        // Pasta por asset: {storagePath}/{assetId}/original_{filename}
        const assetDir = nodePath.join(storagePath, assetId);
        fs.mkdirSync(assetDir, { recursive: true });
        localPath = nodePath.join(assetDir, filename);

        fs.copyFileSync(tempFilePath, localPath);

        logger.info(
          { assetId, localPath, sizeBytes: fileSize },
          'Asset guardado localmente'
        );

      } else {
        // ── 6b. Armazenamento MinIO (adiado para o Worker) ──
        // Apenas definimos a chave pretendida
        minioKey = `upload/${assetId}/${filename}`;

        logger.info(
          { assetId, tempFilePath, sizeBytes: fileSize },
          'Asset preparado para upload via Worker (MinIO)'
        );
      }

    } catch (err) {
      console.error('UPLOAD ERROR', err);
      // Se falhar a pipeline, tentamos limpar
      if (fs.existsSync(tempFilePath)) {
        try { fs.unlinkSync(tempFilePath); } catch (e) {}
      }
      throw err;
    }
    // NOTA: Não limpamos o ficheiro no finally aqui porque o Worker precisa dele em /media/temp

    const targetFormat = query['targetFormat'] || 'SAME';

    // 7. Registar o asset na base de dados
    await prisma.asset.create({
      data: {
        id:           assetId,
        filename,
        mimeType:     mimetype,
        size:         BigInt(fileSize),
        minioKey:     minioKey || null,
        originalPath: localPath || null,
        status:       'INGESTING',
        metadata: {
          storageStrategy: strategy,
          keepOriginal,
          targetFormat,
        },
      },
    });

    // 8. Determinar prioridade e perfil
    const profile = query['profile'] ?? 'broadcast-hd';
    const priorityParam = query['priority'];
    const priority = priorityParam ? Number(priorityParam) : 5;

    // 9. Enfileirar job de ingest
    const jobId = await enqueueIngest({
      assetId,
      filePath:    strategy === 'LOCAL' ? localPath : tempFilePath,
      filename,
      mimeType:    mimetype,
      profile,
      priority,
    }, assetId);

    logger.info(
      { assetId, jobId, filename, sizeBytes: fileSize, strategy, keepOriginal },
      'Asset upload validado e enfileirado'
    );

    return reply.status(201).send({
      assetId,
      jobId,
      strategy,
      keepOriginal,
      message: `Ficheiro '${filename}' recebido e enfileirado para processamento`,
    });
  });

  // ── GET /assets — Listagem paginada ───────────────────────────

  fastify.get('/assets', {
    schema: {
      description: 'Listagem paginada de assets com filtros opcionais',
      tags: ['Assets'],
      querystring: {
        type: 'object',
        properties: {
          page:     { type: 'integer', minimum: 1, default: 1 },
          limit:    { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          status:   { type: 'string' },
          mimeType: { type: 'string' },
          search:   { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {

    const params = listAssetsSchema.parse(request.query);
    const { page, limit, status, mimeType, search } = params;
    const skip = (page - 1) * limit;

    // Construir filtro WHERE
    const where = {
      deletedAt: null, // apenas activos (soft delete)
      ...(status   ? { status } : {}),
      ...(mimeType ? { mimeType: { contains: mimeType } } : {}),
      ...(search   ? { filename: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    // Executar queries em paralelo
    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          size: true,
          status: true,
          profile: true,
          thumbnailKey: true,
          sha256: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { jobs: true, qcReports: true },
          },
        },
      }),
      prisma.asset.count({ where }),
    ]);

    // Serializar BigInt para string e gerar URLs de thumbnail
    const serialized = await Promise.all(assets.map(async (asset) => {
      let thumbnailUrl: string | null = null;
      if (asset.thumbnailKey) {
        try {
          thumbnailUrl = await getPresignedUrl(BUCKETS.OUTPUT, asset.thumbnailKey, 3600);
        } catch {}
      }
      return {
        ...asset,
        size: asset.size?.toString() ?? null,
        thumbnailUrl,
      };
    }));

    return reply.send(paginate(serialized, total, page, limit));
  });

  // ── GET /assets/:id — Detalhe completo ───────────────────────

  fastify.get('/assets/:id', {
    schema: {
      description: 'Detalhes de um asset com QC report e jobs',
      tags: ['Assets'],
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
        required: ['id'],
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {

    const { id } = getAssetSchema.parse(request.params);

    const asset = await prisma.asset.findUnique({
      where: { id, deletedAt: null },
      include: {
        qcReports: {
          orderBy: { createdAt: 'desc' },
          take: 1, // QC report mais recente
        },
        mediaAnalyses: {
          orderBy: { createdAt: 'desc' },
        },
        jobs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            type: true,
            status: true,
            priority: true,
            attempt: true,
            maxAttempts: true,
            startedAt: true,
            completedAt: true,
            error: true,
            createdAt: true,
          },
        },
      },
    });

    if (!asset) {
      throw new NotFoundError('Asset', id);
    }

    // Gerar URL pre-assinada para download directo (válida 1h)
    let downloadUrl: string | null = null;
    if (asset.minioKey) {
      try {
        downloadUrl = await getPresignedUrl(BUCKETS.INPUT, asset.minioKey, 3600);
      } catch (err) {
        logger.warn({ assetId: id, err }, 'Erro ao gerar downloadUrl');
      }
    }

    // Gerar URL para thumbnail
    let thumbnailUrl: string | null = null;
    if (asset.thumbnailKey) {
      try {
        thumbnailUrl = await getPresignedUrl(BUCKETS.OUTPUT, asset.thumbnailKey, 3600);
      } catch (err) {
        logger.warn({ assetId: id, err }, 'Erro ao gerar thumbnailUrl');
      }
    }

    return reply.send({
      ...asset,
      size: asset.size?.toString() ?? null,
      downloadUrl,
      thumbnailUrl,
    });
  });

  // ── DELETE /assets/:id — Soft delete ─────────────────────────

  fastify.delete('/assets/:id', {
    schema: {
      description: 'Marca um asset como eliminado (soft delete)',
      tags: ['Assets'],
      params: {
        type: 'object',
        properties: { id: { type: 'string', format: 'uuid' } },
        required: ['id'],
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {

    const { id } = getAssetSchema.parse(request.params);

    // Verificar se existe
    const asset = await prisma.asset.findUnique({
      where: { id, deletedAt: null },
      select: { id: true, filename: true },
    });

    if (!asset) {
      throw new NotFoundError('Asset', id);
    }

    // Soft delete — ADR-007: nunca eliminar fisicamente de imediato
    await prisma.asset.update({
      where: { id },
      data: {
        status: AssetStatus.DELETED,
        deletedAt: new Date(),
      },
    });

    // Audit log — ADR-007: auditoria append-only
    await prisma.auditLog.create({
      data: {
        action: 'ASSET_DELETED',
        entityType: 'Asset',
        entityId: id,
        assetId: id,
        userId: (request as FastifyRequest & { user?: { sub: string } }).user?.sub,
        metadata: { filename: asset.filename },
      },
    });

    logger.info({ assetId: id }, 'Asset marcado como eliminado');

    return reply.status(204).send();
  });

  // ── GET /assets/:id/media-info — Análise Técnica Detalhada ──────

  fastify.get<{ Params: { id: string } }>('/assets/:id/media-info', async (request, reply) => {
    const { id } = getAssetSchema.parse(request.params);

    const analyses = await prisma.mediaAnalysis.findMany({
      where: { assetId: id },
      orderBy: { createdAt: 'desc' },
    });

    if (analyses.length === 0) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Nenhuma análise técnica encontrada para este asset'
      });
    }

    return {
      assetId: id,
      count: analyses.length,
      analyses: analyses.map(a => ({
        ...a,
        fileSize: a.fileSize?.toString() // Serializar BigInt
      }))
    };
  });

  // ── GET /assets/:id/media-comparison — Relatório de Comparação ──

  fastify.get<{ Params: { id: string } }>('/assets/:id/media-comparison', async (request, reply) => {
    const { id } = getAssetSchema.parse(request.params);

    const postEncode = await prisma.mediaAnalysis.findFirst({
      where: { assetId: id, phase: 'POST_ENCODE' },
      orderBy: { createdAt: 'desc' },
    });

    if (!postEncode || !postEncode.comparisonResult) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Relatório de comparação pós-encode não disponível'
      });
    }

    return {
      assetId: id,
      phase: postEncode.phase,
      comparison: postEncode.comparisonResult,
      timestamp: postEncode.createdAt
    };
  });
}
