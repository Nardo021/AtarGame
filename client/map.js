/**
 * 地图热点配置：rect + available(state)，数据驱动
 * 场景 id：classroom, corridor, field, clubroom, home, internet_cafe（可扩展 city_mall, library）
 */
(function (global) {
  var SCHEDULER = global.SCHEDULER;

  function parseDate(iso) {
    var p = iso.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function getDay(iso) {
    return parseDate(iso).getDay();
  }

  var LOCATIONS = [
    { id: 'classroom', nameKey: 'location_classroom', zone: 'school' },
    { id: 'corridor', nameKey: 'location_corridor', zone: 'school' },
    { id: 'field', nameKey: 'location_field', zone: 'school' },
    { id: 'clubroom', nameKey: 'location_clubroom', zone: 'school' },
    { id: 'home', nameKey: 'location_home', zone: 'home' },
    { id: 'internet_cafe', nameKey: 'location_internet_cafe', zone: 'internet_cafe' }
  ];

  var HOTSPOTS = [
    {
      id: 'classroom',
      sceneId: 'classroom',
      rect: { x: 0.35, y: 0.25, w: 0.22, h: 0.35 },
      available: function (state) {
        if (state.frozen) return false;
        var day = getDay(state.date_iso || '2026-01-01');
        var isSatSun = day === 0 || day === 6;
        if (isSatSun) return true;
        return true;
      }
    },
    {
      id: 'corridor',
      sceneId: 'corridor',
      rect: { x: 0.58, y: 0.30, w: 0.18, h: 0.28 },
      available: function (state) {
        if (state.frozen) return false;
        return true;
      }
    },
    {
      id: 'field',
      sceneId: 'field',
      rect: { x: 0.72, y: 0.55, w: 0.22, h: 0.30 },
      available: function (state) {
        if (state.frozen) return false;
        return true;
      }
    },
    {
      id: 'clubroom',
      sceneId: 'clubroom',
      rect: { x: 0.12, y: 0.50, w: 0.20, h: 0.28 },
      available: function (state) {
        if (state.frozen) return false;
        return true;
      }
    },
    {
      id: 'home',
      sceneId: 'home',
      rect: { x: 0.05, y: 0.62, w: 0.25, h: 0.30 },
      available: function (state) {
        if (state.frozen) return false;
        return true;
      }
    },
    {
      id: 'internet_cafe',
      sceneId: 'internet_cafe',
      rect: { x: 0.78, y: 0.18, w: 0.18, h: 0.22 },
      available: function (state) {
        if (state.frozen) return false;
        if ((state.health || 100) < 15) return false;
        return true;
      }
    }
  ];

  function getHotspots() {
    return HOTSPOTS;
  }

  function getHotspotByScene(sceneId) {
    return HOTSPOTS.find(function (h) { return h.sceneId === sceneId; }) || null;
  }

  function getAvailableHotspots(state) {
    return HOTSPOTS.filter(function (h) { return h.available(state); });
  }

  function getLocations() {
    return LOCATIONS;
  }

  function sceneToZone(sceneId) {
    var loc = LOCATIONS.find(function (l) { return l.id === sceneId; });
    return loc ? loc.zone : 'school';
  }

  global.MAP = {
    LOCATIONS: LOCATIONS,
    HOTSPOTS: HOTSPOTS,
    getHotspots: getHotspots,
    getHotspotByScene: getHotspotByScene,
    getAvailableHotspots: getAvailableHotspots,
    getLocations: getLocations,
    sceneToZone: sceneToZone
  };
})(typeof window !== 'undefined' ? window : global);
