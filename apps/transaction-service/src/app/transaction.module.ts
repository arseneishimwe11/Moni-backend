import { Module } from '@nestjs/common';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { PaymentProcessor } from './queue/payment.processor';
import { RedisModule } from '@moni-backend/redis'
import configs from 'config/config';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configs],
    }),
    HttpModule,
    RedisModule,
    BullModule.registerQueue({
      name: 'payments',
    }),
  ],
  controllers: [TransactionController],
  providers: [TransactionService, PaymentProcessor],
})
export class TransactionModule {}
