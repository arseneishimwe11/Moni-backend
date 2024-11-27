import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class PaymentDto {
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @IsString()
  description: string;
}
