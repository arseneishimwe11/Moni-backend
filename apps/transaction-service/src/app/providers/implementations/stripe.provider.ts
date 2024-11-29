import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { IPaymentProvider, PaymentResult, RefundResult } from '../interfaces/payment-provider.interface';
import { PaymentDto, StripeCurrency, PaymentStatus, RefundStatus } from '../../dto/payment.dto';
import { PaymentProcessingException } from '../../exceptions/payment-processing.exception';
import { RedisService } from '@moni-backend/redis';

@Injectable()
export class StripeProvider implements IPaymentProvider {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripeProvider.name);
  
  readonly name = 'stripe';
  readonly supportedCurrencies = Object.values(StripeCurrency);
  readonly supportedRegions = ['US', 'EU', 'GB', 'SG', 'AO', 'CG', 'IN'];

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService
  ) {
    this.stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY'), {
      apiVersion: '2024-11-20.acacia',
      typescript: true,
      telemetry: false,
      timeout: 30000,
    });
  }

  async validatePayment(paymentData: PaymentDto): Promise<boolean> {
    const isValidAmount = paymentData.amount > 0;
    const isValidCurrency = this.supportedCurrencies.includes(paymentData.currency as StripeCurrency);
    const isValidRegion = this.supportedRegions.includes(paymentData.region);

    return isValidAmount && isValidCurrency && isValidRegion;
  }

  async processPayment(paymentData: PaymentDto): Promise<PaymentResult> {
    try {
      const idempotencyKey = `payment_${paymentData.transactionId}`;
      
      if (!(await this.validatePayment(paymentData))) {
        throw new PaymentProcessingException('Invalid payment parameters');
      }

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: this.convertToSmallestUnit(paymentData.amount, paymentData.currency),
        currency: paymentData.currency.toLowerCase(),
        payment_method_types: this.getPaymentMethodTypes(paymentData.region),
        metadata: {
          transactionId: paymentData.transactionId,
          region: paymentData.region,
          biometricVerified: paymentData.biometricToken ? 'true' : 'false'
        },
        description: paymentData.description,
        statement_descriptor: 'MONI PAYMENT',
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'always'
        },
        receipt_email: paymentData.receiptEmail,
      }, {
        idempotencyKey,
      });

      return {
        providerReference: paymentIntent.id,
        status: this.mapStripeStatus(paymentIntent.status),
        amount: this.convertFromSmallestUnit(paymentIntent.amount, paymentData.currency),
        currency: paymentIntent.currency,
        metadata: {
          ...paymentIntent.metadata,
          paymentMethod: paymentIntent.payment_method,
          requiresAction: paymentIntent.status === 'requires_action',
          nextAction: paymentIntent.next_action
        },
        processingTime: Date.now()
      };
    } catch (error) {
      this.logger.error(`Stripe payment processing failed: ${error.message}`, error.stack);
      throw new PaymentProcessingException(this.handleStripeError(error));
    }
  }

  async refundPayment(transactionId: string, amount?: number): Promise<RefundResult> {
    try {
      const payment = await this.stripe.paymentIntents.retrieve(transactionId);
      
      const refund = await this.stripe.refunds.create({
        payment_intent: transactionId,
        amount: amount ? this.convertToSmallestUnit(amount, payment.currency) : undefined,
        reason: 'requested_by_customer',
      });

      return {
        refundId: refund.id,
        status: this.mapRefundStatus(refund.status),
        amount: this.convertFromSmallestUnit(refund.amount, payment.currency),
        transactionId,
        timestamp: new Date(refund.created * 1000)
      };
    } catch (error) {
      this.logger.error(`Refund failed for transaction ${transactionId}: ${error.message}`);
      throw new PaymentProcessingException(this.handleStripeError(error));
    }
  }

  async getPaymentStatus(transactionId: string): Promise<PaymentStatus> {
    try {
      const payment = await this.stripe.paymentIntents.retrieve(transactionId);
      return this.mapStripeStatus(payment.status);
    } catch (error) {
      this.logger.error(`Failed to get payment status: ${error.message}`);
      throw new PaymentProcessingException(this.handleStripeError(error));
    }
  }

  async verifyWebhookSignature(payload: string | Buffer, signature: string): Promise<boolean> {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.configService.get<string>('STRIPE_WEBHOOK_SECRET')
      );
      return !!event;
    } catch (error) {
      this.logger.error(`Webhook signature verification failed: ${error.message}`);
      return false;
    }
  }

  private getPaymentMethodTypes(region: string): string[] {
    const baseTypes = ['card'];
    
    switch(region) {
      case 'IN':
        return [...baseTypes, 'upi'];
      case 'AO':
      case 'CG':
        return [...baseTypes, 'mobile_money'];
      default:
        return baseTypes;
    }
  }

  private convertToSmallestUnit(amount: number, currency: string): number {
    return currency.toLowerCase() === 'jpy' ? amount : Math.round(amount * 100);
  }

  private convertFromSmallestUnit(amount: number, currency: string): number {
    return currency.toLowerCase() === 'jpy' ? amount : amount / 100;
  }

  private mapStripeStatus(status: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      'succeeded': PaymentStatus.SUCCEEDED,
      'processing': PaymentStatus.PENDING,
      'requires_payment_method': PaymentStatus.PENDING,
      'requires_confirmation': PaymentStatus.PENDING,
      'requires_action': PaymentStatus.REQUIRES_ACTION,
      'canceled': PaymentStatus.CANCELED,
      'failed': PaymentStatus.FAILED
    };
    return statusMap[status] || PaymentStatus.UNKNOWN;
  }

  private mapRefundStatus(status: string): RefundStatus {
    const statusMap: Record<string, RefundStatus> = {
      'succeeded': RefundStatus.SUCCEEDED,
      'pending': RefundStatus.PENDING,
      'failed': RefundStatus.FAILED,
      'canceled': RefundStatus.CANCELED
    };
    return statusMap[status] || RefundStatus.UNKNOWN;
  }



  private handleStripeError(error: Stripe.StripeRawError): string {
    switch (error.type) {
      case 'card_error':
        return `Card error: ${error.message}`;
        
      case 'rate_limit_error':
        return 'Rate limit exceeded. Please try again later.';
        
      case 'invalid_request_error':
        return `Invalid request: ${error.message}`;
        
      case 'authentication_error':
        return 'Authentication failed. Please check your API keys or contact support.';
                
      case 'api_error':
        return 'Stripe is experiencing technical issues. Please try again later.';
        
      case 'idempotency_error':
        return 'Duplicate request detected. Try a different transaction.';
          
      default:
        return `Unexpected error: ${error.message || 'Unknown error occurred.'}`;
    }
  }
}
