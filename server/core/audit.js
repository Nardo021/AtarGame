'use strict';

const { getDb } = require('./db');

function log(adminUserId, action, targetUserId, detail, req) {
  const db = getDb();
  const ip = req ? (req.ip || req.connection?.remoteAddress || null) : null;
  const ua = req ? (req.headers?.['user-agent'] || null) : null;
  try {
    db.prepare(
      'INSERT INTO audit_logs (admin_user_id, action, target_user_id, detail_json, ip, ua) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(adminUserId, action, targetUserId || null, detail ? JSON.stringify(detail) : null, ip, ua);
  } catch (e) {
    db.prepare(
      'INSERT INTO audit_logs (admin_user_id, action, target_user_id, detail_json) VALUES (?, ?, ?, ?)'
    ).run(adminUserId, action, targetUserId || null, detail ? JSON.stringify(detail) : null);
  }
}

module.exports = { log };
