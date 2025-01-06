import { Injectable, Logger } from '@nestjs/common';
import { LoadBalancingStrategy, LoadBalancerMetrics } from '../interfaces/load-balancing.interface';
import { ServiceInstance } from '../../discovery/interfaces/service-registry.interface';

@Injectable()
export class WeightedRoundRobinStrategy implements LoadBalancingStrategy {
  private readonly logger = new Logger(WeightedRoundRobinStrategy.name);
  private currentWeights: Map<string, number> = new Map();
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

    let totalWeight = 0;
    let maxWeightInstance: ServiceInstance | null = null;
    let maxWeight = -1;

    activeInstances.forEach((instance) => {
      const weight = this.calculateWeight(instance);
      const currentWeight =
        (this.currentWeights.get(instance.id) || 0) + weight;
      this.currentWeights.set(instance.id, currentWeight);

      totalWeight += weight;

      if (currentWeight > maxWeight) {
        maxWeight = currentWeight;
        maxWeightInstance = instance;
      }
    });

    if (!maxWeightInstance) {
      throw new Error('Failed to select instance');
    }

    this.currentWeights.set(
      maxWeightInstance.id,
      (this.currentWeights.get(maxWeightInstance.id) || 0) - totalWeight
    );

    await this.updateMetrics(maxWeightInstance);
    return maxWeightInstance;
  }
  getName(): string {
    return 'weighted-round-robin';
  }

  async getMetrics(): Promise<LoadBalancerMetrics> {
    return this.metrics;
  }

  private calculateWeight(instance: ServiceInstance): number {
    const baseWeight = 100;
    const cpuWeight = instance.metadata?.cpuUsage
      ? Math.max(0, 100 - instance.metadata.cpuUsage)
      : 100;
    const memoryWeight = instance.metadata?.memoryUsage
      ? Math.max(0, 100 - instance.metadata.memoryUsage)
      : 100;

    return Math.floor(baseWeight * (cpuWeight / 100) * (memoryWeight / 100));
  }

  async updateMetrics(instance: ServiceInstance): Promise<void> {
    this.metrics.totalRequests++;
    const instanceMetric = this.metrics.instanceMetrics.find(
      (m) => m.instanceId === instance.id
    );

    if (instanceMetric) {
      instanceMetric.successfulRequests++;
      instanceMetric.lastUsed = new Date();
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
