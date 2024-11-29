export interface RedisConfig {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
  }
  
  export interface RateLimitConfig {
    key: string;
    limit: number;
    window: number;
  }
  