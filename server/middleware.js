const { verifyToken } = require('./auth');
const { getDb } = require('./db');

/**
 * 鉴权中间件：从 httpOnly cookie 或 Authorization 读取 token，校验并挂载 req.user；禁用用户返回 403
 */
function requireAuth(req, res, next) {
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
  try {
    const freeze = db.prepare('SELECT frozen FROM user_freeze WHERE user_id = ?').get(user.id);
    if (freeze && freeze.frozen) {
      return res.status(403).json({ error: '账号已冻结' });
    }
  } catch (e) { /* user_freeze 表可能不存在 */ }
  req.user = { id: user.id, username: user.username, role: user.role };
  next();
}

/** 可选鉴权：有 token 则挂载 req.user，无则不挂载，不 401 */
function optionalAuth(req, res, next) {
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
  } catch (e) {}
  req.user = { id: user.id, username: user.username, role: user.role };
  next();
}

/** 仅 admin 可访问（依赖 requireAuth 已设置 req.user） */
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}

/**
 * 后台专用鉴权：优先读 admin_token，其次 token；校验后要求 role===admin。
 * 用于 /api/admin/*，与游戏端登录（token）分离，后台使用单独登录界面与 admin_token。
 */
function requireAdminAuth(req, res, next) {
  const token = req.cookies?.admin_token || req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: '登录已过期' });
  }
  const db = getDb();
  const user = db.prepare('SELECT id, username, role, is_disabled FROM users WHERE id = ?').get(payload.id);
  if (!user || user.is_disabled || user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  req.user = { id: user.id, username: user.username, role: user.role };
  next();
}

module.exports = { requireAuth, optionalAuth, adminOnly, requireAdminAuth };
