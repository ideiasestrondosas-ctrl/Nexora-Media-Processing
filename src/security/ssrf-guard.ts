// Nexora Media Processing — SSRF Guard
// Ficheiro: src/security/ssrf-guard.ts
//
// Protege contra ataques Server-Side Request Forgery em webhooks.
// Bloqueia IPs privados, loopback, e metadata endpoints de cloud providers.

import { lookup } from 'dns/promises';
import { logger } from '../observability/logger';

// ── Tipos ─────────────────────────────────────────────────────────

export interface SSRFValidationResult {
  safe: boolean;
  reason?: string;
  resolvedIp?: string;
}

// ── Blocklists ────────────────────────────────────────────────────

// Esquemas não-HTTP bloqueados
const BLOCKED_SCHEMES = new Set(['file', 'ftp', 'gopher', 'sftp', 'ldap', 'dict', 'data']);

// Hostnames especiais sempre bloqueados
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',  // GCP
  '169.254.169.254',           // AWS/Azure/GCP metadata
  'fd00:ec2::254',             // AWS IPv6 metadata
]);

// Ranges de IPs privados / reservados (IPv4)
interface CidrBlock {
  network: number;
  mask: number;
  description: string;
}

const PRIVATE_RANGES_V4: CidrBlock[] = [
  { network: 0x00000000, mask: 0xFF000000, description: '0.0.0.0/8 — Unspecified' },
  { network: 0x0A000000, mask: 0xFF000000, description: '10.0.0.0/8 — RFC 1918' },
  { network: 0x7F000000, mask: 0xFF000000, description: '127.0.0.0/8 — Loopback' },
  { network: 0xA9FE0000, mask: 0xFFFF0000, description: '169.254.0.0/16 — Link-local / Cloud metadata' },
  { network: 0xAC100000, mask: 0xFFF00000, description: '172.16.0.0/12 — RFC 1918' },
  { network: 0xC0A80000, mask: 0xFFFF0000, description: '192.168.0.0/16 — RFC 1918' },
  { network: 0xC0000000, mask: 0xFFFFFF00, description: '192.0.0.0/24 — IETF Protocol' },
  { network: 0xE0000000, mask: 0xF0000000, description: '224.0.0.0/4 — Multicast' },
  { network: 0xF0000000, mask: 0xF0000000, description: '240.0.0.0/4 — Reserved' },
];

// ── Helpers ───────────────────────────────────────────────────────

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some(n => isNaN(n) || n < 0 || n > 255)) return null;
  return ((nums[0]! << 24) | (nums[1]! << 16) | (nums[2]! << 8) | nums[3]!) >>> 0;
}

function isPrivateIPv4(ip: string): { blocked: boolean; description?: string } {
  const int = ipv4ToInt(ip);
  if (int === null) return { blocked: false };

  for (const range of PRIVATE_RANGES_V4) {
    if ((int & range.mask) === range.network) {
      return { blocked: true, description: range.description };
    }
  }
  return { blocked: false };
}

function isPrivateIPv6(ip: string): boolean {
  // Normalizar IPv6
  const lower = ip.toLowerCase().replace(/[\[\]]/g, '');

  // Loopback
  if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;

  // Link-local fe80::/10
  if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9') ||
      lower.startsWith('fea') || lower.startsWith('feb')) return true;

  // Unique local fc00::/7
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;

  // Unspecified ::
  if (lower === '::' || lower === '0:0:0:0:0:0:0:0') return true;

  return false;
}

// ── SSRF Guard ────────────────────────────────────────────────────

export class NexoraSSRFGuard {

  /**
   * Valida um URL de webhook contra a blocklist SSRF.
   * Resolve o DNS e verifica o IP resultante.
   *
   * @param webhookUrl - URL a validar (ex: https://example.com/webhook)
   * @returns Resultado com indicação de segurança e razão de bloqueio
   */
  async validateWebhookUrl(webhookUrl: string): Promise<SSRFValidationResult> {
    let parsed: URL;

    // 1. Validar formato do URL
    try {
      parsed = new URL(webhookUrl);
    } catch {
      return { safe: false, reason: `URL inválido: ${webhookUrl}` };
    }

    // 2. Verificar esquema
    const scheme = parsed.protocol.replace(':', '').toLowerCase();
    if (BLOCKED_SCHEMES.has(scheme)) {
      return { safe: false, reason: `Esquema '${scheme}' não permitido em webhooks` };
    }
    if (scheme !== 'http' && scheme !== 'https') {
      return { safe: false, reason: `Apenas HTTP/HTTPS permitido, recebido: '${scheme}'` };
    }

    // 3. Exigir HTTPS em produção
    if (process.env.NODE_ENV === 'production' && scheme === 'http') {
      return { safe: false, reason: 'Webhooks em produção requerem HTTPS' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // 4. Verificar hostnames especiais
    if (BLOCKED_HOSTNAMES.has(hostname)) {
      return { safe: false, reason: `Hostname bloqueado: '${hostname}'` };
    }

    // 5. Verificar se já é um IP (sem resolução DNS)
    const ipv4Check = isPrivateIPv4(hostname);
    if (ipv4Check.blocked) {
      return {
        safe: false,
        reason: `IP privado bloqueado: ${hostname} (${ipv4Check.description})`,
        resolvedIp: hostname,
      };
    }
    if (isPrivateIPv6(hostname)) {
      return {
        safe: false,
        reason: `IPv6 privado/loopback bloqueado: ${hostname}`,
        resolvedIp: hostname,
      };
    }

    // 6. Resolver DNS e verificar o IP resultante (anti-DNS rebinding)
    let resolvedIp: string | undefined;
    try {
      const addresses = await lookup(hostname, { all: true });

      for (const addr of addresses) {
        const ip = addr.address;

        // Verificar IPv4
        const v4check = isPrivateIPv4(ip);
        if (v4check.blocked) {
          return {
            safe: false,
            reason: `DNS resolve para IP privado: ${hostname} → ${ip} (${v4check.description})`,
            resolvedIp: ip,
          };
        }

        // Verificar IPv6
        if (isPrivateIPv6(ip)) {
          return {
            safe: false,
            reason: `DNS resolve para IPv6 privado: ${hostname} → ${ip}`,
            resolvedIp: ip,
          };
        }

        resolvedIp = ip; // último IP verificado (para logging)
      }
    } catch (err) {
      // DNS resolution failed — bloquear por cautela
      return {
        safe: false,
        reason: `Falha na resolução DNS de '${hostname}': ${String(err)}`,
      };
    }

    return { safe: true, resolvedIp };
  }

  /**
   * Wrapper seguro de fetch que valida o URL antes de enviar o pedido.
   * Substitui fetch() directo em notifyWebhooks().
   *
   * @param url     - URL de destino
   * @param options - Opções do fetch (headers, body, etc.)
   * @throws Error se o URL não for seguro
   */
  async safeFetch(url: string, options?: RequestInit): Promise<Response> {
    const validation = await this.validateWebhookUrl(url);

    if (!validation.safe) {
      logger.warn(
        { url, reason: validation.reason, resolvedIp: validation.resolvedIp },
        'SSRF bloqueado — webhook rejeitado'
      );
      throw new Error(`SSRF bloqueado: ${validation.reason}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000); // 10s timeout

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
        // Nunca seguir redirects para IPs privados
        redirect: 'error',
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────────

export const ssrfGuard = new NexoraSSRFGuard();
