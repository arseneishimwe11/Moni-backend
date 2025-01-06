import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@moni-backend/redis';
import { ServiceRegistration, ServiceHealth, ServiceInstance, HealthStatus } from '../interfaces/service-registry.interface';
import { v4 as uuidv4 } from 'uuid';
import { Interval } from '@nestjs/schedule';

@Injectable()
export class ServiceDiscoveryService implements OnModuleInit {
  private readonly logger = new Logger(ServiceDiscoveryService.name);
  private readonly services = new Map<string, ServiceInstance[]>();
  private readonly healthCheckInterval = 30000;
  private readonly serviceTimeout = 90000;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService
  ) {}

  async onModuleInit() {
    await this.loadServicesFromRedis();
    this.startHealthChecks();
  }

  async registerService(
    registration: ServiceRegistration
  ): Promise<ServiceInstance> {
    const instance: ServiceInstance = {
      id: uuidv4(),
      name: registration.name,
      host: registration.host,
      port: registration.port,
      status: 'active',
      lastHeartbeat: new Date(),
      metadata: {
        version: registration.version,
        region: registration.metadata.region as string,
        environment: this.configService.get('NODE_ENV'),
        cpuUsage: registration.metadata.cpuUsage as number,
        memoryUsage: registration.metadata.memoryUsage as number,
      },
    };

    const key = this.getServiceKey(instance);
    await this.redisService.cacheSet(key, instance, 120);

    const instances = this.services.get(registration.name) || [];
    instances.push(instance);
    this.services.set(registration.name, instances);

    this.logger.log(
      `Service registered: ${registration.name} (${instance.id})`
    );
    return instance;
  }

  async deregisterService(
    serviceName: string,
    instanceId: string
  ): Promise<void> {
    const key = `service:${serviceName}:${instanceId}`;
    await this.redisService.cacheDelete(key);

    const instances = this.services.get(serviceName) || [];
    const updatedInstances = instances.filter((i) => i.id !== instanceId);
    this.services.set(serviceName, updatedInstances);

    this.logger.log(`Service deregistered: ${serviceName} (${instanceId})`);
  }

  async getServiceInstances(serviceName: string): Promise<ServiceInstance[]> {
    const pattern = `service:${serviceName}:*`;
    const instances = await this.redisService.scanPattern(pattern);
    return instances.map((instance) => JSON.parse(instance));
  }

  async updateHeartbeat(
    serviceName: string,
    instanceId: string
  ): Promise<void> {
    const key = `service:${serviceName}:${instanceId}`;
    const instance = await this.redisService.cacheGet<ServiceInstance>(key);

    if (instance) {
      instance.lastHeartbeat = new Date();
      await this.redisService.cacheSet(key, instance, 120);
    }
  }

  async checkServiceHealth(serviceName: string): Promise<ServiceHealth[]> {
    const instances = await this.getServiceInstances(serviceName);
    return Promise.all(
      instances.map(async (instance) => {
        const health = await this.checkInstanceHealth(instance);
        const now = new Date();

        const healthStatus: ServiceHealth = {
          serviceName: instance.name,
          status: health ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
          timestamp: now,
          metrics: {
            cpuUsage: instance.metadata.cpuUsage,
            memoryUsage: instance.metadata.memoryUsage,
            responseTime: 0,
            throughput: 0,
            errorRate: 0,
            requestCount: 0,
            errorCount: 0,
            cpu: 0,
            memory: 0,
            requests: 0,
            latency: 0
          },
          recentIssues: [],
          details: undefined,
        };

        return healthStatus;
      })
    );
  }

  @Interval(30000)
  private async startHealthChecks() {
    for (const [serviceName, instances] of this.services.entries()) {
      for (const instance of instances) {
        const isHealthy = await this.checkInstanceHealth(instance);

        if (!isHealthy) {
          this.logger.warn(
            `Unhealthy service detected: ${serviceName} (${instance.id})`
          );
          await this.handleUnhealthyInstance(serviceName, instance.id);
        }
      }
    }
  }

  private async checkInstanceHealth(
    instance: ServiceInstance
  ): Promise<boolean> {
    const timeSinceLastHeartbeat =
      Date.now() - new Date(instance.lastHeartbeat).getTime();
    return timeSinceLastHeartbeat < this.serviceTimeout;
  }

  private async handleUnhealthyInstance(
    serviceName: string,
    instanceId: string
  ): Promise<void> {
    await this.deregisterService(serviceName, instanceId);
  }

  private async loadServicesFromRedis(): Promise<void> {
    const pattern = 'service:*';
    const services = await this.redisService.scanPattern(pattern);

    for (const service of services) {
      const instance = JSON.parse(service);
      const instances = this.services.get(instance.name) || [];
      instances.push(instance);
      this.services.set(instance.name, instances);
    }
  }

  private getServiceKey(instance: ServiceInstance): string {
    return `service:${instance.name}:${instance.id}`;
  }
}
