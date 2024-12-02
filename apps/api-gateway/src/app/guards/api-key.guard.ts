import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@moni-backend/redis';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API key is missing');
    }

    const cacheKey = `api_key:${apiKey}`;
    const cachedValidation = await this.redisService.cacheGet<boolean>(cacheKey);

    if (cachedValidation !== null) {
      return cachedValidation;
    }

    const isValid = this.validateApiKey(apiKey);
    await this.redisService.cacheSet(cacheKey, isValid, 3600);

    if (!isValid) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }

  private validateApiKey(apiKey: string): boolean {
    const validApiKey = this.configService.get<string>('apiKey');
    return apiKey === validApiKey;
  }
}
