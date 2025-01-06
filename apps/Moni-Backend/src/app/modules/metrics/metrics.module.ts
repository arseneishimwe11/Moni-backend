import { Module } from '@nestjs/common';
import { MetricsService } from './services/metrics.service';
import { RedisModule } from '@moni-backend/redis';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register(),
    RedisModule
  ],
  providers: [MetricsService],
  exports: [MetricsService]
})
export class MetricsModule {}
