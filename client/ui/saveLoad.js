/**
 * SaveLoad: 3-slot save/load UI
 */
(function (global) {
  var mode = 'save'; // 'save' or 'load'
  var returnScreen = 'GAME';

  function init() {
    document.getElementById('btn-save-back').addEventListener('click', function () {
      App.showScreen(returnScreen);
    });
  }

  function openSave(from) {
    mode = 'save';
    returnScreen = from || 'GAME';
    document.getElementById('save-title').textContent = '保存';
    loadSlots();
    App.showScreen('SAVE');
  }

  function openLoad(from) {
    mode = 'load';
    returnScreen = from || 'MENU';
    document.getElementById('save-title').textContent = '读档';
    loadSlots();
    App.showScreen('SAVE');
  }

  function loadSlots() {
    var container = document.getElementById('save-slots');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;color:var(--text-dim)">加载中...</div>';

    API.saves.list().then(function (saves) {
      container.innerHTML = '';
      for (var slot = 1; slot <= 3; slot++) {
        var saveData = findSlot(saves, slot);
        createSlotElement(container, slot, saveData);
      }
    }).catch(function () {
      container.innerHTML = '';
      for (var slot = 1; slot <= 3; slot++) {
        createSlotElement(container, slot, null);
      }
    });
  }

  function findSlot(saves, slot) {
    if (!saves || !Array.isArray(saves)) return null;
    for (var i = 0; i < saves.length; i++) {
      if (saves[i].slot === slot || saves[i].slot_number === slot) return saves[i];
    }
    return null;
  }

  function createSlotElement(container, slot, saveData) {
    var el = document.createElement('div');
    el.className = 'save-slot';

    var numEl = document.createElement('div');
    numEl.className = 'save-slot-num';
    numEl.textContent = slot;
    el.appendChild(numEl);

    var infoEl = document.createElement('div');
    infoEl.className = 'save-slot-info';

    if (saveData && saveData.updated_at) {
      var dateEl = document.createElement('div');
      dateEl.className = 'save-date';
      dateEl.textContent = new Date(saveData.updated_at).toLocaleString('zh-CN');
      infoEl.appendChild(dateEl);

      var summary = parseSummary(saveData);
      if (summary) {
        var sumEl = document.createElement('div');
        sumEl.className = 'save-summary';
        sumEl.textContent = summary;
        infoEl.appendChild(sumEl);
      }
    } else {
      var emptyEl = document.createElement('div');
      emptyEl.className = 'save-slot-empty';
      emptyEl.textContent = '空槽位';
      infoEl.appendChild(emptyEl);
    }

    el.appendChild(infoEl);

    el.addEventListener('click', function () {
      if (mode === 'save') {
        doSave(slot);
      } else {
        if (saveData && saveData.updated_at) {
          doLoad(slot);
        }
      }
    });

    container.appendChild(el);
  }

  function parseSummary(saveData) {
    try {
      var meta = saveData.summary_json || saveData.meta_json;
      if (!meta) {
        var state = JSON.parse(saveData.state_json);
        if (state && state.time) {
          return state.time.dateISO + ' ATAR:' + Math.round((state.stats || {}).atar || 0);
        }
        return null;
      }
      var parsed = typeof meta === 'string' ? JSON.parse(meta) : meta;
      return parsed.dateISO + ' ATAR:' + (parsed.atar || '?');
    } catch (e) {
      return null;
    }
  }

  function doSave(slot) {
    var snap = Store.snapshot();
    var state = Store.getState();
    var summary = {
      dateISO: state.time.dateISO,
      atar: Math.round(state.stats.atar * 10) / 10,
      mood: Math.round(state.stats.mood),
      health: Math.round(state.stats.health),
      triggeredMilestones: Scheduler.getTriggeredMilestones()
    };

    snap.triggeredMilestones = Scheduler.getTriggeredMilestones();

    API.saves.save(slot, snap, summary).then(function () {
      Media.playSfx('save');
      showToast('保存成功', 'success');
      loadSlots();
    }).catch(function (err) {
      showToast('保存失败: ' + err.message, 'error');
    });
  }

  function doLoad(slot) {
    API.saves.get(slot).then(function (data) {
      var stateJson = data.state_json;
      var snap = typeof stateJson === 'string' ? JSON.parse(stateJson) : stateJson;

      Store.dispatch({ type: 'RESTORE_SNAPSHOT', payload: snap });

      if (snap.triggeredMilestones) {
        Scheduler.loadTriggeredMilestones(snap.triggeredMilestones);
      }

      TransitionManager.updateMoodHealthEffects();
      GameScreen.updateBackground();
      GameScreen.updateCharacter();

      App.showScreen('GAME');
      showToast('读档成功', 'success');

      Scheduler.processSlot(function (type) {
        if (type === 'free') ActionPanel.show();
      });
    }).catch(function (err) {
      showToast('读档失败: ' + err.message, 'error');
    });
  }

  function showToast(msg, type) {
    EventBus.emit('toast', { msg: msg, type: type });
  }

  global.SaveLoad = {
    init: init,
    openSave: openSave,
    openLoad: openLoad
  };
})(typeof window !== 'undefined' ? window : global);
