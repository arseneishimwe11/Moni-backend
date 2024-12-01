import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@InjectQueue('audit') private auditQueue: Queue) {}

  async logUserActivity(userId: string, action: string, metadata: Record<string, unknown>): Promise<void> {
    await this.auditQueue.add('log-activity', {
      userId,
      action,
      metadata,
      timestamp: new Date()
    }, {
      removeOnComplete: true,
      attempts: 3
    });
  }
}
