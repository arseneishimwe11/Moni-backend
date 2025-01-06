import { IsString, IsNotEmpty, IsUrl, IsEnum, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ServiceType {
  MICROSERVICE = 'MICROSERVICE',
  EXTERNAL_API = 'EXTERNAL_API',
  DATABASE = 'DATABASE',
  CACHE = 'CACHE',
  MESSAGE_QUEUE = 'MESSAGE_QUEUE'
}

export class RegisterServiceDto {
  @ApiProperty({ description: 'Unique identifier for the service' })
  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty({ description: 'Name of the service' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Service type', enum: ServiceType })
  @IsEnum(ServiceType)
  type: ServiceType;

  @ApiProperty({ description: 'Base URL of the service' })
  @IsUrl()
  @IsNotEmpty()
  baseUrl: string;

  @ApiProperty({ description: 'Service version', example: '1.0.0' })
  @IsString()
  @IsNotEmpty()
  version: string;

  @ApiProperty({ description: 'Health check endpoint', required: false })
  @IsString()
  @IsOptional()
  healthCheckEndpoint?: string;

  @ApiProperty({ description: 'Timeout in milliseconds', required: false })
  @IsNumber()
  @IsOptional()
  timeout?: number;

  @ApiProperty({ description: 'Maximum retry attempts', required: false })
  @IsNumber()
  @IsOptional()
  maxRetries?: number;
}
