-- 邀请码（注册必须）
CREATE TABLE IF NOT EXISTS invite_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 用户
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 存档 (user_id + slot 唯一)
CREATE TABLE IF NOT EXISTS saves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  slot INTEGER NOT NULL,
  state_json TEXT,
  summary_json TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, slot)
);

-- 行动日志
CREATE TABLE IF NOT EXISTS action_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  save_slot INTEGER NOT NULL,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  date_iso TEXT NOT NULL,
  time_block TEXT NOT NULL,
  location TEXT NOT NULL,
  action_type TEXT NOT NULL,
  node_id TEXT,
  choice_id TEXT,
  delta_json TEXT,
  state_before_json TEXT,
  state_after_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_action_logs_user_ts ON action_logs(user_id, ts);
CREATE INDEX IF NOT EXISTS idx_action_logs_ts ON action_logs(ts);

-- 事件日志
CREATE TABLE IF NOT EXISTS event_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  date_iso TEXT NOT NULL,
  time_block TEXT NOT NULL,
  location TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  detail_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_event_logs_user_ts ON event_logs(user_id, ts);
CREATE INDEX IF NOT EXISTS idx_event_logs_ts ON event_logs(ts);

-- 全局广播消息
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);

-- 剧情热更新存储
CREATE TABLE IF NOT EXISTS story_store (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  active_version_id INTEGER,
  story_json TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 剧情版本
CREATE TABLE IF NOT EXISTS story_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  admin_user_id INTEGER,
  story_json TEXT NOT NULL,
  note TEXT
);

-- A/B 分组
CREATE TABLE IF NOT EXISTS ab_groups (
  user_id INTEGER NOT NULL PRIMARY KEY,
  group_name TEXT NOT NULL
);

-- 游戏配置（可带 ab_group）
CREATE TABLE IF NOT EXISTS game_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')),
  ab_group TEXT
);

-- 审计日志
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER NOT NULL,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  action TEXT NOT NULL,
  target_user_id INTEGER,
  detail_json TEXT
);

-- 留言板
CREATE TABLE IF NOT EXISTS board_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_board_posts_created ON board_posts(created_at);

-- 存档备份（回档用）
CREATE TABLE IF NOT EXISTS save_backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  slot INTEGER NOT NULL,
  state_json TEXT NOT NULL,
  backup_ts TEXT NOT NULL DEFAULT (datetime('now')),
  reason TEXT
);

-- 日记（每日总结，由前端在跨天时写入或按需生成）
CREATE TABLE IF NOT EXISTS diary_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  date_iso TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, date_iso)
);
CREATE INDEX IF NOT EXISTS idx_diary_user_date ON diary_entries(user_id, date_iso);

-- 日历事件（全局 user_id=null 或个人 user_id 非空）
CREATE TABLE IF NOT EXISTS calendar_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  date_iso TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  detail_json TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_calendar_date ON calendar_events(date_iso);
CREATE INDEX IF NOT EXISTS idx_calendar_user ON calendar_events(user_id);
