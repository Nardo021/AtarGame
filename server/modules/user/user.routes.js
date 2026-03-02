'use strict';

const express = require('express');
const router = express.Router();
const { ok, asyncHandler } = require('../../core/errors');
const { requireAuth } = require('../../core/middleware');
const { assertString } = require('../../core/validate');
const userService = require('./user.service');

router.post('/auth/register', asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  const name = assertString(username, '用户名', { min: 2, max: 30 });
  assertString(password, '密码', { min: 6, max: 100, trim: false });
  const result = userService.registerUser(name, password);
  res.cookie('token', result.token, { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000, sameSite: 'lax' });
  res.status(201).json(ok({ user: result.user }));
}));

router.post('/auth/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  assertString(username, '用户名', { min: 1 });
  assertString(password, '密码', { min: 1, trim: false });
  const result = userService.loginUser(String(username).trim(), password);
  res.cookie('token', result.token, { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000, sameSite: 'lax' });
  res.json(ok({ user: result.user }));
}));

router.post('/auth/logout', (_req, res) => {
  res.clearCookie('token');
  res.json(ok(null));
});

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = userService.getMe(req.user.id);
  res.json(ok({ user }));
}));

module.exports = router;
