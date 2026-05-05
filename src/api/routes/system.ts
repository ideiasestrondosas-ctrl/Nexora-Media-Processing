import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../db/prisma';
import { readConfig } from './settings';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../observability/logger';

const BACKUP_DIR = process.env.NEXORA_BACKUP_DIR || '/media/storage/backups';

interface BackupData {
  version: string;
  timestamp: string;
  config: any;
  profiles: any[];
  users: any[];
  deliveryTargets: any[];
}

export async function systemRoutes(fastify: FastifyInstance): Promise<void> {
  
  // Garantir que diretório de backup existe
  if (!fs.existsSync(BACKUP_DIR)) {
    try {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    } catch (err) {
      logger.error({ err, BACKUP_DIR }, 'Falha ao criar diretório de backups');
    }
  }

  // GET /system/backup — Exportar todas as configurações
  fastify.get('/system/backup', async (request: FastifyRequest, reply: FastifyReply) => {
    // Apenas admins podem fazer backup
    if (!request.user?.roles?.includes('ADMIN')) {
      return reply.status(403).send({ error: 'Acesso negado. Apenas administradores.' });
    }

    try {
      const [profiles, users, deliveryTargets] = await Promise.all([
        prisma.encodingProfile.findMany(),
        prisma.user.findMany(),
        prisma.deliveryTarget.findMany(),
      ]);

      const backup: BackupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        config: readConfig(),
        profiles,
        users,
        deliveryTargets,
      };

      const filename = `nexora-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const filePath = path.join(BACKUP_DIR, filename);
      
      fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));

      return reply.send(backup);
    } catch (err: any) {
      logger.error({ err }, 'Erro ao gerar backup');
      return reply.status(500).send({ error: 'FALHA_BACKUP', message: err.message });
    }
  });

  // POST /system/restore — Importar configurações
  fastify.post('/system/restore', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user?.roles?.includes('ADMIN')) {
      return reply.status(403).send({ error: 'Acesso negado.' });
    }

    const backup = request.body as BackupData;

    if (!backup.version || !backup.profiles || !backup.users) {
      return reply.status(400).send({ error: 'INVALID_BACKUP', message: 'Formato de backup inválido.' });
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Restaurar Perfis
        for (const p of backup.profiles) {
          await tx.encodingProfile.upsert({
            where: { id: p.id },
            update: p,
            create: p,
          });
        }

        // Restaurar Utilizadores
        for (const u of backup.users) {
          await tx.user.upsert({
            where: { id: u.id },
            update: u,
            create: u,
          });
        }

        // Restaurar Destinos de Entrega
        if (backup.deliveryTargets) {
          for (const dt of backup.deliveryTargets) {
            await tx.deliveryTarget.upsert({
              where: { id: dt.id },
              update: dt,
              create: dt,
            });
          }
        }
      });

      // Restaurar ficheiro de config
      if (backup.config) {
        const configFile = path.join(process.cwd(), 'nexora-config.json');
        fs.writeFileSync(configFile, JSON.stringify(backup.config, null, 2));
      }

      return reply.send({ message: 'Sistema restaurado com sucesso.', timestamp: backup.timestamp });
    } catch (err: any) {
      logger.error({ err }, 'Erro ao restaurar backup');
      return reply.status(500).send({ error: 'FALHA_RESTORE', message: err.message });
    }
  });
}
