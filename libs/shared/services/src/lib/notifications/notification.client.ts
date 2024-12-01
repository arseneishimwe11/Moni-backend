import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class NotificationClient {
  private readonly logger = new Logger(NotificationClient.name);

  constructor(@InjectQueue('notifications') private notificationQueue: Queue) {}

  async sendEmail(data: {
    type: string;
    recipient: string;
    template: string;
    context: Record<string, unknown>;
  }): Promise<void> {
    await this.notificationQueue.add('send-email', data);
  }
  async sendSMS(data: {
    recipient: string;
    message: string;
  }): Promise<void> {
    await this.notificationQueue.add('send-sms', data);
  }
}
