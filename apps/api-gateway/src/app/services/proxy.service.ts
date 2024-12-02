import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { ProxyRequest, ProxyResponse } from '../interfaces/proxy-request.interface';
import { CircuitBreaker } from '../utils/circuit-breaker';
import { RedisService } from '@moni-backend/redis';

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);
  private readonly circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private readonly CACHE_TTL = 3600;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService
  ) {
    this.initializeCircuitBreakers();
  }

  async forwardRequest(request: ProxyRequest): Promise<ProxyResponse> {
    const serviceUrl = this.getServiceUrl(request.path);
    const circuitBreaker = this.getCircuitBreaker(serviceUrl);
    const startTime = Date.now();

    try {
      const response = await circuitBreaker.execute(serviceUrl, async () => {
        if (request.method === 'GET') {
          const cachedResponse = await this.getCachedResponse(request);
          if (cachedResponse) {
            return cachedResponse;
          }
        }

        const response = await firstValueFrom(
          this.httpService.request({
            url: `${serviceUrl}${request.path}`,
            method: request.method,
            data: request.body,
            headers: this.filterHeaders(request.headers),
            params: request.query,
            timeout: 5000,
          })
        );

        if (request.method === 'GET') {
          await this.cacheResponse(request, response.data);
        }

        return {
          data: response.data,
          statusCode: response.status,
          headers: Object.fromEntries(
            Object.entries(response.headers).map(([key, value]) => [
              key,
              String(value),
            ])
          ),
          metadata: {
            serviceId: serviceUrl,
            responseTime: Date.now() - startTime,
            cached: false,
          },
        };
      });

      return response;
    } catch (error) {
      return this.handleProxyError(error, serviceUrl);
    }
  }
  private initializeCircuitBreakers(): void {
    const services = this.configService.get('services');
    Object.entries(services).forEach(
      ([, config]: [string, { url: string }]) => {
        this.circuitBreakers.set(
          config.url,
          new CircuitBreaker(this.redisService, {
            failureThreshold: 5,
            resetTimeout: 60000,
            halfOpenTimeout: 30000,
          })
        );
      }
    );
  }

  private getCircuitBreaker(serviceUrl: string): CircuitBreaker {
    return (
      this.circuitBreakers.get(serviceUrl) ||
      this.createCircuitBreaker(serviceUrl)
    );
  }

  private createCircuitBreaker(serviceUrl: string): CircuitBreaker {
    const breaker = new CircuitBreaker(this.redisService);
    this.circuitBreakers.set(serviceUrl, breaker);
    return breaker;
  }

  private async getCachedResponse(
    request: ProxyRequest
  ): Promise<ProxyResponse | null> {
    const cacheKey = this.generateCacheKey(request);
    const cached = await this.redisService.cacheGet<ProxyResponse>(cacheKey);

    if (cached) {
      return {
        data: cached.data,
        statusCode: HttpStatus.OK,
        headers: cached.headers,
        metadata: {
          serviceId: this.getServiceUrl(request.path),
          responseTime: 0,
          cached: true,
        },
      };
    }
    return null;
  }
  private async cacheResponse(
    request: ProxyRequest,
    response: ProxyResponse
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(request);
    await this.redisService.cacheSet(cacheKey, response, this.CACHE_TTL);
  }

  private generateCacheKey(request: ProxyRequest): string {
    return `proxy:${request.method}:${request.path}:${JSON.stringify(
      request.query
    )}`;
  }

  private getServiceUrl(path: string): string {
    const service = path.split('/')[1];
    return this.configService.get<string>(`services.${service}.url`);
  }

  private filterHeaders(
    headers: Record<string, string>
  ): Record<string, string> {
    const allowedHeaders = [
      'authorization',
      'content-type',
      'user-agent',
      'x-request-id',
      'x-correlation-id',
    ];

    return Object.entries(headers)
      .filter(([key]) => allowedHeaders.includes(key.toLowerCase()))
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
  }

  private handleProxyError(
    error: Error & { response?: { status?: number } },
    serviceUrl: string
  ): never {
    this.logger.error(
      `Proxy error for ${serviceUrl}: ${error.message}`,
      error.stack
    );

    throw new HttpException(
      {
        statusCode: error.response?.status || HttpStatus.BAD_GATEWAY,
        message: 'Proxy Error',
        error: error.message,
      },
      error.response?.status || HttpStatus.BAD_GATEWAY
    );
  }
}
