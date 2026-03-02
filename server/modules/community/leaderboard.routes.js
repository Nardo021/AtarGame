'use strict';

const express = require('express');
const router = express.Router();
const { ok, asyncHandler } = require('../../core/errors');
const { getDb } = require('../../core/db');

const cache = { data: null, ts: 0 };
const CACHE_TTL = 30 * 1000;

function getAtarFromSummary(summaryJson) {
  if (!summaryJson) return null;
  try { const s = JSON.parse(summaryJson); return s.atar != null ? s.atar : (s.stats && s.stats.atar); } catch (_) { return null; }
}

function computeLeaderboard(mode, limit) {
  const db = getDb();
  const rows = db.prepare('SELECT user_id, slot, summary_json, updated_at FROM saves').all();
  const byUser = {};
  for (const r of rows) {
    const atar = getAtarFromSummary(r.summary_json);
    if (atar == null) continue;
    let dateIso = null;
    try { const s = r.summary_json ? JSON.parse(r.summary_json) : {}; dateIso = s.date || null; } catch (_) {}
    const uid = r.user_id;
    if (!byUser[uid]) {
      const u = db.prepare('SELECT username FROM users WHERE id = ?').get(uid);
      byUser[uid] = { user_id: uid, username: (u && u.username) || '?', best_ever: atar, latest_atar: atar, latest_at: r.updated_at, date: dateIso, perDate: {} };
    }
    const u = byUser[uid];
    if (atar > (u.best_ever || 0)) u.best_ever = atar;
    if (r.updated_at > (u.latest_at || '')) { u.latest_atar = atar; u.latest_at = r.updated_at; u.date = dateIso; }
    if (dateIso) u.perDate[dateIso] = Math.max(u.perDate[dateIso] || 0, atar);
  }
  let list = Object.values(byUser);
  if (mode === 'best_ever') list.sort((a, b) => (b.best_ever || 0) - (a.best_ever || 0));
  else if (mode === 'latest') list.sort((a, b) => (b.latest_at || '').localeCompare(a.latest_at || ''));
  else if (mode === 'last_day') {
    const lastDate = list.reduce((acc, u) => { const d = u.date; return d && (!acc || d > acc) ? d : acc; }, null);
    list = list.filter(u => lastDate && u.perDate[lastDate] != null).map(u => ({ ...u, atar: u.perDate[lastDate] })).sort((a, b) => (b.atar || 0) - (a.atar || 0));
  } else list.sort((a, b) => (b.best_ever || 0) - (a.best_ever || 0));
  return list.slice(0, limit).map(u => ({
    user_id: u.user_id, username: u.username,
    atar: mode === 'best_ever' ? u.best_ever : mode === 'latest' ? u.latest_atar : u.atar,
    date: u.date, updated_at: u.latest_at
  }));
}

router.get('/leaderboard', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const mode = (req.query.mode || 'best_ever').trim();
  const cacheKey = mode + ':' + limit;
  if (cache.data && cache.key === cacheKey && (Date.now() - cache.ts) < CACHE_TTL) {
    return res.json(ok({ leaderboard: cache.data }));
  }
  const leaderboard = computeLeaderboard(mode, limit);
  cache.data = leaderboard; cache.key = cacheKey; cache.ts = Date.now();
  res.json(ok({ leaderboard }));
}));

module.exports = router;
