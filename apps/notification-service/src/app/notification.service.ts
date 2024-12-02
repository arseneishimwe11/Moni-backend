import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@moni-backend/redis';
import { Notification, NotificationType, NotificationStatus } from './entities/notification.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { CreateNotificationDto, SendNotificationDto, SendEmailDto, SendSmsDto } from './dto/notification.dto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly CACHE_TTL = 3600;
  private readonly BATCH_SIZE = 100;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationTemplate)
    private readonly templateRepository: Repository<NotificationTemplate>,
    @InjectQueue('email-notifications') private readonly emailQueue: Queue,
    @InjectQueue('sms-notifications') private readonly smsQueue: Queue,
    @InjectQueue('push-notifications') private readonly pushQueue: Queue,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService
  ) {}

  async sendEmail(data: SendEmailDto): Promise<void> {
    const notification = await this.createNotification({
      type: NotificationType.EMAIL,
      userId: data.userId,
      content: {
        subject: data.subject,
        body: data.body
      },
      recipientEmail: data.to,
      metadata: data.metadata
    });

    await this.emailQueue.add('send-email', notification, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true
    });
  }

  async sendSMS(data: SendSmsDto): Promise<void> {
    const notification = await this.createNotification({
      type: NotificationType.SMS,
      userId: data.userId,
      content: { message: data.message },
      recipientPhone: data.to,
      metadata: data.metadata
    });

    await this.smsQueue.add('send-sms', notification, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true
    });
  }

  async sendBulkNotifications(sendDto: SendNotificationDto): Promise<void> {
    const template = sendDto.templateId ? 
      await this.templateRepository.findOne({ where: { id: sendDto.templateId } }) : 
      null;

    const notifications = await Promise.all(
      sendDto.userIds.map(userId => this.createNotification({
        userId,
        type: sendDto.type,
        content: template ? 
          this.compileTemplate(template, sendDto.variables as Record<string, string | number | boolean>) : 
          sendDto.content,
        templateId: sendDto.templateId,
        metadata: sendDto.metadata
      }))
    );

    await this.batchQueueNotifications(notifications);
  }

  async getNotificationsByUser(userId: string, page = 1, limit = 50): Promise<{ notifications: Notification[]; total: number }> {
    const cacheKey = `notifications:user:${userId}:${page}:${limit}`;
    const cached = await this.redisService.cacheGet<{ notifications: Notification[]; total: number }>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const [notifications, total] = await this.notificationRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit
    });

    const result = { notifications, total };
    await this.redisService.cacheSet(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  async updateNotificationStatus(id: string, status: NotificationStatus, details?: Record<string, unknown>): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({ where: { id } });
    if (!notification) {
      throw new Error('Notification not found');
    }

    const statusTimestamps = {
      [NotificationStatus.SENT]: { sentAt: new Date() },
      [NotificationStatus.DELIVERED]: { deliveredAt: new Date() },
      [NotificationStatus.FAILED]: { errorDetails: details?.error }
    };

    const updated = await this.notificationRepository.save({
      ...notification,
      status,
      ...statusTimestamps[status],
      metadata: { ...notification.metadata, ...details },
      updatedAt: new Date()
    });

    await this.redisService.cacheDelete(`notifications:user:${notification.userId}*`);
    return updated;
  }
  private async createNotification(createDto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepository.create({
      ...createDto,
      status: NotificationStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return this.notificationRepository.save(notification);
  }

  private async batchQueueNotifications(notifications: Notification[]): Promise<void> {
    for (let i = 0; i < notifications.length; i += this.BATCH_SIZE) {
      const batch = notifications.slice(i, i + this.BATCH_SIZE);
      await Promise.all(batch.map(notification => this.queueByType(notification)));
    }
  }

  private async queueByType(notification: Notification): Promise<void> {
    const queueMap = {
      [NotificationType.EMAIL]: this.emailQueue,
      [NotificationType.SMS]: this.smsQueue,
      [NotificationType.PUSH]: this.pushQueue
    };

    const queue = queueMap[notification.type];
    if (!queue) {
      throw new Error(`Unsupported notification type: ${notification.type}`);
    }

    await queue.add(`send-${notification.type}`, notification, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      priority: 1
    });
  }

  private compileTemplate(template: NotificationTemplate, variables: Record<string, string | number | boolean>): Record<string, string> {
    let content = template.content;
    
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      content = content.replace(regex, String(value));
    });

    return {
      subject: template.subject,
      body: content
    };
  }

  async getTemplates(type?: NotificationType) {
    const query = this.templateRepository.createQueryBuilder('template')
      .where('template.isActive = :isActive', { isActive: true });
  
    if (type) {
      query.andWhere('template.type = :type', { type });
    }
  
    return query.getMany();
  }
  
  async getNotificationStats(startDate?: Date, endDate?: Date) {
    const query = this.notificationRepository.createQueryBuilder('notification')
      .select([
        'notification.type',
        'notification.status',
        'COUNT(*) as count'
      ])
      .groupBy('notification.type, notification.status');
  
    if (startDate) {
      query.andWhere('notification.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      query.andWhere('notification.createdAt <= :endDate', { endDate });
    }
  
    const stats = await query.getRawMany();
    
    return {
      totalCount: stats.reduce((acc, curr) => acc + parseInt(curr.count), 0),
      byType: this.groupStatsByType(stats),
      byStatus: this.groupStatsByStatus(stats)
    };
  }
  
  private groupStatsByType(stats: { notification_type: string; count: string }[]) {
    return stats.reduce<Record<string, number>>((acc, curr) => {
      acc[curr.notification_type] = acc[curr.notification_type] || 0;
      acc[curr.notification_type] += parseInt(curr.count);
      return acc;
    }, {});
  }
  
  private groupStatsByStatus(stats: { notification_status: string; count: string }[]) {
    return stats.reduce<Record<string, number>>((acc, curr) => {
      acc[curr.notification_status] = acc[curr.notification_status] || 0;
      acc[curr.notification_status] += parseInt(curr.count);
      return acc;
    }, {});
  }
  
}
