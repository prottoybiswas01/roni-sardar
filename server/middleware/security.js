import rateLimit from 'express-rate-limit';

/**
 * Enterprise NoSQL Injection Protection Middleware
 * Recursively strips keys starting with '$' or containing '.' from request body, query, and params.
 * Prevents malicious operators like { "$gt": "" }, { "$ne": null }, { "$where": "..." } from reaching Mongo queries.
 */
export const mongoSanitize = (req, res, next) => {
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }

    const clean = {};
    for (const [key, value] of Object.entries(obj)) {
      // Strip dangerous MongoDB query operator prefixes ($) and path separators (.)
      if (key.startsWith('$') || key.includes('.')) {
        continue;
      }
      clean[key] = typeof value === 'object' ? sanitize(value) : value;
    }
    return clean;
  };

  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);

  next();
};

/**
 * Dedicated Strict Auth Rate Limiter
 * Blocks automated credential stuffing & brute-force OTP / password guessing
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Max 20 attempts per IP per 15 mins for login / OTP / password reset
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'অতিরিক্ত চেষ্টার কারণে সাময়িকভাবে ব্লক করা হয়েছে। অনুগ্রহ করে ১৫ মিনিট পর পুনরায় চেষ্টা করুন। (Too many authentication attempts, please try again in 15 minutes)',
  },
});
