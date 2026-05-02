// Nexora Media Processing — MinIO Client Singleton
// Ficheiro: src/common/minio.ts
//
// Wrapper type-safe sobre o cliente MinIO oficial.
// Garante que os buckets existem no startup e fornece
// helpers para upload/download com medição de tempo.

import * as Minio from 'minio';
import { createReadStream, createWriteStream, statSync } from 'fs';
import { pipeline } from 'stream/promises';
import { logger } from '../observability/logger';
import { StorageError } from './errors';

// ── Tipos ────────────────────────────────────────────────────────

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  bucket: string;
  key: string;
  etag: string;
  sizeBytes: number;
}

export interface DownloadOptions {
  /** Caminho local de destino. Se omitido, retorna Stream. */
  destinationPath?: string;
}

// ── Nomes dos buckets ───────────────────────────────────────────

export const BUCKETS = {
  INPUT:  process.env.MINIO_BUCKET_INPUT  ?? 'nexora-input',
  OUTPUT: process.env.MINIO_BUCKET_OUTPUT ?? 'nexora-output',
  TEMP:   process.env.MINIO_BUCKET_TEMP   ?? 'nexora-temp',
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

// ── Singleton ───────────────────────────────────────────────────

let _minioClient: Minio.Client | null = null;

/**
 * Retorna a instância singleton do cliente MinIO.
 * Cria a instância na primeira chamada.
 */
export function getMinioClient(): Minio.Client {
  if (_minioClient) return _minioClient;

  _minioClient = new Minio.Client({
    endPoint:  process.env.MINIO_ENDPOINT  ?? 'localhost',
    port:      Number(process.env.MINIO_PORT ?? 9000),
    useSSL:    process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY ?? 'nexoraadmin',
    secretKey: process.env.MINIO_SECRET_KEY ?? 'nexora_minio_secret',
  });

  return _minioClient;
}

/**
 * Garante que todos os buckets necessários existem.
 * Cria os que faltam. Deve ser chamado no startup.
 */
export async function ensureBuckets(): Promise<void> {
  const client = getMinioClient();
  const region = process.env.MINIO_REGION ?? 'eu-west-1';

  for (const bucket of Object.values(BUCKETS)) {
    const exists = await client.bucketExists(bucket);
    if (!exists) {
      await client.makeBucket(bucket, region);
      logger.info({ bucket }, 'Bucket MinIO criado');
    } else {
      logger.debug({ bucket }, 'Bucket MinIO já existe');
    }
  }
}

// ── Helpers de upload/download ──────────────────────────────────

/**
 * Faz upload de um ficheiro local para o MinIO.
 * Usa stream para não carregar o ficheiro inteiro em memória.
 */
export async function uploadFile(
  bucket: BucketName,
  key: string,
  localPath: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const client = getMinioClient();
  const start = Date.now();

  try {
    const stat = statSync(localPath);
    const stream = createReadStream(localPath);
    const metadata: Record<string, string> = {
      'Content-Type': options.contentType ?? 'application/octet-stream',
      ...options.metadata,
    };

    const result = await client.putObject(bucket, key, stream, stat.size, metadata);

    const duration = Date.now() - start;
    logger.debug(
      { bucket, key, sizeBytes: stat.size, durationMs: duration },
      'Upload MinIO concluído'
    );

    return {
      bucket,
      key,
      etag: result.etag,
      sizeBytes: stat.size,
    };
  } catch (error) {
    throw new StorageError(
      `Falha no upload para MinIO: ${bucket}/${key}`,
      { bucket, key, localPath, error: String(error) }
    );
  }
}

/**
 * Faz upload de um buffer para o MinIO.
 */
export async function uploadBuffer(
  bucket: BucketName,
  key: string,
  buffer: Buffer,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const client = getMinioClient();

  try {
    const metadata: Record<string, string> = {
      'Content-Type': options.contentType ?? 'application/octet-stream',
      ...options.metadata,
    };

    const result = await client.putObject(bucket, key, buffer, buffer.length, metadata);

    return {
      bucket,
      key,
      etag: result.etag,
      sizeBytes: buffer.length,
    };
  } catch (error) {
    throw new StorageError(
      `Falha no upload de buffer para MinIO: ${bucket}/${key}`,
      { bucket, key, error: String(error) }
    );
  }
}

/**
 * Descarrega um objecto do MinIO para um ficheiro local.
 */
export async function downloadFile(
  bucket: BucketName,
  key: string,
  destinationPath: string
): Promise<void> {
  const client = getMinioClient();

  try {
    const stream = await client.getObject(bucket, key);
    const dest = createWriteStream(destinationPath);
    await pipeline(stream, dest);

    logger.debug({ bucket, key, destinationPath }, 'Download MinIO concluído');
  } catch (error) {
    throw new StorageError(
      `Falha no download do MinIO: ${bucket}/${key}`,
      { bucket, key, destinationPath, error: String(error) }
    );
  }
}

/**
 * Gera uma URL pre-assinada para acesso directo a um objecto.
 * @param expirySeconds Tempo de validade em segundos (default: 1 hora)
 */
export async function getPresignedUrl(
  bucket: BucketName,
  key: string,
  expirySeconds: number = 3600
): Promise<string> {
  const client = getMinioClient();

  try {
    return await client.presignedGetObject(bucket, key, expirySeconds);
  } catch (error) {
    throw new StorageError(
      `Falha ao gerar URL pre-assinada: ${bucket}/${key}`,
      { bucket, key, error: String(error) }
    );
  }
}

/**
 * Remove um objecto do MinIO.
 */
export async function removeObject(
  bucket: BucketName,
  key: string
): Promise<void> {
  const client = getMinioClient();

  try {
    await client.removeObject(bucket, key);
    logger.debug({ bucket, key }, 'Objecto MinIO removido');
  } catch (error) {
    throw new StorageError(
      `Falha ao remover objecto MinIO: ${bucket}/${key}`,
      { bucket, key, error: String(error) }
    );
  }
}

/**
 * Verifica se um objecto existe no MinIO.
 */
export async function objectExists(
  bucket: BucketName,
  key: string
): Promise<boolean> {
  const client = getMinioClient();

  try {
    await client.statObject(bucket, key);
    return true;
  } catch {
    return false;
  }
}
