import { Module } from '@nestjs/common';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './entity/transaction.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { RedisModule } from '@moni-backend/redis';
import { TransactionRepository } from './repositories/transaction.repository';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { ExchangeRateProvider } from './providers/exchange-rate.provider';
import { StripeProvider } from './providers/implementations/stripe.provider';
import { MomoProvider } from './providers/implementations/momo.provider';
import configs from 'config/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configs],
    }),
    TypeOrmModule.forFeature([Transaction]),
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: () => ({
        timeout: 5000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'MONI/1.0',
        },
      }),
      inject: [ConfigService],
    }),
    RedisModule,
    BullModule.registerQueue({ name: 'payments' }, { name: 'notifications' }),
  ],
  controllers: [TransactionController],
  providers: [
    TransactionService,
    TransactionRepository,
    PaymentProviderFactory,
    ExchangeRateProvider,
    StripeProvider,
    MomoProvider,
  ],
  exports: [TransactionService],
})
export class TransactionModule {}
