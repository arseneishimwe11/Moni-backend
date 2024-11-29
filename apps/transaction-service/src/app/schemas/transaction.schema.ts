import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { PaymentStatus, PaymentProvider, StripeCurrency, PaymentRegion } from '../dto/payment.dto';

@Schema()
export class Transaction extends Document {
  @Prop({ required: true })
  transactionId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, enum: StripeCurrency })
  currency: StripeCurrency;

  @Prop({ required: true, enum: PaymentProvider })
  paymentMethod: PaymentProvider;

  @Prop({ required: true, enum: PaymentRegion })
  region: PaymentRegion;

  @Prop({ required: true })
  biometricToken: string;

  @Prop({ enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Prop()
  description?: string;

  @Prop()
  customerId?: string;

  @Prop()
  receiptEmail?: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  @Prop()
  providerReference?: string;

  @Prop()
  errorDetails?: string;

  @Prop({ type: Object })
  refundDetails?: Record<string, unknown>;

  @Prop()
  phoneNumber?: string;

  @Prop()
  returnUrl?: string;

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: true })
  updatedAt: Date;

  @Prop()
  processedAt?: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

TransactionSchema.index({ transactionId: 1 }, { unique: true });
TransactionSchema.index({ customerId: 1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ createdAt: 1 });
