const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: '登录尝试过多，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { loginLimiter };
