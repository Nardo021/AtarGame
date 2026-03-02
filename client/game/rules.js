/**
 * Rules: Only Math balance system
 * All parameters read from Store.getState().config.balance
 */
(function (global) {
  function getBalance() {
    var cfg = global.Store ? global.Store.getState().config : {};
    return cfg.balance || {};
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function getFactors(stats) {
    var b = getBalance();
    var depressThreshold = b.depressThreshold || 20;
    var sickThreshold = b.sickThreshold || 20;

    return {
      moodFactor: clamp(stats.mood / 100, 0.2, 1.15),
      healthFactor: clamp(stats.health / 100, 0.2, 1.10),
      depressFactor: (stats.mood <= depressThreshold) ? 0.5 : 1.0,
      sickFactor: (stats.health <= sickThreshold) ? 0.7 : 1.0,
      studyMultiplier: (global.Store.getState().mods || {}).studyMultiplier || 1.0
    };
  }

  function computeEffectiveATAR(baseATAR, stats) {
    var f = getFactors(stats);
    return baseATAR * f.moodFactor * f.healthFactor * f.depressFactor * f.sickFactor * f.studyMultiplier;
  }

  function doClass(state) {
    var b = getBalance();
    var f = getFactors(state.stats);
    var baseATAR = b.classATAR || 1.2;

    var atarDelta = baseATAR * f.moodFactor * f.healthFactor * f.depressFactor * f.sickFactor * f.studyMultiplier;
    var healthDelta = b.classHealth || -0.8;
    var moodDelta = b.classMood || -0.6;

    return {
      atar: atarDelta,
      health: healthDelta,
      mood: moodDelta,
      stress: 0,
      counterUpdates: { classSessions: (state.counters.classSessions || 0) + 1, studyStreak: 0 }
    };
  }

  function doStudy(state) {
    var b = getBalance();
    var f = getFactors(state.stats);
    var baseATAR = b.studyATAR || 2.0;

    var atarDelta = baseATAR * f.moodFactor * f.healthFactor * f.depressFactor * f.sickFactor * f.studyMultiplier;
    var healthDelta = b.studyHealth || -2.5;
    var moodDelta = b.studyMood || -2.0;

    var streak = (state.counters.studyStreak || 0) + 1;
    var burnout1 = b.burnoutStreak1 || 3;
    var burnout2 = b.burnoutStreak2 || 5;

    if (streak >= burnout2) {
      healthDelta -= (b.burnoutExtraHealth1 || 1);
      moodDelta -= (b.burnoutExtraMood2 || 2);
    } else if (streak >= burnout1) {
      healthDelta -= (b.burnoutExtraHealth1 || 1);
    }

    return {
      atar: atarDelta,
      health: healthDelta,
      mood: moodDelta,
      stress: 0,
      counterUpdates: { studyStreak: streak }
    };
  }

  function doRest(state) {
    var b = getBalance();
    var f = getFactors(state.stats);
    var moodRecoveryRate = (state.mods || {}).moodRecoveryRate || 1.0;

    var healthDelta = (b.restHealth || 3.0) * f.depressFactor;
    var moodDelta = (b.restMood || 2.0) * f.depressFactor * moodRecoveryRate;

    return {
      atar: 0,
      health: healthDelta,
      mood: moodDelta,
      stress: 0,
      counterUpdates: { studyStreak: 0 }
    };
  }

  function doPlay(state) {
    var b = getBalance();

    return {
      atar: b.playATAR || -1.5,
      health: b.playHealth || 1.0,
      mood: b.playMood || 6.0,
      stress: 0,
      counterUpdates: { studyStreak: 0 }
    };
  }

  function doDailyDecay(state) {
    var b = getBalance();
    var depressThreshold = b.depressThreshold || 20;
    var drain = b.depressDailyHealthDrain || 2;
    var moodRecoveryRate = (state.mods || {}).moodRecoveryRate || 1.0;

    var healthDelta = 0;
    var moodDelta = 0;

    if (state.stats.mood <= depressThreshold) {
      healthDelta = -drain;
    } else {
      moodDelta = 1.0 * moodRecoveryRate;
    }

    return { atar: 0, health: healthDelta, mood: moodDelta, stress: 0 };
  }

  function applyResult(result) {
    Store.dispatch({
      type: 'APPLY_DELTA',
      payload: { atar: result.atar, health: result.health, mood: result.mood, stress: result.stress }
    });
    if (result.counterUpdates) {
      Store.dispatch({ type: 'SET_COUNTER', payload: result.counterUpdates });
    }
  }

  function getEstimate(actionType) {
    var state = Store.getState();
    var result;
    switch (actionType) {
      case 'CLASS': result = doClass(state); break;
      case 'STUDY': result = doStudy(state); break;
      case 'REST': result = doRest(state); break;
      case 'PLAY': result = doPlay(state); break;
      default: return null;
    }
    return { atar: result.atar, health: result.health, mood: result.mood };
  }

  global.Rules = {
    getBalance: getBalance,
    getFactors: getFactors,
    computeEffectiveATAR: computeEffectiveATAR,
    doClass: doClass,
    doStudy: doStudy,
    doRest: doRest,
    doPlay: doPlay,
    doDailyDecay: doDailyDecay,
    applyResult: applyResult,
    getEstimate: getEstimate
  };
})(typeof window !== 'undefined' ? window : global);
