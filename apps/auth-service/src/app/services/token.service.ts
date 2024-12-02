import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@moni-backend/redis';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly refreshTokenTTL = 30 * 24 * 60 * 60; // 30 days

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService
  ) {}

  async generateTokens(user: { id: string; email: string; roles: string[] }) {
    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(user),
      this.generateRefreshToken(user)
    ]);

    return { accessToken, refreshToken };
  }
  async generateAccessToken(user: { id: string; email: string; roles: string[] }): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      sessionId: uuidv4()
    };

    return this.jwtService.signAsync(payload, {
      expiresIn: '1h',
      secret: this.configService.get('JWT_ACCESS_SECRET')
    });
  }
  async generateRefreshToken(user: { id: string }): Promise<string> {
    const payload = {
      sub: user.id,
      tokenFamily: uuidv4()
    };

    return this.jwtService.signAsync(payload, {
      expiresIn: '30d',
      secret: this.configService.get('JWT_REFRESH_SECRET')
    });
  }
  async saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const key = `refresh_token:${userId}`;
    await this.redisService.cacheSet(key, refreshToken, this.refreshTokenTTL);
  }

  async getStoredRefreshToken(userId: string): Promise<string | null> {
    return this.redisService.cacheGet(`refresh_token:${userId}`);
  }

  async verifyRefreshToken(token: string): Promise<JwtPayload> {
    return this.jwtService.verifyAsync(token, {
      secret: this.configService.get('JWT_REFRESH_SECRET')
    });
  }
  async revokeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    await Promise.all([
      this.redisService.cacheDelete(`refresh_token:${userId}`),
      this.blacklistToken(refreshToken)
    ]);
  }

  async blacklistToken(token: string): Promise<void> {
    const decoded = this.jwtService.decode(token);
    const expiryTime = decoded['exp'] - Math.floor(Date.now() / 1000);
    await this.redisService.cacheSet(`blacklist:${token}`, true, expiryTime);
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    return await this.redisService.cacheGet(`blacklist:${token}`) !== null;
  }

  async invalidateAllUserSessions(userId: string): Promise<void> {
    await this.redisService.cacheSet(`user:${userId}:session_invalidated`, Date.now(), this.refreshTokenTTL);
  }
}
