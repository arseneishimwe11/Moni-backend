import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transaction } from '../schemas/transaction.schema';
import { PaymentStatus } from '../dto/payment.dto';
import { RedisService } from '@moni-backend/redis';
import { StatisticsQuery, TransactionStats } from '../interfaces/transaction-stats.interface';

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
      updatedAt: new Date(),
    });

    const saved = await transaction.save();
    await this.cacheTransaction(saved);
    return saved;
  }

  async updateTransaction(
    id: string,
    data: Partial<Transaction>
  ): Promise<Transaction> {
    const updated = await this.transactionModel.findByIdAndUpdate(
      id,
      {
        ...data,
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (updated) {
      await this.cacheTransaction(updated);
    }

    return updated;
  }

  async findById(id: string): Promise<Transaction> {
    const cached = await this.redisService.cacheGet<Transaction>(
      `transaction:${id}`
    );
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

  async findByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<Transaction[]> {
    return this.transactionModel
      .find({
        createdAt: { $gte: startDate, $lte: endDate },
      })
      .sort({ createdAt: -1 });
  }

  private async cacheTransaction(transaction: Transaction): Promise<void> {
    await this.redisService.cacheSet(
      `transaction:${transaction.id}`,
      transaction,
      this.CACHE_TTL
    );
  }

  async getStatistics(query: StatisticsQuery): Promise<TransactionStats> {
    const matchStage: Record<string, unknown> = {};

    if (query.startDate) {
      matchStage.createdAt = { $gte: query.startDate };
    }
    if (query.endDate) {
      matchStage.createdAt = {
        ...(matchStage.createdAt as Record<string, Date>),
        $lte: query.endDate,
      };
    }
    if (query.provider) {
      matchStage.paymentMethod = query.provider;
    }
    if (query.status) {
      matchStage.status = query.status;
    }

    const [stats] = await this.transactionModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          volume: { $sum: '$amount' },
          successful: {
            $sum: {
              $cond: [{ $eq: ['$status', 'SUCCEEDED'] }, 1, 0],
            },
          },
          byProvider: {
            $push: {
              provider: '$paymentMethod',
              amount: '$amount',
            },
          },
          byStatus: {
            $push: '$status',
          },
          byHour: {
            $push: {
              $hour: '$createdAt',
            },
          },
        },
      },
    ]);

    return this.formatStatistics(stats);
  }
  private formatStatistics(rawStats: {
    byProvider: Array<{ provider: string; amount: number }>;
    byStatus: string[];
    byHour: number[];
    total: number;
    volume: number;
    successful: number;
  }): TransactionStats {
    if (!rawStats) {
      return {
        totalTransactions: 0,
        totalVolume: 0,
        successRate: 0,
        averageTransactionValue: 0,
        byProvider: {},
        byStatus: {},
        hourlyDistribution: {},
      };
    }

    const byProvider = rawStats.byProvider.reduce(
      (acc: { [key: string]: { count: number; volume: number } }, curr) => {
        acc[curr.provider] = acc[curr.provider] || { count: 0, volume: 0 };
        acc[curr.provider].count++;
        acc[curr.provider].volume += curr.amount;
        return acc;
      },
      {}
    );

    const byStatus = rawStats.byStatus.reduce(
      (acc: { [key: string]: number }, curr) => {
        acc[curr] = (acc[curr] || 0) + 1;
        return acc;
      },
      {}
    );

    const hourlyDistribution = rawStats.byHour.reduce(
      (acc: { [key: number]: number }, curr) => {
        acc[curr] = (acc[curr] || 0) + 1;
        return acc;
      },
      {}
    );

    return {
      totalTransactions: rawStats.total,
      totalVolume: rawStats.volume,
      successRate: (rawStats.successful / rawStats.total) * 100,
      averageTransactionValue: rawStats.volume / rawStats.total,
      byProvider,
      byStatus,
      hourlyDistribution,
    };
  }
}
