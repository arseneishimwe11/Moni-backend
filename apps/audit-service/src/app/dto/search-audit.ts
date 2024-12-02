import { IsOptional, IsUUID, IsString, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

export class SearchAuditLogsDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  resourceType?: string;

  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => new Date(value))
  startDate?: Date;

  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => new Date(value))
  endDate?: Date;

  @IsOptional()
  @IsString()
  status?: string;
}
