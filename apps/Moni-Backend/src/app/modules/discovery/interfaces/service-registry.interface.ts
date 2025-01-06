import { SystemMetrics } from '../../metrics/interfaces/metrics.interface';

export interface ServiceInstance {
  name: string;
  id: string;
  host: string;
  port: number;
  status: 'active' | 'inactive';
  lastHeartbeat: Date;
  metadata: {
    cpuUsage: number;
    memoryUsage: number;
    version: string;
    region: string;
    environment: string;
  };
}

export interface ServiceRegistration {
  status: string;
  id: string;
  instances: ServiceInstance[];
  lastHeartbeat: Date;
  name: string;
  version: string;
  host: string;
  port: number;
  healthCheckUrl: string;
  metadata: Record<string, unknown>;
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

export interface ServiceHealth {
  serviceName: string;
  status: HealthStatus;
  timestamp: Date;
  metrics: SystemMetrics;
  details: HealthDetails;
  recentIssues: ServiceIssue[];
}

export interface HealthDetails {
  lastCheck: Date;
  responseTime: number;
  errorRate: number;
  throughput: number;
}

export interface ServiceIssue {
  type: string;
  count: number;
  lastOccurrence: Date;
}
