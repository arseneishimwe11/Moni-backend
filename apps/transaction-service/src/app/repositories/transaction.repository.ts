import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Transaction } from '../entity/transaction.entity';
import { PaymentStatus } from '../dto/payment.dto';
import { RedisService } from '@moni-backend/redis';
import { StatisticsQuery, TransactionStats } from '../interfaces/transaction-stats.interface';

@Injectable()
export class TransactionRepository {
  private readonly logger = new Logger(TransactionRepository.name);
  private readonly CACHE_TTL = 3600;

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly redisService: RedisService
  ) {}

  async createTransaction(data: Partial<Transaction>): Promise<Transaction> {
    const transaction = this.transactionRepository.create(data);
    const saved = await this.transactionRepository.save(transaction);
    await this.cacheTransaction(saved);
    return saved;
  }

  async updateTransaction( id: string, data: Partial<Transaction> ): Promise<Transaction> {
    await this.transactionRepository.update(id, data);
    const updated = await this.findById(id);
    if (updated) {
      await this.cacheTransaction(updated);
    }
    return updated;
  }

  async findById(id: string): Promise<Transaction> {
    const cached = await this.redisService.cacheGet<Transaction>(
      `transaction:${id}`
    );
    if (cached) return cached;

    const transaction = await this.transactionRepository.findOne({
      where: { id },
    });
    if (transaction) {
      await this.cacheTransaction(transaction);
    }
    return transaction;
  }

  async findByStatus(status: PaymentStatus): Promise<Transaction[]> {
    return this.transactionRepository.find({ where: { status } });
  }

  async findByCustomerId(customerId: string): Promise<Transaction[]> {
    return this.transactionRepository.find({ where: { customerId } });
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<Transaction[]> {
    return this.transactionRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
    });
  }

  private async cacheTransaction(transaction: Transaction): Promise<void> {
    await this.redisService.cacheSet(
      `transaction:${transaction.id}`,
      transaction,
      this.CACHE_TTL
    );
  }

  async getStatistics(query: StatisticsQuery): Promise<TransactionStats> {
    const queryBuilder =
      this.transactionRepository.createQueryBuilder('transaction');

    if (query.startDate) {
      queryBuilder.andWhere('transaction.createdAt >= :startDate', {
        startDate: query.startDate,
      });
    }
    if (query.endDate) {
      queryBuilder.andWhere('transaction.createdAt <= :endDate', {
        endDate: query.endDate,
      });
    }
    if (query.provider) {
      queryBuilder.andWhere('transaction.paymentMethod = :provider', {
        provider: query.provider,
      });
    }
    if (query.status) {
      queryBuilder.andWhere('transaction.status = :status', {
        status: query.status,
      });
    }

    const [transactions, total] = await queryBuilder.getManyAndCount();

    const stats = {
      totalTransactions: total,
      totalVolume: transactions.reduce((sum, t) => sum + Number(t.amount), 0),
      successRate:
        (transactions.filter((t) => t.status === PaymentStatus.SUCCEEDED)
          .length /
          total) *
        100,
      averageTransactionValue: total
        ? transactions.reduce((sum, t) => sum + Number(t.amount), 0) / total
        : 0,
      byProvider: this.groupByProvider(transactions),
      byStatus: this.groupByStatus(transactions),
      hourlyDistribution: this.groupByHour(transactions),
    };

    return stats;
  }

  private groupByProvider(
    transactions: Transaction[]
  ): Record<string, { count: number; volume: number }> {
    return transactions.reduce((acc, curr) => {
      if (!acc[curr.paymentMethod]) {
        acc[curr.paymentMethod] = { count: 0, volume: 0 };
      }
      acc[curr.paymentMethod].count++;
      acc[curr.paymentMethod].volume += Number(curr.amount);
      return acc;
    }, {});
  }

  private groupByStatus(transactions: Transaction[]): Record<string, number> {
    return transactions.reduce((acc, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + 1;
      return acc;
    }, {});
  }

  private groupByHour(transactions: Transaction[]): Record<number, number> {
    return transactions.reduce((acc, curr) => {
      const hour = new Date(curr.createdAt).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {});
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
