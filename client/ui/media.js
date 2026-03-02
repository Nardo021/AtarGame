/**
 * Media: BGM/SFX audio management
 * Loads from assets_manifest.json, respects Store settings
 */
(function (global) {
  var manifest = null;
  var audioCache = {};
  var currentLoop = null;

  function init() {
    return fetch('assets/assets_manifest.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        manifest = data;
        return data;
      })
      .catch(function (e) {
        console.warn('[Media] Failed to load manifest:', e);
        manifest = { backgrounds: {}, characters: {}, sfx: {} };
      });
  }

  function getManifest() { return manifest; }

  function getBgUrl(assetKey) {
    if (!manifest || !manifest.backgrounds) return null;
    var path = manifest.backgrounds[assetKey];
    if (!path) return null;
    return 'assets/' + path;
  }

  function getCharUrl(charId, pose) {
    if (!manifest || !manifest.characters) return null;
    var charData = manifest.characters[charId];
    if (!charData) return null;
    var path = charData[pose];
    if (!path) return null;
    return 'assets/' + path;
  }

  function getSfxUrl(sfxKey) {
    if (!manifest || !manifest.sfx) return null;
    var path = manifest.sfx[sfxKey];
    if (!path) return null;
    return 'assets/' + path;
  }

  function playSfx(key) {
    var url = getSfxUrl(key);
    if (!url) return;

    var settings = Store.getState().settings;
    var volume = settings.sfxVolume !== undefined ? settings.sfxVolume : 0.7;

    try {
      var audio = new Audio(url);
      audio.volume = volume;
      audio.play().catch(function () {});
    } catch (e) {}
  }

  function playLoop(key) {
    stopLoop();
    var url = getSfxUrl(key);
    if (!url) return;

    var settings = Store.getState().settings;
    var volume = settings.bgmVolume !== undefined ? settings.bgmVolume : 0.5;

    try {
      currentLoop = new Audio(url);
      currentLoop.loop = true;
      currentLoop.volume = volume;
      currentLoop.play().catch(function () {});
    } catch (e) {}
  }

  function stopLoop() {
    if (currentLoop) {
      currentLoop.pause();
      currentLoop = null;
    }
  }

  function updateVolumes() {
    var settings = Store.getState().settings;
    if (currentLoop) {
      currentLoop.volume = settings.bgmVolume !== undefined ? settings.bgmVolume : 0.5;
    }
  }

  global.Media = {
    init: init,
    getManifest: getManifest,
    getBgUrl: getBgUrl,
    getCharUrl: getCharUrl,
    getSfxUrl: getSfxUrl,
    playSfx: playSfx,
    playLoop: playLoop,
    stopLoop: stopLoop,
    updateVolumes: updateVolumes
  };
})(typeof window !== 'undefined' ? window : global);
