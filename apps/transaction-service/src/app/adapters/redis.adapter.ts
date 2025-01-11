import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@moni-backend/redis';

@Injectable()
export class RedisAdapter {
  private readonly logger = new Logger(RedisAdapter.name);
  private readonly prefix = 'transaction:';
  private readonly defaultTTL = 3600; // 1 hour

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService
  ) {}

  async cacheTransaction(key: string, data: unknown): Promise<void> {
    const cacheKey = `${this.prefix}${key}`;
    await this.redisService.cacheSet(cacheKey, data, this.defaultTTL);
    this.logger.debug(`Cached transaction data: ${cacheKey}`);
  }
  async getCachedTransaction<T>(key: string): Promise<T | null> {
    const cacheKey = `${this.prefix}${key}`;
    return this.redisService.cacheGet<T>(cacheKey);
  }

  async invalidateCache(key: string): Promise<void> {
    const cacheKey = `${this.prefix}${key}`;
    await this.redisService.cacheDelete(cacheKey);
    this.logger.debug(`Invalidated cache: ${cacheKey}`);
  }

  async checkRateLimit(key: string, limit = 5, window = 300): Promise<boolean> {
    const rateLimitKey = `${this.prefix}ratelimit:${key}`;
    return this.redisService.checkRateLimit(rateLimitKey, limit, window);
  }
  async setLock(key: string, ttl = 30): Promise<boolean> {
    const lockKey = `${this.prefix}lock:${key}`;
    return this.redisService.setLock(lockKey, ttl);
  }
  async releaseLock(key: string): Promise<void> {
    const lockKey = `${this.prefix}lock:${key}`;
    await this.redisService.releaseLock(lockKey);
  }
}
