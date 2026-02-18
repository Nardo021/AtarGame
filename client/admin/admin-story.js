(function () {
  function api(path, method, body) {
    var opts = { method: method || 'GET', credentials: 'include', headers: {} };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = typeof body === 'string' ? body : JSON.stringify(body); }
    return fetch(path, opts).then(function (r) {
      if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || r.statusText); });
      return r.json();
    });
  }
  document.getElementById('btn-load-story').onclick = function () {
    api('/api/admin/story').then(function (r) {
      document.getElementById('story-json').value = JSON.stringify(r.story || {}, null, 2);
    }).catch(function (e) { alert(e.message); });
  };
  document.getElementById('btn-save-story').onclick = function () {
    var json = document.getElementById('story-json').value;
    try {
      var story = JSON.parse(json);
      api('/api/admin/story', 'PUT', { story: story, note: '后台编辑' }).then(function () { alert('已保存'); }).catch(function (e) { alert(e.message); });
    } catch (e) { alert('JSON 格式错误'); }
  };
  document.getElementById('link-versions').onclick = function (e) {
    e.preventDefault();
    api('/api/admin/story/versions').then(function (r) {
      var div = document.getElementById('versions-list');
      div.innerHTML = (r.versions || []).map(function (v) {
        return '<div>#' + v.id + ' ' + v.ts + ' ' + (v.note || '') + ' <button class="rollback-ver secondary" data-id="' + v.id + '">回滚</button></div>';
      }).join('');
      div.querySelectorAll('.rollback-ver').forEach(function (btn) {
        btn.onclick = function () {
          api('/api/admin/story/rollback/' + btn.dataset.id, 'POST').then(function () { alert('已回滚'); });
        };
      });
    });
  };
})();
