import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@moni-backend/redis';

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

interface CircuitBreakerOptions {
  failureThreshold: number;  // Number of allowed failures before opening
  resetTimeout: number;      // Time (ms) before attempting to reset from OPEN to HALF_OPEN
  halfOpenTimeout: number;   // Time (ms) before deciding success/failure in HALF_OPEN
  maxRetries: number;        // Max retries allowed in HALF_OPEN state
}

@Injectable()
export class CircuitBreaker {
  private readonly logger = new Logger(CircuitBreaker.name);
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private lastFailureTime = 0;
  private readonly options: CircuitBreakerOptions;

  constructor(
    private readonly redisService: RedisService,
    options?: Partial<CircuitBreakerOptions>
  ) {
    this.options = {
      failureThreshold: options?.failureThreshold || 5,
      resetTimeout: options?.resetTimeout || 60000,
      halfOpenTimeout: options?.halfOpenTimeout || 30000,
      maxRetries: options?.maxRetries || 3
    };
  }

  async execute<T>(
    serviceId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const circuitKey = `circuit:${serviceId}`;
    const currentState = await this.getState(circuitKey);

    if (currentState === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        await this.setState(circuitKey, CircuitState.HALF_OPEN);
        this.logger.warn(`Circuit is HALF_OPEN for ${serviceId}, allowing limited operations`);
      } else {
        this.logger.error(`Circuit is OPEN for ${serviceId}, rejecting requests`);
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      await this.handleSuccess(circuitKey);
      return result;
    } catch (error) {
      await this.handleFailure(circuitKey, error);
      throw error;
    }
  }

  private async handleSuccess(circuitKey: string): Promise<void> {
    this.failures = 0;
    this.state = CircuitState.CLOSED;
    await this.setState(circuitKey, CircuitState.CLOSED);
    await this.redisService.cacheDelete(`${circuitKey}:failures`);
    this.logger.log(`Circuit closed for ${circuitKey} after successful operation`);
  }

  private async handleFailure(circuitKey: string, error: Error): Promise<void> {
    this.failures++;
    this.lastFailureTime = Date.now();

    await this.redisService.cacheSet(
      `${circuitKey}:failures`,
      this.failures,
      this.options.resetTimeout / 1000
    );

    if (this.failures >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      await this.setState(circuitKey, CircuitState.OPEN);
      this.logger.warn(`Circuit opened for ${circuitKey} after ${this.failures} failures`);
    } else {
      this.logger.warn(`Failure registered for ${circuitKey}: ${error.message}`);
    }
  }

  private async getState(circuitKey: string): Promise<CircuitState> {
    const state = await this.redisService.cacheGet<CircuitState>(circuitKey);
    return state || CircuitState.CLOSED;
  }

  private async setState(circuitKey: string, state: CircuitState): Promise<void> {
    await this.redisService.cacheSet(
      circuitKey,
      state,
      this.options.resetTimeout / 1000
    );
  }

  private shouldAttemptReset(): boolean {
    const now = Date.now();
    return now - this.lastFailureTime >= this.options.resetTimeout;
  }

  async getMetrics(serviceId: string) {
    const circuitKey = `circuit:${serviceId}`;
    return {
      state: await this.getState(circuitKey),
      failures: await this.redisService.cacheGet<number>(`${circuitKey}:failures`) || 0,
      lastFailureTime: this.lastFailureTime,
      isOpen: this.state === CircuitState.OPEN
    };
  }
}
