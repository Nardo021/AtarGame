(function () {
  var tbody = document.getElementById('lb-body');
  var modeSelect = document.getElementById('mode');
  function load() {
    var mode = modeSelect ? modeSelect.value : 'best_ever';
    API.leaderboard(50, mode).then(function (r) {
      if (!tbody) return;
      tbody.innerHTML = (r.leaderboard || []).map(function (row, i) {
        return '<tr><td>' + (i + 1) + '</td><td>' + (row.username || '?') + '</td><td>' + (row.atar != null ? row.atar : '-') + '</td><td>' + (row.date || '') + '</td></tr>';
      }).join('');
    }).catch(function () {
      if (tbody) tbody.innerHTML = '<tr><td colspan="4">加载失败</td></tr>';
    });
  }
  if (modeSelect) modeSelect.onchange = load;
  load();
})();
