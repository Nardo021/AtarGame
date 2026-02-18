/**
 * 时间系统：工作日 7 时段 + 周末 4 时段，考试，强制事件，上课随机事件
 */
(function (global) {
  var WEEKDAY_BLOCKS = ['MorningClass', 'Recess', 'MidClass', 'Lunch', 'AfternoonClass', 'AfterSchool', 'Evening'];
  var WEEKEND_BLOCKS = ['Morning', 'Afternoon', 'Evening', 'Night'];
  var DATE_START = '2026-01-01';
  var DATE_END = '2026-12-31';

  function parseDate(s) {
    var p = s.split('-').map(Number);
    return { y: p[0], m: p[1], d: p[2] };
  }

  function addDays(iso, n) {
    var d = parseDate(iso);
    var date = new Date(d.y, d.m - 1, d.d + n);
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function getDayOfWeek(iso) {
    var d = parseDate(iso);
    return new Date(d.y, d.m - 1, d.d).getDay();
  }

  function isWeekend(iso) {
    var day = getDayOfWeek(iso);
    return day === 0 || day === 6;
  }

  function getBlocksForDate(iso) {
    return isWeekend(iso) ? WEEKEND_BLOCKS : WEEKDAY_BLOCKS;
  }

  function nextBlock(dateIso, timeBlock) {
    var blocks = getBlocksForDate(dateIso);
    var i = blocks.indexOf(timeBlock);
    if (i >= 0 && i < blocks.length - 1) {
      return { date_iso: dateIso, time_block: blocks[i + 1] };
    }
    return { date_iso: addDays(dateIso, 1), time_block: getBlocksForDate(addDays(dateIso, 1))[0] };
  }

  function getDayOfMonth(iso) {
    return parseDate(iso).d;
  }

  function isClassBlock(timeBlock) {
    return timeBlock === 'MorningClass' || timeBlock === 'MidClass' || timeBlock === 'AfternoonClass';
  }

  function isWeeklyExam(dateIso, timeBlock) {
    return getDayOfWeek(dateIso) === 5 && timeBlock === 'AfternoonClass';
  }

  function isMonthlyExam(dateIso, timeBlock) {
    return getDayOfMonth(dateIso) === 15 && timeBlock === 'MorningClass';
  }

  var EXAM_DATES = ['2026-04-15', '2026-07-01', '2026-10-10', '2026-12-20'];
  function isMidFinalExam(dateIso, timeBlock) {
    return EXAM_DATES.indexOf(dateIso) >= 0 && timeBlock === 'MorningClass';
  }

  function shouldTriggerExam(state) {
    var d = state.date_iso || DATE_START;
    var t = state.time_block || 'MorningClass';
    if (isWeeklyExam(d, t)) return { type: 'weekly', delta: { atar: 1, stress: 5 } };
    if (isMonthlyExam(d, t)) return { type: 'monthly', delta: { atar: 2, stress: 8 } };
    if (isMidFinalExam(d, t)) return { type: 'mid_final', delta: { atar: 3, stress: 10 } };
    return null;
  }

  function checkForcedEvent(state) {
    if ((state.health || 100) < 20) return { eventId: 'forced_rest', nodeId: 'forced_rest' };
    if ((state.mood || 100) < 20) return { eventId: 'forced_low_mood', nodeId: 'forced_low_mood' };
    if ((state.stress || 0) > 80) return { eventId: 'forced_burnout', nodeId: 'forced_burnout' };
    return null;
  }

  var AFK_EVENTS = [
    { id: 'random_quiz', weight: 15, nodeId: 'random_quiz' },
    { id: 'random_sleep', weight: 10, nodeId: 'random_sleep' },
    { id: 'random_talk', weight: 20, nodeId: 'random_talk' },
    { id: 'random_board', weight: 10, nodeId: 'random_board' }
  ];
  var AFK_EVENTS_TOTAL = AFK_EVENTS.reduce(function (s, e) { return s + e.weight; }, 0);

  function rollRandomClassEvent() {
    var r = Math.random() * AFK_EVENTS_TOTAL;
    var acc = 0;
    for (var i = 0; i < AFK_EVENTS.length; i++) {
      acc += AFK_EVENTS[i].weight;
      if (r < acc) return AFK_EVENTS[i];
    }
    return AFK_EVENTS[AFK_EVENTS.length - 1];
  }

  function shouldInsertRandomEvent() {
    return Math.random() < 0.35;
  }

  global.SCHEDULER = {
    WEEKDAY_BLOCKS: WEEKDAY_BLOCKS,
    WEEKEND_BLOCKS: WEEKEND_BLOCKS,
    DATE_START: DATE_START,
    DATE_END: DATE_END,
    nextBlock: nextBlock,
    getBlocksForDate: getBlocksForDate,
    isWeekend: isWeekend,
    isClassBlock: isClassBlock,
    shouldTriggerExam: shouldTriggerExam,
    checkForcedEvent: checkForcedEvent,
    rollRandomClassEvent: rollRandomClassEvent,
    shouldInsertRandomEvent: shouldInsertRandomEvent,
    addDays: addDays,
    parseDate: parseDate,
    getDayOfWeek: getDayOfWeek
  };
})(typeof window !== 'undefined' ? window : global);
