import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IPaymentProvider } from './interfaces/payment-provider.interface';
import { StripeProvider } from './implementations/stripe.provider';
import { MomoProvider } from './implementations/momo.provider';
import { PaymentProvider, PaymentRegion } from '../dto/payment.dto';
import { PaymentProviderNotFoundException } from '../exceptions/payment-provider-not-found.exception';
import { RedisService } from '@moni-backend/redis';

@Injectable()
export class PaymentProviderFactory implements OnModuleInit {
  private readonly providers: Map<PaymentProvider, IPaymentProvider>;
  private readonly logger = new Logger(PaymentProviderFactory.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService
  ) {
    this.providers = new Map<PaymentProvider, IPaymentProvider>();
  }

  onModuleInit() {
    this.initializeProviders();
  }

  private initializeProviders() {
    this.providers.set(
      PaymentProvider.STRIPE, 
      new StripeProvider(this.configService, this.redisService)
    );
    this.providers.set(
      PaymentProvider.MOMO, 
      new MomoProvider(this.configService, this.redisService)
    );

    this.logger.log(`Initialized ${this.providers.size} payment providers`);
  }

  getProvider(providerName: PaymentProvider): IPaymentProvider {
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      this.logger.error(`Payment provider ${providerName} not found`);
      throw new PaymentProviderNotFoundException(providerName);
    }

    return provider;
  }

  validateProviderForRegion(provider: PaymentProvider, region: PaymentRegion): boolean {
    const paymentProvider = this.getProvider(provider);
    return paymentProvider.supportedRegions.includes(region);
  }

  getSupportedProvidersForRegion(region: PaymentRegion): PaymentProvider[] {
    return Array.from(this.providers.entries())
      .filter(([, provider]) => provider.supportedRegions.includes(region))
      .map(([name]) => name);
  }

  async isProviderAvailable(provider: PaymentProvider): Promise<boolean> {
    const cacheKey = `provider:available:${provider}`;
    const cached = await this.redisService.cacheGet<boolean>(cacheKey);
    
    if (cached !== null) {
      return cached;
    }

    const isAvailable = this.providers.has(provider);
    await this.redisService.cacheSet(cacheKey, isAvailable, 300);
    
    return isAvailable;
  }
}