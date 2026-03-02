'use strict';

const express = require('express');
const router = express.Router();
const { ok, asyncHandler } = require('../../core/errors');
const { optionalAuth } = require('../../core/middleware');
const configService = require('./config.service');

router.get('/config', optionalAuth, asyncHandler(async (req, res) => {
  const config = configService.getMergedConfig(req.user ? req.user.id : null);
  config.config_version = configService.getConfigVersion();
  res.json(ok(config));
}));

module.exports = router;
