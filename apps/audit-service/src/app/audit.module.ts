import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';
import { AuditProcessor } from './processors/audit.processor';
import { RedisModule } from '@moni-backend/redis';
import configs from 'config/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configs],
    }),
    TypeOrmModule.forFeature([AuditLog]),
    RedisModule,
    BullModule.registerQueue({
      name: 'audit-logs',
    }),
  ],
  controllers: [AuditController],
  providers: [AuditService, AuditProcessor],
  exports: [AuditService]
})
export class AuditModule {}
