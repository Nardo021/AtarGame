(function () {
  var BASE = '';
  function api(path, method, body) {
    var opts = { method: method || 'GET', credentials: 'include', headers: {} };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = typeof body === 'string' ? body : JSON.stringify(body); }
    return fetch(BASE + path, opts).then(function (r) {
      if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || r.statusText); });
      return r.json();
    });
  }

  document.getElementById('btn-online').onclick = function () {
    var m = document.getElementById('online-minutes').value || 15;
    api('/api/admin/online?minutes=' + m).then(function (r) {
      var tbody = document.getElementById('online-body');
      tbody.innerHTML = (r.online || []).map(function (u) {
        return '<tr><td>' + u.user_id + '</td><td>' + (u.username || '') + '</td><td>' + (u.last_ts || '') + '</td></tr>';
      }).join('');
    }).catch(function (e) { alert(e.message); });
  };

  document.getElementById('btn-watch').onclick = function () {
    var id = document.getElementById('watch-user-id').value;
    if (!id) return alert('输入用户ID');
    api('/api/admin/user-state/' + id).then(function (r) {
      document.getElementById('watch-state').textContent = JSON.stringify({ user: r.user, state: r.state }, null, 2);
    }).catch(function (e) { alert(e.message); });
  };

  document.getElementById('btn-force-event').onclick = function () {
    var uid = document.getElementById('force-user-id').value;
    var eid = document.getElementById('force-event-id').value || 'forced_rest';
    api('/api/admin/force-event', 'POST', { userId: parseInt(uid, 10), eventId: eid, eventType: 'forced' }).then(function () { alert('已推送'); }).catch(function (e) { alert(e.message); });
  };

  document.getElementById('btn-broadcast').onclick = function () {
    var title = document.getElementById('broadcast-title').value;
    var body = document.getElementById('broadcast-body').value;
    if (!title) return alert('输入标题');
    api('/api/admin/broadcast', 'POST', { title: title, body: body }).then(function () { alert('已发布'); }).catch(function (e) { alert(e.message); });
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
        return '<div>#' + v.id + ' ' + v.ts + ' ' + (v.note || '') + ' <button class="rollback-ver" data-id="' + v.id + '">回滚</button></div>';
      }).join('');
      div.querySelectorAll('.rollback-ver').forEach(function (btn) {
        btn.onclick = function () {
          api('/api/admin/story/rollback/' + btn.dataset.id, 'POST').then(function () { alert('已回滚'); });
        };
      });
    });
  };

  document.getElementById('btn-list-backups').onclick = function () {
    var uid = document.getElementById('rollback-user-id').value;
    var slot = document.getElementById('rollback-slot').value || 0;
    if (!uid) return alert('输入用户ID');
    api('/api/admin/saves/backups/' + uid + '/' + slot).then(function (r) {
      document.getElementById('backups-list').innerHTML = (r.backups || []).map(function (b) {
        return '<div>备份#' + b.id + ' ' + b.backup_ts + ' ' + (b.reason || '') + '</div>';
      }).join('');
    }).catch(function (e) { alert(e.message); });
  };
  document.getElementById('btn-rollback').onclick = function () {
    var uid = document.getElementById('rollback-user-id').value;
    var slot = document.getElementById('rollback-slot').value || 0;
    var bid = document.getElementById('rollback-backup-id').value;
    if (!uid || !bid) return alert('输入用户ID和备份ID');
    api('/api/admin/saves/rollback', 'POST', { userId: parseInt(uid, 10), slot: parseInt(slot, 10), backupId: parseInt(bid, 10) }).then(function () { alert('已回档'); }).catch(function (e) { alert(e.message); });
  };

  document.getElementById('btn-simulate').onclick = function () {
    var n = document.getElementById('sim-n').value || 1000;
    var strategy = document.getElementById('sim-strategy').value || 'random';
    api('/api/admin/metrics/simulate?n=' + n + '&strategy=' + strategy).then(function (r) {
      document.getElementById('sim-result').textContent = JSON.stringify(r, null, 2);
    }).catch(function (e) { alert(e.message); });
  };

  function loadInviteCodes() {
    api('/api/admin/invite-codes').then(function (r) {
      var tbody = document.getElementById('invite-codes-body');
      if (!tbody) return;
      tbody.innerHTML = (r.inviteCodes || []).map(function (c) {
        var maxDisplay = c.max_uses === 0 ? '不限' : c.max_uses;
        return '<tr><td>' + c.id + '</td><td>' + (c.code || '') + '</td><td>' + maxDisplay + '</td><td>' + c.used_count + '</td><td>' + (c.note || '') + '</td><td>' + (c.created_at || '') + '</td><td><button class="invite-edit secondary" data-id="' + c.id + '" data-used="' + c.used_count + '">编辑</button> <button class="invite-del secondary" data-id="' + c.id + '">删除</button></td></tr>';
      }).join('');
      tbody.querySelectorAll('.invite-edit').forEach(function (btn) {
        btn.onclick = function () {
          var id = btn.dataset.id;
          var used = parseInt(btn.dataset.used, 10);
          var maxStr = prompt('最大使用次数（0=不限，不能小于已使用 ' + used + '）');
          if (maxStr === null) return;
          var maxUses = parseInt(maxStr, 10);
          if (isNaN(maxUses) || maxUses < 0 || maxUses < used) { alert('无效'); return; }
          var note = prompt('备注（留空不变）');
          api('/api/admin/invite-codes/' + id, 'PUT', { max_uses: maxUses, note: note === null ? undefined : note }).then(function () { loadInviteCodes(); }).catch(function (e) { alert(e.message); });
        };
      });
      tbody.querySelectorAll('.invite-del').forEach(function (btn) {
        btn.onclick = function () {
          if (!confirm('确定删除该邀请码？')) return;
          api('/api/admin/invite-codes/' + btn.dataset.id, 'DELETE').then(function () { loadInviteCodes(); }).catch(function (e) { alert(e.message); });
        };
      });
    }).catch(function (e) { alert(e.message); });
  }

  document.getElementById('btn-invite-create').onclick = function () {
    var code = document.getElementById('invite-code').value.trim();
    var maxUses = parseInt(document.getElementById('invite-max-uses').value, 10);
    var note = document.getElementById('invite-note').value.trim();
    if (!code) return alert('请输入邀请码');
    if (isNaN(maxUses) || maxUses < 0) return alert('使用次数须为 0（不限）或正整数');
    api('/api/admin/invite-codes', 'POST', { code: code, max_uses: maxUses, note: note || undefined }).then(function () {
      document.getElementById('invite-code').value = '';
      document.getElementById('invite-note').value = '';
      loadInviteCodes();
      alert('已创建');
    }).catch(function (e) { alert(e.message); });
  };
  document.getElementById('btn-invite-refresh').onclick = loadInviteCodes;

  document.getElementById('btn-ab').onclick = function () {
    var uid = document.getElementById('ab-user-id').value;
    var group = document.getElementById('ab-group').value;
    if (!uid || !group) return alert('输入用户ID和组名');
    api('/api/admin/ab-groups', 'POST', { userId: parseInt(uid, 10), groupName: group }).then(function () { alert('已设置'); }).catch(function (e) { alert(e.message); });
  };

  document.getElementById('btn-del-post').onclick = function () {
    var id = document.getElementById('del-post-id').value;
    if (!id) return alert('输入帖子ID');
    api('/api/admin/board/' + id, 'DELETE').then(function () { alert('已删'); }).catch(function (e) { alert(e.message); });
  };

  api('/api/admin/users').then(function (r) {
    var tbody = document.getElementById('users-body');
    tbody.innerHTML = (r.users || []).map(function (u) {
      return '<tr><td>' + u.id + '</td><td>' + u.username + '</td><td>' + u.role + '</td><td>' + (u.is_disabled ? '是' : '否') + '</td><td>' + (u.created_at || '') + '</td></tr>';
    }).join('');
  }).catch(function () {});

  loadInviteCodes();
})();
