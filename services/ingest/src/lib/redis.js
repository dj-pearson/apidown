import Redis from 'ioredis';

export function createRedisClient() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  const redis = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      return Math.min(times * 200, 5000);
    },
  });

  redis.on('error', (err) => {
    console.error('[redis] Connection error:', err.message);
  });

  return redis;
}
