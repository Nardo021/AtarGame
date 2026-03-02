/**
 * MainMenu: title screen with New Game / Continue / Load / Settings
 */
(function (global) {
  function init() {
    document.getElementById('btn-new-game').addEventListener('click', startNewGame);
    document.getElementById('btn-continue').addEventListener('click', continueGame);
    document.getElementById('btn-load').addEventListener('click', function () {
      SaveLoad.openLoad('MENU');
    });
    document.getElementById('btn-settings-menu').addEventListener('click', function () {
      Settings.open('MENU');
    });

    checkContinue();
  }

  function checkContinue() {
    var btn = document.getElementById('btn-continue');
    if (!btn) return;

    API.saves.list().then(function (saves) {
      if (saves && saves.length > 0) {
        btn.style.display = 'block';
      }
    }).catch(function () {});
  }

  function startNewGame() {
    Media.playSfx('click');
    Store.dispatch({ type: 'RESET' });
    Scheduler.reset();

    var story = Engine.getStory();
    if (story && story.flags) {
      Store.dispatch({ type: 'SET_FLAG', payload: story.flags });
    }
    if (story && story.meta) {
      Store.dispatch({
        type: 'SET_TIME',
        payload: {
          dateISO: story.meta.startDateISO || '2026-01-01',
          slotId: 'CLASS_AM',
          isWeekend: Time.isWeekend(story.meta.startDateISO || '2026-01-01')
        }
      });
    }

    Store.dispatch({ type: 'SET_SCENE', payload: 'CLASSROOM' });

    TransitionManager.run('fade', function () {
      App.showScreen('GAME');
      GameScreen.updateBackground();
      GameScreen.updateCharacter();
      TransitionManager.updateMoodHealthEffects();

      Scheduler.processSlot(function (type) {
        if (type === 'free') ActionPanel.show();
      });
    });
  }

  function continueGame() {
    Media.playSfx('click');
    SaveLoad.openLoad('MENU');
  }

  global.MainMenu = {
    init: init,
    checkContinue: checkContinue
  };
})(typeof window !== 'undefined' ? window : global);
