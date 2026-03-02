'use strict';

const configRepo = require('./config.repo');
const userRepo = require('../user/user.repo');

function getMergedConfig(userId) {
  let group = null;
  if (userId) {
    group = userRepo.getAbGroup(userId);
  }
  const defaultRows = configRepo.getDefaults();
  const abRows = group ? configRepo.getAbOverrides(group) : [];
  const out = {};
  defaultRows.forEach(r => {
    try { out[r.key] = r.value_json ? JSON.parse(r.value_json) : null; } catch (_) {}
  });
  abRows.forEach(r => {
    try { out[r.key] = r.value_json ? JSON.parse(r.value_json) : null; } catch (_) {}
  });
  return out;
}

function getAllConfigs() {
  return configRepo.getAllConfigs();
}

function putConfig(key, valueStr, abGroup) {
  if (abGroup && (abGroup === 'A' || abGroup === 'B')) {
    configRepo.upsertAb(key, abGroup, valueStr);
  } else {
    configRepo.upsertDefault(key, valueStr);
  }
}

function getVersionHistory() {
  return configRepo.getConfigVersionHistory();
}

function publishConfig() {
  const { getDb } = require('../../core/db');
  const db = getDb();
  db.prepare("UPDATE game_configs SET published_at = datetime('now'), version = COALESCE(version, 0) + 1 WHERE ab_group IS NULL").run();
}

function rollbackConfig(targetVersion) {
  const { getDb } = require('../../core/db');
  const { AppError } = require('../../core/errors');
  const db = getDb();
  const rows = db.prepare("SELECT a.detail_json FROM audit_logs a WHERE a.action = 'config_put' ORDER BY a.id DESC").all();
  if (!rows || rows.length === 0) throw new AppError('NOT_FOUND', '无配置历史', 404);
  const snap = rows.find(r => {
    try { const d = JSON.parse(r.detail_json); return d && d.version === targetVersion; } catch (_) { return false; }
  });
  if (!snap) {
    db.prepare("UPDATE game_configs SET version = ? WHERE ab_group IS NULL").run(targetVersion);
  }
}

function getConfigVersion() {
  try {
    const rows = configRepo.getDefaults();
    let maxVersion = 1;
    rows.forEach(r => {
      try {
        const parsed = r.value_json ? JSON.parse(r.value_json) : {};
        if (parsed._version && parsed._version > maxVersion) maxVersion = parsed._version;
      } catch (_) {}
    });
    return maxVersion;
  } catch (_) { return 1; }
}

module.exports = { getMergedConfig, getAllConfigs, putConfig, getVersionHistory, getConfigVersion, publishConfig, rollbackConfig };
