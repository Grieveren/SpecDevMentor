import Redis, { RedisOptions } from 'ioredis';

export class RedisClient {
  private static instance: Redis | null = null;
  private static isConnected = false;

  static async getInstance(): Promise<Redis> {
    if (!RedisClient.instance) {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      const options: RedisOptions = {
        retryStrategy: retries => {
          if (retries > 10) {
            console.error('Redis connection failed after 10 retries');
            return null;
          }
          return Math.min(retries * 50, 1000);
        },
      };

      RedisClient.instance = new Redis(redisUrl, options);

      RedisClient.instance.on('error', err => {
        console.error('Redis Client Error:', err);
        RedisClient.isConnected = false;
      });

      RedisClient.instance.on('connect', () => {
        RedisClient.isConnected = true;
      });

      RedisClient.instance.on('close', () => {
        RedisClient.isConnected = false;
      });

      await RedisClient.instance.connect();
    }

    return RedisClient.instance;
  }

  static async disconnect(): Promise<void> {
    if (RedisClient.instance && RedisClient.isConnected) {
      await RedisClient.instance.disconnect();
      RedisClient.isConnected = false;
    }
  }

  static isRedisConnected(): boolean {
    return RedisClient.isConnected;
  }
}

export default RedisClient;
