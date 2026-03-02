/**
 * ActionPanel: displays available actions with estimated effects
 */
(function (global) {
  var visible = false;

  var LOCATION_AGNOSTIC_SLOTS = ['AFTER_SCHOOL', 'EVENING', 'MORNING', 'AFTERNOON'];

  function init() {
    EventBus.on('slot:processed', function (data) {
      if (data.type === 'free') {
        showWithMap();
      }
    });
  }

  function showWithMap() {
    var slotId = Store.getState().time.slotId;
    if (LOCATION_AGNOSTIC_SLOTS.indexOf(slotId) >= 0) {
      MapOverlay.show(function () {
        show();
      });
    } else {
      show();
    }
  }

  function show() {
    var panel = document.getElementById('action-panel');
    var container = document.getElementById('action-buttons');
    if (!panel || !container) return;

    Dialogue.hide();

    var actions = Actions.getAvailableActions();
    container.innerHTML = '';

    for (var i = 0; i < actions.length; i++) {
      (function (action) {
        var btn = document.createElement('button');
        btn.className = 'action-btn';

        var labelSpan = document.createElement('span');
        labelSpan.className = 'action-label';
        labelSpan.textContent = action.icon + ' ' + action.label;
        btn.appendChild(labelSpan);

        var estimate = Rules.getEstimate(action.id);
        if (estimate) {
          var estSpan = document.createElement('span');
          estSpan.className = 'action-estimate';
          estSpan.innerHTML = formatEstimate(estimate);
          btn.appendChild(estSpan);
        }

        btn.addEventListener('click', function () {
          Media.playSfx('click');
          hide();
          Actions.executeAction(action.id, function (type, id) {
            if (type === 'free') {
              showWithMap();
            }
          });
        });

        container.appendChild(btn);
      })(actions[i]);
    }

    panel.style.display = 'block';
    visible = true;
  }

  function formatEstimate(est) {
    var parts = [];
    if (est.atar !== 0) {
      var cls = est.atar > 0 ? 'pos' : 'neg';
      parts.push('<span class="' + cls + '">ATAR ' + (est.atar > 0 ? '+' : '') + (Math.round(est.atar * 10) / 10) + '</span>');
    }
    if (est.health !== 0) {
      var cls2 = est.health > 0 ? 'pos' : 'neg';
      parts.push('<span class="' + cls2 + '">HP ' + (est.health > 0 ? '+' : '') + (Math.round(est.health * 10) / 10) + '</span>');
    }
    if (est.mood !== 0) {
      var cls3 = est.mood > 0 ? 'pos' : 'neg';
      parts.push('<span class="' + cls3 + '">Mood ' + (est.mood > 0 ? '+' : '') + (Math.round(est.mood * 10) / 10) + '</span>');
    }
    return parts.join(' / ');
  }

  function hide() {
    var panel = document.getElementById('action-panel');
    if (panel) panel.style.display = 'none';
    visible = false;
  }

  function isVisible() { return visible; }

  global.ActionPanel = {
    init: init,
    show: show,
    hide: hide,
    isVisible: isVisible
  };
})(typeof window !== 'undefined' ? window : global);
