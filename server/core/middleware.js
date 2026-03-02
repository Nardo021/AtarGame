'use strict';

const { verifyToken } = require('./auth');
const { getDb } = require('./db');
const { AppError } = require('./errors');

function requireAuth(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return next(new AppError('UNAUTHORIZED', '未登录', 401));
  const payload = verifyToken(token);
  if (!payload) return next(new AppError('TOKEN_EXPIRED', '登录已过期', 401));
  const db = getDb();
  const user = db.prepare('SELECT id, username, role, is_disabled FROM users WHERE id = ?').get(payload.id);
  if (!user || user.is_disabled) return next(new AppError('ACCOUNT_DISABLED', '账号已禁用', 403));
  try {
    const freeze = db.prepare('SELECT frozen FROM user_freeze WHERE user_id = ?').get(user.id);
    if (freeze && freeze.frozen) return next(new AppError('ACCOUNT_FROZEN', '账号已冻结', 403));
  } catch (_) {}
  req.user = { id: user.id, username: user.username, role: user.role };
  next();
}

function optionalAuth(req, _res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return next();
  const payload = verifyToken(token);
  if (!payload) return next();
  const db = getDb();
  const user = db.prepare('SELECT id, username, role, is_disabled FROM users WHERE id = ?').get(payload.id);
  if (!user || user.is_disabled) return next();
  try {
    const freeze = db.prepare('SELECT frozen FROM user_freeze WHERE user_id = ?').get(user.id);
    if (freeze && freeze.frozen) return next();
  } catch (_) {}
  req.user = { id: user.id, username: user.username, role: user.role };
  next();
}

function adminOnly(req, _res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(new AppError('FORBIDDEN', '需要管理员权限', 403));
  }
  next();
}

function requireAdminAuth(req, _res, next) {
  const token = req.cookies?.admin_token || req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return next(new AppError('UNAUTHORIZED', '未登录', 401));
  const payload = verifyToken(token);
  if (!payload) return next(new AppError('TOKEN_EXPIRED', '登录已过期', 401));
  const db = getDb();
  const user = db.prepare('SELECT id, username, role, is_disabled FROM users WHERE id = ?').get(payload.id);
  if (!user || user.is_disabled || user.role !== 'admin') {
    return next(new AppError('FORBIDDEN', '需要管理员权限', 403));
  }
  req.user = { id: user.id, username: user.username, role: user.role };
  next();
}

module.exports = { requireAuth, optionalAuth, adminOnly, requireAdminAuth };
