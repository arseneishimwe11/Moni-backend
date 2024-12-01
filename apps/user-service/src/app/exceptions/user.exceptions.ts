import { HttpException, HttpStatus } from '@nestjs/common';

export class UserNotFoundException extends HttpException {
  constructor(userId: string) {
    super({
      statusCode: HttpStatus.NOT_FOUND,
      error: 'User Not Found',
      message: `User with ID ${userId} not found`,
      timestamp: new Date().toISOString()
    }, HttpStatus.NOT_FOUND);
  }
}

export class InvalidKycDocumentException extends HttpException {
  constructor(reason: string) {
    super({
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'Invalid KYC Document',
      message: reason,
      timestamp: new Date().toISOString()
    }, HttpStatus.BAD_REQUEST);
  }
}
