import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

/**
 * Simple in-memory rate limiter
 * For production, use Redis or similar distributed store
 */
export function rateLimit(options: {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  keyGenerator?: (req: Request) => string;
}) {
  const { windowMs, max, keyGenerator } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator ? keyGenerator(req) : req.ip || 'unknown';
    const now = Date.now();

    // Clean up expired entries
    Object.keys(store).forEach((k) => {
      if (store[k].resetTime < now) {
        delete store[k];
      }
    });

    // Get or create entry
    let entry = store[key];
    if (!entry || entry.resetTime < now) {
      entry = {
        count: 0,
        resetTime: now + windowMs,
      };
      store[key] = entry;
    }

    // Check limit
    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.status(429).json({
        error: 'Too many requests',
        retryAfter,
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      });
      return;
    }

    // Increment counter
    entry.count++;

    // Add headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());

    next();
  };
}

/**
 * Rate limiter for search endpoint (stricter)
 */
export const searchRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
});

/**
 * Rate limiter for auth endpoints (stricter to prevent brute force)
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  keyGenerator: (req) => {
    // Use email if available, otherwise IP
    const body = req.body as { email?: string };
    return body?.email ? `auth:${body.email}` : req.ip || 'unknown';
  },
});