export interface ServiceConfig {
  host: string;
  port: number;
  healthCheck?: string;
  timeout?: number;
  retries?: number;
}

export interface ServiceRegistry {
  auth: ServiceConfig;
  user: ServiceConfig;
  transaction: ServiceConfig;
  notification: ServiceConfig;
  audit: ServiceConfig;
}

export interface ServiceHealth {
  serviceName: string;
  status: 'healthy' | 'unhealthy';
  lastCheck: Date;
  responseTime?: number;
  error?: string;
}

export interface ServiceDiscoveryOptions {
  refreshInterval?: number;
  healthCheckTimeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface ServiceMetrics {
  uptime: number;
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  lastError?: {
    message: string;
    timestamp: Date;
  };
}
