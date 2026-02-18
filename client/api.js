/**
 * 对接后端：登录、存档、行动/事件日志、config、story、广播消息
 */
(function (global) {
  var BASE = '';

  function fetchOpts(method, body) {
    var opts = { method: method || 'GET', credentials: 'include', headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    return opts;
  }

  function api(path, method, body) {
    return fetch(BASE + path, fetchOpts(method, body)).then(function (r) {
      if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || r.statusText); });
      var ct = r.headers.get('Content-Type');
      if (ct && ct.indexOf('json') >= 0) return r.json();
      return r.text();
    });
  }

  var auth = {
    login: function (username, password, rememberMe) {
      return api('/api/auth/login', 'POST', { username: username, password: password, rememberMe: !!rememberMe });
    },
    register: function (username, password, inviteCode) {
      return api('/api/auth/register', 'POST', { username: username, password: password, inviteCode: inviteCode || '' });
    },
    logout: function () { return api('/api/auth/logout', 'POST'); },
    me: function () { return api('/api/me'); }
  };

  var saves = {
    list: function () { return api('/api/saves'); },
    get: function (slot) { return api('/api/saves/' + slot); },
    save: function (slot, state, summary) {
      var state_json = state != null ? (typeof state === 'string' ? state : JSON.stringify(state)) : null;
      var summary_json = summary != null ? (typeof summary === 'string' ? summary : JSON.stringify(summary)) : null;
      return api('/api/saves/' + slot, 'POST', { state_json: state_json, summary_json: summary_json });
    }
  };

  var logs = {
    action: function (payload) {
      return api('/api/logs/action', 'POST', {
        save_slot: payload.saveSlot != null ? payload.saveSlot : 0,
        date_iso: payload.date_iso,
        time_block: payload.time_block,
        location: payload.location,
        action_type: payload.action_type || 'choice',
        node_id: payload.node_id || null,
        choice_id: payload.choice_id || null,
        delta_json: payload.delta ? JSON.stringify(payload.delta) : null,
        state_before_json: payload.stateBefore ? JSON.stringify(payload.stateBefore) : null,
        state_after_json: payload.stateAfter ? JSON.stringify(payload.stateAfter) : null
      });
    },
    event: function (payload) {
      return api('/api/logs/event', 'POST', {
        date_iso: payload.date_iso,
        time_block: payload.time_block,
        location: payload.location,
        event_id: payload.event_id,
        event_type: payload.event_type,
        detail_json: payload.detail ? JSON.stringify(payload.detail) : null
      });
    }
  };

  function config() {
    return api('/api/config').then(function (r) { return r; }).catch(function () {
      return { defaultTransition: 'fade' };
    });
  }

  function story() {
    return api('/api/story').then(function (r) { return r.story || r; }).catch(function () {
      return window.__DEFAULT_STORY__ || { nodes: {} };
    });
  }

  var messages = function () { return api('/api/messages'); };

  var leaderboard = function (limit, mode) {
    var q = 'limit=' + (limit != null ? limit : 50);
    if (mode) q += '&mode=' + encodeURIComponent(mode);
    return api('/api/leaderboard?' + q);
  };

  var board = {
    list: function (page, limit, keyword) {
      var q = 'page=' + (page != null ? page : 1) + '&limit=' + (limit != null ? limit : 20);
      if (keyword) q += '&keyword=' + encodeURIComponent(keyword);
      return api('/api/board?' + q);
    },
    post: function (content) {
      return api('/api/board', 'POST', { content: content });
    }
  };

  var calendar = {
    month: function (monthKey) {
      return api('/api/calendar?month=' + encodeURIComponent(monthKey));
    },
    dayLog: function (dateIso) {
      return api('/api/calendar/day?date=' + encodeURIComponent(dateIso));
    }
  };

  var diary = {
    list: function (from, to) {
      return api('/api/diary?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to));
    },
    save: function (dateIso, content) {
      return api('/api/diary', 'POST', { date_iso: dateIso, content: content });
    }
  };

  global.API = {
    BASE: BASE,
    api: api,
    auth: auth,
    saves: saves,
    logs: logs,
    leaderboard: leaderboard,
    board: board,
    calendar: calendar,
    diary: diary,
    config: config,
    story: story,
    messages: messages
  };
})(typeof window !== 'undefined' ? window : global);
