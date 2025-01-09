import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export enum DisputeReason {
  UNAUTHORIZED_TRANSACTION = 'unauthorized_transaction',
  DUPLICATE_CHARGE = 'duplicate_charge',
  PRODUCT_NOT_RECEIVED = 'product_not_received',
  FRAUDULENT = 'fraudulent',
  OTHER = 'other',
}

export class CreateDisputeDto {
  @IsEnum(DisputeReason)
  reason: DisputeReason;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsString()
  evidence?: string;
}

export interface DisputeResult {
  id: string;
  status: DisputeStatus;
  reason: string;
  evidence?: string;
  amount: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export enum DisputeStatus {
  OPEN = 'open',
  UNDER_REVIEW = 'under_review',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}
