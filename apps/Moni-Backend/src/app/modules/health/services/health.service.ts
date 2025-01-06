import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@moni-backend/redis';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { HealthIndicatorResult, HealthCheckResult, HealthCheckStatus } from '@nestjs/terminus';
import { ServiceInstance } from '../../discovery/interfaces/service-registry.interface';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly redisService: RedisService,
    @InjectConnection() private readonly dbConnection: Connection,
    private readonly httpService: HttpService
  ) {}

  async checkService(instance: ServiceInstance): Promise<HealthCheckResult> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${instance.host}:${instance.port}/health`)
      );

      return {
        status: response.status === 200 ? 'ok' : 'error',
        details: {
          [instance.id]: {
            status: response.status === 200 ? 'up' : 'down',
            details: {
              instanceId: instance.id,
              host: instance.host,
              port: instance.port,
              lastCheck: new Date(),
              responseTime: response.data?.responseTime,
            },
          },
        },
      };
    } catch (error) {
      this.logger.error(
        `Health check failed for instance ${instance.id}`,
        error.stack
      );
      return {
        status: 'error',
        details: {
          [instance.id]: {
            status: 'down',
            error: error.message,
            details: {
              instanceId: instance.id,
              host: instance.host,
              port: instance.port,
              lastCheck: new Date(),
            },
          },
        },
      };
    }
  }
  async checkRedis(): Promise<HealthIndicatorResult> {
    try {
      await this.redisService.ping();
      return {
        redis: {
          status: 'up',
        },
      };
    } catch (error) {
      this.logger.error('Redis health check failed', error.stack);
      return {
        redis: {
          status: 'down',
          error: error.message,
        },
      };
    }
  }

  async checkDatabase(): Promise<HealthIndicatorResult> {
    try {
      await this.dbConnection.query('SELECT 1');
      return {
        database: {
          status: 'up',
        },
      };
    } catch (error) {
      this.logger.error('Database health check failed', error.stack);
      return {
        database: {
          status: 'down',
          error: error.message,
        },
      };
    }
  }

  async checkMessageBroker(): Promise<HealthIndicatorResult> {
    try {
      // Implement message broker health check
      return {
        messageBroker: {
          status: 'up',
        },
      };
    } catch (error) {
      return {
        messageBroker: {
          status: 'down',
          error: error.message,
        },
      };
    }
  }

  async checkExternalDependencies(): Promise<HealthIndicatorResult> {
    const services = {
      'payment-gateway': process.env.PAYMENT_GATEWAY_URL,
      'notification-service': process.env.NOTIFICATION_SERVICE_URL,
    };

    const results = {};
    for (const [name, url] of Object.entries(services)) {
      results[name] = await this.pingService(url);
    }
    return results;
  }

  async getServiceMetrics(serviceId: string) {
    return {
      responseTime: await this.getAverageResponseTime(serviceId),
      uptime: await this.getServiceUptime(serviceId),
      lastCheck: new Date(),
      status: 'healthy',
    };
  }

  private async pingService(
    url: string
  ): Promise<{ status: string; responseTime?: number }> {
    try {
      const startTime = Date.now();
      await firstValueFrom(this.httpService.get(url));
      return {
        status: 'up',
        responseTime: Date.now() - startTime,
      };
    } catch {
      return { status: 'down' };
    }
  }

  async checkSystemHealth(): Promise<HealthCheckResult> {
    const results = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkMessageBroker(),
      this.checkExternalDependencies()
    ]);
  
    const status = results.every(r => Object.values(r)[0].status === 'up') ? 'healthy' : 'unhealthy';
    const info = results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
  
    return {
      status: status as HealthCheckStatus,
      info,
      details: info
    };
  }  private async getAverageResponseTime(serviceId: string): Promise<number> {    const key = `metrics:${serviceId}:responseTime`;
    const times = (await this.redisService.cacheGet<number[]>(key)) || [];
    return times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  }

  private async getServiceUptime(serviceId: string): Promise<number> {
    const key = `metrics:${serviceId}:uptime`;
    const startTime = await this.redisService.cacheGet<number>(key);
    return startTime ? Date.now() - startTime : 0;
  }
}
