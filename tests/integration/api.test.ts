import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { registerRoutes } from '../../src/api/routes';
import { prisma } from '../../src/db/prisma';
import fs from 'fs';
import path from 'path';

// Mock dependências pesadas
vi.mock('../../src/db/prisma', () => ({
  prisma: {
    asset: {
      create: vi.fn().mockResolvedValue({ id: 'asset-1' }),
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
    refreshToken: {
      create: vi.fn().mockResolvedValue({ id: 'rt-1' }),
      findFirst: vi.fn(),
      update: vi.fn(),
    }
  }
}));

vi.mock('../../src/common/redis', () => ({
  redisClient: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
  redisPubSub: {}
}));

vi.mock('../../src/common/minio', () => ({
  minioClient: {
    putObject: vi.fn().mockResolvedValue(true),
  },
  BUCKETS: { INPUT: 'nexora-input' }
}));

vi.mock('../../src/workers/queues', () => ({
  enqueueIngest: vi.fn().mockResolvedValue({ id: 'job-1' }),
  QUEUE_NAMES: {
    INGEST: 'nexora-ingest',
    QC: 'nexora-qc',
    TRANSCODE: 'nexora-transcode',
    AUDIO: 'nexora-audio',
    DELIVERY: 'nexora-delivery'
  }
}));

describe('API Integration Tests (Supertest)', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    // Configurar variável de ambiente para testes de Auth
    process.env.NEXORA_AUTH_SECRET = 'test-secret-12345678901234567890';
    
    app = Fastify();
    
    // Registar plugins necessários manualmente para o test environment
    await app.register(multipart);
    await app.register(jwt, { secret: process.env.NEXORA_AUTH_SECRET || 'test' });
    await app.register(rateLimit, { max: 20, timeWindow: '1 minute' });
    
    // Registar rotas
    await registerRoutes(app);
    
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth Routes', () => {
    it('deve retornar tokens ao fazer login válido', async () => {
      const response = await request(app.server)
        .post('/api/v1/auth/login')
        .set('X-API-Key', process.env.NEXORA_AUTH_SECRET!)
        .send({ userId: 'user-123' })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('expiresIn', 900);
    });

    it('deve falhar login com secret inválido', async () => {
      const response = await request(app.server)
        .post('/api/v1/auth/login')
        .set('X-API-Key', 'wrong-secret')
        .send({ userId: 'user-123' })
        .expect(401);

      expect(response.body.message).toContain('Unauthorized');
    });
  });

  describe('Assets Routes (Upload)', () => {
    let accessToken: string;

    beforeAll(async () => {
      const response = await request(app.server)
        .post('/api/v1/auth/login')
        .set('X-API-Key', process.env.NEXORA_AUTH_SECRET!)
        .send({ userId: 'test-user' });
      accessToken = response.body.accessToken;
    });

    it('deve rejeitar upload sem token de autenticação', async () => {
      await request(app.server)
        .post('/api/v1/assets/upload')
        .expect(401);
    });

    it('deve aceitar upload de um ficheiro válido simulado', async () => {
      // Criar um buffer simulando um ficheiro MP4 com o magic byte "ftyp"
      const fakeMp4 = Buffer.concat([
        Buffer.from([0x00, 0x00, 0x00, 0x18]), // size
        Buffer.from('ftyp'),                   // magic
        Buffer.from('mp42'),                   // brand
        Buffer.alloc(100)                      // padding
      ]);

      const response = await request(app.server)
        .post('/api/v1/assets/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', fakeMp4, { filename: 'test-video.mp4', contentType: 'video/mp4' })
        .expect(201);

      expect(response.body).toHaveProperty('assetId');
      expect(response.body).toHaveProperty('jobId', 'job-1');
    });

    it('deve rejeitar ficheiro com magic bytes forjados (extensão MP4 mas conteúdo texto)', async () => {
      // Buffer de texto normal, mas tentamos passar como video/mp4
      const fakeFile = Buffer.from('Este ficheiro não é um vídeo, é um vírus.');

      const response = await request(app.server)
        .post('/api/v1/assets/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', fakeFile, { filename: 'malicioso.mp4', contentType: 'video/mp4' })
        .expect(400);

      expect(response.body.message).toContain('Assinatura do ficheiro não corresponde');
    });
  });

  describe('Rate Limiter', () => {
    it('deve bloquear após demasiadas tentativas de refresh', async () => {
      const maxRequests = 20; // Segundo o rate-limit-config.ts
      let lastResponse;

      // Esgotar o limite
      for (let i = 0; i < maxRequests + 1; i++) {
        lastResponse = await request(app.server)
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: 'fake-token' });
      }

      expect(lastResponse!.status).toBe(429);
      expect(lastResponse!.body.message).toContain('Rate limit exceeded');
    });
  });
});
