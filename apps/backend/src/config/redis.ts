import Redis from 'ioredis';
import { env } from './env';

// Cliente Redis principal
export const redis = new Redis({
  host: env.REDIS_HOST,
  port: parseInt(env.REDIS_PORT),
  password: env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

// Cliente Redis para Bull (filas)
export const redisForBull = new Redis({
  host: env.REDIS_HOST,
  port: parseInt(env.REDIS_PORT),
  password: env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Bull requer null
});

// Event listeners
redis.on('connect', () => {
  console.log('✅ Redis connected');
});

redis.on('error', (error) => {
  console.error('❌ Redis error:', error);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await redis.quit();
  await redisForBull.quit();
});

// Helper para testar conexão
export async function testRedisConnection(): Promise<boolean> {
  try {
    await redis.ping();
    console.log('✅ Redis ping successful');
    return true;
  } catch (error) {
    console.error('❌ Redis ping failed:', error);
    return false;
  }
}
