'use strict';

const express = require('express');
const router = express.Router();
const { ok, asyncHandler } = require('../../core/errors');
const { requireAuth } = require('../../core/middleware');
const { boardPostLimiter } = require('../../core/rateLimit');
const boardService = require('./board.service');

router.get('/board', asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 20), 100);
  const keyword = (req.query.keyword || '').trim();
  const data = boardService.listPosts({ page, limit, keyword });
  res.json(ok(data));
}));

router.post('/board', requireAuth, boardPostLimiter, asyncHandler(async (req, res) => {
  const content = (req.body && req.body.content) != null ? String(req.body.content).trim() : '';
  boardService.createPost(req.user.id, content);
  res.status(201).json(ok(null));
}));

module.exports = router;
