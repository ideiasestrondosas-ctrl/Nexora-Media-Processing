// Nexora Media Processing — Middleware: Auth JWT RS256 + Refresh Tokens
// Ficheiro: src/api/middleware/auth.ts
//
// ADR-008: RS256 JWT com rotação — HS256 proibido em produção.
// Access token: 15 minutos | Refresh token: 7 dias (armazenado com hash SHA-256)

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { readFileSync } from 'fs';
import { createHash, randomBytes } from 'crypto';
import * as jose from 'jose';
import { prisma } from '../../db/prisma';
import { logger } from '../../observability/logger';
import { UnauthorizedError } from '../../common/errors';

// ── Tipos ─────────────────────────────────────────────────────────

export interface JWTPayload {
  sub: string;           // user ID
  roles: string[];       // ex: ['admin', 'operator']
  iat?: number;
  exp?: number;
  iss?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;   // raw token (enviar ao cliente, NÃO guardar em DB)
  expiresIn: number;      // segundos até access token expirar (900 = 15min)
  tokenType: 'Bearer';
}

// Estender FastifyRequest com user tipado
declare module 'fastify' {
  interface FastifyRequest {
    user?: JWTPayload;
  }
}

// ── Rotas públicas (sem autenticação) ─────────────────────────────

const PUBLIC_ROUTES = new Set([
  '/health',
  '/health/live',
  '/health/ready',
  '/metrics',
  '/docs',
  '/docs/json',
  '/docs/yaml',
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/auth/login',    // Adicionado para resiliencia
  '/auth/refresh',  // Adicionado para resiliencia
]);

// ── Configuração ──────────────────────────────────────────────────

const ACCESS_TOKEN_TTL  = '15m';   // ADR-008: access token curto
const REFRESH_TOKEN_DAYS = 7;
const REFRESH_TOKEN_BYTES = 64;    // 512 bits de entropia

// ── Carregamento de Chaves ─────────────────────────────────────────

let _publicKey:  jose.KeyLike | null = null;
let _privateKey: jose.KeyLike | null = null;

async function getPublicKey(): Promise<jose.KeyLike> {
  if (_publicKey) return _publicKey;
  const keyPath = process.env.JWT_PUBLIC_KEY_PATH ?? './secrets/jwt_public.pem';
  try {
    const keyPem = readFileSync(keyPath, 'utf8');
    _publicKey = await jose.importSPKI(keyPem, 'RS256');
    logger.info({ keyPath }, 'Chave pública JWT RS256 carregada');
    return _publicKey;
  } catch (error) {
    throw new Error(`Não foi possível carregar a chave pública JWT: ${keyPath} — ${String(error)}`);
  }
}

async function getPrivateKey(): Promise<jose.KeyLike> {
  if (_privateKey) return _privateKey;
  const keyPath = process.env.JWT_PRIVATE_KEY_PATH ?? './secrets/jwt_private.pem';
  try {
    const keyPem = readFileSync(keyPath, 'utf8');
    _privateKey = await jose.importPKCS8(keyPem, 'RS256');
    logger.debug({ keyPath }, 'Chave privada JWT RS256 carregada');
    return _privateKey;
  } catch (error) {
    throw new Error(`Não foi possível carregar a chave privada JWT: ${keyPath} — ${String(error)}`);
  }
}

// ── Helpers Internos ──────────────────────────────────────────────

/** Gera SHA-256 do refresh token raw para armazenamento seguro (ADR-003) */
function hashRefreshToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/** Calcula a data de expiração do refresh token (agora + N dias) */
function refreshExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_TOKEN_DAYS);
  return d;
}

// ── Hook de Autenticação ──────────────────────────────────────────

/**
 * Regista o hook de autenticação JWT RS256 no Fastify.
 * Executado antes de cada request (excepto rotas públicas).
 * ADR-008: RS256 obrigatório.
 */
export async function registerAuthHook(fastify: FastifyInstance): Promise<void> {
  await getPublicKey(); // pré-carregar no startup

  fastify.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    const url = request.url.split('?')[0]!;
    if (PUBLIC_ROUTES.has(url)) return;

    let token = '';
    const authHeader = request.headers.authorization;
    
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else {
      const match = request.url.match(/[?&]token=([^&]+)/);
      if (match) {
        token = match[1];
      }
    }

    if (!token) {
      throw new UnauthorizedError('Header Authorization em falta ou formato inválido (ou token query parameter)');
    }

    try {
      const publicKey = await getPublicKey();
      const { payload } = await jose.jwtVerify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: process.env.JWT_ISSUER ?? 'nexora-media-processing',
      });

      request.user = {
        sub:   payload.sub ?? '',
        roles: (payload['roles'] as string[]) ?? [],
        iat:   payload.iat,
        exp:   payload.exp,
        iss:   payload.iss,
      };
    } catch (error) {
      if (error instanceof jose.errors.JWTExpired) {
        throw new UnauthorizedError('Token JWT expirado — usa /auth/refresh para renovar');
      }
      if (error instanceof jose.errors.JWTInvalid) {
        throw new UnauthorizedError('Token JWT inválido');
      }
      if (error instanceof jose.errors.JWSSignatureVerificationFailed) {
        throw new UnauthorizedError('Assinatura JWT inválida');
      }
      if (error instanceof UnauthorizedError) throw error;

      logger.warn({ error: String(error), url }, 'Falha de autenticação JWT');
      throw new UnauthorizedError('Não foi possível verificar o token JWT');
    }
  });

  logger.info('Hook de autenticação JWT RS256 registado');
}

// ── API Pública de Tokens ──────────────────────────────────────────

/**
 * Gera um access token RS256 de curta duração (15 minutos).
 * Para uso em testes e scripts de administração.
 */
export async function generateToken(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  expiresIn: string = ACCESS_TOKEN_TTL
): Promise<string> {
  const privateKey = await getPrivateKey();
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .setIssuer(process.env.JWT_ISSUER ?? 'nexora-media-processing')
    .sign(privateKey);
}

/**
 * Gera um par de tokens (access + refresh).
 * O refresh token é armazenado com hash SHA-256 na base de dados.
 * O token raw é devolvido ao cliente e NUNCA guardado em texto claro.
 *
 * @param payload   - Dados do utilizador (sub, roles)
 * @param ipAddress - IP do cliente para audit
 * @param userAgent - User-Agent para audit
 */
export async function generateTokenPair(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  ipAddress?: string,
  userAgent?: string,
): Promise<TokenPair> {
  // 1. Gerar access token (15min)
  const accessToken = await generateToken(payload, ACCESS_TOKEN_TTL);

  // 2. Gerar refresh token (raw — 64 bytes de entropia)
  const rawRefreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');

  // 3. Guardar hash SHA-256 do refresh token na DB
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashRefreshToken(rawRefreshToken),
      userId:    payload.sub,
      userAgent: userAgent ?? null,
      ipAddress: ipAddress ?? null,
      expiresAt: refreshExpiresAt(),
    },
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    expiresIn: 900, // 15 minutos em segundos
    tokenType: 'Bearer',
  };
}

/**
 * Consome um refresh token e emite um novo par (rotação).
 * O token antigo é revogado imediatamente após uso.
 *
 * @param rawRefreshToken - Token raw recebido do cliente
 * @param payload         - Novos dados para o access token (roles podem ter mudado)
 * @param ipAddress       - IP do cliente
 * @param userAgent       - User-Agent do cliente
 */
export async function rotateRefreshToken(
  rawRefreshToken: string,
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  ipAddress?: string,
  userAgent?: string,
): Promise<TokenPair> {
  const tokenHash = hashRefreshToken(rawRefreshToken);

  // 1. Encontrar e validar refresh token
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
  });

  if (!stored) {
    throw new UnauthorizedError('Refresh token inválido ou já utilizado');
  }
  if (stored.revokedAt) {
    // Possível replay attack — revogar todos os tokens do utilizador
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data:  { revokedAt: new Date() },
    });
    logger.warn({ userId: stored.userId }, 'Refresh token já revogado — possível replay attack, revogando todos os tokens');
    throw new UnauthorizedError('Refresh token já utilizado — todos os tokens foram revogados por segurança');
  }
  if (stored.expiresAt < new Date()) {
    throw new UnauthorizedError('Refresh token expirado');
  }

  // 2. Revogar token antigo (rotação)
  await prisma.refreshToken.update({
    where: { tokenHash },
    data:  { revokedAt: new Date() },
  });

  // 3. Emitir novo par
  return generateTokenPair(payload, ipAddress, userAgent);
}

/**
 * Revoga um refresh token específico (logout).
 */
export async function revokeRefreshToken(rawRefreshToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(rawRefreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data:  { revokedAt: new Date() },
  });
}

/**
 * Revoga todos os refresh tokens activos de um utilizador (logout-all).
 */
export async function revokeAllRefreshTokens(userId: string): Promise<number> {
  const result = await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data:  { revokedAt: new Date() },
  });
  return result.count;
}

/**
 * Limpa refresh tokens expirados da base de dados (cron job).
 */
export async function purgeExpiredRefreshTokens(): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  logger.info({ count: result.count }, 'Refresh tokens expirados eliminados');
  return result.count;
}
