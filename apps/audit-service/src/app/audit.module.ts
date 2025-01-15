import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';
import { AuditProcessor } from './processors/audit.processor';
import { RedisModule } from '@moni-backend/redis';
import configs from 'config/config';
import { AuditLogRepository } from './repository/audit-log.repository';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configs],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        entities: [AuditLog],
        synchronize: false,
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([AuditLog]),
    RedisModule,
    BullModule.registerQueue({
      name: 'audit-logs',
    }),
  ],
  controllers: [AuditController],
  providers: [AuditService, AuditLogRepository, AuditProcessor],
  exports: [AuditService],
})
export class AuditModule {}
