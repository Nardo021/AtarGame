/**
 * Scheduler: Only Math — milestone checking + random event dispatch
 * Runs each slot: check milestones → check random events → show action panel
 */
(function (global) {
  var triggeredMilestones = {};

  function reset() {
    triggeredMilestones = {};
  }

  function checkMilestones() {
    var story = Engine.getStory();
    if (!story || !story.milestones) return null;

    var state = Store.getState();

    for (var i = 0; i < story.milestones.length; i++) {
      var ms = story.milestones[i];
      if (triggeredMilestones[ms.id]) continue;

      if (matchWhen(ms.when, state)) {
        triggeredMilestones[ms.id] = true;
        return ms;
      }
    }
    return null;
  }

  function matchWhen(when, state) {
    if (!when) return false;

    if (when.type === 'date') {
      return state.time.dateISO === when.dateISO && state.time.slotId === when.slotId;
    }

    if (when.type === 'condition') {
      return Engine.checkConditions(when.all);
    }

    return false;
  }

  function pickRandomEvent() {
    var story = Engine.getStory();
    if (!story || !story.randomEvents || !story.events) return null;

    var state = Store.getState();
    var slotId = state.time.slotId;
    var pool = story.randomEvents[slotId];
    if (!pool || pool.length === 0) return null;

    if (Math.random() > 0.3) return null;

    var candidates = [];
    var totalWeight = 0;

    for (var i = 0; i < pool.length; i++) {
      var evt = findEvent(story.events, pool[i]);
      if (!evt) continue;

      if (evt.trigger && !Engine.checkConditions(evt.trigger.all || [])) continue;

      var w = evt.weight || 1;
      if (evt.weightExpr && Engine.evaluateExpr) {
        try { w = Engine.evaluateExpr(evt.weightExpr); } catch (e) { /* fallback to static weight */ }
      }
      evt._resolvedWeight = w;
      candidates.push(evt);
      totalWeight += w;
    }

    if (candidates.length === 0) return null;

    var roll = Math.random() * totalWeight;
    var cumulative = 0;
    for (var j = 0; j < candidates.length; j++) {
      cumulative += (candidates[j]._resolvedWeight || candidates[j].weight || 1);
      if (roll <= cumulative) return candidates[j];
    }

    return candidates[candidates.length - 1];
  }

  function findEvent(events, id) {
    for (var i = 0; i < events.length; i++) {
      if (events[i].id === id) return events[i];
    }
    return null;
  }

  function processSlot(callback) {
    var milestone = checkMilestones();
    if (milestone) {
      if (milestone.scene) {
        Store.dispatch({ type: 'SET_SCENE', payload: milestone.scene });
      }
      Engine.runScript(milestone.script, function () {
        if (callback) callback('milestone', milestone.id);
      });
      return;
    }

    var state = Store.getState();
    if (Time.isClassSlot(state.time.slotId)) {
      var evt = pickRandomEvent();
      if (evt) {
        Engine.runScript(evt.script, function () {
          var result = Rules.doClass(Store.getState());
          Rules.applyResult(result);
          if (callback) callback('class_event', evt.id);
        });
        return;
      }

      var result = Rules.doClass(Store.getState());
      Rules.applyResult(result);
      Store.dispatch({ type: 'SET_SCENE', payload: 'CLASSROOM' });
      EventBus.emit('vn:classAuto', result);
      if (callback) callback('class_auto');
      return;
    }

    var freeEvt = pickRandomEvent();
    if (freeEvt) {
      Engine.runScript(freeEvt.script, function () {
        if (callback) callback('free');
      });
      return;
    }

    if (callback) callback('free');
  }

  function getTriggeredMilestones() {
    return Object.keys(triggeredMilestones);
  }

  function markTriggered(id) {
    triggeredMilestones[id] = true;
  }

  function loadTriggeredMilestones(list) {
    triggeredMilestones = {};
    if (list && Array.isArray(list)) {
      for (var i = 0; i < list.length; i++) {
        triggeredMilestones[list[i]] = true;
      }
    }
  }

  global.Scheduler = {
    reset: reset,
    checkMilestones: checkMilestones,
    pickRandomEvent: pickRandomEvent,
    processSlot: processSlot,
    getTriggeredMilestones: getTriggeredMilestones,
    markTriggered: markTriggered,
    loadTriggeredMilestones: loadTriggeredMilestones
  };
})(typeof window !== 'undefined' ? window : global);
