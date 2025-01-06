import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import { ServiceInstance } from '../interfaces/service-registry.interface';
import { RedisService } from '@moni-backend/redis';
import { v4 as uuidv4 } from 'uuid';
import { ServiceRegistration } from '../interfaces/service-registry.interface';

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);
  private readonly services = new Map<string, ServiceInstance[]>();
  heartbeatTimeout: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService
  ) {}

  async registerService(registration: ServiceRegistration): Promise<void> {
    const instance: ServiceInstance = {
      name: registration.name,
      id: uuidv4(),
      host: registration.host,
      port: registration.port,
      status: 'active',
      lastHeartbeat: new Date(),
      metadata: {
        version: registration.metadata.version as string,
        region: registration.metadata.region as string,
        environment: registration.metadata.environment as string,
        cpuUsage: registration.metadata.cpuUsage as number,
        memoryUsage: registration.metadata.memoryUsage as number,
      },
    };

    const key = `service:${registration.name}:${instance.id}`;
    await this.redisService.cacheSet(key, instance, 30);

    const instances = this.services.get(registration.name) || [];
    instances.push(instance);
    this.services.set(registration.name, instances);
  }
  async getServiceInstances(serviceName: string): Promise<ServiceInstance[]> {
    const pattern = `service:${serviceName}:*`;
    const instances = await this.redisService.scanPattern(pattern);
    return instances.map((instance: string) => JSON.parse(instance));
  }

  async updateHeartbeat(
    serviceName: string,
    instanceId: string
  ): Promise<void> {
    const key = `service:${serviceName}:${instanceId}`;
    const instance = await this.redisService.cacheGet<ServiceInstance>(key);

    if (instance) {
      instance.lastHeartbeat = new Date();
      await this.redisService.cacheSet(key, instance, 30);
    }
  }

  async getRegisteredServices(): Promise<ServiceRegistration[]> {
    const servicesKey = 'services:registry';
    const services =
      (await this.redisService.cacheGet<ServiceRegistration[]>(servicesKey)) ||
      [];
    return services.filter(
      (service) =>
        Date.now() - new Date(service.lastHeartbeat).getTime() <
        this.heartbeatTimeout
    );
  }
}
