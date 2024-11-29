import { HttpException, HttpStatus } from '@nestjs/common';
import { PaymentProvider } from '../dto/payment.dto';

export class PaymentProviderNotFoundException extends HttpException {
  constructor(provider: PaymentProvider) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Payment Provider Not Found',
        message: `Payment provider '${provider}' is not supported or configured`,
        provider,
        timestamp: new Date().toISOString()
      },
      HttpStatus.NOT_FOUND
    );
  }
}
