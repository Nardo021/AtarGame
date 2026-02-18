const express = require('express');
const router = express.Router();
const { getDb } = require('./db');
const { runSimulation } = require('./simulator');
const storyStore = require('./storyStore');

// 留存：D1/D7/D30（用 action_logs 推算：有记录即算活跃）
router.get('/retention', (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, created_at FROM users WHERE role = ?').all('user');
  const firstAction = db.prepare('SELECT user_id, date(ts) as d FROM action_logs GROUP BY user_id HAVING d = min(date(ts))').all();
  const firstMap = {};
  firstAction.forEach(r => { firstMap[r.user_id] = r.d; });
  let d1 = 0, d7 = 0, d30 = 0, total = users.length;
  users.forEach(u => {
    const reg = (u.created_at || '').split('T')[0];
    const first = firstMap[u.id] || reg;
    const actions = db.prepare('SELECT date(ts) as d FROM action_logs WHERE user_id = ?').all(u.id);
    const days = [...new Set(actions.map(a => a.d))];
    const day1 = days.some(d => d === first);
    const day7 = days.filter(d => d >= first && d <= addDays(first, 6)).length >= 2;
    const day30 = days.filter(d => d >= first && d <= addDays(first, 29)).length >= 2;
    if (day1) d1++;
    if (day7) d7++;
    if (day30) d30++;
  });
  res.json({
    total_users: total,
    retention: {
      D1: total ? (d1 / total * 100).toFixed(2) + '%' : '0%',
      D7: total ? (d7 / total * 100).toFixed(2) + '%' : '0%',
      D30: total ? (d30 / total * 100).toFixed(2) + '%' : '0%'
    }
  });
});

function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + n);
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

// 行为漏斗：关键行动转化
router.get('/funnel', (req, res) => {
  const db = getDb();
  const types = db.prepare('SELECT action_type, count(*) as c FROM action_logs GROUP BY action_type').all();
  const total = db.prepare('SELECT count(DISTINCT user_id) as c FROM action_logs').get().c;
  res.json({ total_users_with_actions: total, by_action_type: types });
});

// 事件 Top / 死亡率
router.get('/events-top', (req, res) => {
  const db = getDb();
  const top = db.prepare('SELECT event_id, event_type, count(*) as c FROM event_logs GROUP BY event_id, event_type ORDER BY c DESC LIMIT 50').all();
  const forced = db.prepare('SELECT event_id, count(*) as c FROM event_logs WHERE event_type = ? GROUP BY event_id').all('forced');
  res.json({ top_events: top, forced_events: forced });
});

// 结局分布
router.get('/endings', (req, res) => {
  const db = getDb();
  const saves = db.prepare('SELECT state_json FROM saves').all();
  const endings = { Good: 0, Normal: 0, Bad: 0, unknown: 0 };
  saves.forEach(s => {
    try {
      const st = JSON.parse(s.state_json);
      const end = st.ending || (st.atar >= 80 ? 'Good' : st.atar >= 50 ? 'Normal' : 'Bad');
      endings[end] = (endings[end] || 0) + 1;
    } catch {
      endings.unknown++;
    }
  });
  res.json({ endings });
});

// 时间段活跃
router.get('/activity', (req, res) => {
  const db = getDb();
  const byHour = db.prepare("SELECT strftime('%H', ts) as h, count(*) as c FROM action_logs GROUP BY h ORDER BY h").all();
  const byDate = db.prepare("SELECT date(ts) as d, count(*) as c FROM action_logs GROUP BY d ORDER BY d DESC LIMIT 90").all();
  res.json({ by_hour: byHour, by_date: byDate });
});

// 节点流（简化：node_id 出现次数与流向）
router.get('/node-flow', (req, res) => {
  const db = getDb();
  const nodes = db.prepare('SELECT node_id, action_type, count(*) as c FROM action_logs WHERE node_id IS NOT NULL AND node_id != "" GROUP BY node_id, action_type').all();
  res.json({ node_flow: nodes });
});

// 模拟 1000 玩家
router.get('/simulate', (req, res) => {
  const n = Math.min(parseInt(req.query.n, 10) || 1000, 5000);
  const strategy = req.query.strategy || 'random';
  const report = runSimulation(n, strategy);
  res.json(report);
});

module.exports = router;
