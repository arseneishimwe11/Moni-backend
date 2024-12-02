import { Injectable, Logger, Inject, ConflictException, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import * as speakeasy from 'speakeasy';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { UserRepository } from './repository/user.repository';
import { CreateUserDto, UpdateUserDto, KycSubmissionDto, ChangePasswordDto, UserResponseDto } from './dto/user.dto';
import { User, UserStatus, KycStatus } from './entities/user.entity';
import { RedisService } from '@moni-backend/redis';
import { UserValidator } from './validators/user.validators';
import { ConfigService } from '@nestjs/config';


@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly configService: ConfigService;
  private readonly saltRounds = 12;
  private readonly maxLoginAttempts = 5;
  private readonly lockoutDuration = 30 * 60;
  private readonly kycDocumentTypes = ['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE'];
  private readonly cachePrefix = 'user:';
  private readonly cacheTTL = 3600;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly redisService: RedisService,
    private readonly userValidator: UserValidator,
    @Inject('NOTIFICATION_SERVICE') private readonly notificationClient: ClientProxy,
    @Inject('AUDIT_SERVICE') private readonly auditClient: ClientProxy,
    @InjectQueue('kyc-verification') private readonly kycQueue: Queue
  ) {}

  async getUserById(userId: string): Promise<UserResponseDto> {
    const cacheKey = `${this.cachePrefix}${userId}`;
    const cachedUser = await this.redisService.cacheGet<User>(cacheKey);
    
    if (cachedUser) {
      return this.sanitizeUser(cachedUser);
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.redisService.cacheSet(cacheKey, user, this.cacheTTL);
    return this.sanitizeUser(user);
  }

  async createUser(createUserDto: CreateUserDto, ipAddress: string, userAgent: string): Promise<UserResponseDto> {
    await this.validateNewUser(createUserDto);
    
    const passwordHash = await bcrypt.hash(createUserDto.password, this.saltRounds);
    const verificationToken = uuidv4();
    const userId = uuidv4();

    const user = await this.userRepository.create({
      ...createUserDto,
      id: userId,
      passwordHash,
      status: UserStatus.PENDING_VERIFICATION,
      kycStatus: KycStatus.NOT_STARTED,
      verificationToken,
      lastIp: ipAddress,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await Promise.all([
      this.notificationClient.emit('send_verification_email', {
        userId: user.id,
        email: user.email,
        token: verificationToken,
        firstName: user.firstName
      }).toPromise(),

      this.auditClient.emit('user_activity', {
        userId: user.id,
        action: 'USER_CREATED',
        metadata: { ipAddress, userAgent, email: user.email }
      }).toPromise()
    ]);

    return this.sanitizeUser(user);
  }

  async updateUser(userId: string, updateUserDto: UpdateUserDto, ipAddress: string): Promise<UserResponseDto> {
    const user = await this.getUserById(userId);

    if (updateUserDto.phoneNumber) {
      await this.validatePhoneNumber(updateUserDto.phoneNumber, userId);
    }

    const updatedUser = await this.userRepository.update(userId, {
      ...updateUserDto,
      lastIp: ipAddress,
      updatedAt: new Date()
    });

    await Promise.all([
      this.redisService.cacheDelete(`${this.cachePrefix}${userId}`),
      this.auditClient.emit('user_activity', {
        userId,
        action: 'USER_UPDATED',
        metadata: { ipAddress, changes: updateUserDto }
      }).toPromise()
    ]);

    return this.sanitizeUser(updatedUser);
  }

  async deleteUser(userId: string, ipAddress: string): Promise<void> {
    const user = await this.getUserById(userId);
    
    await Promise.all([
      this.userRepository.update(userId, { 
        status: UserStatus.INACTIVE,
        updatedAt: new Date()
      }),
      this.redisService.cacheDelete(`${this.cachePrefix}${userId}`),
      this.auditClient.emit('user_activity', {
        userId,
        action: 'USER_DELETED',
        metadata: { ipAddress }
      }).toPromise(),
      this.notificationClient.emit('account_deleted', {
        email: user.email,
        firstName: user.firstName
      }).toPromise()
    ]);
  }

  async submitKyc(userId: string, kycData: KycSubmissionDto, files: Express.Multer.File[]): Promise<void> {
    const user = await this.getUserById(userId);

    if (!this.kycDocumentTypes.includes(kycData.documentType)) {
      throw new BadRequestException('Invalid document type');
    }

    const documentUrls = await this.uploadKycDocuments(files);
    const kycSubmissionId = uuidv4();

    await this.userRepository.updateKycStatus(userId, KycStatus.PENDING, {
      ...kycData,
      documents: documentUrls,
      submissionId: kycSubmissionId,
      submittedAt: new Date()
    });

    await Promise.all([
      this.kycQueue.add('process-kyc', {
        userId,
        kycData: {
          ...kycData,
          documents: documentUrls,
          submissionId: kycSubmissionId
        }
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true
      }),

      this.notificationClient.emit('kyc_submitted', {
        userId,
        email: user.email,
        status: KycStatus.PENDING
      }).toPromise()
    ]);
  }

  async enableTwoFactor(userId: string): Promise<{ secret: string; qrCode: string }> {
    const user = await this.getUserById(userId);
    
    const secret = speakeasy.generateSecret({
      name: `MONI:${user.email}`
    });

    await this.userRepository.update(userId, {
      twoFactorSecret: secret.base32,
      isTwoFactorEnabled: false
    });

    return {
      secret: secret.base32,
      qrCode: secret.otpauth_url
    };
  }

  async verifyTwoFactor(userId: string, token: string): Promise<boolean> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
  
    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token
    });
  
    if (isValid && !user.isTwoFactorEnabled) {
      await this.userRepository.update(userId, {
        isTwoFactorEnabled: true
      });
  
      await this.notificationClient.emit('two_factor_enabled', {
        userId,
        email: user.email
      }).toPromise();
    }
  
    return isValid;
  }
  

  async disableTwoFactor(userId: string, token: string): Promise<void> {
    const isValid = await this.verifyTwoFactor(userId, token);
    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA token');
    }

    await this.userRepository.update(userId, {
      twoFactorSecret: null,
      isTwoFactorEnabled: false
    });

    const user = await this.getUserById(userId);
    await this.notificationClient.emit('two_factor_disabled', {
      userId,
      email: user.email
    }).toPromise();
  }

  async verifyEmail(token: string): Promise<void> {
    const user = await this.userRepository.findByVerificationToken(token);
    if (!user) {
      throw new UnauthorizedException('Invalid verification token');
    }

    await Promise.all([
      this.userRepository.update(user.id, {
        status: UserStatus.ACTIVE,
        verificationToken: null,
        emailVerifiedAt: new Date()
      }),
      this.redisService.cacheDelete(`${this.cachePrefix}${user.id}`),
      this.notificationClient.emit('welcome_email', {
        userId: user.id,
        email: user.email,
        firstName: user.firstName
      }).toPromise()
    ]);
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
  
    const isValidPassword = await bcrypt.compare(changePasswordDto.currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid current password');
    }
  
    if (changePasswordDto.newPassword !== changePasswordDto.confirmPassword) {
      throw new BadRequestException('New passwords do not match');
    }
  
    const passwordHash = await bcrypt.hash(changePasswordDto.newPassword, this.saltRounds);
    
    await Promise.all([
      this.userRepository.update(userId, { 
        passwordHash,
        updatedAt: new Date()
      }),
      this.invalidateUserSessions(userId),
      this.notificationClient.emit('password_changed', {
        userId: user.id,
        email: user.email
      }).toPromise()
    ]);
  }
  

  private async validateNewUser(createUserDto: CreateUserDto): Promise<void> {
    const [existingEmail, existingPhone] = await Promise.all([
      this.userRepository.findByEmail(createUserDto.email),
      this.userRepository.findByPhoneNumber(createUserDto.phoneNumber)
    ]);

    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    if (existingPhone) {
      throw new ConflictException('Phone number already exists');
    }

    if (!this.userValidator.validateAge(createUserDto.dateOfBirth)) {
      throw new BadRequestException('User must be at least 18 years old');
    }
  }

  private async validatePhoneNumber(phoneNumber: string, userId: string): Promise<void> {
    const existingUser = await this.userRepository.findByPhoneNumber(phoneNumber);
    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException('Phone number already exists');
    }
  }

  private async uploadKycDocuments(files: Express.Multer.File[]): Promise<Record<string, string>> {
    const documentUrls: Record<string, string> = {};
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    const uploadDir = this.configService.get('UPLOAD_DIR') || 'uploads/kyc-documents';
  
    await fs.promises.mkdir(uploadDir, { recursive: true });
  
    for (const file of files) {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(`Invalid file type: ${file.mimetype}`);
      }
  
      if (file.size > maxFileSize) {
        throw new BadRequestException('File size exceeds 5MB limit');
      }
  
      const fileHash = createHash('sha256')
        .update(file.buffer)
        .digest('hex');
  
      const fileName = `${fileHash}-${file.originalname}`;
      const filePath = path.join(uploadDir, fileName);
  
      await fs.promises.writeFile(filePath, file.buffer);
  
      documentUrls[file.fieldname] = `${this.configService.get('API_URL')}/kyc-documents/${fileName}`;
    }
  
    return documentUrls;
  }
1    

  private async invalidateUserSessions(userId: string): Promise<void> {
    await this.redisService.cacheSet(`${this.cachePrefix}${userId}:sessions`, Date.now(), 86400);
  }

  private sanitizeUser(user: User): UserResponseDto {
    const {...sanitizedUser } = user;
    return {
      ...sanitizedUser,
      isTwoFactorEnabled: !!user.isTwoFactorEnabled
    } as UserResponseDto;
  }
  
}
