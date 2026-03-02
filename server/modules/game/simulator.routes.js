'use strict';

const express = require('express');
const router = express.Router();
const { ok, asyncHandler } = require('../../core/errors');
const { requireAdminAuth } = require('../../core/middleware');
const { assertInt } = require('../../core/validate');
const audit = require('../../core/audit');
const simulatorService = require('./simulator.service');

router.post('/simulate', requireAdminAuth, asyncHandler(async (req, res) => {
  const { n, strategyMix, seed } = req.body || {};
  const params = {
    n: n != null ? n : 1000,
    strategyMix: strategyMix || { study: 0.25, social: 0.25, mixed: 0.25, random: 0.25 },
    seed: seed != null ? seed : Date.now()
  };
  const result = simulatorService.runSimulation(params);
  simulatorService.saveRun(params, result);
  audit.log(req.user.id, 'simulate', null, { n: params.n }, req);
  res.json(ok({ result }));
}));

router.get('/simulation-runs', requireAdminAuth, asyncHandler(async (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const runs = simulatorService.listRuns(limit);
  res.json(ok({ runs }));
}));

module.exports = router;
