import { SetMetadata, applyDecorators } from '@nestjs/common';
import { RateLimiterOptions } from '../interfaces/rate-limiter.interface';

export const RATE_LIMIT_KEY = 'rate_limit';

export function RateLimit(options: RateLimiterOptions) {
  return applyDecorators(
    SetMetadata(RATE_LIMIT_KEY, {
      limit: options.limit || 100,
      windowMs: options.windowMs || 900000, // 15 minutes default
      keyPrefix: options.keyPrefix || 'rate_limit',
      errorMessage:
        options.errorMessage || 'Too many requests, please try again later',
      skipFailedRequests: options.skipFailedRequests || false,
      handler: options.handler || undefined,
    })
  );
}
