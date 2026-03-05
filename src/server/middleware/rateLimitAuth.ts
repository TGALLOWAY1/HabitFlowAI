/**
 * Rate limiters for auth and admin routes (login, redeem, invite creation).
 */

import rateLimit from 'express-rate-limit';

/** Login + redeem: 10 requests per 15 minutes per IP */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Admin invite creation: 20 per 15 minutes per IP */
export const adminInviteRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** High-write entry endpoints: 100 per 15 minutes per IP (create/upsert/batch/delete) */
export const entriesWriteRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many write requests. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
