// Nexora Media Processing — Rota: HandBrake & FFmpeg Presets
// Ficheiro: src/api/routes/presets.ts

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { handbrakeAdapter } from '../../pipeline/tools/handbrake-adapter';
import { ffmpegBuilder } from '../../pipeline/ffmpeg/builder';

export async function presetsRoutes(fastify: FastifyInstance): Promise<void> {
  
  /**
   * GET /api/v1/presets
   * Lista todos os presets disponíveis (HandBrake e FFmpeg).
   */
  fastify.get('/presets', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const hbPresets = handbrakeAdapter.listPresets();
    const ffProfiles = ffmpegBuilder.constructor['getAvailableProfiles'] ? (ffmpegBuilder.constructor as any).getAvailableProfiles() : [];
    
    return {
      handbrake: hbPresets,
      ffmpeg: ffProfiles,
      count: hbPresets.length + ffProfiles.length
    };
  });

  /**
   * GET /api/v1/presets/:name
   * Retorna metadados de um perfil FFmpeg específico.
   */
  fastify.get<{ Params: { name: string } }>('/presets/:name', async (request, reply) => {
    const { name } = request.params;
    
    const metadata = (ffmpegBuilder.constructor as any).getProfileMetadata 
      ? (ffmpegBuilder.constructor as any).getProfileMetadata(name)
      : null;

    if (!metadata) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: `Preset/Perfil '${name}' não encontrado no FFmpegBuilder`
      });
    }

    return metadata;
  });
}
