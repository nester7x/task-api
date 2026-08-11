import Redis from 'ioredis';
import { env } from '../config/env';

export const redisClient = new Redis(env.REDIS_URL, { lazyConnect: true });

// Prevent unhandled 'error' events from crashing the process before
// connectRedis() has a chance to catch and surface the rejection.
redisClient.on('error', () => {});

export const connectRedis = async (): Promise<void> => {
  await redisClient.connect();
  // Re-attach a real error logger after the initial connection succeeds.
  redisClient.on('error', (err) => console.error('[redis]', err));
  console.log('Connected to Redis');
};