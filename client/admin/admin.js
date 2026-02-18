/**
 * Admin 后台共用：API 封装、鉴权检查
 */
(function (global) {
  var BASE = '';

  function getCookie(name) {
    var m = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
    return m ? m[2] : null;
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

  function checkAdmin() {
    return api('/api/admin/me').then(function (data) {
      if (!data.user || data.user.role !== 'admin') {
        window.location.href = 'login.html';
        return Promise.reject(new Error('需要管理员'));
      }
      return data.user;
    }).catch(function (err) {
      window.location.href = 'login.html';
      return Promise.reject(err);
    });
  }

  function jsonPrettify(str) {
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch (e) {
      return str;
    }
  }

  function jsonValidate(str) {
    try {
      JSON.parse(str);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }

  global.AdminAPI = {
    api: api,
    checkAdmin: checkAdmin,
    jsonPrettify: jsonPrettify,
    jsonValidate: jsonValidate
  };
})();
