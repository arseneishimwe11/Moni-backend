import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString, IsOptional, IsEnum, Min, IsUUID, IsObject, Matches, IsUrl } from 'class-validator';

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELED = 'canceled',
  TIMEOUT = 'timeout',
  REFUNDED = 'refunded',
  PROCESSING = 'processing',
  REQUIRES_ACTION = 'requires_action',
  UNKNOWN = 'unknown',
}

export enum PaymentProvider {
  STRIPE = 'stripe',
  ALIPAY = 'alipay',
  MASTERCARD = 'mastercard',
  VISA = 'visa',
  MOMO = 'momo',
  UPI = 'upi'
}

export enum PaymentRegion {
  ANGOLA = 'AO',
  CONGO = 'CG',
  INDIA = 'IN',
  CHINA = 'CN',
}

export enum StripeCurrency {
  USD = 'usd',
  EUR = 'eur',
  GBP = 'gbp',
  JPY = 'jpy',
  CAD = 'cad',
  AUD = 'aud',
  CNY = 'cny',
  INR = 'inr',
  AOA = 'aoa',  // Angola (Kwanza)
  CDF = 'cdf',  // Congo Brazzaville (Congo Franc)
  XAF = 'xaf',  // Central African CFA Franc
  XOF = 'xof',  // West African CFA Franc
}

export enum RefundStatus {
  SUCCEEDED = 'succeeded',
  PENDING = 'pending',
  FAILED = 'failed',
  CANCELED = 'canceled',
  UNKNOWN = 'unknown'
}


export class PaymentDto {
  @IsUUID()
  @IsNotEmpty()
  transactionId: string;

  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  amount: number;

  @Transform(({ value }) => value.toUpperCase())
  @IsEnum(StripeCurrency)
  @IsNotEmpty()
  currency: StripeCurrency;

  @IsString()
  @IsNotEmpty()
  paymentMethod: PaymentProvider;

  @IsEnum(PaymentRegion)
  @IsNotEmpty()
  region: PaymentRegion;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9-_]+$/)
  biometricToken: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  customerId?: string;

  @IsString()
  @IsOptional()
  receiptEmail?: string;

  @IsEnum(PaymentStatus)
  @IsOptional()
  status?: PaymentStatus;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, string>;

  @IsString()
  @IsOptional()
  statementDescriptor?: string;

  @IsString()
  @IsOptional()
  @Matches(/^(?:\+(?:244|242))?\d{9}$/)
  phoneNumber?: string;

  @IsUrl()
  @IsOptional()
  returnUrl?: string;
}
