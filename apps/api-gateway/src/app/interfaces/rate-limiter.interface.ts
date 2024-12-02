import { Request, Response, NextFunction } from 'express';

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  keyPrefix?: string;
  errorMessage?: string;
  skipFailedRequests?: boolean;
  handler?: (req: Request, res: Response, next: NextFunction) => void;
}

export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  reset: number;
}

export interface RateLimitResponse {
  statusCode: number;
  error: string;
  message: string;
  retryAfter: number;
}

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
  keyPrefix?: string;
  errorMessage?: string;
  skipFailedRequests?: boolean;
  handler?: (req: Request, res: Response, next: NextFunction) => void;
}
