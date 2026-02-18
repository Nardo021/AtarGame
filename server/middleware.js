const { verifyToken } = require('./auth');
const { getDb } = require('./db');

function authMiddleware(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: '登录已过期' });
  }
  const db = getDb();
  const user = db.prepare('SELECT id, username, role, is_disabled FROM users WHERE id = ?').get(payload.id);
  if (!user || user.is_disabled) {
    return res.status(403).json({ error: '账号已禁用' });
  }
  req.user = payload;
  next();
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}

function optionalAuth(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const payload = verifyToken(token);
    if (payload) req.user = payload;
  }
  next();
}

function loadUser(req, res, next) {
  if (!req.user) return next();
  const db = getDb();
  const u = db.prepare('SELECT id, username, role, is_disabled FROM users WHERE id = ?').get(req.user.id);
  if (!u || u.is_disabled) {
    req.user = null;
    return next();
  }
  req.userDoc = u;
  next();
}

module.exports = { authMiddleware, adminOnly, optionalAuth, loadUser };
