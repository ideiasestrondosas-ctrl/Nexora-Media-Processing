// Nexora Media Processing — API Routes: Assets
// Ficheiro: src/api/routes/assets.ts
//
// CRUD completo de assets com upload multipart para MinIO.
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

    // 3. Ler o ficheiro para buffer (necessário para magic bytes + tamanho)
    const chunks: Buffer[] = [];
    for await (const chunk of file) {
      chunks.push(chunk as Buffer);
    }
    const buffer = Buffer.concat(chunks);

    // 4. Validar tamanho
    if (buffer.length > MAX_UPLOAD_SIZE) {
      throw new FileTooLargeError(buffer.length, MAX_UPLOAD_SIZE);
    }

    // 5. Validar magic bytes (tipo real do ficheiro)
    const magicResult = fileValidator.validateMagicBytes(buffer, mimetype);
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

    // 6. Gerar ID do asset
    const assetId = uuidv4();

    // 7. Sanitizar a chave MinIO
    const rawKey = `upload/${assetId}/${filename}`;
    const keyResult = pathSanitizer.sanitizeMinioKey(rawKey);
    if (keyResult.rejected) {
      throw new ValidationError(`Chave MinIO inválida: ${keyResult.reason}`);
    }
    const minioKey = keyResult.sanitized;

    // 8. Upload directo para MinIO (sem guardar em disco)
    await uploadBuffer(BUCKETS.INPUT, minioKey, buffer, {
      contentType: mimetype,
      metadata: { 'x-nexora-asset-id': assetId },
    });

    // Determinar prioridade
    const profile = (request.query as Record<string, string>)['profile'] ?? 'broadcast-hd';
    const priorityParam = (request.query as Record<string, string>)['priority'];
    const priority = priorityParam ? Number(priorityParam) : 5;

    // 9. Enfileirar job de ingest
    const jobId = await enqueueIngest({
      filePath: minioKey,
      filename,
      mimeType: mimetype,
      profile,
      priority,
    }, assetId);

    logger.info(
      { assetId, jobId, filename, sizeBytes: buffer.length, detectedType: magicResult.detectedType },
      'Asset upload validado e enfileirado'
    );

    return reply.status(201).send({
      assetId,
      jobId,
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

    // Serializar BigInt para string
    const serialized = assets.map(asset => ({
      ...asset,
      size: asset.size?.toString() ?? null,
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
        const [, ...keyParts] = asset.minioKey.split('/');
        downloadUrl = await getPresignedUrl(BUCKETS.INPUT, keyParts.join('/'), 3600);
      } catch {
        // Não falhar se URL pre-assinada falhar
      }
    }

    return reply.send({
      ...asset,
      size: asset.size?.toString() ?? null,
      downloadUrl,
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
}
