/**
 * 时间系统：工作日 7 时段 + 周末 4 时段；上课概率插入（抽查/睡着/同桌/上台）；自由时段可选行动与随机小剧场；考试/社团/约定写入 calendar_events；事件触发写 event_logs
 */
(function (global) {
  var WEEKDAY_BLOCKS = ['MorningClass', 'Recess', 'MidClass', 'Lunch', 'AfternoonClass', 'AfterSchool', 'Evening'];
  var WEEKEND_BLOCKS = ['Morning', 'Afternoon', 'Evening', 'Night'];
  var DATE_START = '2026-01-01';
  var DATE_END = '2026-12-31';

  var EXAM_DATES = ['2026-04-15', '2026-07-01', '2026-10-10', '2026-12-20'];

  // 上课时段仅概率插入，不弹主动剧情
  var CLASS_AFK_EVENTS = [
    { id: 'random_quiz', weight: 15, nodeId: 'random_quiz', eventType: 'class_insert' },
    { id: 'random_sleep', weight: 10, nodeId: 'random_sleep', eventType: 'class_insert' },
    { id: 'random_talk', weight: 20, nodeId: 'random_talk', eventType: 'class_insert' },
    { id: 'random_board', weight: 10, nodeId: 'random_board', eventType: 'class_insert' }
  ];
  var CLASS_AFK_TOTAL = CLASS_AFK_EVENTS.reduce(function (s, e) { return s + e.weight; }, 0);

  // 自由时段：Recess/Lunch/AfterSchool/Evening + 周末 → 按地点+时段从事件池抽
  var FREE_BLOCKS = ['Recess', 'Lunch', 'AfterSchool', 'Evening', 'Morning', 'Afternoon', 'Evening', 'Night'];
  var LOCATION_POOLS = {
    classroom: ['campus_classroom_1', 'campus_classroom_2', 'campus_classroom_3', 'campus_classroom_4', 'campus_classroom_5', 'campus_classroom_6', 'campus_classroom_7', 'campus_classroom_8', 'campus_classroom_9', 'campus_classroom_10'],
    corridor: ['campus_corridor_1', 'campus_corridor_2', 'campus_corridor_3', 'campus_corridor_4', 'campus_corridor_5', 'campus_corridor_6', 'campus_corridor_7', 'campus_corridor_8', 'campus_corridor_9', 'campus_corridor_10'],
    field: ['campus_field_1', 'campus_field_2', 'campus_field_3', 'campus_field_4', 'campus_field_5', 'campus_field_6', 'campus_field_7', 'campus_field_8', 'campus_field_9', 'campus_field_10'],
    clubroom: ['campus_clubroom_1', 'campus_clubroom_2', 'campus_clubroom_3', 'campus_clubroom_4', 'campus_clubroom_5', 'campus_clubroom_6', 'campus_clubroom_7', 'campus_clubroom_8', 'campus_clubroom_9', 'campus_clubroom_10'],
    home: ['campus_home_1', 'campus_home_2', 'campus_home_3', 'campus_home_4', 'campus_home_5', 'campus_home_6', 'campus_home_7', 'campus_home_8', 'campus_home_9', 'campus_home_10'],
    internet_cafe: ['campus_cafe_1', 'campus_cafe_2', 'campus_cafe_3', 'campus_cafe_4', 'campus_cafe_5', 'campus_cafe_6', 'campus_cafe_7', 'campus_cafe_8', 'campus_cafe_9', 'campus_cafe_10']
  };
  var MINI_POOL = ['mini_1', 'mini_2', 'mini_3', 'mini_4', 'mini_5', 'mini_6', 'mini_7', 'mini_8', 'mini_9', 'mini_10', 'mini_11', 'mini_12', 'mini_13', 'mini_14', 'mini_15'];

  // 社团链触发：需在活动室且 club_chain 未完成
  var CLUB_CHAIN_NODES = ['club_intro', 'club_meet_1', 'club_meet_2', 'club_meet_3', 'club_contest', 'club_finale'];
  // 网吧链
  var CAFE_CHAIN_NODES = ['cafe_first', 'cafe_addict_1', 'cafe_addict_2', 'cafe_match_1', 'cafe_match_2', 'cafe_friend_1', 'cafe_friend_2'];
  // 家庭链
  var FAMILY_CHAIN_NODES = ['family_dinner_1', 'family_pressure_1', 'family_support_1', 'family_talk_1', 'family_talk_2'];

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

  function isFreeBlock(timeBlock) {
    return FREE_BLOCKS.indexOf(timeBlock) >= 0;
  }

  function isWeeklyExam(dateIso, timeBlock) {
    return getDayOfWeek(dateIso) === 5 && timeBlock === 'AfternoonClass';
  }

  function isMonthlyExam(dateIso, timeBlock) {
    return getDayOfMonth(dateIso) === 15 && timeBlock === 'MorningClass';
  }

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
    if ((state.health || 100) < 20) return { eventId: 'forced_rest', nodeId: 'forced_rest', eventType: 'forced' };
    if ((state.mood || 100) < 20) return { eventId: 'forced_low_mood', nodeId: 'forced_low_mood', eventType: 'forced' };
    if ((state.stress || 0) > 80) return { eventId: 'forced_burnout', nodeId: 'forced_burnout', eventType: 'forced' };
    return null;
  }

  function rollRandomClassEvent() {
    var r = Math.random() * CLASS_AFK_TOTAL;
    var acc = 0;
    for (var i = 0; i < CLASS_AFK_EVENTS.length; i++) {
      acc += CLASS_AFK_EVENTS[i].weight;
      if (r < acc) return CLASS_AFK_EVENTS[i];
    }
    return CLASS_AFK_EVENTS[CLASS_AFK_EVENTS.length - 1];
  }

  /** 上课时段是否插入事件（概率，默认不弹主动剧情） */
  function shouldInsertRandomEvent() {
    return Math.random() < 0.35;
  }

  /** 自由时段：按地点+概率抽取事件（校园日常 / 链式 / 小剧场） */
  function getFreeTimeEvent(state) {
    if (!state || !isFreeBlock(state.time_block)) return null;
    var loc = state.location || 'classroom';
    var flags = state.flags || {};
    var roll = Math.random();

    // 黑化线：stress 过高时有机会触发
    if ((state.stress || 0) >= 75 && roll < 0.15) {
      if (!flags.dark_warn) return { nodeId: 'dark_warning', eventId: 'dark_warning', eventType: 'growth' };
      if (!flags.dark_breakdown && roll < 0.08) return { nodeId: 'dark_breakdown', eventId: 'dark_breakdown', eventType: 'growth' };
    }

    // 家庭线：在家且晚间/周末
    if (loc === 'home' && (state.time_block === 'Evening' || state.time_block === 'Night' || state.time_block === 'Morning' || state.time_block === 'Afternoon')) {
      if (!flags.family_dinner_1 && roll < 0.2) return { nodeId: 'family_dinner_1', eventId: 'family_dinner', eventType: 'chain_family' };
      if (flags.family_support_1 && !flags.family_talk_2 && roll < 0.12) return { nodeId: 'family_talk_2', eventId: 'family_talk', eventType: 'chain_family' };
    }

    // 社团链：活动室
    if (loc === 'clubroom') {
      var clubStep = (flags.club_chain || 0) | 0;
      if (clubStep === 0 && !flags.club_chain_done && roll < 0.25) return { nodeId: 'club_intro', eventId: 'club_intro', eventType: 'chain_club' };
      if (clubStep === 1 && roll < 0.3) return { nodeId: 'club_meet_1', eventId: 'club_meet_1', eventType: 'chain_club' };
      if (clubStep === 2 && roll < 0.3) return { nodeId: 'club_meet_2', eventId: 'club_meet_2', eventType: 'chain_club' };
      if (clubStep === 3 && roll < 0.25) return { nodeId: 'club_meet_3', eventId: 'club_meet_3', eventType: 'chain_club' };
      if (clubStep === 4 && roll < 0.2) return { nodeId: 'club_contest', eventId: 'club_contest', eventType: 'chain_club' };
    }

    // 网吧线
    if (loc === 'internet_cafe') {
      if (!flags.cafe_chain && flags.cafe_chain !== 0 && roll < 0.2) return { nodeId: 'cafe_first', eventId: 'cafe_first', eventType: 'chain_cafe' };
      if ((flags.cafe_chain || 0) >= 1 && (flags.cafe_addiction || 0) === 0 && roll < 0.15) return { nodeId: 'cafe_addict_1', eventId: 'cafe_addict', eventType: 'chain_cafe' };
      if (!flags.cafe_match_done && roll < 0.1) return { nodeId: 'cafe_match_1', eventId: 'cafe_match', eventType: 'chain_cafe' };
      if (!flags.cafe_friend_done && flags.cafe_friend !== 1 && roll < 0.12) return { nodeId: 'cafe_friend_1', eventId: 'cafe_friend', eventType: 'chain_cafe' };
    }

    // 成长转折（低概率）
    if (roll < 0.03) {
      if ((state.atar || 50) >= 75 && !flags.growth_success) return { nodeId: 'growth_big_success', eventId: 'growth_success', eventType: 'growth' };
      if ((state.mood || 50) < 40 && !flags.growth_fail) return { nodeId: 'growth_big_fail', eventId: 'growth_fail', eventType: 'growth' };
      if ((state.fatigue || 0) >= 60 && !flags.growth_crisis) return { nodeId: 'growth_crisis', eventId: 'growth_crisis', eventType: 'growth' };
      if ((state.logic || 50) >= 70 && !flags.growth_breakthrough) return { nodeId: 'growth_breakthrough', eventId: 'growth_breakthrough', eventType: 'growth' };
    }

    // 地点日常池（约 35% 触发）
    if (roll < 0.35) {
      var pool = LOCATION_POOLS[loc] || LOCATION_POOLS.classroom;
      var nodeId = pool[Math.floor(Math.random() * pool.length)];
      return { nodeId: nodeId, eventId: nodeId, eventType: 'campus_daily' };
    }

    // 随机小剧场（约 25%）
    if (roll < 0.25) {
      var miniId = MINI_POOL[Math.floor(Math.random() * MINI_POOL.length)];
      return { nodeId: miniId, eventId: miniId, eventType: 'mini' };
    }

    return null;
  }

  /** 日历事件预告：考试 / 社团活动 / 约定（供 calendar 展示）；monthKey 可选，如 "2026-03" */
  function getCalendarEvents(state, monthKey) {
    var list = [];
    var flags = (state && state.flags) || {};
    var year = 2026;
    var month = 1;
    if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) { year = parseInt(monthKey.slice(0, 4), 10); month = parseInt(monthKey.slice(5, 7), 10); }
    else if (state && state.date_iso) { year = parseInt(state.date_iso.slice(0, 4), 10); month = parseInt(state.date_iso.slice(5, 7), 10); }

    EXAM_DATES.forEach(function (d) {
      var m = parseInt(d.split('-')[1], 10);
      if (m === month) list.push({ date_iso: d, title: '考试', event_type: 'exam' });
    });
    if (month <= 12) {
      list.push({ date_iso: year + '-' + String(month).padStart(2, '0') + '-15', title: '月考', event_type: 'exam_monthly' });
      var friday = getFirstFriday(year, month);
      if (friday) list.push({ date_iso: friday, title: '周测', event_type: 'exam_weekly' });
    }

    if (flags.club_chain >= 3 && !flags.club_chain_done) {
      var nextWed = getNextWeekdayInMonth(year, month, 3);
      if (nextWed) list.push({ date_iso: nextWed, title: '社团展示', event_type: 'club_activity' });
    }

    return list;
  }

  function getFirstFriday(y, m) {
    var d = new Date(y, m - 1, 1);
    while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
    if (d.getMonth() !== m - 1) return null;
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function getNextWeekdayInMonth(y, m, weekday) {
    var d = new Date(y, m - 1, 1);
    while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
    if (d.getMonth() !== m - 1) return null;
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /** 真结局判定（供结局分支用） */
  function evaluateEnding(state) {
    var atar = state.atar || 0;
    var stress = state.stress || 0;
    var flags = state.flags || {};
    if ((stress || 0) >= 90 || (state.health || 100) < 30) return 'ending_bad';
    if (atar >= 85 && (flags.family_support || flags.family_talk_done) && (flags.club_chain_done || flags.cafe_friend_done) && stress < 60) return 'ending_true';
    if (atar >= 70) return 'ending_good';
    return 'ending_normal';
  }

  global.SCHEDULER = {
    WEEKDAY_BLOCKS: WEEKDAY_BLOCKS,
    WEEKEND_BLOCKS: WEEKEND_BLOCKS,
    DATE_START: DATE_START,
    DATE_END: DATE_END,
    EXAM_DATES: EXAM_DATES,
    nextBlock: nextBlock,
    getBlocksForDate: getBlocksForDate,
    isWeekend: isWeekend,
    isClassBlock: isClassBlock,
    isFreeBlock: isFreeBlock,
    shouldTriggerExam: shouldTriggerExam,
    checkForcedEvent: checkForcedEvent,
    rollRandomClassEvent: rollRandomClassEvent,
    shouldInsertRandomEvent: shouldInsertRandomEvent,
    getFreeTimeEvent: getFreeTimeEvent,
    getCalendarEvents: getCalendarEvents,
    evaluateEnding: evaluateEnding,
    addDays: addDays,
    parseDate: parseDate,
    getDayOfWeek: getDayOfWeek
  };
})(typeof window !== 'undefined' ? window : global);
