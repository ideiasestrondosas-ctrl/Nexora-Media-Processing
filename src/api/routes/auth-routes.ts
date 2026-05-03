// Nexora Media Processing — Auth Routes
// Ficheiro: src/api/routes/auth-routes.ts
//
// Endpoints de autenticação: login, refresh, logout, logout-all.
// Todas as rotas são públicas (sem hook de auth) — ver PUBLIC_ROUTES em auth.ts.

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  generateTokenPair,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
} from '../middleware/auth';
import { prisma } from '../../db/prisma';
import { logger } from '../../observability/logger';
import { UnauthorizedError, ValidationError } from '../../common/errors';

// ── Schemas ────────────────────────────────────────────────────────

const loginSchema = z.object({
  userId: z.string().min(1).max(128),   // sub do JWT (ID opaco do utilizador)
  roles:  z.array(z.string()).default(['operator']),
  secret: z.string().optional(),         // segredo simples para dev/test
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1),
});

// ── Helper: IP do cliente ──────────────────────────────────────────

function getClientIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ip?.trim() ?? request.ip;
  }
  return request.ip;
}

// ── Rotas ─────────────────────────────────────────────────────────

export async function authRoutes(fastify: FastifyInstance): Promise<void> {

  // ── POST /auth/login ───────────────────────────────────────────
  //
  // Em produção real, aqui validaria contra a base de dados de utilizadores
  // (password hash, LDAP, OAuth2, etc.). Para o Nexora, o modelo de user
  // é um sub opaco — aceita qualquer userId com um secret de ambiente.

  fastify.post<{ Body: z.infer<typeof loginSchema> }>(
    '/auth/login',
    {
      schema: {
        description: 'Autenticação — emite par de tokens (access 15min + refresh 7d)',
        tags: ['Auth'],
        body: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string' },
            roles:  { type: 'array', items: { type: 'string' } },
            secret: { type: 'string' },
          },
        },
      },
    },
    async (request, reply: FastifyReply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Dados de login inválidos', parsed.error.flatten());
      }

      const { userId, roles, secret } = parsed.data;

      // Autenticação na Base de Dados (Nexora)
      if (!secret) {
        throw new UnauthorizedError('Credenciais inválidas');
      }

      // Em produção real usar bcrypt.compare. Aqui, o seed inseriu em plaintext para dev.
      const user = await prisma.user.findUnique({
        where: { username: userId }
      });

      if (!user || user.password !== secret) {
        // Audit: login falhado
        await prisma.auditLog.create({
          data: {
            action: 'AUTH_LOGIN_FAILED',
            entityType: 'Auth',
            entityId: userId,
            userId,
            ipAddress: getClientIp(request),
            userAgent: request.headers['user-agent'] ?? null,
            severity: 'warn',
            metadata: { reason: 'Credenciais inválidas' },
          },
        }).catch(() => {});

        logger.warn({ userId, ip: getClientIp(request) }, 'Login falhado — credenciais inválidas');
        throw new UnauthorizedError('Credenciais inválidas');
      }

      // Substituir os roles fornecidos pelo client pelos do DB
      const dbRoles = [user.role.toLowerCase()];

      const tokenPair = await generateTokenPair(
        { sub: userId, roles: dbRoles },
        getClientIp(request),
        request.headers['user-agent'],
      );

      // Audit: login com sucesso
      await prisma.auditLog.create({
        data: {
          action: 'AUTH_LOGIN_SUCCESS',
          entityType: 'Auth',
          entityId: userId,
          userId,
          ipAddress: getClientIp(request),
          userAgent: request.headers['user-agent'] ?? null,
          severity: 'info',
          metadata: { roles: dbRoles },
        },
      }).catch(() => {});

      logger.info({ userId, roles: dbRoles }, 'Login com sucesso');

      return reply.status(200).send(tokenPair);
    }
  );

  // ── POST /auth/refresh ─────────────────────────────────────────
  //
  // Consome o refresh token antigo e emite um novo par.
  // Rotação automática — refresh token de uso único (ADR-008).

  fastify.post<{ Body: z.infer<typeof refreshSchema> }>(
    '/auth/refresh',
    {
      schema: {
        description: 'Renovação de tokens — rotação do refresh token',
        tags: ['Auth'],
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: { refreshToken: { type: 'string' } },
        },
      },
    },
    async (request, reply: FastifyReply) => {
      const parsed = refreshSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('refreshToken em falta no body');
      }

      const { refreshToken } = parsed.data;

      // rotateRefreshToken valida, revoga o antigo e emite novo par
      // O sub e roles são re-extraídos do token armazenado (sem re-login)
      // Simplificação: sub vem do refresh token DB lookup
      const stored = await prisma.refreshToken.findUnique({
        where: { tokenHash: require('crypto').createHash('sha256').update(refreshToken).digest('hex') },
        select: { userId: true },
      }).catch(() => null);

      if (!stored) {
        throw new UnauthorizedError('Refresh token inválido');
      }

      const tokenPair = await rotateRefreshToken(
        refreshToken,
        { sub: stored.userId, roles: ['operator'] }, // roles: em prod, carregar do DB/RBAC
        getClientIp(request),
        request.headers['user-agent'],
      );

      // Audit
      await prisma.auditLog.create({
        data: {
          action: 'AUTH_REFRESH',
          entityType: 'Auth',
          entityId: stored.userId,
          userId: stored.userId,
          ipAddress: getClientIp(request),
          userAgent: request.headers['user-agent'] ?? null,
          severity: 'info',
        },
      }).catch(() => {});

      return reply.status(200).send(tokenPair);
    }
  );

  // ── POST /auth/logout ──────────────────────────────────────────
  //
  // Revoga um refresh token específico (logout do dispositivo actual).

  fastify.post<{ Body: z.infer<typeof logoutSchema> }>(
    '/auth/logout',
    {
      schema: {
        description: 'Logout — revoga o refresh token do dispositivo actual',
        tags: ['Auth'],
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: { refreshToken: { type: 'string' } },
        },
      },
    },
    async (request, reply: FastifyReply) => {
      const parsed = logoutSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('refreshToken em falta no body');
      }

      await revokeRefreshToken(parsed.data.refreshToken);

      // Audit
      const userId = request.user?.sub;
      if (userId) {
        await prisma.auditLog.create({
          data: {
            action: 'AUTH_LOGOUT',
            entityType: 'Auth',
            entityId: userId,
            userId,
            ipAddress: getClientIp(request),
            userAgent: request.headers['user-agent'] ?? null,
            severity: 'info',
          },
        }).catch(() => {});
      }

      logger.info({ userId }, 'Logout efectuado');
      return reply.status(204).send();
    }
  );

  // ── POST /auth/logout-all ──────────────────────────────────────
  //
  // Revoga todos os refresh tokens activos do utilizador autenticado.
  // Requer access token válido.

  fastify.post(
    '/auth/logout-all',
    {
      schema: {
        description: 'Logout de todos os dispositivos — revoga todos os refresh tokens',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply: FastifyReply) => {
      if (!request.user?.sub) {
        throw new UnauthorizedError('Autenticação necessária para logout-all');
      }

      const count = await revokeAllRefreshTokens(request.user.sub);

      await prisma.auditLog.create({
        data: {
          action: 'AUTH_LOGOUT_ALL',
          entityType: 'Auth',
          entityId: request.user.sub,
          userId: request.user.sub,
          ipAddress: getClientIp(request),
          userAgent: request.headers['user-agent'] ?? null,
          severity: 'warn',
          metadata: { tokensRevoked: count },
        },
      }).catch(() => {});

      logger.warn({ userId: request.user.sub, count }, 'Logout de todos os dispositivos');
      return reply.status(200).send({ message: `${count} sessão(ões) terminada(s)` });
    }
  );
}
