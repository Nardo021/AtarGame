(function () {
  var listEl = document.getElementById('board-list');
  var contentEl = document.getElementById('post-content');
  var btnPost = document.getElementById('btn-post');

  function load() {
    API.board.list(50).then(function (r) {
      if (!listEl) return;
      listEl.innerHTML = (r.posts || []).map(function (p) {
        return '<div class="item"><div class="meta">' + (p.username || '?') + ' · ' + (p.created_at || '') + '</div><div class="content">' + (p.content || '').replace(/</g, '&lt;') + '</div></div>';
      }).join('');
    }).catch(function () {
      if (listEl) listEl.innerHTML = '<p>加载失败</p>';
    });
  }

  if (btnPost) btnPost.onclick = function () {
    var content = (contentEl && contentEl.value || '').trim();
    if (!content) return alert('请输入内容');
    API.board.post(content).then(function () {
      contentEl.value = '';
      load();
    }).catch(function (e) { alert(e.message || '发布失败'); });
  };

  load();
})();
