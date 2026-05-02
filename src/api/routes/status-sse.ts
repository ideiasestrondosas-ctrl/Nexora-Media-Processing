// Nexora Media Processing — Rota: SSE Status
// Ficheiro: src/api/routes/status-sse.ts
//
// GET /api/v1/assets/:id/status — Server-Sent Events para progresso em tempo real
//
// Eventos emitidos:
//   progress      — percentagem de transcode (do pub/sub Redis)
//   status_change — mudança de estado do asset
//   heartbeat     — keepalive a cada 15s
//   completed     — pipeline concluída
//   failed        — falha no processamento

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getRedisPubSub, assetStatusChannel, transcodeProgressChannel } from '../../common/redis';
import { prisma } from '../../db/prisma';
import { logger } from '../../observability/logger';

interface SSEParams {
  id: string;
}

export async function statusSseRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Params: SSEParams }>(
    '/assets/:id/status',
    async (request: FastifyRequest<{ Params: SSEParams }>, reply: FastifyReply) => {
      const { id: assetId } = request.params;
      const log = logger.child({ route: 'sse', assetId });

      // Verificar que o asset existe
      const asset = await prisma.asset.findUnique({
        where: { id: assetId, deletedAt: null },
        select: { id: true, status: true },
      });

      if (!asset) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Asset não encontrado' });
      }

      // Configurar headers SSE
      void reply.raw.writeHead(200, {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
        'X-Accel-Buffering': 'no', // Desactivar buffering no Nginx
      });

      // Helper para escrever eventos SSE
      const sendEvent = (eventType: string, data: unknown): void => {
        const json = JSON.stringify(data);
        reply.raw.write(`event: ${eventType}\ndata: ${json}\n\n`);
      };

      // Enviar estado inicial
      sendEvent('status_change', {
        assetId,
        status: asset.status,
        timestamp: new Date().toISOString(),
      });

      // Subscrever ao canal Redis de progresso
      const subscriber = getRedisPubSub();
      const progressChannel = transcodeProgressChannel(assetId);
      const statusChannel   = assetStatusChannel(assetId);

      const handleMessage = (channel: string, message: string): void => {
        try {
          const data = JSON.parse(message) as Record<string, unknown>;

          if (channel === progressChannel) {
            sendEvent('progress', { assetId, ...data, timestamp: new Date().toISOString() });

            // Se 100% → fechar após breve delay
            if (data['percent'] === 100) {
              setTimeout(() => {
                sendEvent('completed', { assetId, timestamp: new Date().toISOString() });
                reply.raw.end();
              }, 2000);
            }
          } else if (channel === statusChannel) {
            sendEvent('status_change', { assetId, ...data, timestamp: new Date().toISOString() });

            // Fechar SSE quando pipeline terminar
            const status = data['status'] as string | undefined;
            if (status === 'COMPLETED' || status === 'FAILED' || status === 'QC_REJECTED') {
              setTimeout(() => {
                sendEvent(status === 'COMPLETED' ? 'completed' : 'failed', {
                  assetId,
                  status,
                  timestamp: new Date().toISOString(),
                });
                reply.raw.end();
              }, 1000);
            }
          }
        } catch {
          /* ignorar mensagens mal formadas */
        }
      };

      await subscriber.subscribe(progressChannel, statusChannel);
      subscriber.on('message', handleMessage);

      // Heartbeat a cada 15s para manter a ligação viva
      const heartbeatInterval = setInterval(() => {
        if (!reply.raw.writableEnded) {
          sendEvent('heartbeat', { assetId, timestamp: new Date().toISOString() });
        } else {
          clearInterval(heartbeatInterval);
        }
      }, 15000);

      // Cleanup quando o cliente desligar
      request.raw.on('close', () => {
        clearInterval(heartbeatInterval);
        subscriber.off('message', handleMessage);
        void subscriber.unsubscribe(progressChannel, statusChannel).catch(() => {});
        log.debug({ assetId }, 'SSE client desligado');
      });

      // Timeout máximo de 4h (protecção contra conexões eternas)
      const maxTimeout = setTimeout(() => {
        sendEvent('timeout', { assetId, message: 'SSE connection timeout (4h)' });
        clearInterval(heartbeatInterval);
        reply.raw.end();
      }, 4 * 60 * 60 * 1000);

      request.raw.on('close', () => clearTimeout(maxTimeout));

      // Não retornar — manter a conexão aberta
      await new Promise<void>((resolve) => {
        reply.raw.on('finish', resolve);
        reply.raw.on('close', resolve);
      });
    }
  );
}
