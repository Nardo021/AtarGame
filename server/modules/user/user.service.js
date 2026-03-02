'use strict';

const { hashPassword, comparePassword, createToken, createTokenWithExpiry } = require('../../core/auth');
const { AppError } = require('../../core/errors');
const userRepo = require('./user.repo');

function registerUser(username, password) {
  const hash = hashPassword(password);
  try {
    const r = userRepo.create(username, hash, 'user');
    const uid = r.lastInsertRowid;
    const count = userRepo.countByRole('user');
    const groupName = count % 2 === 0 ? 'A' : 'B';
    try { userRepo.setAbGroup(uid, groupName); } catch (_) {}
    const token = createToken({ id: uid, username, role: 'user' });
    return { user: { id: uid, username, role: 'user' }, token };
  } catch (e) {
    if ((e.code === 'SQLITE_CONSTRAINT_UNIQUE') || (e.message && e.message.includes('UNIQUE'))) {
      throw new AppError('DUPLICATE_USERNAME', '用户名已存在', 409);
    }
    throw e;
  }
}

function loginUser(username, password) {
  const user = userRepo.findByUsername(username);
  if (!user || user.is_disabled) throw new AppError('AUTH_FAILED', '用户名或密码错误', 401);
  if (!comparePassword(password, user.password_hash)) throw new AppError('AUTH_FAILED', '用户名或密码错误', 401);
  const token = createToken({ id: user.id, username: user.username, role: user.role });
  return { user: { id: user.id, username: user.username, role: user.role }, token };
}

function getMe(userId) {
  const user = userRepo.findById(userId);
  if (!user) throw new AppError('NOT_FOUND', '用户不存在', 404);
  return { id: user.id, username: user.username, role: user.role };
}

function listUsers({ search, page, limit }) {
  const offset = (page - 1) * limit;
  const { rows, total } = userRepo.list({ search, limit, offset });
  const freezeRows = userRepo.getAllFreezeStatuses();
  const freezeMap = {};
  freezeRows.forEach(r => { freezeMap[r.user_id] = r; });
  const list = rows.map(r => ({
    ...r,
    is_disabled: !!r.is_disabled,
    frozen: freezeMap[r.id] ? !!freezeMap[r.id].frozen : false,
    freeze_reason: freezeMap[r.id] ? freezeMap[r.id].reason : null
  }));
  return { users: list, total, page, limit };
}

function createUser(username, password, role) {
  const hash = hashPassword(password);
  try {
    const r = userRepo.create(username.trim(), hash, role === 'admin' ? 'admin' : 'user');
    return { id: r.lastInsertRowid, username: username.trim(), role: role === 'admin' ? 'admin' : 'user' };
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) throw new AppError('DUPLICATE_USERNAME', '用户名已存在', 409);
    throw e;
  }
}

function patchUser(id, { is_disabled, role }) {
  const u = userRepo.findById(id);
  if (!u) throw new AppError('NOT_FOUND', '用户不存在', 404);
  const updates = [];
  const params = [];
  if (typeof is_disabled === 'boolean') { updates.push('is_disabled = ?'); params.push(is_disabled ? 1 : 0); }
  if (role === 'admin' || role === 'user') { updates.push('role = ?'); params.push(role); }
  if (updates.length === 0) throw new AppError('INVALID_PARAM', '无有效更新', 400);
  userRepo.updateFields(id, updates, params);
}

function deleteUser(id) {
  const u = userRepo.findById(id);
  if (!u) throw new AppError('NOT_FOUND', '用户不存在', 404);
  if (u.username === 'admin') throw new AppError('FORBIDDEN', '不能删除 admin 账号', 403);
  userRepo.deleteById(id);
  return u;
}

function resetPassword(id, password) {
  const u = userRepo.findById(id);
  if (!u) throw new AppError('NOT_FOUND', '用户不存在', 404);
  const hash = hashPassword(password);
  userRepo.updatePassword(id, hash);
  return u;
}

function impersonateUser(id, adminId) {
  const u = userRepo.findById(id);
  if (!u || u.is_disabled) throw new AppError('NOT_FOUND', '用户不存在或已禁用', 404);
  const token = createTokenWithExpiry({ id: u.id, username: u.username, role: u.role, impersonatedBy: adminId }, '1h');
  return { token, username: u.username };
}

function freezeUser(id, frozen, reason) {
  const u = userRepo.findById(id);
  if (!u) throw new AppError('NOT_FOUND', '用户不存在', 404);
  userRepo.setFreeze(id, frozen, reason);
  return { frozen: !!frozen };
}

module.exports = {
  registerUser, loginUser, getMe, listUsers, createUser,
  patchUser, deleteUser, resetPassword, impersonateUser, freezeUser
};
