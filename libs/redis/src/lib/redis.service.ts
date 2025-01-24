import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements OnModuleInit {
  private readonly logger = new Logger(RedisService.name);
  private readonly defaultTTL = 3600;
  private redis: Redis;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      db: this.configService.get('REDIS_DB', 0),
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
    });

    this.redis.on('connect', () => {
      this.logger.log('Successfully connected to Redis');
    });

    this.redis.on('error', (error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
    });
  }

  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<boolean> {
    const attempts = await this.redis.incr(key);
    if (attempts === 1) {
      await this.redis.expire(key, windowSeconds);
    }
    return attempts <= limit;
  }

  async cacheSet(
    key: string,
    value: unknown,
    ttl: number = this.defaultTTL
  ): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      this.logger.error(`Failed to set cache for key ${key}: ${error.message}`);
      throw error;
    }
  }

  async cacheGet<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.logger.error(`Failed to get cache for key ${key}: ${error.message}`);
      return null;
    }
  }

  async cacheDelete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(
        `Failed to delete cache for key ${key}: ${error.message}`
      );
      throw error;
    }
  }

  async setLock(key: string, ttl: number): Promise<boolean> {
    const locked = await this.redis.set(key, '1', 'EX', ttl, 'NX');
    return locked === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async getTTL(key: string): Promise<number> {
    try {
      const ttl = await this.redis.ttl(key);
      if (ttl === -1) {
        this.logger.warn(`Key ${key} exists but has no associated expire`);
      } else if (ttl === -2) {
        this.logger.warn(`Key ${key} does not exist`);
      }
      return ttl;
    } catch (error) {
      this.logger.error(`Failed to get TTL for key ${key}: ${error.message}`);
      throw error;
    }
  }

  async ping(): Promise<void> {
    try {
      const response = await this.redis.ping();
      if (response !== 'PONG') {
        throw new Error('Unexpected response from Redis');
      }
    } catch (error) {
      this.logger.error(`Failed to ping Redis: ${error.message}`);
      throw error;
    }
  }

  async scanPattern(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [newCursor, foundKeys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      cursor = newCursor;
      keys.push(...foundKeys);
    } while (cursor !== '0');

    return keys;
  }

  async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [newCursor, scanKeys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      );
      cursor = newCursor;
      keys.push(...scanKeys);
    } while (cursor !== '0');

    return keys;
  }
}
