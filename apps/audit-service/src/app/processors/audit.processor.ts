import { Process, Processor } from '@nestjs/bull';
import { Logger, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bull';
import { AuditLog } from '../entities/audit-log.entity';
import { RedisService } from '@moni-backend/redis';

interface AuditLogJobData {
  userId: string;
  action: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  resourceId?: string;
  resourceType?: string;
  status?: string;
}
@Injectable()
@Processor('audit-logs')
export class AuditProcessor {
  private readonly logger = new Logger(AuditProcessor.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly redisService: RedisService
  ) {}

  @Process('log-activity')
  async handleAuditLog(job: Job<AuditLogJobData>) {
    const lockKey = `audit:lock:${job.data.userId}:${job.data.timestamp.getTime()}`;

    try {
      const hasLock = await this.redisService.setLock(lockKey, 30);
      if (!hasLock) {
        this.logger.warn(`Duplicate audit log detected for user ${job.data.userId}`);
        return;
      }

      const auditLog = this.auditLogRepository.create({
        userId: job.data.userId,
        action: job.data.action,
        metadata: this.sanitizeMetadata(job.data.metadata),
        ipAddress: job.data.ipAddress,
        userAgent: job.data.userAgent,
        resourceId: job.data.resourceId,
        resourceType: job.data.resourceType,
        status: job.data.status,
        createdAt: job.data.timestamp
      });

      await this.auditLogRepository.save(auditLog);
      
      await this.cacheRecentActivity(job.data.userId, auditLog);
      
      this.logger.log(`Audit log created for user ${job.data.userId}: ${job.data.action}`);
      
      return auditLog;

    } catch (error) {
      this.logger.error(
        `Failed to process audit log for user ${job.data.userId}: ${error.message}`,
        error.stack
      );
      throw error;
    } finally {
      await this.redisService.releaseLock(lockKey);
    }
  }

  @Process('cleanup-old-logs')
  async handleCleanup(job: Job) {
    const retentionDays = 90; // Configure based on requirements
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      const result = await this.auditLogRepository
        .createQueryBuilder()
        .delete()
        .where('createdAt < :cutoffDate', { cutoffDate })
        .execute();

      this.logger.log(`Cleaned up ${result.affected} old audit logs`);
    } catch (error) {
      this.logger.error(`Failed to cleanup old audit logs: ${error.message}`);
      throw error;
    }
  }

  private sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const sensitiveFields = ['password', 'token', 'secret', 'credential'];
    const sanitized = { ...metadata };

    Object.keys(sanitized).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      }
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeMetadata(sanitized[key] as Record<string, unknown>);
      }
    });

    return sanitized;
  }
  private async cacheRecentActivity(userId: string, auditLog: AuditLog): Promise<void> {
    const cacheKey = `user:${userId}:recent_activity`;
    const recentActivities = await this.redisService.cacheGet<AuditLog[]>(cacheKey) || [];
    
    recentActivities.unshift(auditLog);
    if (recentActivities.length > 10) {
      recentActivities.pop();
    }

    await this.redisService.cacheSet(cacheKey, recentActivities, 86400); // 24 hours
  }
}
