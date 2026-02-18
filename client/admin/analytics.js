/**
 * 运营分析图表：Canvas/SVG 简单图，无外部库
 */
(function (global) {
  var BASE = '';

  function api(path) {
    return fetch(BASE + path, { credentials: 'include' }).then(function (r) {
      if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || r.statusText); });
      return r.json();
    });
  }

  function q(id) { return document.getElementById(id); }

  function getRange() {
    var from = (q('range-from') && q('range-from').value) || '';
    var to = (q('range-to') && q('range-to').value) || '';
    var s = '';
    if (from && to) s = '?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to);
    return s;
  }

  function drawBarChart(svgId, data, labelKey, valueKey, title, color) {
    var svg = document.getElementById(svgId);
    if (!svg || !data.length) return;
    var w = svg.clientWidth || 400;
    var h = svg.clientHeight || 220;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    var max = Math.max(1, Math.max.apply(null, data.map(function (d) { return d[valueKey] || 0; })));
    var barW = Math.max(8, (w - 60) / data.length - 4);
    var pad = 40;
    var chartW = w - pad * 2;
    var chartH = h - pad - 20;
    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    data.forEach(function (d, i) {
      var v = d[valueKey] || 0;
      var x = pad + i * (chartW / data.length) + 4;
      var bw = Math.max(2, barW);
      var bh = (v / max) * chartH;
      var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', h - pad - bh);
      rect.setAttribute('width', bw);
      rect.setAttribute('height', bh);
      rect.setAttribute('fill', color || '#e94560');
      g.appendChild(rect);
      var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x + bw / 2);
      text.setAttribute('y', h - 5);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '10');
      text.setAttribute('fill', '#aaa');
      text.textContent = String(d[labelKey]).slice(0, 8);
      g.appendChild(text);
    });
    svg.innerHTML = '';
    var titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    titleEl.setAttribute('x', w / 2);
    titleEl.setAttribute('y', 16);
    titleEl.setAttribute('text-anchor', 'middle');
    titleEl.setAttribute('font-size', '12');
    titleEl.setAttribute('fill', '#eee');
    titleEl.textContent = title || '';
    svg.appendChild(titleEl);
    svg.appendChild(g);
  }

  function drawMultiBar(svgId, data, labelKey, valueKeys, title, colors) {
    var svg = document.getElementById(svgId);
    if (!svg || !data.length) return;
    var w = svg.clientWidth || 400;
    var h = svg.clientHeight || 220;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    var max = 1;
    valueKeys.forEach(function (k) {
      data.forEach(function (d) { max = Math.max(max, d[k] || 0); });
    });
    var pad = 40;
    var chartW = w - pad * 2;
    var chartH = h - pad - 20;
    var barW = Math.max(4, (chartW / data.length) / (valueKeys.length + 1));
    var colorsArr = colors || ['#e94560', '#78c4ff', '#6bffaa'];
    svg.innerHTML = '';
    var titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    titleEl.setAttribute('x', w / 2);
    titleEl.setAttribute('y', 16);
    titleEl.setAttribute('text-anchor', 'middle');
    titleEl.setAttribute('font-size', '12');
    titleEl.setAttribute('fill', '#eee');
    titleEl.textContent = title || '';
    svg.appendChild(titleEl);
    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    data.forEach(function (d, i) {
      var x0 = pad + i * (chartW / data.length);
      valueKeys.forEach(function (k, j) {
        var v = d[k] || 0;
        var bh = (v / max) * chartH;
        var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x0 + j * barW);
        rect.setAttribute('y', h - pad - bh);
        rect.setAttribute('width', barW - 2);
        rect.setAttribute('height', bh);
        rect.setAttribute('fill', colorsArr[j] || '#e94560');
        g.appendChild(rect);
      });
      var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x0 + (barW * valueKeys.length) / 2);
      text.setAttribute('y', h - 5);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '9');
      text.setAttribute('fill', '#aaa');
      text.textContent = String(d[labelKey]).slice(0, 6);
      g.appendChild(text);
    });
    svg.appendChild(g);
  }

  function drawHeatmapTable(containerId, heatmapRows) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var locations = [];
    var types = [];
    var map = {};
    heatmapRows.forEach(function (r) {
      if (locations.indexOf(r.location) < 0) locations.push(r.location);
      if (types.indexOf(r.action_type) < 0) types.push(r.action_type);
      map[r.location + '|' + r.action_type] = r.cnt;
    });
    var max = Math.max(1, Math.max.apply(null, heatmapRows.map(function (r) { return r.cnt; })));
    var html = '<table class="heat-table"><thead><tr><th>地点 \\ 行为</th>';
    types.forEach(function (t) { html += '<th>' + t + '</th>'; });
    html += '</tr></thead><tbody>';
    locations.forEach(function (loc) {
      html += '<tr><td>' + loc + '</td>';
      types.forEach(function (t) {
        var v = map[loc + '|' + t] || 0;
        var pct = max ? (v / max) : 0;
        var bg = 'rgba(233,69,96,' + (0.2 + 0.8 * pct) + ')';
        html += '<td style="background:' + bg + '">' + v + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  }

  function drawNodeFlow(svgId, nodes, edges) {
    var svg = document.getElementById(svgId);
    if (!svg) return;
    var w = svg.clientWidth || 500;
    var h = svg.clientHeight || 280;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    if (!nodes.length) { svg.innerHTML = '<text x="' + w/2 + '" y="' + h/2 + '" text-anchor="middle" fill="#888">无节点数据</text>'; return; }
    var maxCnt = Math.max(1, Math.max.apply(null, nodes.map(function (n) { return n.count; })));
    var r = 20;
    var cols = Math.ceil(Math.sqrt(nodes.length));
    var byId = {};
    nodes.forEach(function (n, i) {
      var row = Math.floor(i / cols);
      var col = i % cols;
      byId[n.node_id] = { x: 60 + col * (w - 80) / cols, y: 50 + row * Math.min(80, (h - 80) / Math.ceil(nodes.length / cols)), count: n.count };
    });
    var maxEdge = 1;
    edges.forEach(function (e) { maxEdge = Math.max(maxEdge, e.count); });
    svg.innerHTML = '';
    edges.forEach(function (e) {
      var from = byId[e.from];
      var to = byId[e.to];
      if (!from || !to) return;
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', from.x);
      line.setAttribute('y1', from.y);
      line.setAttribute('x2', to.x);
      line.setAttribute('y2', to.y);
      line.setAttribute('stroke', 'rgba(120,196,255,0.6)');
      line.setAttribute('stroke-width', Math.max(1, 2 * e.count / maxEdge));
      svg.appendChild(line);
    });
    nodes.forEach(function (n) {
      var pos = byId[n.node_id];
      if (!pos) return;
      var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', pos.x);
      circle.setAttribute('cy', pos.y);
      circle.setAttribute('r', r);
      circle.setAttribute('fill', '#2a2a4a');
      circle.setAttribute('stroke', '#78c4ff');
      svg.appendChild(circle);
      var text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', pos.x);
      text.setAttribute('y', pos.y + 4);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '10');
      text.setAttribute('fill', '#eee');
      text.textContent = (n.node_id || '?').slice(0, 6);
      svg.appendChild(text);
    });
  }

  function loadAll() {
    var range = getRange();
    api('/api/admin/metrics/retention' + range).then(function (data) {
      var list = (data.retention || []).slice(-14);
      drawMultiBar('chart-retention', list, 'cohort_date', ['d1_retained', 'd7_retained', 'd30_retained'], '留存 D1/D7/D30（人数）', ['#e94560', '#78c4ff', '#6bffaa']);
    }).catch(function () {});
    api('/api/admin/metrics/endings').then(function (data) {
      drawBarChart('chart-endings', data.by_ending || [], 'ending', 'count', '结局分布', '#6bffaa');
    }).catch(function () {});
    api('/api/admin/metrics/activity' + range).then(function (data) {
      var byHour = (data.by_hour || []).map(function (r) { return { hour: (r.hour != null ? r.hour : 0) + 'h', count: r.cnt || 0 }; });
      byHour.sort(function (a, b) { return parseInt(a.hour, 10) - parseInt(b.hour, 10); });
      drawBarChart('chart-activity-hour', byHour.length ? byHour : [{ hour: '0h', count: 0 }], 'hour', 'count', '活跃时段（按小时）', '#78c4ff');
    }).catch(function () {});
    api('/api/admin/metrics/events-top' + range).then(function (data) {
      var list = (data.events || []).slice(0, 15);
      drawBarChart('chart-events', list, 'event_id', 'cnt', '事件 Top', '#e94560');
    }).catch(function () {});
    api('/api/admin/metrics/heatmap' + range).then(function (data) {
      drawHeatmapTable('chart-heatmap', data.heatmap || []);
    }).catch(function () {});
    api('/api/admin/metrics/node-flow' + range).then(function (data) {
      drawNodeFlow('chart-nodeflow', data.nodes || [], data.edges || []);
    }).catch(function () {});
    api('/api/admin/metrics/funnel' + range).then(function (data) {
      var el = document.getElementById('chart-funnel');
      if (!el) return;
      var list = data.funnel || [];
      el.innerHTML = '<table class="heat-table"><tr><th>阶段</th><th>人数</th></tr>' +
        list.map(function (f) { return '<tr><td>' + f.stage + '</td><td>' + f.count + '</td></tr>'; }).join('') + '</table>';
    }).catch(function () {});
    api('/api/admin/metrics/churn-risk' + range).then(function (data) {
      var el = document.getElementById('chart-churn');
      if (!el) return;
      el.innerHTML = '<p>触发强制事件人数: ' + (data.total_forced || 0) + '</p><p>3 天内未活跃(劝退): ' + (data.churned || 0) + '</p><p>劝退率: ' + ((data.churn_rate || 0) * 100).toFixed(1) + '%</p>';
    }).catch(function () {});
    api('/api/admin/metrics/ab').then(function (data) {
      var el = document.getElementById('chart-ab');
      if (!el) return;
      var list = data.by_group || [];
      el.innerHTML = '<table class="heat-table"><thead><tr><th>组</th><th>用户数</th><th>ATAR 均值</th><th>留存 D1</th><th>留存 D7</th><th>结局分布</th></tr></thead><tbody>' +
        list.map(function (g) {
          var endings = g.endings ? Object.keys(g.endings).map(function (k) { return k + ':' + g.endings[k]; }).join(', ') : '-';
          return '<tr><td>' + (g.group || '') + '</td><td>' + (g.users || 0) + '</td><td>' + (g.atar_mean != null ? g.atar_mean.toFixed(1) : '-') + '</td><td>' + ((g.retention_d1 != null ? g.retention_d1 * 100 : 0).toFixed(1)) + '%</td><td>' + ((g.retention_d7 != null ? g.retention_d7 * 100 : 0).toFixed(1)) + '%</td><td>' + endings + '</td></tr>';
        }).join('') + '</tbody></table>';
    }).catch(function () {});
  }

  global.AnalyticsCharts = {
    api: api,
    getRange: getRange,
    loadAll: loadAll,
    drawBarChart: drawBarChart,
    drawMultiBar: drawMultiBar,
    drawHeatmapTable: drawHeatmapTable,
    drawNodeFlow: drawNodeFlow
  };
})();
