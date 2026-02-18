/**
 * VN 表现：BGM 管理器（场景切换自动切轨）、SFX（按钮/事件音效）hook；无资源时仅留接口
 */
(function (global) {
  var currentBgm = null;
  var bgmVolume = 0.6;
  var sfxVolume = 0.5;

  var BGM_MAP = {
    title: 'assets/bgm/title.mp3',
    map: 'assets/bgm/map.mp3',
    classroom: 'assets/bgm/school.mp3',
    corridor: 'assets/bgm/school.mp3',
    field: 'assets/bgm/school.mp3',
    clubroom: 'assets/bgm/school.mp3',
    home: 'assets/bgm/home.mp3',
    internet_cafe: 'assets/bgm/cafe.mp3',
    event: 'assets/bgm/event.mp3'
  };

  var SFX_MAP = {
    click: 'assets/sfx/click.mp3',
    choice: 'assets/sfx/choice.mp3',
    next: 'assets/sfx/next.mp3',
    event: 'assets/sfx/event.mp3'
  };

  function getBgmKey(locationOrScene) {
    if (!locationOrScene) return 'map';
    var key = String(locationOrScene).toLowerCase();
    return BGM_MAP[key] ? key : (key.indexOf('class') >= 0 || key === 'corridor' || key === 'field' || key === 'clubroom' ? key : key === 'home' ? 'home' : key === 'internet_cafe' ? 'internet_cafe' : 'map');
  }

  function playBgm(key, loop) {
    if (key === currentBgm) return;
    stopBgm();
    var src = BGM_MAP[key] || BGM_MAP.map;
    fetch(src, { method: 'HEAD' }).then(function (r) {
      if (!r.ok) return;
      var audio = new Audio(src);
      audio.volume = bgmVolume;
      audio.loop = loop !== false;
      audio.play().catch(function () {});
      currentBgm = key;
      global.__BGM_AUDIO__ = audio;
    }).catch(function () {});
  }

  function stopBgm() {
    if (global.__BGM_AUDIO__) {
      try { global.__BGM_AUDIO__.pause(); global.__BGM_AUDIO__.currentTime = 0; } catch (e) {}
      global.__BGM_AUDIO__ = null;
    }
    currentBgm = null;
  }

  function setBgmVolume(v) {
    bgmVolume = Math.max(0, Math.min(1, v));
    if (global.__BGM_AUDIO__) global.__BGM_AUDIO__.volume = bgmVolume;
  }

  function playSfx(name) {
    var src = SFX_MAP[name] || SFX_MAP.click;
    fetch(src, { method: 'HEAD' }).then(function (r) {
      if (!r.ok) return;
      var audio = new Audio(src);
      audio.volume = sfxVolume;
      audio.play().catch(function () {});
    }).catch(function () {});
  }

  function setSfxVolume(v) {
    sfxVolume = Math.max(0, Math.min(1, v));
  }

  function onSceneChange(viewMode, locationOrSceneId) {
    if (viewMode === 'MAP') playBgm('map');
    else if (viewMode === 'SCENE' && locationOrSceneId) playBgm(getBgmKey(locationOrSceneId));
  }

  global.VN_MEDIA = {
    playBgm: playBgm,
    stopBgm: stopBgm,
    setBgmVolume: setBgmVolume,
    playSfx: playSfx,
    setSfxVolume: setSfxVolume,
    onSceneChange: onSceneChange,
    BGM_MAP: BGM_MAP,
    SFX_MAP: SFX_MAP
  };
})(typeof window !== 'undefined' ? window : global);
