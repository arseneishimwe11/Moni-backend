export const REDIS_PREFIXES = {
    RATE_LIMIT: 'rate:',
    CACHE: 'cache:',
    LOCK: 'lock:',
    PAYMENT: 'payment:',
    USER: 'user:',
    SESSION: 'session:'
  };
  
  export const REDIS_TTL = {
    RATE_LIMIT: 300,
    CACHE: 3600,
    LOCK: 30,
    PAYMENT: 86400,
    SESSION: 7200
  };
  