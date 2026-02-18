/**
 * 日历：月/周/日视图、calendar_events（考试/社团/推送）、diary_entries、点击某日展示 action_logs+event_logs 回放（模板化中文），不改变当前游戏日期
 */
(function (global) {
  var API = global.API;
  var GAME = global.GAME;
  var SCHEDULER = global.SCHEDULER;

  var currentYear = 2026;
  var currentMonth = 1;
  var currentDateIso = null;
  var viewMode = 'month';
  var events = [];
  var diaryEntries = {};

  function $(id) { return document.getElementById(id); }
  function pad(n) { return String(n).padStart(2, '0'); }

  function getMonthKey() {
    return currentYear + '-' + pad(currentMonth);
  }

  function getFirstDay(y, m) {
    return new Date(y, m - 1, 1).getDay();
  }

  function getDaysInMonth(y, m) {
    return new Date(y, m, 0).getDate();
  }

  function getWeekDates(centerDateIso) {
    var p = centerDateIso.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    var day = d.getDay();
    var start = new Date(d);
    start.setDate(d.getDate() - day);
    var out = [];
    for (var i = 0; i < 7; i++) {
      var x = new Date(start);
      x.setDate(start.getDate() + i);
      out.push(x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()));
    }
    return out;
  }

  var ACTION_LABELS = {
    attend_class_afk: '上课（挂机）',
    idle_block: '度过时段',
    travel: '移动',
    study: '自习',
    sleep: '睡觉',
    choice: '剧情选择'
  };

  var EVENT_LABELS = {
    class_insert: '课堂插曲',
    probability: '随机事件',
    forced: '强制事件',
    date: '考试/日程',
    campus_daily: '校园日常',
    chain_club: '社团',
    chain_cafe: '网吧',
    chain_family: '家庭',
    growth: '成长',
    mini: '小剧场',
    free_time: '自由时段'
  };

  function formatActionLabel(a) {
    var type = (a.action_type || '').trim();
    var label = ACTION_LABELS[type] || type || '行动';
    var loc = a.location || '';
    var time = a.time_block || '';
    if (type === 'travel' && a.delta_json) {
      try {
        var delta = typeof a.delta_json === 'string' ? JSON.parse(a.delta_json) : a.delta_json;
        if (delta.from && delta.to) return time + ' 从 ' + locName(delta.from) + ' 前往 ' + locName(delta.to);
      } catch (e) {}
    }
    return (time + ' ' + label + (loc ? '（' + locName(loc) + '）' : ''));
  }

  function formatEventLabel(e) {
    var type = e.event_type || '';
    var label = EVENT_LABELS[type] || type || e.event_id || '事件';
    return (e.time_block || '') + ' ' + label + (e.event_id ? '：' + e.event_id : '');
  }

  function locName(loc) {
    if (global.I18n && global.I18n.locationName) return global.I18n.locationName(loc);
    var map = { classroom: '教室', corridor: '走廊', field: '操场', clubroom: '活动室', home: '家', internet_cafe: '网吧' };
    return map[loc] || loc;
  }

  function renderMonth() {
    var grid = $('cal-month-grid');
    var label = $('cal-month-label');
    if (!grid) return;
    if (label) label.textContent = currentYear + '年' + currentMonth + '月';
    grid.innerHTML = '';
    var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    weekdays.forEach(function (d) {
      var h = document.createElement('div');
      h.className = 'cal-cell cal-header';
      h.textContent = d;
      grid.appendChild(h);
    });
    var first = getFirstDay(currentYear, currentMonth);
    var daysInMonth = getDaysInMonth(currentYear, currentMonth);
    var prevMonth = currentMonth === 1 ? 12 : currentYear - 1;
    var prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    var prevDays = getDaysInMonth(prevYear, prevMonth);
    var i;
    for (i = 0; i < first; i++) {
      var prevD = prevDays - first + i + 1;
      var cell = document.createElement('div');
      cell.className = 'cal-cell other-month';
      cell.textContent = prevD;
      cell.dataset.date = prevYear + '-' + pad(prevMonth) + '-' + pad(prevD);
      cell.onclick = function () { showDayDetail(this.dataset.date); };
      grid.appendChild(cell);
    }
    var gameDate = GAME && GAME.getState ? GAME.getState().date_iso : null;
    for (i = 1; i <= daysInMonth; i++) {
      var dateIso = currentYear + '-' + pad(currentMonth) + '-' + pad(i);
      var cell = document.createElement('div');
      cell.className = 'cal-cell';
      if (dateIso === gameDate) cell.classList.add('cal-cell-today');
      cell.textContent = i;
      cell.dataset.date = dateIso;
      var dayEvents = (events || []).filter(function (e) { return e.date_iso === dateIso; });
      var hasDiary = diaryEntries[dateIso];
      if (dayEvents.length || hasDiary) {
        var dot = document.createElement('span');
        dot.className = 'cal-dot';
        dot.title = (dayEvents.map(function (e) { return e.title || e.event_type; }).concat(hasDiary ? ['日记'] : [])).join(' · ');
        dot.textContent = ' ·';
        cell.appendChild(dot);
      }
      cell.onclick = function () { showDayDetail(this.dataset.date); };
      grid.appendChild(cell);
    }
    var total = first + daysInMonth;
    var nextCells = 7 - (total % 7);
    if (nextCells < 7) {
      for (i = 1; i <= nextCells; i++) {
        var c = document.createElement('div');
        c.className = 'cal-cell other-month';
        c.textContent = i;
        var nextM = currentMonth === 12 ? 1 : currentMonth + 1;
        var nextY = currentMonth === 12 ? currentYear + 1 : currentYear;
        c.dataset.date = nextY + '-' + pad(nextM) + '-' + pad(i);
        c.onclick = function () { showDayDetail(this.dataset.date); };
        grid.appendChild(c);
      }
    }
  }

  function renderWeek() {
    var grid = $('cal-week-grid');
    var label = $('cal-week-label');
    if (!grid || !label) return;
    var center = currentDateIso || (currentYear + '-' + pad(currentMonth) + '-01');
    var weekDates = getWeekDates(center);
    var weekStart = weekDates[0];
    var weekEnd = weekDates[6];
    label.textContent = weekStart + ' ～ ' + weekEnd;
    grid.innerHTML = '';
    var gameDate = GAME && GAME.getState ? GAME.getState().date_iso : null;
    weekDates.forEach(function (dateIso) {
      var cell = document.createElement('div');
      cell.className = 'cal-week-day';
      if (dateIso === gameDate) cell.classList.add('cal-cell-today');
      var dayNum = dateIso.split('-')[2];
      cell.innerHTML = '<span class="cal-week-num">' + dayNum + '</span><span class="cal-week-date">' + dateIso + '</span>';
      var dayEv = (events || []).filter(function (e) { return e.date_iso === dateIso; });
      if (diaryEntries[dateIso]) dayEv.push({ title: '日记' });
      if (dayEv.length) {
        var ul = document.createElement('ul');
        dayEv.forEach(function (e) { var li = document.createElement('li'); li.textContent = e.title || e.event_type || '日记'; ul.appendChild(li); });
        cell.appendChild(ul);
      }
      cell.onclick = function () { showDayDetail(dateIso); };
      grid.appendChild(cell);
    });
  }

  function renderDayView() {
    var wrap = $('cal-day-view');
    var label = $('cal-day-view-label');
    if (!wrap || !label) return;
    var d = currentDateIso || (currentYear + '-' + pad(currentMonth) + '-01');
    label.textContent = d;
    var dayEv = (events || []).filter(function (e) { return e.date_iso === d; });
    var html = '';
    if (diaryEntries[d]) html += '<section class="cal-day-section"><h5>日记</h5><p>' + escapeHtml(diaryEntries[d]) + '</p></section>';
    if (dayEv.length) {
      html += '<section class="cal-day-section"><h5>预告事件</h5><ul>';
      dayEv.forEach(function (e) { html += '<li>' + escapeHtml(e.title || e.event_type || '') + '</li>'; });
      html += '</ul></section>';
    }
    wrap.innerHTML = html || '<p>无记录</p>';
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function showDayDetail(dateIso) {
    currentDateIso = dateIso;
    var detail = $('cal-day-detail');
    var title = $('cal-day-title');
    var actionsEl = $('cal-day-actions');
    var eventsEl = $('cal-day-events');
    var diaryEl = $('cal-day-diary');
    if (!detail || !title) return;
    detail.style.display = 'block';
    title.textContent = dateIso + '（仅查看，不改变当前游戏日期）';
    if (diaryEl) diaryEl.innerHTML = diaryEntries[dateIso] ? '<p>' + escapeHtml(diaryEntries[dateIso]) + '</p>' : '<p>无日记</p>';
    if (actionsEl) actionsEl.innerHTML = '<p>加载中…</p>';
    if (eventsEl) eventsEl.innerHTML = '';
    API.calendar.dayLog(dateIso).then(function (r) {
      if (actionsEl) {
        var acts = (r.actions || []).map(function (a) {
          return '<li>' + escapeHtml(formatActionLabel(a)) + '</li>';
        }).join('');
        actionsEl.innerHTML = '<h5>行动回放</h5><ul class="cal-replay-list">' + (acts || '<li>无</li>') + '</ul>';
      }
      if (eventsEl) {
        var evs = (r.events || []).map(function (e) {
          return '<li>' + escapeHtml(formatEventLabel(e)) + '</li>';
        }).join('');
        eventsEl.innerHTML = '<h5>事件回放</h5><ul class="cal-replay-list">' + (evs || '<li>无</li>') + '</ul>';
      }
    }).catch(function () {
      if (actionsEl) actionsEl.innerHTML = '<p>加载失败</p>';
    });
    if (viewMode === 'week') renderWeek();
    if (viewMode === 'day') renderDayView();
  }

  function refresh() {
    var monthKey = getMonthKey();
    var state = GAME && GAME.getState ? GAME.getState() : {};
    var from = monthKey + '-01';
    var lastDay = getDaysInMonth(currentYear, currentMonth);
    var to = monthKey + '-' + pad(lastDay);

    Promise.all([
      API.calendar.month(monthKey).catch(function () { return { events: [] }; }),
      API.diary.list(from, to).catch(function () { return { entries: [] }; })
    ]).then(function (results) {
      events = (results[0].events || []).slice();
      var schedulerEvents = (SCHEDULER && SCHEDULER.getCalendarEvents) ? SCHEDULER.getCalendarEvents(state, monthKey) : [];
      schedulerEvents.forEach(function (e) { events.push(e); });
      diaryEntries = {};
      (results[1].entries || []).forEach(function (e) { diaryEntries[e.date_iso] = e.content; });
      renderMonth();
      if (viewMode === 'week') renderWeek();
      if (viewMode === 'day') renderDayView();
    }).catch(function () {
      events = [];
      var schedulerEvents = (SCHEDULER && SCHEDULER.getCalendarEvents) ? SCHEDULER.getCalendarEvents(state, monthKey) : [];
      schedulerEvents.forEach(function (e) { events.push(e); });
      renderMonth();
    });
  }

  function setView(mode) {
    viewMode = mode || 'month';
    if (!currentDateIso) currentDateIso = currentYear + '-' + pad(currentMonth) + '-01';
    var monthPanel = $('cal-month-panel');
    var weekPanel = $('cal-week-panel');
    var dayPanel = $('cal-day-panel');
    if (monthPanel) monthPanel.style.display = viewMode === 'month' ? 'block' : 'none';
    if (weekPanel) weekPanel.style.display = viewMode === 'week' ? 'block' : 'none';
    if (dayPanel) dayPanel.style.display = viewMode === 'day' ? 'block' : 'none';
    var sel = $('cal-view');
    if (sel) sel.value = viewMode;
    if (viewMode === 'week') renderWeek();
    if (viewMode === 'day') renderDayView();
  }

  function init() {
    var state = GAME && GAME.getState ? GAME.getState() : {};
    if (state.date_iso) {
      var p = state.date_iso.split('-').map(Number);
      currentYear = p[0];
      currentMonth = p[1];
      currentDateIso = state.date_iso;
    }
    var panel = $('calendar-panel');
    if (panel) {
      panel.querySelector('.close-calendar').onclick = function () { panel.classList.remove('open'); };
      var dayClose = $('cal-day-close');
      if (dayClose) dayClose.onclick = function () { var d = $('cal-day-detail'); if (d) d.style.display = 'none'; };
      var prev = $('cal-prev');
      if (prev) prev.onclick = function () {
        currentMonth--;
        if (currentMonth < 1) { currentMonth = 12; currentYear--; }
        refresh();
      };
      var next = $('cal-next');
      if (next) next.onclick = function () {
        currentMonth++;
        if (currentMonth > 12) { currentMonth = 1; currentYear++; }
        refresh();
      };
      var viewSel = $('cal-view');
      if (viewSel) viewSel.onchange = function () { setView(this.value); };
    }
    setView('month');
    refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.CALENDAR = {
    refresh: refresh,
    showDayDetail: showDayDetail,
    setView: setView
  };
})(typeof window !== 'undefined' ? window : global);
