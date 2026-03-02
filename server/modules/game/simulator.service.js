'use strict';

const { getDb } = require('../../core/db');

const DATE_START = '2026-01-01';
const DATE_END = '2026-12-31';
const WEEKDAY_BLOCKS = ['MorningClass', 'Recess', 'MidClass', 'Lunch', 'AfternoonClass', 'AfterSchool', 'Evening'];
const WEEKEND_BLOCKS = ['Morning', 'Afternoon', 'Evening', 'Night'];

function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + n);
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function getDayOfWeek(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function getBlocks(iso) {
  const day = getDayOfWeek(iso);
  return (day === 0 || day === 6) ? WEEKEND_BLOCKS : WEEKDAY_BLOCKS;
}

function nextBlock(iso, block) {
  const blocks = getBlocks(iso);
  const i = blocks.indexOf(block);
  if (i >= 0 && i < blocks.length - 1) return { date_iso: iso, time_block: blocks[i + 1] };
  return { date_iso: addDays(iso, 1), time_block: getBlocks(addDays(iso, 1))[0] };
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, typeof x === 'number' ? x : 50));
}

const STRATEGIES = {
  study: { weightClass: 1, weightSocial: 0, weightRest: 0.2 },
  social: { weightClass: 0.5, weightSocial: 1, weightRest: 0.3 },
  mixed: { weightClass: 0.7, weightSocial: 0.6, weightRest: 0.4 },
  random: { weightClass: 0.5, weightSocial: 0.5, weightRest: 0.5 }
};

function runOnePlayer(seed, strategyKey) {
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const strategy = STRATEGIES[strategyKey] || STRATEGIES.random;
  let date_iso = DATE_START;
  let time_block = getBlocks(date_iso)[0];
  let location = 'classroom';
  const state = { atar: 50, mood: 70, health: 80, stress: 20, fatigue: 0, logic: 50, social: 50, stamina: 50 };
  let forcedCount = 0;
  const isClass = () => ['MorningClass', 'MidClass', 'AfternoonClass'].includes(time_block);
  const isSchool = () => ['classroom', 'corridor', 'field', 'clubroom'].includes(location);

  while (date_iso <= DATE_END) {
    if (state.health < 20) { forcedCount++; state.health = Math.min(80, state.health + 10); }
    if (state.mood < 20) { forcedCount++; state.mood = Math.min(70, state.mood + 10); }
    if (state.stress > 80) { forcedCount++; state.stress = Math.max(40, state.stress - 15); }
    if (isClass() && isSchool()) {
      state.atar = clamp(state.atar + (state.fatigue >= 70 ? 1 : state.fatigue >= 40 ? 1.5 : 2), 0, 100);
      state.mood = clamp(state.mood - 1, 0, 100);
      state.stress = clamp(state.stress + 1, 0, 100);
      state.fatigue = clamp(state.fatigue + 8, 0, 100);
    } else {
      const roll = rnd();
      if (roll < 0.4 * strategy.weightClass) {
        state.atar = clamp(state.atar + 2, 0, 100); state.stress = clamp(state.stress + 1, 0, 100); state.fatigue = clamp(state.fatigue + 3, 0, 100);
      } else if (roll < 0.4 * strategy.weightClass + 0.4 * strategy.weightSocial) {
        state.mood = clamp(state.mood + 2, 0, 100); state.social = clamp(state.social + 0.5, 0, 100);
      } else if (roll < 0.4 * strategy.weightClass + 0.4 * strategy.weightSocial + 0.3 * strategy.weightRest) {
        state.fatigue = clamp(state.fatigue - 15, 0, 100); state.health = clamp(state.health + 2, 0, 100);
      }
    }
    if (date_iso !== nextBlock(date_iso, time_block).date_iso) {
      state.mood = clamp(state.mood - 2, 0, 100); state.health = clamp(state.health - 1, 0, 100);
      state.stress = clamp(state.stress + 1, 0, 100); state.fatigue = clamp(state.fatigue - 8, 0, 100);
    }
    const next = nextBlock(date_iso, time_block);
    date_iso = next.date_iso; time_block = next.time_block;
    if (rnd() < 0.15) location = ['classroom', 'corridor', 'field', 'clubroom', 'home', 'internet_cafe'][Math.floor(rnd() * 6)];
  }
  let ending = 'normal';
  if (state.stress >= 90 || state.health < 30) ending = 'bad';
  else if (state.atar >= 85 && state.stress < 60) ending = 'good';
  else if (state.atar >= 70) ending = 'good';
  return { ...state, ending, forcedCount };
}

function runSimulation(params) {
  const n = Math.min(Math.max(1, parseInt(params.n, 10) || 1000), 10000);
  const strategyMix = params.strategyMix || { study: 0.25, social: 0.25, mixed: 0.25, random: 0.25 };
  const seedBase = parseInt(params.seed, 10) || Date.now();
  const strategies = ['study', 'social', 'mixed', 'random'];
  const atarBuckets = { '0-30': 0, '31-50': 0, '51-70': 0, '71-85': 0, '86-100': 0 };
  const endingCounts = { good: 0, normal: 0, bad: 0 };
  let totalStress = 0, totalForced = 0;
  for (let i = 0; i < n; i++) {
    const r = (seedBase + i * 7919) % 2147483647;
    const which = strategies[Math.floor(((r % 10000) / 10000) * strategies.length)];
    const out = runOnePlayer(r, which);
    totalStress += out.stress; totalForced += out.forcedCount;
    const atar = out.atar;
    if (atar <= 30) atarBuckets['0-30']++; else if (atar <= 50) atarBuckets['31-50']++;
    else if (atar <= 70) atarBuckets['51-70']++; else if (atar <= 85) atarBuckets['71-85']++;
    else atarBuckets['86-100']++;
    endingCounts[out.ending] = (endingCounts[out.ending] || 0) + 1;
  }
  return { n, strategyMix, seed: seedBase, atar_distribution: atarBuckets, ending_distribution: endingCounts, avg_stress: totalStress / n, total_forced_events: totalForced, avg_forced_per_player: totalForced / n };
}

function saveRun(params, result) {
  getDb().prepare('INSERT INTO simulation_runs (params_json, result_json) VALUES (?, ?)').run(JSON.stringify(params), JSON.stringify(result));
}

function listRuns(limit) {
  return getDb().prepare('SELECT id, ts, params_json, result_json FROM simulation_runs ORDER BY id DESC LIMIT ?').all(limit);
}

module.exports = { runSimulation, saveRun, listRuns };
