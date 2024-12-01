import { Module } from '@nestjs/common';
import { AppController } from './audit.controller';
import { AppService } from './audit.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
