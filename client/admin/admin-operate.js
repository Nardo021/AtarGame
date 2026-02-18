(function () {
  function api(path, method, body) {
    var opts = { method: method || 'GET', credentials: 'include', headers: {} };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = typeof body === 'string' ? body : JSON.stringify(body); }
    return fetch(path, opts).then(function (r) {
      if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || r.statusText); });
      return r.json();
    });
  }
  document.getElementById('btn-watch').onclick = function () {
    var id = document.getElementById('watch-user-id').value;
    if (!id) return alert('输入用户ID');
    api('/api/admin/user-state/' + id).then(function (r) {
      document.getElementById('watch-state').textContent = JSON.stringify({ user: r.user, state: r.state }, null, 2);
    }).catch(function (e) { alert(e.message); });
  };
  document.getElementById('btn-force-event').onclick = function () {
    var uid = document.getElementById('force-user-id').value, eid = document.getElementById('force-event-id').value || 'forced_rest';
    api('/api/admin/force-event', 'POST', { userId: parseInt(uid, 10), eventId: eid, eventType: 'forced' }).then(function () { alert('已推送'); }).catch(function (e) { alert(e.message); });
  };
  document.getElementById('btn-freeze').onclick = function () {
    var id = document.getElementById('freeze-user-id').value;
    if (!id) return alert('输入用户ID');
    api('/api/admin/freeze-user/' + id, 'POST').then(function () { alert('已冻结'); }).catch(function (e) { alert(e.message); });
  };
  document.getElementById('btn-unfreeze').onclick = function () {
    var id = document.getElementById('freeze-user-id').value;
    if (!id) return alert('输入用户ID');
    api('/api/admin/unfreeze-user/' + id, 'POST').then(function () { alert('已解冻'); }).catch(function (e) { alert(e.message); });
  };
  document.getElementById('btn-list-backups').onclick = function () {
    var uid = document.getElementById('rollback-user-id').value, slot = document.getElementById('rollback-slot').value || 0;
    if (!uid) return alert('输入用户ID');
    api('/api/admin/saves/backups/' + uid + '/' + slot).then(function (r) {
      document.getElementById('backups-list').innerHTML = (r.backups || []).map(function (b) {
        return '<div>备份#' + b.id + ' ' + b.backup_ts + ' ' + (b.reason || '') + '</div>';
      }).join('');
    }).catch(function (e) { alert(e.message); });
  };
  document.getElementById('btn-rollback').onclick = function () {
    var uid = document.getElementById('rollback-user-id').value, slot = document.getElementById('rollback-slot').value || 0, bid = document.getElementById('rollback-backup-id').value;
    if (!uid || !bid) return alert('输入用户ID和备份ID');
    api('/api/admin/saves/rollback', 'POST', { userId: parseInt(uid, 10), slot: parseInt(slot, 10), backupId: parseInt(bid, 10) }).then(function () { alert('已回档'); }).catch(function (e) { alert(e.message); });
  };
})();
