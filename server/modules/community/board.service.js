'use strict';

const { getDb } = require('../../core/db');
const { AppError } = require('../../core/errors');

const BLOCK_WORDS = ['违禁', '广告', 'spam'];

function filterBlockWords(content) {
  if (!content || typeof content !== 'string') return true;
  const lower = content.toLowerCase();
  return !BLOCK_WORDS.some(w => lower.includes(w.toLowerCase()));
}

function listPosts({ page, limit, keyword }) {
  const db = getDb();
  const offset = (page - 1) * limit;
  let where = ' WHERE p.is_deleted = 0 ';
  const params = [];
  if (keyword) {
    where += ' AND (p.content LIKE ? OR u.username LIKE ?) ';
    params.push('%' + keyword + '%', '%' + keyword + '%');
  }
  const countRow = db.prepare('SELECT COUNT(*) AS c FROM board_posts p JOIN users u ON u.id = p.user_id' + where).get(...params);
  params.push(limit, offset);
  const rows = db.prepare(
    `SELECT p.id, p.user_id, p.content, p.created_at, u.username FROM board_posts p JOIN users u ON u.id = p.user_id ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
  ).all(...params);
  const posts = rows.filter(r => filterBlockWords(r.content));
  return { posts, total: countRow.c, page, limit };
}

function createPost(userId, content) {
  if (!content || content.length > 5000) throw new AppError('INVALID_PARAM', '内容无效或过长', 400);
  if (!filterBlockWords(content)) throw new AppError('CONTENT_BLOCKED', '内容含敏感词', 400);
  getDb().prepare('INSERT INTO board_posts (user_id, content) VALUES (?, ?)').run(userId, content);
}

function softDelete(postId) {
  const db = getDb();
  const row = db.prepare('SELECT id FROM board_posts WHERE id = ?').get(postId);
  if (!row) throw new AppError('NOT_FOUND', '帖子不存在', 404);
  db.prepare('UPDATE board_posts SET is_deleted = 1 WHERE id = ?').run(postId);
}

module.exports = { listPosts, createPost, softDelete };
