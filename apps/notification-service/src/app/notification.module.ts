import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { EmailProcessor } from './processors/email.processor';
import { SmsProcessor } from './processors/sms.processor';
import { PushProcessor } from './processors/push.processor';
import { Notification } from './entities/notification.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { RedisModule } from'@moni-backend/redis';
import configs from 'config/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configs],
    }),
    TypeOrmModule.forFeature([Notification, NotificationTemplate]),
    RedisModule,
    BullModule.registerQueue(
      { name: 'email-notifications' },
      { name: 'sms-notifications' },
      { name: 'push-notifications' }
    ),
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    EmailProcessor,
    SmsProcessor,
    PushProcessor
  ],
  exports: [NotificationService]
})
export class NotificationModule {}
