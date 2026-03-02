'use strict';

class AppError extends Error {
  constructor(code, message, status = 400, details) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function ok(data) {
  return { ok: true, data };
}

function fail(code, message, status = 400, details) {
  throw new AppError(code, message, status, details);
}

function errorMiddleware(err, req, res, _next) {
  if (res.headersSent) return;
  const status = err.status || 500;
  const code = err.code || 'INTERNAL';
  const message = err.message || 'Internal Server Error';
  if (status >= 500) console.error('[ERROR]', err);
  res.status(status).json({
    ok: false,
    error: { code, message, details: err.details || undefined }
  });
}

function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { AppError, ok, fail, errorMiddleware, asyncHandler };
