import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { LoggingService } from './services/logging.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '@moni-backend/redis';

@Module({
  imports: [
    ConfigModule,
    RedisModule,
    ClientsModule.registerAsync([
      {
        name: 'AUDIT_SERVICE',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')],
            queue: 'audit_queue',
            queueOptions: {
              durable: true,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [
    LoggingService,
    {
      provide: 'LOG_CONFIG',
      useValue: {
        retention: '7d',
        logLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        enableConsole: true,
        enableFile: true,
        logPath: 'logs/system',
      },
    },
  ],
  exports: [LoggingService],
})
export class LoggingModule {}
