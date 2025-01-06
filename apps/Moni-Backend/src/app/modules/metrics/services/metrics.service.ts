import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@moni-backend/redis';
import { SystemMetrics } from '../interfaces/metrics.interface';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly METRICS_PREFIX = 'metrics';
  private readonly METRICS_TTL = 86400; // 24 hours
  private readonly AGGREGATION_WINDOW = 300; // 5 minutes in seconds

  constructor(private readonly redisService: RedisService) {}

  async recordMetric(data: {
    serviceName: string;
    metricName: string;
    value: number;
    timestamp?: Date;
    labels?: Record<string, string>;
  }): Promise<void> {
    const timestamp = data.timestamp || new Date();
    const key = `${this.METRICS_PREFIX}:${data.serviceName}:${
      data.metricName
    }:${timestamp.getTime()}`;

    await this.redisService.cacheSet(
      key,
      {
        ...data,
        timestamp,
      },
      this.METRICS_TTL
    );
  }

  async getServiceMetrics(serviceName: string): Promise<SystemMetrics> {
    const timeRange = Date.now() - this.AGGREGATION_WINDOW * 1000;
    const pattern = `${this.METRICS_PREFIX}:${serviceName}:*`;

    const metrics = await this.redisService.scanPattern(pattern);
    const recentMetrics = metrics.filter(
      (m) => parseInt(m.split(':')[3]) > timeRange
    );

    const responseTime = await this.calculateAverageMetric(recentMetrics);
    const throughput = await this.calculateThroughput(serviceName, timeRange);
    const errorRate = await this.calculateErrorRate(serviceName, timeRange);
    const cpuUsage = await this.getLatestMetric(serviceName, 'cpuUsage');
    const memoryUsage = await this.getLatestMetric(serviceName, 'memoryUsage');
    const requestCount = await this.countMetrics(
      serviceName,
      'request',
      timeRange
    );
    const errorCount = await this.countMetrics(serviceName, 'error', timeRange);

    return {
      cpu: cpuUsage,
      memory: memoryUsage,
      requests: requestCount,
      responseTime: responseTime,
      errorRate: errorRate,
      throughput: throughput,
      cpuUsage: cpuUsage,
      memoryUsage: memoryUsage,
      errorCount: errorCount,
      requestCount: requestCount,
      latency: responseTime,
    };
  }
  async getAverageResponseTime(serviceName: string): Promise<number> {
    const pattern = `${this.METRICS_PREFIX}:${serviceName}:responseTime:*`;
    const metrics = await this.redisService.scanPattern(pattern);
    return this.calculateAverageMetric(metrics);
  }

  async getThroughput(serviceName: string): Promise<number> {
    const timeRange = Date.now() - this.AGGREGATION_WINDOW * 1000;
    return this.calculateThroughput(serviceName, timeRange);
  }

  async getErrorRate(serviceName: string): Promise<number> {
    const timeRange = Date.now() - this.AGGREGATION_WINDOW * 1000;
    return this.calculateErrorRate(serviceName, timeRange);
  }

  async getCpuUsage(serviceName: string): Promise<number> {
    return this.getLatestMetric(serviceName, 'cpuUsage');
  }

  async getMemoryUsage(serviceName: string): Promise<number> {
    return this.getLatestMetric(serviceName, 'memoryUsage');
  }

  async getRequestCount(serviceName: string): Promise<number> {
    const timeRange = Date.now() - this.AGGREGATION_WINDOW * 1000;
    return this.countMetrics(serviceName, 'request', timeRange);
  }

  async getErrorCount(serviceName: string): Promise<number> {
    const timeRange = Date.now() - this.AGGREGATION_WINDOW * 1000;
    return this.countMetrics(serviceName, 'error', timeRange);
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    return {
      cpu: await this.getCpuUsage('system'),
      memory: await this.getMemoryUsage('system'),
      requests: await this.getRequestCount('system'),
      latency: await this.getAverageResponseTime('system'),
      throughput: await this.getThroughput('system'),
      errorRate: await this.getErrorRate('system'),
      errorCount: await this.getErrorCount('system'),
      responseTime: await this.getAverageResponseTime('system'),
      cpuUsage: await this.getCpuUsage('system'),
      memoryUsage: await this.getMemoryUsage('system'),
      requestCount: await this.getRequestCount('system'),
    };
  }

  async getMonitoredServices(): Promise<string[]> {
    const pattern = `${this.METRICS_PREFIX}:*`;
    const keys = await this.redisService.scanPattern(pattern);
    return [...new Set(keys.map((key) => key.split(':')[1]))];
  }
  async queryMetrics(query: {
    startTime: number;
    endTime: number;
    metricName: string;
  }): Promise<number> {
    const pattern = `${this.METRICS_PREFIX}:*:${query.metricName}:*`;
    const keys = await this.redisService.scanPattern(pattern);
    const metrics = keys.filter((key) => {
      const timestamp = parseInt(key.split(':').pop() || '0', 10);
      return timestamp >= query.startTime && timestamp <= query.endTime;
    });
    return this.calculateAverageMetric(metrics);
  }

  private async calculateAverageMetric(metrics: string[]): Promise<number> {
    const values = await Promise.all(
      metrics.map(async (key) => {
        const data = await this.redisService.cacheGet(key);
        return (data as { value: number })?.value || 0;
      })
    );

    return values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
  }
  private async calculateThroughput(
    serviceName: string,
    timeRange: number
  ): Promise<number> {
    const requestCount = await this.countMetrics(
      serviceName,
      'request',
      timeRange
    );
    return requestCount / (this.AGGREGATION_WINDOW / 60); // requests per minute
  }

  private async calculateErrorRate(
    serviceName: string,
    timeRange: number
  ): Promise<number> {
    const errorCount = await this.countMetrics(serviceName, 'error', timeRange);
    const requestCount = await this.countMetrics(
      serviceName,
      'request',
      timeRange
    );
    return requestCount ? errorCount / requestCount : 0;
  }

  private async getLatestMetric(
    serviceName: string,
    metricName: string
  ): Promise<number> {
    const pattern = `${this.METRICS_PREFIX}:${serviceName}:${metricName}:*`;
    const metrics = await this.redisService.scanPattern(pattern);

    if (!metrics.length) return 0;

    const latestKey = metrics.sort().pop();
    const data = await this.redisService.cacheGet(latestKey);
    return (data as { value: number })?.value || 0;
  }
  private async countMetrics(
    serviceName: string,
    metricType: string,
    timeRange: number
  ): Promise<number> {
    const pattern = `${this.METRICS_PREFIX}:${serviceName}:${metricType}:*`;
    const metrics = await this.redisService.scanPattern(pattern);
    return metrics.filter((key) => parseInt(key.split(':')[3]) > timeRange)
      .length;
  }
}
