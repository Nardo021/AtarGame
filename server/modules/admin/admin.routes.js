'use strict';

const express = require('express');
const router = express.Router();
const { ok, asyncHandler, AppError } = require('../../core/errors');
const { requireAdminAuth } = require('../../core/middleware');
const { assertString, assertInt, assertJSON } = require('../../core/validate');
const { login, verifyToken } = require('../../core/auth');
const audit = require('../../core/audit');
const userService = require('../user/user.service');
const saveService = require('../save/save.service');
const adminService = require('./admin.service');
const configService = require('../game/config.service');
const boardService = require('../community/board.service');

const COOKIE_OPTS = { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000, sameSite: 'lax' };

router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  assertString(username, '用户名', { min: 1 });
  assertString(password, '密码', { min: 1, trim: false });
  const result = login(String(username).trim(), password);
  if (!result) throw new AppError('AUTH_FAILED', '用户名或密码错误', 401);
  if (result.role !== 'admin') throw new AppError('FORBIDDEN', '需要管理员账号', 403);
  res.cookie('admin_token', result.token, COOKIE_OPTS);
  res.json(ok({ user: { id: result.id, username: result.username, role: result.role } }));
}));

router.get('/me', asyncHandler(async (req, res) => {
  const token = req.cookies?.admin_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new AppError('UNAUTHORIZED', '未登录', 401);
  const payload = verifyToken(token);
  if (!payload) throw new AppError('TOKEN_EXPIRED', '登录已过期', 401);
  const user = userService.getMe(payload.id);
  if (user.role !== 'admin') throw new AppError('FORBIDDEN', '需要管理员权限', 403);
  res.json(ok({ user }));
}));

router.post('/logout', (_req, res) => {
  res.clearCookie('admin_token');
  res.json(ok(null));
});

// --- Users ---
router.get('/users', requireAdminAuth, asyncHandler(async (req, res) => {
  const search = (req.query.search || '').trim();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const data = userService.listUsers({ search, page, limit });
  res.json(ok(data));
}));

router.post('/users', requireAdminAuth, asyncHandler(async (req, res) => {
  const { username, password, role } = req.body || {};
  assertString(username, '用户名', { min: 2, max: 30 });
  assertString(password, '密码', { min: 6, max: 100, trim: false });
  const user = userService.createUser(username, password, role);
  audit.log(req.user.id, 'user_create', user.id, { username: user.username, role: user.role }, req);
  res.status(201).json(ok({ user }));
}));

router.patch('/users/:id', requireAdminAuth, asyncHandler(async (req, res) => {
  const id = assertInt(req.params.id, '用户 ID', { min: 1 });
  const { is_disabled, role } = req.body || {};
  userService.patchUser(id, { is_disabled, role });
  audit.log(req.user.id, 'user_patch', id, { is_disabled, role }, req);
  res.json(ok(null));
}));

router.delete('/users/:id', requireAdminAuth, asyncHandler(async (req, res) => {
  const id = assertInt(req.params.id, '用户 ID', { min: 1 });
  const u = userService.deleteUser(id);
  audit.log(req.user.id, 'user_delete', id, { username: u.username }, req);
  res.json(ok(null));
}));

router.post('/users/:id/reset-password', requireAdminAuth, asyncHandler(async (req, res) => {
  const id = assertInt(req.params.id, '用户 ID', { min: 1 });
  const { password } = req.body || {};
  assertString(password, '密码', { min: 6, max: 100, trim: false });
  const u = userService.resetPassword(id, password);
  audit.log(req.user.id, 'user_reset_password', id, { username: u.username }, req);
  res.json(ok(null));
}));

// --- Saves (admin) ---
router.get('/users/:id/saves', requireAdminAuth, asyncHandler(async (req, res) => {
  const id = assertInt(req.params.id, '用户 ID', { min: 1 });
  const saves = saveService.listSaves(id);
  res.json(ok({ saves }));
}));

router.get('/users/:id/saves/:slot', requireAdminAuth, asyncHandler(async (req, res) => {
  const userId = assertInt(req.params.id, '用户 ID', { min: 1 });
  const slot = assertInt(req.params.slot, '槽位', { min: 0, max: 9 });
  const data = saveService.adminLoadSave(userId, slot);
  res.json(ok(data));
}));

router.put('/users/:id/saves/:slot', requireAdminAuth, asyncHandler(async (req, res) => {
  const userId = assertInt(req.params.id, '用户 ID', { min: 1 });
  const slot = assertInt(req.params.slot, '槽位', { min: 0, max: 9 });
  const { state_json, summary_json } = req.body || {};
  const backup = saveService.adminWriteSave(userId, slot, state_json, summary_json);
  if (backup) audit.log(req.user.id, 'admin_save_backup', userId, { slot, backup }, req);
  audit.log(req.user.id, 'admin_save_put', userId, { slot }, req);
  res.json(ok(null));
}));

// --- Impersonate / Freeze ---
router.post('/users/:id/impersonate', requireAdminAuth, asyncHandler(async (req, res) => {
  const id = assertInt(req.params.id, '用户 ID', { min: 1 });
  const result = userService.impersonateUser(id, req.user.id);
  audit.log(req.user.id, 'impersonate', id, { username: result.username }, req);
  res.cookie('token', result.token, { httpOnly: true, maxAge: 60 * 60 * 1000, sameSite: 'lax' });
  res.json(ok({ redirect: '/' }));
}));

router.post('/users/:id/freeze', requireAdminAuth, asyncHandler(async (req, res) => {
  const id = assertInt(req.params.id, '用户 ID', { min: 1 });
  const { frozen, reason } = req.body || {};
  const result = userService.freezeUser(id, !!frozen, reason);
  audit.log(req.user.id, 'user_freeze', id, { frozen: result.frozen, reason: reason || null }, req);
  res.json(ok(result));
}));

// --- Push Event / Broadcast ---
router.post('/users/:id/push-event', requireAdminAuth, asyncHandler(async (req, res) => {
  const id = assertInt(req.params.id, '用户 ID', { min: 1 });
  const { date_iso, time_block, location, event_id, event_type, title, detail } = req.body || {};
  assertString(date_iso, 'date_iso', { min: 1 });
  assertString(event_id, 'event_id', { min: 1 });
  assertString(event_type, 'event_type', { min: 1 });
  adminService.pushEvent(id, { date_iso, time_block, location, event_id, event_type, title, detail });
  audit.log(req.user.id, 'push_event', id, { date_iso, event_id, event_type }, req);
  res.status(201).json(ok(null));
}));

router.post('/broadcast', requireAdminAuth, asyncHandler(async (req, res) => {
  const { title, body, expires_at } = req.body || {};
  assertString(title, 'title', { min: 1 });
  adminService.broadcast(title, body, expires_at);
  audit.log(req.user.id, 'broadcast', null, { title, body: (body || '').slice(0, 200) }, req);
  res.status(201).json(ok(null));
}));

// --- Audit ---
router.get('/audit', requireAdminAuth, asyncHandler(async (req, res) => {
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const { rows, total } = adminService.getAuditLogs(limit, offset);
  res.json(ok({ logs: rows, total }));
}));

// --- Story ---
router.get('/story', requireAdminAuth, asyncHandler(async (req, res) => {
  const data = adminService.getStory();
  res.json(ok(data));
}));

router.put('/story', requireAdminAuth, asyncHandler(async (req, res) => {
  const { story_json, note } = req.body || {};
  if (story_json === undefined) throw new AppError('INVALID_PARAM', '缺少 story_json', 400);
  const versionId = adminService.saveStory(req.user.id, story_json, note);
  audit.log(req.user.id, 'story_update', null, { version_id: versionId, note: note || null }, req);
  res.json(ok({ version_id: versionId }));
}));

router.post('/story/rollback/:versionId', requireAdminAuth, asyncHandler(async (req, res) => {
  const versionId = assertInt(req.params.versionId, '版本 ID', { min: 1 });
  adminService.rollbackStory(versionId);
  audit.log(req.user.id, 'story_rollback', null, { version_id: versionId }, req);
  res.json(ok(null));
}));

// --- Board delete ---
router.delete('/board/:id', requireAdminAuth, asyncHandler(async (req, res) => {
  const id = assertInt(req.params.id, '帖子 ID', { min: 1 });
  boardService.softDelete(id);
  audit.log(req.user.id, 'board_delete', null, { post_id: id }, req);
  res.json(ok(null));
}));

// --- Config & AB ---
router.get('/config', requireAdminAuth, asyncHandler(async (req, res) => {
  const configs = configService.getAllConfigs();
  res.json(ok({ configs }));
}));

router.put('/config', requireAdminAuth, asyncHandler(async (req, res) => {
  const { key, value_json, ab_group } = req.body || {};
  assertString(key, 'key', { min: 1 });
  const valStr = assertJSON(value_json, 'value_json') || 'null';
  const ab = ab_group != null ? String(ab_group).trim() || null : null;
  configService.putConfig(key, valStr, ab);
  audit.log(req.user.id, 'config_put', null, { key, ab_group: ab }, req);
  res.json(ok(null));
}));

router.get('/config/versions', requireAdminAuth, asyncHandler(async (req, res) => {
  const versions = configService.getVersionHistory();
  res.json(ok({ versions }));
}));

router.post('/config/publish', requireAdminAuth, asyncHandler(async (req, res) => {
  configService.publishConfig();
  audit.log(req.user.id, 'config_publish', null, {}, req);
  res.json(ok(null));
}));

router.post('/config/rollback', requireAdminAuth, asyncHandler(async (req, res) => {
  const { version } = req.body || {};
  if (version == null) throw new AppError('INVALID_PARAM', '缺少 version', 400);
  configService.rollbackConfig(assertInt(version, 'version', { min: 1 }));
  audit.log(req.user.id, 'config_rollback', null, { version }, req);
  res.json(ok(null));
}));

router.post('/ab-groups', requireAdminAuth, asyncHandler(async (req, res) => {
  const { userId, groupName, user_id, group_name } = req.body || {};
  const uid = assertInt(user_id != null ? user_id : userId, 'userId');
  const group = assertString(group_name != null ? group_name : groupName, 'groupName', { min: 1 });
  const userRepo = require('../user/user.repo');
  userRepo.setAbGroup(uid, group);
  audit.log(req.user.id, 'ab_assign', uid, { group_name: group }, req);
  res.json(ok(null));
}));

module.exports = router;
