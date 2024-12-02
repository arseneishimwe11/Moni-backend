import { Controller, Get, Query, Param, UseGuards, ParseUUIDPipe, ValidationPipe } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AuditService } from './audit.service';
import { SearchAuditLogsDto } from './dto/search-audit';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/audit-roles.guard';
import { Roles } from './decorators/roles.decorator';

@Controller('audit')
@UseGuards(AuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @MessagePattern('log_activity')
  async handleActivityLog(@Payload() data: { 
    userId: string;
    action: string;
    metadata: Record<string, unknown>;
  }) {
    return this.auditService.logActivity(
      data.userId,
      data.action,
      data.metadata
    );
  }

  @Get('logs')
  @Roles('admin', 'auditor')
  async searchAuditLogs(@Query(new ValidationPipe({ transform: true })) searchParams: SearchAuditLogsDto) {
    return this.auditService.searchAuditLogs(searchParams);
  }

  @Get('users/:userId/logs')
  @Roles('admin', 'auditor')
  async getUserAuditLogs(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('startDate') startDate?: Date,
    @Query('endDate') endDate?: Date
  ) {
    return this.auditService.getAuditLogs(userId, startDate, endDate);
  }

  @Get('resources/:resourceId/logs')
  @Roles('admin', 'auditor')
  async getResourceAuditLogs(@Param('resourceId', ParseUUIDPipe) resourceId: string) {
    return this.auditService.getActivityByResourceId(resourceId);
  }
}
