'use strict';

const { init, getDb } = require('../core/db');

const MIGRATIONS = [
  { id: 1, desc: 'saves.meta_json', up: 'ALTER TABLE saves ADD COLUMN meta_json TEXT' },
  { id: 2, desc: 'audit_logs.ip', up: 'ALTER TABLE audit_logs ADD COLUMN ip TEXT' },
  { id: 3, desc: 'audit_logs.ua', up: 'ALTER TABLE audit_logs ADD COLUMN ua TEXT' },
  { id: 4, desc: 'game_configs.version', up: 'ALTER TABLE game_configs ADD COLUMN version INTEGER DEFAULT 1' },
  { id: 5, desc: 'game_configs.published_at', up: 'ALTER TABLE game_configs ADD COLUMN published_at TEXT' },
  { id: 6, desc: 'idx_board_user_active', up: 'CREATE INDEX IF NOT EXISTS idx_board_user_active ON board_posts(user_id, is_deleted, created_at)' },
  { id: 7, desc: 'idx_saves_user_updated', up: 'CREATE INDEX IF NOT EXISTS idx_saves_user_updated ON saves(user_id, updated_at)' },
  { id: 8, desc: 'idx_calendar_user_date', up: 'CREATE INDEX IF NOT EXISTS idx_calendar_user_date ON calendar_events(user_id, date_iso)' },
  { id: 9, desc: 'idx_audit_action', up: 'CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, ts)' },
];

function ensureMigrationsTable(db) {
  try {
    db.prepare('SELECT 1 FROM _migrations LIMIT 1').get();
  } catch (_) {
    try {
      db.prepare('CREATE TABLE _migrations (id INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime(\'now\')))').run();
    } catch (_e) {}
  }
}

function getApplied(db) {
  try {
    return db.prepare('SELECT id FROM _migrations ORDER BY id').all().map(r => r.id);
  } catch (_) { return []; }
}

async function run() {
  await init();
  const db = getDb();
  ensureMigrationsTable(db);
  const applied = getApplied(db);
  let count = 0;
  for (const m of MIGRATIONS) {
    if (applied.includes(m.id)) continue;
    try {
      db.prepare(m.up).run();
      db.prepare('INSERT INTO _migrations (id) VALUES (?)').run(m.id);
      console.log(`  [OK] #${m.id}: ${m.desc}`);
      count++;
    } catch (e) {
      if (e.message && (e.message.includes('duplicate column') || e.message.includes('already exists'))) {
        db.prepare('INSERT INTO _migrations (id) VALUES (?)').run(m.id);
        console.log(`  [SKIP] #${m.id}: ${m.desc} (already applied)`);
      } else {
        console.error(`  [FAIL] #${m.id}: ${m.desc} - ${e.message}`);
      }
    }
  }
  console.log(count > 0 ? `Migration complete: ${count} applied.` : 'No new migrations.');
}

run().catch(e => { console.error('Migration failed:', e); process.exit(1); });
