(function () {
  function api(path, method, body) {
    var opts = { method: method || 'GET', credentials: 'include', headers: {} };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = typeof body === 'string' ? body : JSON.stringify(body); }
    return fetch(path, opts).then(function (r) {
      if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || r.statusText); });
      return r.json();
    });
  }
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
          var id = btn.dataset.id, used = parseInt(btn.dataset.used, 10);
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
  loadInviteCodes();
})();
