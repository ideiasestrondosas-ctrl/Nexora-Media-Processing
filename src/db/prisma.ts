// Nexora Media Processing — Prisma Client Singleton
// Ficheiro: src/db/prisma.ts
//
// Garante uma única instância do PrismaClient em toda a aplicação.
// Em desenvolvimento, o hot-reload do tsx pode criar múltiplas instâncias
// sem este padrão, esgotando as conexões à base de dados.

import { PrismaClient } from '@prisma/client';
import { logger } from '../observability/logger';

// Declarar a variável global para desenvolvimento (hot-reload)
declare global {
  // eslint-disable-next-line no-var
  var __nexoraPrisma: PrismaClient | undefined;
}

// Criar instância com logging ajustado ao ambiente
const createPrismaClient = (): PrismaClient => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ]
      : [
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ],
  });
};

// Singleton: reutilizar instância global em desenvolvimento
export const prisma: PrismaClient =
  globalThis.__nexoraPrisma ?? createPrismaClient();

if (process.env.NODE_ENV === 'development') {
  globalThis.__nexoraPrisma = prisma;

  // Log de queries em desenvolvimento (cast necessário pelo tipo genérico do $on)
  prisma.$on('query' as never, (e: unknown) => {
    const event = e as { query: string; duration: number };
    logger.debug({ query: event.query, duration: `${event.duration}ms` }, 'DB query');
  });
}

// Log de warnings e erros sempre
prisma.$on('warn' as never, (e: unknown) => {
  const event = e as { message: string };
  logger.warn({ message: event.message }, 'Prisma warning');
});

prisma.$on('error' as never, (e: unknown) => {
  const event = e as { message: string };
  logger.error({ message: event.message }, 'Prisma error');
});

/**
 * Verifica conectividade com a base de dados.
 * Lança erro se não conseguir conectar (falha rápida no startup).
 */
export async function initDatabase(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('PostgreSQL conectado com sucesso');
  } catch (error) {
    logger.error(error, 'Falha ao conectar ao PostgreSQL');
    throw error;
  }
}

/**
 * Encerra a conexão com a base de dados de forma limpa.
 * Deve ser chamado no shutdown da aplicação.
 */
export async function closeDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('PostgreSQL desconectado');
}
