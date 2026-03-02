/**
 * Store: Only Math VN — single source of truth
 * snapshotVersion = 2 (new VN format)
 */
(function (global) {
  var SNAPSHOT_VERSION = 2;
  var STAT_KEYS = ['atar', 'mood', 'health', 'stress'];

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, typeof v === 'number' ? v : 0));
  }

  function clampStats(s) {
    var out = {};
    for (var k in s) {
      if (Object.prototype.hasOwnProperty.call(s, k)) {
        out[k] = STAT_KEYS.indexOf(k) >= 0 ? clamp(s[k], 0, 100) : s[k];
      }
    }
    return out;
  }

  function deepMerge(target, patch) {
    if (!patch || typeof patch !== 'object') return target;
    var out = {};
    for (var k in target) {
      if (Object.prototype.hasOwnProperty.call(target, k)) {
        if (typeof target[k] === 'object' && target[k] !== null && !Array.isArray(target[k]) &&
            typeof patch[k] === 'object' && patch[k] !== null && !Array.isArray(patch[k])) {
          out[k] = deepMerge(target[k], patch[k]);
        } else {
          out[k] = patch[k] !== undefined ? patch[k] : target[k];
        }
      }
    }
    for (var j in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, j) && !Object.prototype.hasOwnProperty.call(out, j)) {
        out[j] = patch[j];
      }
    }
    return out;
  }

  function getInitialState() {
    return {
      user: null,
      runtime: {
        screen: 'MENU',
        sceneId: 'CLASSROOM',
        transitioning: false,
        lockInput: false
      },
      time: {
        dateISO: '2026-01-01',
        slotId: 'CLASS_AM',
        isWeekend: false
      },
      stats: { atar: 50, mood: 70, health: 80, stress: 20 },
      mods: { studyMultiplier: 1.0, moodRecoveryRate: 1.0 },
      counters: { classSessions: 0, studyStreak: 0, totalStudy: 0, totalRest: 0, totalPlay: 0, totalClass: 0 },
      flags: {},
      tmp: {},
      config: {},
      settings: {
        bgmVolume: 0.5,
        sfxVolume: 0.7,
        textSpeed: 40,
        language: 'zh'
      },
      meta: {
        saveSlot: 0,
        snapshotVersion: SNAPSHOT_VERSION
      }
    };
  }

  var state = getInitialState();
  var listeners = [];

  function reduce(st, action) {
    var type = action.type;
    var p = action.payload;
    switch (type) {
      case 'SET_USER':
        return deepMerge(st, { user: p });
      case 'SET_CONFIG':
        return deepMerge(st, { config: p });
      case 'SET_SCREEN':
        return deepMerge(st, { runtime: { screen: p } });
      case 'SET_SCENE':
        return deepMerge(st, { runtime: { sceneId: p } });
      case 'SET_LOCK_INPUT':
        return deepMerge(st, { runtime: { lockInput: !!p } });
      case 'SET_TRANSITIONING':
        return deepMerge(st, { runtime: { transitioning: !!p } });
      case 'SET_TIME':
        return deepMerge(st, { time: p });
      case 'UPDATE_STATS':
        return deepMerge(st, { stats: clampStats(deepMerge(st.stats, p)) });
      case 'SET_STATS':
        return deepMerge(st, { stats: clampStats(p) });
      case 'SET_FLAG':
        var nf = {};
        for (var fk in st.flags) { if (Object.prototype.hasOwnProperty.call(st.flags, fk)) nf[fk] = st.flags[fk]; }
        if (p && typeof p === 'object') { for (var pk in p) { if (Object.prototype.hasOwnProperty.call(p, pk)) nf[pk] = p[pk]; } }
        return deepMerge(st, { flags: nf });
      case 'SET_COUNTER':
        var nc = {};
        for (var ck in st.counters) { if (Object.prototype.hasOwnProperty.call(st.counters, ck)) nc[ck] = st.counters[ck]; }
        if (p && typeof p === 'object') { for (var cpk in p) { if (Object.prototype.hasOwnProperty.call(p, cpk)) nc[cpk] = p[cpk]; } }
        return deepMerge(st, { counters: nc });
      case 'SET_TMP':
        var nt = {};
        for (var tk in st.tmp) { if (Object.prototype.hasOwnProperty.call(st.tmp, tk)) nt[tk] = st.tmp[tk]; }
        if (p && typeof p === 'object') { for (var tpk in p) { if (Object.prototype.hasOwnProperty.call(p, tpk)) nt[tpk] = p[tpk]; } }
        return deepMerge(st, { tmp: nt });
      case 'SET_MODS':
        return deepMerge(st, { mods: p });
      case 'SET_SETTINGS':
        return deepMerge(st, { settings: p });
      case 'SET_META':
        return deepMerge(st, { meta: p });
      case 'APPLY_DELTA':
        var merged = {};
        STAT_KEYS.forEach(function (k) {
          merged[k] = (st.stats[k] || 0) + (p[k] || 0);
        });
        return deepMerge(st, { stats: clampStats(merged) });
      case 'RESTORE_SNAPSHOT':
        return restoreFromSnapshot(p, st.config);
      case 'RESET':
        var fresh = getInitialState();
        fresh.config = st.config;
        fresh.settings = st.settings;
        fresh.user = st.user;
        return fresh;
      default:
        return st;
    }
  }

  function restoreFromSnapshot(snap, currentConfig) {
    if (!snap) return state;
    var version = (snap.meta && snap.meta.snapshotVersion) || snap.snapshotVersion || 0;
    var ns = getInitialState();
    ns.config = currentConfig || state.config;
    ns.user = state.user;
    ns.settings = state.settings || ns.settings;

    if (version >= 2) {
      ns.stats = clampStats(snap.stats || ns.stats);
      ns.time = snap.time || ns.time;
      ns.flags = snap.flags || {};
      ns.counters = snap.counters || ns.counters;
      ns.mods = snap.mods || ns.mods;
      ns.meta = deepMerge(ns.meta, snap.meta || {});
      ns.runtime = deepMerge(ns.runtime, { sceneId: (snap.runtime && snap.runtime.sceneId) || 'CLASSROOM' });
    } else if (version >= 1) {
      ns.stats = clampStats(snap.stats || ns.stats);
      ns.time = snap.time || ns.time;
      ns.flags = snap.flags || {};
      if (snap.meta) ns.meta = deepMerge(ns.meta, snap.meta);
    } else {
      if (snap.atar !== undefined) ns.stats.atar = clamp(snap.atar, 0, 100);
      if (snap.mood !== undefined) ns.stats.mood = clamp(snap.mood, 0, 100);
      if (snap.health !== undefined) ns.stats.health = clamp(snap.health, 0, 100);
      if (snap.date_iso) ns.time.dateISO = snap.date_iso;
      if (snap.flags) ns.flags = snap.flags;
    }
    return ns;
  }

  function dispatch(action) {
    state = reduce(state, action);
    notify();
  }

  function notify() {
    var copy = listeners.slice();
    for (var i = 0; i < copy.length; i++) {
      try { copy[i](state); } catch (e) { console.error('[Store]', e); }
    }
    if (global.EventBus) global.EventBus.emit('stateChange', state);
  }

  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      var idx = listeners.indexOf(fn);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }

  function getState() { return state; }

  function snapshot() {
    return {
      snapshotVersion: SNAPSHOT_VERSION,
      stats: JSON.parse(JSON.stringify(state.stats)),
      time: JSON.parse(JSON.stringify(state.time)),
      runtime: { sceneId: state.runtime.sceneId },
      flags: JSON.parse(JSON.stringify(state.flags)),
      counters: JSON.parse(JSON.stringify(state.counters)),
      mods: JSON.parse(JSON.stringify(state.mods)),
      meta: { saveSlot: state.meta.saveSlot, snapshotVersion: SNAPSHOT_VERSION }
    };
  }

  function getByPath(path) {
    var parts = path.split('.');
    var obj = state;
    for (var i = 0; i < parts.length; i++) {
      if (obj == null) return undefined;
      obj = obj[parts[i]];
    }
    return obj;
  }

  function setByPath(path, value) {
    var parts = path.split('.');
    if (parts.length === 1) {
      var a = {}; a[parts[0]] = value;
      dispatch({ type: 'SET_TMP', payload: a });
      return;
    }
    var root = parts[0];
    if (root === 'stats') {
      var su = {}; su[parts.slice(1).join('.')] = value;
      dispatch({ type: 'UPDATE_STATS', payload: su });
    } else if (root === 'flags') {
      var fu = {}; fu[parts[1]] = value;
      dispatch({ type: 'SET_FLAG', payload: fu });
    } else if (root === 'counters') {
      var cu = {}; cu[parts[1]] = value;
      dispatch({ type: 'SET_COUNTER', payload: cu });
    } else if (root === 'mods') {
      var mu = {}; mu[parts[1]] = value;
      dispatch({ type: 'SET_MODS', payload: mu });
    } else if (root === 'tmp') {
      var tu = {}; tu[parts[1]] = value;
      dispatch({ type: 'SET_TMP', payload: tu });
    }
  }

  global.Store = {
    getState: getState,
    dispatch: dispatch,
    subscribe: subscribe,
    snapshot: snapshot,
    getByPath: getByPath,
    setByPath: setByPath,
    SNAPSHOT_VERSION: SNAPSHOT_VERSION,
    clamp: clamp,
    deepMerge: deepMerge
  };
})(typeof window !== 'undefined' ? window : global);
