export interface LogEntry {
    timestamp: Date;
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
    service: string;
    message: string;
    metadata?: Record<string, unknown>;
    traceId?: string;
  }
  
  export interface ServiceMetrics {
    requestCount: number;
    errorCount: number;
    averageResponseTime: number;
    lastUpdated: Date;
  }
  
  export interface SystemLogs {
    logs: LogEntry[];
    metrics: {
      [serviceId: string]: ServiceMetrics;
    };
    summary: {
      totalLogs: number;
      errorCount: number;
      warningCount: number;
      startTime: Date;
      endTime: Date;
    };
    pagination: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  }
  