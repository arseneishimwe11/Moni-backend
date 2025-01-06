import { Injectable, Logger } from '@nestjs/common';
import { LoadBalancingStrategy, LoadBalancerMetrics } from '../interfaces/load-balancing.interface';
import { ServiceInstance } from '../../discovery/interfaces/service-registry.interface';
import { RedisService } from '@moni-backend/redis';

@Injectable()
export class LeastConnectionStrategy implements LoadBalancingStrategy {
  private readonly logger = new Logger(LeastConnectionStrategy.name);
  private metrics: LoadBalancerMetrics;

  constructor(private readonly redisService: RedisService) {
    this.initializeMetrics();
  }

  async getNext(instances: ServiceInstance[]): Promise<ServiceInstance> {
    const activeInstances = instances.filter(
      (instance) => instance.status === 'active'
    );

    if (!activeInstances.length) {
      throw new Error('No active instances available');
    }

    const instancesWithConnections = await Promise.all(
      activeInstances.map(async (instance) => ({
        instance,
        connections: await this.getActiveConnections(instance.id),
      }))
    );

    const selected = instancesWithConnections.reduce((min, current) =>
      current.connections < min.connections ? current : min
    );

    await this.updateInstanceMetrics(selected.instance.id);
    return selected.instance;
  }

  getName(): string {
    return 'least-connection';
  }

  async getMetrics(): Promise<LoadBalancerMetrics> {
    return this.metrics;
  }

  private async getActiveConnections(instanceId: string): Promise<number> {
    const connections = await this.redisService.cacheGet<number>(
      `connections:${instanceId}`
    );
    return connections || 0;
  }

  private async updateInstanceMetrics(instanceId: string): Promise<void> {
    const key = `metrics:${instanceId}`;
    const currentMetrics = (await this.redisService.cacheGet<{
      connections: number;
      requests: number;
    }>(key)) || { connections: 0, requests: 0 };

    await this.redisService.cacheSet(
      key,
      {
        ...currentMetrics,
        connections: currentMetrics.connections + 1,
        requests: currentMetrics.requests + 1,
        lastUsed: new Date(),
      },
      3600
    );
  }
  private initializeMetrics(): void {
    this.metrics = {
      strategy: this.getName(),
      totalRequests: 0,
      activeConnections: 0,
      instanceMetrics: [],
    };
  }
}
