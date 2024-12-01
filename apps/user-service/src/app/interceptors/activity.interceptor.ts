import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ClientProxy } from '@nestjs/microservices';
import { RedisService } from '@moni-backend/redis';

@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityInterceptor.name);

  constructor(
    @Inject('AUDIT_SERVICE') private readonly auditClient: ClientProxy,
    private readonly redisService: RedisService
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const { ip, method, url, user, headers } = request;
    const userAgent = headers['user-agent'];
    const startTime = Date.now();

    return next.handle().pipe(
      tap(async (response) => {
        try {
          const duration = Date.now() - startTime;
          
          if (user?.id) {
            const activityData = {
              userId: user.id,
              action: `${method} ${url}`,
              metadata: {
                method,
                endpoint: url,
                ipAddress: ip,
                userAgent,
                duration,
                statusCode: response?.statusCode || 200,
                timestamp: new Date()
              }
            };

            await this.auditClient.emit('user_activity', activityData).toPromise();

            const cacheKey = `user:${user.id}:last_activity`;
            await this.redisService.cacheSet(cacheKey, {
              timestamp: Date.now(),
              action: `${method} ${url}`,
              ip
            }, 86400);
          }
        } catch (error) {
          this.logger.error(`Failed to log activity: ${error.message}`, error.stack);
        }
      })
    );
  }
}
