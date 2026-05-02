// Nexora Media Processing — Rota: Perfis de Encoding
// Ficheiro: src/api/routes/profiles.ts
//
// GET /api/v1/profiles — lista todos os perfis de encoding disponíveis

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ── Configuração estática dos perfis ─────────────────────────────
// Fonte de verdade: alinhada com NexoraFFmpegCommandBuilder

const ENCODING_PROFILES = [
  {
    id: 'broadcast-hd',
    name: 'Nexora Broadcast HD',
    description: 'Broadcast television — conformidade máxima EBU/SMPTE',
    video: {
      codec: 'h264',
      preset: 'slow',
      profile: 'high',
      level: '4.1',
      bitrateKbps: 8000,
      maxrateKbps: 10000,
      bufsizeKbps: 20000,
      pixelFormat: 'yuv420p',
      colorspace: 'bt709',
      gopSize: 50,
      bFrames: 0,
      closedGop: true,
      cfr: true,
      frameRate: 25,
    },
    audio: {
      codec: 'pcm_s24le',
      sampleRate: 48000,
      loudnessTargetLufs: -23,
      truePeakLimitDbtp: -1.0,
    },
    container: 'mp4',
    priority: 10,
    vmafThreshold: 90,
    useCases: ['broadcast-tv', 'playout', 'archive'],
  },
  {
    id: 'ott-hd',
    name: 'Nexora OTT HD',
    description: 'Streaming OTT — Netflix / Apple TV / Prime compatível',
    video: {
      codec: 'h264',
      preset: 'medium',
      profile: 'high',
      level: '4.0',
      bitrateKbps: 5000,
      maxrateKbps: 7000,
      bufsizeKbps: 14000,
      pixelFormat: 'yuv420p',
      colorspace: 'bt709',
      gopSize: 48,
      bFrames: 2,
      closedGop: false,
      cfr: false,
      frameRate: 24,
    },
    audio: {
      codec: 'aac',
      bitrateKbps: 192,
      sampleRate: 48000,
      loudnessTargetLufs: -16,
      truePeakLimitDbtp: -1.0,
    },
    container: 'mp4',
    priority: 7,
    vmafThreshold: 90,
    useCases: ['ott-streaming', 'vod'],
  },
  {
    id: 'web-sd',
    name: 'Nexora Web SD',
    description: 'Streaming web — compatibilidade máxima browsers',
    video: {
      codec: 'h264',
      preset: 'fast',
      profile: 'main',
      level: '3.1',
      bitrateKbps: 2000,
      maxrateKbps: 3000,
      bufsizeKbps: 6000,
      pixelFormat: 'yuv420p',
      colorspace: 'bt709',
      width: 1280,
      height: 720,
      gopSize: 48,
      bFrames: 2,
      closedGop: false,
      cfr: false,
      frameRate: null,
    },
    audio: {
      codec: 'aac',
      bitrateKbps: 128,
      sampleRate: 44100,
      loudnessTargetLufs: -16,
      truePeakLimitDbtp: -1.5,
    },
    container: 'mp4',
    priority: 5,
    vmafThreshold: 85,
    useCases: ['web', 'social-media'],
  },
  {
    id: 'proxy',
    name: 'Nexora Proxy',
    description: 'Proxy de edição e preview — qualidade reduzida para velocidade',
    video: {
      codec: 'h264',
      preset: 'ultrafast',
      profile: 'baseline',
      level: '3.0',
      bitrateKbps: 800,
      maxrateKbps: 1000,
      bufsizeKbps: 2000,
      pixelFormat: 'yuv420p',
      colorspace: null,
      width: 854,
      height: 480,
      gopSize: 48,
      bFrames: 0,
      closedGop: false,
      cfr: false,
      frameRate: null,
    },
    audio: {
      codec: 'aac',
      bitrateKbps: 96,
      sampleRate: 44100,
      loudnessTargetLufs: -23,
      truePeakLimitDbtp: -2.0,
    },
    container: 'mp4',
    priority: 3,
    vmafThreshold: 70,
    useCases: ['proxy', 'preview', 'review'],
  },
];

// ── Rota ─────────────────────────────────────────────────────────

export async function profilesRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /profiles — listar todos os perfis
  fastify.get('/profiles', async (_request: FastifyRequest, _reply: FastifyReply) => {
    return {
      profiles: ENCODING_PROFILES,
      count: ENCODING_PROFILES.length,
    };
  });

  // GET /profiles/:id — perfil específico
  fastify.get<{ Params: { id: string } }>(
    '/profiles/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const profile = ENCODING_PROFILES.find(p => p.id === request.params.id);
      if (!profile) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Perfil '${request.params.id}' não encontrado`,
        });
      }
      return profile;
    }
  );
}
