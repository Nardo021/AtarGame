'use strict';

const { AppError } = require('../../core/errors');
const adminRepo = require('./admin.repo');

function getAuditLogs(limit, offset) {
  return adminRepo.getAuditLogs(limit, offset);
}

function getStory() {
  const { row, versions } = adminRepo.getStory();
  return {
    story_json: row ? row.story_json : null,
    active_version_id: row ? row.active_version_id : null,
    updated_at: row ? row.updated_at : null,
    versions
  };
}

function saveStory(adminId, storyJsonRaw, note) {
  const raw = typeof storyJsonRaw === 'string' ? storyJsonRaw : JSON.stringify(storyJsonRaw);
  try { JSON.parse(raw); } catch (_) { throw new AppError('INVALID_PARAM', 'story_json 不是合法 JSON', 400); }
  return adminRepo.saveStoryVersion(adminId, raw, note);
}

function rollbackStory(versionId) {
  const v = adminRepo.rollbackStory(versionId);
  if (!v) throw new AppError('NOT_FOUND', '版本不存在', 404);
  return v;
}

function pushEvent(userId, { date_iso, time_block, location, event_id, event_type, title, detail }) {
  adminRepo.insertEventLog(userId, date_iso, time_block || 'Morning', location || 'classroom', event_id, event_type, detail);
  if (title) adminRepo.insertCalendarEvent(userId, date_iso, title, event_type, detail);
}

function broadcast(title, body, expiresAt) {
  adminRepo.insertBroadcast(title, body, expiresAt);
}

module.exports = { getAuditLogs, getStory, saveStory, rollbackStory, pushEvent, broadcast };
