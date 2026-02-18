(function () {
  var BASE = '';
  function api(path) {
    return fetch(BASE + path, { credentials: 'include' }).then(function (r) {
      if (!r.ok) throw new Error(r.statusText);
      return r.json();
    });
  }

  function drawPie(canvasId, data) {
    var canvas = document.getElementById(canvasId);
    if (!canvas || !data || !Object.keys(data).length) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    var total = Object.values(data).reduce(function (a, b) { return a + b; }, 0);
    if (total === 0) return;
    var colors = ['#e94560', '#78c4ff', '#4ade80'];
    var start = 0;
    var i = 0;
    Object.entries(data).forEach(function (entry) {
      var slice = (entry[1] / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(w / 2, h / 2);
      ctx.arc(w / 2, h / 2, Math.min(w, h) / 2 - 10, start, start + slice);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ctx.strokeStyle = '#1a1a2e';
      ctx.stroke();
      start += slice;
      i++;
    });
  }

  function drawBar(canvasId, labels, values) {
    var canvas = document.getElementById(canvasId);
    if (!canvas || !values.length) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    var max = Math.max.apply(null, values) || 1;
    var barW = Math.max(4, (w - 40) / values.length - 4);
    ctx.clearRect(0, 0, w, h);
    values.forEach(function (v, i) {
      var x = 20 + i * (barW + 4);
      var height = (v / max) * (h - 30);
      ctx.fillStyle = '#78c4ff';
      ctx.fillRect(x, h - height - 10, barW, height);
    });
  }

  document.getElementById('btn-retention').onclick = function () {
    api('/api/admin/metrics/retention').then(function (r) {
      document.getElementById('retention-data').innerHTML = '<pre>' + JSON.stringify(r, null, 2) + '</pre>';
    }).catch(function (e) { document.getElementById('retention-data').innerHTML = e.message; });
  };

  document.getElementById('btn-node-flow').onclick = function () {
    api('/api/admin/metrics/node-flow').then(function (r) {
      document.getElementById('node-flow-data').innerHTML = '<pre>' + JSON.stringify(r, null, 2) + '</pre>';
    }).catch(function (e) { document.getElementById('node-flow-data').innerHTML = e.message; });
  };

  document.getElementById('btn-funnel').onclick = function () {
    api('/api/admin/metrics/funnel').then(function (r) {
      document.getElementById('funnel-data').innerHTML = '<pre>' + JSON.stringify(r, null, 2) + '</pre>';
    }).catch(function (e) { document.getElementById('funnel-data').innerHTML = e.message; });
  };

  document.getElementById('btn-endings').onclick = function () {
    api('/api/admin/metrics/endings').then(function (r) {
      document.getElementById('endings-data').innerHTML = '<pre>' + JSON.stringify(r, null, 2) + '</pre>';
      drawPie('chart-endings', r.endings || {});
    }).catch(function (e) { document.getElementById('endings-data').innerHTML = e.message; });
  };

  document.getElementById('btn-events').onclick = function () {
    api('/api/admin/metrics/events-top').then(function (r) {
      document.getElementById('events-data').innerHTML = '<pre>' + JSON.stringify(r, null, 2) + '</pre>';
    }).catch(function (e) { document.getElementById('events-data').innerHTML = e.message; });
  };

  document.getElementById('btn-activity').onclick = function () {
    api('/api/admin/metrics/activity').then(function (r) {
      document.getElementById('activity-data').innerHTML = '<pre>' + JSON.stringify(r, null, 2) + '</pre>';
      var byHour = r.by_hour || [];
      drawBar('chart-activity', byHour.map(function (x) { return x.h; }), byHour.map(function (x) { return x.c; }));
    }).catch(function (e) { document.getElementById('activity-data').innerHTML = e.message; });
  };
})();
