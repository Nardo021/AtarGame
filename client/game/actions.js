/**
 * Actions: player action handlers — CLASS, STUDY, REST, PLAY
 * Each action: apply rules → advance time → check daily decay → trigger next slot
 */
(function (global) {
  function checkCriticalStats(callback) {
    var s = Store.getState().stats;
    if (s.health <= 0) {
      EventBus.emit('vn:ending', { id: 'END_DEAD', name: '过劳死亡', text: '你没走到终点。' });
      if (callback) callback();
      return true;
    }
    if (s.mood <= 0) {
      EventBus.emit('vn:ending', { id: 'END_DEPRESSED', name: '抑郁崩溃', text: '你放弃了数学，数学也放弃了你。' });
      if (callback) callback();
      return true;
    }
    return false;
  }

  function executeAction(actionType, callback) {
    var state = Store.getState();
    var result;

    switch (actionType) {
      case 'CLASS':
        result = Rules.doClass(state);
        Store.dispatch({ type: 'SET_COUNTER', payload: { totalClass: (state.counters.totalClass || 0) + 1 } });
        break;
      case 'STUDY':
        result = Rules.doStudy(state);
        Store.dispatch({ type: 'SET_SCENE', payload: 'HOME' });
        Store.dispatch({ type: 'SET_COUNTER', payload: { totalStudy: (state.counters.totalStudy || 0) + 1 } });
        break;
      case 'REST':
        result = Rules.doRest(state);
        Store.dispatch({ type: 'SET_SCENE', payload: 'HOME' });
        Store.dispatch({ type: 'SET_COUNTER', payload: { totalRest: (state.counters.totalRest || 0) + 1 } });
        break;
      case 'PLAY':
        result = Rules.doPlay(state);
        Store.dispatch({ type: 'SET_COUNTER', payload: { totalPlay: (state.counters.totalPlay || 0) + 1 } });
        break;
      default:
        console.warn('[Actions] Unknown action:', actionType);
        if (callback) callback();
        return;
    }

    Rules.applyResult(result);
    EventBus.emit('action:applied', { type: actionType, result: result });

    if (checkCriticalStats(callback)) return;

    var timeResult = Time.advanceTime();

    if (timeResult.dateChanged) {
      var decayResult = Rules.doDailyDecay(Store.getState());
      if (decayResult.health !== 0 || decayResult.mood !== 0) {
        Rules.applyResult(decayResult);
      }
      if (checkCriticalStats(callback)) return;
    }

    TransitionManager.updateMoodHealthEffects();

    if (Time.isGameOver(Store.getState().time.dateISO)) {
      EventBus.emit('game:over');
      if (callback) callback();
      return;
    }

    Scheduler.processSlot(function (type, id) {
      EventBus.emit('slot:processed', { type: type, id: id });
      if (callback) callback(type, id);
    });
  }

  function getAvailableActions() {
    var state = Store.getState();
    var slotId = state.time.slotId;
    var actions = [];

    if (Time.isClassSlot(slotId)) {
      actions.push({ id: 'CLASS', label: '上课', icon: '📚' });
    }

    actions.push({ id: 'STUDY', label: '学习', icon: '✏️' });
    actions.push({ id: 'REST', label: '休息', icon: '😴' });

    if (!Time.isClassSlot(slotId)) {
      actions.push({ id: 'PLAY', label: '出去玩', icon: '🎮' });
    }

    return actions;
  }

  global.Actions = {
    executeAction: executeAction,
    getAvailableActions: getAvailableActions
  };
})(typeof window !== 'undefined' ? window : global);
