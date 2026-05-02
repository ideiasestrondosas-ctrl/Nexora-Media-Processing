// Nexora Media Processing — Middleware: Auth JWT RS256
// Ficheiro: src/api/middleware/auth.ts
//
// ADR-008: RS256 JWT com rotação — HS256 proibido em produção.
// Verifica Bearer token em todas as rotas (excepto as públicas).
// Decora o request com user: { sub, roles }.

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { readFileSync } from 'fs';
import * as jose from 'jose';
import { logger } from '../../observability/logger';
import { UnauthorizedError } from '../../common/errors';

// ── Tipos ────────────────────────────────────────────────────────

export interface JWTPayload {
  sub: string;           // user ID
  roles: string[];       // ex: ['admin', 'operator']
  iat?: number;
  exp?: number;
  iss?: string;
}

// Estender FastifyRequest com user tipado
declare module 'fastify' {
  interface FastifyRequest {
    user?: JWTPayload;
  }
}

// ── Rotas públicas (sem autenticação) ────────────────────────────

const PUBLIC_ROUTES = new Set([
  '/health',
  '/health/live',
  '/health/ready',
  '/metrics',
  '/docs',
  '/docs/json',
  '/docs/yaml',
]);

// ── Carregamento da chave pública ────────────────────────────────

let _publicKey: jose.KeyLike | null = null;

async function getPublicKey(): Promise<jose.KeyLike> {
  if (_publicKey) return _publicKey;

  const keyPath = process.env.JWT_PUBLIC_KEY_PATH ?? './secrets/jwt_public.pem';

  try {
    const keyPem = readFileSync(keyPath, 'utf8');
    _publicKey = await jose.importSPKI(keyPem, 'RS256');
    logger.info({ keyPath }, 'Chave pública JWT RS256 carregada');
    return _publicKey;
  } catch (error) {
    logger.error({ keyPath, error: String(error) }, 'Falha ao carregar chave pública JWT');
    throw new Error(`Não foi possível carregar a chave pública JWT: ${keyPath}`);
  }
}

// ── Hook de autenticação ─────────────────────────────────────────

/**
 * Regista o hook de autenticação JWT RS256 no Fastify.
 * Executado antes de cada request (excepto rotas públicas).
 *
 * ADR-008: RS256 obrigatório — verificar que o token não usa HS256.
 */
export async function registerAuthHook(fastify: FastifyInstance): Promise<void> {
  // Pré-carregar chave pública no startup
  await getPublicKey();

  fastify.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    // Verificar se a rota é pública
    const url = request.url.split('?')[0]; // remover query string
    if (PUBLIC_ROUTES.has(url)) {
      return;
    }

    // Extrair Bearer token do header Authorization
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Header Authorization em falta ou formato inválido');
    }

    const token = authHeader.slice(7); // remover "Bearer "

    try {
      const publicKey = await getPublicKey();

      // Verificar token com chave pública RS256
      // jose lança erro se o algoritmo for diferente de RS256 (ADR-008)
      const { payload } = await jose.jwtVerify(token, publicKey, {
        algorithms: ['RS256'], // ADR-008: apenas RS256 aceite
        issuer: process.env.JWT_ISSUER ?? 'nexora-media-processing',
      });

      // Decorar request com dados do utilizador
      request.user = {
        sub: payload.sub ?? '',
        roles: (payload['roles'] as string[]) ?? [],
        iat: payload.iat,
        exp: payload.exp,
        iss: payload.iss,
      };

    } catch (error) {
      if (error instanceof jose.errors.JWTExpired) {
        throw new UnauthorizedError('Token JWT expirado');
      }
      if (error instanceof jose.errors.JWTInvalid) {
        throw new UnauthorizedError('Token JWT inválido');
      }
      if (error instanceof jose.errors.JWSSignatureVerificationFailed) {
        throw new UnauthorizedError('Assinatura JWT inválida');
      }
      if (error instanceof UnauthorizedError) {
        throw error;
      }

      logger.warn({ error: String(error), url }, 'Falha de autenticação JWT');
      throw new UnauthorizedError('Não foi possível verificar o token JWT');
    }
  });

  logger.info('Hook de autenticação JWT RS256 registado');
}

// ── Helper para gerar token (uso interno/testes) ─────────────────

/**
 * Gera um JWT RS256 assinado com a chave privada.
 * Para uso em testes e scripts de administração.
 */
export async function generateToken(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  expiresIn: string = '1h'
): Promise<string> {
  const keyPath = process.env.JWT_PRIVATE_KEY_PATH ?? './secrets/jwt_private.pem';

  try {
    const keyPem = readFileSync(keyPath, 'utf8');
    const privateKey = await jose.importPKCS8(keyPem, 'RS256');

    const token = await new jose.SignJWT({ ...payload })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .setIssuer(process.env.JWT_ISSUER ?? 'nexora-media-processing')
      .sign(privateKey);

    return token;
  } catch (error) {
    throw new Error(`Falha ao gerar token JWT: ${String(error)}`);
  }
}
