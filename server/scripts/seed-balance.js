'use strict';

const { init, getDb } = require('../core/db');

const BALANCE_CONFIG = {
  studyMultiplier: 1.0,
  classATAR: 1.2,
  classHealth: -0.8,
  classMood: -0.6,
  studyATAR: 2.0,
  studyHealth: -2.5,
  studyMood: -2.0,
  restHealth: 3.0,
  restMood: 2.0,
  playATAR: -1.5,
  playHealth: 1.0,
  playMood: 6.0,
  sickThreshold: 20,
  depressThreshold: 20,
  depressDailyHealthDrain: 2,
  burnoutStreak1: 3,
  burnoutStreak2: 5,
  burnoutExtraHealth1: 1,
  burnoutExtraMood2: 2,
  finalExamRandomMin: -3,
  finalExamRandomMax: 3
};

async function seed() {
  await init();
  const db = getDb();

  const valueJson = JSON.stringify(BALANCE_CONFIG);

  // Remove any existing row with ab_group = 'default' (old format)
  try {
    db.prepare("DELETE FROM game_configs WHERE key = ? AND ab_group = 'default'").run('balance');
  } catch (e) {}

  const existing = db.prepare(
    "SELECT id FROM game_configs WHERE key = ?"
  ).get('balance');

  if (existing) {
    db.prepare(
      "UPDATE game_configs SET value_json = ?, ab_group = NULL WHERE key = ?"
    ).run(valueJson, 'balance');
    console.log('Updated existing balance config');
  } else {
    db.prepare(
      "INSERT INTO game_configs (key, value_json) VALUES (?, ?)"
    ).run('balance', valueJson);
    console.log('Inserted new balance config');
  }

  console.log('Balance config seeded:', JSON.stringify(BALANCE_CONFIG, null, 2));
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
