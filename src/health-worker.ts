// Health check do worker para Docker HEALTHCHECK
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
redis.ping()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('OK'); 
    redis.disconnect(); 
    process.exit(0); 
  })
  .catch(() => { redis.disconnect(); process.exit(1); });
