/**
 * UI：资源加载(manifest+SVG回退)、MAP/SCENE 渲染、transitionManager(fade/slide/blur)、打字机(可点击跳过)、HUD、返回地图(上课锁定)
 */
(function (global) {
  var GAME = global.GAME;
  var API = global.API;
  var MAP = global.MAP;
  var SCHEDULER = global.SCHEDULER;

  var manifest = { backgrounds: [], characters: [] };
  var typewriterTimer = null;
  var typewriterIndex = 0;
  var typewriterFullText = '';
  var typewriterSpeed = 28;
  var inputLocked = false;

  function $(id) { return document.getElementById(id); }
  function qs(s) { return document.querySelector(s); }

  function showToast(msg, type) {
    type = type || 'info';
    var container = $('game-toast');
    if (!container) return;
    var el = document.createElement('div');
    el.className = 'game-toast-item' + (type === 'error' ? ' error' : type === 'success' ? ' success' : '');
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 3000);
  }

  function showModal(opts) {
    opts = opts || {};
    var overlay = $('game-modal');
    var titleEl = $('game-modal-title');
    var bodyEl = $('game-modal-body');
    var inputWrap = $('game-modal-input-wrap');
    var inputEl = $('game-modal-input');
    var actionsEl = $('game-modal-actions');
    if (!overlay || !titleEl || !bodyEl || !actionsEl) return;
    var box = overlay.querySelector('.game-modal-box');
    if (box) { var prev = box.querySelector('.game-modal-choices'); if (prev) prev.parentNode.removeChild(prev); }
    overlay._removeChoices = null;
    titleEl.textContent = opts.title || '';
    bodyEl.textContent = opts.body || '';
    bodyEl.style.display = opts.body ? 'block' : 'none';
    inputWrap.style.display = 'none';
    inputEl.value = opts.inputValue != null ? String(opts.inputValue) : '';
    inputEl.placeholder = opts.inputPlaceholder || '';
    actionsEl.innerHTML = '';
    if (opts.choices && opts.choices.length > 0) {
      bodyEl.style.display = opts.body ? 'block' : 'none';
      var choicesWrap = document.createElement('div');
      choicesWrap.className = 'game-modal-choices';
      opts.choices.forEach(function (c) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'game-modal-choice';
        btn.textContent = c.text != null ? c.text : c.value;
        btn.onclick = function () {
          closeModal();
          if (opts.onSelect) opts.onSelect(c.value);
        };
        choicesWrap.appendChild(btn);
      });
      bodyEl.parentNode.insertBefore(choicesWrap, bodyEl.nextSibling);
      var removeChoices = function () {
        if (choicesWrap.parentNode) choicesWrap.parentNode.removeChild(choicesWrap);
      };
      overlay._removeChoices = removeChoices;
      var cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.textContent = global.I18n && global.I18n.t('btn_cancel') ? global.I18n.t('btn_cancel') : '取消';
      cancelBtn.onclick = function () { closeModal(); };
      actionsEl.appendChild(cancelBtn);
    } else {
      if (opts.inputLabel != null) {
        inputWrap.style.display = 'block';
        inputEl.placeholder = opts.inputPlaceholder || opts.inputLabel;
      }
      var buttons = opts.buttons || [];
      if (buttons.length === 0 && !opts.onConfirm) buttons.push({ text: global.I18n && global.I18n.t('btn_ok') ? global.I18n.t('btn_ok') : '确定', primary: true });
      buttons.forEach(function (b) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = b.text;
        if (b.primary) btn.className = 'primary';
        btn.onclick = function () {
          closeModal();
          if (b.onClick) b.onClick();
          if (opts.onConfirm && b.primary) opts.onConfirm(inputEl.value.trim());
        };
        actionsEl.appendChild(btn);
      });
      if (opts.onConfirm && buttons.length === 0) {
        var okBtn = actionsEl.querySelector('button.primary') || actionsEl.querySelector('button');
        if (okBtn) okBtn.onclick = function () { closeModal(); opts.onConfirm(inputEl.value.trim()); };
      }
    }
    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
    var backdrop = overlay.querySelector('.game-modal-backdrop');
    if (backdrop) {
      backdrop.onclick = function () { closeModal(); if (overlay._removeChoices) overlay._removeChoices(); };
    }
  }

  function closeModal() {
    var overlay = $('game-modal');
    if (!overlay) return;
    if (overlay._removeChoices) overlay._removeChoices();
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
  }

  function getDefaultTransition() {
    return (global.__CONFIG__ && global.__CONFIG__.defaultTransition) || 'fade';
  }

  function setInputLock(lock) {
    inputLocked = !!lock;
    var wrap = $('game-view-wrap');
    if (wrap) wrap.style.pointerEvents = inputLocked ? 'none' : 'auto';
  }

  var transitionManager = {
    run: function (type, fromView, toView, callback) {
      type = type || getDefaultTransition();
      var overlay = $('transition-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'transition-overlay';
        overlay.className = 'transition-overlay';
        document.body.appendChild(overlay);
      }
      setInputLock(true);
      overlay.classList.remove('transition-fade', 'transition-slide', 'transition-blur', 'transition-visible');
      overlay.classList.add('transition-' + type);
      overlay.classList.add('transition-visible');
      overlay.style.opacity = '';
      overlay.style.pointerEvents = '';
      overlay.offsetHeight;
      setTimeout(function () {
        if (typeof callback === 'function') callback();
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            setTimeout(function () {
              overlay.classList.remove('transition-visible');
              overlay.style.opacity = '0';
              overlay.style.pointerEvents = 'none';
              setInputLock(false);
            }, 280);
          });
        });
      }, 280);
    }
  };

  function loadManifest() {
    return fetch('assets/assets_manifest.json').then(function (r) { return r.json(); }).then(function (m) {
      manifest = m || manifest;
      return manifest;
    }).catch(function () { return manifest; });
  }

  function getBgPath(sceneId) {
    var map = { classroom: 'bg-classroom', corridor: 'bg-corridor', field: 'bg-field', clubroom: 'bg-clubroom', home: 'bg-bedroom', internet_cafe: 'bg-internet_cafe', map: 'bg-map' };
    var id = map[sceneId] || 'bg-classroom';
    var list = manifest.backgrounds || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i].path || ('assets/' + id + '.svg');
    }
    return 'assets/' + id + '.svg';
  }

  function getCharPath(charId, expression) {
    if (!charId) return '';
    var list = manifest.characters || [];
    var baseId = charId;
    var suffix = (expression && expression !== 'normal') ? '_' + expression : '';
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === charId) {
        var path = list[i].path || ('assets/' + charId + '.svg');
        if (suffix) path = path.replace(/\.(svg|png|jpg)$/, suffix + '.$1');
        return path;
      }
    }
    return 'assets/' + charId + suffix + '.svg';
  }

  function setBackground(sceneId) {
    var path = getBgPath(sceneId);
    var base = path.replace(/\.svg$/, '').replace(/\.(jpg|png|webp)$/, '');
    var el = qs('.game-bg');
    if (!el) return;
    el.style.backgroundImage = 'url(' + base + '.svg)';
    el.style.backgroundSize = 'cover';
  }

  function setMapBg() {
    var path = getBgPath('map') || 'assets/bg-map.svg';
    var el = qs('.map-bg');
    if (!el) return;
    var base = path.replace(/\.svg$/, '');
    el.style.backgroundColor = '#1a2e1a';
    el.style.backgroundImage = 'url(' + base + '.svg)';
    el.style.backgroundSize = 'cover';
  }

  function setCharacter(side, characterId, expression) {
    var id = side === 'left' ? 'char-left' : 'char-right';
    var imgId = id + '-img';
    var wrap = $(id);
    var img = $(imgId);
    if (!wrap || !img) return;
    if (!characterId) { wrap.classList.remove('visible'); wrap.classList.remove('focus'); img.src = ''; return; }
    var path = getCharPath(characterId, expression || '');
    var base = path.replace(/\.(svg|png|jpg)$/, '');
    img.onerror = function () { img.src = base + '.svg'; };
    img.src = base + '.svg';
    wrap.classList.add('visible');
  }

  function setCharacterFocus(side) {
    var left = $('char-left');
    var right = $('char-right');
    if (left) left.classList.toggle('focus', side === 'left');
    if (right) right.classList.toggle('focus', side === 'right');
  }

  function showCG(cgIdOrNodeId) {
    var gallery = global.GALLERY;
    if (!gallery) return;
    var list = gallery.getAllList ? gallery.getAllList() : [];
    var cg = list.filter(function (c) { return c.id === cgIdOrNodeId || c.nodeId === cgIdOrNodeId; })[0];
    if (cg) {
      gallery.unlock(cg.id);
      gallery.showCGFullscreen(cg);
    }
  }

  function dayOfWeek(dateIso) {
    if (!dateIso) return '';
    var p = dateIso.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    var w = d.getDay();
    var arr = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return arr[w] || '';
  }

  function updateHUD(state) {
    var h = $('hud');
    if (!h) return;
    var atar = $('hud-atar');
    var mood = $('hud-mood');
    var health = $('hud-health');
    var stress = $('hud-stress');
    var fatigue = $('hud-fatigue');
    var loc = $('hud-location');
    var time = $('hud-time');
    if (atar) atar.textContent = state.atar != null ? state.atar : '-';
    if (mood) mood.textContent = state.mood != null ? state.mood : '-';
    if (health) health.textContent = state.health != null ? state.health : '-';
    if (stress) stress.textContent = state.stress != null ? state.stress : '-';
    if (fatigue) fatigue.textContent = state.fatigue != null ? state.fatigue : '-';
    if (loc) loc.textContent = (global.I18n && global.I18n.locationName(state.location)) || state.location;
    if (time) time.textContent = (state.date_iso || '') + ' ' + (dayOfWeek(state.date_iso) || '') + ' ' + (state.time_block || '');
    updateBackToMapButton(state);
  }

  function updateBackToMapButton(state) {
    var btn = $('btn-back-map');
    if (!btn) return;
    var inClass = SCHEDULER && SCHEDULER.isClassBlock && state.time_block && SCHEDULER.isClassBlock(state.time_block);
    var inSchool = MAP && MAP.sceneToZone && MAP.sceneToZone(state.location) === 'school';
    var lock = inClass && inSchool;
    btn.disabled = !!lock;
    btn.title = lock ? '上课时段不可返回地图' : '返回地图';
  }

  function showScreen(id) {
    ['login-screen', 'game-screen'].forEach(function (s) {
      var el = document.getElementById(s);
      if (el) el.style.display = s === id ? 'block' : 'none';
    });
  }

  function showMapView() {
    var mapView = $('map-view');
    var sceneView = $('scene-view');
    if (mapView) mapView.style.display = 'block';
    if (sceneView) sceneView.style.display = 'none';
    setMapBg();
    renderMapHotspots();
  }

  function showSceneView() {
    var mapView = $('map-view');
    var sceneView = $('scene-view');
    if (mapView) mapView.style.display = 'none';
    if (sceneView) sceneView.style.display = 'block';
    setBackground(GAME.getState().location);
  }

  function renderMapHotspots() {
    var container = $('map-hotspots');
    if (!container || !MAP) return;
    var state = GAME.getState();
    var hotspots = MAP.getAvailableHotspots ? MAP.getAvailableHotspots(state) : (MAP.getHotspots ? MAP.getHotspots() : []);
    container.innerHTML = '';
    hotspots.forEach(function (h) {
      var r = h.rect || {};
      var div = document.createElement('div');
      div.className = 'map-hotspot';
      div.style.left = (r.x * 100) + '%';
      div.style.top = (r.y * 100) + '%';
      div.style.width = (r.w * 100) + '%';
      div.style.height = (r.h * 100) + '%';
      div.title = (global.I18n && global.I18n.locationName(h.sceneId)) || h.sceneId;
      div.onclick = function () {
        transitionManager.run(getDefaultTransition(), 'map', 'scene', function () { GAME.enterScene(h.sceneId); });
      };
      container.appendChild(div);
    });
  }

  function showDialogue(text, opts) {
    opts = opts || {};
    var box = $('dialogue-box');
    var content = $('dialogue-text');
    if (!box || !content) return;
    box.classList.remove('hidden');
    typewriterFullText = text || '';
    typewriterIndex = 0;
    if (GAME.getSkipMode && GAME.getSkipMode()) {
      content.textContent = typewriterFullText;
      if (opts.onComplete) opts.onComplete();
      return;
    }
    content.textContent = '';
    if (typewriterTimer) clearInterval(typewriterTimer);
    typewriterTimer = setInterval(function () {
      if (typewriterIndex >= typewriterFullText.length) {
        clearInterval(typewriterTimer);
        typewriterTimer = null;
        if (opts.onComplete) opts.onComplete();
        return;
      }
      content.textContent = typewriterFullText.slice(0, typewriterIndex + 1);
      typewriterIndex++;
    }, typewriterSpeed);
  }

  function skipTypewriter() {
    if (typewriterTimer) {
      clearInterval(typewriterTimer);
      typewriterTimer = null;
    }
    var content = $('dialogue-text');
    if (content) content.textContent = typewriterFullText;
  }

  function showChoices(choices, node) {
    var container = $('choices-container');
    if (!container) return;
    container.innerHTML = '';
    (choices || []).forEach(function (c) {
      var btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = c.text;
      btn.onclick = function () {
        container.innerHTML = '';
        GAME.makeChoice(c, node);
      };
      container.appendChild(btn);
    });
  }

  function hideDialogue() {
    var box = $('dialogue-box');
    var choices = $('choices-container');
    if (box) box.classList.add('hidden');
    if (choices) choices.innerHTML = '';
  }

  function setAfkOverlay(visible) {
    var el = $('afk-overlay');
    if (el) el.style.display = visible ? 'block' : 'none';
  }

  function setAfkText(t) {
    var el = $('afk-text');
    if (el) el.textContent = t || (global.I18n && global.I18n.t('afk_text')) || '挂机中…';
  }

  function initGameScreen() {
    GAME.onStateChange(function (state) {
      updateHUD(state);
      if (state.viewMode === 'SCENE') setBackground(state.location);
    });
    GAME.onViewModeChange(function (state) {
      if (state.viewMode === 'MAP') showMapView();
      else showSceneView();
      if (global.VN_MEDIA && global.VN_MEDIA.onSceneChange) global.VN_MEDIA.onSceneChange(state.viewMode, state.location);
    });
    GAME.onDialogue(function (node) {
      if (node && global.GALLERY && global.GALLERY.getAllList) {
        var list = global.GALLERY.getAllList();
        var cg = list.filter(function (c) { return c.nodeId === node.id; })[0];
        if (cg && !global.GALLERY.isUnlocked(cg.id)) {
          global.GALLERY.unlock(cg.id);
          showCG(cg.id);
        }
      }
      if (node && node.speaker && global.UI.setCharacterFocus) setCharacterFocus(node.speaker);
      showDialogue(node.text, { onComplete: function () {} });
    });
    GAME.onChoice(function (node) {
      showDialogue(node.text, {
        onComplete: function () { showChoices(node.choices, node); }
      });
    });
    if (GAME.onAfkTick) {
      GAME.onAfkTick(function (state, randomEvent) {
        hideDialogue();
        var node = GAME.getNode(randomEvent.nodeId);
        if (node && node.choices && node.choices.length > 0) {
          showDialogue(node.text, { onComplete: function () { showChoices(node.choices, node); } });
        } else {
          showDialogue(node ? node.text : '发生了一件小事…', { onComplete: function () { GAME.advanceToNextBlock(); GAME.onStateChange(GAME.getState()); } });
        }
      });
    }
    var state = GAME.getState();
    updateHUD(state);
    if (state.viewMode === 'MAP') showMapView();
    else showSceneView();
    var dialogueArea = $('dialogue-box');
    if (dialogueArea) dialogueArea.onclick = function () { skipTypewriter(); };
  }

  function runAfkLoop() {
    if (GAME.setPaused && GAME.setPaused()) return;
    var state = GAME.getState();
    var doBlock = (SCHEDULER && SCHEDULER.isFreeBlock && SCHEDULER.isFreeBlock(state.time_block)) ? GAME.doFreeTimeBlock : GAME.doAttendClassAfk;
    doBlock().then(function (result) {
      if (result && result.needDialogue) return;
      setAfkOverlay(true);
      setAfkText();
      setTimeout(runAfkLoop, 1500);
    });
  }

  function bindGameButtons() {
    var btnBackMap = $('btn-back-map');
    var btnMap = $('btn-map');
    var btnAfk = $('btn-afk');
    var btnTravel = $('btn-travel');
    var btnSleep = $('btn-sleep');
    var btnSave = $('btn-save');
    var btnLoad = $('btn-load');

    if (btnBackMap) btnBackMap.onclick = function () {
      transitionManager.run(getDefaultTransition(), 'scene', 'map', function () { GAME.backToMap(); });
    };
    if (btnMap) btnMap.onclick = function () {
      if (GAME.getState().viewMode === 'SCENE') transitionManager.run(getDefaultTransition(), 'scene', 'map', function () { GAME.backToMap(); });
    };
    if (btnAfk) btnAfk.onclick = function () {
      setAfkOverlay(true);
      setAfkText();
      var state = GAME.getState();
      var doBlock = (SCHEDULER && SCHEDULER.isFreeBlock && SCHEDULER.isFreeBlock(state.time_block)) ? GAME.doFreeTimeBlock : GAME.doAttendClassAfk;
      doBlock().then(function (r) {
        if (!r || !r.needDialogue) setTimeout(runAfkLoop, 1200);
      });
    };
    if (btnTravel) btnTravel.onclick = function () {
      var state = GAME.getState();
      var list = MAP && MAP.getAvailableHotspots ? MAP.getAvailableHotspots(state) : [];
      if (list.length === 0) return showToast(global.I18n ? global.I18n.t('no_dest') : '暂无可用目的地', 'error');
      var choices = list.map(function (h, i) {
        var name = (global.I18n ? global.I18n.locationName(h.sceneId) : h.sceneId) + ' (' + h.sceneId + ')';
        return { text: i + '. ' + name, value: i };
      });
      showModal({
        title: global.I18n && global.I18n.t('btn_travel') ? global.I18n.t('btn_travel') : '移动',
        choices: choices,
        onSelect: function (i) {
          var idx = parseInt(i, 10);
          if (idx >= 0 && idx < list.length && list[idx].sceneId !== state.location) {
            transitionManager.run(getDefaultTransition(), 'scene', 'scene', function () { GAME.doTravel(list[idx].sceneId); });
          }
        }
      });
    };
    if (btnSleep) btnSleep.onclick = function () {
      if (GAME.getState().location !== 'home') return showToast(global.I18n ? global.I18n.t('go_home_first') : '请先回家', 'error');
      GAME.doSleep();
    };
    if (btnSave) btnSave.onclick = function () {
      var st = GAME.getState();
      API.saves.save(st.saveSlot || 0, st, { date: st.date_iso, atar: st.atar }).then(function () {
        showToast(global.I18n ? global.I18n.t('save_ok') : '存档成功', 'success');
      }).catch(function (e) { showToast(e.message || '存档失败', 'error'); });
    };
    if (btnLoad) btnLoad.onclick = function () {
      API.saves.list().then(function (r) {
        var choices = [];
        for (var s = 0; s <= 9; s++) choices.push({ text: (global.I18n && global.I18n.t('slot') ? global.I18n.t('slot') + ' ' : '槽位 ') + s, value: s });
        showModal({
          title: global.I18n && global.I18n.t('btn_load') ? global.I18n.t('btn_load') : '读档',
          body: global.I18n && global.I18n.t('load_pick_slot') ? global.I18n.t('load_pick_slot') : '选择存档槽位：',
          choices: choices,
          onSelect: function (slotStr) {
            var slot = parseInt(slotStr, 10);
            API.saves.get(slot).then(function (data) {
              GAME.setState(data.state);
              GAME.setSaveSlot(slot);
              updateHUD(GAME.getState());
              if (GAME.getState().viewMode === 'MAP') showMapView(); else showSceneView();
              showToast(global.I18n ? global.I18n.t('load_ok') : '读档成功', 'success');
            }).catch(function (e) { showToast(e.message || '读档失败', 'error'); });
          }
        });
      });
    };

    var btnPause = $('btn-pause');
    var btnAuto = $('btn-auto');
    var btnSkip = $('btn-skip');
    var btnHistory = $('btn-history');
    var btnCalendar = $('btn-calendar');
    if (btnPause) btnPause.onclick = function () {
      GAME.setPaused(!GAME.setPaused());
      btnPause.textContent = GAME.setPaused() ? (global.I18n ? global.I18n.t('btn_resume') : '继续') : (global.I18n ? global.I18n.t('btn_pause') : '暂停');
    };
    if (btnAuto) btnAuto.onclick = function () {
      GAME.setAutoMode(!GAME.getAutoMode());
      btnAuto.classList.toggle('active', GAME.getAutoMode());
    };
    if (btnSkip) btnSkip.onclick = function () {
      GAME.setSkipMode(!GAME.getSkipMode());
      btnSkip.classList.toggle('active', GAME.getSkipMode());
    };
    if (btnHistory) btnHistory.onclick = function () {
      var panel = $('history-panel');
      if (panel) panel.classList.toggle('open');
    };
    var btnGallery = $('btn-gallery');
    if (btnGallery && global.GALLERY && global.GALLERY.showGalleryPanel) btnGallery.onclick = function () { global.GALLERY.showGalleryPanel(); };
    if (btnCalendar) btnCalendar.onclick = function () {
      var panel = $('calendar-panel');
      if (panel) { panel.classList.add('open'); if (global.CALENDAR && global.CALENDAR.refresh) global.CALENDAR.refresh(); }
    };
  }

  function renderLogin() {
    var root = $('login-screen');
    if (!root) return;
    var T = global.I18n && global.I18n.t ? global.I18n.t : function (k) { return k; };
    root.innerHTML = '<div class="login-box"><h1 data-i18n="title">' + T('title') + '</h1><input id="login-username" type="text" placeholder="' + T('login_username') + '"/><input id="login-password" type="password" placeholder="' + T('login_password') + '"/><input id="login-invite-code" type="text" placeholder="' + T('login_invite') + '"/><div id="login-error" class="login-error" style="display:none;"></div><div class="login-remember"><input type="checkbox" id="login-remember-me"/><label for="login-remember-me">' + T('remember_me') + '</label></div><div class="login-actions"><button id="btn-login">' + T('btn_login') + '</button><button id="btn-register">' + T('btn_register') + '</button></div><p class="login-links"><a href="leaderboard.html">' + T('link_leaderboard') + '</a> | <a href="board.html">' + T('link_board') + '</a></p></div>';
    var rememberEl = document.getElementById('login-remember-me');
    try { if (localStorage.getItem('rememberMe') === '1') rememberEl.checked = true; } catch (e) {}
    document.getElementById('btn-login').onclick = function () {
      var errEl = document.getElementById('login-error');
      if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
      var u = document.getElementById('login-username').value.trim();
      var p = document.getElementById('login-password').value;
      var remember = rememberEl ? rememberEl.checked : false;
      try { localStorage.setItem('rememberMe', remember ? '1' : '0'); } catch (e) {}
      API.auth.login(u, p, remember).then(function () { checkAuth(); }).catch(function (e) {
        if (errEl) { errEl.textContent = e.message || '登录失败'; errEl.style.display = 'block'; }
      });
    };
    document.getElementById('btn-register').onclick = function () {
      var errEl = document.getElementById('login-error');
      if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
      var u = document.getElementById('login-username').value.trim();
      var p = document.getElementById('login-password').value;
      var code = document.getElementById('login-invite-code') ? document.getElementById('login-invite-code').value.trim() : '';
      API.auth.register(u, p, code).then(function () { checkAuth(); }).catch(function (e) {
        if (errEl) { errEl.textContent = e.message || '注册失败'; errEl.style.display = 'block'; }
      });
    };
  }

  function checkAuth() {
    API.auth.me().then(function (r) {
      if (r && r.user) {
        showScreen('game-screen');
        GAME.loadStory().then(function () {
          initGameScreen();
          setAfkOverlay(true);
          setAfkText();
          runAfkLoop();
        });
      } else {
        showScreen('login-screen');
        renderLogin();
      }
    }).catch(function () {
      showScreen('login-screen');
      renderLogin();
    });
  }

  function showBroadcast(msgs) {
    if (!msgs || !msgs.length) return;
    var bar = $('broadcast-bar');
    if (bar) { bar.innerHTML = msgs[0].title + (msgs[0].body ? ': ' + msgs[0].body : ''); bar.style.display = 'block'; setTimeout(function () { bar.style.display = 'none'; }, 5000); }
  }

  function onLangChange() {
    if (document.getElementById('login-screen') && document.getElementById('login-screen').style.display !== 'none') renderLogin();
    else if (global.I18n && global.I18n.apply) global.I18n.apply();
  }

  function init() {
    loadManifest().then(function () {
      if (typeof API.config === 'function') {
        API.config().then(function (c) { global.__CONFIG__ = c || {}; }).catch(function () { global.__CONFIG__ = {}; });
      } else { global.__CONFIG__ = {}; }
    });
    // 先渲染登录框并绑定按钮，避免 checkAuth 未返回前用户点击登录/注册无反应
    renderLogin();
    checkAuth();
    bindGameButtons();
    API.messages().then(function (r) { if (r.messages && r.messages.length) showBroadcast(r.messages); }).catch(function () {});
  }

  global.UI = {
    init: init,
    onLangChange: onLangChange,
    updateHUD: updateHUD,
    showDialogue: showDialogue,
    showChoices: showChoices,
    hideDialogue: hideDialogue,
    setAfkOverlay: setAfkOverlay,
    setAfkText: setAfkText,
    showScreen: showScreen,
    transitionManager: transitionManager,
    showMapView: showMapView,
    showSceneView: showSceneView,
    setBackground: setBackground,
    setCharacter: setCharacter,
    setCharacterFocus: setCharacterFocus,
    showCG: showCG
  };
})(typeof window !== 'undefined' ? window : global);
