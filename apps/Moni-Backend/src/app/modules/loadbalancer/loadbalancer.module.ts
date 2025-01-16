import { Module } from '@nestjs/common';
import { LoadBalancerService } from './services/loadbalancer.service';
import { RoundRobinStrategy } from './strategies/round-robin.strategy';
import { WeightedRoundRobinStrategy } from './strategies/weighted-round-robin.strategy';
import { LeastConnectionStrategy } from './strategies/least-connection.strategy';;
import { ServiceDiscoveryModule } from '../discovery/discovery.module';
import { MetricsModule } from '../metrics/metrics.module';
import { RedisModule } from '@moni-backend/redis';
import { DiscoveryService } from '../discovery/services/discovery.service';

@Module({
  imports: [
    ServiceDiscoveryModule,
    MetricsModule,
    RedisModule,
  ],
  providers: [
    LoadBalancerService,
    DiscoveryService,
    RoundRobinStrategy,
    WeightedRoundRobinStrategy,
    LeastConnectionStrategy
  ],
  exports: [LoadBalancerService]
})
export class LoadBalancerModule {}
