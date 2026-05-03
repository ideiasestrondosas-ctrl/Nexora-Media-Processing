// Nexora Media Processing — File Validator (Magic Bytes)
// Ficheiro: src/security/file-validator.ts
//
// Valida o tipo real de ficheiros comparando magic bytes com o MIME declarado.
// Previne upload de ficheiros com extensão forjada.

// ── Tipos ─────────────────────────────────────────────────────────

export interface FileValidationResult {
  valid: boolean;
  detectedType?: string;
  declaredType: string;
  reason?: string;
}

// ── Magic Bytes Catalog ────────────────────────────────────────────
//
// Cada entrada define:
//   mime      — tipo MIME canónico
//   check     — função que examina o buffer e retorna true se válido
//   aliases   — outros MIME types aceites para este formato

interface MagicEntry {
  mime: string;
  aliases?: string[];
  check: (buf: Buffer) => boolean;
}

const MAGIC_TABLE: MagicEntry[] = [
  // ── Vídeo ──────────────────────────────────────────────────────

  {
    // MP4 / MOV / M4V — ISO Base Media File Format
    // Offset 4-7: 'ftyp' | 'moov' | 'mdat' | 'free' | 'wide'
    mime: 'video/mp4',
    aliases: ['video/quicktime', 'video/x-m4v'],
    check: (buf) => {
      if (buf.length < 8) return false;
      const fcc = buf.slice(4, 8).toString('ascii');
      return ['ftyp', 'moov', 'mdat', 'free', 'wide', 'skip'].includes(fcc);
    },
  },
  {
    // QuickTime MOV — mesma assinatura que MP4
    mime: 'video/quicktime',
    aliases: ['video/mp4'],
    check: (buf) => {
      if (buf.length < 8) return false;
      const fcc = buf.slice(4, 8).toString('ascii');
      return ['ftyp', 'moov', 'mdat', 'free', 'wide', 'skip'].includes(fcc);
    },
  },
  {
    // MKV / WebM — EBML header 0x1A45DFA3
    mime: 'video/x-matroska',
    aliases: ['video/webm'],
    check: (buf) => {
      if (buf.length < 4) return false;
      return buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3;
    },
  },
  {
    // AVI — RIFF....AVI
    mime: 'video/x-msvideo',
    check: (buf) => {
      if (buf.length < 12) return false;
      const riff = buf.slice(0, 4).toString('ascii');
      const avi  = buf.slice(8, 12).toString('ascii');
      return riff === 'RIFF' && avi === 'AVI ';
    },
  },
  {
    // MPEG-TS — sync byte 0x47 a cada 188 bytes
    mime: 'video/mp2t',
    check: (buf) => {
      if (buf.length < 188) return false;
      // Verificar os primeiros 3 sync bytes
      return buf[0] === 0x47 && buf[188] === 0x47 && (buf.length < 376 || buf[376] === 0x47);
    },
  },
  {
    // MXF — SMPTE KLV Universal Label 060E2B34
    mime: 'application/mxf',
    check: (buf) => {
      if (buf.length < 4) return false;
      return buf[0] === 0x06 && buf[1] === 0x0E && buf[2] === 0x2B && buf[3] === 0x34;
    },
  },

  // ── Áudio ──────────────────────────────────────────────────────

  {
    // WAV — RIFF....WAVE
    mime: 'audio/wav',
    aliases: ['audio/x-wav', 'audio/wave'],
    check: (buf) => {
      if (buf.length < 12) return false;
      const riff = buf.slice(0, 4).toString('ascii');
      const wave = buf.slice(8, 12).toString('ascii');
      return riff === 'RIFF' && wave === 'WAVE';
    },
  },
  {
    // AIFF — FORM....AIFF | AIFC
    mime: 'audio/aiff',
    aliases: ['audio/x-aiff'],
    check: (buf) => {
      if (buf.length < 12) return false;
      const form = buf.slice(0, 4).toString('ascii');
      const aiff = buf.slice(8, 12).toString('ascii');
      return form === 'FORM' && (aiff === 'AIFF' || aiff === 'AIFC');
    },
  },
  {
    // MP3 — ID3 header OU MPEG frame sync (0xFF 0xE0-0xFF)
    mime: 'audio/mpeg',
    aliases: ['audio/mp3'],
    check: (buf) => {
      if (buf.length < 3) return false;
      // ID3v2 tag
      if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true;
      // MPEG frame sync
      if (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) return true;
      return false;
    },
  },
  {
    // AAC — ADTS sync word 0xFFF1 (MPEG-4 AAC) ou 0xFFF9 (MPEG-2 AAC)
    mime: 'audio/aac',
    aliases: ['audio/x-aac'],
    check: (buf) => {
      if (buf.length < 2) return false;
      return buf[0] === 0xFF && (buf[1] === 0xF1 || buf[1] === 0xF9);
    },
  },
];

// ── File Validator ─────────────────────────────────────────────────

export class NexoraFileValidator {

  /**
   * Valida o tipo real de um ficheiro pelos magic bytes do header.
   * Compara o tipo detectado com o tipo MIME declarado pelo cliente.
   *
   * @param buffer      - Primeiros bytes do ficheiro (mínimo 388 bytes para MPEG-TS)
   * @param declaredMime - MIME type declarado pelo cliente / browser
   * @returns Resultado com indicação de validade e tipo detectado
   */
  validateMagicBytes(buffer: Buffer, declaredMime: string): FileValidationResult {
    const normalizedDeclared = declaredMime.toLowerCase().split(';')[0]!.trim();

    // Procurar correspondência no catálogo
    for (const entry of MAGIC_TABLE) {
      const matches = entry.check(buffer);
      if (!matches) continue;

      // Verificar se o tipo declarado corresponde ao tipo detectado
      const acceptedMimes = [entry.mime, ...(entry.aliases ?? [])];
      const declaredIsAccepted = acceptedMimes.includes(normalizedDeclared);

      if (declaredIsAccepted) {
        return {
          valid: true,
          detectedType: entry.mime,
          declaredType: normalizedDeclared,
        };
      }

      // Tipo detectado, mas MIME declarado não bate
      return {
        valid: false,
        detectedType: entry.mime,
        declaredType: normalizedDeclared,
        reason: `Magic bytes indicam '${entry.mime}' mas MIME declarado é '${normalizedDeclared}'`,
      };
    }

    // Nenhuma assinatura reconhecida
    return {
      valid: false,
      detectedType: undefined,
      declaredType: normalizedDeclared,
      reason: `Tipo de ficheiro não reconhecido pelos magic bytes (MIME declarado: '${normalizedDeclared}')`,
    };
  }

  /**
   * Verifica se um MIME type é permitido no Nexora.
   */
  isMimeAllowed(mime: string): boolean {
    const normalized = mime.toLowerCase().split(';')[0]!.trim();
    return MAGIC_TABLE.some(
      e => e.mime === normalized || (e.aliases ?? []).includes(normalized)
    );
  }

  /**
   * Retorna a lista de todos os MIME types suportados.
   */
  getAllowedMimes(): string[] {
    const mimes = new Set<string>();
    for (const entry of MAGIC_TABLE) {
      mimes.add(entry.mime);
      for (const alias of entry.aliases ?? []) {
        mimes.add(alias);
      }
    }
    return [...mimes].sort();
  }
}

// ── Singleton ──────────────────────────────────────────────────────

export const fileValidator = new NexoraFileValidator();
