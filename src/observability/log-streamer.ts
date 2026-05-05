import { EventEmitter } from 'events';

class LogStreamer extends EventEmitter {
  private logs: any[] = [];
  private readonly maxLogs = 500;
  private subscribed = false;

  constructor() {
    super();
  }

  /**
   * Inicializa a escuta de logs vindos do Redis (Pub/Sub).
   * Essencial para a API receber logs dos Workers.
   */
  public initRedisSubscription() {
    if (this.subscribed) return;
    this.subscribed = true;

    try {
      const { getRedisPubSub } = require('../common/redis');
      const pubsub = getRedisPubSub();

      pubsub.subscribe('nexora:logs:stream', (err: any) => {
        if (err) console.error('[LogStreamer] Erro ao subscrever canal de logs:', err);
      });

      pubsub.on('message', (channel: string, message: string) => {
        if (channel === 'nexora:logs:stream') {
          try {
            const log = JSON.parse(message);
            
            // Só adicionamos ao histórico local se o log vier de um processo diferente
            // para evitar duplicar logs que o memoryStream já capturou localmente.
            if (log.pid !== process.pid) {
              this.pushLog(log);
            }
          } catch (e) {}
        }
      });
    } catch (err) {
      console.error('[LogStreamer] Falha ao configurar bridge de logs Redis:', err);
    }
  }

  public pushLog(log: any) {
    // Manter apenas logs únicos baseados em tempo/pid se necessário, 
    // mas por agora a verificação de log.pid !== process.pid na subscrição chega.
    
    this.logs.push(log);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    this.emit('log', log);
  }

  public getHistory() {
    return this.logs;
  }
}

export const logStreamer = new LogStreamer();
