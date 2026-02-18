/**
 * 模拟 1000 玩家跑平衡测试：随机/贪心策略，生成 atar 分布、结局分布、平均压力等统计
 */
const { getDb } = require('./db');

const TIME_BLOCKS = ['Morning', 'Lunch', 'Afternoon', 'Evening', 'Night'];
const LOCATIONS = ['home', 'school', 'internet_cafe'];
const TRAVEL_COST = { 'home-school': 1, 'school-internet_cafe': 1, 'home-internet_cafe': 2 };

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

function nextBlock(dateIso, timeBlock) {
  const i = TIME_BLOCKS.indexOf(timeBlock);
  if (i < 0) return { date_iso: dateIso, time_block: 'Morning' };
  if (i < TIME_BLOCKS.length - 1) return { date_iso: dateIso, time_block: TIME_BLOCKS[i + 1] };
  const d = parseDate(dateIso);
  const next = new Date(d.y, d.m - 1, d.d + 1);
  const nextStr = next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0') + '-' + String(next.getDate()).padStart(2, '0');
  return { date_iso: nextStr, time_block: 'Morning' };
}

function runOneSimulation(strategy, maxDays = 365) {
  const state = {
    date_iso: '2026-01-01',
    time_block: 'Morning',
    location: 'school',
    atar: 50,
    mood: 70,
    health: 80,
    stress: 20,
    reputation: 50,
    dayCount: 0
  };

  for (let day = 0; day < maxDays; day++) {
    for (const block of TIME_BLOCKS) {
      state.time_block = block;
      if (state.location === 'school' && (block === 'Morning' || block === 'Afternoon')) {
        state.atar = clamp(state.atar + 2, 0, 100);
        state.mood = clamp(state.mood - 1, 0, 100);
        state.stress = clamp(state.stress + 1, 0, 100);
      }
    }
    state.date_iso = (() => {
      const d = parseDate(state.date_iso);
      const next = new Date(d.y, d.m - 1, d.d + 1);
      return next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0') + '-' + String(next.getDate()).padStart(2, '0');
    })();
    state.mood = clamp(state.mood - 2, 0, 100);
    state.health = clamp(state.health - 1, 0, 100);
    state.stress = clamp(state.stress + 1, 0, 100);
    state.dayCount = day + 1;

    if (strategy === 'random') {
      const loc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
      if (loc !== state.location) state.location = loc;
    } else if (strategy === 'grind') {
      state.location = 'school';
      state.atar = clamp(state.atar + 1, 0, 100);
    }
  }

  const ending = state.atar >= 80 ? 'Good' : state.atar >= 50 ? 'Normal' : 'Bad';
  return {
    atar: state.atar,
    mood: state.mood,
    health: state.health,
    stress: state.stress,
    reputation: state.reputation,
    ending,
    dayCount: state.dayCount
  };
}

function runSimulation(n = 1000, strategy = 'random') {
  const results = [];
  for (let i = 0; i < n; i++) {
    results.push(runOneSimulation(strategy));
  }
  const atarSum = results.reduce((a, r) => a + r.atar, 0);
  const stressSum = results.reduce((a, r) => a + r.stress, 0);
  const endings = { Good: 0, Normal: 0, Bad: 0 };
  results.forEach(r => { endings[r.ending] = (endings[r.ending] || 0) + 1; });
  const atarBuckets = { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 };
  results.forEach(r => {
    if (r.atar <= 20) atarBuckets['0-20']++;
    else if (r.atar <= 40) atarBuckets['21-40']++;
    else if (r.atar <= 60) atarBuckets['41-60']++;
    else if (r.atar <= 80) atarBuckets['61-80']++;
    else atarBuckets['81-100']++;
  });
  return {
    total: n,
    strategy,
    avgAtar: atarSum / n,
    avgStress: stressSum / n,
    endings,
    atarDistribution: atarBuckets,
    sample: results.slice(0, 5)
  };
}

module.exports = { runSimulation, runOneSimulation };
