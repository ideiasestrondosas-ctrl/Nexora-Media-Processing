import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../db/prisma';
import { readConfig } from './settings';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../observability/logger';

/**
 * Lê a versão do sistema a partir do package.json da raiz.
 */
export function getSystemVersion(): string {
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version || '0.0.0';
  } catch (err) {
    return '0.0.0';
  }
}

// ── Configuração ────────────────────────────────────────────────────────────

const BACKUP_DIR = process.env.NEXORA_BACKUP_DIR || '/media/storage/backups';

// Política de rotação configurável via variáveis de ambiente
const BACKUP_MAX_COUNT  = parseInt(process.env.NEXORA_BACKUP_MAX_COUNT  ?? '10',  10);
const BACKUP_MAX_AGE_DAYS = parseInt(process.env.NEXORA_BACKUP_MAX_AGE_DAYS ?? '30', 10);
const BACKUP_MAX_SIZE_MB  = parseInt(process.env.NEXORA_BACKUP_MAX_SIZE_MB  ?? '500', 10);

interface BackupData {
  version: string;
  timestamp: string;
  config: any;
  profiles: any[];
  users: any[];
  deliveryTargets: any[];
}

interface BackupFileInfo {
  filename: string;
  filePath: string;
  sizeBytes: number;
  createdAt: Date;
  ageDays: number;
}

// ── Helpers de rotação ──────────────────────────────────────────────────────

/**
 * Lista todos os backups existentes no BACKUP_DIR ordenados do mais recente para o mais antigo.
 */
function listBackupFiles(): BackupFileInfo[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];

  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('nexora-backup-') && f.endsWith('.json'))
    .map(filename => {
      const filePath = path.join(BACKUP_DIR, filename);
      const stat = fs.statSync(filePath);
      const ageDays = (Date.now() - stat.birthtimeMs) / (1000 * 60 * 60 * 24);
      return {
        filename,
        filePath,
        sizeBytes: stat.size,
        createdAt: stat.birthtime,
        ageDays,
      } satisfies BackupFileInfo;
    });

  // Ordenar do mais recente para o mais antigo
  return files.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Rotação automática de backups.
 * Remove backups que excedem MAX_COUNT, MAX_AGE_DAYS, ou MAX_SIZE_MB (total).
 */
function rotateBackups(): void {
  const files = listBackupFiles();

  if (files.length === 0) return;

  const removed: string[] = [];

  // 1. Remover backups acima do limite de contagem (mantém os mais recentes)
  const byCount = files.slice(BACKUP_MAX_COUNT);
  for (const f of byCount) {
    try {
      fs.unlinkSync(f.filePath);
      removed.push(f.filename);
    } catch (err) {
      logger.warn({ err, filename: f.filename }, 'Falha ao remover backup por limite de contagem');
    }
  }

  // 2. Remover backups mais velhos que MAX_AGE_DAYS (nos que sobram)
  const remaining = files.filter(f => !removed.includes(f.filename));
  for (const f of remaining) {
    if (f.ageDays > BACKUP_MAX_AGE_DAYS) {
      try {
        fs.unlinkSync(f.filePath);
        removed.push(f.filename);
        logger.info({ filename: f.filename, ageDays: Math.round(f.ageDays) }, 'Backup removido por expiração');
      } catch (err) {
        logger.warn({ err, filename: f.filename }, 'Falha ao remover backup expirado');
      }
    }
  }

  // 3. Verificar tamanho total e remover os mais antigos se necessário
  const afterAgeFilter = remaining.filter(f => !removed.includes(f.filename));
  const totalMB = afterAgeFilter.reduce((acc, f) => acc + f.sizeBytes / (1024 * 1024), 0);
  if (totalMB > BACKUP_MAX_SIZE_MB) {
    // Ordenar do mais antigo para remover por aí
    const byAge = [...afterAgeFilter].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    let currentMB = totalMB;
    for (const f of byAge) {
      if (currentMB <= BACKUP_MAX_SIZE_MB) break;
      try {
        fs.unlinkSync(f.filePath);
        removed.push(f.filename);
        currentMB -= f.sizeBytes / (1024 * 1024);
        logger.info({ filename: f.filename, totalMB: Math.round(currentMB) }, 'Backup removido por limite de tamanho');
      } catch (err) {
        logger.warn({ err, filename: f.filename }, 'Falha ao remover backup por limite de tamanho');
      }
    }
  }

  if (removed.length > 0) {
    logger.info(
      { removed, maxCount: BACKUP_MAX_COUNT, maxAgeDays: BACKUP_MAX_AGE_DAYS, maxSizeMB: BACKUP_MAX_SIZE_MB },
      `Rotação de backups: ${removed.length} ficheiro(s) removido(s)`
    );
  }
}

// ── Routes ──────────────────────────────────────────────────────────────────

export async function systemRoutes(fastify: FastifyInstance): Promise<void> {

  // Garantir que diretório de backup existe
  if (!fs.existsSync(BACKUP_DIR)) {
    try {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    } catch (err) {
      logger.error({ err, BACKUP_DIR }, 'Falha ao criar diretório de backups');
    }
  }

  // ── GET /system/version — Versão atual do sistema ────────────────────────
  fastify.get('/system/version', async () => {
    return { version: getSystemVersion() };
  });

  // ── GET /system/changelog — Ler e devolver o histórico ─────────────────────
  fastify.get('/system/changelog', async () => {
    try {
      const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
      if (!fs.existsSync(changelogPath)) return { entries: [] };
      
      const content = fs.readFileSync(changelogPath, 'utf8');
      const lines = content.split('\n');
      
      const entries: { version: string; date: string; changes: string[] }[] = [];
      let currentEntry: { version: string; date: string; changes: string[] } | null = null;
      
      for (const line of lines) {
        // Suporta "## [1.1.0] - 2026-05-05" ou "## [1.0.0] — 2026-05-05" (hífen ou travessão)
        const versionMatch = line.match(/^##\s+\[([\w.-]+)\]\s*[-—]\s*([\d-]+)/);
        if (versionMatch) {
          if (currentEntry) entries.push(currentEntry);
          currentEntry = {
            version: versionMatch[1],
            date: versionMatch[2],
            changes: [],
          };
          continue;
        }
        
        if (currentEntry && (line.trim().startsWith('- ') || line.trim().startsWith('* '))) {
          // Remove prefixos markdown para obter o texto limpo
          currentEntry.changes.push(line.trim().substring(2).trim());
        }
      }
      
      if (currentEntry) entries.push(currentEntry);
      return { entries };
    } catch (err) {
      logger.error({ err }, 'Erro ao ler CHANGELOG.md');
      return { entries: [] };
    }
  });

  // ── GET /system/backups — Listar backups disponíveis ──────────────────────
  fastify.get('/system/backups', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user?.roles?.includes('ADMIN')) {
      return reply.status(403).send({ error: 'Acesso negado. Apenas administradores.' });
    }

    const files = listBackupFiles();
    const totalSizeMB = files.reduce((acc, f) => acc + f.sizeBytes / (1024 * 1024), 0);

    return reply.send({
      backups: files.map(f => ({
        filename: f.filename,
        sizeBytes: f.sizeBytes,
        sizeMB: parseFloat((f.sizeBytes / (1024 * 1024)).toFixed(2)),
        createdAt: f.createdAt.toISOString(),
        ageDays: Math.round(f.ageDays),
      })),
      count: files.length,
      totalSizeMB: parseFloat(totalSizeMB.toFixed(2)),
      policy: {
        maxCount: BACKUP_MAX_COUNT,
        maxAgeDays: BACKUP_MAX_AGE_DAYS,
        maxSizeMB: BACKUP_MAX_SIZE_MB,
      },
    });
  });

  // ── GET /system/backup — Criar e exportar novo backup ─────────────────────
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
      logger.info({ filename, profiles: profiles.length, users: users.length }, 'Backup criado com sucesso');

      // Rotação automática após criar novo backup
      rotateBackups();

      return reply.send(backup);
    } catch (err: any) {
      logger.error({ err }, 'Erro ao gerar backup');
      return reply.status(500).send({ error: 'FALHA_BACKUP', message: err.message });
    }
  });

  // ── DELETE /system/backups/:filename — Remover backup manualmente ──────────
  fastify.delete('/system/backups/:filename', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user?.roles?.includes('ADMIN')) {
      return reply.status(403).send({ error: 'Acesso negado.' });
    }

    const { filename } = request.params as { filename: string };

    // Segurança: apenas ficheiros nexora-backup-*.json sem path traversal
    if (!filename.match(/^nexora-backup-[\w\-.]+\.json$/) || filename.includes('..')) {
      return reply.status(400).send({ error: 'INVALID_FILENAME', message: 'Nome de ficheiro inválido.' });
    }

    const filePath = path.join(BACKUP_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ error: 'BACKUP_NOT_FOUND', message: `Backup não encontrado: ${filename}` });
    }

    try {
      fs.unlinkSync(filePath);
      logger.info({ filename }, 'Backup removido manualmente pelo administrador');
      return reply.send({ message: `Backup removido: ${filename}` });
    } catch (err: any) {
      logger.error({ err, filename }, 'Erro ao remover backup');
      return reply.status(500).send({ error: 'FALHA_REMOCAO', message: err.message });
    }
  });

  // ── POST /system/restore — Importar configurações ─────────────────────────
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

      logger.info(
        { timestamp: backup.timestamp, profiles: backup.profiles.length, users: backup.users.length },
        'Sistema restaurado a partir de backup'
      );

      return reply.send({ message: 'Sistema restaurado com sucesso.', timestamp: backup.timestamp });
    } catch (err: any) {
      logger.error({ err }, 'Erro ao restaurar backup');
      return reply.status(500).send({ error: 'FALHA_RESTORE', message: err.message });
    }
  });

  // ── GET /system/reset/status — Estatísticas para o painel de reset ────────
  fastify.get('/system/reset/status', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user?.roles?.includes('ADMIN')) {
      return reply.status(403).send({ error: 'Acesso negado.' });
    }

    const [assets, jobs, users, profiles] = await Promise.all([
      prisma.asset.count(),
      prisma.job.count(),
      prisma.user.count(),
      prisma.encodingProfile.count(),
    ]);

    return {
      assets,
      jobs,
      users,
      profiles,
      isEmpty: (assets + jobs) === 0,
    };
  });

  // ── POST /system/reset — Reset granular do sistema ────────────────────────
  fastify.post('/system/reset', {
    schema: {
      description: 'Executa reset granular de componentes do sistema (Admin only)',
      tags: ['System'],
      body: {
        type: 'object',
        properties: {
          redis:     { type: 'boolean', description: 'Limpar chaves do Redis' },
          database:  { type: 'boolean', description: 'Limpar tabelas de Assets e Jobs' },
          tempFiles: { type: 'boolean', description: 'Limpar diretório temporário' },
          logs:      { type: 'boolean', description: 'Limpar ficheiros de log e backups' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user?.roles?.includes('ADMIN')) {
      return reply.status(403).send({ error: 'Acesso negado.' });
    }

    const { redis, database, tempFiles, logs } = request.body as {
      redis?: boolean;
      database?: boolean;
      tempFiles?: boolean;
      logs?: boolean;
    };

    const results: Record<string, any> = {};

    try {
      // 1. Limpar Redis
      if (redis) {
        const { getRedisClient } = await import('../../common/redis');
        const client = getRedisClient();
        const keys = await client.keys('nexora:*');
        if (keys.length > 0) await client.del(...keys);
        results['redis'] = { status: 'ok', keysCleared: keys.length };
      }

      // 2. Limpar Database (Truncate assets/jobs mas manter config/utilizadores)
      if (database) {
        await prisma.$transaction([
          prisma.job.deleteMany({}),
          prisma.asset.deleteMany({}),
        ]);
        results['database'] = { status: 'ok' };
      }

      // 3. Limpar Ficheiros Temporários
      if (tempFiles) {
        const config = readConfig();
        const tempDir = config.tempDirectory;
        if (fs.existsSync(tempDir)) {
          const files = fs.readdirSync(tempDir);
          for (const f of files) {
            try {
              const p = path.join(tempDir, f);
              if (fs.lstatSync(p).isDirectory()) {
                fs.rmSync(p, { recursive: true, force: true });
              } else {
                fs.unlinkSync(p);
              }
            } catch {}
          }
          results['tempFiles'] = { status: 'ok', dir: tempDir };
        }
      }

      // 4. Limpar Logs e Backups
      if (logs) {
        const logDir = path.join(process.cwd(), 'logs');
        if (fs.existsSync(logDir)) {
          fs.readdirSync(logDir).forEach(f => {
            try { fs.unlinkSync(path.join(logDir, f)); } catch {}
          });
        }
        if (fs.existsSync(BACKUP_DIR)) {
          fs.readdirSync(BACKUP_DIR).forEach(f => {
            try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch {}
          });
        }
        results['logs'] = { status: 'ok' };
      }

      logger.info({ results }, 'Reset de sistema executado pelo administrador');
      return reply.send({ message: 'Reset executado com sucesso.', results });

    } catch (err: any) {
      logger.error({ err }, 'Erro ao executar reset do sistema');
      return reply.status(500).send({ error: 'RESET_FAILED', message: err.message });
    }
  });
}
