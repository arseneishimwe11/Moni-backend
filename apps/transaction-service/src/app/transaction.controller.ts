import { Controller, Post, Body, UseGuards, Get, Param, Query } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { PaymentDto } from './dto/payment.dto';
import { PaymentAuthGuard } from './guards/payment-auth.guard';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { TransactionStatisticsDto } from './dto/transaction-statistics.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { BatchPaymentDto } from './dto/batch-payment.dto';

@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post('create-payment')
  @UseGuards(PaymentAuthGuard)
  async createPayment(@Body() paymentDto: PaymentDto) {
    return this.transactionService.createPayment(paymentDto);
  }

  @Post('verify-payment')
  @UseGuards(PaymentAuthGuard)
  async verifyPayment(@Body() verifyDto: VerifyPaymentDto) {
    return this.transactionService.verifyPayment(verifyDto);
  }

  @Get('payment-methods')
  @UseGuards(PaymentAuthGuard)
  async getAvailablePaymentMethods(@Query('region') region: string) {
    return this.transactionService.getAvailablePaymentMethods(region);
  }

  @Post('batch')
  @UseGuards(PaymentAuthGuard)
  async createBatchPayments(@Body() batchPaymentDto: BatchPaymentDto) {
    return this.transactionService.createBatchPayments(batchPaymentDto);
  }

  @Get('statistics')
  @UseGuards(PaymentAuthGuard)
  async getTransactionStatistics(
    @Query() queryParams: TransactionStatisticsDto
  ) {
    return this.transactionService.getTransactionStatistics(queryParams);
  }

  @Post(':id/dispute')
  @UseGuards(PaymentAuthGuard)
  async createDispute(
    @Param('id') transactionId: string,
    @Body() disputeDto: CreateDisputeDto
  ) {
    return this.transactionService.createDispute(transactionId, disputeDto);
  }

  @Get('exchange-rates')
  async getExchangeRates(
    @Query('from') fromCurrency: string,
    @Query('to') toCurrency: string
  ) {
    return this.transactionService.getExchangeRates(fromCurrency, toCurrency);
  }
}
