import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '@moni-backend/redis';
import { RATE_LIMIT_KEY } from '../decorators/rate-limiter.decorator';
import { RateLimiterOptions } from '../interfaces/rate-limiter.interface';

@Injectable()
export class RateLimiterGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rateLimitOptions = this.reflector.get<RateLimiterOptions>(
      RATE_LIMIT_KEY,
      context.getHandler()
    );

    if (!rateLimitOptions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const key = this.generateKey(request, rateLimitOptions.keyPrefix);
    const limit = rateLimitOptions.limit;
    const windowMs = rateLimitOptions.windowMs;

    const currentCount = (await this.redisService.cacheGet<number>(key)) || 0;

    if (currentCount >= limit) {
      const retryAfter = await this.redisService.getTTL(key);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: rateLimitOptions.errorMessage || 'Rate limit exceeded',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    await this.redisService.cacheSet(
      key,
      currentCount + 1,
      Math.ceil(windowMs / 1000)
    );
    return true;
  }

  private generateKey(
    request: {
      user?: { id?: string };
      headers: Record<string, string>;
      ip: string;
      route: { path: string };
    },
    keyPrefix?: string
  ): string {
    const identifier =
      request.user?.id ||
      request.headers['x-forwarded-for'] ||
      request.ip ||
      'anonymous';
    const path = request.route.path;
    return `${keyPrefix || 'rate_limit'}:${identifier}:${path}`;
  }
}
