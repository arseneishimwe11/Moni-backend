import { Test, TestingModule } from '@nestjs/testing';
import { TransactionService } from './transaction.service';
import { ConfigService } from '@nestjs/config';
import { PaymentDto, PaymentProvider, PaymentRegion, StripeCurrency } from './dto/payment.dto';
import Stripe from 'stripe';

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({ id: 'test-payment-intent-id', status: 'succeeded' }),
    },
  }));
});

describe('TransactionService', () => {
  let service: TransactionService;
  let configService: ConfigService;
  let stripe: Stripe;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-stripe-secret-key'),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
    configService = module.get<ConfigService>(ConfigService);
    stripe = (service as unknown as { stripe: Stripe }).stripe; 
  });  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(configService).toBeDefined();
    expect(stripe).toBeDefined();
  });

  describe('createPayment', () => {
    it('should create a Stripe payment intent successfully', async () => {
      const paymentDto: PaymentDto = {
        amount: 1000,
        currency: StripeCurrency.USD,
        paymentMethod: PaymentProvider.STRIPE,
        description: 'Test payment',
        biometricToken: 'test-biometric-token',
        transactionId: 'test-transaction-id',
        region: PaymentRegion.CHINA,
      };

      const result = await service.createPayment(paymentDto);

      expect(stripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 1000,
        currency: 'usd',
        payment_method_types: ['card'],
        description: 'Test payment',
      });

      expect(result).toEqual({ id: 'test-payment-intent-id', status: 'succeeded' });
    });
    it('should throw an error for unsupported payment methods', async () => {
      const paymentDto: PaymentDto = {
        amount: 1000,
        currency: StripeCurrency.USD,
        paymentMethod: undefined,
        description: 'Test payment',
        biometricToken: 'test-biometric-token',
        transactionId: 'test-transaction-id',
        region: PaymentRegion.CHINA
      };

      await expect(service.createPayment(paymentDto)).rejects.toThrow('Unsupported payment method');
    });  });
});
