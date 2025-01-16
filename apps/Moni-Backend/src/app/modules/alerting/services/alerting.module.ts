import { RedisModule } from "@moni-backend/redis";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { AlertingService } from "./alerting.service";

@Module({
    imports: [
      RedisModule,
      ClientsModule.registerAsync([
        {
          name: 'NOTIFICATION_SERVICE',
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
          useFactory: (configService: ConfigService) => ({
            transport: Transport.RMQ,
            options: {
              urls: [configService.get<string>('RABBITMQ_URL')],
              queue: 'audit_queue',
            },
          }),
          inject: [ConfigService],
        },
      ]),
    ],
    providers: [AlertingService],
    exports: [AlertingService],
  })
  export class AlertingModule {}
  