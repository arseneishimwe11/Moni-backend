import { Injectable, Logger, Inject } from '@nestjs/common';
import { RedisService } from '@moni-backend/redis';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class LoggingService {
  private readonly logger = new Logger(LoggingService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @Inject('AUDIT_SERVICE') private readonly auditClient: ClientProxy
  ) {}

  async logSystemEvent(event: {
    type: string;
    message: string;
    metadata?: Record<string, unknown>;
  }) {
    const logEntry = {
      timestamp: new Date(),
      environment: this.configService.get('NODE_ENV'),
      region: this.configService.get('REGION'),
      ...event,
    };

    // Send to audit service
    await this.auditClient.emit('system_event', logEntry).toPromise();

    // Cache recent logs in Redis for quick access
    const cacheKey = `system:logs:${Date.now()}`;
    await this.redisService.cacheSet(cacheKey, logEntry, 3600);

    this.logger.log(`System event logged: ${event.type} - ${event.message}`);
  }
  async getSystemLogs(options: {
    startTime?: Date;
    endTime?: Date;
    type?: string;
    limit?: number;
  }) {
    // Get recent logs from Redis cache
    const pattern = 'system:logs:*';
    const recentLogs = await this.redisService.scanKeys(pattern);

    let logs = await Promise.all(
      recentLogs.map((key) => this.redisService.cacheGet(key))
    );

    // Apply filters
    logs = logs.filter(
      (log: { type?: string; timestamp: string | number | Date }) => {
        if (options.type && log.type !== options.type) return false;
        if (options.startTime && new Date(log.timestamp) < options.startTime)
          return false;
        if (options.endTime && new Date(log.timestamp) > options.endTime)
          return false;
        return true;
      }
    );
    return logs
      .sort(
        (
          a: { timestamp: string | number | Date },
          b: { timestamp: string | number | Date }
        ) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, options.limit || 100);
  }

  async queryLogs(query: {
    page?: number;
    pageSize?: number;
    level?: string;
    service?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<LogEntry[]> {
    const { page = 1, pageSize = 50 } = query;
    const logs = await this.getRecentLogs(query.service, {
      startTime: query.startDate,
      endTime: query.endDate,
      level: query.level,
    });
    return this.paginateResults(logs, page, pageSize);
  }

  private paginateResults(
    logs: LogEntry[],
    page: number,
    pageSize: number
  ): LogEntry[] {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return logs.slice(startIndex, endIndex);
  }
  async getRecentLogs(
    serviceName?: string,
    options: {
      startTime?: Date;
      endTime?: Date;
      level?: string;
      limit?: number;
    } = {}
  ): Promise<LogEntry[]> {
    const pattern = serviceName
      ? `system:logs:${serviceName}:*`
      : 'system:logs:*';

    const recentLogs = await this.redisService.scanPattern(pattern);

    let logs: LogEntry[] = await Promise.all(
      recentLogs.map(async (key) => {
        const log = await this.redisService.cacheGet(key);
        return log as LogEntry;
      })
    );

    // Apply filters
    logs = logs.filter((log: LogEntry) => {
      if (options.level && log.level !== options.level) return false;
      if (options.startTime && new Date(log.timestamp) < options.startTime)
        return false;
      if (options.endTime && new Date(log.timestamp) > options.endTime)
        return false;
      return true;
    });
    // Sort by timestamp descending and limit results
    return logs
      .sort(
        (a: LogEntry, b: LogEntry) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, options.limit || 100);
  }
}
interface LogEntry {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  timestamp: Date;
  type: string;
  message: string;
  serviceName: string;
  environment: string;
  region: string;
  metadata: {
    requestId?: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    path?: string;
    method?: string;
    responseTime?: number;
    statusCode?: number;
    errorDetails?: Record<string, unknown>;
  };
  correlationId?: string;
  source: string;
  version: string;
  tags: string[];
}
