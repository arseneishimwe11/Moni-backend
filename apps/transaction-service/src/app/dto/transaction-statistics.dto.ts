import { IsOptional, IsDateString, IsEnum } from 'class-validator';
import { PaymentProvider, PaymentStatus } from './payment.dto';

export class TransactionStatisticsDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(PaymentProvider)
  provider?: PaymentProvider;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;
}
