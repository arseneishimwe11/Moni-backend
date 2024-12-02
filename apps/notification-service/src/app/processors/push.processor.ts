import { Process, Processor } from '@nestjs/bull';
import { Logger, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bull';
import * as admin from 'firebase-admin';
import { NotificationService } from '../notification.service';
import { NotificationStatus } from '../entities/notification.entity';

@Injectable()
@Processor('push-notifications')
export class PushProcessor {
  private readonly logger = new Logger(PushProcessor.name);
  private readonly firebaseApp: admin.app.App;

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService
  ) {
    this.firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: this.configService.get('FIREBASE_PROJECT_ID'),
        clientEmail: this.configService.get('FIREBASE_CLIENT_EMAIL'),
        privateKey: this.configService.get('FIREBASE_PRIVATE_KEY')
      })
    });
  }

  @Process('send-push')
  async handlePushNotification(job: Job) {
    const { notificationId, deviceToken, content } = job.data;

    try {
      const message = {
        notification: {
          title: content.title,
          body: content.body
        },
        data: content.data,
        token: deviceToken
      };

      const response = await this.firebaseApp.messaging().send(message);

      await this.notificationService.updateNotificationStatus(
        notificationId,
        NotificationStatus.SENT,
        { messageId: response, sentVia: 'Firebase' }
      );

    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error.message}`);
      await this.notificationService.updateNotificationStatus(
        notificationId,
        NotificationStatus.FAILED,
        { error: error.message }
      );
      throw error;
    }
  }
}
