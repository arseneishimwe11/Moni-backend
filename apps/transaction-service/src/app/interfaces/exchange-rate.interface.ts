export interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  timestamp: Date;
  provider: string;
}

export interface ExchangeRateOptions {
  historical?: boolean;
  date?: Date;
  provider?: string;
}
