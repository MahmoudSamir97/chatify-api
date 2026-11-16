const { rateLimit } = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000;

const baseOptions = {
  windowMs: WINDOW_MS,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
};

// Generous limit for normal app traffic (every message is a request).
exports.apiLimiter = rateLimit({
  ...baseOptions,
  limit: 1000,
  message: { status: 'fail', message: 'Too many requests, try again later.' },
});

// Strict limit for credential endpoints to slow down brute-force attempts.
exports.authLimiter = rateLimit({
  ...baseOptions,
  limit: 20,
  message: {
    status: 'fail',
    message: 'Too many attempts, try again in 15 minutes.',
  },
});
