export interface SystemStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    timestamp: Date;
    environment: string;
    version: string;
    region: string;
    services: {
      total: number;
      healthy: number;
      instances: ServiceRegistration[];
    };
    metrics: {
      cpu: number;
      memory: number;
      requests: number;
      latency: number;
    };
  }
  
  export interface SystemMetrics {
    cpu: {
      usage: number;
      load: number[];
    };
    memory: {
      total: number;
      used: number;
      free: number;
    };
    requests: {
      total: number;
      success: number;
      failed: number;
      latency: number;
    };
    services: Record<string, ServiceMetrics>;
  }
  
  export interface ServiceMetrics {
    status: string;
    uptime: number;
    responseTime: number;
    errorRate: number;
    requestCount: number;
  }
  
  export interface SystemConfig {
    environment: string;
    region: string;
    services: string[];
    features: Record<string, boolean>;
    limits: {
      rateLimit: number;
      maxConnections: number;
      timeout: number;
    };
    security: {
      authEnabled: boolean;
      apiKeyRequired: boolean;
      corsEnabled: boolean;
    };
  }
  
  export interface ServiceRegistration {
    id: string;
    name: string;
    status: string;
    instances: ServiceInstance[];
    lastHeartbeat: Date;
    metadata: Record<string, unknown>;
  }  
  export interface ServiceInstance {
    id: string;
    host: string;
    port: number;
    status: string;
    metadata: Record<string, unknown>;
  }
  