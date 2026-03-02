/**
 * Settings: volume, text speed controls
 */
(function (global) {
  var returnScreen = 'MENU';

  function init() {
    var bgmSlider = document.getElementById('set-bgm');
    var sfxSlider = document.getElementById('set-sfx');
    var speedSlider = document.getElementById('set-textspeed');
    var backBtn = document.getElementById('btn-settings-back');

    if (bgmSlider) {
      bgmSlider.addEventListener('input', function () {
        var val = parseInt(this.value);
        document.getElementById('set-bgm-val').textContent = val + '%';
        Store.dispatch({ type: 'SET_SETTINGS', payload: { bgmVolume: val / 100 } });
        Media.updateVolumes();
      });
    }

    if (sfxSlider) {
      sfxSlider.addEventListener('input', function () {
        var val = parseInt(this.value);
        document.getElementById('set-sfx-val').textContent = val + '%';
        Store.dispatch({ type: 'SET_SETTINGS', payload: { sfxVolume: val / 100 } });
      });
    }

    if (speedSlider) {
      speedSlider.addEventListener('input', function () {
        var val = parseInt(this.value);
        document.getElementById('set-textspeed-val').textContent = val + 'ms';
        Store.dispatch({ type: 'SET_SETTINGS', payload: { textSpeed: val } });
      });
    }

    if (backBtn) {
      backBtn.addEventListener('click', function () {
        saveToLocalStorage();
        App.showScreen(returnScreen);
      });
    }

    loadFromLocalStorage();
  }

  function open(from) {
    returnScreen = from || 'MENU';
    syncUI();
    App.showScreen('SETTINGS');
  }

  function syncUI() {
    var s = Store.getState().settings;
    var bgmSlider = document.getElementById('set-bgm');
    var sfxSlider = document.getElementById('set-sfx');
    var speedSlider = document.getElementById('set-textspeed');

    if (bgmSlider) {
      bgmSlider.value = Math.round((s.bgmVolume || 0.5) * 100);
      document.getElementById('set-bgm-val').textContent = bgmSlider.value + '%';
    }
    if (sfxSlider) {
      sfxSlider.value = Math.round((s.sfxVolume || 0.7) * 100);
      document.getElementById('set-sfx-val').textContent = sfxSlider.value + '%';
    }
    if (speedSlider) {
      speedSlider.value = s.textSpeed || 40;
      document.getElementById('set-textspeed-val').textContent = speedSlider.value + 'ms';
    }
  }

  function saveToLocalStorage() {
    try {
      localStorage.setItem('onlymath_settings', JSON.stringify(Store.getState().settings));
    } catch (e) {}
  }

  function loadFromLocalStorage() {
    try {
      var saved = localStorage.getItem('onlymath_settings');
      if (saved) {
        var parsed = JSON.parse(saved);
        Store.dispatch({ type: 'SET_SETTINGS', payload: parsed });
      }
    } catch (e) {}
  }

  global.Settings = {
    init: init,
    open: open
  };
})(typeof window !== 'undefined' ? window : global);
