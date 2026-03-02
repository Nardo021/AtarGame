/**
 * GameScreen: manages background, character display, and VN event wiring
 */
(function (global) {
  var currentBg = null;
  var currentChar = null;
  var currentPose = null;

  function init() {
    EventBus.on('vn:bg', function (asset) {
      setBg(asset);
    });

    EventBus.on('vn:char', function (data) {
      setChar(data.id, data.pose, data.nameplate);
    });

    EventBus.on('vn:ending', function (data) {
      showEnding(data);
    });

    EventBus.on('vn:classAuto', function (result) {
      setBg('bg_classroom_day');
      setChar('MR_TA', 'neutral', 'Mr Ta');

      ActionPanel.hide();
      Dialogue.hide();

      var msg = '上课中... ATAR ' + (result.atar > 0 ? '+' : '') + (Math.round(result.atar * 10) / 10);
      Dialogue.show('NARRATOR', msg);
    });

    document.getElementById('btn-save-game').addEventListener('click', function () {
      SaveLoad.openSave('GAME');
    });
    document.getElementById('btn-settings-game').addEventListener('click', function () {
      Settings.open('GAME');
    });
    document.getElementById('btn-menu-game').addEventListener('click', function () {
      App.showScreen('MENU');
      MainMenu.checkContinue();
    });
    document.getElementById('btn-ending-menu').addEventListener('click', function () {
      App.showScreen('MENU');
      MainMenu.checkContinue();
    });
  }

  function setBg(asset) {
    var bgEl = document.getElementById('game-bg');
    if (!bgEl) return;

    if (asset === 'bg_exam_white') {
      bgEl.style.backgroundImage = 'none';
      bgEl.classList.add('bg-exam-white');
      currentBg = asset;
      return;
    }

    bgEl.classList.remove('bg-exam-white');
    var url = Media.getBgUrl(asset);
    if (url) {
      bgEl.style.backgroundImage = 'url(' + url + ')';
    } else {
      bgEl.style.backgroundImage = 'none';
      bgEl.style.background = '#1a1a2e';
    }
    currentBg = asset;
  }

  function setChar(charId, pose, nameplate) {
    var charEl = document.getElementById('char-left');
    if (!charEl) return;

    if (!charId) {
      charEl.style.display = 'none';
      currentChar = null;
      currentPose = null;
      return;
    }

    var url = Media.getCharUrl(charId, pose);
    if (url) {
      charEl.src = url;
      charEl.style.display = 'block';
      charEl.dataset.nameplate = nameplate || '';
    } else {
      charEl.style.display = 'none';
    }

    currentChar = charId;
    currentPose = pose;
  }

  function updateBackground() {
    var state = Store.getState();
    if (state.runtime.sceneId === 'HOME') {
      setBg('bg_home_night');
    } else {
      setBg('bg_classroom_day');
    }
  }

  function updateCharacter() {
    var state = Store.getState();
    if (state.runtime.sceneId === 'CLASSROOM') {
      setChar('MR_TA', 'neutral', 'Mr Ta');
    } else {
      setChar(null);
    }
  }

  function showEnding(data) {
    var nameEl = document.getElementById('ending-name');
    var textEl = document.getElementById('ending-text');
    var atarEl = document.getElementById('ending-atar');

    if (nameEl) nameEl.textContent = data.name;
    if (textEl) textEl.textContent = data.text;
    if (atarEl) {
      var atar = Store.getState().stats.atar;
      atarEl.textContent = 'ATAR: ' + (Math.round(atar * 100) / 100);
    }

    TransitionManager.run('fade', function () {
      App.showScreen('ENDING');
    });
  }

  global.GameScreen = {
    init: init,
    setBg: setBg,
    setChar: setChar,
    updateBackground: updateBackground,
    updateCharacter: updateCharacter
  };
})(typeof window !== 'undefined' ? window : global);
