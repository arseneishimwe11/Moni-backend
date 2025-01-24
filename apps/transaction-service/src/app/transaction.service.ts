import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { MessagePattern } from '@nestjs/microservices';
import { Queue } from 'bull';
import { PaymentDto, PaymentStatus, PaymentProvider } from './dto/payment.dto';
import { ConfigService } from '@nestjs/config';
import { TransactionRepository } from './repositories/transaction.repository';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { PaymentProcessingException } from './exceptions/payment-processing.exception';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentResult } from './providers/interfaces/payment-provider.interface';
import { BatchPaymentDto, BatchPaymentResult } from './dto/batch-payment.dto';
import { TransactionStatisticsDto } from './dto/transaction-statistics.dto';
import { CreateDisputeDto, DisputeResult } from './dto/create-dispute.dto';
import { TransactionStats } from './interfaces/transaction-stats.interface';
import { PaymentLimits, PaymentMethod } from './interfaces/payment-method.interface';
import { ExchangeRate } from './interfaces/exchange-rate.interface';
import { ExchangeRateProviderInterface } from './interfaces/exchange-rate-provider.interface';
import { ExchangeRateException } from './exceptions/exchange-rate.exception';
import { RedisService } from '@moni-backend/redis';

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    private configService: ConfigService,
    @InjectQueue('payments') private paymentQueue: Queue,
    @InjectQueue('notifications') private readonly notificationQueue: Queue,
    private transactionRepository: TransactionRepository,
    private paymentProviderFactory: PaymentProviderFactory,
    private readonly redisService: RedisService,
    @Inject('EXCHANGE_RATE_PROVIDER')
    private readonly exchangeRateProvider: ExchangeRateProviderInterface,
  ) {}

  async createPayment(paymentDto: PaymentDto) {
    this.logger.log(
      `Creating payment for transaction ${paymentDto.transactionId}`
    );

    const transaction = await this.transactionRepository.createTransaction({
      ...paymentDto,
      status: PaymentStatus.PENDING,
      createdAt: new Date(),
    });

    try {
      const provider = this.paymentProviderFactory.getProvider(
        paymentDto.region === 'AO' || paymentDto.region === 'CG'
          ? PaymentProvider.MOMO
          : PaymentProvider.STRIPE
      );

      await this.paymentQueue.add(
        'process-payment',
        {
          transactionId: transaction.id,
          paymentData: paymentDto,
          provider: provider,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
        }
      );

      await this.notificationQueue.add('payment-notification', {
        transactionId: transaction.id,
        amount: paymentDto.amount,
        currency: paymentDto.currency,
        timestamp: new Date()
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true
      });

      return { transactionId: transaction.id, status: PaymentStatus.PENDING };
      
    } catch (error) {
      this.logger.error(
        `Payment creation failed: ${error.message}`,
        error.stack
      );
      await this.transactionRepository.updateTransaction(transaction.id, {
        status: PaymentStatus.FAILED,
        errorDetails: error.message,
      });
      throw new PaymentProcessingException(error.message);
    }
  }
  
  @MessagePattern('payments.processed')
  async handlePaymentProcessed(data: Record<string, unknown>) {
    await this.transactionRepository.updateTransaction(data.transactionId as string, {
      status: data.status as PaymentStatus,
      processedAt: new Date()
    });
  }
  async getPaymentStatus(transactionId: string) {
    const transaction = await this.transactionRepository.findById(
      transactionId
    );
    if (!transaction) {
      throw new PaymentProcessingException('Transaction not found');
    }
    return transaction;
  }

  async refundPayment(transactionId: string, amount?: number) {
    const transaction = await this.transactionRepository.findById(
      transactionId
    );
    if (!transaction) {
      throw new PaymentProcessingException('Transaction not found');
    }

    const provider = this.paymentProviderFactory.getProvider(
      transaction.paymentMethod
    );
    const refundResult = await provider.refundPayment(transactionId, amount);

    await this.transactionRepository.updateTransaction(transactionId, {
      status: PaymentStatus.REFUNDED,
      refundDetails: { ...refundResult },
    });

    return refundResult;
  }

  async getTransactionsByCustomer(customerId: string) {
    return this.transactionRepository.findByCustomerId(customerId);
  }

  async getTransactionsByDateRange(startDate: Date, endDate: Date) {
    return this.transactionRepository.findByDateRange(startDate, endDate);
  }

  async cancelPayment(transactionId: string) {
    const transaction = await this.transactionRepository.findById(
      transactionId
    );
    if (!transaction) {
      throw new PaymentProcessingException('Transaction not found');
    }

    if (transaction.status !== PaymentStatus.PENDING) {
      throw new PaymentProcessingException('Transaction cannot be cancelled');
    }

    await this.transactionRepository.updateTransaction(transactionId, {
      status: PaymentStatus.CANCELED,
      updatedAt: new Date(),
    });

    return { transactionId, status: PaymentStatus.CANCELED };
  }

  async verifyPayment(verifyDto: VerifyPaymentDto): Promise<PaymentResult> {
    const transaction = await this.transactionRepository.findById(
      verifyDto.transactionId
    );
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const provider = this.paymentProviderFactory.getProvider(
      transaction.paymentMethod
    );

    const verificationResult = await provider.verifyPayment(
      verifyDto.verificationToken
    );

    await this.transactionRepository.updateTransaction(transaction.id, {
      status: verificationResult.status,
      metadata: {
        ...transaction.metadata,
        verificationDetails: verificationResult,
        verifiedAt: new Date(),
      },
    });

    return verificationResult;
  }
  async getAvailablePaymentMethods(region: string): Promise<PaymentMethod[]> {
    const providers = Object.values(PaymentProvider);
    const availableMethods = providers.filter((provider) => {
      const paymentProvider = this.paymentProviderFactory.getProvider(provider);
      return paymentProvider.supportedRegions.includes(region);
    });

    return availableMethods.map((provider) => ({
      provider,
      supportedCurrencies:
        this.paymentProviderFactory.getProvider(provider).supportedCurrencies,
      limits: this.getProviderLimits(provider, region),
    }));
  }

  async createBatchPayments(
    batchPaymentDto: BatchPaymentDto
  ): Promise<BatchPaymentResult> {
    const results = {
      successful: [],
      failed: [],
    };

    await Promise.all(
      batchPaymentDto.payments.map(async (payment) => {
        try {
          const result = await this.createPayment(payment);
          results.successful.push({
            transactionId: result.transactionId,
            status: result.status,
          });
        } catch (error) {
          results.failed.push({
            payment,
            error: error.message,
          });
        }
      })
    );

    return results;
  }

  async getTransactionStatistics(
    queryParams: TransactionStatisticsDto
  ): Promise<TransactionStats> {
    const { startDate, endDate, provider, status } = queryParams;

    const stats = await this.transactionRepository.getStatistics({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      provider,
      status,
    });

    return {
      totalTransactions: stats.totalTransactions,
      totalVolume: stats.totalVolume,
      successRate:
        ((stats.byStatus?.SUCCESSFUL || 0) / stats.totalTransactions) * 100,
      averageTransactionValue: stats.totalVolume / stats.totalTransactions,
      byProvider: stats.byProvider,
      byStatus: stats.byStatus,
      hourlyDistribution: stats.hourlyDistribution,
    };
  }
  async createDispute(
    transactionId: string,
    disputeDto: CreateDisputeDto
  ): Promise<DisputeResult> {
    const transaction = await this.transactionRepository.findById(
      transactionId
    );
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const provider = this.paymentProviderFactory.getProvider(
      transaction.paymentMethod
    );
    const disputeResult = await provider.createDispute(
      transactionId,
      disputeDto
    );

    await this.transactionRepository.updateTransaction(transaction.id, {
      status: PaymentStatus.DISPUTED,
      disputeDetails: {
        id: (disputeResult as DisputeResult).id,
        status: (disputeResult as DisputeResult).status,
        reason: (disputeResult as DisputeResult).reason,
        amount: (disputeResult as DisputeResult).amount,
        currency: (disputeResult as DisputeResult).currency,
        createdAt: (disputeResult as DisputeResult).createdAt,
        updatedAt: (disputeResult as DisputeResult).updatedAt,
      },
    });

    return disputeResult as DisputeResult;
  }

  async getExchangeRates(
    fromCurrency: string,
    toCurrency: string
  ): Promise<ExchangeRate> {
    const cacheKey = `exchange_rate:${fromCurrency}:${toCurrency}`;
    const cachedRate = await this.redisService.cacheGet<ExchangeRate>(cacheKey);

    if (cachedRate) {
      return cachedRate;
    }

    const rate = await this.exchangeRateProvider.getRate(
      fromCurrency,
      toCurrency
    );
    await this.redisService.cacheSet(cacheKey, rate, 300); // Cache for 5 minutes

    return rate;
  }

  async getExchangeRate(
    fromCurrency: string,
    toCurrency: string
  ): Promise<ExchangeRate> {
    const cacheKey = `exchange_rate:${fromCurrency}:${toCurrency}`;

    try {
      const cachedRate = await this.redisService.cacheGet<ExchangeRate>(
        cacheKey
      );
      if (cachedRate) {
        return cachedRate;
      }

      const rate = await this.exchangeRateProvider.getRate(
        fromCurrency,
        toCurrency
      );
      await this.redisService.cacheSet(cacheKey, rate, 300); // Cache for 5 minutes

      return rate;
    } catch (error) {
      this.logger.error(
        `Failed to fetch exchange rate: ${error.message}`,
        error.stack
      );
      throw new ExchangeRateException(
        `Unable to get exchange rate from ${fromCurrency} to ${toCurrency}`,
        error
      );
    }
  }

  async convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    try {
      const rate = await this.getExchangeRate(fromCurrency, toCurrency);
      return amount * rate.rate;
    } catch (error) {
      this.logger.error(
        `Currency conversion failed: ${error.message}`,
        error.stack
      );
      throw new ExchangeRateException(
        `Failed to convert ${amount} from ${fromCurrency} to ${toCurrency}`,
        error
      );
    }
  }

  private getProviderLimits(
    provider: PaymentProvider,
    region: string
  ): PaymentLimits {
    const limits = {
      [PaymentProvider.STRIPE]: {
        min: 1,
        max: 999999,
        currency: 'USD',
      },
      [PaymentProvider.ALIPAY]: {
        min: 0.01,
        max: 100000,
        currency: 'CNY',
      },
      [PaymentProvider.MOMO]: {
        min: 100,
        max: 5000000,
        currency: region === 'AO' ? 'AOA' : 'XAF',
      },
    };

    return limits[provider];
  }
}
