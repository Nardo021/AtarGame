'use strict';

const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { ok: false, error: { code: 'RATE_LIMITED', message: '登录尝试过多，请稍后再试' } },
  standardHeaders: true,
  legacyHeaders: false
});

const boardPostLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { ok: false, error: { code: 'RATE_LIMITED', message: '发帖过于频繁，请稍后再试' } },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { loginLimiter, boardPostLimiter };
