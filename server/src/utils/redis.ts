import { createClient, RedisClientType } from 'redis';

export class RedisClient {
  private static instance: RedisClientType;
  private static isConnected = false;

  static async getInstance(): Promise<RedisClientType> {
    if (!RedisClient.instance) {
      RedisClient.instance = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('Redis connection failed after 10 retries');
              return new Error('Redis connection failed');
            }
            return Math.min(retries * 50, 1000);
          },
        },
      });

      RedisClient.instance.on('error', (err) => {
        console.error('Redis Client Error:', err);
        RedisClient.isConnected = false;
      });

      RedisClient.instance.on('connect', () => {
        // // console.log('Redis Client Connected');
        RedisClient.isConnected = true;
      });

      RedisClient.instance.on('disconnect', () => {
        // // console.log('Redis Client Disconnected');
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