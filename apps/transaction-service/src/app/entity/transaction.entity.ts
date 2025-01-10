import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { PaymentStatus, PaymentProvider, StripeCurrency, PaymentRegion } from '../dto/payment.dto';
import { DisputeResult } from '../dto/create-dispute.dto';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  transactionId: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: StripeCurrency })
  currency: StripeCurrency;

  @Column({ type: 'enum', enum: PaymentProvider })
  paymentMethod: PaymentProvider;

  @Column({ type: 'enum', enum: PaymentRegion }) 
  region: PaymentRegion;

  @Column()
  biometricToken: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ nullable: true })
  description?: string;

  @Column({ nullable: true })
  customerId?: string;

  @Column({ nullable: true })
  receiptEmail?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ nullable: true })
  providerReference?: string;

  @Column({ nullable: true })
  errorDetails?: string;

  @Column({ type: 'jsonb', nullable: true })
  refundDetails?: Record<string, unknown>;

  @Column({ nullable: true })
  phoneNumber?: string;

  @Column({ nullable: true })
  returnUrl?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  processedAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  disputeDetails?: DisputeResult;
}
