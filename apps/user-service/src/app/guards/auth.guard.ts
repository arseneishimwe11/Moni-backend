import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@moni-backend/redis';
import { verify } from 'jsonwebtoken';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private configService: ConfigService,
    private redisService: RedisService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const decoded = verify(token, this.configService.get('JWT_SECRET'));
      const isBlacklisted = await this.checkTokenBlacklist(token);

      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }

      request.user = decoded;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractToken(request: any): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) return null;

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }

  private async checkTokenBlacklist(token: string): Promise<boolean> {
    return await this.redisService.cacheGet(`blacklist:${token}`) !== null;
  }
}
