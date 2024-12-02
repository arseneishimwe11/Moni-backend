import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@moni-backend/redis';
import * as speakeasy from 'speakeasy';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);
  private readonly BACKUP_CODES_COUNT = 10;
  private readonly CODE_TTL = 300; // 5 minutes

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService
  ) {}

  async generateSecret(
    userId: string,
    email: string
  ): Promise<{ secret: string; qrCode: string }> {
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `MONI:${email}`,
      issuer: 'MONI Financial',
    });

    await this.redisService.cacheSet(
      `2fa:secret:${userId}`,
      secret.base32,
      86400
    );
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCode,
    };
  }

  async verifyCode(userId: string, code: string): Promise<boolean> {
    const secret = await this.redisService.cacheGet(`2fa:secret:${userId}`);
    if (!secret) {
      return false;
    }

    const isValid = speakeasy.totp.verify({
      secret: secret as string,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (isValid) {
      await this.preventCodeReuse(userId, code);
    }

    return isValid;
  }

  async generateBackupCodes(userId: string): Promise<string[]> {
    const codes = Array.from({ length: this.BACKUP_CODES_COUNT }, () =>
      crypto.randomBytes(4).toString('hex')
    );

    const hashedCodes = codes.map((code) => this.hashBackupCode(code));
    await this.redisService.cacheSet(`2fa:backup:${userId}`, hashedCodes, 0);

    return codes;
  }

  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const storedCodes = await this.redisService.cacheGet<string[]>(
      `2fa:backup:${userId}`
    );
    if (!storedCodes) {
      return false;
    }

    const hashedCode = this.hashBackupCode(code);
    const index = storedCodes.indexOf(hashedCode);

    if (index !== -1) {
      storedCodes.splice(index, 1);
      await this.redisService.cacheSet(`2fa:backup:${userId}`, storedCodes, 0);
      return true;
    }

    return false;
  }

  private async preventCodeReuse(userId: string, code: string): Promise<void> {
    const key = `2fa:used:${userId}:${code}`;
    const isUsed = await this.redisService.cacheGet(key);

    if (isUsed) {
      throw new Error('Code has already been used');
    }

    await this.redisService.cacheSet(key, true, this.CODE_TTL);
  }

  private hashBackupCode(code: string): string {
    return crypto
      .createHmac('sha256', this.configService.get('TWO_FACTOR_SECRET'))
      .update(code)
      .digest('hex');
  }
}
