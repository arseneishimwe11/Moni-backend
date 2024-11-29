import { Process, Processor } from '@nestjs/bull';
import { Logger, Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import { PaymentDto, PaymentStatus } from '../dto/payment.dto';
import { TransactionRepository } from '../repositories/transaction.repository';
import { PaymentProviderFactory } from '../providers/payment-provider.factory';
import { RedisService } from '@moni-backend/redis';

interface PaymentJobData {
  transactionId: string;
  paymentData: PaymentDto;
}

interface PaymentResult {
  status: PaymentStatus;
  providerReference: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
@Processor('payments')
export class PaymentProcessor {
  private readonly logger = new Logger(PaymentProcessor.name);
  private readonly maxRetries = 3;
  private readonly backoffDelay = 1000;
  private readonly processingTimeout = 30000;

  constructor(
    private configService: ConfigService,
    private transactionRepository: TransactionRepository,
    private paymentProviderFactory: PaymentProviderFactory,
    private redisService: RedisService
  ) {}

  @Process('process-payment')
  async handlePayment(job: Job<PaymentJobData>) {
    const { transactionId, paymentData } = job.data;
    const lockKey = `payment:lock:${transactionId}`;

    try {
      const hasLock = await this.redisService.setLock(lockKey, 30);
      if (!hasLock) {
        throw new Error('Payment already being processed');
      }

      this.logger.log(`Processing payment job ${job.id} for transaction ${transactionId}`);

      const result = await this.processPaymentWithRetry(paymentData) as PaymentResult;
      
      await this.transactionRepository.updateTransaction(transactionId, {
        status: result.status,
        processedAt: new Date(),
        providerReference: result.providerReference,
        metadata: {
          ...result.metadata,
          processingTime: Date.now() - job.timestamp,
          attempts: job.attemptsMade + 1,
          processor: 'payment-queue'
        }
      });

      return result;
    } catch (error) {
      await this.handlePaymentError(job, error as Error);
      throw error;
    } finally {
      await this.redisService.releaseLock(lockKey);
    }
  }

  private async processPaymentWithRetry(paymentData: PaymentDto, attempt = 1): Promise<PaymentResult> {
    try {
      const provider = this.paymentProviderFactory.getProvider(paymentData.paymentMethod);
      return await provider.processPayment(paymentData);
    } catch (error) {
      if (attempt >= this.maxRetries) {
        throw error;
      }

      const delay = this.backoffDelay * Math.pow(2, attempt - 1);
      await this.sleep(delay);
      
      return this.processPaymentWithRetry(paymentData, attempt + 1);
    }
  }

  private async handlePaymentError(job: Job<PaymentJobData>, error: Error) {
    const { transactionId } = job.data;
    
    const errorData = {
      message: error.message || 'Unknown error occurred',
      code: (error as { code?: string }).code || 'PAYMENT_PROCESSING_ERROR',
      timestamp: new Date(),
      jobId: job.id,
      attempt: job.attemptsMade + 1,
      stack: error.stack || ''
    };

    await this.transactionRepository.updateTransaction(transactionId, {
      status: PaymentStatus.FAILED,
      errorDetails: JSON.stringify(errorData),
      updatedAt: new Date()
    });

    this.logger.error(
      `Payment processing failed for transaction ${transactionId}`,
      errorData
    );
  }
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  @Process('payment-timeout')
  async handleTimeout(job: Job<PaymentJobData>) {
    const { transactionId } = job.data;
    
    this.logger.warn(`Payment timeout for transaction ${transactionId}`);
    
    await this.transactionRepository.updateTransaction(transactionId, {
      status: PaymentStatus.TIMEOUT,
      updatedAt: new Date(),
      errorDetails: 'Payment processing timeout exceeded'
    });

    return { transactionId, status: PaymentStatus.TIMEOUT };
  }
}
