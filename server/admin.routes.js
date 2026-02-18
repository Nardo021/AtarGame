const express = require('express');
const router = express.Router();
const { getDb } = require('./db');
const { requireAdminAuth } = require('./middleware');
const { hashPassword, createToken, createTokenWithExpiry, login } = require('./auth');
const { runSimulation, saveRun } = require('./simulator');

const COOKIE_OPTS = { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000, sameSite: 'lax' };

// ---- 后台单独登录（与游戏端 token 分离，使用 admin_token） ----
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' });
    }
    const result = login(String(username).trim(), password);
    if (!result) return res.status(401).json({ error: '用户名或密码错误' });
    if (result.role !== 'admin') return res.status(403).json({ error: '需要管理员账号' });
    res.cookie('admin_token', result.token, COOKIE_OPTS);
    res.json({ user: { id: result.id, username: result.username, role: result.role } });
  } catch (e) {
    res.status(500).json({ error: e.message || '登录失败' });
  }
});

router.get('/me', (req, res) => {
  const token = req.cookies?.admin_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未登录' });
  const { verifyToken } = require('./auth');
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: '登录已过期' });
  const db = getDb();
  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(payload.id);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  res.json({ user: { id: user.id, username: user.username, role: user.role } });
});

router.post('/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ ok: true });
});

function audit(adminUserId, action, targetUserId, detail) {
  const db = getDb();
  db.prepare(
    'INSERT INTO audit_logs (admin_user_id, action, target_user_id, detail_json) VALUES (?, ?, ?, ?)'
  ).run(adminUserId, action, targetUserId != null ? targetUserId : null, detail ? JSON.stringify(detail) : null);
}

function ensureUserFreezeTable(db) {
  try {
    db.prepare('SELECT 1 FROM user_freeze LIMIT 1').get();
  } catch (e) {
    try {
      db.prepare("CREATE TABLE IF NOT EXISTS user_freeze (user_id INTEGER NOT NULL PRIMARY KEY REFERENCES users(id), frozen INTEGER NOT NULL DEFAULT 1, reason TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
    } catch (e2) {}
  }
}

// ---- Users ----
router.get('/users', requireAdminAuth, (req, res) => {
  try {
    const db = getDb();
    const search = (req.query.search || '').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    let where = '';
    const params = [];
    if (search) {
      where = ' WHERE username LIKE ?';
      params.push('%' + search + '%');
    }
    const countRow = db.prepare('SELECT COUNT(*) AS c FROM users' + where).get(...params);
    const total = countRow.c;
    params.push(limit, offset);
    const rows = db.prepare('SELECT id, username, role, is_disabled, created_at FROM users' + where + ' ORDER BY id LIMIT ? OFFSET ?').all(...params);
    ensureUserFreezeTable(db);
    const freezeRows = db.prepare('SELECT user_id, frozen, reason FROM user_freeze').all();
    const freezeMap = {};
    freezeRows.forEach(r => { freezeMap[r.user_id] = r; });
    const list = rows.map(r => ({
      ...r,
      is_disabled: !!r.is_disabled,
      frozen: freezeMap[r.id] ? !!freezeMap[r.id].frozen : false,
      freeze_reason: freezeMap[r.id] ? freezeMap[r.id].reason : null
    }));
    res.json({ users: list, total, page, limit });
  } catch (e) {
    res.status(500).json({ error: e.message || '获取用户列表失败' });
  }
});

router.post('/users', requireAdminAuth, (req, res) => {
  try {
    const { username, password, role } = req.body || {};
    if (!username || typeof username !== 'string' || username.trim().length < 2) {
      return res.status(400).json({ error: '用户名至少 2 个字符' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: '密码至少 6 位' });
    }
    const db = getDb();
    const hash = hashPassword(password);
    const r = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username.trim(), hash, role === 'admin' ? 'admin' : 'user');
    audit(req.user.id, 'user_create', r.lastInsertRowid, { username: username.trim(), role: role || 'user' });
    res.status(201).json({ user: { id: r.lastInsertRowid, username: username.trim(), role: role === 'admin' ? 'admin' : 'user' } });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(409).json({ error: '用户名已存在' });
    res.status(500).json({ error: e.message || '创建用户失败' });
  }
});

router.patch('/users/:id', requireAdminAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: '无效用户 ID' });
    const { is_disabled, role } = req.body || {};
    const db = getDb();
    const u = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id);
    if (!u) return res.status(404).json({ error: '用户不存在' });
    const updates = [];
    const params = [];
    if (typeof is_disabled === 'boolean') {
      updates.push('is_disabled = ?');
      params.push(is_disabled ? 1 : 0);
    }
    if (role === 'admin' || role === 'user') {
      updates.push('role = ?');
      params.push(role);
    }
    if (updates.length === 0) return res.status(400).json({ error: '无有效更新' });
    params.push(id);
    db.prepare('UPDATE users SET ' + updates.join(', ') + ' WHERE id = ?').run(...params);
    audit(req.user.id, 'user_patch', id, { is_disabled, role });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || '更新失败' });
  }
});

router.delete('/users/:id', requireAdminAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: '无效用户 ID' });
    const db = getDb();
    const u = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id);
    if (!u) return res.status(404).json({ error: '用户不存在' });
    if (u.username === 'admin') return res.status(403).json({ error: '不能删除 admin 账号' });
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    audit(req.user.id, 'user_delete', id, { username: u.username });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || '删除失败' });
  }
});

router.post('/users/:id/reset-password', requireAdminAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: '无效用户 ID' });
    const { password } = req.body || {};
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: '密码至少 6 位' });
    }
    const db = getDb();
    const u = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id);
    if (!u) return res.status(404).json({ error: '用户不存在' });
    const hash = hashPassword(password);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
    audit(req.user.id, 'user_reset_password', id, { username: u.username });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || '重置密码失败' });
  }
});

router.get('/users/:id/saves', requireAdminAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: '无效用户 ID' });
    const db = getDb();
    const rows = db.prepare('SELECT slot, state_json, summary_json, updated_at FROM saves WHERE user_id = ? ORDER BY slot').all(id);
    res.json({ saves: rows });
  } catch (e) {
    res.status(500).json({ error: e.message || '获取存档失败' });
  }
});

router.get('/users/:id/saves/:slot', requireAdminAuth, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const slot = parseInt(req.params.slot, 10);
    if (isNaN(userId) || isNaN(slot) || slot < 0 || slot > 9) return res.status(400).json({ error: '无效参数' });
    const db = getDb();
    const row = db.prepare('SELECT state_json, summary_json, updated_at FROM saves WHERE user_id = ? AND slot = ?').get(userId, slot);
    if (!row) return res.status(404).json({ error: '无存档' });
    res.json({
      state_json: row.state_json,
      summary_json: row.summary_json,
      updated_at: row.updated_at
    });
  } catch (e) {
    res.status(500).json({ error: e.message || '获取存档失败' });
  }
});

router.put('/users/:id/saves/:slot', requireAdminAuth, (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const slot = parseInt(req.params.slot, 10);
    if (isNaN(userId) || isNaN(slot) || slot < 0 || slot > 9) return res.status(400).json({ error: '无效参数' });
    const { state_json, summary_json } = req.body || {};
    const db = getDb();
    const existing = db.prepare('SELECT state_json, summary_json FROM saves WHERE user_id = ? AND slot = ?').get(userId, slot);
    let stateStr = state_json != null ? (typeof state_json === 'string' ? state_json : JSON.stringify(state_json)) : null;
    let summaryStr = summary_json != null ? (typeof summary_json === 'string' ? summary_json : JSON.stringify(summary_json)) : null;
    if (stateStr != null) {
      try { JSON.parse(stateStr); } catch (err) { return res.status(400).json({ error: 'state_json 不是合法 JSON' }); }
    }
    if (summaryStr != null) {
      try { JSON.parse(summaryStr); } catch (err) { return res.status(400).json({ error: 'summary_json 不是合法 JSON' }); }
    }
    const backup = existing ? { state_json: existing.state_json, summary_json: existing.summary_json } : null;
    if (backup) audit(req.user.id, 'admin_save_backup', userId, { slot, backup });
    stateStr = stateStr != null ? stateStr : (existing && existing.state_json) || null;
    summaryStr = summaryStr != null ? summaryStr : (existing && existing.summary_json) || null;
    db.prepare(
      `INSERT INTO saves (user_id, slot, state_json, summary_json, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, slot) DO UPDATE SET state_json = excluded.state_json, summary_json = excluded.summary_json, updated_at = datetime('now')`
    ).run(userId, slot, stateStr, summaryStr);
    audit(req.user.id, 'admin_save_put', userId, { slot });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || '保存失败' });
  }
});

router.post('/users/:id/impersonate', requireAdminAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: '无效用户 ID' });
    const db = getDb();
    const u = db.prepare('SELECT id, username, role FROM users WHERE id = ? AND is_disabled = 0').get(id);
    if (!u) return res.status(404).json({ error: '用户不存在或已禁用' });
    const token = createTokenWithExpiry({ id: u.id, username: u.username, role: u.role, impersonatedBy: req.user.id }, '1h');
    audit(req.user.id, 'impersonate', id, { username: u.username });
    res.cookie('token', token, { httpOnly: true, maxAge: 60 * 60 * 1000, sameSite: 'lax' });
    res.json({ ok: true, redirect: '/' });
  } catch (e) {
    res.status(500).json({ error: e.message || '冒充失败' });
  }
});

router.post('/users/:id/freeze', requireAdminAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: '无效用户 ID' });
    const { frozen, reason } = req.body || {};
    const db = getDb();
    ensureUserFreezeTable(db);
    const u = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id);
    if (!u) return res.status(404).json({ error: '用户不存在' });
    const freeze = !!frozen;
    db.prepare(
      'INSERT INTO user_freeze (user_id, frozen, reason, updated_at) VALUES (?, ?, ?, datetime(\'now\')) ON CONFLICT(user_id) DO UPDATE SET frozen = excluded.frozen, reason = excluded.reason, updated_at = datetime(\'now\')'
    ).run(id, freeze ? 1 : 0, reason || null);
    audit(req.user.id, 'user_freeze', id, { frozen: freeze, reason: reason || null });
    res.json({ ok: true, frozen: freeze });
  } catch (e) {
    res.status(500).json({ error: e.message || '操作失败' });
  }
});

router.post('/users/:id/push-event', requireAdminAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: '无效用户 ID' });
    const { date_iso, time_block, location, event_id, event_type, title, detail } = req.body || {};
    if (!date_iso || !event_id || !event_type) return res.status(400).json({ error: '缺少 date_iso / event_id / event_type' });
    const db = getDb();
    const t = time_block || 'Morning';
    const loc = location || 'classroom';
    db.prepare(
      'INSERT INTO event_logs (user_id, date_iso, time_block, location, event_id, event_type, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, date_iso, t, loc, event_id, event_type, detail ? JSON.stringify(detail) : null);
    if (title) {
      db.prepare(
        'INSERT INTO calendar_events (user_id, date_iso, title, type, detail_json) VALUES (?, ?, ?, ?, ?)'
      ).run(id, date_iso, title, event_type || 'forced', detail ? JSON.stringify(detail) : null);
    }
    audit(req.user.id, 'push_event', id, { date_iso, event_id, event_type });
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || '注入事件失败' });
  }
});

router.post('/broadcast', requireAdminAuth, (req, res) => {
  try {
    const { title, body, expires_at } = req.body || {};
    if (!title || typeof title !== 'string') return res.status(400).json({ error: '缺少 title' });
    const db = getDb();
    db.prepare('INSERT INTO messages (title, body, expires_at) VALUES (?, ?, ?)').run(title, body || '', expires_at || null);
    audit(req.user.id, 'broadcast', null, { title, body: (body || '').slice(0, 200) });
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || '发布失败' });
  }
});

router.get('/audit', requireAdminAuth, (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const db = getDb();
    const rows = db.prepare(
      `SELECT a.id, a.admin_user_id, a.ts, a.action, a.target_user_id, a.detail_json, u.username AS admin_username
       FROM audit_logs a LEFT JOIN users u ON u.id = a.admin_user_id
       ORDER BY a.id DESC LIMIT ? OFFSET ?`
    ).all(limit, offset);
    const total = db.prepare('SELECT COUNT(*) AS c FROM audit_logs').get().c;
    res.json({ logs: rows, total });
  } catch (e) {
    res.status(500).json({ error: e.message || '获取审计日志失败' });
  }
});

// ---- Story ----
router.get('/story', requireAdminAuth, (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT id, active_version_id, story_json, updated_at FROM story_store ORDER BY id DESC LIMIT 1').get();
    const versions = db.prepare('SELECT id, ts, admin_user_id, note FROM story_versions ORDER BY id DESC LIMIT 50').all();
    res.json({
      story_json: row ? row.story_json : null,
      active_version_id: row ? row.active_version_id : null,
      updated_at: row ? row.updated_at : null,
      versions
    });
  } catch (e) {
    res.status(500).json({ error: e.message || '获取剧情失败' });
  }
});

router.put('/story', requireAdminAuth, (req, res) => {
  try {
    const { story_json, note } = req.body || {};
    if (story_json === undefined) return res.status(400).json({ error: '缺少 story_json' });
    const raw = typeof story_json === 'string' ? story_json : JSON.stringify(story_json);
    try { JSON.parse(raw); } catch (err) { return res.status(400).json({ error: 'story_json 不是合法 JSON' }); }
    const db = getDb();
    const ver = db.prepare('INSERT INTO story_versions (ts, admin_user_id, story_json, note) VALUES (datetime(\'now\'), ?, ?, ?)').run(req.user.id, raw, note || null);
    const versionId = ver.lastInsertRowid;
    let row = db.prepare('SELECT id FROM story_store LIMIT 1').get();
    if (row) {
      db.prepare('UPDATE story_store SET active_version_id = ?, story_json = ?, updated_at = datetime(\'now\') WHERE id = ?').run(versionId, raw, row.id);
    } else {
      db.prepare('INSERT INTO story_store (active_version_id, story_json, updated_at) VALUES (?, ?, datetime(\'now\'))').run(versionId, raw);
    }
    audit(req.user.id, 'story_update', null, { version_id: versionId, note: note || null });
    res.json({ ok: true, version_id: versionId });
  } catch (e) {
    res.status(500).json({ error: e.message || '保存剧情失败' });
  }
});

router.post('/story/rollback/:versionId', requireAdminAuth, (req, res) => {
  try {
    const versionId = parseInt(req.params.versionId, 10);
    if (isNaN(versionId)) return res.status(400).json({ error: '无效版本 ID' });
    const db = getDb();
    const v = db.prepare('SELECT id, story_json FROM story_versions WHERE id = ?').get(versionId);
    if (!v) return res.status(404).json({ error: '版本不存在' });
    let row = db.prepare('SELECT id FROM story_store LIMIT 1').get();
    if (row) {
      db.prepare('UPDATE story_store SET active_version_id = ?, story_json = ?, updated_at = datetime(\'now\') WHERE id = ?').run(versionId, v.story_json, row.id);
    } else {
      db.prepare('INSERT INTO story_store (active_version_id, story_json, updated_at) VALUES (?, ?, datetime(\'now\'))').run(versionId, v.story_json);
    }
    audit(req.user.id, 'story_rollback', null, { version_id: versionId });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || '回滚失败' });
  }
});

// ---- Board 删帖 ----
router.delete('/board/:id', requireAdminAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: '无效帖子 ID' });
    const db = getDb();
    const row = db.prepare('SELECT id FROM board_posts WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: '帖子不存在' });
    db.prepare('UPDATE board_posts SET is_deleted = 1 WHERE id = ?').run(id);
    audit(req.user.id, 'board_delete', null, { post_id: id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || '删帖失败' });
  }
});

// ---- Config & AB ----
router.get('/config', requireAdminAuth, (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT id, key, value_json, updated_at, ab_group FROM game_configs ORDER BY key, ab_group').all();
    res.json({ configs: rows });
  } catch (e) {
    res.status(500).json({ error: e.message || '获取配置失败' });
  }
});

router.put('/config', requireAdminAuth, (req, res) => {
  try {
    const { key, value_json, ab_group } = req.body || {};
    if (!key || typeof key !== 'string') return res.status(400).json({ error: '缺少 key' });
    const valStr = value_json != null ? (typeof value_json === 'string' ? value_json : JSON.stringify(value_json)) : 'null';
    try { JSON.parse(valStr); } catch (err) { return res.status(400).json({ error: 'value_json 不是合法 JSON' }); }
    const db = getDb();
    const ab = ab_group != null ? String(ab_group).trim() || null : null;
    if (ab && (ab === 'A' || ab === 'B')) {
      try {
        db.prepare('INSERT INTO game_configs_ab (key, ab_group, value_json, updated_at) VALUES (?, ?, ?, datetime(\'now\')) ON CONFLICT(key, ab_group) DO UPDATE SET value_json = excluded.value_json, updated_at = datetime(\'now\')').run(key, ab, valStr);
      } catch (e) {
        if (!e.message || !e.message.includes('no such table')) throw e;
      }
    } else {
      db.prepare('INSERT INTO game_configs (key, value_json, ab_group) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, ab_group = excluded.ab_group, updated_at = datetime(\'now\')').run(key, valStr, null);
    }
    audit(req.user.id, 'config_put', null, { key, ab_group: ab });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || '保存配置失败' });
  }
});

router.get('/config/versions', requireAdminAuth, (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(
      `SELECT a.id, a.ts, a.action, a.detail_json, u.username AS admin_username
       FROM audit_logs a LEFT JOIN users u ON u.id = a.admin_user_id
       WHERE a.action = 'config_put' ORDER BY a.id DESC LIMIT 100`
    ).all();
    res.json({ versions: rows });
  } catch (e) {
    res.status(500).json({ error: e.message || '获取配置历史失败' });
  }
});

router.post('/ab-groups', requireAdminAuth, (req, res) => {
  try {
    const { userId, groupName, user_id, group_name } = req.body || {};
    const uid = user_id != null ? parseInt(user_id, 10) : parseInt(userId, 10);
    const group = (group_name != null ? group_name : groupName);
    if (isNaN(uid) || !group || typeof group !== 'string') {
      return res.status(400).json({ error: '缺少 userId/user_id 或 groupName/group_name' });
    }
    const db = getDb();
    db.prepare('INSERT INTO ab_groups (user_id, group_name) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET group_name = excluded.group_name').run(uid, String(group).trim());
    audit(req.user.id, 'ab_assign', uid, { group_name: String(group).trim() });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || '分配失败' });
  }
});

// ---- 模拟器 ----
router.post('/simulate', requireAdminAuth, (req, res) => {
  try {
    const { n, strategyMix, seed } = req.body || {};
    const params = {
      n: n != null ? n : 1000,
      strategyMix: strategyMix || { study: 0.25, social: 0.25, mixed: 0.25, random: 0.25 },
      seed: seed != null ? seed : Date.now()
    };
    const result = runSimulation(params);
    saveRun(params, result);
    audit(req.user.id, 'simulate', null, { n: params.n });
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ error: e.message || '模拟失败' });
  }
});

router.get('/simulation-runs', requireAdminAuth, (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const db = getDb();
    const rows = db.prepare('SELECT id, ts, params_json, result_json FROM simulation_runs ORDER BY id DESC LIMIT ?').all(limit);
    res.json({ runs: rows });
  } catch (e) {
    res.status(500).json({ error: e.message || '获取模拟记录失败' });
  }
});

module.exports = router;
