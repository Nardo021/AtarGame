'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { getDb } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'change-in-production';
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

function createTokenWithExpiry(payload, expiresIn) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
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
    const uid = r.lastInsertRowid;
    const count = db.prepare('SELECT COUNT(*) AS c FROM users WHERE role = ?').get('user');
    const groupName = count && count.c % 2 === 0 ? 'A' : 'B';
    try { db.prepare('INSERT INTO ab_groups (user_id, group_name) VALUES (?, ?)').run(uid, groupName); } catch (_) {}
    return { id: uid, username, role: 'user' };
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
  JWT_SECRET, hashPassword, comparePassword,
  createToken, createTokenWithExpiry, verifyToken,
  ensureAdmin, register, login
};
