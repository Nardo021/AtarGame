/**
 * App: top-level controller — screen switching, init, auth
 */
(function (global) {
  var screens = {};
  var currentScreen = null;
  var isAuthenticated = false;

  function init() {
    screens = {
      MENU: document.getElementById('screen-menu'),
      SETTINGS: document.getElementById('screen-settings'),
      GAME: document.getElementById('screen-game'),
      SAVE: document.getElementById('screen-save'),
      ENDING: document.getElementById('screen-ending'),
      LOGIN: document.getElementById('screen-login')
    };

    setupToast();
    setupLogin();

    EventBus.on('auth:expired', function () {
      isAuthenticated = false;
      showScreen('LOGIN');
    });

    EventBus.on('game:over', function () {
      var story = Engine.getStory();
      if (story) {
        var graduation = null;
        for (var i = 0; i < story.milestones.length; i++) {
          if (story.milestones[i].id === 'MS_GRADUATION') {
            graduation = story.milestones[i];
            break;
          }
        }
        if (graduation) {
          Engine.runScript(graduation.script);
          return;
        }
      }
      GameScreen.showEnding && GameScreen.showEnding({
        id: 'END_NORMAL', name: '普通毕业', text: '你走出教室。世界终于不只有数学。'
      });
    });

    boot();
  }

  function boot() {
    Media.init().then(function () {
      return API.config();
    }).then(function (cfg) {
      Store.dispatch({ type: 'SET_CONFIG', payload: cfg });
      return API.story();
    }).then(function (storyData) {
      Engine.loadStory(storyData);
      return checkAuth();
    }).then(function () {
      Dialogue.init();
      HUD.init();
      ActionPanel.init();
      SaveLoad.init();
      MainMenu.init();
      Settings.init();
      GameScreen.init();

      if (isAuthenticated) {
        showScreen('MENU');
      } else {
        showScreen('LOGIN');
      }
    }).catch(function (err) {
      console.error('[App] Boot failed:', err);
      showScreen('LOGIN');
    });
  }

  function checkAuth() {
    return API.auth.me().then(function (user) {
      Store.dispatch({ type: 'SET_USER', payload: user });
      isAuthenticated = true;
    }).catch(function () {
      isAuthenticated = false;
    });
  }

  function showScreen(name) {
    for (var key in screens) {
      if (screens[key]) {
        screens[key].classList.remove('active');
      }
    }
    if (screens[name]) {
      screens[name].classList.add('active');
      currentScreen = name;
      Store.dispatch({ type: 'SET_SCREEN', payload: name });
    }
  }

  function setupLogin() {
    var loginBtn = document.getElementById('btn-login');
    var registerBtn = document.getElementById('btn-register');
    var errorEl = document.getElementById('login-error');

    if (loginBtn) {
      loginBtn.addEventListener('click', function () {
        var username = document.getElementById('login-username').value.trim();
        var password = document.getElementById('login-password').value;
        var remember = document.getElementById('login-remember').checked;

        if (!username || !password) {
          if (errorEl) errorEl.textContent = '请输入用户名和密码';
          return;
        }

        if (errorEl) errorEl.textContent = '';
        loginBtn.disabled = true;

        API.auth.login(username, password, remember).then(function (data) {
          var user = data.user || data;
          Store.dispatch({ type: 'SET_USER', payload: user });
          isAuthenticated = true;
          loginBtn.disabled = false;
          MainMenu.checkContinue();
          showScreen('MENU');
        }).catch(function (err) {
          loginBtn.disabled = false;
          if (errorEl) errorEl.textContent = err.message || '登录失败';
        });
      });
    }

    if (registerBtn) {
      registerBtn.addEventListener('click', function () {
        var username = document.getElementById('login-username').value.trim();
        var password = document.getElementById('login-password').value;

        if (!username || !password) {
          if (errorEl) errorEl.textContent = '请输入用户名和密码';
          return;
        }

        if (password.length < 4) {
          if (errorEl) errorEl.textContent = '密码至少 4 个字符';
          return;
        }

        if (errorEl) errorEl.textContent = '';
        registerBtn.disabled = true;

        API.auth.register(username, password).then(function () {
          return API.auth.login(username, password, true);
        }).then(function (data) {
          var user = data.user || data;
          Store.dispatch({ type: 'SET_USER', payload: user });
          isAuthenticated = true;
          registerBtn.disabled = false;
          showScreen('MENU');
        }).catch(function (err) {
          registerBtn.disabled = false;
          if (errorEl) errorEl.textContent = err.message || '注册失败';
        });
      });
    }
  }

  function setupToast() {
    var toastEl = document.getElementById('toast');
    var toastTimer = null;

    EventBus.on('toast', function (data) {
      if (!toastEl) return;
      toastEl.textContent = data.msg;
      toastEl.className = 'toast' + (data.type ? ' toast-' + data.type : '');
      toastEl.style.display = 'block';

      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        toastEl.style.display = 'none';
      }, 3000);
    });
  }

  function getCurrentScreen() { return currentScreen; }

  global.App = {
    init: init,
    showScreen: showScreen,
    getCurrentScreen: getCurrentScreen
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : global);
