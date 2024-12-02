import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verify, JwtPayload } from 'jsonwebtoken';
import { RedisService } from '@moni-backend/redis';

interface CustomJwtPayload extends JwtPayload {
  userId: string;
  roles: string[];
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    try {
      const decoded = verify(token, this.configService.get<string>('JWT_SECRET')) as CustomJwtPayload;
      const isBlacklisted = await this.checkTokenBlacklist(token);

      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }

      const sessionInvalidated = await this.checkSessionValidity(decoded.userId);
      if (sessionInvalidated) {
        throw new UnauthorizedException('Session has been invalidated');
      }

      request.user = decoded;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
  private extractTokenFromHeader(request: { headers: { authorization?: string } }): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private async checkTokenBlacklist(token: string): Promise<boolean> {
    return await this.redisService.cacheGet(`blacklist:${token}`) !== null;
  }

  private async checkSessionValidity(userId: string): Promise<boolean> {
    const invalidatedAt = await this.redisService.cacheGet(`user:${userId}:session_invalidated`);
    return invalidatedAt !== null;
  }
}
