import { IsString, IsEmail, IsPhoneNumber, IsOptional, IsDate, MinLength, Matches, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserStatus, KycStatus } from '../entities/user.entity';

export class CreateUserDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
  })
  password: string;

  @IsPhoneNumber()
  phoneNumber: string;

  @Transform(({ value }) => new Date(value))
  @IsDate()
  dateOfBirth: Date;

  @IsString()
  country: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  address?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsPhoneNumber()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  preferences?: Record<string, unknown>;
}

export class KycSubmissionDto {
  @IsString()
  documentType: string;

  @IsString()
  documentNumber: string;

  @Transform(({ value }) => new Date(value))
  @IsDate()
  expiryDate: Date;

  @IsString()
  documentFront: string;

  @IsString()
  documentBack: string;

  @IsOptional()
  @IsString()
  selfie?: string;

  @IsOptional()
  additionalInfo?: Record<string, unknown>;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
    message: 'New password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
  })
  newPassword: string;

  @IsString()
  confirmPassword: string;
}

export class UserResponseDto {
  @IsUUID()
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  status: UserStatus;
  kycStatus: KycStatus;
  country: string;
  city?: string;
  address?: string;
  profilePicture?: string;
  dateOfBirth: Date;
  lastLogin?: Date;
  isTwoFactorEnabled: boolean;
  preferences?: Record<string, unknown>;
  devices?: string[];
  roles?: string[];
  createdAt?: Date;
  updatedAt?: Date;
  emailVerifiedAt?: Date;
}


