/**
 * Engine: VN script interpreter for story.v1.json
 * Processes script arrays with instruction pointer (IP).
 * Pauses on 'say' (waits for click) and 'choice' (waits for selection).
 */
(function (global) {
  var storyData = null;
  var currentScript = null;
  var ip = 0;
  var waiting = false;
  var waitType = null; // 'say' | 'choice'
  var onComplete = null;

  function loadStory(data) {
    storyData = data;
    if (data.flags) {
      Store.dispatch({ type: 'SET_FLAG', payload: data.flags });
    }
  }

  function getStory() { return storyData; }

  function runScript(script, cb) {
    currentScript = script;
    ip = 0;
    waiting = false;
    waitType = null;
    onComplete = cb || null;
    step();
  }

  function step() {
    if (!currentScript || ip >= currentScript.length) {
      finish();
      return;
    }

    var cmd = currentScript[ip];
    ip++;

    switch (cmd.type) {
      case 'bg':
        EventBus.emit('vn:bg', cmd.asset);
        step();
        break;

      case 'char':
        EventBus.emit('vn:char', { id: cmd.id, pose: cmd.pose, nameplate: cmd.nameplate });
        step();
        break;

      case 'say':
        waiting = true;
        waitType = 'say';
        EventBus.emit('vn:say', { who: cmd.who, text: cmd.text });
        break;

      case 'choice':
        waiting = true;
        waitType = 'choice';
        EventBus.emit('vn:choice', { id: cmd.id, text: cmd.text, options: cmd.options });
        break;

      case 'branch':
        executeBranch(cmd.branches);
        break;

      case 'calc':
        executeCalc(cmd.set);
        step();
        break;

      case 'flag':
        if (cmd.set) Store.dispatch({ type: 'SET_FLAG', payload: cmd.set });
        step();
        break;

      case 'add':
        addToPath(cmd.path, cmd.value);
        step();
        break;

      case 'set':
        if (cmd.valueFrom) {
          var val = Store.getByPath(cmd.valueFrom);
          Store.setByPath(cmd.path, val);
        } else if (cmd.value !== undefined) {
          Store.setByPath(cmd.path, cmd.value);
        }
        step();
        break;

      case 'screen':
        TransitionManager.applyScreenEffect(cmd.fx);
        step();
        break;

      case 'ending':
        EventBus.emit('vn:ending', { id: cmd.id, name: cmd.name, text: cmd.text });
        break;

      default:
        console.warn('[Engine] Unknown command type:', cmd.type);
        step();
        break;
    }
  }

  function addToPath(path, value) {
    var current = Store.getByPath(path);
    if (current === undefined) current = 0;
    Store.setByPath(path, current + value);
  }

  function advance() {
    if (!waiting) return;
    waiting = false;
    waitType = null;
    step();
  }

  function selectChoice(index) {
    if (!waiting || waitType !== 'choice') return;

    var choiceCmd = currentScript[ip - 1];
    if (!choiceCmd || !choiceCmd.options || !choiceCmd.options[index]) return;

    var option = choiceCmd.options[index];
    if (option.effects) {
      applyEffects(option.effects);
    }

    waiting = false;
    waitType = null;
    step();
  }

  function applyEffects(effects) {
    for (var i = 0; i < effects.length; i++) {
      var eff = effects[i];
      if (eff.op === 'add') {
        addToPath(eff.path, eff.value);
      } else if (eff.op === 'mul') {
        var curr = Store.getByPath(eff.path);
        if (curr === undefined) curr = 1;
        Store.setByPath(eff.path, curr * eff.value);
      } else if (eff.op === 'flag') {
        if (eff.set) Store.dispatch({ type: 'SET_FLAG', payload: eff.set });
      } else if (eff.op === 'set') {
        Store.setByPath(eff.path, eff.value);
      }
    }
  }

  function executeBranch(branches) {
    for (var i = 0; i < branches.length; i++) {
      var b = branches[i];
      if (b['if']) {
        if (checkConditions(b['if'])) {
          if (b['then']) {
            var savedScript = currentScript;
            var savedIp = ip;
            var savedComplete = onComplete;
            runScript(b['then'], function () {
              currentScript = savedScript;
              ip = savedIp;
              onComplete = savedComplete;
              step();
            });
            return;
          }
        }
      } else if (b['else']) {
        var savedScript2 = currentScript;
        var savedIp2 = ip;
        var savedComplete2 = onComplete;
        runScript(b['else'], function () {
          currentScript = savedScript2;
          ip = savedIp2;
          onComplete = savedComplete2;
          step();
        });
        return;
      }
    }
    step();
  }

  function checkConditions(conditions) {
    for (var i = 0; i < conditions.length; i++) {
      var c = conditions[i];
      var val = Store.getByPath(c.path);
      if (c.gte !== undefined && !(val >= c.gte)) return false;
      if (c.lte !== undefined && !(val <= c.lte)) return false;
      if (c.eq !== undefined && val !== c.eq) return false;
      if (c.gt !== undefined && !(val > c.gt)) return false;
      if (c.lt !== undefined && !(val < c.lt)) return false;
    }
    return true;
  }

  function executeCalc(sets) {
    for (var i = 0; i < sets.length; i++) {
      var s = sets[i];
      var result = evaluateExpr(s.expr);
      Store.setByPath(s.path, result);
    }
  }

  function evaluateExpr(expr) {
    var st = Store.getState();

    var context = {
      stats: st.stats,
      mods: st.mods,
      counters: st.counters,
      flags: st.flags,
      tmp: st.tmp
    };

    try {
      var fn = new Function(
        'stats', 'mods', 'counters', 'flags', 'tmp',
        'clamp', 'round', 'rand', 'floor', 'ceil', 'abs',
        'return (' + expr + ');'
      );

      return fn(
        context.stats, context.mods, context.counters, context.flags, context.tmp,
        function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },
        function round(v, decimals) {
          if (decimals !== undefined) {
            var f = Math.pow(10, decimals);
            return Math.round(v * f) / f;
          }
          return Math.round(v);
        },
        function rand(lo, hi) { return lo + Math.random() * (hi - lo); },
        Math.floor, Math.ceil, Math.abs
      );
    } catch (e) {
      console.error('[Engine] Expression eval error:', expr, e);
      return 0;
    }
  }

  function finish() {
    var cb = onComplete;
    currentScript = null;
    ip = 0;
    onComplete = null;
    if (cb) cb();
  }

  function isWaiting() { return waiting; }
  function getWaitType() { return waitType; }
  function isRunning() { return currentScript !== null; }

  global.Engine = {
    loadStory: loadStory,
    getStory: getStory,
    runScript: runScript,
    step: step,
    advance: advance,
    selectChoice: selectChoice,
    checkConditions: checkConditions,
    isWaiting: isWaiting,
    getWaitType: getWaitType,
    isRunning: isRunning,
    evaluateExpr: evaluateExpr,
    applyEffects: applyEffects
  };
})(typeof window !== 'undefined' ? window : global);
