import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ExchangeRate } from '../interfaces/exchange-rate.interface';

@Injectable()
export class ExchangeRateProvider {
  private readonly logger = new Logger(ExchangeRateProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService
  ) {
    this.apiKey = this.configService.get<string>('EXCHANGE_RATE_API_KEY');
    this.baseUrl = 'https://api.exchangerate-api.com/v4/latest';
  }

  async getRate(fromCurrency: string, toCurrency: string): Promise<ExchangeRate> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/${fromCurrency}`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        })
      );

      const rate = data.rates[toCurrency];
      if (!rate) {
        throw new Error(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`);
      }

      return {
        fromCurrency,
        toCurrency,
        rate,
        timestamp: new Date(),
        provider: 'exchangerate-api'
      };
    } catch (error) {
      this.logger.error(`Failed to fetch exchange rate: ${error.message}`);
      throw new Error('Exchange rate service unavailable');
    }
  }

  async getBulkRates(baseCurrency: string, currencies: string[]): Promise<Record<string, number>> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/${baseCurrency}`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          },
          params: {
            symbols: currencies.join(',')
          }
        })
      );

      return data.rates;
    } catch (error) {
      this.logger.error(`Failed to fetch bulk exchange rates: ${error.message}`);
      throw new Error('Exchange rate service unavailable');
    }
  }

  async getHistoricalRate(fromCurrency: string, toCurrency: string, date: Date): Promise<ExchangeRate> {
    const formattedDate = date.toISOString().split('T')[0];
    
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/historical/${formattedDate}/${fromCurrency}`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        })
      );

      return {
        fromCurrency,
        toCurrency,
        rate: data.rates[toCurrency],
        timestamp: date,
        provider: 'exchangerate-api'
      };
    } catch (error) {
      this.logger.error(`Failed to fetch historical rate: ${error.message}`);
      throw new Error('Historical exchange rate service unavailable');
    }
  }
}
