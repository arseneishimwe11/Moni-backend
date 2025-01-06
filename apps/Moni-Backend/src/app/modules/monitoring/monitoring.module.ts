import { Module } from "@nestjs/common";
import { MetricsModule } from "../metrics/metrics.module";
import { RedisModule } from "@moni-backend/redis";
import { BullModule } from "@nestjs/bull";
import { DiscoveryModule } from "@nestjs/core";
import { MonitoringService } from "./services/monitoring.service";
import { AlertingService } from "./services/alerting.service";
import { MetricsCollectorService } from "./services/metrics-collector.service";
import { MonitoringProcessor } from "./processors/monitoring-processor.processor";


@Module({
    imports: [
      MetricsModule,
      DiscoveryModule,
      RedisModule,
      BullModule.registerQueue({
        name: 'monitoring',
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000
          }
        }
      })
    ],
    providers: [
      MonitoringService,
      AlertingService,
      MetricsCollectorService,
      MonitoringProcessor
    ],
    exports: [MonitoringService]
  })
  export class MonitoringModule {}
  