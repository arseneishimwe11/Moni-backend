import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column()
  action: string;

  @Column('jsonb')
  metadata: Record<string, unknown>;

  @Column({ nullable: true })
  ipAddress?: string;

  @Column({ nullable: true })
  userAgent?: string;

  @Column({ nullable: true })
  resourceId?: string;

  @Column({ nullable: true })
  resourceType?: string;

  @Column({ nullable: true })
  status?: string;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}
