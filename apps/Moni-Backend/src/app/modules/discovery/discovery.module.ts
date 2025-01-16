import { Module } from '@nestjs/common';
import { RedisModule } from '@moni-backend/redis';
import { HttpModule } from '@nestjs/axios';
import { ServiceDiscoveryService } from './services/service-discovery.service';

@Module({
  imports: [RedisModule, HttpModule],
  providers: [ServiceDiscoveryService],
  exports: [ServiceDiscoveryService],
})
export class ServiceDiscoveryModule {}
