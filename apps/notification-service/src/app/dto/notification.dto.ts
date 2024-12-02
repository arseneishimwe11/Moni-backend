import { IsString, IsEnum, IsUUID, IsArray, IsOptional, IsObject, IsEmail, IsPhoneNumber } from 'class-validator';
import { NotificationType } from '../entities/notification.entity';

export class CreateNotificationDto {
  @IsUUID()
  userId: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsObject()
  content: Record<string, unknown>;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  @IsOptional()
  @IsPhoneNumber()
  recipientPhone?: string;

  @IsOptional()
  @IsString()
  deviceToken?: string;
}

export class SendNotificationDto {
  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[];

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class SendEmailDto {
  @IsUUID()
  userId: string;

  @IsEmail()
  to: string;

  @IsString()
  subject: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class SendSmsDto {
  @IsUUID()
  userId: string;

  @IsPhoneNumber()
  to: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
