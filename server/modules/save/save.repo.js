'use strict';

const { getDb } = require('../../core/db');

function listByUser(userId) {
  return getDb().prepare('SELECT slot, state_json, summary_json, updated_at FROM saves WHERE user_id = ? ORDER BY slot').all(userId);
}

function getBySlot(userId, slot) {
  return getDb().prepare('SELECT state_json, summary_json, updated_at FROM saves WHERE user_id = ? AND slot = ?').get(userId, slot);
}

function upsert(userId, slot, stateStr, summaryStr) {
  getDb().prepare(
    `INSERT INTO saves (user_id, slot, state_json, summary_json, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, slot) DO UPDATE SET state_json = excluded.state_json, summary_json = excluded.summary_json, updated_at = datetime('now')`
  ).run(userId, slot, stateStr, summaryStr);
}

function getAll() {
  return getDb().prepare('SELECT user_id, slot, summary_json, updated_at FROM saves').all();
}

function updateMeta(userId, slot, metaStr) {
  getDb().prepare('UPDATE saves SET meta_json = ? WHERE user_id = ? AND slot = ?').run(metaStr, userId, slot);
}

module.exports = { listByUser, getBySlot, upsert, getAll, updateMeta };
