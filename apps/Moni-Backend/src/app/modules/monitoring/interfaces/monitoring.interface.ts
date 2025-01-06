export interface ServiceMetrics {
    serviceName: string;
    requestCount: number;
    errorCount: number;
    averageResponseTime: number;
    cpuUsage: number;
    memoryUsage: number;
    activeConnections: number;
    timestamp: Date;
  }
  
  export interface AlertConfig {
    threshold: number;
    metric: string;
    condition: 'greater' | 'less' | 'equals';
    duration: number;
  }
  
  export interface MonitoringAlert {
    serviceName: string;
    metric: string;
    value: number;
    threshold: number;
    timestamp: Date;
    severity: 'low' | 'medium' | 'high';
  }
  