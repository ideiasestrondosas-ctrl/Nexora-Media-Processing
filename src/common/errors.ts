// Nexora Media Processing — Erros Tipados
// Ficheiro: src/common/errors.ts
//
// Hierarquia de erros do Nexora com códigos únicos e HTTP status codes.
// Todos os erros lançados no sistema devem usar estas classes
// para garantir respostas estruturadas e rastreabilidade nos logs.

/**
 * Erro base do Nexora com código único e status HTTP.
 * Todos os erros da aplicação estendem esta classe.
 */
export class NexoraError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'NexoraError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Manter stack trace correcto em V8
    Error.captureStackTrace(this, this.constructor);
  }

  /** Serialização para logging estruturado */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

// ── Erros de Validação (400) ────────────────────────────────────

export class ValidationError extends NexoraError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class InvalidFileTypeError extends NexoraError {
  constructor(received: string, allowed: string[]) {
    super(
      `Tipo de ficheiro '${received}' não suportado`,
      'INVALID_FILE_TYPE',
      415,
      { received, allowed }
    );
    this.name = 'InvalidFileTypeError';
  }
}

export class FileTooLargeError extends NexoraError {
  constructor(sizeBytes: number, limitBytes: number) {
    super(
      `Ficheiro de ${Math.round(sizeBytes / 1024 / 1024)}MB excede o limite de ${Math.round(limitBytes / 1024 / 1024)}MB`,
      'FILE_TOO_LARGE',
      413,
      { sizeBytes, limitBytes }
    );
    this.name = 'FileTooLargeError';
  }
}

// ── Erros de Autenticação/Autorização (401/403) ─────────────────

export class UnauthorizedError extends NexoraError {
  constructor(message: string = 'Token inválido ou expirado') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends NexoraError {
  constructor(message: string = 'Acesso negado') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

// ── Erros de Não Encontrado (404) ───────────────────────────────

export class NotFoundError extends NexoraError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} '${id}' não encontrado` : `${resource} não encontrado`,
      'NOT_FOUND',
      404,
      { resource, id }
    );
    this.name = 'NotFoundError';
  }
}

// ── Erros de Conflito (409) ─────────────────────────────────────

export class ConflictError extends NexoraError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFLICT', 409, details);
    this.name = 'ConflictError';
  }
}

export class DuplicateAssetError extends NexoraError {
  constructor(sha256: string) {
    super(
      'Asset com este checksum já existe no sistema',
      'DUPLICATE_ASSET',
      409,
      { sha256 }
    );
    this.name = 'DuplicateAssetError';
  }
}

// ── Erros de Processamento ──────────────────────────────────────

export class IngestError extends NexoraError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'INGEST_ERROR', 500, details);
    this.name = 'IngestError';
  }
}

export class QCError extends NexoraError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'QC_ERROR', 500, details);
    this.name = 'QCError';
  }
}

export class TranscodeError extends NexoraError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'TRANSCODE_ERROR', 500, details);
    this.name = 'TranscodeError';
  }
}

export class AudioNormalizationError extends NexoraError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'AUDIO_NORMALIZATION_ERROR', 500, details);
    this.name = 'AudioNormalizationError';
  }
}

export class StorageError extends NexoraError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'STORAGE_ERROR', 500, details);
    this.name = 'StorageError';
  }
}

export class HashMismatchError extends NexoraError {
  constructor(expected: string, received: string) {
    super(
      'Checksum SHA-256 não coincide — ficheiro corrompido durante transferência',
      'HASH_MISMATCH',
      500,
      { expected, received }
    );
    this.name = 'HashMismatchError';
  }
}

// ── Erros de Estado/Transição ───────────────────────────────────

export class InvalidStateTransitionError extends NexoraError {
  constructor(from: string, to: string, resource: string) {
    super(
      `Transição de estado inválida: ${from} → ${to} para ${resource}`,
      'INVALID_STATE_TRANSITION',
      422,
      { from, to, resource }
    );
    this.name = 'InvalidStateTransitionError';
  }
}

export class JobCancellationError extends NexoraError {
  constructor(jobId: string, reason: string) {
    super(
      `Não foi possível cancelar o job '${jobId}': ${reason}`,
      'JOB_CANCELLATION_ERROR',
      409,
      { jobId, reason }
    );
    this.name = 'JobCancellationError';
  }
}

// ── Erro de Serviço Interno (500) ───────────────────────────────

export class InternalError extends NexoraError {
  constructor(message: string = 'Erro interno do servidor', details?: Record<string, unknown>) {
    super(message, 'INTERNAL_ERROR', 500, details);
    this.name = 'InternalError';
  }
}

// ── Erros de Ferramentas Externas (Prompt 9) ────────────────────

export class ToolNotAvailableError extends NexoraError {
  constructor(toolName: string, details?: Record<string, unknown>) {
    super(
      `Ferramenta '${toolName}' não está disponível no sistema`,
      'TOOL_NOT_AVAILABLE',
      503,
      { toolName, ...details }
    );
    this.name = 'ToolNotAvailableError';
  }
}

export class SubtitleError extends NexoraError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'SUBTITLE_ERROR', 500, details);
    this.name = 'SubtitleError';
  }
}

export class MediaConchValidationError extends NexoraError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'MEDIACONCH_VALIDATION_ERROR', 422, details);
    this.name = 'MediaConchValidationError';
  }
}

// ── Type Guard ──────────────────────────────────────────────────

/** Verifica se um erro desconhecido é um NexoraError */
export function isNexoraError(error: unknown): error is NexoraError {
  return error instanceof NexoraError;
}
