import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transaction } from '../schemas/transaction.schema';
import { PaymentStatus } from '../dto/payment.dto';
import { RedisService } from '@moni-backend/redis';

@Injectable()
export class TransactionRepository {
  private readonly logger = new Logger(TransactionRepository.name);
  private readonly CACHE_TTL = 3600;

  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    private readonly redisService: RedisService
  ) {}

  async createTransaction(data: Partial<Transaction>): Promise<Transaction> {
    const transaction = new this.transactionModel({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const saved = await transaction.save();
    await this.cacheTransaction(saved);
    return saved;
  }

  async updateTransaction(id: string, data: Partial<Transaction>): Promise<Transaction> {
    const updated = await this.transactionModel.findByIdAndUpdate(
      id,
      {
        ...data,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (updated) {
      await this.cacheTransaction(updated);
    }

    return updated;
  }

  async findById(id: string): Promise<Transaction> {
    const cached = await this.redisService.cacheGet<Transaction>(`transaction:${id}`);
    if (cached) {
      return cached;
    }

    const transaction = await this.transactionModel.findById(id);
    if (transaction) {
      await this.cacheTransaction(transaction);
    }

    return transaction;
  }

  async findByStatus(status: PaymentStatus): Promise<Transaction[]> {
    return this.transactionModel.find({ status }).sort({ createdAt: -1 });
  }

  async findByCustomerId(customerId: string): Promise<Transaction[]> {
    return this.transactionModel.find({ customerId }).sort({ createdAt: -1 });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Transaction[]> {
    return this.transactionModel.find({
      createdAt: { $gte: startDate, $lte: endDate }
    }).sort({ createdAt: -1 });
  }

  private async cacheTransaction(transaction: Transaction): Promise<void> {
    await this.redisService.cacheSet(
      `transaction:${transaction.id}`,
      transaction,
      this.CACHE_TTL
    );
  }
}
