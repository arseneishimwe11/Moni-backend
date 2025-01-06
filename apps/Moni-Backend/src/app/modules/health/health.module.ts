import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { RedisModule } from '@moni-backend/redis';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './controllers/health.controller';
import { HealthService } from './services/health.service';
import { DiscoveryModule } from '@nestjs/core';

@Module({
  imports: [
    TerminusModule,
    HttpModule,
    RedisModule,
    TypeOrmModule,
    DiscoveryModule
  ],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService]
})
export class HealthModule {}
