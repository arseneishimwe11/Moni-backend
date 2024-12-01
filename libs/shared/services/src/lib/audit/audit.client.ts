import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class AuditClient {
  private readonly logger = new Logger(AuditClient.name);

  constructor(@InjectQueue('audit') private auditQueue: Queue) {}

  async logActivity(data: {
    userId: string;
    action: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    await this.auditQueue.add('log-activity', {
      ...data,
      timestamp: new Date()
    });
  }
}
