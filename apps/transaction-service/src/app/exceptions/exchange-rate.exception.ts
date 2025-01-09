import { HttpException, HttpStatus } from '@nestjs/common';

export class ExchangeRateException extends HttpException {
  constructor(message: string, originalError?: Error) {
    const errorResponse = {
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message,
      error: 'Exchange Rate Error',
      details: originalError?.message,
      timestamp: new Date().toISOString()
    };

    super(errorResponse, HttpStatus.SERVICE_UNAVAILABLE);
  }
}
