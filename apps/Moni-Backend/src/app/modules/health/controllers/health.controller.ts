import { Controller, Get, Param } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { HealthService } from '../services/health.service';
import { DiscoveryService } from '../../discovery/services/discovery.service';
import { Logger } from '@nestjs/common';
import { ServiceHealth, HealthMetrics } from '../interfaces/health.interface';
import { RedisService } from '@moni-backend/redis';

interface ServiceMetrics {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
}

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly healthService: HealthService,
    private readonly discoveryService: DiscoveryService,
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redisService: RedisService
  ) {}

  @Get()
  @HealthCheck()
  async checkSystemHealth() {
    try {
      const redisCheck = async (): Promise<HealthIndicatorResult> => {
        try {
          await this.redisService.ping();
          return {
            redis: {
              status: 'up',
            },
          };
        } catch (e) {
          return {
            redis: {
              status: 'down',
              message: e.message,
            },
          };
        }
      };

      return await this.health.check([
        () => this.db.pingCheck('database'),
        redisCheck,
        () => this.healthService.checkMessageBroker(),
        async () => {
          const services = await this.discoveryService.getServiceInstances('*');
          const checks = await Promise.all(
            services.map((service) => this.healthService.checkService(service))
          );
          return { services: { status: 'up', checks } };
        },
      ]);
    } catch (error) {
      this.logger.error(`System health check failed: ${error.message}`);
      throw error;
    }
  }

  @Get('services/:serviceName')
  async checkServiceHealth(
    @Param('serviceName') serviceName: string
  ): Promise<ServiceHealth[]> {
    this.logger.debug(`Checking health for service: ${serviceName}`);

    const instances = await this.discoveryService.getServiceInstances(
      serviceName
    );

    return Promise.all(
      instances.map(async (instance) => {
        const healthCheckResult = await this.healthService.checkService(
          instance
        );
        const serviceMetrics: ServiceMetrics = {
          cpu: 0,
          memory: 0,
          disk: 0,
          network: 0,
        };

        const healthMetrics: HealthMetrics = {
          cpu: { usage: serviceMetrics.cpu, load: serviceMetrics.cpu },
          memory: {
            used: serviceMetrics.memory,
            total: 100,
            percentage: serviceMetrics.memory,
          },
          disk: {
            used: serviceMetrics.disk,
            total: 100,
            percentage: serviceMetrics.disk,
          },
          network: {
            connections: serviceMetrics.network,
            bytesIn: 0,
            bytesOut: 0,
          },
        };

        return {
          status: this.mapHealthCheckStatus(healthCheckResult.status),
          timestamp: new Date(),
          metrics: healthMetrics,
          details: {
            version: instance.metadata?.version,
            uptime: this.calculateUptime(instance.lastHeartbeat),
            environment: instance.metadata?.environment,
            region: instance.metadata?.region,
            instanceId: instance.id,
            host: instance.host,
            port: instance.port,
            ...healthCheckResult.details?.[instance.id]?.details,
          },
        };
      })
    );
  }

  private mapHealthCheckStatus(
    status: string
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const statusMap = {
      ok: 'healthy',
      error: 'unhealthy',
      warning: 'degraded',
    };
    return statusMap[status.toLowerCase()] || 'degraded';
  }

  private calculateUptime(lastHeartbeat: Date): number {
    return Math.floor((Date.now() - new Date(lastHeartbeat).getTime()) / 1000);
  }

  @Get('dependencies')
  @HealthCheck()
  async checkDependencies() {
    try {
      const redisCheck = async () => {
        try {
          await this.redisService.ping();
          return { redis: { status: 'up' } };
        } catch (e) {
          return { redis: { status: 'down', message: e.message } };
        }
      };

      return await this.health.check([
        () => this.db.pingCheck('database'),

        async () => {
          const redisStatus = await redisCheck();
          return {
            redis: {
              status: redisStatus.redis.status === 'up' ? 'up' : 'down',
              details: redisStatus.redis,
            },
          } as HealthIndicatorResult;
        },
        () => this.healthService.checkMessageBroker(),
        async () => {
          const result = await this.healthService.checkExternalDependencies();
          return {
            [result.name as unknown as string]: { status: result.status, ...result.details },
          } as HealthIndicatorResult;
        },
      ]);
    } catch (error) {
      this.logger.error(`Dependencies health check failed: ${error.message}`);
      throw error;
    }
  }
}
