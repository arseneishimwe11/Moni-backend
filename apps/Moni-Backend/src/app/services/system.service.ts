import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@moni-backend/redis';
import { HealthService } from '../modules/health/services/health.service';
import { MetricsService } from '../modules/metrics/services/metrics.service';
import { DiscoveryService } from '../modules/discovery/services/discovery.service';
import { LoggingService } from '../modules/logging/services/logging.service';
import { SystemStatus, SystemMetrics, SystemConfig, ServiceRegistration } from '../interfaces/system.interface';

@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly healthService: HealthService,
    private readonly metricsService: MetricsService,
    private readonly discoveryService: DiscoveryService,
    private readonly loggingService: LoggingService
  ) {}

  async getSystemStatus(): Promise<SystemStatus> {
    const health = await this.healthService.checkSystemHealth();
    const metrics = await this.metricsService.getSystemMetrics();
    const services = await this.discoveryService.getRegisteredServices();

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (health.status === 'ok') {
      status = 'healthy';
    } else if (health.status === 'error') {
      status = 'unhealthy';
    } else {
      status = 'degraded';
    }

    return {
      status: status,
      uptime: process.uptime(),
      timestamp: new Date(),
      environment: this.configService.get('NODE_ENV'),
      version: this.configService.get('APP_VERSION'),
      region: this.configService.get('REGION'),
      services: {
        total: services.length,
        healthy: services.filter((s) => s.status === 'active').length,
        instances: services.map((service) => ({
          ...service,
          lastHeartbeat: new Date(service.lastHeartbeat),
        })),
      },
      metrics: {
        cpu: metrics.cpu,
        memory: metrics.memory,
        requests: metrics.requests,
        latency: metrics.latency,
      },
    };
  }
  async getSystemMetrics(query: {
    startDate: Date;
    endDate: Date;
    service?: string;
  }): Promise<SystemMetrics> {
    const metrics = await this.metricsService.queryMetrics({
      startTime: query.startDate.getTime(),
      endTime: query.endDate.getTime(),
      metricName: query.service ? `${query.service}_metrics` : 'system_metrics',
    });
    return metrics as unknown as SystemMetrics;
  }
  async getRegisteredServices(): Promise<ServiceRegistration[]> {
    const services = await this.discoveryService.getRegisteredServices();
    return services.map((service) => ({
      id: service.id,
      name: service.name,
      status: service.status,
      instances: service.instances,
      lastHeartbeat: new Date(service.lastHeartbeat),
      metadata: service.metadata,
    }));
  }

  // async registerService(serviceData: Omit<ServiceRegistration, 'instances'> & { version: string; host: string; port: number; healthCheckUrl: string }): Promise<ServiceRegistration> {
  //   const registeredService = await this.discoveryService.registerService({
  //     ...serviceData,
  //     instances: [{
  //       name: serviceData.name,
  //       host: serviceData.host,
  //       port: serviceData.port,
  //       healthCheckUrl: serviceData.healthCheckUrl,
  //       lastHeartbeat: new Date()
  //     }]
  //   });
  //   return registeredService;
  // }
  async getSystemConfig(): Promise<SystemConfig> {
    return {
      environment: this.configService.get('NODE_ENV'),
      region: this.configService.get('REGION'),
      services: this.configService.get('ENABLED_SERVICES'),
      features: this.configService.get('FEATURE_FLAGS'),
      limits: {
        rateLimit: this.configService.get('RATE_LIMIT'),
        maxConnections: this.configService.get('MAX_CONNECTIONS'),
        timeout: this.configService.get('REQUEST_TIMEOUT'),
      },
      security: {
        authEnabled: this.configService.get('AUTH_ENABLED'),
        apiKeyRequired: this.configService.get('API_KEY_REQUIRED'),
        corsEnabled: this.configService.get('CORS_ENABLED'),
      },
    } as SystemConfig;
  }
  async getSystemLogs(query: {
    page?: number;
    pageSize?: number;
    level?: string;
    service?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<unknown> {
    return this.loggingService.queryLogs(query);
  }

  async getSystemHealth(): Promise<unknown> {
    return this.healthService.checkSystemHealth();
  }
}
