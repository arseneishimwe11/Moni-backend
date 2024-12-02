export default () => ({
    port: parseInt(process.env.GATEWAY_PORT, 10) || 3000,
    apiKey: process.env.API_GATEWAY_KEY,
    services: {
      auth: {
        host: process.env.AUTH_SERVICE_HOST || 'localhost',
        port: parseInt(process.env.AUTH_SERVICE_PORT, 10) || 3001,
      },
      user: {
        host: process.env.USER_SERVICE_HOST || 'localhost',
        port: parseInt(process.env.USER_SERVICE_PORT, 10) || 3002,
      },
      transaction: {
        host: process.env.TRANSACTION_SERVICE_HOST || 'localhost',
        port: parseInt(process.env.TRANSACTION_SERVICE_PORT, 10) || 3003,
      },
      notification: {
        host: process.env.NOTIFICATION_SERVICE_HOST || 'localhost',
        port: parseInt(process.env.NOTIFICATION_SERVICE_PORT, 10) || 3004,
      },
      audit: {
        host: process.env.AUDIT_SERVICE_HOST || 'localhost',
        port: parseInt(process.env.AUDIT_SERVICE_PORT, 10) || 3005,
      },
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    },
    rateLimit: {
      ttl: parseInt(process.env.RATE_LIMIT_TTL, 10) || 60,
      limit: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
    },
  });
  