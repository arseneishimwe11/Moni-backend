import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@moni-backend/redis';

@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);
  private readonly alertThresholds = {
    cpu: 80,
    memory: 85,
    errorRate: 5,
    responseTime: 2000,
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService
  ) {}

  async processMetricAlert(
    metricName: string,
    value: number,
    serviceId: string
  ): Promise<void> {
    const threshold = this.alertThresholds[metricName];
    if (value > threshold) {
      await this.createAlert({
        type: 'THRESHOLD_BREACH',
        severity: 'HIGH',
        serviceId,
        metric: metricName,
        value,
        threshold,
        timestamp: new Date(),
      });
    }
  }

  private async createAlert(alertData: {
    type: string;
    severity: string;
    serviceId: string;
    metric: string;
    value: number;
    threshold: number;
    timestamp: Date;
  }): Promise<void> {
    const alertKey = `alerts:${alertData.serviceId}:${Date.now()}`;
    await this.redisService.cacheSet(alertKey, alertData, 86400);
    this.logger.warn(`Alert created: ${JSON.stringify(alertData)}`);
  }
}
