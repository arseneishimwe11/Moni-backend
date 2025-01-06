export interface MetricData {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: Date;
}

export interface MetricQuery {
  serviceName: string;
  metricName: string;
  startTime: Date;
  endTime: Date;
  interval: string;
  metricType: string;
}

export interface SystemMetrics {
  cpu: number;
  memory: number;
  requests: number;
  latency: number;
  responseTime: number;
  throughput: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  requestCount: number;
  errorCount: number;
}

export interface MetricAggregation {
  avg: number;
  max: number;
  min: number;
  p95: number;
  p99: number;
}
