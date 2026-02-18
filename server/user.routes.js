const express = require('express');
const router = express.Router();
const { getDb } = require('./db');
const { register, login } = require('./auth');
const { requireAuth, optionalAuth } = require('./middleware');

// ---- Auth ----
router.post('/auth/register', (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || typeof username !== 'string' || username.trim().length < 2) {
      return res.status(400).json({ error: '用户名至少 2 个字符' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: '密码至少 6 位' });
    }
    const name = username.trim();
    const user = register(name, password);
    if (!user) return res.status(409).json({ error: '用户名已存在' });
    const token = require('./auth').createToken({ id: user.id, username: user.username, role: user.role });
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000, sameSite: 'lax' });
    res.status(201).json({ user: { id: user.id, username: user.username, role: user.role } });
  } catch (e) {
    res.status(500).json({ error: e.message || '注册失败' });
  }
});

router.post('/auth/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' });
    }
    const result = login(String(username).trim(), password);
    if (!result) return res.status(401).json({ error: '用户名或密码错误' });
    res.cookie('token', result.token, { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000, sameSite: 'lax' });
    res.json({ user: { id: result.id, username: result.username, role: result.role } });
  } catch (e) {
    res.status(500).json({ error: e.message || '登录失败' });
  }
});

router.post('/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ---- Config (按 A/B 组合并：未登录用默认，登录后按 ab_groups 取组内配置) ----
router.get('/config', optionalAuth, (req, res) => {
  try {
    const db = getDb();
    let group = null;
    if (req.user && req.user.id) {
      const row = db.prepare('SELECT group_name FROM ab_groups WHERE user_id = ?').get(req.user.id);
      group = row ? row.group_name : null;
    }
    const defaultRows = db.prepare('SELECT key, value_json FROM game_configs WHERE ab_group IS NULL').all();
    let abRows = [];
    try {
      abRows = db.prepare('SELECT key, value_json FROM game_configs_ab WHERE ab_group = ?').all(group || '');
    } catch (_) {}
    const out = {};
    defaultRows.forEach(r => {
      try { out[r.key] = r.value_json ? JSON.parse(r.value_json) : null; } catch (_) {}
    });
    abRows.forEach(r => {
      try { out[r.key] = r.value_json ? JSON.parse(r.value_json) : null; } catch (_) {}
    });
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message || '获取配置失败' });
  }
});

// ---- Saves ----
router.get('/saves', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT slot, state_json, summary_json, updated_at FROM saves WHERE user_id = ? ORDER BY slot').all(req.user.id);
    res.json({ saves: rows });
  } catch (e) {
    res.status(500).json({ error: e.message || '获取存档列表失败' });
  }
});

router.get('/saves/:slot', requireAuth, (req, res) => {
  try {
    const slot = parseInt(req.params.slot, 10);
    if (isNaN(slot) || slot < 0 || slot > 9) return res.status(400).json({ error: '无效槽位' });
    const db = getDb();
    const row = db.prepare('SELECT state_json, summary_json, updated_at FROM saves WHERE user_id = ? AND slot = ?').get(req.user.id, slot);
    if (!row) return res.status(404).json({ error: '无存档' });
    res.json({
      state: row.state_json ? JSON.parse(row.state_json) : null,
      summary: row.summary_json ? JSON.parse(row.summary_json) : null,
      updated_at: row.updated_at
    });
  } catch (e) {
    res.status(500).json({ error: e.message || '读档失败' });
  }
});

router.post('/saves/:slot', requireAuth, (req, res) => {
  try {
    const slot = parseInt(req.params.slot, 10);
    if (isNaN(slot) || slot < 0 || slot > 9) return res.status(400).json({ error: '无效槽位' });
    const { state_json, summary_json } = req.body || {};
    if (state_json === undefined && summary_json === undefined) return res.status(400).json({ error: '请提供 state_json 或 summary_json' });
    const db = getDb();
    const stateStr = state_json != null ? (typeof state_json === 'string' ? state_json : JSON.stringify(state_json)) : null;
    const summaryStr = summary_json != null ? (typeof summary_json === 'string' ? summary_json : JSON.stringify(summary_json)) : null;
    const existing = db.prepare('SELECT state_json, summary_json FROM saves WHERE user_id = ? AND slot = ?').get(req.user.id, slot);
    const finalState = stateStr != null ? stateStr : (existing && existing.state_json) || null;
    const finalSummary = summaryStr != null ? summaryStr : (existing && existing.summary_json) || null;
    db.prepare(
      `INSERT INTO saves (user_id, slot, state_json, summary_json, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, slot) DO UPDATE SET state_json = excluded.state_json, summary_json = excluded.summary_json, updated_at = datetime('now')`
    ).run(req.user.id, slot, finalState, finalSummary);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || '存档失败' });
  }
});

// ---- Logs ----
router.post('/logs/action', requireAuth, (req, res) => {
  try {
    const { save_slot, date_iso, time_block, location, action_type, node_id, choice_id, delta_json, state_before_json, state_after_json } = req.body || {};
    if (!date_iso || !time_block || !location || !action_type) {
      return res.status(400).json({ error: '缺少 date_iso / time_block / location / action_type' });
    }
    const db = getDb();
    const slot = save_slot != null ? parseInt(save_slot, 10) : 0;
    db.prepare(
      `INSERT INTO action_logs (user_id, save_slot, date_iso, time_block, location, action_type, node_id, choice_id, delta_json, state_before_json, state_after_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.user.id,
      isNaN(slot) ? 0 : slot,
      date_iso,
      time_block,
      location,
      action_type,
      node_id || null,
      choice_id || null,
      delta_json != null ? (typeof delta_json === 'string' ? delta_json : JSON.stringify(delta_json)) : null,
      state_before_json != null ? (typeof state_before_json === 'string' ? state_before_json : JSON.stringify(state_before_json)) : null,
      state_after_json != null ? (typeof state_after_json === 'string' ? state_after_json : JSON.stringify(state_after_json)) : null
    );
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || '写入行动日志失败' });
  }
});

router.post('/logs/event', requireAuth, (req, res) => {
  try {
    const { date_iso, time_block, location, event_id, event_type, detail_json } = req.body || {};
    if (!date_iso || !time_block || !location || !event_id || !event_type) {
      return res.status(400).json({ error: '缺少 date_iso / time_block / location / event_id / event_type' });
    }
    const db = getDb();
    db.prepare(
      `INSERT INTO event_logs (user_id, date_iso, time_block, location, event_id, event_type, detail_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.user.id,
      date_iso,
      time_block,
      location,
      event_id,
      event_type,
      detail_json != null ? (typeof detail_json === 'string' ? detail_json : JSON.stringify(detail_json)) : null
    );
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || '写入事件日志失败' });
  }
});

// ---- Messages (broadcast) ----
router.get('/messages', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(
      `SELECT id, title, body, created_at, expires_at FROM messages
       WHERE expires_at IS NULL OR datetime(expires_at) > datetime('now')
       ORDER BY id DESC LIMIT 20`
    ).all();
    res.json({ messages: rows });
  } catch (e) {
    res.status(500).json({ error: e.message || '获取消息失败' });
  }
});

// ---- Board (分页、关键词过滤) ----
const BOARD_BLOCK_WORDS = ['违禁', '广告', 'spam']; // 基础关键词过滤：含这些词不展示
function filterBlockWords(content) {
  if (!content || typeof content !== 'string') return true;
  const lower = content.toLowerCase();
  return !BOARD_BLOCK_WORDS.some(w => lower.includes(w.toLowerCase()));
}

router.get('/board', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 20), 100);
    const offset = (page - 1) * limit;
    const keyword = (req.query.keyword || '').trim();
    const db = getDb();
    let where = ' WHERE p.is_deleted = 0 ';
    const params = [];
    if (keyword) {
      where += ' AND (p.content LIKE ? OR u.username LIKE ?) ';
      params.push('%' + keyword + '%', '%' + keyword + '%');
    }
    const countRow = db.prepare(
      'SELECT COUNT(*) AS c FROM board_posts p JOIN users u ON u.id = p.user_id' + where
    ).get(...params);
    params.push(limit, offset);
    const rows = db.prepare(
      `SELECT p.id, p.user_id, p.content, p.created_at, u.username
       FROM board_posts p JOIN users u ON u.id = p.user_id
       ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
    ).all(...params);
    const posts = rows.filter(r => filterBlockWords(r.content));
    res.json({ posts, total: countRow.c, page, limit });
  } catch (e) {
    res.status(500).json({ error: e.message || '获取留言失败' });
  }
});

router.post('/board', requireAuth, (req, res) => {
  try {
    const content = (req.body && req.body.content) != null ? String(req.body.content).trim() : '';
    if (!content || content.length > 5000) return res.status(400).json({ error: '内容无效或过长' });
    if (!filterBlockWords(content)) return res.status(400).json({ error: '内容含敏感词' });
    const db = getDb();
    db.prepare('INSERT INTO board_posts (user_id, content) VALUES (?, ?)').run(req.user.id, content);
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || '发帖失败' });
  }
});

// ---- Calendar (events + day replay) ----
router.get('/calendar', requireAuth, (req, res) => {
  try {
    const month = (req.query.month || '').trim();
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: '请提供 month 参数，如 2026-01' });
    const db = getDb();
    const rows = db.prepare(
      `SELECT date_iso, title, type AS event_type, detail_json FROM calendar_events
       WHERE (user_id IS NULL OR user_id = ?) AND date_iso LIKE ? ORDER BY date_iso`
    ).all(req.user.id, month + '%');
    res.json({ events: rows });
  } catch (e) {
    res.status(500).json({ error: e.message || '获取日历失败' });
  }
});

router.get('/calendar/day', requireAuth, (req, res) => {
  try {
    const date = (req.query.date || req.query.date_iso || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: '请提供 date 参数，如 2026-01-15' });
    const db = getDb();
    const actions = db.prepare(
      `SELECT id, date_iso, time_block, location, action_type, node_id, choice_id, delta_json, state_after_json
       FROM action_logs WHERE user_id = ? AND date_iso = ? ORDER BY id`
    ).all(req.user.id, date);
    const events = db.prepare(
      `SELECT id, date_iso, time_block, location, event_id, event_type, detail_json
       FROM event_logs WHERE user_id = ? AND date_iso = ? ORDER BY id`
    ).all(req.user.id, date);
    res.json({ actions, events });
  } catch (e) {
    res.status(500).json({ error: e.message || '获取当日记录失败' });
  }
});

// ---- Diary ----
router.get('/diary', requireAuth, (req, res) => {
  try {
    const from = (req.query.from || '').trim();
    const to = (req.query.to || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ error: '请提供 from 与 to 参数，如 2026-01-01 与 2026-01-31' });
    }
    const db = getDb();
    const rows = db.prepare(
      `SELECT date_iso, content FROM diary_entries WHERE user_id = ? AND date_iso >= ? AND date_iso <= ? ORDER BY date_iso`
    ).all(req.user.id, from, to);
    res.json({ entries: rows });
  } catch (e) {
    res.status(500).json({ error: e.message || '获取日记失败' });
  }
});

router.post('/diary', requireAuth, (req, res) => {
  try {
    const { date_iso, content } = req.body || {};
    if (!date_iso || !/^\d{4}-\d{2}-\d{2}$/.test(String(date_iso).trim())) return res.status(400).json({ error: '请提供有效 date_iso' });
    if (content == null || typeof content !== 'string') return res.status(400).json({ error: '请提供 content' });
    const db = getDb();
    const date = String(date_iso).trim();
    const existing = db.prepare('SELECT id FROM diary_entries WHERE user_id = ? AND date_iso = ?').get(req.user.id, date);
    if (existing) {
      db.prepare('UPDATE diary_entries SET content = ?, created_at = datetime(\'now\') WHERE user_id = ? AND date_iso = ?').run(content, req.user.id, date);
    } else {
      db.prepare('INSERT INTO diary_entries (user_id, date_iso, content) VALUES (?, ?, ?)').run(req.user.id, date, content);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || '保存日记失败' });
  }
});

// ---- Leaderboard (mode: best_ever | latest | last_day) ----
function getAtarFromSummary(summaryJson) {
  if (!summaryJson) return null;
  try {
    const s = JSON.parse(summaryJson);
    return s.atar != null ? s.atar : (s.stats && s.stats.atar);
  } catch (_) { return null; }
}

router.get('/leaderboard', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const mode = (req.query.mode || 'best_ever').trim();
    const db = getDb();
    const rows = db.prepare('SELECT user_id, slot, summary_json, updated_at FROM saves').all();
    const byUser = {};
    for (const r of rows) {
      const atar = getAtarFromSummary(r.summary_json);
      if (atar == null) continue;
      let dateIso = null;
      try {
        const s = r.summary_json ? JSON.parse(r.summary_json) : {};
        dateIso = s.date || null;
      } catch (_) {}
      const uid = r.user_id;
      const rec = { atar, updated_at: r.updated_at, date: dateIso };
      if (!byUser[uid]) {
        const u = db.prepare('SELECT username FROM users WHERE id = ?').get(uid);
        byUser[uid] = { user_id: uid, username: (u && u.username) || '?', best_ever: atar, latest_atar: atar, latest_at: r.updated_at, date: dateIso, perDate: {} };
      }
      const u = byUser[uid];
      if (atar > (u.best_ever || 0)) u.best_ever = atar;
      if (r.updated_at > (u.latest_at || '')) {
        u.latest_atar = atar;
        u.latest_at = r.updated_at;
        u.date = dateIso;
      }
      if (dateIso) u.perDate[dateIso] = Math.max(u.perDate[dateIso] || 0, atar);
    }
    let list = Object.values(byUser);
    if (mode === 'best_ever') list = list.sort((a, b) => (b.best_ever || 0) - (a.best_ever || 0));
    else if (mode === 'latest') list = list.sort((a, b) => (b.latest_at || '').localeCompare(a.latest_at || ''));
    else if (mode === 'last_day') {
      const lastDate = list.reduce((acc, u) => {
        const d = u.date;
        return d && (!acc || d > acc) ? d : acc;
      }, null);
      list = list
        .filter(u => lastDate && u.perDate[lastDate] != null)
        .map(u => ({ ...u, atar: u.perDate[lastDate] }))
        .sort((a, b) => (b.atar || 0) - (a.atar || 0));
    } else {
      list = list.sort((a, b) => (b.best_ever || 0) - (a.best_ever || 0));
    }
    const out = list.slice(0, limit).map(u => ({
      user_id: u.user_id,
      username: u.username,
      atar: mode === 'best_ever' ? u.best_ever : mode === 'latest' ? u.latest_atar : u.atar,
      date: u.date,
      updated_at: u.latest_at
    }));
    res.json({ leaderboard: out });
  } catch (e) {
    res.status(500).json({ error: e.message || '获取排行榜失败' });
  }
});

module.exports = router;
