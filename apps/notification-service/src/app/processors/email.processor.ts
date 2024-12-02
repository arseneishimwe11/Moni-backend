import { Process, Processor } from '@nestjs/bull';
import { Logger, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bull';
import * as nodemailer from 'nodemailer';
import { NotificationService } from '../notification.service';
import { NotificationStatus } from '../entities/notification.entity';

@Injectable()
@Processor('email-notifications')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: this.configService.get('SMTP_PORT'),
      secure: true,
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASSWORD')
      }
    });
  }

  @Process('send-email')
  async handleEmailSending(job: Job) {
    const { notificationId, recipientEmail, content } = job.data;

    try {
      await this.transporter.sendMail({
        from: this.configService.get('SMTP_FROM_ADDRESS'),
        to: recipientEmail,
        subject: content.subject,
        html: content.body,
        headers: {
          'X-Notification-ID': notificationId,
          'X-Priority': 'High'
        }
      });

      await this.notificationService.updateNotificationStatus(
        notificationId, 
        NotificationStatus.SENT,
        { sentVia: 'SMTP', timestamp: new Date() }
      );

    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      await this.notificationService.updateNotificationStatus(
        notificationId,
        NotificationStatus.FAILED,
        { error: error.message }
      );
      throw error;
    }
  }
}
