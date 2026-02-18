const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { init, getDb } = require('./db');
const { ensureAdmin } = require('./auth');
const { apiLimiter, authLimiter, adminLimiter } = require('./rateLimit');
const userRoutes = require('./user.routes');
const adminRoutes = require('./admin.routes');
const metricsRoutes = require('./metrics.routes');
const storyStore = require('./storyStore');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api', userRoutes);

// 游戏状态推进与日志写入（需登录）
app.post('/api/game/action', apiLimiter, require('./middleware').authMiddleware, (req, res) => {
  const { action, stateBefore, stateAfter, saveSlot, date_iso, time_block, location, action_type, node_id, choice_id, delta } = req.body || {};
  if (!stateAfter) return res.status(400).json({ error: '缺少 stateAfter' });
  const db = getDb();
  db.prepare(
    `INSERT INTO action_logs (user_id, save_slot, date_iso, time_block, location, action_type, node_id, choice_id, delta_json, state_before_json, state_after_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    req.user.id,
    saveSlot != null ? saveSlot : 0,
    date_iso || stateAfter.date_iso || new Date().toISOString().slice(0, 10),
    time_block || stateAfter.time_block || 'Morning',
    location || stateAfter.location || 'school',
    action_type || 'choice',
    node_id || null,
    choice_id || null,
    delta ? JSON.stringify(delta) : null,
    stateBefore ? JSON.stringify(stateBefore) : null,
    JSON.stringify(stateAfter)
  );
  res.json({ ok: true, state: stateAfter });
});

// 获取待触发的强制事件（用户轮询）
app.get('/api/game/pending-events', apiLimiter, require('./middleware').authMiddleware, (req, res) => {
  const db = getDb();
  const rows = db.prepare(
    `SELECT id, event_id, event_type, detail_json, ts FROM event_logs
     WHERE user_id = ? AND event_type = 'forced' ORDER BY id DESC LIMIT 5`
  ).all(req.user.id);
  res.json({ events: rows });
});

// 写入事件日志（Scheduler 触发的考试/强制/随机事件）
app.post('/api/game/event', apiLimiter, require('./middleware').authMiddleware, (req, res) => {
  const { event_id, event_type, detail, date_iso, time_block, location } = req.body || {};
  if (!event_id || !event_type) return res.status(400).json({ error: '缺少 event_id 或 event_type' });
  const db = getDb();
  const state = req.body.state || {};
  const d = date_iso || state.date_iso || new Date().toISOString().slice(0, 10);
  const t = time_block || state.time_block || 'Morning';
  const loc = location || state.location || 'school';
  db.prepare(
    'INSERT INTO event_logs (user_id, date_iso, time_block, location, event_id, event_type, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, d, t, loc, event_id, event_type, detail ? JSON.stringify(detail) : null);
  res.json({ ok: true });
});

// 标记事件已处理（可选：前端弹过后调一次）
app.post('/api/game/event-seen/:eventId', apiLimiter, require('./middleware').authMiddleware, (req, res) => {
  res.json({ ok: true });
});

// 当前剧情（热更新）
app.get('/api/story', (req, res) => {
  const story = storyStore.getActiveStory();
  res.json({ story });
});

// 全局广播消息（未过期）
app.get('/api/messages', (req, res) => {
  const db = getDb();
  const rows = db.prepare(
    `SELECT id, title, body, created_at, expires_at FROM messages
     WHERE expires_at IS NULL OR datetime(expires_at) > datetime('now') ORDER BY id DESC LIMIT 10`
  ).all();
  res.json({ messages: rows });
});

// Admin API
app.use('/api/admin', require('./middleware').authMiddleware, require('./middleware').adminOnly, adminLimiter, adminRoutes);
app.use('/api/admin/metrics', require('./middleware').authMiddleware, require('./middleware').adminOnly, adminLimiter, metricsRoutes);

// 静态
app.use(express.static(path.join(__dirname, '..', 'client')));
app.use('/admin', express.static(path.join(__dirname, '..', 'client', 'admin')));

function seedCalendarEvents() {
  const db = getDb();
  const events = [
    { date_iso: '2026-04-15', title: '期中考试', type: 'exam', detail: {} },
    { date_iso: '2026-07-01', title: '期末考试', type: 'exam', detail: {} },
    { date_iso: '2026-10-10', title: '月考', type: 'exam', detail: {} },
    { date_iso: '2026-12-20', title: '期末模拟', type: 'exam', detail: {} }
  ];
  events.forEach(({ date_iso, title, type, detail }) => {
    const exists = db.prepare('SELECT 1 FROM calendar_events WHERE user_id IS NULL AND date_iso = ? AND title = ?').get(date_iso, title);
    if (!exists) {
      db.prepare('INSERT INTO calendar_events (user_id, date_iso, title, type, detail_json) VALUES (NULL, ?, ?, ?, ?)').run(date_iso, title, type, JSON.stringify(detail));
    }
  });
}

init()
  .then(() => {
    ensureAdmin();
    seedCalendarEvents();
    app.listen(PORT, () => {
      console.log('Atar 游戏服务运行于 http://localhost:' + PORT);
      console.log('管理后台 http://localhost:' + PORT + '/admin/');
    });
  })
  .catch((err) => {
    console.error('数据库初始化失败:', err);
    process.exit(1);
  });
