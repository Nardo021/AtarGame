const express = require('express');
const router = express.Router();
const { getDb } = require('./db');
const { authMiddleware, adminOnly } = require('./middleware');
const { log: auditLog } = require('./audit');
const storyStore = require('./storyStore');

router.use(authMiddleware);
router.use(adminOnly);

// 实时在线：最近 X 分钟有 action_logs 的用户
router.get('/online', (req, res) => {
  const minutes = Math.min(parseInt(req.query.minutes, 10) || 15, 60);
  const db = getDb();
  const sql = `SELECT DISTINCT a.user_id, u.username, max(a.ts) as last_ts
    FROM action_logs a
    JOIN users u ON u.id = a.user_id
    WHERE datetime(a.ts) >= datetime('now', ?)
    GROUP BY a.user_id`;
  const list = db.prepare(sql).all('-' + minutes + ' minutes');
  res.json({ online: list });
});

// 实时数值：指定用户最新 state
router.get('/user-state/:userId', (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const db = getDb();
  const row = db.prepare('SELECT state_json, slot, updated_at FROM saves WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1').get(userId);
  const user = db.prepare('SELECT id, username, role, is_disabled FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  let state = null;
  if (row) try { state = JSON.parse(row.state_json); } catch (e) {}
  res.json({ user, latestSave: row, state });
});

// 强制事件推送：插入 event_logs，客户端下一步动作前弹出
router.post('/force-event', (req, res) => {
  const { userId, eventId, eventType, detail } = req.body || {};
  if (!userId || !eventId) return res.status(400).json({ error: '缺少 userId 或 eventId' });
  const db = getDb();
  const save = db.prepare('SELECT state_json FROM saves WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1').get(userId);
  let date_iso = new Date().toISOString().slice(0, 10);
  let time_block = 'Morning';
  let location = 'school';
  if (save && save.state_json) {
    try {
      const st = JSON.parse(save.state_json);
      date_iso = st.date_iso || date_iso;
      time_block = st.time_block || time_block;
      location = st.location || location;
    } catch (e) {}
  }
  db.prepare(
    'INSERT INTO event_logs (user_id, date_iso, time_block, location, event_id, event_type, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, date_iso, time_block, location, eventId, eventType || 'forced', detail ? JSON.stringify(detail) : null);
  auditLog(req.user.id, 'force_event', userId, { eventId, eventType, detail });
  res.json({ ok: true });
});

// 全局广播
router.post('/broadcast', (req, res) => {
  const { title, body, expires_at } = req.body || {};
  if (!title) return res.status(400).json({ error: '缺少 title' });
  const db = getDb();
  db.prepare('INSERT INTO messages (title, body, expires_at) VALUES (?, ?, ?)').run(title, body || '', expires_at || null);
  auditLog(req.user.id, 'broadcast', null, { title });
  res.json({ ok: true });
});

// 冻结玩家：is_disabled = 1
router.post('/freeze-user/:userId', (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const db = getDb();
  db.prepare('UPDATE users SET is_disabled = 1 WHERE id = ?').run(userId);
  auditLog(req.user.id, 'freeze_user', userId, {});
  res.json({ ok: true });
});

router.post('/unfreeze-user/:userId', (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const db = getDb();
  db.prepare('UPDATE users SET is_disabled = 0 WHERE id = ?').run(userId);
  auditLog(req.user.id, 'unfreeze_user', userId, {});
  res.json({ ok: true });
});

// 剧情热更新
router.get('/story', (req, res) => {
  const story = storyStore.getActiveStory();
  res.json({ story });
});

router.put('/story', (req, res) => {
  const { story, note } = req.body || {};
  if (!story) return res.status(400).json({ error: '缺少 story' });
  const verId = storyStore.setStory(req.user.id, story, note);
  auditLog(req.user.id, 'story_update', null, { versionId: verId });
  res.json({ ok: true, versionId: verId });
});

router.get('/story/versions', (req, res) => {
  const list = storyStore.listVersions();
  res.json({ versions: list });
});

router.post('/story/rollback/:versionId', (req, res) => {
  const versionId = parseInt(req.params.versionId, 10);
  const verId = storyStore.rollbackToVersion(req.user.id, versionId);
  if (!verId) return res.status(404).json({ error: '版本不存在' });
  auditLog(req.user.id, 'story_rollback', null, { versionId });
  res.json({ ok: true });
});

// 一键回档：将某用户某 slot 回滚到某备份
router.get('/saves/backups/:userId/:slot', (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  const slot = parseInt(req.params.slot, 10);
  const db = getDb();
  const rows = db.prepare('SELECT id, backup_ts, reason FROM save_backups WHERE user_id = ? AND slot = ? ORDER BY id DESC LIMIT 20').all(userId, slot);
  res.json({ backups: rows });
});

router.post('/saves/rollback', (req, res) => {
  const { userId, slot, backupId } = req.body || {};
  if (userId == null || slot == null || backupId == null) return res.status(400).json({ error: '缺少参数' });
  const db = getDb();
  const backup = db.prepare('SELECT state_json FROM save_backups WHERE id = ? AND user_id = ? AND slot = ?').get(backupId, userId, slot);
  if (!backup) return res.status(404).json({ error: '备份不存在' });
  const current = db.prepare('SELECT id, state_json FROM saves WHERE user_id = ? AND slot = ?').get(userId, slot);
  if (current) {
    db.prepare('INSERT INTO save_backups (user_id, slot, state_json, reason) VALUES (?, ?, ?, ?)').run(userId, slot, current.state_json, '回档前自动备份');
  }
  db.prepare('INSERT INTO saves (user_id, slot, state_json, summary_json, updated_at) VALUES (?, ?, ?, NULL, datetime(\'now\')) ON CONFLICT(user_id, slot) DO UPDATE SET state_json=excluded.state_json, updated_at=datetime(\'now\')').run(userId, slot, backup.state_json);
  auditLog(req.user.id, 'save_rollback', userId, { slot, backupId });
  res.json({ ok: true });
});

// A/B 组
router.get('/ab-groups', (req, res) => {
  const db = getDb();
  const list = db.prepare('SELECT * FROM ab_groups').all();
  res.json({ groups: list });
});

router.post('/ab-groups', (req, res) => {
  const { userId, groupName } = req.body || {};
  if (!userId || !groupName) return res.status(400).json({ error: '缺少 userId 或 groupName' });
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO ab_groups (user_id, group_name) VALUES (?, ?)').run(userId, groupName);
  res.json({ ok: true });
});

// 全局配置
router.get('/configs', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM game_configs').all();
  res.json({ configs: rows });
});

router.put('/configs/:key', (req, res) => {
  const key = req.params.key;
  const { value_json, ab_group } = req.body || {};
  const db = getDb();
  db.prepare('INSERT INTO game_configs (key, value_json, updated_at, ab_group) VALUES (?, ?, datetime(\'now\'), ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=datetime(\'now\'), ab_group=excluded.ab_group').run(key, typeof value_json === 'string' ? value_json : JSON.stringify(value_json || {}), ab_group || null);
  res.json({ ok: true });
});

// 留言板：删帖
router.delete('/board/:postId', (req, res) => {
  const postId = parseInt(req.params.postId, 10);
  const db = getDb();
  db.prepare('UPDATE board_posts SET is_deleted = 1 WHERE id = ?').run(postId);
  auditLog(req.user.id, 'board_delete', null, { postId });
  res.json({ ok: true });
});

// 排行榜配置（存 game_configs）
router.get('/leaderboard-config', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT value_json FROM game_configs WHERE key = ?').get('leaderboard_mode');
  res.json({ mode: row ? (JSON.parse(row.value_json).mode || 'best_ever') : 'best_ever' });
});

router.put('/leaderboard-config', (req, res) => {
  const { mode } = req.body || {};
  const db = getDb();
  db.prepare('INSERT INTO game_configs (key, value_json, updated_at) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=datetime(\'now\')').run('leaderboard_mode', JSON.stringify({ mode: mode || 'best_ever' }));
  res.json({ ok: true });
});

// 邀请码管理
router.get('/invite-codes', (req, res) => {
  const db = getDb();
  const list = db.prepare('SELECT id, code, max_uses, used_count, note, created_at FROM invite_codes ORDER BY id DESC').all();
  res.json({ inviteCodes: list });
});

router.post('/invite-codes', (req, res) => {
  const { code, max_uses, note } = req.body || {};
  const codeStr = (code && String(code).trim()) || '';
  if (!codeStr) return res.status(400).json({ error: '邀请码不能为空' });
  const db = getDb();
  const maxUses = parseInt(max_uses, 10);
  if (isNaN(maxUses) || maxUses < 0) return res.status(400).json({ error: '使用次数须为 0（不限）或正整数' });
  try {
    db.prepare('INSERT INTO invite_codes (code, max_uses, note) VALUES (?, ?, ?)').run(codeStr, maxUses, (note && String(note).trim()) || null);
    const row = db.prepare('SELECT id, code, max_uses, used_count, note, created_at FROM invite_codes WHERE code = ?').get(codeStr);
    auditLog(req.user.id, 'invite_code_create', null, { code: codeStr, max_uses: maxUses });
    res.json({ ok: true, inviteCode: row });
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(400).json({ error: '该邀请码已存在' });
    throw e;
  }
});

router.put('/invite-codes/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { max_uses, note } = req.body || {};
  const db = getDb();
  const row = db.prepare('SELECT id, used_count FROM invite_codes WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: '邀请码不存在' });
  const maxUses = max_uses !== undefined ? parseInt(max_uses, 10) : null;
  if (maxUses !== null && (isNaN(maxUses) || maxUses < 0)) return res.status(400).json({ error: '使用次数须为 0（不限）或正整数' });
  if (maxUses !== null && maxUses < row.used_count) return res.status(400).json({ error: '最大使用次数不能小于已使用次数' });
  if (maxUses !== null) db.prepare('UPDATE invite_codes SET max_uses = ? WHERE id = ?').run(maxUses, id);
  if (note !== undefined) db.prepare('UPDATE invite_codes SET note = ? WHERE id = ?').run((note && String(note).trim()) || null, id);
  auditLog(req.user.id, 'invite_code_update', null, { id, max_uses: maxUses, note });
  res.json({ ok: true });
});

router.delete('/invite-codes/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const db = getDb();
  const row = db.prepare('SELECT code FROM invite_codes WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: '邀请码不存在' });
  db.prepare('DELETE FROM invite_codes WHERE id = ?').run(id);
  auditLog(req.user.id, 'invite_code_delete', null, { id, code: row.code });
  res.json({ ok: true });
});

// 用户列表（含统计信息）
router.get('/users', (req, res) => {
  const db = getDb();
  const list = db.prepare('SELECT id, username, role, is_disabled, created_at FROM users ORDER BY id').all();
  const usersWithStats = list.map((u) => {
    const savesCount = db.prepare('SELECT count(*) as c FROM saves WHERE user_id = ?').get(u.id);
    const lastSave = db.prepare('SELECT updated_at FROM saves WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1').get(u.id);
    const lastAction = db.prepare('SELECT ts FROM action_logs WHERE user_id = ? ORDER BY ts DESC LIMIT 1').get(u.id);
    const actionCount = db.prepare('SELECT count(*) as c FROM action_logs WHERE user_id = ?').get(u.id);
    return {
      ...u,
      saves_count: savesCount ? savesCount.c : 0,
      last_save_at: lastSave ? lastSave.updated_at : null,
      last_action_at: lastAction ? lastAction.ts : null,
      action_count: actionCount ? actionCount.c : 0
    };
  });
  res.json({ users: usersWithStats });
});

// 单个用户详情（含最新存档摘要、最近行动）
router.get('/users/:id', (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const db = getDb();
  const user = db.prepare('SELECT id, username, role, is_disabled, created_at FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  const saves = db.prepare('SELECT slot, state_json, summary_json, updated_at FROM saves WHERE user_id = ? ORDER BY slot').all(userId);
  const lastActions = db.prepare('SELECT id, date_iso, time_block, location, action_type, ts FROM action_logs WHERE user_id = ? ORDER BY ts DESC LIMIT 50').all(userId);
  const latestState = saves.length ? (saves.reduce((a, s) => (s.updated_at > (a.updated_at || '')) ? s : a, saves[0])) : null;
  let statePreview = null;
  if (latestState && latestState.state_json) {
    try {
      const st = JSON.parse(latestState.state_json);
      statePreview = { date_iso: st.date_iso, time_block: st.time_block, location: st.location, atar: st.atar, mood: st.mood, health: st.health, stress: st.stress, reputation: st.reputation };
    } catch (e) {}
  }
  res.json({
    user,
    saves_count: saves.length,
    saves: saves.map((s) => ({ slot: s.slot, updated_at: s.updated_at, summary: s.summary_json ? JSON.parse(s.summary_json) : null })),
    latest_state: statePreview,
    last_actions: lastActions,
    action_count: db.prepare('SELECT count(*) as c FROM action_logs WHERE user_id = ?').get(userId).c
  });
});

// 审计日志
router.get('/audit-logs', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const db = getDb();
  const rows = db.prepare('SELECT a.*, u.username as admin_name FROM audit_logs a LEFT JOIN users u ON u.id = a.admin_user_id ORDER BY a.id DESC LIMIT ?').all(limit);
  res.json({ logs: rows });
});

module.exports = router;
