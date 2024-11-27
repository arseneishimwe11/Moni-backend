import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { PaymentDto } from './dto/payment.dto';
import { PaymentAuthGuard } from './guards/payment-auth.guard';

@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post('create-payment')
  @UseGuards(PaymentAuthGuard)
  async createPayment(@Body() paymentDto: PaymentDto) {
    return this.transactionService.createPayment(paymentDto);
  }
}
