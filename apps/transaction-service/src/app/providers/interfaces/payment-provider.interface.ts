import { CreateDisputeDto } from "../../dto/create-dispute.dto";
import { PaymentDto, PaymentStatus, RefundStatus } from "../../dto/payment.dto";

export interface IPaymentProvider {
    readonly name: string;
    readonly supportedCurrencies: string[];
    readonly supportedRegions: string[];
    
    processPayment(paymentData: PaymentDto): Promise<PaymentResult>;
    validatePayment(paymentData: PaymentDto): Promise<boolean>;
    refundPayment(transactionId: string, amount?: number): Promise<RefundResult>;
    createDispute(transactionId: string, disputeDto: CreateDisputeDto): unknown;
    getPaymentStatus(transactionId: string): Promise<PaymentStatus>;
    verifyWebhookSignature(payload: unknown, signature: string): Promise<boolean>;
    verifyPayment(verificationData: unknown): Promise<PaymentResult>; 
  }  
  export interface PaymentResult {
    providerReference: string;
    status: PaymentStatus;
    amount: number;
    currency: string;
    metadata?: Record<string, unknown>;
    processingTime?: number;
  }
  
  export interface RefundResult {
    refundId: string;
    status: RefundStatus;
    amount: number;
    transactionId: string;
    timestamp: Date;
  }
  