import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { RedisService } from '@moni-backend/redis';

@Injectable()
export class RateLimiterGuard implements CanActivate {
  private readonly RATE_LIMIT = 100; // requests
  private readonly WINDOW_MS = 60000; // 1 minute

  constructor(private readonly redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const key = this.generateKey(request);

    const currentCount = (await this.redisService.cacheGet<number>(key)) || 0;

    if (currentCount >= this.RATE_LIMIT) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          retryAfter: await this.redisService.getTTL(key),
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    await this.redisService.cacheSet(
      key,
      currentCount + 1,
      Math.ceil(this.WINDOW_MS / 1000)
    );

    return true;
  }

  private generateKey(request: {
    headers: { [key: string]: string };
    ip: string;
  }): string {
    const identifier = request.headers['x-api-key'] || request.ip;
    return `system:ratelimit:${identifier}`;
  }
}
