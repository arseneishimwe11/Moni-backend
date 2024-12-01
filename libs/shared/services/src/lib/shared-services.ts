import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AuditClient } from './audit/audit.client';
import { NotificationClient } from './notifications/notification.client';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'audit' },
      { name: 'notifications' }
    ),
  ],
  providers: [AuditClient, NotificationClient],
  exports: [AuditClient, NotificationClient],
})
export class SharedServicesModule {}
