import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/prisma';
import { UnauthorizedError } from '../../common/errors';

const userSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
  role: z.string().default('USER'),
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export async function usersRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /users — listar utilizadores
  fastify.get('/users', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, role: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'desc' }
    });
    return { users };
  });

  // POST /users — criar utilizador
  fastify.post<{ Body: z.infer<typeof userSchema> }>(
    '/users',
    async (request, reply) => {
      const parsed = userSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
      }

      // Validar duplicado
      const existing = await prisma.user.findUnique({ where: { username: parsed.data.username } });
      if (existing) {
        return reply.status(409).send({ error: 'CONFLICT', message: 'Username já existe' });
      }

      const newUser = await prisma.user.create({
        data: parsed.data,
        select: { id: true, username: true, role: true, createdAt: true }
      });
      return reply.status(201).send(newUser);
    }
  );

  // DELETE /users/:id — apagar utilizador
  fastify.delete<{ Params: { id: string } }>(
    '/users/:id',
    async (request, reply) => {
      const existing = await prisma.user.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Utilizador não encontrado' });
      }

      await prisma.user.delete({ where: { id: request.params.id } });
      return reply.status(204).send();
    }
  );

  // PUT /users/:id — editar utilizador (username/role)
  fastify.put<{ Params: { id: string }, Body: { username?: string, role?: string } }>(
    '/users/:id',
    async (request, reply) => {
      const { id } = request.params;
      const { username, role } = request.body;

      const existing = await prisma.user.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Utilizador não encontrado' });
      }

      const updated = await prisma.user.update({
        where: { id },
        data: {
          ...(username ? { username } : {}),
          ...(role ? { role } : {}),
        },
        select: { id: true, username: true, role: true, updatedAt: true }
      });

      return reply.status(200).send(updated);
    }
  );

  // PUT /users/password — alterar a própria password
  fastify.put<{ Body: z.infer<typeof updatePasswordSchema> }>(
    '/users/password',
    async (request, reply) => {
      const parsed = updatePasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', details: parsed.error.flatten() });
      }

      // O sub do request.user tem de vir do auth (já que está protegido)
      const userId = request.user?.sub;
      if (!userId) {
        throw new UnauthorizedError('Não autenticado');
      }

      const user = await prisma.user.findUnique({ where: { username: userId } });
      if (!user || user.password !== parsed.data.currentPassword) {
        throw new UnauthorizedError('Password actual inválida');
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { password: parsed.data.newPassword }
      });

      return reply.status(200).send({ message: 'Password atualizada com sucesso' });
    }
  );
}
