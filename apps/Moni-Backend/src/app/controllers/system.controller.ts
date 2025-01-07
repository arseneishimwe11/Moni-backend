import { Controller, Get, Post, Body, UseGuards, Query, LogLevel } from '@nestjs/common';
import { SystemService } from '../services/system.service';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { RateLimiterGuard } from '../guards/rate-limiter.guard';
import { RegisterServiceDto } from '../dtos/register-service.dto';
import { SystemLogs } from '../interfaces/system-logs.interface';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('System')
@Controller('system')
@UseGuards(ApiKeyGuard, RateLimiterGuard)
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get system status' })
  @ApiResponse({
    status: 200,
    description: 'Returns the current system status',
  })
  async getSystemStatus() {
    return this.systemService.getSystemStatus();
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get system metrics' })
  @ApiResponse({ status: 200, description: 'Returns system metrics' })
  async getSystemMetrics(
    @Query('startDate') startDate: Date,
    @Query('endDate') endDate: Date,
    @Query('service') service: string
  ) {
    return this.systemService.getSystemMetrics({ startDate, endDate, service });
  }

  @Get('services')
  @ApiOperation({ summary: 'Get registered services' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of registered services',
  })
  async getRegisteredServices() {
    return this.systemService.getRegisteredServices();
  }

  @Post('services/register')
  @ApiOperation({ summary: 'Register new service' })
  @ApiResponse({ status: 201, description: 'Service registered successfully' })
  async registerService(@Body() serviceData: RegisterServiceDto) {
    return this.systemService.registerService(serviceData);
  }

  @Get('config')
  @ApiOperation({ summary: 'Get system configuration' })
  @ApiResponse({ status: 200, description: 'Returns system configuration' })
  async getSystemConfig() {
    return this.systemService.getSystemConfig();
  }

  @Get('health')
  @ApiOperation({ summary: 'Get system health status' })
  @ApiResponse({
    status: 200,
    description: 'Returns system health information',
  })
  async getSystemHealth() {
    return this.systemService.getSystemHealth();
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get system logs' })
  @ApiResponse({ status: 200, description: 'Returns system logs' })
  async getSystemLogs(
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 50,
    @Query('level') level?: LogLevel,
    @Query('service') service?: string,
    @Query('startDate') startDate?: Date,
    @Query('endDate') endDate?: Date
  ): Promise<SystemLogs> {
    const logEntries = await this.systemService.getSystemLogs({
      page,
      pageSize,
      level,
      service,
      startDate,
      endDate,
    });

    const totalItems = await this.systemService
      .getSystemLogs({
        page: 1,
        pageSize: Number.MAX_SAFE_INTEGER,
        level,
        service,
        startDate,
        endDate,
      })
      .then((logs: unknown[]) => logs.length);

    const metrics = await this.systemService.getSystemMetrics({
      startDate,
      endDate,
      service,
    });

    interface SystemLogEntry {
      id?: string;
      timestamp: Date;
      serviceName?: string;
      level: string;
      message: string;
      metadata: Record<string, unknown>;
      correlationId: string;
    }

    return {
      logs: (logEntries as SystemLogEntry[]).map((entry) => ({
        id: entry.id || 'unknown',
        timestamp: entry.timestamp,
        service: entry.serviceName || 'unknown',
        level: entry.level.toUpperCase() as 'INFO' | 'WARN' | 'ERROR' | 'DEBUG',
        message: entry.message,
        metadata: entry.metadata,
        correlationId: entry.correlationId,
      })),
      metrics: {},
      summary: {
        // totalLogs: logEntries.length,
        errorCount: metrics.error_count || 0,
        warningCount: metrics.warning_count || 0,
        startTime: startDate ?? new Date(0),
        endTime: endDate ?? new Date(),
      },
      pagination: {
        page,
        limit: pageSize,
        total: totalItems,
        hasMore: page * pageSize < totalItems,
      },
    };
  }
}