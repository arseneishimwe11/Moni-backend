import { PaymentProvider } from "../dto/payment.dto";

export interface PaymentMethod {
  provider: PaymentProvider;
  supportedCurrencies: string[];
  limits: PaymentLimits;
}

export interface PaymentLimits {
  min: number;
  max: number;
  currency: string;
}
