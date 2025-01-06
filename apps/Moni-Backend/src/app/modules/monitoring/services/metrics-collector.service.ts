import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@moni-backend/redis';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class MetricsCollectorService {
  private readonly logger = new Logger(MetricsCollectorService.name);
  private readonly metricsRetention = 86400; // 24 hours

  constructor(
    private readonly redisService: RedisService,
    @InjectQueue('monitoring') private readonly monitoringQueue: Queue
  ) {}

  async collectMetrics(
    serviceId: string,
    metrics: Record<string, unknown>
  ): Promise<void> {
    const timestamp = Date.now();
    const metricsKey = `metrics:${serviceId}:${timestamp}`;

    await Promise.all([
      this.redisService.cacheSet(metricsKey, metrics, this.metricsRetention),
      this.monitoringQueue.add('process_metrics', {
        serviceId,
        metrics,
        timestamp,
      }),
    ]);
  }
  async getServiceMetrics(
    serviceId: string,
    timeRange: number
  ): Promise<Record<string, unknown>[]> {
    const now = Date.now();
    const start = now - timeRange;
    const pattern = `metrics:${serviceId}:*`;

    // Use scanPattern to fetch keys matching the pattern
    const keys = await this.redisService.scanPattern(pattern);

    // Filter keys based on the timestamp and retrieve their values
    const metrics = await Promise.all(
      keys
        .filter((key) => {
          const timestamp = parseInt(key.split(':')[2]);
          return timestamp > start;
        })
        .map(async (key) => {
          const value = await this.redisService.cacheGet(key);
          return value as Record<string, unknown>;
        })
    );

    return metrics;
  }
}
