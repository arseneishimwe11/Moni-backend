import { Controller, All, Req, Logger, HttpStatus } from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { Request } from 'express';
import { RateLimit } from './decorators/rate-limiter.decorator';
import { ApiKeyGuard } from './guards/api-key.guard';
import { UseGuards } from '@nestjs/common';

@Controller()
@UseGuards(ApiKeyGuard)
export class GatewayController {
  private readonly logger = new Logger(GatewayController.name);

  constructor(private readonly gatewayService: GatewayService) {}

  @All('auth/*')
  @RateLimit({ limit: 5, windowMs: 15 * 60 * 1000 })
  async handleAuth(@Req() request: Request) {
    this.logger.debug(`Handling auth request: ${request.method} ${request.path}`);
    const response = await this.gatewayService.handleAuthRequest(request);
    return {
      statusCode: HttpStatus.OK,
      data: response
    };
  }

  @All('users/*')
  @RateLimit({ limit: 100, windowMs: 15 * 60 * 1000 })
  async handleUser(@Req() request: Request) {
    this.logger.debug(`Handling user request: ${request.method} ${request.path}`);
    const response = await this.gatewayService.handleUserRequest(request);
    return {
      statusCode: HttpStatus.OK,
      data: response
    };
  }

  @All('transactions/*')
  @RateLimit({ limit: 50, windowMs: 15 * 60 * 1000 })
  async handleTransaction(@Req() request: Request) {
    this.logger.debug(`Handling transaction request: ${request.method} ${request.path}`);
    const response = await this.gatewayService.handleTransactionRequest(request);
    return {
      statusCode: HttpStatus.OK,
      data: response
    };
  }

  @All('notifications/*')
  @RateLimit({ limit: 100, windowMs: 15 * 60 * 1000 })
  async handleNotification(@Req() request: Request) {
    this.logger.debug(`Handling notification request: ${request.method} ${request.path}`);
    const response = await this.gatewayService.handleNotificationRequest(request);
    return {
      statusCode: HttpStatus.OK,
      data: response
    };
  }

  @All('audit/*')
  @RateLimit({ limit: 50, windowMs: 15 * 60 * 1000 })
  async handleAudit(@Req() request: Request) {
    this.logger.debug(`Handling audit request: ${request.method} ${request.path}`);
    const response = await this.gatewayService.handleAuditRequest(request);
    return {
      statusCode: HttpStatus.OK,
      data: response
    };
  }
}
