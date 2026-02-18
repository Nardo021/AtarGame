-- users
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  is_disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- saves
CREATE TABLE IF NOT EXISTS saves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  slot INTEGER NOT NULL,
  state_json TEXT,
  summary_json TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, slot)
);

-- action_logs
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

-- event_logs
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

-- audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER NOT NULL,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  action TEXT NOT NULL,
  target_user_id INTEGER,
  detail_json TEXT
);

-- messages
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);

-- ab_groups
CREATE TABLE IF NOT EXISTS ab_groups (
  user_id INTEGER NOT NULL PRIMARY KEY,
  group_name TEXT NOT NULL
);

-- game_configs
CREATE TABLE IF NOT EXISTS game_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')),
  ab_group TEXT
);

-- story_store
CREATE TABLE IF NOT EXISTS story_store (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  active_version_id INTEGER,
  story_json TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- story_versions
CREATE TABLE IF NOT EXISTS story_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  admin_user_id INTEGER,
  story_json TEXT NOT NULL,
  note TEXT
);

-- board_posts
CREATE TABLE IF NOT EXISTS board_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_board_posts_created ON board_posts(created_at);

-- diary_entries
CREATE TABLE IF NOT EXISTS diary_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  date_iso TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_diary_user_date ON diary_entries(user_id, date_iso);

-- calendar_events
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

-- user_freeze (冻结/解冻，单独表避免改 users 结构)
CREATE TABLE IF NOT EXISTS user_freeze (
  user_id INTEGER NOT NULL PRIMARY KEY REFERENCES users(id),
  frozen INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- simulation_runs (模拟器结果)
CREATE TABLE IF NOT EXISTS simulation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  params_json TEXT NOT NULL,
  result_json TEXT NOT NULL
);

-- game_configs_ab: 按 A/B 组区分的配置（同 key 不同 ab_group）
CREATE TABLE IF NOT EXISTS game_configs_ab (
  key TEXT NOT NULL,
  ab_group TEXT NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(key, ab_group)
);
