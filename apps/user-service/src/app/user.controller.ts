import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Req,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { AuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Roles } from './decorators/roles.decorators';
import { CurrentUser } from './decorators/user.decorators';
import { ActivityInterceptor } from './interceptors/activity.interceptor';
import { UserService } from './user.service';
import {
  CreateUserDto,
  UpdateUserDto,
  KycSubmissionDto,
  ChangePasswordDto,
} from './dto/user.dto';

@Controller('users')
@UseGuards(ThrottlerGuard)
@UseInterceptors(ActivityInterceptor)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async createUser(
    @Body(new ValidationPipe({ transform: true })) createUserDto: CreateUserDto,
    @Req() request: Request
  ) {
    return this.userService.createUser(
      createUserDto,
      request.ip,
      request.headers['user-agent']
    );
  }
  @UseGuards(AuthGuard)
  @Get('profile')
  async getUserProfile(@CurrentUser() userId: string) {
    return this.userService.getUserById(userId);
  }

  @UseGuards(AuthGuard)
  @Put(':id')
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) updateUserDto: UpdateUserDto,
    @Req() request: Request
  ) {
    return this.userService.updateUser(id, updateUserDto, request.ip);
  }

  @UseGuards(AuthGuard)
  @Post(':id/kyc')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'documentFront', maxCount: 1 },
      { name: 'documentBack', maxCount: 1 },
      { name: 'selfie', maxCount: 1 },
    ])
  )
  async submitKyc(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) kycData: KycSubmissionDto,
    @UploadedFiles()
    files: {
      documentFront?: Express.Multer.File[];
      documentBack?: Express.Multer.File[];
      selfie?: Express.Multer.File[];
    }
  ) {
    const allFiles: Express.Multer.File[] = [
      ...(files.documentFront || []),
      ...(files.documentBack || []),
      ...(files.selfie || []),
    ];
    return this.userService.submitKyc(id, kycData, allFiles);
  }
  @Post('verify-email/:token')
  async verifyEmail(@Param('token') token: string) {
    await this.userService.verifyEmail(token);
    return { status: HttpStatus.OK, message: 'Email verified successfully' };
  }

  @UseGuards(AuthGuard)
  @Post('change-password')
  async changePassword(
    @CurrentUser() userId: string,
    @Body(new ValidationPipe()) changePasswordDto: ChangePasswordDto
  ) {
    await this.userService.changePassword(userId, changePasswordDto);
    return { status: HttpStatus.OK, message: 'Password changed successfully' };
  }

  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  async deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request
  ) {
    await this.userService.deleteUser(id, request.ip);
    return { status: HttpStatus.OK, message: 'User deleted successfully' };
  }

  @UseGuards(AuthGuard)
  @Post(':id/2fa/enable')
  async enableTwoFactor(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.enableTwoFactor(id);
  }

  @UseGuards(AuthGuard)
  @Post(':id/2fa/verify')
  async verifyTwoFactor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('token') token: string
  ) {
    return this.userService.verifyTwoFactor(id, token);
  }
}
