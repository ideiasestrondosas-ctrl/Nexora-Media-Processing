import { getNexoraQueues, initQueues, closeQueues } from '../src/workers/queues';
import { logger } from '../src/observability/logger';

async function flushAllQueues() {
  try {
    logger.info('A iniciar limpeza de todas as filas BullMQ...');
    
    // Inicializar instâncias das filas
    await initQueues();
    const queues = getNexoraQueues();
    
    const promises = Object.entries(queues).map(async ([name, queue]) => {
      logger.info(`A limpar fila: ${name}...`);
      await queue.drain(true); // Limpar jobs em espera
      await queue.clean(0, 100000, 'failed'); // Limpar todos os falhados
      await queue.clean(0, 100000, 'completed'); // Limpar todos os concluídos
      await queue.clean(0, 100000, 'active'); // Tentar limpar activos (pode falhar se estiverem a correr)
      
      const counts = await queue.getJobCounts();
      logger.info({ queue: name, ...counts }, 'Fila limpa');
    });

    await Promise.all(promises);
    logger.info('Todas as filas foram limpas com sucesso!');
    
  } catch (error) {
    logger.error({ error }, 'Erro ao limpar filas');
    process.exit(1);
  } finally {
    await closeQueues();
    process.exit(0);
  }
}

flushAllQueues();
