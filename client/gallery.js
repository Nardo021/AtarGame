/**
 * CG 回忆：已解锁 CG 列表，全屏展示；解锁由剧情/事件写 state.flags 或 gallery.unlock(id)
 */
(function (global) {
  var unlocked = {};
  var CG_LIST = [
    { id: 'cg_club_finale', title: '社团展示', path: 'assets/cg/cg-club.svg', nodeId: 'club_finale' },
    { id: 'cg_cafe_friend', title: '网吧相识', path: 'assets/cg/cg-cafe.svg', nodeId: 'cafe_friend_2' },
    { id: 'cg_family_talk', title: '家人对话', path: 'assets/cg/cg-family.svg', nodeId: 'family_talk_2' },
    { id: 'cg_growth_success', title: '高光时刻', path: 'assets/cg/cg-growth.svg', nodeId: 'growth_big_success' },
    { id: 'cg_ending_true', title: '真结局', path: 'assets/cg/cg-ending.svg', nodeId: 'ending_true' }
  ];

  function unlock(id) {
    unlocked[id] = true;
    try { if (global.localStorage) global.localStorage.setItem('gallery_' + id, '1'); } catch (e) {}
  }

  function isUnlocked(id) {
    if (unlocked[id]) return true;
    try { return global.localStorage && global.localStorage.getItem('gallery_' + id) === '1'; } catch (e) { return false; }
  }

  function loadFromStorage() {
    CG_LIST.forEach(function (c) {
      if (isUnlocked(c.id)) unlocked[c.id] = true;
    });
  }

  function onNodeComplete(nodeId) {
    CG_LIST.forEach(function (c) {
      if (c.nodeId === nodeId) unlock(c.id);
    });
  }

  function getUnlockedList() {
    loadFromStorage();
    return CG_LIST.filter(function (c) { return unlocked[c.id]; });
  }

  function getAllList() {
    return CG_LIST.slice();
  }

  function showGalleryPanel() {
    var wrap = document.getElementById('gallery-panel');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'gallery-panel';
      wrap.className = 'gallery-panel';
      wrap.innerHTML = '<h3>CG 回忆</h3><div class="gallery-grid"></div><button class="close-gallery" type="button">关闭</button>';
      document.body.appendChild(wrap);
      wrap.querySelector('.close-gallery').onclick = function () { wrap.classList.remove('open'); };
    }
    var grid = wrap.querySelector('.gallery-grid');
    grid.innerHTML = '';
    getUnlockedList().forEach(function (c) {
      var cell = document.createElement('div');
      cell.className = 'gallery-cell';
      var img = document.createElement('img');
      img.src = c.path;
      img.alt = c.title;
      img.onerror = function () { img.style.background = 'rgba(255,255,255,0.1)'; img.style.minHeight = '80px'; };
      img.onclick = function () { showCGFullscreen(c); };
      cell.appendChild(img);
      var cap = document.createElement('span');
      cap.className = 'gallery-caption';
      cap.textContent = c.title;
      cell.appendChild(cap);
      grid.appendChild(cell);
    });
    wrap.classList.add('open');
  }

  function showCGFullscreen(cg) {
    var overlay = document.getElementById('cg-fullscreen');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'cg-fullscreen';
      overlay.className = 'cg-fullscreen';
      overlay.innerHTML = '<img id="cg-fullscreen-img" alt=""/><span id="cg-fullscreen-title"></span>';
      overlay.onclick = function () { overlay.classList.remove('visible'); };
      document.body.appendChild(overlay);
    }
    var img = document.getElementById('cg-fullscreen-img');
    var title = document.getElementById('cg-fullscreen-title');
    if (img) {
      img.onerror = function () { img.style.background = 'rgba(40,40,60,0.95)'; img.alt = cg.title || 'CG'; };
      img.src = cg.path;
    }
    if (title) title.textContent = cg.title || '';
    overlay.classList.add('visible');
  }

  loadFromStorage();

  global.GALLERY = {
    unlock: unlock,
    isUnlocked: isUnlocked,
    onNodeComplete: onNodeComplete,
    getUnlockedList: getUnlockedList,
    getAllList: getAllList,
    showGalleryPanel: showGalleryPanel,
    showCGFullscreen: showCGFullscreen
  };
})(typeof window !== 'undefined' ? window : global);
