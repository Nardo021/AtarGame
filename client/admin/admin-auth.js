/**
 * 管理员鉴权：使用后台单独登录态（admin_token），未登录则跳转到 login.html
 */
(function () {
  var isLoginPage = /login\.html$/i.test(window.location.pathname);
  if (isLoginPage) return;
  fetch('/api/admin/me', { credentials: 'include' })
    .then(function (r) {
      if (!r.ok) throw new Error('unauthorized');
      return r.json();
    })
    .then(function (data) {
      if (!data.user || data.user.role !== 'admin') window.location.href = 'login.html';
    })
    .catch(function () {
      window.location.href = 'login.html';
    });
})();
