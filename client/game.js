/**
 * 游戏主逻辑：MAP/SCENE 视图、工作日课表/周末自由、地点、挂机上课、随机事件、travel
 */
(function (global) {
  var RULES = global.RULES;
  var SCHEDULER = global.SCHEDULER;
  var MAP = global.MAP;
  var API = global.API;
  var HISTORY = global.HISTORY;

  var state = {
    date_iso: '2026-01-01',
    time_block: 'MorningClass',
    location: 'classroom',
    viewMode: 'MAP',
    atar: 50,
    mood: 70,
    health: 80,
    stress: 20,
    reputation: 50,
    logic: 50,
    social: 50,
    stamina: 50,
    fatigue: 0,
    currentNode: 'start',
    saveSlot: 0,
    frozen: false,
    flags: {}
  };

  var storyData = { nodes: {} };
  var isPaused = false;
  var autoMode = false;
  var skipMode = false;
  var onStateChange = function () {};
  var onDialogue = function () {};
  var onChoice = function () {};
  var onAfkTick = function () {};
  var onViewModeChange = function () {};

  function loadStory() {
    var load = (typeof API.story === 'function') ? API.story() : Promise.resolve(window.__DEFAULT_STORY__ || { nodes: {} });
    return load.then(function (r) {
      var data = r && r.nodes ? r : (r && r.story ? r.story : null);
      if (data && data.nodes && Object.keys(data.nodes).length > 0) storyData = data;
      else storyData = window.__DEFAULT_STORY__ || { nodes: {} };
      return storyData;
    }).catch(function () {
      storyData = window.__DEFAULT_STORY__ || { nodes: {} };
      return storyData;
    });
  }

  function getNode(id) {
    return (storyData.nodes || {})[id] || null;
  }

  function clampState(s) {
    (RULES.STAT_KEYS || ['atar', 'mood', 'health', 'stress', 'reputation', 'logic', 'social', 'stamina', 'fatigue']).forEach(function (k) {
      if (typeof s[k] === 'number') s[k] = RULES.clamp(s[k], 0, 100);
    });
    return s;
  }

  function buildSummary(s) {
    s = s || state;
    return {
      date: s.date_iso,
      time_block: s.time_block,
      location: s.location,
      atar: s.atar,
      mood: s.mood,
      health: s.health,
      stress: s.stress,
      fatigue: s.fatigue
    };
  }

  function autoSaveSummary() {
    if (!API.saves || !API.saves.save) return;
    var slot = state.saveSlot != null ? state.saveSlot : 0;
    API.saves.save(slot, state, buildSummary()).catch(function () {});
  }

  function applyChoiceDelta(choice) {
    if (choice && choice.delta) state = (choice.socialGain && RULES.applySocialDelta) ? RULES.applySocialDelta(state, choice.delta) : RULES.applyDelta(state, choice.delta);
    if (choice && choice.flags && typeof choice.flags === 'object') {
      state.flags = state.flags || {};
      for (var k in choice.flags) if (Object.prototype.hasOwnProperty.call(choice.flags, k)) state.flags[k] = choice.flags[k];
    }
    state = clampState(state);
  }

  function advanceToNextBlock() {
    var next = SCHEDULER.nextBlock(state.date_iso, state.time_block);
    var prevDate = state.date_iso;
    state.date_iso = next.date_iso;
    state.time_block = next.time_block;
    if (next.date_iso !== prevDate) {
      state = RULES.dailyDecay(state);
      state = clampState(state);
      var diaryContent = '今日结束。ATAR ' + (state.atar || 0) + '，心情 ' + (state.mood || 0) + '，健康 ' + (state.health || 0) + '。';
      if (API.diary && API.diary.save) API.diary.save(prevDate, diaryContent).catch(function () {});
      autoSaveSummary();
    }
    state = clampState(state);
    onStateChange(state);
  }

  function isInSchool() {
    var z = MAP && MAP.sceneToZone ? MAP.sceneToZone(state.location) : 'school';
    return z === 'school';
  }

  function doAttendClassAfk() {
    var blocks = SCHEDULER.getBlocksForDate(state.date_iso);
    var isClassBlock = SCHEDULER.isClassBlock && SCHEDULER.isClassBlock(state.time_block);
    if (!isInSchool() || !isClassBlock) {
      advanceToNextBlock();
      onStateChange(state);
      return logAction('idle_block', state, state).then(function () { return { needDialogue: false }; });
    }
    var stateBefore = JSON.parse(JSON.stringify(state));
    var exam = SCHEDULER.shouldTriggerExam(state);
    if (exam) {
      state = RULES.applyDelta(state, exam.delta);
      state = clampState(state);
      if (API.logs && API.logs.event) API.logs.event({ date_iso: state.date_iso, time_block: state.time_block, location: state.location, event_id: 'exam_' + exam.type, event_type: 'date', detail: exam }).catch(function () {});
    }
    var forced = SCHEDULER.checkForcedEvent(state);
    if (forced) {
      if (API.logs && API.logs.event) API.logs.event({ date_iso: state.date_iso, time_block: state.time_block, location: state.location, event_id: forced.eventId, event_type: 'forced' }).catch(function () {});
      state.currentNode = forced.nodeId;
      onAfkTick(state, { nodeId: forced.nodeId });
      return Promise.resolve({ needDialogue: true, nodeId: forced.nodeId });
    }
    state = RULES.attendClassAfk(state);
    state = clampState(state);
    var randomEvent = null;
    if (SCHEDULER.shouldInsertRandomEvent()) {
      randomEvent = SCHEDULER.rollRandomClassEvent();
      if (API.logs && API.logs.event) API.logs.event({ date_iso: state.date_iso, time_block: state.time_block, location: state.location, event_id: randomEvent.id, event_type: 'probability', detail: randomEvent }).catch(function () {});
    }
    if (randomEvent) {
      state.currentNode = randomEvent.nodeId;
      onAfkTick(state, randomEvent);
      return Promise.resolve({ needDialogue: true, nodeId: randomEvent.nodeId });
    }
    advanceToNextBlock();
    onStateChange(state);
    return logAction('attend_class_afk', stateBefore, state).then(function () {
      return { needDialogue: false };
    });
  }

  function doFreeTimeBlock() {
    if (!SCHEDULER.isFreeBlock || !SCHEDULER.isFreeBlock(state.time_block)) {
      advanceToNextBlock();
      onStateChange(state);
      return Promise.resolve({ needDialogue: false });
    }
    var ev = SCHEDULER.getFreeTimeEvent(state);
    if (ev) {
      if (API.logs && API.logs.event) API.logs.event({ date_iso: state.date_iso, time_block: state.time_block, location: state.location, event_id: ev.eventId, event_type: ev.eventType || 'free_time' }).catch(function () {});
      state.currentNode = ev.nodeId;
      onAfkTick(state, { nodeId: ev.nodeId });
      return Promise.resolve({ needDialogue: true, nodeId: ev.nodeId });
    }
    advanceToNextBlock();
    onStateChange(state);
    return logAction('idle_block', state, state).then(function () { return { needDialogue: false }; });
  }

  function doTravel(toSceneId) {
    var fromZone = MAP && MAP.sceneToZone ? MAP.sceneToZone(state.location) : 'school';
    var toZone = MAP && MAP.sceneToZone ? MAP.sceneToZone(toSceneId) : 'school';
    var cost = RULES.travel(fromZone, toZone);
    var stateBefore = JSON.parse(JSON.stringify(state));
    for (var i = 0; i < cost.blocksConsumed; i++) {
      advanceToNextBlock();
    }
    state.location = toSceneId;
    onStateChange(state);
    return logAction('travel', stateBefore, state, { from: stateBefore.location, to: toSceneId }).then(function () { return state; });
  }

  function doStudy() {
    var stateBefore = JSON.parse(JSON.stringify(state));
    state = RULES.study(state);
    state = clampState(state);
    advanceToNextBlock();
    onStateChange(state);
    return logAction('study', stateBefore, state).then(function () { return state; });
  }

  function doSleep() {
    if (state.location !== 'home') return Promise.reject(new Error('请先回家'));
    var stateBefore = JSON.parse(JSON.stringify(state));
    state = RULES.sleepRecovery(state);
    state = clampState(state);
    advanceToNextBlock();
    onStateChange(state);
    return logAction('sleep', stateBefore, state).then(function () { return state; });
  }

  function logAction(actionType, stateBefore, stateAfter, extra) {
    if (!API.logs || !API.logs.action) return Promise.resolve();
    return API.logs.action({
      action_type: actionType,
      stateBefore: stateBefore,
      stateAfter: stateAfter,
      saveSlot: stateAfter.saveSlot != null ? stateAfter.saveSlot : 0,
      date_iso: stateAfter.date_iso,
      time_block: stateAfter.time_block,
      location: stateAfter.location,
      node_id: stateAfter.currentNode || null,
      choice_id: (extra && extra.choice_id) || null,
      delta: extra && (extra.delta !== undefined ? extra.delta : { from: extra.from, to: extra.to })
    }).catch(function () {});
  }

  function showNode(nodeId) {
    var node = getNode(nodeId);
    if (!node) {
      advanceToNextBlock();
      onStateChange(state);
      return;
    }
    state.currentNode = nodeId;
    HISTORY.add({ date_iso: state.date_iso, time_block: state.time_block, node_id: nodeId, text: node.text, event_type: 'dialogue' });
    if (node.delta) {
      state = RULES.applyDelta(state, node.delta);
      state = clampState(state);
    }
    if (node.choices && node.choices.length > 0) {
      onChoice(node);
      return;
    }
    if (node.next === '__resume__' || node.next === '__next_block__') {
      advanceToNextBlock();
      onStateChange(state);
      return;
    }
    if (node.next) {
      showNode(node.next);
      return;
    }
    onDialogue(node);
  }

  function makeChoice(choice, node) {
    var actualChoice = choice;
    var actualNext = choice.next;
    if (node.id === 'random_quiz' && choice.id === 'quiz_correct' && RULES.quizSuccessChance) {
      if (Math.random() >= RULES.quizSuccessChance(state)) {
        actualChoice = node.choices.find(function (c) { return c.id === 'quiz_wrong'; }) || choice;
        actualNext = 'quiz_fail';
      }
    }
    if (node.id === 'random_board') {
      var success = RULES.quizSuccessChance && Math.random() < RULES.quizSuccessChance(state);
      if (choice.id === 'board_ok' && !success) {
        actualChoice = node.choices.find(function (c) { return c.id === 'board_fail'; }) || choice;
      } else if (choice.id === 'board_fail' && success) {
        actualChoice = node.choices.find(function (c) { return c.id === 'board_ok'; }) || choice;
      }
    }
    var stateBeforeChoice = JSON.parse(JSON.stringify(state));
    applyChoiceDelta(actualChoice);
    HISTORY.add({ date_iso: state.date_iso, time_block: state.time_block, node_id: state.currentNode, choice_id: actualChoice.id, event_type: 'choice' });
    logAction('choice', stateBeforeChoice, state, { choice_id: actualChoice.id, node_id: state.currentNode, delta: actualChoice.delta }).catch(function () {});
    if (actualNext === '__resume__' || actualNext === '__next_block__') {
      advanceToNextBlock();
      onStateChange(state);
      return;
    }
    if (actualNext) showNode(actualNext);
    else { advanceToNextBlock(); onStateChange(state); }
  }

  function enterScene(sceneId) {
    state.viewMode = 'SCENE';
    state.location = sceneId;
    onStateChange(state);
    onViewModeChange(state);
  }

  function backToMap() {
    state.viewMode = 'MAP';
    onStateChange(state);
    onViewModeChange(state);
  }

  function getState() { return state; }
  function setState(s) {
    if (s && typeof s === 'object') {
      ['date_iso', 'time_block', 'location', 'viewMode', 'atar', 'mood', 'health', 'stress', 'reputation', 'logic', 'social', 'stamina', 'fatigue', 'currentNode', 'saveSlot', 'frozen'].forEach(function (k) {
        if (s[k] !== undefined) state[k] = s[k];
      });
      if (s.flags && typeof s.flags === 'object') state.flags = s.flags;
      state.flags = state.flags || {};
      state = clampState(state);
    }
  }
  function setSaveSlot(n) { state.saveSlot = n; }
  function setPaused(p) { isPaused = p; }
  function setAutoMode(v) { autoMode = v; }
  function setSkipMode(v) { skipMode = v; }
  function getAutoMode() { return autoMode; }
  function getSkipMode() { return skipMode; }

  global.GAME = {
    state: state,
    getState: getState,
    setState: setState,
    setSaveSlot: setSaveSlot,
    loadStory: loadStory,
    getNode: getNode,
    showNode: showNode,
    makeChoice: makeChoice,
    doAttendClassAfk: doAttendClassAfk,
    doFreeTimeBlock: doFreeTimeBlock,
    doTravel: doTravel,
    doStudy: doStudy,
    doSleep: doSleep,
    advanceToNextBlock: advanceToNextBlock,
    enterScene: enterScene,
    backToMap: backToMap,
    setPaused: setPaused,
    setAutoMode: setAutoMode,
    setSkipMode: setSkipMode,
    getAutoMode: getAutoMode,
    getSkipMode: getSkipMode,
    onStateChange: function (f) { onStateChange = f || function () {}; },
    onDialogue: function (f) { onDialogue = f || function () {}; },
    onChoice: function (f) { onChoice = f || function () {}; },
    onAfkTick: function (f) { onAfkTick = f || function () {}; },
    onViewModeChange: function (f) { onViewModeChange = f || function () {}; }
  };
})(typeof window !== 'undefined' ? window : global);
