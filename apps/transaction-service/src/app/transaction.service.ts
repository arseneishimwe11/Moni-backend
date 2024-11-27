import { Injectable } from '@nestjs/common';
import { PaymentDto } from './dto/payment.dto';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TransactionService {
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    this.stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY'), {
      apiVersion: '2022-11-15',
    });
  }

  async createPayment(paymentDto: PaymentDto) {
    const { amount, currency, paymentMethod, description } = paymentDto;

    switch (paymentMethod) {
      case 'stripe':
        return await this.stripe.paymentIntents.create({
          amount,
          currency,
          payment_method_types: ['card'],
          description,
        });

      case 'alipay':
        // Implement Alipay logic
        break;

      case 'mastercard':
        // Implement Mastercard logic
        break;

      default:
        throw new Error('Unsupported payment method');
    }
  }
}
