(function () {
  var listEl = document.getElementById('board-list');
  var contentEl = document.getElementById('post-content');
  var btnPost = document.getElementById('btn-post');
  var pageNum = 1;
  var totalPages = 1;
  var keywordInput = document.getElementById('board-keyword');
  var btnSearch = document.getElementById('board-search');
  var pageInfo = document.getElementById('board-page-info');
  var btnPrev = document.getElementById('board-prev');
  var btnNext = document.getElementById('board-next');

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function load() {
    var kw = keywordInput ? keywordInput.value.trim() : '';
    API.board.list(pageNum, 20, kw || undefined).then(function (r) {
      if (!listEl) return;
      listEl.innerHTML = (r.posts || []).map(function (p) {
        return '<div class="item"><div class="meta">' + escapeHtml(p.username || '?') + ' · ' + escapeHtml(p.created_at || '') + '</div><div class="content">' + escapeHtml(p.content || '') + '</div></div>';
      }).join('');
      totalPages = Math.max(1, Math.ceil((r.total || 0) / (r.limit || 20)));
      if (pageInfo) pageInfo.textContent = '第 ' + pageNum + ' / ' + totalPages + ' 页，共 ' + (r.total || 0) + ' 条';
      if (btnPrev) btnPrev.disabled = pageNum <= 1;
      if (btnNext) btnNext.disabled = pageNum >= totalPages;
    }).catch(function () {
      if (listEl) listEl.innerHTML = '<p>加载失败</p>';
    });
  }

  function showBoardMsg(msg, type) {
    var el = document.getElementById('board-msg');
    if (!el) return;
    el.textContent = msg;
    el.className = 'board-msg ' + (type || '');
    el.style.display = 'block';
    setTimeout(function () { el.style.display = 'none'; }, 4000);
  }
  if (btnPost) btnPost.onclick = function () {
    var content = (contentEl && contentEl.value || '').trim();
    if (!content) return showBoardMsg('请输入内容', 'error');
    API.board.post(content).then(function () {
      contentEl.value = '';
      pageNum = 1;
      load();
      showBoardMsg('发布成功', 'success');
    }).catch(function (e) { showBoardMsg(e.message || '发布失败', 'error'); });
  };

  if (btnSearch) btnSearch.onclick = function () { pageNum = 1; load(); };
  if (btnPrev) btnPrev.onclick = function () { if (pageNum > 1) { pageNum--; load(); } };
  if (btnNext) btnNext.onclick = function () { if (pageNum < totalPages) { pageNum++; load(); } };

  load();
})();
