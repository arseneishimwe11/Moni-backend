import { Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { AlertingService } from '../services/alerting.service';

@Processor('monitoring')
export class MonitoringProcessor {
  private readonly logger = new Logger(MonitoringProcessor.name);

  constructor(private readonly alertingService: AlertingService) {}

  @Process('process_metrics')
  async handleMetricsProcessing(
    job: Job<{
      serviceId: string;
      metrics: {
        cpu?: number;
        memory?: number;
        errorRate?: number;
        responseTime?: number;
      };
      timestamp: number;
    }>
  ): Promise<void> {
    const { serviceId, metrics } = job.data;

    try {
      // Process CPU metrics
      if (metrics.cpu) {
        await this.alertingService.processMetricAlert(
          'cpu',
          metrics.cpu,
          serviceId
        );
      }

      // Process Memory metrics
      if (metrics.memory) {
        await this.alertingService.processMetricAlert(
          'memory',
          metrics.memory,
          serviceId
        );
      }

      // Process Error Rate
      if (metrics.errorRate) {
        await this.alertingService.processMetricAlert(
          'errorRate',
          metrics.errorRate,
          serviceId
        );
      }

      // Process Response Time
      if (metrics.responseTime) {
        await this.alertingService.processMetricAlert(
          'responseTime',
          metrics.responseTime,
          serviceId
        );
      }
    } catch (error) {
      this.logger.error(
        `Error processing metrics for service ${serviceId}: ${error.message}`
      );
      throw error;
    }
  }
}
