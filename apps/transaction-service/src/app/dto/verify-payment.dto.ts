import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class VerifyPaymentDto {
  @IsUUID()
  @IsNotEmpty()
  transactionId: string;

  @IsString()
  @IsNotEmpty()
  verificationToken: string;
}
