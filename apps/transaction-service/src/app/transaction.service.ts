import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PaymentDto, PaymentStatus, PaymentProvider } from './dto/payment.dto';
import { ConfigService } from '@nestjs/config';
import { TransactionRepository } from './repositories/transaction.repository';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { PaymentProcessingException } from './exceptions/payment-processing.exception';

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    private configService: ConfigService,
    @InjectQueue('payments') private paymentQueue: Queue,
    private transactionRepository: TransactionRepository,
    private paymentProviderFactory: PaymentProviderFactory
  ) {}

  async createPayment(paymentDto: PaymentDto) {
    this.logger.log(`Creating payment for transaction ${paymentDto.transactionId}`);

    const transaction = await this.transactionRepository.createTransaction({
      ...paymentDto,
      status: PaymentStatus.PENDING,
      createdAt: new Date()
    });

    try {
      const provider = this.paymentProviderFactory.getProvider(
        paymentDto.region === 'AO' || paymentDto.region === 'CG' 
          ? PaymentProvider.MOMO 
          : PaymentProvider.STRIPE
      );

      await this.paymentQueue.add('process-payment', {
        transactionId: transaction.id,
        paymentData: paymentDto,
        provider: provider
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true
      });

      return { transactionId: transaction.id, status: PaymentStatus.PENDING };
    } catch (error) {
      this.logger.error(`Payment creation failed: ${error.message}`, error.stack);
      await this.transactionRepository.updateTransaction(transaction.id, {
        status: PaymentStatus.FAILED,
        errorDetails: error.message
      });
      throw new PaymentProcessingException(error.message);
    }
  }
  async getPaymentStatus(transactionId: string) {
    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new PaymentProcessingException('Transaction not found');
    }
    return transaction;
  }

  async refundPayment(transactionId: string, amount?: number) {
    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new PaymentProcessingException('Transaction not found');
    }

    const provider = this.paymentProviderFactory.getProvider(transaction.paymentMethod);
    const refundResult = await provider.refundPayment(transactionId, amount);

    await this.transactionRepository.updateTransaction(transactionId, {
      status: PaymentStatus.REFUNDED,
      refundDetails: { ...refundResult }
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
    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new PaymentProcessingException('Transaction not found');
    }

    if (transaction.status !== PaymentStatus.PENDING) {
      throw new PaymentProcessingException('Transaction cannot be cancelled');
    }

    await this.transactionRepository.updateTransaction(transactionId, {
      status: PaymentStatus.CANCELED,
      updatedAt: new Date()
    });

    return { transactionId, status: PaymentStatus.CANCELED };
  }
}
