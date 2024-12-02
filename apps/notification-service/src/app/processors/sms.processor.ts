import { Process, Processor } from '@nestjs/bull';
import { Logger, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bull';
import { Twilio } from 'twilio';
import { NotificationService } from '../notification.service';
import { NotificationStatus } from '../entities/notification.entity';

@Injectable()
@Processor('sms-notifications')
export class SmsProcessor {
  private readonly logger = new Logger(SmsProcessor.name);
  private readonly twilioClient: Twilio;

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService
  ) {
    this.twilioClient = new Twilio(
      this.configService.get('TWILIO_ACCOUNT_SID'),
      this.configService.get('TWILIO_AUTH_TOKEN')
    );
  }

  @Process('send-sms')
  async handleSmsSending(job: Job) {
    const { notificationId, recipientPhone, content } = job.data;

    try {
      const message = await this.twilioClient.messages.create({
        body: content.message,
        to: recipientPhone,
        from: this.configService.get('TWILIO_PHONE_NUMBER'),
        statusCallback: this.configService.get('SMS_WEBHOOK_URL')
      });

      await this.notificationService.updateNotificationStatus(
        notificationId,
        NotificationStatus.SENT,
        { messageId: message.sid, sentVia: 'Twilio' }
      );

    } catch (error) {
      this.logger.error(`Failed to send SMS: ${error.message}`);
      await this.notificationService.updateNotificationStatus(
        notificationId,
        NotificationStatus.FAILED,
        { error: error.message }
      );
      throw error;
    }
  }
}
