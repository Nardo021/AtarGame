/**
 * TransitionManager: VN scene transitions + visual effects
 * Supports: fade, slide, blur, desaturate, vignette
 */
(function (global) {
  var TRANSITION_DURATION = 350;

  function setInputLock(lock) {
    if (global.Store) global.Store.dispatch({ type: 'SET_LOCK_INPUT', payload: !!lock });
  }

  var transitionManager = {
    run: function (type, callback) {
      type = type || 'fade';
      var overlay = document.getElementById('transition-overlay');
      if (!overlay) return callback && callback();

      setInputLock(true);
      if (global.Store) global.Store.dispatch({ type: 'SET_TRANSITIONING', payload: true });

      overlay.className = 'transition-overlay';
      overlay.classList.add('transition-' + type, 'transition-visible');
      overlay.offsetHeight; // force reflow

      setTimeout(function () {
        if (typeof callback === 'function') callback();
        requestAnimationFrame(function () {
          setTimeout(function () {
            overlay.classList.remove('transition-visible');
            setInputLock(false);
            if (global.Store) global.Store.dispatch({ type: 'SET_TRANSITIONING', payload: false });
          }, TRANSITION_DURATION);
        });
      }, TRANSITION_DURATION);
    },

    applyScreenEffect: function (fx) {
      var overlay = document.getElementById('effect-overlay');
      if (!overlay) return;

      overlay.className = 'effect-overlay';
      if (fx) overlay.classList.add('fx-' + fx);
    },

    clearScreenEffect: function () {
      var overlay = document.getElementById('effect-overlay');
      if (overlay) overlay.className = 'effect-overlay';
    },

    updateMoodHealthEffects: function () {
      var st = global.Store ? global.Store.getState() : null;
      if (!st) return;

      var gameEl = document.getElementById('screen-game');
      if (!gameEl) return;

      gameEl.classList.remove('mood-low', 'health-low');
      if (st.stats.mood <= 20) gameEl.classList.add('mood-low');
      if (st.stats.health <= 20) gameEl.classList.add('health-low');
    }
  };

  global.TransitionManager = transitionManager;
})(typeof window !== 'undefined' ? window : global);
