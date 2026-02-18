(function () {
  function api(path, method, body) {
    var opts = { method: method || 'GET', credentials: 'include', headers: {} };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = typeof body === 'string' ? body : JSON.stringify(body); }
    return fetch(path, opts).then(function (r) {
      if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || r.statusText); });
      return r.json();
    });
  }

  function renderList() {
    api('/api/admin/users').then(function (r) {
      var tbody = document.getElementById('users-tbody');
      tbody.innerHTML = (r.users || []).map(function (u) {
        var dis = u.is_disabled ? '是' : '否';
        return '<tr>' +
          '<td>' + u.id + '</td>' +
          '<td>' + (u.username || '') + '</td>' +
          '<td>' + (u.role || '') + '</td>' +
          '<td>' + dis + '</td>' +
          '<td>' + (u.created_at || '') + '</td>' +
          '<td>' + (u.saves_count != null ? u.saves_count : '-') + '</td>' +
          '<td>' + (u.action_count != null ? u.action_count : '-') + '</td>' +
          '<td>' + (u.last_save_at || '-') + '</td>' +
          '<td>' + (u.last_action_at || '-') + '</td>' +
          '<td><button class="btn-small secondary detail-btn" data-id="' + u.id + '">详情</button></td>' +
          '</tr>';
      }).join('');
      tbody.querySelectorAll('.detail-btn').forEach(function (btn) {
        btn.onclick = function () { showDetail(parseInt(btn.dataset.id, 10)); };
      });
    }).catch(function (e) { alert(e.message); });
  }

  function showDetail(userId) {
    api('/api/admin/users/' + userId).then(function (data) {
      var u = data.user;
      var section = document.getElementById('user-detail-section');
      document.getElementById('detail-username').textContent = u.username ? '（' + u.username + '）' : '';
      var basic = [
        { label: 'ID', value: u.id },
        { label: '用户名', value: u.username },
        { label: '角色', value: u.role },
        { label: '禁用', value: u.is_disabled ? '是' : '否' },
        { label: '注册时间', value: u.created_at },
        { label: '存档数', value: data.saves_count },
        { label: '行动总数', value: data.action_count }
      ];
      document.getElementById('detail-basic').innerHTML = basic.map(function (b) {
        return '<div class="user-detail-card"><label>' + b.label + '</label><span>' + (b.value != null ? b.value : '-') + '</span></div>';
      }).join('');

      document.getElementById('detail-state').textContent = data.latest_state
        ? JSON.stringify(data.latest_state, null, 2)
        : '无存档数据';

      document.getElementById('detail-saves').innerHTML = (data.saves || []).length
        ? '<table><thead><tr><th>槽位</th><th>更新时间</th></tr></thead><tbody>' +
          (data.saves || []).map(function (s) {
            return '<tr><td>' + s.slot + '</td><td>' + (s.updated_at || '') + '</td></tr>';
          }).join('') + '</tbody></table>'
        : '<p>无存档</p>';

      document.getElementById('detail-actions').innerHTML = (data.last_actions || []).length
        ? '<table><thead><tr><th>时间</th><th>日期/时段</th><th>地点</th><th>类型</th></tr></thead><tbody>' +
          (data.last_actions || []).map(function (a) {
            return '<tr><td>' + (a.ts || '') + '</td><td>' + (a.date_iso || '') + ' ' + (a.time_block || '') + '</td><td>' + (a.location || '') + '</td><td>' + (a.action_type || '') + '</td></tr>';
          }).join('') + '</tbody></table>'
        : '<p>无行动记录</p>';

      document.getElementById('btn-freeze-detail').onclick = function () {
        api('/api/admin/freeze-user/' + userId, 'POST').then(function () { alert('已冻结'); renderList(); showDetail(userId); }).catch(function (e) { alert(e.message); });
      };
      document.getElementById('btn-unfreeze-detail').onclick = function () {
        api('/api/admin/unfreeze-user/' + userId, 'POST').then(function () { alert('已解冻'); renderList(); showDetail(userId); }).catch(function (e) { alert(e.message); });
      };

      section.style.display = 'block';
      section.scrollIntoView({ behavior: 'smooth' });
    }).catch(function (e) { alert(e.message); });
  }

  document.getElementById('btn-refresh-users').onclick = renderList;
  document.getElementById('btn-close-detail').onclick = function () {
    document.getElementById('user-detail-section').style.display = 'none';
  };

  renderList();
})();
