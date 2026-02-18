/**
 * 统一结算：核心数值 + 个人属性(logic/social/stamina) + 疲劳(fatigue)，剧情层不写死
 */
(function (global) {
  var STAT_KEYS = ['atar', 'mood', 'health', 'stress', 'reputation', 'logic', 'social', 'stamina', 'fatigue'];
  var TRAVEL_COST = {
    'home-school': 1,
    'school-home': 1,
    'school-internet_cafe': 1,
    'internet_cafe-school': 1,
    'home-internet_cafe': 2,
    'internet_cafe-home': 2
  };

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, typeof v === 'number' ? v : 0));
  }

  function applyDelta(state, delta) {
    if (!delta) return state;
    var s = Object.assign({}, state);
    STAT_KEYS.forEach(function (k) {
      if (typeof delta[k] === 'number') {
        s[k] = clamp((s[k] ?? (k === 'fatigue' ? 0 : 50)) + delta[k], 0, 100);
      }
    });
    return s;
  }

  /** 学习类收益受疲劳修正：fatigue>=70 时 atar*0.6、mood 损耗*1.3；fatigue>=40 时 atar*0.85 */
  function fatigueStudyMultiplier(state) {
    var f = typeof state.fatigue === 'number' ? state.fatigue : 0;
    if (f >= 70) return { atar: 0.6, moodLoss: 1.3 };
    if (f >= 40) return { atar: 0.85, moodLoss: 1 };
    return { atar: 1, moodLoss: 1 };
  }

  /** 跨天自然变化：mood -2, health -1, stress +1, fatigue -10（stamina 越高恢复越多） */
  function dailyDecay(state) {
    var s = Object.assign({}, state);
    var stamina = typeof s.stamina === 'number' ? s.stamina : 50;
    var fatigueRecover = 10 + Math.floor((stamina - 50) / 10);
    fatigueRecover = Math.max(5, Math.min(20, fatigueRecover));
    s = applyDelta(s, { mood: -2, health: -1, stress: 1, fatigue: -fatigueRecover });
    return s;
  }

  /** 上课挂机：基础 atar +2, mood -1, stress +1, health 0/-1, fatigue +10；再乘疲劳系数 */
  function attendClassAfk(state) {
    var mul = fatigueStudyMultiplier(state);
    var atarDelta = Math.round(2 * mul.atar);
    var moodDelta = Math.round(-1 * mul.moodLoss);
    var healthDelta = Math.random() < 0.2 ? -1 : 0;
    var s = applyDelta(state, { atar: atarDelta, mood: moodDelta, stress: 1, health: healthDelta, fatigue: 10 });
    return s;
  }

  /** 睡觉/休息：降疲劳、恢复 health/mood，受 stamina 影响 */
  function sleepRecovery(state) {
    var stamina = typeof state.stamina === 'number' ? state.stamina : 50;
    var fatigueDown = 25 + Math.floor((stamina - 50) / 5);
    fatigueDown = Math.max(20, Math.min(40, fatigueDown));
    var healthUp = 5 + Math.floor((stamina - 50) / 10);
    var moodUp = 2 + Math.floor((stamina - 50) / 20);
    return applyDelta(state, { health: healthUp, mood: moodUp, stress: -3, fatigue: -fatigueDown });
  }

  /** 移动：返回 { delta, blocksConsumed } */
  function travel(from, to) {
    var key = from + '-' + to;
    var blocks = TRAVEL_COST[key] != null ? TRAVEL_COST[key] : 1;
    return { delta: {}, blocksConsumed: blocks };
  }

  /**
   * logic 决定抽查/解题成功率：0-100 映射到约 30%-95%
   */
  function quizSuccessChance(state) {
    var logic = typeof state.logic === 'number' ? state.logic : 50;
    return 0.3 + (logic / 100) * 0.65;
  }

  /**
   * 结算一次行动
   */
  function resolveAction(actionType, state, options) {
    options = options || {};
    var newState = Object.assign({}, state);
    var delta = {};
    switch (actionType) {
      case 'attend_class_afk':
        newState = attendClassAfk(newState);
        break;
      case 'study':
        var mul = fatigueStudyMultiplier(newState);
        newState = applyDelta(newState, {
          atar: Math.round(3 * mul.atar),
          mood: Math.round(-1 * mul.moodLoss),
          stress: 2
        });
        break;
      case 'travel':
        delta = options.delta || {};
        break;
      case 'sleep':
        newState = sleepRecovery(newState);
        break;
      case 'choice':
      case 'random_event':
        if (options.choiceDelta) newState = applyDelta(newState, options.choiceDelta);
        if (options.customDelta) newState = applyDelta(newState, options.customDelta);
        break;
      default:
        if (options.customDelta) newState = applyDelta(newState, options.customDelta);
    }
    return { state: newState, delta: delta };
  }

  global.RULES = {
    STAT_KEYS: STAT_KEYS,
    TRAVEL_COST: TRAVEL_COST,
    clamp: clamp,
    applyDelta: applyDelta,
    dailyDecay: dailyDecay,
    attendClassAfk: attendClassAfk,
    sleepRecovery: sleepRecovery,
    travel: travel,
    fatigueStudyMultiplier: fatigueStudyMultiplier,
    quizSuccessChance: quizSuccessChance,
    resolveAction: resolveAction
  };
})(typeof window !== 'undefined' ? window : global);
