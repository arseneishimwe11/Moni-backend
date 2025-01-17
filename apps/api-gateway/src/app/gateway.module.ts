import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { RedisModule } from '@moni-backend/redis';
import { RateLimiterGuard } from './guards/rate-limiter.guard';
import { ProxyService } from './services/proxy.service';
import configs from 'config/config';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configs],
    }),
    ClientsModule.registerAsync([
      {
        name: 'AUTH_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')],
            queue: 'auth_queue',
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'USER_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')],
            queue: 'user_queue',
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'TRANSACTION_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')],
            queue: 'transaction_queue',
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'NOTIFICATION_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')],
            queue: 'notification_queue',
          },
        }),
        inject: [ConfigService],
      },
      {
        name: 'AUDIT_SERVICE',
        imports: [ConfigModule],
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
      {
        name: 'KAFKA_CLIENT',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'moni-gateway',
              brokers: configService.get<string>('KAFKA_BROKERS').split(','),
            },
            consumer: {
              groupId: 'gateway-group'
            }
          }
        }),
        inject: [ConfigService],
      }
    ]),

    RedisModule,
    HttpModule,
  ],
  controllers: [GatewayController],
  providers: [GatewayService, ProxyService, RateLimiterGuard],
})
export class GatewayModule {}
