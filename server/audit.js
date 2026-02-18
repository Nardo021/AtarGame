const { getDb } = require('./db');

function log(adminUserId, action, targetUserId, detail) {
  const db = getDb();
  db.prepare(
    'INSERT INTO audit_logs (admin_user_id, action, target_user_id, detail_json) VALUES (?, ?, ?, ?)'
  ).run(adminUserId, action, targetUserId || null, detail ? JSON.stringify(detail) : null);
}

module.exports = { log };
