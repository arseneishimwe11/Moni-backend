import { Test, TestingModule } from '@nestjs/testing';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { PaymentDto, PaymentProvider, PaymentRegion, StripeCurrency } from './dto/payment.dto';
import { PaymentAuthGuard } from './guards/payment-auth.guard';
import { Reflector } from '@nestjs/core';

// Mocking the Paymen tAuthGuard
class MockPaymentAuthGuard {
  canActivate() {
    return true;  // Bypass the authentication logic in the guard
  }
}

describe('TransactionController', () => {
  let transactionController: TransactionController;
  let transactionService: TransactionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionController],
      providers: [
        {
          provide: TransactionService,
          useValue: {
            createPayment: jest.fn().mockResolvedValue({
              id: 1,
              amount: 100,
              status: 'pending',
            }),
          },
        },
        {
          provide: PaymentAuthGuard,
          useClass: MockPaymentAuthGuard,  
        },
        Reflector,
      ],
    }).compile();

    transactionController = module.get<TransactionController>(TransactionController);
    transactionService = module.get<TransactionService>(TransactionService);
  });

  describe('createPayment', () => {
    it('should create a payment and return payment details', async () => {
      const paymentDto: PaymentDto = {
        amount: 100,
        paymentMethod: PaymentProvider.ALIPAY, 
        currency: StripeCurrency.USD,
        description: 'A test payment',
        biometricToken: 'dummy-token',
        transactionId: 'test-transaction-id',
        region: PaymentRegion.CHINA
      };

      const result = await transactionController.createPayment(paymentDto);

      expect(result).toEqual({
        id: 1,
        amount: 100,
        status: 'pending',
      });

      // Ensure that the createPayment method was called with the correct arguments
      expect(transactionService.createPayment).toHaveBeenCalledWith(paymentDto);
    });  });
});
