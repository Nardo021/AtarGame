/**
 * 统一结算：核心数值 + 个人属性(logic/social/stamina) + 疲劳(fatigue)
 * 所有参数从 __CONFIG__.rules 读取，供 admin 调参/AB test；缺省用默认值
 */
(function (global) {
  var STAT_KEYS = ['atar', 'mood', 'health', 'stress', 'reputation', 'logic', 'social', 'stamina', 'fatigue'];

  var DEFAULT_RULES = {
    dailyDecay: {
      mood: -2,
      health: -1,
      stress: 1,
      fatigueRecoverBase: 10,
      fatigueRecoverStaminaPer10: 1,
      fatigueRecoverMin: 5,
      fatigueRecoverMax: 20
    },
    fatigue: {
      thresholdHigh: 70,
      atarMultiplierHigh: 0.6,
      moodLossMultiplierHigh: 1.3,
      thresholdMid: 40,
      atarMultiplierMid: 0.85
    },
    attendClassAfk: {
      atarBase: 2,
      moodBase: -1,
      stressBase: 1,
      fatigueGain: 10,
      healthHurtChance: 0.2,
      healthHurt: -1
    },
    study: {
      atarBase: 3,
      moodBase: -1,
      stressBase: 2
    },
    sleepRecovery: {
      fatigueDownBase: 25,
      fatigueDownStaminaPer5: 1,
      fatigueDownMin: 20,
      fatigueDownMax: 40,
      healthUpBase: 5,
      healthUpStaminaPer10: 1,
      moodUpBase: 2,
      moodUpStaminaPer20: 1,
      stressDown: -3
    },
    travel: {
      'home-school': 1,
      'school-home': 1,
      'school-internet_cafe': 1,
      'internet_cafe-school': 1,
      'home-internet_cafe': 2,
      'internet_cafe-home': 2,
      defaultBlocks: 1
    },
    quizSuccessChance: {
      min: 0.3,
      max: 0.95
    },
    socialGain: {
      minMultiplier: 0.5,
      maxMultiplier: 1.5
    }
  };

  function getConfig() {
    var c = (global.__CONFIG__ && global.__CONFIG__.rules) || {};
    function merge(def, over) {
      if (!over || typeof over !== 'object') return def;
      var out = {};
      for (var k in def) {
        if (Object.prototype.hasOwnProperty.call(def, k)) {
          if (typeof def[k] === 'object' && def[k] !== null && !Array.isArray(def[k]) && typeof over[k] === 'object' && over[k] !== null) {
            out[k] = merge(def[k], over[k]);
          } else {
            out[k] = over[k] !== undefined ? over[k] : def[k];
          }
        }
      }
      return out;
    }
    return {
      dailyDecay: merge(DEFAULT_RULES.dailyDecay, c.dailyDecay),
      fatigue: merge(DEFAULT_RULES.fatigue, c.fatigue),
      attendClassAfk: merge(DEFAULT_RULES.attendClassAfk, c.attendClassAfk),
      study: merge(DEFAULT_RULES.study, c.study),
      sleepRecovery: merge(DEFAULT_RULES.sleepRecovery, c.sleepRecovery),
      travel: Object.assign({}, DEFAULT_RULES.travel, c.travel),
      quizSuccessChance: merge(DEFAULT_RULES.quizSuccessChance, c.quizSuccessChance),
      socialGain: merge(DEFAULT_RULES.socialGain, c.socialGain)
    };
  }

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
    var cfg = getConfig().fatigue;
    var f = typeof state.fatigue === 'number' ? state.fatigue : 0;
    if (f >= cfg.thresholdHigh) return { atar: cfg.atarMultiplierHigh, moodLoss: cfg.moodLossMultiplierHigh };
    if (f >= cfg.thresholdMid) return { atar: cfg.atarMultiplierMid, moodLoss: 1 };
    return { atar: 1, moodLoss: 1 };
  }

  /** 跨天自然变化：mood -2, health -1, stress +1, fatigue 恢复（stamina 越高恢复越多） */
  function dailyDecay(state) {
    var cfg = getConfig().dailyDecay;
    var s = Object.assign({}, state);
    var stamina = typeof s.stamina === 'number' ? s.stamina : 50;
    var fatigueRecover = cfg.fatigueRecoverBase + Math.floor((stamina - 50) / 10) * (cfg.fatigueRecoverStaminaPer10 || 1);
    fatigueRecover = Math.max(cfg.fatigueRecoverMin, Math.min(cfg.fatigueRecoverMax, fatigueRecover));
    s = applyDelta(s, { mood: cfg.mood, health: cfg.health, stress: cfg.stress, fatigue: -fatigueRecover });
    return s;
  }

  /** 上课挂机：基础 atar +2, mood -1, stress +1, health 随机 -1, fatigue +10；再乘疲劳系数 */
  function attendClassAfk(state) {
    var cfg = getConfig().attendClassAfk;
    var mul = fatigueStudyMultiplier(state);
    var atarDelta = Math.round((cfg.atarBase || 2) * mul.atar);
    var moodDelta = Math.round((cfg.moodBase || -1) * mul.moodLoss);
    var healthDelta = Math.random() < (cfg.healthHurtChance || 0.2) ? (cfg.healthHurt || -1) : 0;
    return applyDelta(state, {
      atar: atarDelta,
      mood: moodDelta,
      stress: cfg.stressBase || 1,
      health: healthDelta,
      fatigue: cfg.fatigueGain || 10
    });
  }

  /** 自习等学习行为：受疲劳修正 */
  function study(state) {
    var cfg = getConfig().study;
    var mul = fatigueStudyMultiplier(state);
    return applyDelta(state, {
      atar: Math.round((cfg.atarBase || 3) * mul.atar),
      mood: Math.round((cfg.moodBase || -1) * mul.moodLoss),
      stress: cfg.stressBase || 2
    });
  }

  /** 睡觉/休息：降疲劳、恢复 health/mood，受 stamina 影响 */
  function sleepRecovery(state) {
    var cfg = getConfig().sleepRecovery;
    var stamina = typeof state.stamina === 'number' ? state.stamina : 50;
    var fatigueDown = (cfg.fatigueDownBase || 25) + Math.floor((stamina - 50) / 5) * (cfg.fatigueDownStaminaPer5 || 1);
    fatigueDown = Math.max(cfg.fatigueDownMin || 20, Math.min(cfg.fatigueDownMax || 40, fatigueDown));
    var healthUp = (cfg.healthUpBase || 5) + Math.floor((stamina - 50) / 10) * (cfg.healthUpStaminaPer10 || 1);
    var moodUp = (cfg.moodUpBase || 2) + Math.floor((stamina - 50) / 20) * (cfg.moodUpStaminaPer20 || 1);
    return applyDelta(state, { health: healthUp, mood: moodUp, stress: cfg.stressDown || -3, fatigue: -fatigueDown });
  }

  /** 移动：返回 { delta, blocksConsumed }；通勤消耗时段 */
  function travel(fromZone, toZone) {
    var cfg = getConfig().travel;
    var key = fromZone + '-' + toZone;
    var blocks = cfg[key] != null ? cfg[key] : (cfg.defaultBlocks != null ? cfg.defaultBlocks : 1);
    return { delta: {}, blocksConsumed: blocks };
  }

  /** logic 决定抽查/解题成功率：0-100 映射到约 30%-95% */
  function quizSuccessChance(state) {
    var cfg = getConfig().quizSuccessChance;
    var logic = typeof state.logic === 'number' ? state.logic : 50;
    var t = logic / 100;
    return (cfg.min || 0.3) + t * ((cfg.max || 0.95) - (cfg.min || 0.3));
  }

  /** social 影响社交收益倍率：0-100 映射到 0.5-1.5 */
  function socialGainMultiplier(state) {
    var cfg = getConfig().socialGain;
    var social = typeof state.social === 'number' ? state.social : 50;
    var t = social / 100;
    return (cfg.minMultiplier || 0.5) + t * ((cfg.maxMultiplier || 1.5) - (cfg.minMultiplier || 0.5));
  }

  /** 结算一次社交类选择的 delta（先算原始 delta，再乘 social 倍率） */
  function applySocialDelta(state, rawDelta) {
    if (!rawDelta) return state;
    var mul = socialGainMultiplier(state);
    var scaled = {};
    STAT_KEYS.forEach(function (k) {
      if (typeof rawDelta[k] === 'number') {
        scaled[k] = Math.round(rawDelta[k] * mul);
      }
    });
    return applyDelta(state, scaled);
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
        newState = study(newState);
        break;
      case 'travel':
        delta = options.delta || {};
        break;
      case 'sleep':
        newState = sleepRecovery(newState);
        break;
      case 'choice':
      case 'random_event':
        if (options.choiceDelta) {
          if (options.socialGain) {
            newState = applySocialDelta(newState, options.choiceDelta);
          } else {
            newState = applyDelta(newState, options.choiceDelta);
          }
        }
        if (options.customDelta) newState = applyDelta(newState, options.customDelta);
        break;
      default:
        if (options.customDelta) newState = applyDelta(newState, options.customDelta);
    }
    return { state: newState, delta: delta };
  }

  var TRAVEL_COST = DEFAULT_RULES.travel;

  global.RULES = {
    STAT_KEYS: STAT_KEYS,
    TRAVEL_COST: TRAVEL_COST,
    DEFAULT_RULES: DEFAULT_RULES,
    getConfig: getConfig,
    clamp: clamp,
    applyDelta: applyDelta,
    dailyDecay: dailyDecay,
    attendClassAfk: attendClassAfk,
    study: study,
    sleepRecovery: sleepRecovery,
    travel: travel,
    fatigueStudyMultiplier: fatigueStudyMultiplier,
    quizSuccessChance: quizSuccessChance,
    socialGainMultiplier: socialGainMultiplier,
    applySocialDelta: applySocialDelta,
    resolveAction: resolveAction
  };
})(typeof window !== 'undefined' ? window : global);
