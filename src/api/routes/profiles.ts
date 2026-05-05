// Nexora Media Processing — Rota: Perfis de Encoding
// Ficheiro: src/api/routes/profiles.ts
//
// GET /api/v1/profiles — lista todos os perfis de encoding disponíveis

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma';

const profileSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  container: z.string().min(1),
  videoCodec: z.string().min(1),
  audioCodec: z.string().min(1),
  settings: z.record(z.any()).default({}),
  isDefault: z.boolean().default(false)
});

export async function profilesRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /profiles — listar todos os perfis
  fastify.get('/profiles', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const profiles = await prisma.encodingProfile.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return {
      profiles,
      count: profiles.length,
    };
  });

  // GET /profiles/:id — perfil específico
  fastify.get<{ Params: { id: string } }>(
    '/profiles/:id',
    async (request, reply) => {
      const profile = await prisma.encodingProfile.findUnique({
        where: { id: request.params.id }
      });
      if (!profile) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Perfil '${request.params.id}' não encontrado`,
        });
      }
      return profile;
    }
  );

  // POST /profiles — criar perfil
  fastify.post<{ Body: z.infer<typeof profileSchema> }>(
    '/profiles',
    async (request, reply) => {
      const parsed = profileSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
      }

      if (parsed.data.isDefault) {
        await prisma.encodingProfile.updateMany({
          where: { isDefault: true },
          data: { isDefault: false }
        });
      }

      const newProfile = await prisma.encodingProfile.create({
        data: parsed.data
      });
      return reply.status(201).send(newProfile);
    }
  );

  // PUT /profiles/:id — atualizar perfil
  fastify.put<{ Params: { id: string }, Body: z.infer<typeof profileSchema> }>(
    '/profiles/:id',
    async (request, reply) => {
      const parsed = profileSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
      }

      const existing = await prisma.encodingProfile.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Perfil não encontrado' });
      }

      if (parsed.data.isDefault) {
        await prisma.encodingProfile.updateMany({
          where: { isDefault: true, id: { not: request.params.id } },
          data: { isDefault: false }
        });
      }

      const updated = await prisma.encodingProfile.update({
        where: { id: request.params.id },
        data: parsed.data
      });
      return updated;
    }
  );

  // DELETE /profiles/:id — remover perfil
  fastify.delete<{ Params: { id: string } }>(
    '/profiles/:id',
    async (request, reply) => {
      const existing = await prisma.encodingProfile.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Perfil não encontrado' });
      }

      // Regra 1: Perfis de sistema só podem ser apagados por Administradores
      const userRoles = request.user?.roles || [];
      const isAdmin = userRoles.includes('ADMIN');

      if (existing.isSystem && !isAdmin) {
        return reply.status(403).send({ 
          error: 'FORBIDDEN', 
          message: 'Apenas administradores podem remover perfis padrão do sistema' 
        });
      }

      // Regra 2: Impedir apagar o perfil por defeito (se não for admin ou se houver risco)
      if (existing.isDefault && !isAdmin) {
        return reply.status(400).send({ error: 'BAD_REQUEST', message: 'Não pode apagar o perfil por defeito' });
      }

      // Regra 3: Deve sempre existir pelo menos um perfil no sistema
      const totalProfiles = await prisma.encodingProfile.count();
      if (totalProfiles <= 1) {
        return reply.status(400).send({ 
          error: 'CONSTRAINT_VIOLATION', 
          message: 'Deve existir sempre pelo menos um perfil de encoding no sistema' 
        });
      }

      await prisma.encodingProfile.delete({
        where: { id: request.params.id }
      });
      return reply.status(204).send();
    }
  );
}
