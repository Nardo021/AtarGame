'use strict';

const { getDb } = require('../../core/db');

function getAuditLogs(limit, offset) {
  const rows = getDb().prepare(
    'SELECT a.id, a.admin_user_id, a.ts, a.action, a.target_user_id, a.detail_json, u.username AS admin_username FROM audit_logs a LEFT JOIN users u ON u.id = a.admin_user_id ORDER BY a.id DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);
  const total = getDb().prepare('SELECT COUNT(*) AS c FROM audit_logs').get().c;
  return { rows, total };
}

function getStory() {
  const row = getDb().prepare('SELECT id, active_version_id, story_json, updated_at FROM story_store ORDER BY id DESC LIMIT 1').get();
  const versions = getDb().prepare('SELECT id, ts, admin_user_id, note FROM story_versions ORDER BY id DESC LIMIT 50').all();
  return { row, versions };
}

function saveStoryVersion(adminId, raw, note) {
  const db = getDb();
  const ver = db.prepare("INSERT INTO story_versions (ts, admin_user_id, story_json, note) VALUES (datetime('now'), ?, ?, ?)").run(adminId, raw, note || null);
  const versionId = ver.lastInsertRowid;
  const existing = db.prepare('SELECT id FROM story_store LIMIT 1').get();
  if (existing) {
    db.prepare("UPDATE story_store SET active_version_id = ?, story_json = ?, updated_at = datetime('now') WHERE id = ?").run(versionId, raw, existing.id);
  } else {
    db.prepare("INSERT INTO story_store (active_version_id, story_json, updated_at) VALUES (?, ?, datetime('now'))").run(versionId, raw);
  }
  return versionId;
}

function rollbackStory(versionId) {
  const db = getDb();
  const v = db.prepare('SELECT id, story_json FROM story_versions WHERE id = ?').get(versionId);
  if (!v) return null;
  const existing = db.prepare('SELECT id FROM story_store LIMIT 1').get();
  if (existing) {
    db.prepare("UPDATE story_store SET active_version_id = ?, story_json = ?, updated_at = datetime('now') WHERE id = ?").run(versionId, v.story_json, existing.id);
  } else {
    db.prepare("INSERT INTO story_store (active_version_id, story_json, updated_at) VALUES (?, ?, datetime('now'))").run(versionId, v.story_json);
  }
  return v;
}

function insertEventLog(userId, dateIso, timeBlock, location, eventId, eventType, detail) {
  getDb().prepare('INSERT INTO event_logs (user_id, date_iso, time_block, location, event_id, event_type, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    userId, dateIso, timeBlock, location, eventId, eventType, detail ? JSON.stringify(detail) : null
  );
}

function insertCalendarEvent(userId, dateIso, title, type, detail) {
  getDb().prepare('INSERT INTO calendar_events (user_id, date_iso, title, type, detail_json) VALUES (?, ?, ?, ?, ?)').run(
    userId, dateIso, title, type || 'forced', detail ? JSON.stringify(detail) : null
  );
}

function insertBroadcast(title, body, expiresAt) {
  getDb().prepare('INSERT INTO messages (title, body, expires_at) VALUES (?, ?, ?)').run(title, body || '', expiresAt || null);
}

module.exports = {
  getAuditLogs, getStory, saveStoryVersion, rollbackStory,
  insertEventLog, insertCalendarEvent, insertBroadcast
};
