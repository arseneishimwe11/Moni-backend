export interface IUserPreferences {
  language: string;
  currency: string;
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  theme: 'light' | 'dark';
  timezone: string;
}

export interface IKycVerification {
  documentType: string;
  documentNumber: string;
  issuingCountry: string;
  expiryDate: Date;
  verificationStatus: string;
  verifiedAt?: Date;
  verificationMethod?: string;
  failureReason?: string;
}
