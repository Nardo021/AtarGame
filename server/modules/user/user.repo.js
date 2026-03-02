'use strict';

const { getDb } = require('../../core/db');

function findByUsername(username) {
  return getDb().prepare('SELECT id, username, password_hash, role, is_disabled FROM users WHERE username = ?').get(username);
}

function findById(id) {
  return getDb().prepare('SELECT id, username, role, is_disabled, created_at FROM users WHERE id = ?').get(id);
}

function create(username, passwordHash, role) {
  return getDb().prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, passwordHash, role || 'user');
}

function updatePassword(id, passwordHash) {
  getDb().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
}

function updateFields(id, updates, params) {
  getDb().prepare('UPDATE users SET ' + updates.join(', ') + ' WHERE id = ?').run(...params, id);
}

function deleteById(id) {
  getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
}

function countByRole(role) {
  const row = getDb().prepare('SELECT COUNT(*) AS c FROM users WHERE role = ?').get(role);
  return row ? row.c : 0;
}

function list({ search, limit, offset }) {
  let where = '';
  const params = [];
  if (search) {
    where = ' WHERE username LIKE ?';
    params.push('%' + search + '%');
  }
  const countRow = getDb().prepare('SELECT COUNT(*) AS c FROM users' + where).get(...params);
  params.push(limit, offset);
  const rows = getDb().prepare('SELECT id, username, role, is_disabled, created_at FROM users' + where + ' ORDER BY id LIMIT ? OFFSET ?').all(...params);
  return { rows, total: countRow.c };
}

function getAbGroup(userId) {
  const row = getDb().prepare('SELECT group_name FROM ab_groups WHERE user_id = ?').get(userId);
  return row ? row.group_name : null;
}

function setAbGroup(userId, groupName) {
  getDb().prepare('INSERT INTO ab_groups (user_id, group_name) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET group_name = excluded.group_name').run(userId, groupName);
}

function getFreezeStatus(userId) {
  try {
    return getDb().prepare('SELECT frozen, reason FROM user_freeze WHERE user_id = ?').get(userId);
  } catch (_) { return null; }
}

function getAllFreezeStatuses() {
  try {
    return getDb().prepare('SELECT user_id, frozen, reason FROM user_freeze').all();
  } catch (_) { return []; }
}

function setFreeze(userId, frozen, reason) {
  const db = getDb();
  try { db.prepare('SELECT 1 FROM user_freeze LIMIT 1').get(); } catch (_) {
    try { db.prepare("CREATE TABLE IF NOT EXISTS user_freeze (user_id INTEGER NOT NULL PRIMARY KEY REFERENCES users(id), frozen INTEGER NOT NULL DEFAULT 1, reason TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run(); } catch (_e) {}
  }
  db.prepare(
    "INSERT INTO user_freeze (user_id, frozen, reason, updated_at) VALUES (?, ?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET frozen = excluded.frozen, reason = excluded.reason, updated_at = datetime('now')"
  ).run(userId, frozen ? 1 : 0, reason || null);
}

module.exports = {
  findByUsername, findById, create, updatePassword, updateFields,
  deleteById, countByRole, list, getAbGroup, setAbGroup,
  getFreezeStatus, getAllFreezeStatuses, setFreeze
};
