'use strict';

const { getDb } = require('../../core/db');

function getDefaults() {
  return getDb().prepare('SELECT key, value_json FROM game_configs WHERE ab_group IS NULL').all();
}

function getAbOverrides(groupName) {
  try {
    return getDb().prepare('SELECT key, value_json FROM game_configs_ab WHERE ab_group = ?').all(groupName || '');
  } catch (_) { return []; }
}

function getAllConfigs() {
  return getDb().prepare('SELECT id, key, value_json, updated_at, ab_group FROM game_configs ORDER BY key, ab_group').all();
}

function upsertDefault(key, valueStr) {
  getDb().prepare(
    "INSERT INTO game_configs (key, value_json, ab_group) VALUES (?, ?, NULL) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, ab_group = excluded.ab_group, updated_at = datetime('now')"
  ).run(key, valueStr);
}

function upsertAb(key, abGroup, valueStr) {
  getDb().prepare(
    "INSERT INTO game_configs_ab (key, ab_group, value_json, updated_at) VALUES (?, ?, ?, datetime('now')) ON CONFLICT(key, ab_group) DO UPDATE SET value_json = excluded.value_json, updated_at = datetime('now')"
  ).run(key, abGroup, valueStr);
}

function getConfigVersionHistory() {
  return getDb().prepare(
    "SELECT a.id, a.ts, a.action, a.detail_json, u.username AS admin_username FROM audit_logs a LEFT JOIN users u ON u.id = a.admin_user_id WHERE a.action = 'config_put' ORDER BY a.id DESC LIMIT 100"
  ).all();
}

module.exports = { getDefaults, getAbOverrides, getAllConfigs, upsertDefault, upsertAb, getConfigVersionHistory };
