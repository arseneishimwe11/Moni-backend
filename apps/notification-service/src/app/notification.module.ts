import { Module } from '@nestjs/common';
import { AppController } from './notification.controller';
import { AppService } from './notification.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
