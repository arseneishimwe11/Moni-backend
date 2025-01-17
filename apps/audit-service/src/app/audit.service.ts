import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { AuditLog } from './entities/audit-log.entity';
import { RedisService } from '@moni-backend/redis';
import { MessagePattern } from '@nestjs/microservices';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectQueue('audit-logs') private readonly auditQueue: Queue,
    private readonly redisService: RedisService
  ) {}

  async logActivity(userId: string, action: string, metadata: Record<string, unknown>) {
    try {
      await this.auditQueue.add('log-activity', {
        userId,
        action,
        metadata,
        timestamp: new Date()
      }, {
        removeOnComplete: true,
        attempts: 3
      });
    } catch (error) {
      this.logger.error(`Failed to queue audit log: ${error.message}`);
      throw error;
    }
  }
  async getAuditLogs(userId: string, startDate?: Date, endDate?: Date) {
    const query = this.auditLogRepository.createQueryBuilder('audit_log')
      .where('audit_log.userId = :userId', { userId })
      .orderBy('audit_log.createdAt', 'DESC');

    if (startDate) {
      query.andWhere('audit_log.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      query.andWhere('audit_log.createdAt <= :endDate', { endDate });
    }

    return query.getMany();
  }

  async getActivityByResourceId(resourceId: string) {
    return this.auditLogRepository.find({
      where: { resourceId },
      order: { createdAt: 'DESC' }
    });
  }

  async searchAuditLogs(searchParams: {
    userId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    resourceType?: string;
  }) {
    const query = this.auditLogRepository.createQueryBuilder('audit_log');

    if (searchParams.userId) {
      query.andWhere('audit_log.userId = :userId', { userId: searchParams.userId });
    }
    if (searchParams.action) {
      query.andWhere('audit_log.action = :action', { action: searchParams.action });
    }
    if (searchParams.resourceType) {
      query.andWhere('audit_log.resourceType = :resourceType', { resourceType: searchParams.resourceType });
    }
    if (searchParams.startDate) {
      query.andWhere('audit_log.createdAt >= :startDate', { startDate: searchParams.startDate });
    }
    if (searchParams.endDate) {
      query.andWhere('audit_log.createdAt <= :endDate', { endDate: searchParams.endDate });
    }

    return query.orderBy('audit_log.createdAt', 'DESC').getMany();
  }

  async getAuditLogCountByResourceType(resourceType: string) {
    return this.auditLogRepository.count({ where: { resourceType } });
  }
  async getAuditLogCountByAction(action: string) {
    return this.auditLogRepository.count({ where: { action } });
  }
  async getAuditLogCountByResourceId(resourceId: string) {
    return this.auditLogRepository.count({ where: { resourceId } });
  }

  @MessagePattern('transactions.*')
  async logTransactionEvent(data: Record<string, unknown>) {
    await this.logActivity(data.userId as string, data.action as string, {
      transactionId: data.transactionId as string,
      amount: data.amount as number,
      status: data.status as string,
      timestamp: new Date()
    });
  }

}
