/**
 * 日历面板：月/周/日视图、事件预告、日记、某日行动与事件
 */
(function (global) {
  var API = global.API;
  var GAME = global.GAME;
  var SCHEDULER = global.SCHEDULER;

  var currentYear = 2026;
  var currentMonth = 1;
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
    var prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
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
    for (i = 1; i <= daysInMonth; i++) {
      var cell = document.createElement('div');
      cell.className = 'cal-cell';
      cell.textContent = i;
      var dateIso = currentYear + '-' + pad(currentMonth) + '-' + pad(i);
      cell.dataset.date = dateIso;
      var dayEvents = (events || []).filter(function (e) { return e.date_iso === dateIso; });
      if (dayEvents.length) {
        var dot = document.createElement('span');
        dot.className = 'cal-dot';
        dot.textContent = ' ·';
        dot.title = dayEvents.map(function (e) { return e.title; }).join(', ');
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

  function showDayDetail(dateIso) {
    var detail = $('cal-day-detail');
    var title = $('cal-day-title');
    var actionsEl = $('cal-day-actions');
    var eventsEl = $('cal-day-events');
    var diaryEl = $('cal-day-diary');
    if (!detail || !title) return;
    detail.style.display = 'block';
    title.textContent = dateIso;
    if (actionsEl) actionsEl.innerHTML = '<p>加载中…</p>';
    if (eventsEl) eventsEl.innerHTML = '';
    if (diaryEl) diaryEl.innerHTML = diaryEntries[dateIso] ? '<p>' + diaryEntries[dateIso] + '</p>' : '<p>无日记</p>';
    API.calendar.dayLog(dateIso).then(function (r) {
      if (actionsEl) {
        var acts = (r.actions || []).map(function (a) {
          return '<li>' + (a.time_block || '') + ' ' + (a.action_type || '') + '</li>';
        }).join('');
        actionsEl.innerHTML = '<h5>行动</h5><ul>' + (acts || '<li>无</li>') + '</ul>';
      }
      if (eventsEl) {
        var evs = (r.events || []).map(function (e) {
          return '<li>' + (e.event_id || '') + ' ' + (e.time_block || '') + '</li>';
        }).join('');
        eventsEl.innerHTML = '<h5>事件</h5><ul>' + (evs || '<li>无</li>') + '</ul>';
      }
    }).catch(function () {
      if (actionsEl) actionsEl.innerHTML = '<p>加载失败</p>';
    });
  }

  function refresh() {
    var monthKey = getMonthKey();
    API.calendar.month(monthKey).then(function (r) {
      events = r.events || [];
      var state = GAME && GAME.getState ? GAME.getState() : {};
      var from = monthKey + '-01';
      var lastDay = getDaysInMonth(currentYear, currentMonth);
      var to = monthKey + '-' + pad(lastDay);
      if (API.diary && API.diary.list) {
        API.diary.list(from, to).then(function (res) {
          diaryEntries = {};
          (res.entries || []).forEach(function (e) {
            diaryEntries[e.date_iso] = e.content;
          });
          renderMonth();
        }).catch(function () { renderMonth(); });
      } else {
        renderMonth();
      }
    }).catch(function () {
      events = [];
      renderMonth();
    });
  }

  function init() {
    var state = GAME && GAME.getState ? GAME.getState() : {};
    if (state.date_iso) {
      var p = state.date_iso.split('-').map(Number);
      currentYear = p[0];
      currentMonth = p[1];
    }
    var panel = $('calendar-panel');
    if (panel) {
      panel.querySelector('.close-calendar').onclick = function () { panel.classList.remove('open'); };
      $('cal-day-close').onclick = function () {
        var d = $('cal-day-detail');
        if (d) d.style.display = 'none';
      };
      $('cal-prev').onclick = function () {
        currentMonth--;
        if (currentMonth < 1) { currentMonth = 12; currentYear--; }
        refresh();
      };
      $('cal-next').onclick = function () {
        currentMonth++;
        if (currentMonth > 12) { currentMonth = 1; currentYear++; }
        refresh();
      };
      $('cal-view').onchange = function () {
        var v = this.value;
        if (v === 'month') refresh();
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.CALENDAR = {
    refresh: refresh,
    showDayDetail: showDayDetail
  };
})(typeof window !== 'undefined' ? window : global);
