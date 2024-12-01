import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification'
}

export enum KycStatus {
  NOT_STARTED = 'not_started',
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected'
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Index()
  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Index()
  @Column({ unique: true })
  phoneNumber: string;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.PENDING_VERIFICATION })
  status: UserStatus;

  @Column({ type: 'enum', enum: KycStatus, default: KycStatus.NOT_STARTED })
  kycStatus: KycStatus;

  @Column({ type: 'date' })
  dateOfBirth: Date;

  @Column()
  country: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ nullable: true })
  profilePicture?: string;

  @Column({ type: 'jsonb', nullable: true })
  kycData?: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  preferences?: Record<string, unknown>;

  @Column({ nullable: true })
  lastLogin?: Date;

  @Column('text', { array: true, default: [] })
  devices: string[];

  @Column({ default: false })
  isTwoFactorEnabled: boolean;

  @Column({ nullable: true })
  twoFactorSecret?: string;

  @Column('text', { array: true, default: [] })
  roles: string[];

  @Column({ nullable: true })
  verificationToken?: string;

  @Column({ nullable: true })
  lastIp?: string;

  @Column({ nullable: true })
  passwordResetToken?: string;

  @Column({ nullable: true })
  passwordResetExpires?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  emailVerifiedAt?: Date;
}