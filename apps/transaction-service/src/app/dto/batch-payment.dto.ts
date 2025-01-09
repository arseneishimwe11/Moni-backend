import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentDto, PaymentStatus } from './payment.dto';

export class BatchPaymentDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentDto)
  payments: PaymentDto[];
}

export interface BatchPaymentResult {
  successful: {
    transactionId: string;
    status: PaymentStatus;
  }[];
  failed: {
    payment: PaymentDto;
    error: string;
  }[];
}
