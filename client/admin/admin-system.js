(function () {
  function api(path, method, body) {
    var opts = { method: method || 'GET', credentials: 'include', headers: {} };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = typeof body === 'string' ? body : JSON.stringify(body); }
    return fetch(path, opts).then(function (r) {
      if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || j.message || r.statusText); });
      return r.json();
    });
  }

  var strategyToMix = {
    random: { study: 0.25, social: 0.25, mixed: 0.25, random: 0.25 },
    study: { study: 1, social: 0, mixed: 0, random: 0 },
    social: { study: 0, social: 1, mixed: 0, random: 0 },
    mixed: { study: 0, social: 0, mixed: 1, random: 0 }
  };

  document.getElementById('btn-simulate').onclick = function () {
    var nEl = document.getElementById('sim-n');
    var n = Math.max(1, Math.min(10000, parseInt(nEl && nEl.value, 10) || 1000));
    var strategy = (document.getElementById('sim-strategy') && document.getElementById('sim-strategy').value) || 'random';
    var seedEl = document.getElementById('sim-seed');
    var seed = seedEl && seedEl.value.trim() ? parseInt(seedEl.value, 10) : undefined;
    document.getElementById('sim-result').textContent = '运行中…';
    api('/api/admin/simulate', 'POST', { n: n, strategyMix: strategyToMix[strategy] || strategyToMix.random, seed: seed }).then(function (r) {
      document.getElementById('sim-result').textContent = JSON.stringify(r.result || r, null, 2);
      loadRuns();
    }).catch(function (e) {
      document.getElementById('sim-result').textContent = '失败: ' + (e.message || e);
    });
  };

  function loadRuns() {
    var listEl = document.getElementById('sim-runs-list');
    if (!listEl) return;
    api('/api/admin/simulation-runs?limit=20').then(function (r) {
      listEl.innerHTML = (r.runs || []).map(function (run) {
        var params = run.params_json ? (typeof run.params_json === 'string' ? JSON.parse(run.params_json) : run.params_json) : {};
        var res = run.result_json ? (typeof run.result_json === 'string' ? JSON.parse(run.result_json) : run.result_json) : {};
        return '<li style="margin:8px 0;"><strong>' + (run.ts || run.id) + '</strong> n=' + (params.n || '') + ' — atar分布: ' + (res.atar_distribution ? JSON.stringify(res.atar_distribution) : '') + '，结局: ' + (res.ending_distribution ? JSON.stringify(res.ending_distribution) : '') + '，平均stress: ' + (res.avg_stress != null ? res.avg_stress.toFixed(1) : '') + '，强制事件总次数: ' + (res.total_forced_events || '') + '</li>';
      }).join('') || '<li>暂无记录</li>';
    }).catch(function () { listEl.innerHTML = '<li>加载失败</li>'; });
  }

  var btnLoadRuns = document.getElementById('btn-load-runs');
  if (btnLoadRuns) btnLoadRuns.onclick = loadRuns;

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

  if (document.getElementById('sim-runs-list')) loadRuns();
})();
