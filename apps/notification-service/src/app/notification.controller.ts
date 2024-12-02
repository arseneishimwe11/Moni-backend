import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Query, 
  Param, 
  UseGuards, 
  ValidationPipe, 
  ParseUUIDPipe 
} from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { NotificationService } from './notification.service';
import { 
  SendNotificationDto, 
  SendEmailDto, 
  SendSmsDto 
} from './dto/notification.dto';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { NotificationType } from './entities/notification.entity';

@Controller('notifications')
@UseGuards(AuthGuard, RolesGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @MessagePattern('send_email')
  async handleEmailNotification(@Payload() data: SendEmailDto) {
    return this.notificationService.sendEmail(data);
  }

  @MessagePattern('send_sms')
  async handleSmsNotification(@Payload() data: SendSmsDto) {
    return this.notificationService.sendSMS(data);
  }

  @MessagePattern('send_bulk_notification')
  async handleBulkNotification(@Payload() data: SendNotificationDto) {
    return this.notificationService.sendBulkNotifications(data);
  }

  @Post('email')
  @Roles('admin', 'notification_manager')
  async sendEmail(@Body(new ValidationPipe()) emailDto: SendEmailDto) {
    return this.notificationService.sendEmail(emailDto);
  }

  @Post('sms')
  @Roles('admin', 'notification_manager')
  async sendSMS(@Body(new ValidationPipe()) smsDto: SendSmsDto) {
    return this.notificationService.sendSMS(smsDto);
  }

  @Post('bulk')
  @Roles('admin', 'notification_manager')
  async sendBulkNotifications(
    @Body(new ValidationPipe()) notificationDto: SendNotificationDto
  ) {
    return this.notificationService.sendBulkNotifications(notificationDto);
  }

  @Get('user/:userId')
  async getUserNotifications(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50
  ) {
    return this.notificationService.getNotificationsByUser(userId, page, limit);
  }
  
  @Get('templates')
  @Roles('admin', 'notification_manager')
  async getNotificationTemplates(
    @Query('type') type?: NotificationType
  ) {
    return this.notificationService.getTemplates(type);
  }

  @Get('stats')
  @Roles('admin', 'notification_manager')
  async getNotificationStats(
    @Query('startDate') startDate?: Date,
    @Query('endDate') endDate?: Date
  ) {
    return this.notificationService.getNotificationStats(startDate, endDate);
  }
}
