'use strict';

const express = require('express');
const router = express.Router();
const { ok, asyncHandler } = require('../../core/errors');
const { requireAuth } = require('../../core/middleware');
const { assertInt } = require('../../core/validate');
const saveService = require('./save.service');

router.get('/saves', requireAuth, asyncHandler(async (req, res) => {
  const saves = saveService.listSaves(req.user.id);
  res.json(ok({ saves }));
}));

router.get('/saves/:slot', requireAuth, asyncHandler(async (req, res) => {
  const slot = assertInt(req.params.slot, '槽位', { min: 0, max: 9 });
  const data = saveService.loadSave(req.user.id, slot);
  res.json(ok(data));
}));

router.post('/saves/:slot', requireAuth, asyncHandler(async (req, res) => {
  const slot = assertInt(req.params.slot, '槽位', { min: 0, max: 9 });
  const { state_json, summary_json } = req.body || {};
  saveService.writeSave(req.user.id, slot, state_json, summary_json);
  res.json(ok(null));
}));

module.exports = router;
