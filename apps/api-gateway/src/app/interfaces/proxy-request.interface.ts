export interface ProxyRequest {
  path: string;
  method: string;
  body?: unknown;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  headers: Record<string, string>;
  user?: unknown;
  timestamp: number;
  correlationId: string;
  serviceUrl: string;
}

export interface ProxyResponse {
  data: unknown;
  statusCode: number;
  headers?: Record<string, string>;
  metadata?: {
    serviceId: string;
    responseTime: number;
    cached: boolean;
  };
}

export interface ProxyError {
  statusCode: number;
  message: string;
  error: string;
  timestamp: number;
  path: string;
  correlationId: string;
  serviceId?: string;
}

export interface ProxyMetrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  lastError?: {
    message: string;
    timestamp: Date;
  };
}
