'use strict';

const express = require('express');
const router = express.Router();
const { ok, asyncHandler } = require('../../core/errors');
const { requireAuth } = require('../../core/middleware');
const { assertString, assertDateISO, assertMonthKey } = require('../../core/validate');
const { getDb } = require('../../core/db');

// --- Logs ---
router.post('/logs/action', requireAuth, asyncHandler(async (req, res) => {
  const { save_slot, date_iso, time_block, location, action_type, node_id, choice_id, delta_json, state_before_json, state_after_json } = req.body || {};
  assertString(date_iso, 'date_iso', { min: 1 });
  assertString(time_block, 'time_block', { min: 1 });
  assertString(location, 'location', { min: 1 });
  assertString(action_type, 'action_type', { min: 1 });
  const db = getDb();
  const slot = save_slot != null ? (isNaN(parseInt(save_slot, 10)) ? 0 : parseInt(save_slot, 10)) : 0;
  db.prepare(
    'INSERT INTO action_logs (user_id, save_slot, date_iso, time_block, location, action_type, node_id, choice_id, delta_json, state_before_json, state_after_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    req.user.id, slot, date_iso, time_block, location, action_type,
    node_id || null, choice_id || null,
    delta_json != null ? (typeof delta_json === 'string' ? delta_json : JSON.stringify(delta_json)) : null,
    state_before_json != null ? (typeof state_before_json === 'string' ? state_before_json : JSON.stringify(state_before_json)) : null,
    state_after_json != null ? (typeof state_after_json === 'string' ? state_after_json : JSON.stringify(state_after_json)) : null
  );
  res.status(201).json(ok(null));
}));

router.post('/logs/event', requireAuth, asyncHandler(async (req, res) => {
  const { date_iso, time_block, location, event_id, event_type, detail_json } = req.body || {};
  assertString(date_iso, 'date_iso', { min: 1 });
  assertString(time_block, 'time_block', { min: 1 });
  assertString(location, 'location', { min: 1 });
  assertString(event_id, 'event_id', { min: 1 });
  assertString(event_type, 'event_type', { min: 1 });
  const db = getDb();
  db.prepare(
    'INSERT INTO event_logs (user_id, date_iso, time_block, location, event_id, event_type, detail_json) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    req.user.id, date_iso, time_block, location, event_id, event_type,
    detail_json != null ? (typeof detail_json === 'string' ? detail_json : JSON.stringify(detail_json)) : null
  );
  res.status(201).json(ok(null));
}));

// --- Messages (broadcast) ---
router.get('/messages', asyncHandler(async (_req, res) => {
  const db = getDb();
  const rows = db.prepare(
    "SELECT id, title, body, created_at, expires_at FROM messages WHERE expires_at IS NULL OR datetime(expires_at) > datetime('now') ORDER BY id DESC LIMIT 20"
  ).all();
  res.json(ok({ messages: rows }));
}));

// --- Calendar ---
router.get('/calendar', requireAuth, asyncHandler(async (req, res) => {
  const month = assertMonthKey(req.query.month, 'month');
  const db = getDb();
  const rows = db.prepare(
    'SELECT date_iso, title, type AS event_type, detail_json FROM calendar_events WHERE (user_id IS NULL OR user_id = ?) AND date_iso LIKE ? ORDER BY date_iso'
  ).all(req.user.id, month + '%');
  res.json(ok({ events: rows }));
}));

router.get('/calendar/day', requireAuth, asyncHandler(async (req, res) => {
  const date = assertDateISO(req.query.date || req.query.date_iso, 'date');
  const db = getDb();
  const actions = db.prepare(
    'SELECT id, date_iso, time_block, location, action_type, node_id, choice_id, delta_json, state_after_json FROM action_logs WHERE user_id = ? AND date_iso = ? ORDER BY id'
  ).all(req.user.id, date);
  const events = db.prepare(
    'SELECT id, date_iso, time_block, location, event_id, event_type, detail_json FROM event_logs WHERE user_id = ? AND date_iso = ? ORDER BY id'
  ).all(req.user.id, date);
  res.json(ok({ actions, events }));
}));

// --- Diary ---
router.get('/diary', requireAuth, asyncHandler(async (req, res) => {
  const from = assertDateISO(req.query.from, 'from');
  const to = assertDateISO(req.query.to, 'to');
  const db = getDb();
  const rows = db.prepare(
    'SELECT date_iso, content FROM diary_entries WHERE user_id = ? AND date_iso >= ? AND date_iso <= ? ORDER BY date_iso'
  ).all(req.user.id, from, to);
  res.json(ok({ entries: rows }));
}));

router.post('/diary', requireAuth, asyncHandler(async (req, res) => {
  const { date_iso, content } = req.body || {};
  const date = assertDateISO(date_iso, 'date_iso');
  assertString(content, 'content', { min: 0 });
  const db = getDb();
  const existing = db.prepare('SELECT id FROM diary_entries WHERE user_id = ? AND date_iso = ?').get(req.user.id, date);
  if (existing) {
    db.prepare("UPDATE diary_entries SET content = ?, created_at = datetime('now') WHERE user_id = ? AND date_iso = ?").run(content, req.user.id, date);
  } else {
    db.prepare('INSERT INTO diary_entries (user_id, date_iso, content) VALUES (?, ?, ?)').run(req.user.id, date, content);
  }
  res.json(ok(null));
}));

module.exports = router;
