const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { getDb } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'atar-dev-secret-change-in-production';
const JWT_OPTS = { expiresIn: '7d' };

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, JWT_OPTS);
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function ensureAdmin() {
  const db = getDb();
  const adminPassword = process.env.ADMIN_PASSWORD || 'caifu2001';
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!existing) {
    const hash = hashPassword(adminPassword);
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
  } else if (process.env.ADMIN_PASSWORD) {
    const hash = hashPassword(adminPassword);
    db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(hash, 'admin');
  }
}

function register(username, password) {
  const db = getDb();
  const hash = hashPassword(password);
  try {
    const r = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, hash, 'user');
    return { id: r.lastInsertRowid, username, role: 'user' };
  } catch (e) {
    if ((e.code === 'SQLITE_CONSTRAINT_UNIQUE') || (e.message && e.message.includes('UNIQUE'))) return null;
    throw e;
  }
}

function login(username, password) {
  const db = getDb();
  const user = db.prepare('SELECT id, username, password_hash, role, is_disabled FROM users WHERE username = ?').get(username);
  if (!user || user.is_disabled) return null;
  if (!comparePassword(password, user.password_hash)) return null;
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    token: createToken({ id: user.id, username: user.username, role: user.role })
  };
}

module.exports = {
  JWT_SECRET,
  hashPassword,
  comparePassword,
  createToken,
  verifyToken,
  ensureAdmin,
  register,
  login
};
