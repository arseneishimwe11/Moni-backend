import { registerAs } from '@nestjs/config';

export const systemConfig = registerAs('system', () => ({
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  apiKey: process.env.API_KEY,
  region: process.env.REGION || 'default',
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD
  },

  rateLimiting: {
    ttl: 60,
    limit: 100
  },

  services: {
    user: process.env.USER_SERVICE_URL,
    payment: process.env.PAYMENT_SERVICE_URL,
    notification: process.env.NOTIFICATION_SERVICE_URL,
    audit: process.env.AUDIT_SERVICE_URL
  },

  metrics: {
    enabled: process.env.ENABLE_METRICS === 'true',
    interval: parseInt(process.env.METRICS_INTERVAL, 10) || 15000
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    path: process.env.LOG_PATH || 'logs',
    maxFiles: parseInt(process.env.LOG_MAX_FILES, 10) || 5,
    maxSize: process.env.LOG_MAX_SIZE || '10m'
  },

  security: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10
  }
}));
