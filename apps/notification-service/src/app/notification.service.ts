import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(@InjectQueue('notifications') private notificationQueue: Queue) {}

  async sendEmail(data: { to: string; subject: string; body: string }): Promise<void> {
    await this.notificationQueue.add('send-email', data, {
      removeOnComplete: true,
      attempts: 3
    });
  }
  async sendSMS(data: { to: string; message: string }): Promise<void> {
    await this.notificationQueue.add('send-sms', data, {
      removeOnComplete: true,
      attempts: 3
    });
  }}
