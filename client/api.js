(function (global) {
  var BASE = ''; // 同源可留空；若前端单独部署可设为 'http://localhost:3000'

  function getCookie(name) {
    var v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
    return v ? v[2] : null;
  }

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
    register: function (username, password, inviteCode) { return api('/api/auth/register', 'POST', { username: username, password: password, inviteCode: inviteCode || '' }); },
    login: function (username, password, rememberMe) { return api('/api/auth/login', 'POST', { username: username, password: password, rememberMe: !!rememberMe }); },
    logout: function () { return api('/api/auth/logout', 'POST'); },
    me: function () { return api('/api/me'); }
  };

  var saves = {
    list: function () { return api('/api/saves'); },
    get: function (slot) { return api('/api/saves/' + slot); },
    save: function (slot, state, summary) { return api('/api/saves/' + slot, 'POST', { state: state, summary: summary }); }
  };

  var game = {
    action: function (payload) { return api('/api/game/action', 'POST', payload); },
    pendingEvents: function () { return api('/api/game/pending-events'); },
    logEvent: function (payload) { return api('/api/game/event', 'POST', payload); }
  };

  var story = function () { return api('/api/story'); };
  var messages = function () { return api('/api/messages'); };

  var leaderboard = function (limit, mode) {
    var q = '?limit=' + (limit || 50);
    if (mode) q += '&mode=' + mode;
    return api('/api/leaderboard' + q);
  };

  var board = {
    list: function (limit) { return api('/api/board?limit=' + (limit || 50)); },
    post: function (content) { return api('/api/board', 'POST', { content: content }); }
  };

  var calendar = {
    month: function (month) { return api('/api/calendar?month=' + encodeURIComponent(month)); },
    dayLog: function (date) { return api('/api/day-log?date=' + encodeURIComponent(date)); }
  };

  var diary = {
    list: function (from, to) { return api('/api/diary?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to)); },
    save: function (date_iso, content) { return api('/api/diary', 'POST', { date_iso: date_iso, content: content }); }
  };

  global.API = {
    BASE: BASE,
    api: api,
    auth: auth,
    saves: saves,
    game: game,
    story: story,
    messages: messages,
    leaderboard: leaderboard,
    board: board,
    calendar: calendar,
    diary: diary
  };
})(typeof window !== 'undefined' ? window : global);
