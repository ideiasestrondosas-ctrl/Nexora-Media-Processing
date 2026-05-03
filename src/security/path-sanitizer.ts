// Nexora Media Processing — Path Sanitizer
// Ficheiro: src/security/path-sanitizer.ts
//
// Previne ataques de path traversal em todas as operações de ficheiros.
// Usado em uploads, downloads, e operações MinIO.

import { resolve, normalize, sep } from 'path';

// ── Tipos ─────────────────────────────────────────────────────────

export interface SanitizeResult {
  sanitized: string;
  wasModified: boolean;
  rejected: boolean;
  reason?: string;
}

// ── Padrões Perigosos ─────────────────────────────────────────────

const PATH_TRAVERSAL_PATTERNS = [
  /\.\.[/\\]/g,              // ../  ..\
  /\.\.[/\\]?$/g,            // .. no final
  /%2e%2e/gi,               // URL encoded ..
  /%2f/gi,                  // URL encoded /
  /%5c/gi,                  // URL encoded \
  /\0/g,                    // null bytes
  /%00/gi,                  // URL encoded null byte
];

const DANGEROUS_CHARS_FILENAME = /[<>:"|?*\x00-\x1f]/g;
const MINIO_ALLOWED_KEY = /^[a-zA-Z0-9!_.*'()\-/]+$/;

// ── Path Sanitizer ────────────────────────────────────────────────

export class NexoraPathSanitizer {

  /**
   * Sanitiza um nome de ficheiro de upload.
   * Remove caracteres perigosos e impede traversal.
   *
   * @param filename - Nome do ficheiro declarado pelo cliente
   * @returns Resultado com o nome sanitizado ou indicação de rejeição
   */
  sanitizeFilename(filename: string): SanitizeResult {
    const original = filename;

    // Rejeitar nomes vazios
    if (!filename || filename.trim().length === 0) {
      return { sanitized: '', wasModified: true, rejected: true, reason: 'Nome de ficheiro vazio' };
    }

    // Verificar padrões de path traversal
    for (const pattern of PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(filename)) {
        return {
          sanitized: '',
          wasModified: true,
          rejected: true,
          reason: `Path traversal detectado: ${filename}`,
        };
      }
    }

    let sanitized = filename;

    // Remover componentes de path — manter apenas o basename
    sanitized = sanitized.split(/[/\\]/).pop() ?? sanitized;

    // Remover caracteres perigosos
    sanitized = sanitized.replace(DANGEROUS_CHARS_FILENAME, '_');

    // Truncar a 255 caracteres (limite do FS)
    if (sanitized.length > 255) {
      const ext = sanitized.lastIndexOf('.');
      const name = ext > 0 ? sanitized.slice(0, ext) : sanitized;
      const extension = ext > 0 ? sanitized.slice(ext) : '';
      sanitized = name.slice(0, 255 - extension.length) + extension;
    }

    // Rejeitar se ficou vazio após sanitização
    if (sanitized.length === 0 || sanitized === '.') {
      return { sanitized: '', wasModified: true, rejected: true, reason: 'Filename resultou em string vazia após sanitização' };
    }

    return {
      sanitized,
      wasModified: sanitized !== original,
      rejected: false,
    };
  }

  /**
   * Sanitiza uma chave MinIO.
   * Permite apenas caracteres safe para S3/MinIO object keys.
   *
   * @param key - Chave MinIO a sanitizar
   * @returns Resultado com a chave sanitizada ou indicação de rejeição
   */
  sanitizeMinioKey(key: string): SanitizeResult {
    const original = key;

    if (!key || key.trim().length === 0) {
      return { sanitized: '', wasModified: true, rejected: true, reason: 'MinIO key vazia' };
    }

    // Verificar traversal
    for (const pattern of PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(key)) {
        return {
          sanitized: '',
          wasModified: true,
          rejected: true,
          reason: `Path traversal em MinIO key: ${key}`,
        };
      }
    }

    // Normalizar separadores (sempre /)
    let sanitized = key.replace(/\\/g, '/');

    // Remover // e . no início
    sanitized = sanitized.replace(/\/+/g, '/').replace(/^\//, '');

    // Validar conjunto de caracteres permitidos
    if (!MINIO_ALLOWED_KEY.test(sanitized)) {
      // Substituir caracteres não permitidos por underscore
      sanitized = sanitized.replace(/[^a-zA-Z0-9!_.*'()\-/]/g, '_');
    }

    return {
      sanitized,
      wasModified: sanitized !== original,
      rejected: false,
    };
  }

  /**
   * Verifica que um caminho resolvido está dentro do directório base.
   * Previne breakout mesmo após resolução de symlinks.
   *
   * @param filePath  - Caminho a verificar
   * @param baseDir   - Directório base permitido
   * @returns true se o path está dentro do baseDir
   */
  isWithinBase(filePath: string, baseDir: string): boolean {
    const resolvedFile = resolve(filePath);
    const resolvedBase = resolve(baseDir);

    // Garantir que o resolvedBase termina com sep para evitar falsos positivos
    // ex: /tmp/nexora-abc vs /tmp/nexora-abcdef
    const baseSep = resolvedBase.endsWith(sep)
      ? resolvedBase
      : resolvedBase + sep;

    return resolvedFile.startsWith(baseSep) || resolvedFile === resolvedBase;
  }

  /**
   * Normaliza um path para uso seguro em operações de filesystem local.
   * Rejeita se o path resultante sair do baseDir.
   */
  safePath(userInput: string, baseDir: string): SanitizeResult {
    // Primeiro verificar traversal patterns
    for (const pattern of PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(userInput)) {
        return {
          sanitized: '',
          wasModified: true,
          rejected: true,
          reason: `Path traversal detectado: ${userInput}`,
        };
      }
    }

    const normalized = normalize(userInput);
    const full = resolve(baseDir, normalized);

    if (!this.isWithinBase(full, baseDir)) {
      return {
        sanitized: '',
        wasModified: true,
        rejected: true,
        reason: `Path ${userInput} sai do directório base ${baseDir}`,
      };
    }

    return {
      sanitized: full,
      wasModified: full !== userInput,
      rejected: false,
    };
  }
}

// ── Singleton ─────────────────────────────────────────────────────

export const pathSanitizer = new NexoraPathSanitizer();
