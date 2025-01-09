import { ExchangeRate } from './exchange-rate.interface';

export interface ExchangeRateProviderInterface {
  getRate(fromCurrency: string, toCurrency: string): Promise<ExchangeRate>;
  getBulkRates(
    baseCurrency: string,
    currencies: string[]
  ): Promise<Record<string, number>>;
  getHistoricalRate(
    fromCurrency: string,
    toCurrency: string,
    date: Date
  ): Promise<ExchangeRate>;
}
