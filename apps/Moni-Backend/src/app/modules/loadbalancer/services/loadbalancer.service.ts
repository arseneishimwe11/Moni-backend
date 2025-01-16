import { Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { DiscoveryService } from '../../discovery/services/discovery.service';
import { MetricsService } from '../../metrics/services/metrics.service';
import { RedisService } from '@moni-backend/redis';
import { LoadBalancingStrategy } from '../interfaces/load-balancing.interface';
import { ServiceInstance } from '../../discovery/interfaces/service-registry.interface';
import { RoundRobinStrategy } from '../strategies/round-robin.strategy';
import { WeightedRoundRobinStrategy } from '../strategies/weighted-round-robin.strategy';
import { LeastConnectionStrategy } from '../strategies/least-connection.strategy';

@Injectable()
export class LoadBalancerService {
  private readonly strategies: Map<string, LoadBalancingStrategy>;
  private readonly logger = new Logger(LoadBalancerService.name);
  private readonly METRICS_TTL = 60;

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metricsService: MetricsService,
    private readonly redisService: RedisService
  ) {
    this.strategies = this.initializeStrategies();
  }

  private initializeStrategies(): Map<string, LoadBalancingStrategy> {
    return new Map<string, LoadBalancingStrategy>([
      ['round-robin', new RoundRobinStrategy()],
      ['weighted', new WeightedRoundRobinStrategy()],
      ['least-connections', new LeastConnectionStrategy(this.redisService)],
    ]);
  }

  async getServiceInstance(
    serviceName: string,
    strategy = 'round-robin'
  ): Promise<ServiceInstance> {
    try {
      const instances = await this.discoveryService.getServiceInstances(
        serviceName
      );

      if (!instances.length) {
        throw new ServiceUnavailableException(
          `No instances available for service: ${serviceName}`
        );
      }

      const selectedStrategy = this.strategies.get(strategy);
      if (!selectedStrategy) {
        throw new BadRequestException(
          `Unsupported load balancing strategy: ${strategy}`
        );
      }

      const healthyInstances = instances.filter(
        (instance) => instance.status === 'active'
      );
      if (!healthyInstances.length) {
        throw new ServiceUnavailableException(
          `No healthy instances available for service: ${serviceName}`
        );
      }

      const instance = await selectedStrategy.getNext(healthyInstances);
      await this.updateInstanceMetrics(instance);

      return instance;
    } catch (error) {
      this.logger.error(`Failed to get service instance: ${error.message}`);
      throw error;
    }
  }

  private async updateInstanceMetrics(
    instance: ServiceInstance
  ): Promise<void> {
    const key = `loadbalancer:metrics:${instance.id}`;

    try {
      const currentConnections =
        (await this.redisService.cacheGet<number>(key)) || 0;
      await this.redisService.cacheSet(
        key,
        currentConnections + 1,
        this.METRICS_TTL
      );

      await this.metricsService.recordMetric({
        serviceName: instance.name,
        metricName: 'load_balancer_connections',
        value: currentConnections + 1,
        labels: {
          instance_id: instance.id,
          host: instance.host,
          service: instance.name,
          region: instance.metadata?.region,
        },
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.warn(
        `Failed to update metrics for instance ${instance.id}: ${error.message}`
      );
    }
  }
}
