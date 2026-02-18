/**
 * UI：transitionManager、MAP/SCENE 视图、HUD、对话框、日历入口
 */
(function (global) {
  var GAME = global.GAME;
  var API = global.API;
  var MAP = global.MAP;
  var HISTORY = global.HISTORY;

  var typewriterTimer = null;
  var typewriterIndex = 0;
  var typewriterFullText = '';
  var typewriterSpeed = 25;
  var transitionDefaultType = 'fade';
  var inputLocked = false;

  function $(id) { return document.getElementById(id); }
  function qs(s) { return document.querySelector(s); }

  function showScreen(id) {
    ['login-screen', 'game-screen'].forEach(function (s) {
      var el = document.getElementById(s);
      if (el) el.style.display = s === id ? 'block' : 'none';
    });
  }

  function setInputLock(lock) {
    inputLocked = !!lock;
    var wrap = $('game-view-wrap');
    if (wrap) wrap.style.pointerEvents = inputLocked ? 'none' : 'auto';
  }

  var transitionManager = {
    run: function (type, fromView, toView, callback) {
      type = type || transitionDefaultType;
      var overlay = document.getElementById('transition-overlay');
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
      overlay.offsetHeight;
      setTimeout(function () {
        if (typeof callback === 'function') callback();
        setTimeout(function () {
          overlay.classList.remove('transition-visible');
          setInputLock(false);
        }, 320);
      }, 280);
    }
  };

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
    if (time) time.textContent = (state.date_iso || '') + ' ' + (state.time_block || '');
  }

  var sceneToBg = {
    classroom: 'bg-classroom',
    corridor: 'bg-corridor',
    field: 'bg-field',
    clubroom: 'bg-clubroom',
    home: 'bg-bedroom',
    internet_cafe: 'bg-internet_cafe'
  };

  function setBackground(sceneId) {
    var base = sceneToBg[sceneId] || 'bg-classroom';
    var el = qs('.game-bg');
    if (!el) return;
    var svgUrl = 'url(assets/' + base + '.svg)';
    var img = new Image();
    img.onload = function () { el.style.backgroundImage = 'url(assets/' + base + '.jpg)'; el.style.backgroundSize = 'cover'; };
    img.onerror = function () { el.style.backgroundImage = svgUrl; el.style.backgroundSize = 'cover'; };
    img.src = 'assets/' + base + '.jpg';
    el.style.backgroundImage = svgUrl;
    el.style.backgroundSize = 'cover';
    if (img.complete && img.naturalWidth) el.style.backgroundImage = 'url(assets/' + base + '.jpg)';
  }

  function showMapView() {
    var mapView = $('map-view');
    var sceneView = $('scene-view');
    if (mapView) mapView.style.display = 'block';
    if (sceneView) sceneView.style.display = 'none';
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
      div.title = global.I18n ? global.I18n.locationName(h.sceneId) : h.sceneId;
      div.onclick = function () {
        transitionManager.run('fade', 'map', 'scene', function () {
          GAME.enterScene(h.sceneId);
        });
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
    if (global.GAME.getSkipMode && global.GAME.getSkipMode()) {
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
    });
    GAME.onDialogue(function (node) {
      showDialogue(node.text, { onComplete: function () {} });
    });
    GAME.onChoice(function (node) {
      showDialogue(node.text, {
        onComplete: function () {
          showChoices(node.choices, node);
        }
      });
    });
    GAME.onAfkTick(function (state, randomEvent) {
      hideDialogue();
      var node = GAME.getNode(randomEvent.nodeId);
      if (node && node.choices && node.choices.length > 0) {
        showDialogue(node.text, {
          onComplete: function () { showChoices(node.choices, node); }
        });
      } else {
        showDialogue(node ? node.text : '发生了一件小事…', { onComplete: function () { GAME.advanceToNextBlock(); GAME.onStateChange(GAME.getState()); } });
      }
    });

    var state = GAME.getState();
    updateHUD(state);
    if (state.viewMode === 'MAP') showMapView();
    else showSceneView();
  }

  function runAfkLoop() {
    if (GAME.setPaused && GAME.setPaused()) return;
    GAME.doAttendClassAfk().then(function (result) {
      if (result && result.needDialogue) return;
      setAfkOverlay(true);
      setAfkText();
      setTimeout(runAfkLoop, 1500);
    });
  }

  function bindGameButtons() {
    var btnAfk = $('btn-afk');
    var btnTravel = $('btn-travel');
    var btnSleep = $('btn-sleep');
    var btnBackMap = $('btn-back-map');
    var btnMap = $('btn-map');
    var btnCalendar = $('btn-calendar');
    var btnPause = $('btn-pause');
    var btnAuto = $('btn-auto');
    var btnSkip = $('btn-skip');
    var btnHistory = $('btn-history');
    var btnSave = $('btn-save');
    var btnLoad = $('btn-load');

    if (btnBackMap) btnBackMap.onclick = function () {
      transitionManager.run('fade', 'scene', 'map', function () { GAME.backToMap(); });
    };
    if (btnMap) btnMap.onclick = function () {
      if (GAME.getState().viewMode === 'SCENE') transitionManager.run('fade', 'scene', 'map', function () { GAME.backToMap(); });
    };
    if (btnCalendar) btnCalendar.onclick = function () {
      var panel = $('calendar-panel');
      if (panel) {
        panel.classList.add('open');
        if (global.CALENDAR && global.CALENDAR.refresh) global.CALENDAR.refresh();
      }
    };
    if (btnAfk) btnAfk.onclick = function () {
      setAfkOverlay(true);
      setAfkText();
      GAME.doAttendClassAfk().then(function (r) {
        if (!r || !r.needDialogue) setTimeout(runAfkLoop, 1200);
      });
    };
    if (btnTravel) btnTravel.onclick = function () {
      var state = GAME.getState();
      var list = MAP && MAP.getAvailableHotspots ? MAP.getAvailableHotspots(state) : [];
      if (list.length === 0) return alert(global.I18n ? global.I18n.t('no_dest') || '暂无可用目的地' : '暂无可用目的地');
      var names = list.map(function (h) { return (global.I18n ? global.I18n.locationName(h.sceneId) : h.sceneId) + ' (' + h.sceneId + ')'; });
      var idx = prompt('输入序号 0-' + (list.length - 1) + '：\n' + names.join('\n'), '0');
      if (idx == null) return;
      var i = parseInt(idx, 10);
      if (i >= 0 && i < list.length && list[i].sceneId !== state.location) {
        transitionManager.run('fade', 'scene', 'scene', function () {
          GAME.doTravel(list[i].sceneId);
        });
      }
    };
    if (btnSleep) btnSleep.onclick = function () {
      if (GAME.getState().location !== 'home') return alert(global.I18n ? global.I18n.t('go_home_first') || '请先回家' : '请先回家');
      GAME.doSleep();
    };
    if (btnPause) btnPause.onclick = function () {
      GAME.setPaused(!GAME.setPaused());
      btnPause.textContent = GAME.setPaused() ? (global.I18n ? global.I18n.t('btn_resume') || '继续' : '继续') : (global.I18n ? global.I18n.t('btn_pause') : '暂停');
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
      if (!panel) return;
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) {
        var list = panel.querySelector('.history-list');
        if (list) {
          var all = HISTORY.getAll();
          list.innerHTML = all.slice(-100).reverse().map(function (e) {
            return '<div class="history-item"><span class="date">' + e.date_iso + ' ' + e.time_block + '</span> <span class="node">' + (e.node_id || '') + '</span> ' + (e.text ? e.text.slice(0, 80) : '') + '</div>';
          }).join('');
        }
      }
    };
    var dialogueArea = $('dialogue-box');
    if (dialogueArea) dialogueArea.onclick = function () { skipTypewriter(); };
    if (btnSave) btnSave.onclick = function () {
      API.saves.save(GAME.getState().saveSlot || 0, GAME.getState(), { date: GAME.getState().date_iso }).then(function () { alert(global.I18n ? global.I18n.t('save_ok') || '存档成功' : '存档成功'); }).catch(function (e) { alert(e.message || (global.I18n ? global.I18n.t('save_fail') : '存档失败')); });
    };
    if (btnLoad) btnLoad.onclick = function () {
      API.saves.list().then(function (r) {
        var slot = prompt('输入槽位 0-9', '0');
        if (slot == null) return;
        API.saves.get(parseInt(slot, 10)).then(function (data) {
          GAME.setState(data.state);
          GAME.setSaveSlot(parseInt(slot, 10));
          updateHUD(GAME.getState());
          if (GAME.getState().viewMode === 'MAP') showMapView(); else showSceneView();
          alert(global.I18n ? global.I18n.t('load_ok') || '读档成功' : '读档成功');
        }).catch(function (e) { alert(e.message || (global.I18n ? global.I18n.t('load_fail') : '读档失败')); });
      });
    };
  }

  function renderLogin() {
    var root = $('login-screen');
    if (!root) return;
    var T = global.I18n && global.I18n.t ? global.I18n.t : function(k){ return k; };
    root.innerHTML = '<div class="login-box"><h1 data-i18n="title">' + T('title') + '</h1><input id="login-username" type="text" data-i18n-placeholder="login_username" placeholder="' + T('login_username') + '"/><input id="login-password" type="password" data-i18n-placeholder="login_password" placeholder="' + T('login_password') + '"/><input id="login-invite-code" type="text" data-i18n-placeholder="login_invite" placeholder="' + T('login_invite') + '"/><div class="login-remember"><input type="checkbox" id="login-remember-me"/><label for="login-remember-me" data-i18n="remember_me">' + T('remember_me') + '</label></div><div class="login-actions"><button id="btn-login" data-i18n="btn_login">' + T('btn_login') + '</button><button id="btn-register" data-i18n="btn_register">' + T('btn_register') + '</button></div><p class="login-links"><a href="leaderboard.html" data-i18n="link_leaderboard">' + T('link_leaderboard') + '</a> | <a href="board.html" data-i18n="link_board">' + T('link_board') + '</a></p></div>';
    var rememberEl = document.getElementById('login-remember-me');
    try { if (localStorage.getItem('rememberMe') === '1') rememberEl.checked = true; } catch (e) {}
    document.getElementById('btn-login').onclick = function () {
      var u = document.getElementById('login-username').value.trim();
      var p = document.getElementById('login-password').value;
      var remember = rememberEl ? rememberEl.checked : false;
      try { localStorage.setItem('rememberMe', remember ? '1' : '0'); } catch (e) {}
      API.auth.login(u, p, remember).then(function () { checkAuth(); }).catch(function (e) { alert(e.message || '登录失败'); });
    };
    document.getElementById('btn-register').onclick = function () {
      var u = document.getElementById('login-username').value.trim();
      var p = document.getElementById('login-password').value;
      var code = document.getElementById('login-invite-code') ? document.getElementById('login-invite-code').value.trim() : '';
      API.auth.register(u, p, code).then(function () { checkAuth(); }).catch(function (e) { alert(e.message || '注册失败'); });
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

  function showBroadcast(messages) {
    if (!messages || !messages.length) return;
    var bar = $('broadcast-bar');
    if (!bar) return;
    bar.innerHTML = messages[0].title + (messages[0].body ? ': ' + messages[0].body : '');
    bar.style.display = 'block';
    setTimeout(function () { bar.style.display = 'none'; }, 5000);
  }

  function onLangChange() {
    if (document.getElementById('login-screen') && document.getElementById('login-screen').style.display !== 'none') renderLogin();
    else if (global.I18n && global.I18n.apply) global.I18n.apply();
  }

  function init() {
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
    showSceneView: showSceneView
  };
})(typeof window !== 'undefined' ? window : global);
