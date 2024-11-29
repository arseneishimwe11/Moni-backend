import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import {
  IPaymentProvider,
  PaymentResult,
  RefundResult,
} from '../interfaces/payment-provider.interface';
import { PaymentDto, PaymentStatus, RefundStatus } from '../../dto/payment.dto';
import { PaymentProcessingException } from '../../exceptions/payment-processing.exception';
import { createHmac } from 'crypto';
import { RedisService } from '@moni-backend/redis';
@Injectable()
export class MomoProvider implements IPaymentProvider {
  private readonly logger = new Logger(MomoProvider.name);
  private readonly baseUrl: string;
  private readonly subscriptionKey: string;

  readonly name = 'momo';
  readonly supportedCurrencies = ['XAF', 'AOA', 'USD'];
  readonly supportedRegions = ['AO', 'CG']; // Angola and Congo

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService
  ) {
    this.baseUrl = this.configService.get<string>('MOMO_API_URL');
    this.subscriptionKey = this.configService.get<string>(
      'MOMO_SUBSCRIPTION_KEY'
    );
  }

  async validatePayment(paymentData: PaymentDto): Promise<boolean> {
    return this.validatePhoneNumber(
      paymentData.phoneNumber,
      paymentData.region
    );
  }

  async processPayment(paymentData: PaymentDto): Promise<PaymentResult> {
    try {
      if (!(await this.validatePayment(paymentData))) {
        throw new PaymentProcessingException('Invalid phone number format');
      }
      await this.checkRateLimit(paymentData.phoneNumber);
      const referenceId = uuidv4();
      const token = await this.getAccessToken();

      const paymentRequest = {
        amount: paymentData.amount.toString(),
        currency: paymentData.currency,
        externalId: paymentData.transactionId,
        payer: {
          partyIdType: 'MSISDN',
          partyId: paymentData.phoneNumber,
        },
        payerMessage: paymentData.description || 'MONI Payment',
        payeeNote: 'Mobile Money Payment',
        region: paymentData.region,
      };

      const response = await axios.post(
        `${this.baseUrl}/v1_0/payment`,
        paymentRequest,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Reference-Id': referenceId,
            'X-Target-Environment':
              this.configService.get('NODE_ENV') === 'production'
                ? 'production'
                : 'sandbox',
            'Ocp-Apim-Subscription-Key': this.subscriptionKey,
          },
        }
      );

      return {
        providerReference: referenceId,
        status: this.mapMomoStatus(response.data.status),
        amount: paymentData.amount,
        currency: paymentData.currency,
        metadata: {
          phoneNumber: paymentData.phoneNumber,
          operator: response.data.operator,
          region: paymentData.region,
        },
        processingTime: Date.now(),
      };
    } catch (error) {
      this.logger.error(`MoMo payment processing failed: ${error.message}`);
      throw new PaymentProcessingException(this.handleMomoError(error));
    }
  }

  async verifyWebhookSignature(
    payload: unknown,
    signature: string
  ): Promise<boolean> {
    const secretKey = this.configService.get<string>('MOMO_WEBHOOK_SECRET');

    if (!secretKey) {
      this.logger.error('MOMO_WEBHOOK_SECRET not configured');
      return false;
    }

    try {
      const timestamp = new Date().toISOString();
      const payloadData = payload as Record<string, unknown>;
      const signatureData = {
        referenceId: payloadData.referenceId,
        timestamp,
        amount: payloadData.amount,
        currency: payloadData.currency,
        status: payloadData.status,
        transactionId: payloadData.transactionId,
      };

      const dataToSign = Object.entries(signatureData)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([, value]) => value)
        .join('|');

      const hmac = createHmac('sha256', secretKey);
      hmac.update(dataToSign);
      const calculatedSignature = hmac.digest('hex');

      const isValid = calculatedSignature === signature;
      this.logger.debug(
        `Webhook signature verification: ${isValid ? 'valid' : 'invalid'}`
      );

      return isValid;
    } catch (error) {
      this.logger.error(
        `Webhook signature verification failed: ${error.message}`
      );
      return false;
    }
  }

  async getPaymentStatus(transactionId: string): Promise<PaymentStatus> {
    try {
      const token = await this.getAccessToken();
      const response = await axios.get(
        `${this.baseUrl}/v1_0/payment/${transactionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Ocp-Apim-Subscription-Key': this.subscriptionKey,
          },
        }
      );

      return this.mapMomoStatus(response.data.status);
    } catch (error) {
      this.logger.error(`Failed to get MoMo payment status: ${error.message}`);
      throw new PaymentProcessingException(this.handleMomoError(error));
    }
  }

  async refundPayment(
    transactionId: string,
    amount?: number
  ): Promise<RefundResult> {
    try {
      const token = await this.getAccessToken();
      const refundReferenceId = uuidv4();

      const response = await axios.post(
        `${this.baseUrl}/v1_0/refund`,
        {
          referenceId: refundReferenceId,
          transactionId,
          amount: amount?.toString(),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Reference-Id': refundReferenceId,
            'Ocp-Apim-Subscription-Key': this.subscriptionKey,
          },
        }
      );

      return {
        refundId: refundReferenceId,
        status: this.mapMomoStatus(
          response.data.status
        ) as unknown as RefundStatus,
        amount: amount || 0,
        transactionId,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`MoMo refund failed: ${error.message}`);
      throw new PaymentProcessingException(this.handleMomoError(error));
    }
  }

  private async getAccessToken(): Promise<string> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/token/`,
        {},
        {
          headers: {
            'Ocp-Apim-Subscription-Key': this.subscriptionKey,
          },
          auth: {
            username: this.configService.get('MOMO_API_USER'),
            password: this.configService.get('MOMO_API_KEY'),
          },
        }
      );
      return response.data.access_token;
    } catch (error) {
      throw new Error(`Failed to obtain MoMo access token: ${error.message}`);
    }
  }
  private mapMomoStatus(status: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      SUCCESSFUL: PaymentStatus.SUCCEEDED,
      PENDING: PaymentStatus.PENDING,
      FAILED: PaymentStatus.FAILED,
      CANCELLED: PaymentStatus.CANCELED,
      TIMEOUT: PaymentStatus.TIMEOUT,
    };
    return statusMap[status] || PaymentStatus.UNKNOWN;
  }

  private handleMomoError(error: unknown): string {
    const errorCodes: Record<string, string> = {
      PAYER_NOT_FOUND: 'Invalid phone number',
      NOT_ENOUGH_FUNDS: 'Insufficient funds',
      EXPIRED: 'Transaction expired',
      INVALID_CURRENCY: 'Currency not supported',
    };

    if (error && typeof error === 'object' && 'response' in error) {
      const response = (error as { response?: { data?: { code?: string } } })
        .response;
      if (response && typeof response === 'object' && 'data' in response) {
        const data = response.data;
        if (data && typeof data === 'object' && 'code' in data) {
          const code = data.code;
          if (typeof code === 'string' && code in errorCodes) {
            return errorCodes[code];
          }
        }
      }
    }

    return 'Payment processing failed';
  }
  private calculateSignature(payload: {
    referenceId: string;
    amount: string;
    currency: string;
    payer: {
      partyId: string;
    };
  }): string {
    const secretKey = this.configService.get<string>('MOMO_SIGNING_KEY');
    const timestamp = new Date().toISOString();

    const signatureData = {
      referenceId: payload.referenceId,
      timestamp: timestamp,
      amount: payload.amount,
      currency: payload.currency,
      payerNumber: payload.payer.partyId,
    };

    const dataToSign = Object.values(signatureData).join('');
    const hmac = createHmac('sha256', secretKey);
    hmac.update(dataToSign);

    return hmac.digest('hex');
  }
  private validatePhoneNumber(phoneNumber: string, region: string): boolean {
    const patterns = {
      AO: /^(?:\+244|244)?9[1-9]\d{7}$/,
      CG: /^(?:\+242|242)?0[5-9]\d{7}$/,
    };
    return patterns[region]?.test(phoneNumber) ?? false;
  }

  private async checkRateLimit(phoneNumber: string): Promise<void> {
    const key = `momo:ratelimit:${phoneNumber}`;
    const isWithinLimit = await this.redisService.checkRateLimit(key, 5, 300);

    if (!isWithinLimit) {
      throw new PaymentProcessingException('Too many payment attempts');
    }
  }
}
