/**
 * HUD: status bars, date/time display
 */
(function (global) {
  function init() {
    Store.subscribe(update);
    update(Store.getState());
  }

  function update(state) {
    var dateEl = document.getElementById('hud-date');
    var slotEl = document.getElementById('hud-slot');
    var barAtar = document.getElementById('bar-atar');
    var barMood = document.getElementById('bar-mood');
    var barHealth = document.getElementById('bar-health');
    var valAtar = document.getElementById('val-atar');
    var valMood = document.getElementById('val-mood');
    var valHealth = document.getElementById('val-health');

    if (dateEl) dateEl.textContent = Time.formatDate(state.time.dateISO);
    if (slotEl) slotEl.textContent = Time.getSlotLabel(state.time.slotId);

    if (barAtar) barAtar.style.width = Math.min(state.stats.atar, 100) + '%';
    if (barMood) barMood.style.width = state.stats.mood + '%';
    if (barHealth) barHealth.style.width = state.stats.health + '%';

    if (valAtar) valAtar.textContent = Math.round(state.stats.atar * 10) / 10;
    if (valMood) valMood.textContent = Math.round(state.stats.mood);
    if (valHealth) valHealth.textContent = Math.round(state.stats.health);
  }

  global.HUD = {
    init: init,
    update: update
  };
})(typeof window !== 'undefined' ? window : global);
