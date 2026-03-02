/**
 * MapOverlay: abstract map with location nodes (School / Home, extensible)
 * Shows during free slots so the player picks a location before acting.
 */
(function (global) {
  var MAP_NODES = [
    { id: 'CLASSROOM', label: 'School', labelZh: '学校', icon: '🏫' },
    { id: 'HOME', label: 'Home', labelZh: '家', icon: '🏠' }
  ];

  var visible = false;
  var onLocationChosen = null;

  function init() {}

  function show(callback) {
    var overlay = document.getElementById('map-overlay');
    var container = document.getElementById('map-nodes');
    if (!overlay || !container) return;

    onLocationChosen = callback || null;
    container.innerHTML = '';

    var currentScene = Store.getState().runtime.sceneId;

    for (var i = 0; i < MAP_NODES.length; i++) {
      (function (node) {
        var el = document.createElement('button');
        el.className = 'map-node';
        if (node.id === currentScene) el.classList.add('map-node-current');

        el.innerHTML =
          '<span class="map-node-icon">' + node.icon + '</span>' +
          '<span class="map-node-label">' + node.labelZh + '</span>';

        el.addEventListener('click', function () {
          Media.playSfx('click');
          Store.dispatch({ type: 'SET_SCENE', payload: node.id });
          GameScreen.updateBackground();
          GameScreen.updateCharacter();
          hide();
          if (onLocationChosen) onLocationChosen(node.id);
        });

        container.appendChild(el);
      })(MAP_NODES[i]);
    }

    overlay.style.display = 'flex';
    visible = true;
  }

  function hide() {
    var overlay = document.getElementById('map-overlay');
    if (overlay) overlay.style.display = 'none';
    visible = false;
    onLocationChosen = null;
  }

  function isVisible() { return visible; }

  function addNode(node) {
    MAP_NODES.push(node);
  }

  global.MapOverlay = {
    init: init,
    show: show,
    hide: hide,
    isVisible: isVisible,
    addNode: addNode
  };
})(typeof window !== 'undefined' ? window : global);
