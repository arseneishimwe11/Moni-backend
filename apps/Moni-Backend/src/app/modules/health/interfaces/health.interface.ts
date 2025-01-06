export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  metrics: HealthMetrics;
  details: {
    version?: string;
    uptime: number;
    environment?: string;
    region?: string;
    instanceId: string;
    host: string;
    port: number;
    [key: string]: unknown;
  };
}
  
  export interface HealthDetails {
    version: string;
    uptime: number;
    environment: string;
    region: string;
    instanceId: string;
  }
  
  export interface HealthMetrics {
    cpu: {
      usage: number;
      load: number;
    };
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    disk: {
      used: number;
      total: number;
      percentage: number;
    };
    network: {
      connections: number;
      bytesIn: number;
      bytesOut: number;
    };
  }
  
  export interface HealthCheckResult {
    status: boolean;
    responseTime: number;
    error?: string;
    lastCheck: Date;
  }
  
  export interface SystemHealth {
    services: Record<string, ServiceHealth>;
    dependencies: Record<string, HealthCheckResult>;
    timestamp: Date;
    overall: 'healthy' | 'degraded' | 'unhealthy';
  }
  
  export interface HealthCheckResponse {
    [key: string]: unknown;
    status: 'up' | 'down';
    details: Record<string, unknown>;
}