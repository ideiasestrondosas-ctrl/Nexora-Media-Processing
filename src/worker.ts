// Nexora Worker - aguarda Prompt 1 (Claude) para implementacao completa
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
redis.on('connect', () => console.log('[Nexora Worker] Redis conectado'));
redis.on('error', (err: Error) => console.error('[Nexora Worker] Redis erro:', err));
process.on('SIGTERM', () => { redis.disconnect(); process.exit(0); });
process.on('SIGINT',  () => { redis.disconnect(); process.exit(0); });
