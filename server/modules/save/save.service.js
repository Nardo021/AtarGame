'use strict';

const { AppError } = require('../../core/errors');
const saveRepo = require('./save.repo');

function listSaves(userId) {
  return saveRepo.listByUser(userId);
}

function loadSave(userId, slot) {
  const row = saveRepo.getBySlot(userId, slot);
  if (!row) throw new AppError('NOT_FOUND', '无存档', 404);
  return {
    state: row.state_json ? JSON.parse(row.state_json) : null,
    summary: row.summary_json ? JSON.parse(row.summary_json) : null,
    updated_at: row.updated_at
  };
}

function writeSave(userId, slot, stateJson, summaryJson) {
  const stateStr = stateJson != null ? (typeof stateJson === 'string' ? stateJson : JSON.stringify(stateJson)) : null;
  const summaryStr = summaryJson != null ? (typeof summaryJson === 'string' ? summaryJson : JSON.stringify(summaryJson)) : null;
  if (stateStr === null && summaryStr === null) {
    throw new AppError('INVALID_PARAM', '请提供 state_json 或 summary_json', 400);
  }
  const existing = saveRepo.getBySlot(userId, slot);
  const finalState = stateStr != null ? stateStr : (existing && existing.state_json) || null;
  const finalSummary = summaryStr != null ? summaryStr : (existing && existing.summary_json) || null;
  saveRepo.upsert(userId, slot, finalState, finalSummary);
  updateMeta(userId, slot, finalSummary);
}

function updateMeta(userId, slot, summaryStr) {
  if (!summaryStr) return;
  try {
    const summary = JSON.parse(summaryStr);
    const atar = summary.atar != null ? summary.atar : (summary.stats && summary.stats.atar);
    if (typeof atar !== 'number') return;
    const existing = saveRepo.getBySlot(userId, slot);
    let meta = {};
    if (existing && existing.meta_json) { try { meta = JSON.parse(existing.meta_json); } catch (_) {} }
    meta.latest_atar = atar;
    meta.last_save_date = summary.date || null;
    meta.snapshot_version = summary.snapshotVersion || 1;
    if (!meta.best_ever_atar || atar > meta.best_ever_atar) meta.best_ever_atar = atar;
    try { saveRepo.updateMeta(userId, slot, JSON.stringify(meta)); } catch (_) {}
  } catch (_) {}
}

function adminLoadSave(userId, slot) {
  const row = saveRepo.getBySlot(userId, slot);
  if (!row) throw new AppError('NOT_FOUND', '无存档', 404);
  return { state_json: row.state_json, summary_json: row.summary_json, updated_at: row.updated_at };
}

function adminWriteSave(userId, slot, stateJson, summaryJson) {
  const stateStr = stateJson != null ? (typeof stateJson === 'string' ? stateJson : JSON.stringify(stateJson)) : null;
  const summaryStr = summaryJson != null ? (typeof summaryJson === 'string' ? summaryJson : JSON.stringify(summaryJson)) : null;
  if (stateStr != null) { try { JSON.parse(stateStr); } catch (_) { throw new AppError('INVALID_PARAM', 'state_json 不是合法 JSON', 400); } }
  if (summaryStr != null) { try { JSON.parse(summaryStr); } catch (_) { throw new AppError('INVALID_PARAM', 'summary_json 不是合法 JSON', 400); } }
  const existing = saveRepo.getBySlot(userId, slot);
  const backup = existing ? { state_json: existing.state_json, summary_json: existing.summary_json } : null;
  const finalState = stateStr != null ? stateStr : (existing && existing.state_json) || null;
  const finalSummary = summaryStr != null ? summaryStr : (existing && existing.summary_json) || null;
  saveRepo.upsert(userId, slot, finalState, finalSummary);
  return backup;
}

module.exports = { listSaves, loadSave, writeSave, adminLoadSave, adminWriteSave };
