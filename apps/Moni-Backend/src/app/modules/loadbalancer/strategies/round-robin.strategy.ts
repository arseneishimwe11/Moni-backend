import { Injectable, Logger } from '@nestjs/common';
import { LoadBalancingStrategy, LoadBalancerMetrics } from '../interfaces/load-balancing.interface';
import { ServiceInstance } from '../../discovery/interfaces/service-registry.interface';

@Injectable()
export class RoundRobinStrategy implements LoadBalancingStrategy {
  private readonly logger = new Logger(RoundRobinStrategy.name);
  private currentIndex = 0;
  private metrics: LoadBalancerMetrics;

  constructor() {
    this.initializeMetrics();
  }

  async getNext(instances: ServiceInstance[]): Promise<ServiceInstance> {
    const activeInstances = instances.filter(
      (instance) => instance.status === 'active'
    );

    if (!activeInstances.length) {
      throw new Error('No active instances available');
    }

    const selected =
      activeInstances[this.currentIndex % activeInstances.length];
    this.currentIndex = (this.currentIndex + 1) % activeInstances.length;

    await this.updateMetrics(selected);
    return selected;
  }
  getName(): string {
    return 'round-robin';
  }

  async getMetrics(): Promise<LoadBalancerMetrics> {
    return this.metrics;
  }

  async updateMetrics(instance: ServiceInstance): Promise<void> {
    this.metrics.totalRequests++;
    const instanceMetric = this.metrics.instanceMetrics.find(
      (m) => m.instanceId === instance.id
    );

    if (instanceMetric) {
      instanceMetric.successfulRequests++;
      instanceMetric.lastUsed = new Date();
    } else {
      this.metrics.instanceMetrics.push({
        instanceId: instance.id,
        activeConnections: 1,
        successfulRequests: 1,
        failedRequests: 0,
        averageResponseTime: 0,
        lastUsed: new Date(),
      });
    }
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
