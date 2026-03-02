/**
 * Time: Only Math VN — slot definitions & time progression
 * Weekday: CLASS_AM, BREAK, CLASS_PM, AFTER_SCHOOL, EVENING, NIGHT
 * Weekend: MORNING, AFTERNOON, EVENING, NIGHT
 */
(function (global) {
  var WEEKDAY_SLOTS = ['CLASS_AM', 'BREAK', 'CLASS_PM', 'AFTER_SCHOOL', 'EVENING', 'NIGHT'];
  var WEEKEND_SLOTS = ['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'];

  var SLOT_LABELS = {
    CLASS_AM: '上午课',
    BREAK: '课间',
    CLASS_PM: '下午课',
    AFTER_SCHOOL: '放学后',
    EVENING: '傍晚',
    NIGHT: '深夜',
    MORNING: '早晨',
    AFTERNOON: '下午'
  };

  function parseDate(iso) {
    var p = iso.split('-').map(Number);
    return { y: p[0], m: p[1], d: p[2] };
  }

  function toISO(date) {
    return date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function addDays(iso, n) {
    var d = parseDate(iso);
    var date = new Date(d.y, d.m - 1, d.d + n);
    return toISO(date);
  }

  function getDayOfWeek(iso) {
    var d = parseDate(iso);
    return new Date(d.y, d.m - 1, d.d).getDay();
  }

  function isWeekend(iso) {
    var day = getDayOfWeek(iso);
    return day === 0 || day === 6;
  }

  function getSlotsForDate(iso) {
    return isWeekend(iso) ? WEEKEND_SLOTS : WEEKDAY_SLOTS;
  }

  function nextSlot(dateISO, slotId) {
    var slots = getSlotsForDate(dateISO);
    var i = slots.indexOf(slotId);
    if (i >= 0 && i < slots.length - 1) {
      return { dateISO: dateISO, slotId: slots[i + 1] };
    }
    var nd = addDays(dateISO, 1);
    return { dateISO: nd, slotId: getSlotsForDate(nd)[0] };
  }

  function isClassSlot(slotId) {
    return slotId === 'CLASS_AM' || slotId === 'CLASS_PM';
  }

  function isFreeSlot(slotId) {
    return ['BREAK', 'AFTER_SCHOOL', 'EVENING', 'NIGHT', 'MORNING', 'AFTERNOON'].indexOf(slotId) >= 0;
  }

  function getSlotLabel(slotId) {
    return SLOT_LABELS[slotId] || slotId;
  }

  function advanceTime() {
    var st = global.Store.getState();
    var next = nextSlot(st.time.dateISO, st.time.slotId);
    var dateChanged = next.dateISO !== st.time.dateISO;
    global.Store.dispatch({
      type: 'SET_TIME',
      payload: { dateISO: next.dateISO, slotId: next.slotId, isWeekend: isWeekend(next.dateISO) }
    });
    return { dateChanged: dateChanged, prevDate: st.time.dateISO };
  }

  function formatDate(iso) {
    var d = parseDate(iso);
    var dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    var dow = getDayOfWeek(iso);
    return d.m + '月' + d.d + '日 周' + dayNames[dow];
  }

  function isGameOver(dateISO) {
    return dateISO > '2026-12-31';
  }

  global.Time = {
    WEEKDAY_SLOTS: WEEKDAY_SLOTS,
    WEEKEND_SLOTS: WEEKEND_SLOTS,
    SLOT_LABELS: SLOT_LABELS,
    parseDate: parseDate,
    toISO: toISO,
    addDays: addDays,
    getDayOfWeek: getDayOfWeek,
    isWeekend: isWeekend,
    getSlotsForDate: getSlotsForDate,
    nextSlot: nextSlot,
    isClassSlot: isClassSlot,
    isFreeSlot: isFreeSlot,
    getSlotLabel: getSlotLabel,
    advanceTime: advanceTime,
    formatDate: formatDate,
    isGameOver: isGameOver
  };
})(typeof window !== 'undefined' ? window : global);
