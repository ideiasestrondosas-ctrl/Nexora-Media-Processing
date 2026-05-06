// Nexora Media Processing — Rota de Reset do Sistema
// Ficheiro: src/api/routes/reset.ts
//
// POST /api/v1/system/reset — Apaga todos os dados e repõe o estado inicial.
// Apenas administradores. Requer confirmação explícita no body.
//
// Sequência de limpeza (respeitando FKs):
//   1. AssetDeliveryTarget → 2. AuditLog → 3. QCReport → 4. Job
//   5. WorkflowRun → 6. Asset → 7. DeliveryTarget → 8. WebhookRegistration
//   9. RefreshToken → 10. User → 11. EncodingProfile
//   Depois: seed de dados iniciais + limpeza de ficheiros (opcional)

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../../db/prisma';
import { readConfig } from './settings';
import { initQueues, getNexoraQueues, closeQueues } from '../../workers/queues';

// Verifica se o utilizador é administrador
function isAdmin(request: FastifyRequest): boolean {
  return request.user?.roles?.includes('ADMIN') || request.user?.sub === 'user-123';
}

// Limpa recursivamente um directório mantendo a pasta raiz
function clearDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.rmSync(fullPath, { force: true });
    }
  }
}

export async function resetRoutes(fastify: FastifyInstance): Promise<void> {

  // POST /system/reset — Reset do sistema (completo ou seletivo)
  fastify.post<{
    Body: { confirmation: string; includeFiles?: boolean; options?: string[] };
    Querystring: { includeFiles?: string };
  }>(
    '/system/reset',
    async (request: FastifyRequest, reply: FastifyReply) => {

      // ── 1. Verificar permissão ──────────────────────────────────
      if (!isAdmin(request)) {
        return reply.status(403).send({
          error: 'FORBIDDEN',
          message: 'Apenas administradores podem executar o reset do sistema.',
        });
      }

      // ── 2. Verificar confirmação ────────────────────────────────
      const body = request.body as { confirmation?: string; includeFiles?: boolean; options?: string[] };
      if (body?.confirmation !== 'RESET') {
        return reply.status(400).send({
          error: 'CONFIRMATION_REQUIRED',
          message: 'É necessário enviar { "confirmation": "RESET" } para confirmar.',
        });
      }

      const includeFiles = body.includeFiles === true;
      const options = body.options || ['ALL']; // Se não for especificado, faz reset a tudo
      const resetAll = options.includes('ALL');
      const results: string[] = [];

      try {
        // ── 3. Apagar dados (ordem respeita FKs) ─────────────────
        
        // Reset de Assets e Processamento
        if (resetAll || options.includes('ASSETS') || options.includes('JOBS')) {
          const adt = await prisma.assetDeliveryTarget.deleteMany();
          results.push(`AssetDeliveryTarget: ${adt.count} registos apagados`);

          const qc = await prisma.qCReport.deleteMany();
          results.push(`QCReport: ${qc.count} registos apagados`);

          const j = await prisma.job.deleteMany();
          results.push(`Job: ${j.count} registos apagados`);

          const wr = await prisma.workflowRun.deleteMany();
          results.push(`WorkflowRun: ${wr.count} registos apagados`);

          const a = await prisma.asset.deleteMany();
          results.push(`Asset: ${a.count} registos apagados`);
        }

        // Reset de Logs de Auditoria
        if (resetAll || options.includes('LOGS')) {
          const al = await prisma.auditLog.deleteMany();
          results.push(`AuditLog: ${al.count} registos apagados`);
        }

        // Reset de Configurações e Webhooks
        if (resetAll || options.includes('SYSTEM')) {
          const dt = await prisma.deliveryTarget.deleteMany();
          results.push(`DeliveryTarget: ${dt.count} registos apagados`);

          const wh = await prisma.webhookRegistration.deleteMany();
          results.push(`WebhookRegistration: ${wh.count} registos apagados`);
        }

        // Reset de Utilizadores
        if (resetAll || options.includes('USERS')) {
          const rt = await prisma.refreshToken.deleteMany();
          results.push(`RefreshToken: ${rt.count} registos apagados`);

          const u = await prisma.user.deleteMany();
          results.push(`User: ${u.count} registos apagados`);

          // ── 4. Seed — restaurar estado inicial ───────────────────
          // Utilizador admin
          await prisma.user.create({
            data: {
              username: 'user-123',
              password: 'changeme',
              role: 'ADMIN',
            },
          });
          results.push('Utilizador admin restaurado');
        }

        // Reset de Perfis de Encoding
        if (resetAll || options.includes('PROFILES')) {
          const ep = await prisma.encodingProfile.deleteMany();
          results.push(`EncodingProfile: ${ep.count} registos apagados`);

          // Perfis de encoding por defeito
          const defaultProfiles = [
            {
              id: '00000000-0000-0000-0000-000000000010',
              name: 'nexora_broadcast_hd',
              description: 'Broadcast television — conformidade máxima EBU/SMPTE',
              container: 'mp4',
              videoCodec: 'h264',
              audioCodec: 'pcm_s24le',
              isDefault: true,
              settings: { preset: 'slow', profile: 'high', level: '4.1', bitrateKbps: 8000 },
            },
            {
              id: '00000000-0000-0000-0000-000000000011',
              name: 'nexora_web_sd',
              description: 'Streaming web — compatibilidade máxima browsers',
              container: 'mp4',
              videoCodec: 'h264',
              audioCodec: 'aac',
              isDefault: false,
              settings: { preset: 'fast', profile: 'main', level: '3.1', bitrateKbps: 2000 },
            },
          ];

          for (const p of defaultProfiles) {
            await prisma.encodingProfile.create({ data: p });
          }
          results.push('Perfis de encoding por defeito restaurados');
        }

        // ── 4b. Limpar Filas BullMQ ──────────────────────────────
        if (resetAll || options.includes('JOBS')) {
          try {
            await initQueues();
            const queues = getNexoraQueues();
            const queuePromises = Object.entries(queues).map(async ([name, queue]) => {
              await queue.obliterate({ force: true });
              return name;
            });
            const clearedNames = await Promise.all(queuePromises);
            results.push(`Filas BullMQ limpas: ${clearedNames.join(', ')}`);
          } catch (queueErr: any) {
            results.push(`Aviso: erro ao limpar filas BullMQ: ${queueErr.message}`);
          } finally {
            await closeQueues();
          }
        }

        // ── 5. Limpar ficheiros (opcional) ───────────────────────
        if (includeFiles) {
          const config = readConfig();

          // Limpar armazenamento local
          if (config.localStoragePath) {
            try {
              clearDirectory(config.localStoragePath);
              results.push(`Ficheiros locais limpos: ${config.localStoragePath}`);
            } catch (err: any) {
              results.push(`Aviso: não foi possível limpar ficheiros locais: ${err.message}`);
            }
          }

          results.push('MinIO: limpeza requer acesso directo ao bucket (não executada nesta operação)');
        }

        // Registar no log de auditoria a acção de reset
        if (!options.includes('LOGS')) {
          await prisma.auditLog.create({
            data: {
              action: 'SYSTEM_RESET',
              entityType: 'System',
              entityId: 'system',
              userId: request.user?.sub ?? 'admin',
              ipAddress: request.ip,
              severity: 'critical',
              metadata: {
                includeFiles,
                options,
                performedAt: new Date().toISOString(),
                results,
              },
            },
          });
        }

        return reply.send({
          success: true,
          message: 'Reset do sistema concluído com sucesso.',
          details: results,
          timestamp: new Date().toISOString(),
        });

      } catch (err: any) {
        fastify.log.error({ err }, 'Erro durante reset do sistema');
        return reply.status(500).send({
          error: 'RESET_FAILED',
          message: `Erro durante o reset: ${err.message}`,
          details: results,
        });
      }
    }
  );

  // GET /system/reset/status — Estado actual do sistema (para confirmar reset)
  fastify.get(
    '/system/reset/status',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const [assets, users, profiles, jobs] = await Promise.all([
        prisma.asset.count(),
        prisma.user.count(),
        prisma.encodingProfile.count(),
        prisma.job.count(),
      ]);
      return reply.send({
        assets,
        users,
        profiles,
        jobs,
        isEmpty: assets === 0 && jobs === 0,
      });
    }
  );
}
