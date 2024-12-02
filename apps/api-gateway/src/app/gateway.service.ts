import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Request } from 'express';
import { RedisService } from '@moni-backend/redis';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);

  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
    @Inject('TRANSACTION_SERVICE') private readonly transactionClient: ClientProxy,
    @Inject('NOTIFICATION_SERVICE') private readonly notificationClient: ClientProxy,
    @Inject('AUDIT_SERVICE') private readonly auditClient: ClientProxy,
    private readonly redisService: RedisService
  ) {}

  async handleAuthRequest(request: Request) {
    try {
      return await lastValueFrom(
        this.authClient.send({ cmd: this.getPattern(request) }, {
          body: request.body,
          params: request.params,
          query: request.query,
          headers: this.filterHeaders(request.headers as Record<string, string>),
          user: request['user']
        })
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  async handleUserRequest(request: Request) {
    try {
      const cacheKey = this.getCacheKey(request);
      if (request.method === 'GET') {
        const cached = await this.redisService.cacheGet(cacheKey);
        if (cached) return cached;
      }

      const response = await lastValueFrom(
        this.userClient.send({ cmd: this.getPattern(request) }, {
          body: request.body,
          params: request.params,
          query: request.query,
          headers: this.filterHeaders(request.headers as Record<string, string>),
          user: request['user']
        })
      );

      if (request.method === 'GET') {
        await this.redisService.cacheSet(cacheKey, response, 3600);
      }

      return response;
    } catch (error) {
      this.handleError(error);
    }
  }

  async handleTransactionRequest(request: Request) {
    try {
      return await lastValueFrom(
        this.transactionClient.send({ cmd: this.getPattern(request) }, {
          body: request.body,
          params: request.params,
          query: request.query,
          headers: this.filterHeaders(request.headers as Record<string, string>),
          user: request['user']
        })
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  async handleNotificationRequest(request: Request) {
    try {
      return await lastValueFrom(
        this.notificationClient.send({ cmd: this.getPattern(request) }, {
          body: request.body,
          params: request.params,
          query: request.query,
          headers: this.filterHeaders(request.headers as Record<string, string>),
          user: request['user']
        })
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  async handleAuditRequest(request: Request) {
    try {
      return await lastValueFrom(
        this.auditClient.send({ cmd: this.getPattern(request) }, {
          body: request.body,
          params: request.params,
          query: request.query,
          headers: this.filterHeaders(request.headers as Record<string, string>),
          user: request['user']
        })
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  private getPattern(request: Request): string {
    return `${request.method.toLowerCase()}.${request.path.replace(/^\/+/, '')}`;
  }

  private getCacheKey(request: Request): string {
    return `gateway:${request.method}:${request.path}:${JSON.stringify(request.query)}`;
  }

  private filterHeaders(headers: Record<string, string>): Record<string, string> {
    const allowedHeaders = ['authorization', 'user-agent', 'x-api-key'];
    return Object.keys(headers)
      .filter(key => allowedHeaders.includes(key.toLowerCase()))
      .reduce((obj, key) => {
        obj[key] = headers[key];
        return obj;
      }, {} as Record<string, string>);
  }

  private handleError(error: Error & { status?: number }) {
    this.logger.error(`Gateway error: ${error.message}`, error.stack);
    throw new HttpException(
      error.message || 'Internal server error',
      error.status || HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
