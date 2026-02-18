(function () {
  function api(path, method, body) {
    var opts = { method: method || 'GET', credentials: 'include', headers: {} };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = typeof body === 'string' ? body : JSON.stringify(body); }
    return fetch(path, opts).then(function (r) {
      if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || r.statusText); });
      return r.json();
    });
  }
  document.getElementById('btn-simulate').onclick = function () {
    var n = document.getElementById('sim-n').value || 1000, strategy = document.getElementById('sim-strategy').value || 'random';
    api('/api/admin/metrics/simulate?n=' + n + '&strategy=' + strategy).then(function (r) {
      document.getElementById('sim-result').textContent = JSON.stringify(r, null, 2);
    }).catch(function (e) { alert(e.message); });
  };
  document.getElementById('btn-ab').onclick = function () {
    var uid = document.getElementById('ab-user-id').value, group = document.getElementById('ab-group').value;
    if (!uid || !group) return alert('输入用户ID和组名');
    api('/api/admin/ab-groups', 'POST', { userId: parseInt(uid, 10), groupName: group }).then(function () { alert('已设置'); }).catch(function (e) { alert(e.message); });
  };
  document.getElementById('btn-del-post').onclick = function () {
    var id = document.getElementById('del-post-id').value;
    if (!id) return alert('输入帖子ID');
    api('/api/admin/board/' + id, 'DELETE').then(function () { alert('已删'); }).catch(function (e) { alert(e.message); });
  };
})();
