import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@moni-backend/redis';
import { ClientProxy } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
    @Inject('AUDIT_SERVICE') private readonly auditClient: ClientProxy
  ) {}

  async processMetricAlert(
    metricType: string,
    value: number,
    serviceId: string
  ): Promise<void> {
    const thresholds = this.getThresholds(metricType);

    if (value > thresholds.critical) {
      await this.triggerAlert({
        severity: 'critical',
        service: serviceId,
        metric: metricType,
        value,
        message: `Critical threshold exceeded for ${metricType}`,
      });
    } else if (value > thresholds.warning) {
      await this.triggerAlert({
        severity: 'warning',
        service: serviceId,
        metric: metricType,
        value,
        message: `Warning threshold exceeded for ${metricType}`,
      });
    }
  }

  private async triggerAlert(alert: SystemAlert) {
    const alertId = uuidv4();
    const alertRecord = {
      id: alertId,
      timestamp: new Date(),
      status: 'active',
      ...alert,
    };

    // Store alert in Redis
    await this.redisService.cacheSet(
      `alerts:${alertId}`,
      alertRecord,
      86400 // 24 hours
    );

    // Send to notification service
    await this.notificationClient.emit('system_alert', alertRecord).toPromise();

    // Log to audit service
    await this.auditClient
      .emit('system_alert', {
        type: 'SYSTEM_ALERT',
        severity: alert.severity,
        details: alertRecord,
      })
      .toPromise();

    this.logger.warn(`Alert triggered: ${alert.message}`);
  }

  private getThresholds(metricType: string): {
    warning: number;
    critical: number;
  } {
    const thresholds = {
      cpu: { warning: 80, critical: 90 },
      memory: { warning: 85, critical: 95 },
      errorRate: { warning: 0.05, critical: 0.1 },
      responseTime: { warning: 1000, critical: 2000 },
    };

    return thresholds[metricType] || { warning: 80, critical: 90 };
  }
}
interface SystemAlert {
  severity: 'warning' | 'critical';
  service: string;
  metric: string;
  value: number;
  message: string;
}
