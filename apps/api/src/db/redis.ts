import { Redis } from 'ioredis';
import { config } from '../config.js';
import { logger } from '../logger.js';

export function createRedis(): Redis {
  const r = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  r.on('error', (e) => logger.error({ err: e }, 'redis error'));
  return r;
}

let shared: Redis | null = null;
export function getRedis(): Redis {
  if (!shared) shared = createRedis();
  return shared;
}
