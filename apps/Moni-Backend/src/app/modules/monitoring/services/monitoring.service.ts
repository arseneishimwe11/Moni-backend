import { Injectable, Logger } from '@nestjs/common';
import { MetricsService } from '../../metrics/services/metrics.service';
import { LoggingService } from '../../logging/services/logging.service';
import { AlertingService } from '../../alerting/services/alerting.service';
import { ServiceHealth, HealthStatus } from '../../discovery/interfaces/service-registry.interface';
import { SystemMetrics } from '../../metrics/interfaces/metrics.interface';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly ERROR_THRESHOLD = 0.1;
  private readonly WARNING_THRESHOLD = 0.05;
  private readonly MONITORING_INTERVAL = 30000; // 30 seconds

  constructor(
    private readonly metricsService: MetricsService,
    private readonly loggingService: LoggingService,
    private readonly alertingService: AlertingService
  ) {
    this.startMonitoring();
  }

  private startMonitoring(): void {
    setInterval(() => {
      this.monitorAllServices().catch((error) => {
        this.logger.error(`Monitoring cycle failed: ${error.message}`);
      });
    }, this.MONITORING_INTERVAL);
  }

  async monitorServiceHealth(serviceName: string): Promise<ServiceHealth> {
    try {
      const metrics = await this.metricsService.getServiceMetrics(serviceName);
      const logs = await this.loggingService.getRecentLogs(serviceName);
      const status = this.determineHealthStatus(metrics);

      const healthData: ServiceHealth = {
        serviceName,
        status,
        timestamp: new Date(),
        metrics: await this.getPerformanceMetrics(serviceName),
        recentIssues: this.analyzeRecentIssues(
          logs.map((log) => ({
            ...log,
            timestamp: log.timestamp.toISOString(),
          }))
        ),
        details: {
          lastCheck: new Date(),
          responseTime: metrics.responseTime,
          errorRate: metrics.errorRate,
          throughput: metrics.throughput,
        },
      };

      if (status === HealthStatus.UNHEALTHY) {
        await this.alertingService.processMetricAlert('health', 0, serviceName);
      }

      return healthData;
    } catch (error) {
      this.logger.error(
        `Failed to monitor service ${serviceName}: ${error.message}`
      );
      throw error;
    }
  }
  private determineHealthStatus(metrics: SystemMetrics): HealthStatus {
    const errorRate = metrics.errorCount / (metrics.requestCount || 1);

    if (errorRate > this.ERROR_THRESHOLD) {
      return HealthStatus.UNHEALTHY;
    }
    if (errorRate > this.WARNING_THRESHOLD) {
      return HealthStatus.DEGRADED;
    }
    return HealthStatus.HEALTHY;
  }

  private async getPerformanceMetrics(
    serviceName: string
  ): Promise<SystemMetrics> {
    const responseTime = await this.metricsService.getAverageResponseTime(
      serviceName
    );
    const throughput = await this.metricsService.getThroughput(serviceName);
    const errorRate = await this.metricsService.getErrorRate(serviceName);
    const cpuUsage = await this.metricsService.getCpuUsage(serviceName);
    const memoryUsage = await this.metricsService.getMemoryUsage(serviceName);
    const requestCount = await this.metricsService.getRequestCount(serviceName);
    const errorCount = await this.metricsService.getErrorCount(serviceName);

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
  private analyzeRecentIssues(
    logs: Array<{ level: string; type?: string; timestamp: string }>
  ): Array<{ type: string; count: number; lastOccurrence: Date }> {
    const issueGroups = logs
      .filter((log) => log.level === 'error' || log.level === 'warn')
      .reduce<Record<string, { count: number; lastOccurrence: Date }>>(
        (groups, log) => {
          const key = log.type || 'unknown';
          if (!groups[key]) {
            groups[key] = { count: 0, lastOccurrence: new Date(log.timestamp) };
          }
          groups[key].count++;
          groups[key].lastOccurrence = new Date(
            Math.max(
              groups[key].lastOccurrence.getTime(),
              new Date(log.timestamp).getTime()
            )
          );
          return groups;
        },
        {}
      );

    return Object.entries(issueGroups).map(([type, data]) => ({
      type,
      count: data.count,
      lastOccurrence: data.lastOccurrence,
    }));
  }
  private async monitorAllServices(): Promise<void> {
    const services = await this.metricsService.getMonitoredServices();

    await Promise.all(
      services.map(async (serviceName) => {
        try {
          await this.monitorServiceHealth(serviceName);
        } catch (error) {
          this.logger.error(
            `Failed to monitor service ${serviceName}: ${error.message}`
          );
        }
      })
    );
  }
}
