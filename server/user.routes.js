const express = require('express');
const router = express.Router();
const { getDb } = require('./db');
const { register, login } = require('./auth');
const { authMiddleware, optionalAuth } = require('./middleware');

// 注册（必须提供有效邀请码）
router.post('/auth/register', (req, res) => {
  const { username, password, inviteCode } = req.body || {};
  if (!username || !password || username.length < 2) {
    return res.status(400).json({ error: '用户名或密码无效' });
  }
  const codeStr = (inviteCode && String(inviteCode).trim()) || '';
  if (!codeStr) return res.status(400).json({ error: '请输入邀请码' });
  const db = getDb();
  const row = db.prepare('SELECT id, code, max_uses, used_count FROM invite_codes WHERE code = ?').get(codeStr);
  if (!row) return res.status(400).json({ error: '邀请码无效' });
  const remaining = row.max_uses === 0 ? Infinity : row.max_uses - row.used_count;
  if (remaining <= 0) return res.status(400).json({ error: '该邀请码已达使用上限' });
  const user = register(username, password);
  if (!user) return res.status(400).json({ error: '用户名已存在' });
  db.prepare('UPDATE invite_codes SET used_count = used_count + 1 WHERE id = ?').run(row.id);
  const token = require('./auth').createToken({ id: user.id, username: user.username, role: user.role });
  res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000, sameSite: 'lax' });
  res.json({ user: { id: user.id, username: user.username, role: user.role } });
});

// 登录（rememberMe 为 true 时 cookie 30 天，否则 7 天）
router.post('/auth/login', (req, res) => {
  const { username, password, rememberMe } = req.body || {};
  const result = login(username, password);
  if (!result) return res.status(401).json({ error: '用户名或密码错误' });
  const maxAge = rememberMe ? 30 * 24 * 3600 * 1000 : 7 * 24 * 3600 * 1000;
  res.cookie('token', result.token, { httpOnly: true, maxAge, sameSite: 'lax' });
  res.json({ user: { id: result.id, username: result.username, role: result.role } });
});

// 登出
router.post('/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// 当前用户
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// 存档列表
router.get('/saves', authMiddleware, (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT slot, state_json, summary_json, updated_at FROM saves WHERE user_id = ? ORDER BY slot').all(req.user.id);
  res.json({ saves: rows });
});

// 读档
router.get('/saves/:slot', authMiddleware, (req, res) => {
  const slot = parseInt(req.params.slot, 10);
  if (isNaN(slot) || slot < 0 || slot > 9) return res.status(400).json({ error: '无效槽位' });
  const db = getDb();
  const row = db.prepare('SELECT state_json, summary_json, updated_at FROM saves WHERE user_id = ? AND slot = ?').get(req.user.id, slot);
  if (!row) return res.status(404).json({ error: '无存档' });
  res.json({ state: JSON.parse(row.state_json), summary: row.summary_json ? JSON.parse(row.summary_json) : null, updated_at: row.updated_at });
});

// 存档（覆盖前写入备份供管理员回档）
router.post('/saves/:slot', authMiddleware, (req, res) => {
  const slot = parseInt(req.params.slot, 10);
  if (isNaN(slot) || slot < 0 || slot > 9) return res.status(400).json({ error: '无效槽位' });
  const { state, summary } = req.body || {};
  if (!state) return res.status(400).json({ error: '缺少 state' });
  const db = getDb();
  const existing = db.prepare('SELECT state_json FROM saves WHERE user_id = ? AND slot = ?').get(req.user.id, slot);
  if (existing) {
    db.prepare('INSERT INTO save_backups (user_id, slot, state_json, reason) VALUES (?, ?, ?, ?)').run(req.user.id, slot, existing.state_json, '用户存档前自动备份');
  }
  db.prepare(
    'INSERT INTO saves (user_id, slot, state_json, summary_json, updated_at) VALUES (?, ?, ?, ?, datetime(\'now\')) ON CONFLICT(user_id, slot) DO UPDATE SET state_json=excluded.state_json, summary_json=excluded.summary_json, updated_at=datetime(\'now\')'
  ).run(req.user.id, slot, JSON.stringify(state), summary ? JSON.stringify(summary) : null);
  res.json({ ok: true });
});

// 行动日志（用户侧）
router.get('/actions', authMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
  const db = getDb();
  const rows = db.prepare('SELECT * FROM action_logs WHERE user_id = ? ORDER BY ts DESC LIMIT ?').all(req.user.id, limit);
  res.json({ actions: rows });
});

// 事件日志（用户侧）
router.get('/events', authMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
  const db = getDb();
  const rows = db.prepare('SELECT * FROM event_logs WHERE user_id = ? ORDER BY ts DESC LIMIT ?').all(req.user.id, limit);
  res.json({ events: rows });
});

// 排行榜
router.get('/leaderboard', optionalAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const mode = req.query.mode || 'best_ever'; // best_at_last_day | best_ever | latest
  const db = getDb();
  const saves = db.prepare('SELECT user_id, slot, state_json, updated_at FROM saves ORDER BY updated_at DESC').all();
  const byUser = {};
  saves.forEach(s => {
    let state;
    try { state = JSON.parse(s.state_json); } catch { return; }
    const atar = typeof state.atar === 'number' ? state.atar : (state.stats && state.stats.atar);
    const uid = s.user_id;
    const uname = db.prepare('SELECT username FROM users WHERE id = ?').get(uid)?.username || '?';
    if (!byUser[uid]) byUser[uid] = { userId: uid, username: uname, atar: -1, date: state.date_iso };
    const a = atar != null ? atar : -1;
    if (mode === 'latest') {
      const cur = byUser[uid];
      if (!cur.updated_at || s.updated_at > cur.updated_at) {
        byUser[uid] = { userId: uid, username: uname, atar: a, date: state.date_iso, updated_at: s.updated_at };
      }
    } else if (mode === 'best_ever' && a > byUser[uid].atar) {
      byUser[uid].atar = a;
      byUser[uid].date = state.date_iso;
    } else if (mode === 'best_at_last_day' && state.date_iso) {
      if (a > byUser[uid].atar) byUser[uid].atar = a;
      byUser[uid].date = state.date_iso;
    }
  });
  const list = Object.values(byUser).filter(x => x.atar >= 0).sort((a, b) => b.atar - a.atar).slice(0, limit);
  res.json({ leaderboard: list });
});

// 留言板：列表
router.get('/board', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const db = getDb();
  const rows = db.prepare(
    'SELECT p.id, p.user_id, p.content, p.created_at, u.username FROM board_posts p JOIN users u ON u.id = p.user_id WHERE p.is_deleted = 0 ORDER BY p.created_at DESC LIMIT ?'
  ).all(limit);
  res.json({ posts: rows });
});

// 留言板：发帖（需登录）
router.post('/board', authMiddleware, (req, res) => {
  const content = (req.body && req.body.content) ? String(req.body.content).trim() : '';
  if (!content || content.length > 2000) return res.status(400).json({ error: '内容无效或过长' });
  const db = getDb();
  db.prepare('INSERT INTO board_posts (user_id, content) VALUES (?, ?)').run(req.user.id, content);
  res.json({ ok: true });
});

// 日历：某月事件（全局 + 个人）
router.get('/calendar', authMiddleware, (req, res) => {
  const month = (req.query.month || '').trim();
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: '请提供 month=YYYY-MM' });
  const [y, m] = month.split('-').map(Number);
  const start = month + '-01';
  const lastDay = new Date(y, m, 0).getDate();
  const end = month + '-' + String(lastDay).padStart(2, '0');
  const db = getDb();
  const rows = db.prepare(
    `SELECT id, user_id, date_iso, title, type, detail_json FROM calendar_events
     WHERE date_iso >= ? AND date_iso <= ? AND (user_id IS NULL OR user_id = ?) ORDER BY date_iso`
  ).all(start, end, req.user.id);
  res.json({ events: rows });
});

// 日记：按日期范围查询
router.get('/diary', authMiddleware, (req, res) => {
  const from = (req.query.from || '').trim();
  const to = (req.query.to || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ error: '请提供 from=YYYY-MM-DD&to=YYYY-MM-DD' });
  }
  const db = getDb();
  const rows = db.prepare(
    'SELECT date_iso, content, created_at FROM diary_entries WHERE user_id = ? AND date_iso >= ? AND date_iso <= ? ORDER BY date_iso'
  ).all(req.user.id, from, to);
  res.json({ entries: rows });
});

// 日记：写入或更新某日（跨天时前端调用）
router.post('/diary', authMiddleware, (req, res) => {
  const { date_iso, content } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date_iso) || typeof content !== 'string') {
    return res.status(400).json({ error: '请提供 date_iso 与 content' });
  }
  const db = getDb();
  db.prepare(
    'INSERT INTO diary_entries (user_id, date_iso, content) VALUES (?, ?, ?) ON CONFLICT(user_id, date_iso) DO UPDATE SET content=excluded.content'
  ).run(req.user.id, date_iso, content.slice(0, 10000));
  res.json({ ok: true });
});

// 某日行动与事件（供日历点击查看）
router.get('/day-log', authMiddleware, (req, res) => {
  const date = (req.query.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: '请提供 date=YYYY-MM-DD' });
  const db = getDb();
  const actions = db.prepare('SELECT * FROM action_logs WHERE user_id = ? AND date_iso = ? ORDER BY time_block').all(req.user.id, date);
  const events = db.prepare('SELECT * FROM event_logs WHERE user_id = ? AND date_iso = ? ORDER BY time_block').all(req.user.id, date);
  res.json({ actions, events });
});

module.exports = router;
