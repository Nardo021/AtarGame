/**
 * 管理员鉴权：若未以 admin 身份登录则跳转到 login.html
 */
(function () {
  function api(path) {
    return fetch(path, { credentials: 'include' }).then(function (r) {
      if (!r.ok) throw new Error('unauthorized');
      return r.json();
    });
  }
  var isLoginPage = /login\.html$/i.test(window.location.pathname);
  if (isLoginPage) return;
  api('/api/me').then(function (r) {
    if (!r.user || r.user.role !== 'admin') window.location.href = 'login.html';
  }).catch(function () {
    window.location.href = 'login.html';
  });
})();
