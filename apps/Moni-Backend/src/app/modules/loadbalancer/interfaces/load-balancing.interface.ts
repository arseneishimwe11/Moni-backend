import { ServiceInstance } from '../../discovery/interfaces/service-registry.interface';

export interface LoadBalancingStrategy {
  getNext(instances: ServiceInstance[]): Promise<ServiceInstance>;
  getName(): string;
  getMetrics(): Promise<LoadBalancerMetrics>;
  updateMetrics?(instance: ServiceInstance): Promise<void>;
}

export interface WeightedInstance extends ServiceInstance {
  weight: number;
  currentWeight: number;
}

export interface ConnectionMetrics {
  activeConnections: number;
  totalRequests: number;
  errorRate: number;
  responseTime: number;
}

export interface LoadBalancerMetrics {
  strategy: string;
  totalRequests: number;
  activeConnections: number;
  instanceMetrics: InstanceMetrics[];
}

export interface InstanceMetrics {
  instanceId: string;
  activeConnections: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastUsed: Date;
}

export interface LoadBalancerConfig {
  defaultStrategy: string;
  healthCheckInterval: number;
  maxRetries: number;
  timeout: number;
  metrics: {
    enabled: boolean;
    retentionPeriod: number;
  };
}

export interface StrategyOptions {
  weights?: Record<string, number>;
  maxConnections?: number;
  responseTimeout?: number;
}
