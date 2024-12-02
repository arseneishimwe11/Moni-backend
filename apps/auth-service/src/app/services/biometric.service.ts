import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@moni-backend/redis';
import * as crypto from 'crypto';

@Injectable()
export class BiometricService {
  private readonly logger = new Logger(BiometricService.name);
  private readonly BIOMETRIC_TTL = 300; // 5 minutes

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService
  ) {}

  async verifyBiometric(userId: string, biometricToken: string): Promise<boolean> {
    const storedToken = await this.redisService.cacheGet(`biometric:${userId}`);
    if (!storedToken) {
      return false;
    }

    const isValid = this.verifyBiometricSignature(biometricToken, storedToken as string);
    if (isValid) {
      await this.redisService.cacheDelete(`biometric:${userId}`);
    }

    return isValid;
  }

  async generateBiometricChallenge(userId: string): Promise<string> {
    const challenge = crypto.randomBytes(32).toString('hex');
    await this.redisService.cacheSet(`biometric:challenge:${userId}`, challenge, this.BIOMETRIC_TTL);
    return challenge;
  }

  async verifyBiometricChallenge(userId: string, response: string): Promise<boolean> {
    const challenge = await this.redisService.cacheGet(`biometric:challenge:${userId}`);
    if (!challenge) {
      return false;
    }

    const isValid = this.verifyBiometricResponse(response, challenge as string);
    await this.redisService.cacheDelete(`biometric:challenge:${userId}`);
    return isValid;
  }

  private verifyBiometricSignature(token: string, storedToken: string): boolean {
    const hmac = crypto.createHmac('sha256', this.configService.get('BIOMETRIC_SECRET'));
    hmac.update(token);
    const signature = hmac.digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(storedToken));
  }

  private verifyBiometricResponse(response: string, challenge: string): boolean {
    const expectedResponse = crypto
      .createHmac('sha256', this.configService.get('BIOMETRIC_SECRET'))
      .update(challenge)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(response), Buffer.from(expectedResponse));
  }
}
