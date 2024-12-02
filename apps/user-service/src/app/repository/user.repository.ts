import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus, KycStatus } from '../entities/user.entity';
import { RedisService } from '@moni-backend/redis';

@Injectable()
export class UserRepository {
  private readonly logger = new Logger(UserRepository.name);
  private readonly CACHE_TTL = 3600;
  private readonly CACHE_PREFIX = 'user:';

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly redisService: RedisService
  ) {}

  async create(userData: Partial<User>): Promise<User> {
    const user = this.userRepository.create(userData);
    const saved = await this.userRepository.save(user);
    await this.cacheUser(saved);
    return saved;
  }

  async findById(id: string): Promise<User | null> {
    const cacheKey = `${this.CACHE_PREFIX}${id}`;
    const cached = await this.redisService.cacheGet<User>(cacheKey);
    if (cached) return cached;

    const user = await this.userRepository.findOne({ 
      where: { id },
      select: ['id', 'email', 'firstName', 'lastName', 'phoneNumber', 'status', 'kycStatus', 'lastLogin']
    });
    
    if (user) await this.cacheUser(user);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ 
      where: { email },
      select: ['id', 'email', 'passwordHash', 'status']
    });
  }

  async findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    return this.userRepository.findOne({ 
      where: { phoneNumber },
      select: ['id', 'phoneNumber', 'status']
    });
  }

  async findByVerificationToken(token: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { verificationToken: token },
      select: ['id', 'email', 'status', 'verificationToken']
    });
  }

  async update(id: string, updateData: Partial<User>): Promise<User> {
    await this.userRepository.update(id, {
      ...updateData,
      updatedAt: new Date()
    });

    await this.redisService.cacheDelete(`${this.CACHE_PREFIX}${id}`);
    return this.findById(id);
  }

  async updateKycStatus(id: string, status: KycStatus, kycData?: Record<string, unknown>): Promise<User> {
    return this.update(id, { 
      kycStatus: status, 
      kycData,
      updatedAt: new Date()
    });
  }

  async updateStatus(id: string, status: UserStatus): Promise<User> {
    return this.update(id, { 
      status,
      updatedAt: new Date()
    });
  }

  async findByKycStatus(status: KycStatus): Promise<User[]> {
    return this.userRepository.find({
      where: { kycStatus: status },
      select: ['id', 'email', 'firstName', 'lastName', 'kycStatus', 'kycData']
    });
  }

  async findActiveUsers(): Promise<User[]> {
    return this.userRepository.find({
      where: { status: UserStatus.ACTIVE },
      select: ['id', 'email', 'firstName', 'lastName']
    });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.update(id, { 
      lastLogin: new Date(),
      updatedAt: new Date()
    });
  }

  private async cacheUser(user: User): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}${user.id}`;
    await this.redisService.cacheSet(cacheKey, user, this.CACHE_TTL);
  }
}
