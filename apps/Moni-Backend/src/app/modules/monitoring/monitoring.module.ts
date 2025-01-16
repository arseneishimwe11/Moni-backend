import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MetricsModule } from '../metrics/metrics.module';
import { RedisModule } from '@moni-backend/redis';
import { BullModule } from '@nestjs/bull';
import { DiscoveryModule } from '@nestjs/core';
import { MonitoringService } from './services/monitoring.service';
import { AlertingService } from './services/alerting.service';
import { MetricsCollectorService } from './services/metrics-collector.service';
import { MonitoringProcessor } from './processors/monitoring-processor.processor';
import { LoggingService } from '../logging/services/logging.service';
import { MetricsService } from '../metrics/services/metrics.service';
import { AlertingModule } from '../alerting/services/alerting.module';

@Module({
  imports: [
    MetricsModule,
    ConfigModule,
    DiscoveryModule,
    RedisModule,
    AlertingModule,
    ClientsModule.registerAsync([
      {
        name: 'AUDIT_SERVICE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')],
            queue: 'audit_queue',
            queueOptions: { durable: true },
          },
        }),
        inject: [ConfigService],
      },
    ]),
    BullModule.registerQueue({
      name: 'monitoring',
    }),
  ],
  providers: [
    AlertingService,
    LoggingService,
    MetricsCollectorService,
    MonitoringProcessor,
    MonitoringService,
    MetricsService,
  ],
  exports: [MonitoringService],
})
export class MonitoringModule {}
