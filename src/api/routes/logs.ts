import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logStreamer } from '../../observability/log-streamer';

interface DiagnosticResult {
  id: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  title: string;
  message: string;
  suggestion: string;
}

/**
 * Motor de Diagnóstico Baseado em Regras (Sem IA)
 */
function analyzeLog(log: any): DiagnosticResult | null {
  const msg = (log.msg || '').toLowerCase();
  const level = log.level;

  // Regra 1: Falha de conexão com a Base de Dados
  if (msg.includes('prisma') && (msg.includes('connection') || msg.includes('refused'))) {
    return {
      id: 'DB_CONN_FAIL',
      severity: 'CRITICAL',
      title: 'Falha de Ligação à Base de Dados',
      message: 'O sistema não consegue comunicar com o PostgreSQL.',
      suggestion: 'Verifique se o contentor nexora-postgres está a correr e se as credenciais no .env estão correctas.'
    };
  }

  // Regra 2: FFmpeg Hardware Acceleration Error
  if (msg.includes('ffmpeg') && (msg.includes('vaapi') || msg.includes('cuda') || msg.includes('h264_nvenc'))) {
    if (msg.includes('failed') || msg.includes('not found')) {
      return {
        id: 'GPU_ACCEL_FAIL',
        severity: 'ERROR',
        title: 'Falha na Aceleração por Hardware',
        message: 'O FFmpeg tentou usar a GPU mas falhou.',
        suggestion: 'Verifique se os drivers NVIDIA/VAAPI estão instalados e se o Docker tem acesso à GPU (--gpus all).'
      };
    }
  }

  // Regra 3: Redis / BullMQ Connection
  if (msg.includes('redis') && msg.includes('econnrefused')) {
    return {
      id: 'REDIS_CONN_FAIL',
      severity: 'CRITICAL',
      title: 'Falha no Redis (Filas)',
      message: 'Não é possível ligar ao Redis para gerir as filas de processamento.',
      suggestion: 'Reinicie o serviço redis: npx nexora docker-restart redis'
    };
  }

  // Regra 4: Espaço em Disco Insuficiente
  if (msg.includes('enospc') || msg.includes('no space left on device')) {
    return {
      id: 'DISK_FULL',
      severity: 'CRITICAL',
      title: 'Disco Cheio',
      message: 'Não há espaço suficiente para processar novos ficheiros.',
      suggestion: 'Limpe o diretório /media/temp ou aumente a quota de disco do servidor.'
    };
  }

  // Regra 5: Timeout de Job
  if (msg.includes('job') && msg.includes('timeout')) {
    return {
      id: 'JOB_TIMEOUT',
      severity: 'WARNING',
      title: 'Tempo de Espera Excedido',
      message: 'Um job demorou mais tempo do que o esperado e foi interrompido.',
      suggestion: 'Considere aumentar o timeout no perfil de encoding ou verifique a carga do CPU.'
    };
  }

  return null;
}

export async function logsRoutes(fastify: FastifyInstance): Promise<void> {

  // SSE: Stream de Logs em tempo real
  // IMPORTANTE: usamos reply.hijack() para assumir controlo total sobre o stream raw
  // e setHeader() (em vez de writeHead()) para que o @fastify/cors possa ainda injectar
  // os seus cabeçalhos Access-Control-* antes da resposta ser enviada ao browser.
  fastify.get('/logs/stream', (request: FastifyRequest, reply: FastifyReply) => {
    // Hijack: informa o Fastify que a resposta será gerida manualmente
    reply.hijack();

    // CORS manual — reply.hijack() bypassa o plugin @fastify/cors, por isso
    // temos de injectar os cabeçalhos Access-Control-* manualmente.
    const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);
    const requestOrigin = request.headers.origin ?? '';
    const corsOrigin =
      allowedOrigins.length === 0 || allowedOrigins.includes(requestOrigin)
        ? requestOrigin || '*'
        : allowedOrigins[0]!;

    reply.raw.setHeader('Access-Control-Allow-Origin', corsOrigin);
    reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
    reply.raw.setHeader('Vary', 'Origin');

    // Configurar headers para SSE
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('X-Accel-Buffering', 'no'); // Desactivar buffering no Nginx
    reply.raw.writeHead(200);

    // Enviar histórico inicial
    const history = logStreamer.getHistory();
    for (const log of history) {
      const diagnostic = analyzeLog(log);
      reply.raw.write(`data: ${JSON.stringify({ ...log, diagnostic })}\n\n`);
    }

    // Adicionar um log de sistema para confirmar a ligação no frontend
    const connectedLog = {
      level: 30,
      time: new Date().toISOString(),
      service: 'nexora-api',
      msg: 'Consola de Sistema conectada via SSE. A aguardar novos logs...',
    };
    reply.raw.write(`data: ${JSON.stringify({ ...connectedLog, diagnostic: null })}\n\n`);

    // Ouvir novos logs
    const onLog = (log: any) => {
      if (!reply.raw.writableEnded) {
        const diagnostic = analyzeLog(log);
        reply.raw.write(`data: ${JSON.stringify({ ...log, diagnostic })}\n\n`);
      }
    };

    logStreamer.on('log', onLog);

    // Heartbeat a cada 15s para manter a ligação viva e evitar timeout
    const heartbeatInterval = setInterval(() => {
      if (!reply.raw.writableEnded) {
        reply.raw.write(`event: heartbeat\ndata: {}\n\n`);
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 15000);

    // Limpar recursos ao fechar a ligação
    request.raw.on('close', () => {
      clearInterval(heartbeatInterval);
      logStreamer.off('log', onLog);
    });
  });

  // GET /logs/diagnostics — Obter apenas anomalias recentes
  fastify.get('/logs/diagnostics', async () => {
    const history = logStreamer.getHistory();
    const diagnostics = history
      .map(log => analyzeLog(log))
      .filter(d => d !== null);
    
    // Remover duplicados (manter apenas o mais recente de cada tipo)
    const unique = Array.from(new Map(diagnostics.map(d => [d!.id, d])).values());
    return unique;
  });
}
