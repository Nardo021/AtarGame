const { getDb } = require('./db');
const fs = require('fs');
const path = require('path');

const DEFAULT_STORY_PATH = path.join(__dirname, '..', 'client', 'story.js');

function getDefaultStoryJson() {
  try {
    const code = fs.readFileSync(DEFAULT_STORY_PATH, 'utf8');
    const match = code.match(/window\.__DEFAULT_STORY__\s*=\s*(\{[\s\S]*?\});?\s*(?:\n|$)/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (e) {}
    }
  } catch (e) {}
  return { nodes: {} };
}

function getActiveStory() {
  const db = getDb();
  let row = db.prepare('SELECT story_json FROM story_store WHERE id = 1').get();
  if (!row || !row.story_json) {
    const defaultStory = getDefaultStoryJson();
    db.prepare('INSERT OR REPLACE INTO story_store (id, story_json, updated_at) VALUES (1, ?, datetime(\'now\'))').run(JSON.stringify(defaultStory));
    row = db.prepare('SELECT story_json FROM story_store WHERE id = 1').get();
  }
  return row ? JSON.parse(row.story_json) : getDefaultStoryJson();
}

function setStory(adminUserId, storyJson, note) {
  const db = getDb();
  const jsonStr = typeof storyJson === 'string' ? storyJson : JSON.stringify(storyJson);
  db.prepare('INSERT INTO story_versions (admin_user_id, story_json, note) VALUES (?, ?, ?)').run(adminUserId, jsonStr, note || '');
  const ver = db.prepare('SELECT id FROM story_versions ORDER BY id DESC LIMIT 1').get();
  db.prepare('UPDATE story_store SET story_json = ?, active_version_id = ?, updated_at = datetime(\'now\') WHERE id = 1').run(jsonStr, ver ? ver.id : null);
  if (!db.prepare('SELECT 1 FROM story_store WHERE id = 1').get()) {
    db.prepare('INSERT INTO story_store (id, story_json, active_version_id, updated_at) VALUES (1, ?, ?, datetime(\'now\'))').run(jsonStr, ver ? ver.id : null);
  }
  return ver ? ver.id : null;
}

function listVersions() {
  const db = getDb();
  return db.prepare('SELECT id, ts, admin_user_id, note FROM story_versions ORDER BY id DESC LIMIT 50').all();
}

function getVersion(versionId) {
  const db = getDb();
  const row = db.prepare('SELECT story_json FROM story_versions WHERE id = ?').get(versionId);
  return row ? JSON.parse(row.story_json) : null;
}

function rollbackToVersion(adminUserId, versionId) {
  const story = getVersion(versionId);
  if (!story) return null;
  return setStory(adminUserId, story, '回滚到版本 ' + versionId);
}

module.exports = { getActiveStory, setStory, listVersions, getVersion, rollbackToVersion, getDefaultStoryJson };
