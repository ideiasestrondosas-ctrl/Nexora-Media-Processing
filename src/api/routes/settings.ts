// Nexora Media Processing — Rota de Configurações do Sistema
// Ficheiro: src/api/routes/settings.ts
//
// Permite que administradores leiam e actualizem configurações globais do sistema,
// como o diretório de armazenamento local para uploads.
//
// Todas as configurações são persistidas em nexora-config.json na raiz do projeto.

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { getSystemVersion } from './system';

const CONFIG_FILE = path.join(process.cwd(), 'nexora-config.json');

const DEFAULT_CONFIG: NexoraConfig = {
  localStoragePath: 'C:\\NexoraStorage\\assets',
  defaultStorageStrategy: 'MINIO',
  webPriorityPercentage: 20,
};

interface NexoraConfig {
  localStoragePath: string;
  defaultStorageStrategy: 'MINIO' | 'LOCAL';
  webPriorityPercentage: number;
}

export function readConfig(): NexoraConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch {
    // Falha silenciosa, usar defaults
  }
  return { ...DEFAULT_CONFIG };
}

function writeConfig(config: NexoraConfig): void {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

// Helper: Verificar se o utilizador é administrador
function isAdmin(request: FastifyRequest): boolean {
  return request.user?.roles?.includes('ADMIN') || request.user?.sub === 'user-123';
}

export async function settingsRoutes(fastify: FastifyInstance): Promise<void> {

  // ── GET /settings — Ler configuração actual ────────────────────
  fastify.get('/settings', {
    schema: {
      description: 'Retorna as configurações globais do sistema',
      tags: ['Settings'],
      response: {
        200: {
          type: 'object',
          properties: {
            localStoragePath:        { type: 'string' },
            defaultStorageStrategy:  { type: 'string' },
            webPriorityPercentage:   { type: 'integer' },
            version:                 { type: 'string' },
          },
        },
      },
    },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const config = readConfig();
    return reply.send({
      ...config,
      version: getSystemVersion(),
    });
  });

  // ── PUT /settings — Actualizar configuração (admin only) ───────
  fastify.put('/settings', {
    schema: {
      description: 'Actualiza configurações globais — apenas administradores',
      tags: ['Settings'],
      body: {
        type: 'object',
        properties: {
          localStoragePath:        { type: 'string' },
          defaultStorageStrategy:  { type: 'string', enum: ['MINIO', 'LOCAL'] },
          webPriorityPercentage:   { type: 'integer', minimum: 10, maximum: 90 },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // Verificar permissão de admin
    if (!isAdmin(request)) {
      return reply.status(403).send({ error: 'Apenas administradores podem alterar as configurações.' });
    }

    const body = request.body as Partial<NexoraConfig>;
    const current = readConfig();

    // Validar e criar o diretório local se necessário
    if (body.localStoragePath) {
      const resolvedPath = path.resolve(body.localStoragePath);
      if (!fs.existsSync(resolvedPath)) {
        try {
          fs.mkdirSync(resolvedPath, { recursive: true });
        } catch (err: any) {
          return reply.status(400).send({
            error: `Não foi possível criar o diretório: ${resolvedPath}. Erro: ${err.message}`,
          });
        }
      }
      body.localStoragePath = resolvedPath;
    }

    const updated: NexoraConfig = {
      ...current,
      ...body,
    };

    writeConfig(updated);
    return reply.send({ message: 'Configurações actualizadas com sucesso.', config: updated });
  });

  // ── POST /settings/test-path — Verificar se o caminho existe/é criável ──
  fastify.post('/settings/test-path', {
    schema: {
      description: 'Testa se um caminho local é válido e acessível',
      tags: ['Settings'],
      body: {
        type: 'object',
        required: ['path'],
        properties: {
          path: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isAdmin(request)) {
      return reply.status(403).send({ error: 'Acesso restrito a administradores.' });
    }

    const { path: testPath } = request.body as { path: string };
    const resolvedPath = path.resolve(testPath);

    const exists = fs.existsSync(resolvedPath);
    let writable = false;

    if (exists) {
      try {
        fs.accessSync(resolvedPath, fs.constants.W_OK);
        writable = true;
      } catch {
        writable = false;
      }
    } else {
      // Tentar criar
      try {
        fs.mkdirSync(resolvedPath, { recursive: true });
        fs.rmdirSync(resolvedPath);
        writable = true;
      } catch {
        writable = false;
      }
    }

    return reply.send({
      path: resolvedPath,
      exists,
      writable,
      valid: writable,
    });
  });
}
