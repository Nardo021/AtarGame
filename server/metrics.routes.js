/**
 * Admin 运营指标聚合：留存、漏斗、节点流、结局、劝退点、活跃时间、热力图、事件 Top
 * 时间范围：from, to (YYYY-MM-DD)，可选
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('./db');
const { requireAdminAuth } = require('./middleware');

function parseRange(req) {
  const from = (req.query.from || '').trim();
  const to = (req.query.to || '').trim();
  const hasRange = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to);
  return { from: hasRange ? from : null, to: hasRange ? to : null };
}

// 留存 D1/D7/D30（按首次 action 日期为 cohort）
router.get('/retention', requireAdminAuth, (req, res) => {
  try {
    const db = getDb();
    const { from, to } = parseRange(req);
    const cohortWhere = from && to ? ' WHERE date_iso >= ? AND date_iso <= ?' : '';
    const cohortParams = from && to ? [from, to] : [];
    const sql = `
      WITH first_actions AS (
        SELECT user_id, MIN(date_iso) AS first_iso FROM action_logs${cohortWhere}
        GROUP BY user_id
      )
      SELECT
        f.first_iso AS cohort_date,
        COUNT(DISTINCT f.user_id) AS cohort_size,
        COUNT(DISTINCT CASE WHEN a1.user_id IS NOT NULL THEN f.user_id END) AS d1_retained,
        COUNT(DISTINCT CASE WHEN a7.user_id IS NOT NULL THEN f.user_id END) AS d7_retained,
        COUNT(DISTINCT CASE WHEN a30.user_id IS NOT NULL THEN f.user_id END) AS d30_retained
      FROM first_actions f
      LEFT JOIN action_logs a1 ON a1.user_id = f.user_id AND a1.date_iso = date(f.first_iso, '+1 day')
      LEFT JOIN action_logs a7 ON a7.user_id = f.user_id AND a7.date_iso = date(f.first_iso, '+7 days')
      LEFT JOIN action_logs a30 ON a30.user_id = f.user_id AND a30.date_iso = date(f.first_iso, '+30 days')
      GROUP BY f.first_iso
      ORDER BY f.first_iso
    `;
    const rows = db.prepare(sql).all(...cohortParams);
    const list = rows.map(r => ({
      cohort_date: r.cohort_date,
      cohort_size: r.cohort_size,
      d1_retained: r.d1_retained,
      d7_retained: r.d7_retained,
      d30_retained: r.d30_retained,
      d1_rate: r.cohort_size ? (r.d1_retained / r.cohort_size) : 0,
      d7_rate: r.cohort_size ? (r.d7_retained / r.cohort_size) : 0,
      d30_rate: r.cohort_size ? (r.d30_retained / r.cohort_size) : 0
    }));
    res.json({ retention: list });
  } catch (e) {
    res.status(500).json({ error: e.message || 'retention 失败' });
  }
});

// 行为漏斗：进入(有行动) -> 自由行动 -> 保存 -> 期末/结局
router.get('/funnel', requireAdminAuth, (req, res) => {
  try {
    const db = getDb();
    const { from, to } = parseRange(req);
    const freeActions = ['travel', 'study', 'sleep', 'attend_class_afk', 'idle_block', 'choice', 'random_event'];
    const where = from && to ? ' WHERE date_iso >= ? AND date_iso <= ?' : '';
    const params = from && to ? [from, to] : [];
    const stage1 = db.prepare('SELECT COUNT(DISTINCT user_id) AS c FROM action_logs' + where).get(...params);
    const where2 = (from && to ? ' WHERE date_iso >= ? AND date_iso <= ? AND ' : ' WHERE ') + "action_type IN ('" + freeActions.join("','") + "')";
    const stage2 = db.prepare('SELECT COUNT(DISTINCT user_id) AS c FROM action_logs' + where2).get(...params);
    const stage3Row = db.prepare('SELECT COUNT(DISTINCT user_id) AS c FROM saves').get();
    const stage4Row = db.prepare(
      "SELECT COUNT(DISTINCT user_id) AS c FROM saves WHERE summary_json IS NOT NULL AND (summary_json LIKE '%ending%' OR summary_json LIKE '%atar%')"
    ).get();
    res.json({
      funnel: [
        { stage: '进入(有行动)', count: stage1.c },
        { stage: '自由行动', count: stage2.c },
        { stage: '有过存档', count: stage3Row.c },
        { stage: '有结局/总结', count: stage4Row.c }
      ]
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'funnel 失败' });
  }
});

// 节点流：node_id 访问次数 + 边 (from_node -> to_node) 次数
router.get('/node-flow', requireAdminAuth, (req, res) => {
  try {
    const db = getDb();
    const { from, to } = parseRange(req);
    const where = from && to ? ' WHERE date_iso >= ? AND date_iso <= ? AND node_id IS NOT NULL AND node_id != \'\'' : ' WHERE node_id IS NOT NULL AND node_id != \'\'';
    const params = from && to ? [from, to] : [];
    const nodeRows = db.prepare('SELECT node_id, COUNT(*) AS cnt FROM action_logs' + where + ' GROUP BY node_id').all(...params);
    const orderRows = db.prepare(
      'SELECT user_id, ts, node_id FROM action_logs' + where + ' ORDER BY user_id, ts'
    ).all(...params);
    const edges = {};
    let prev = null;
    for (const r of orderRows) {
      const key = r.user_id + '|' + r.ts;
      if (prev && prev.user_id === r.user_id) {
        const edgeKey = (prev.node_id || '') + '->' + (r.node_id || '');
        edges[edgeKey] = (edges[edgeKey] || 0) + 1;
      }
      prev = r;
    }
    const edgeList = Object.keys(edges).map(k => {
      const [from_node, to_node] = k.split('->');
      return { from: from_node, to: to_node, count: edges[k] };
    });
    res.json({
      nodes: nodeRows.map(r => ({ node_id: r.node_id, count: r.cnt })),
      edges: edgeList
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'node-flow 失败' });
  }
});

// 结局分布：从 saves.summary_json 解析 ending / atar 区间
router.get('/endings', requireAdminAuth, (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT user_id, slot, summary_json FROM saves WHERE summary_json IS NOT NULL').all();
    const buckets = { unknown: 0, good: 0, normal: 0, bad: 0 };
    const atarBuckets = { '0-30': 0, '31-60': 0, '61-80': 0, '81-100': 0 };
    for (const r of rows) {
      try {
        const s = JSON.parse(r.summary_json);
        const atar = s.atar != null ? s.atar : (s.stats && s.stats.atar);
        if (typeof atar === 'number') {
          if (atar <= 30) atarBuckets['0-30']++;
          else if (atar <= 60) atarBuckets['31-60']++;
          else if (atar <= 80) atarBuckets['61-80']++;
          else atarBuckets['81-100']++;
        }
        const ending = s.ending || (atar >= 80 ? 'good' : atar >= 50 ? 'normal' : 'bad');
        if (ending === 'good' || ending === 'best') buckets.good++;
        else if (ending === 'bad' || ending === 'worst') buckets.bad++;
        else if (ending) buckets.normal++;
        else buckets.unknown++;
      } catch (e) {
        buckets.unknown++;
      }
    }
    res.json({
      by_ending: Object.keys(buckets).map(k => ({ ending: k, count: buckets[k] })),
      by_atar: Object.keys(atarBuckets).map(k => ({ range: k, count: atarBuckets[k] }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'endings 失败' });
  }
});

// 劝退点：触发 forced_low_mood/forced_rest 后 3 天内无行动的比例
router.get('/churn-risk', requireAdminAuth, (req, res) => {
  try {
    const db = getDb();
    const { from, to } = parseRange(req);
    let where = " WHERE event_id IN ('forced_low_mood','forced_rest')";
    const params = [];
    if (from && to) {
      where += ' AND date_iso >= ? AND date_iso <= ?';
      params.push(from, to);
    }
    const forced = db.prepare(
      'SELECT user_id, MIN(date_iso) AS event_date FROM event_logs' + where + ' GROUP BY user_id'
    ).all(...params);
    let churned = 0;
    for (const f of forced) {
      const after = db.prepare(
        'SELECT 1 FROM action_logs WHERE user_id = ? AND date_iso > ? AND date_iso <= date(?, \'+3 days\') LIMIT 1'
      ).get(f.user_id, f.event_date, f.event_date);
      if (!after) churned++;
    }
    res.json({
      total_forced: forced.length,
      churned,
      churn_rate: forced.length ? churned / forced.length : 0
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'churn-risk 失败' });
  }
});

// 活跃时间段：按小时、按星期
router.get('/activity', requireAdminAuth, (req, res) => {
  try {
    const db = getDb();
    const { from, to } = parseRange(req);
    const where = from && to ? ' WHERE date_iso >= ? AND date_iso <= ?' : '';
    const params = from && to ? [from, to] : [];
    const byHour = db.prepare(
      "SELECT CAST(strftime('%H', ts) AS INT) AS hour, COUNT(*) AS cnt FROM action_logs" + where + ' GROUP BY hour ORDER BY hour'
    ).all(...params);
    const byDow = db.prepare(
      "SELECT strftime('%w', date_iso) AS dow, COUNT(*) AS cnt FROM action_logs" + where + ' GROUP BY dow ORDER BY dow'
    ).all(...params);
    res.json({
      by_hour: byHour.map(r => ({ hour: r.hour, count: r.cnt })),
      by_dow: byDow.map(r => ({ dow: r.dow, count: r.cnt }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'activity 失败' });
  }
});

// 行为频率热力图：location x action_type
router.get('/heatmap', requireAdminAuth, (req, res) => {
  try {
    const db = getDb();
    const { from, to } = parseRange(req);
    const where = from && to ? ' WHERE date_iso >= ? AND date_iso <= ?' : '';
    const params = from && to ? [from, to] : [];
    const rows = db.prepare(
      'SELECT location, action_type, COUNT(*) AS cnt FROM action_logs' + where + ' GROUP BY location, action_type'
    ).all(...params);
    res.json({ heatmap: rows });
  } catch (e) {
    res.status(500).json({ error: e.message || 'heatmap 失败' });
  }
});

// 事件 Top（event_id 出现次数）
router.get('/events-top', requireAdminAuth, (req, res) => {
  try {
    const db = getDb();
    const { from, to } = parseRange(req);
    const where = from && to ? ' WHERE date_iso >= ? AND date_iso <= ?' : '';
    const params = from && to ? [from, to] : [];
    const rows = db.prepare(
      'SELECT event_id, event_type, COUNT(*) AS cnt FROM event_logs' + where + ' GROUP BY event_id, event_type ORDER BY cnt DESC LIMIT 30'
    ).all(...params);
    res.json({ events: rows });
  } catch (e) {
    res.status(500).json({ error: e.message || 'events-top 失败' });
  }
});

// A/B 组对比：atar 均值、留存、结局分布
router.get('/ab', requireAdminAuth, (req, res) => {
  try {
    const db = getDb();
    const groups = db.prepare('SELECT user_id, group_name FROM ab_groups').all();
    const userToGroup = {};
    groups.forEach(g => { userToGroup[g.user_id] = g.group_name; });
    const byGroup = {};
    function getGroup(name) {
      if (!byGroup[name]) byGroup[name] = { user_ids: [], atar_sum: 0, atar_count: 0, endings: {}, retention_d1: 0, retention_d7: 0, cohort_size: 0 };
      return byGroup[name];
    }
    groups.forEach(g => { getGroup(g.group_name).user_ids.push(g.user_id); });
    const allSaves = db.prepare('SELECT user_id, summary_json FROM saves WHERE summary_json IS NOT NULL').all();
    allSaves.forEach(r => {
      let atar = null, ending = null;
      try {
        const s = JSON.parse(r.summary_json);
        atar = s.atar != null ? s.atar : (s.stats && s.stats.atar);
        ending = s.ending || (atar >= 80 ? 'good' : atar >= 50 ? 'normal' : 'bad');
      } catch (_) {}
      const groupName = userToGroup[r.user_id] || 'none';
      const g = getGroup(groupName);
      if (typeof atar === 'number') { g.atar_sum += atar; g.atar_count++; }
      if (ending) g.endings[ending] = (g.endings[ending] || 0) + 1;
    });
    const firstActions = db.prepare('SELECT user_id, MIN(date_iso) AS first_iso FROM action_logs GROUP BY user_id').all();
    firstActions.forEach(f => {
      const groupName = userToGroup[f.user_id] || 'none';
      const g = getGroup(groupName);
      g.cohort_size++;
      const d1 = db.prepare('SELECT 1 FROM action_logs WHERE user_id = ? AND date_iso = date(?, \'+1 day\') LIMIT 1').get(f.user_id, f.first_iso);
      const d7 = db.prepare('SELECT 1 FROM action_logs WHERE user_id = ? AND date_iso = date(?, \'+7 days\') LIMIT 1').get(f.user_id, f.first_iso);
      if (d1) g.retention_d1++;
      if (d7) g.retention_d7++;
    });
    const out = Object.keys(byGroup).map(name => {
      const g = byGroup[name];
      const size = g.cohort_size || g.user_ids.length || 1;
      return {
        group: name,
        users: g.user_ids.length,
        cohort_size: g.cohort_size,
        atar_mean: g.atar_count ? (g.atar_sum / g.atar_count) : null,
        atar_count: g.atar_count,
        endings: g.endings,
        retention_d1: size ? (g.retention_d1 / size) : 0,
        retention_d7: size ? (g.retention_d7 / size) : 0
      };
    });
    res.json({ by_group: out });
  } catch (e) {
    res.status(500).json({ error: e.message || 'ab 指标失败' });
  }
});

module.exports = router;
