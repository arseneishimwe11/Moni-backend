import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditLog } from '../entities/audit-log.entity';

@Injectable()
export class AuditLogRepository {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repository: Repository<AuditLog>
  ) {}

  async create(data: Partial<AuditLog>): Promise<AuditLog> {
    const auditLog = this.repository.create(data);
    return this.repository.save(auditLog);
  }

  async findById(id: string): Promise<AuditLog> {
    return this.repository.findOne({ where: { id } });
  }

  async findByUserId(userId: string): Promise<AuditLog[]> {
    return this.repository.find({ 
      where: { userId },
      order: { createdAt: 'DESC' }
    });
  }
}
