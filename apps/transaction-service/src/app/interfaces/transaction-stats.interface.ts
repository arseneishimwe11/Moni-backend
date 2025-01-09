export interface TransactionStats {
  totalTransactions: number;
  totalVolume: number;
  successRate: number;
  averageTransactionValue: number;
  byProvider: {
    [key: string]: {
      count: number;
      volume: number;
    };
  };
  byStatus: {
    [key: string]: number;
  };
  hourlyDistribution: {
    [key: number]: number;
  };
}

export interface StatisticsQuery {
  startDate?: Date;
  endDate?: Date;
  provider?: string;
  status?: string;
}
