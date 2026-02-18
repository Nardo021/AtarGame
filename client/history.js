/**
 * 对话历史 Log：可滚动查看，按日期/节点/事件分类
 */
(function (global) {
  var entries = [];
  var MAX = 500;

  function add(opt) {
    entries.push({
      ts: Date.now(),
      date_iso: opt.date_iso || '',
      time_block: opt.time_block || '',
      node_id: opt.node_id || '',
      event_type: opt.event_type || 'dialogue',
      text: opt.text || '',
      speaker: opt.speaker || '',
      choice_id: opt.choice_id || ''
    });
    if (entries.length > MAX) entries.shift();
  }

  function getByDate() {
    var byDate = {};
    entries.forEach(function (e) {
      var d = e.date_iso || 'unknown';
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(e);
    });
    return byDate;
  }

  function getByNode() {
    var byNode = {};
    entries.forEach(function (e) {
      var n = e.node_id || 'unknown';
      if (!byNode[n]) byNode[n] = [];
      byNode[n].push(e);
    });
    return byNode;
  }

  function getByEventType() {
    var byType = {};
    entries.forEach(function (e) {
      var t = e.event_type || 'dialogue';
      if (!byType[t]) byType[t] = [];
      byType[t].push(e);
    });
    return byType;
  }

  function getAll() { return entries.slice(); }
  function clear() { entries = []; }

  global.HISTORY = {
    add: add,
    getByDate: getByDate,
    getByNode: getByNode,
    getByEventType: getByEventType,
    getAll: getAll,
    clear: clear
  };
})(typeof window !== 'undefined' ? window : global);
