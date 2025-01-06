import { Module } from '@nestjs/common';
import { LoggingService } from './services/logging.service';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '@moni-backend/redis';

@Module({
  imports: [
    ConfigModule,
    RedisModule
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
        logPath: 'logs/system'
      }
    }
  ],
  exports: [LoggingService]
})
export class LoggingModule {}
