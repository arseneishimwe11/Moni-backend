import { Injectable, Inject, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ClientProxy } from '@nestjs/microservices';
import { RedisService } from '@moni-backend/redis';
import { TokenService } from './services/token.service';
import { TwoFactorService } from './services/two-factor.service';
import { BiometricService } from './services/biometric.service';
import { LoginDto, BiometricLoginDto, RefreshTokenDto } from './dto/auth.dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly maxLoginAttempts = 5;
  private readonly lockoutDuration = 30 * 60; // 30 minutes

  constructor(
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
    @Inject('AUDIT_SERVICE') private readonly auditClient: ClientProxy,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly tokenService: TokenService,
    private readonly twoFactorService: TwoFactorService,
    private readonly biometricService: BiometricService
  ) {}

  async login(loginDto: LoginDto, ipAddress: string, userAgent: string) {
    const lockKey = `auth:lockout:${loginDto.email}`;
    const attempts = await this.redisService.cacheGet<number>(lockKey) || 0;

    if (attempts >= this.maxLoginAttempts) {
      throw new UnauthorizedException('Account temporarily locked. Please try again later.');
    }

    try {
      const user = await firstValueFrom(
        this.userClient.send('validate_credentials', {
          email: loginDto.email,
          password: loginDto.password
        })
      );

      if (user.isTwoFactorEnabled && !loginDto.twoFactorCode) {
        return { requiresTwoFactor: true };
      }

      if (user.isTwoFactorEnabled) {
        const isValidCode = await this.twoFactorService.verifyCode(
          user.id,
          loginDto.twoFactorCode
        );
        if (!isValidCode) {
          throw new UnauthorizedException('Invalid 2FA code');
        }
      }

      const tokens = await this.tokenService.generateTokens(user);
      await this.tokenService.saveRefreshToken(user.id, tokens.refreshToken);

      await this.auditClient.emit('auth_activity', {
        userId: user.id,
        action: 'LOGIN',
        metadata: {
          ipAddress,
          userAgent,
          timestamp: new Date()
        }
      }).toPromise();

      await this.redisService.cacheDelete(lockKey);
      return tokens;

    } catch (error) {
      await this.redisService.cacheSet(
        lockKey,
        attempts + 1,
        this.lockoutDuration
      );
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async biometricLogin(loginDto: BiometricLoginDto, ipAddress: string, userAgent: string) {
    const isValidBiometric = await this.biometricService.verifyBiometric(
      loginDto.userId,
      loginDto.biometricToken
    );

    if (!isValidBiometric) {
      throw new UnauthorizedException('Invalid biometric verification');
    }

    const user = await firstValueFrom(
      this.userClient.send('get_user', { userId: loginDto.userId })
    );

    const tokens = await this.tokenService.generateTokens(user);
    await this.tokenService.saveRefreshToken(user.id, tokens.refreshToken);

    await this.auditClient.emit('auth_activity', {
      userId: user.id,
      action: 'BIOMETRIC_LOGIN',
      metadata: {
        ipAddress,
        userAgent,
        timestamp: new Date()
      }
    }).toPromise();

    return tokens;
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    const decoded = await this.tokenService.verifyRefreshToken(
      refreshTokenDto.refreshToken
    );

    const storedToken = await this.tokenService.getStoredRefreshToken(decoded.userId);
    if (storedToken !== refreshTokenDto.refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await firstValueFrom(
      this.userClient.send('get_user', { userId: decoded.userId })
    );

    return this.tokenService.generateTokens(user);
  }

  async logout(userId: string, refreshToken: string) {
    await this.tokenService.revokeRefreshToken(userId, refreshToken);
    await this.auditClient.emit('auth_activity', {
      userId,
      action: 'LOGOUT',
      metadata: { timestamp: new Date() }
    }).toPromise();
  }

  async validateToken(token: string): Promise<Record<string, unknown>> {
    try {
      const decoded = this.jwtService.verify(token);
      const isBlacklisted = await this.tokenService.isTokenBlacklisted(token);
      
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }

      return decoded;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }}
