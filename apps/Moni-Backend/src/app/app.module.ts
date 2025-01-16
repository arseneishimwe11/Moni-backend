import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '@moni-backend/redis';
import { HealthModule } from './modules/health/health.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { LoggingModule } from './modules/logging/logging.module';
import { ServiceDiscoveryModule } from './modules/discovery/discovery.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { LoadBalancerModule } from './modules/loadbalancer/loadbalancer.module';
import { SystemController } from './controllers/system.controller';
import { SystemService } from './services/system.service';
import { HealthService } from './modules/health/services/health.service';
import { systemConfig } from './config/system.config';
import { DiscoveryService } from './modules/discovery/services/discovery.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [systemConfig],
    }),
    RedisModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        entities: ['dist/**/*.entity{.ts,.js}'],
        synchronize: configService.get('NODE_ENV') !== 'production',
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    HealthModule,
    HttpModule,
    MetricsModule,
    LoggingModule,
    ServiceDiscoveryModule,
    MonitoringModule,
    LoadBalancerModule,
  ],
  controllers: [SystemController],
  providers: [SystemService, HealthService, DiscoveryService],
})
export class AppModule {}
