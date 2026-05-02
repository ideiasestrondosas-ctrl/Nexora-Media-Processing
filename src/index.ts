import Fastify from 'fastify';
const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
app.get('/health',       async () => ({ status: 'ok', version: '0.1.0', timestamp: new Date().toISOString() }));
app.get('/health/live',  async () => ({ status: 'ok' }));
app.get('/health/ready', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));
// TODO: registerPlugins e registerRoutes após Prompt 1 (Claude)
const start = async () => {
  try {
    await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
    app.log.info('Nexora iniciado');
  } catch (err) { app.log.error(err); process.exit(1); }
};
void start();
