/**
 * EventBus: 全局事件总线，解耦 UI 与业务逻辑
 */
(function (global) {
  var listeners = {};

  function on(event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
    return function off() {
      var arr = listeners[event];
      if (!arr) return;
      var idx = arr.indexOf(fn);
      if (idx >= 0) arr.splice(idx, 1);
    };
  }

  function off(event, fn) {
    var arr = listeners[event];
    if (!arr) return;
    if (!fn) { listeners[event] = []; return; }
    var idx = arr.indexOf(fn);
    if (idx >= 0) arr.splice(idx, 1);
  }

  function emit(event) {
    var arr = listeners[event];
    if (!arr || arr.length === 0) return;
    var args = [];
    for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
    var copy = arr.slice();
    for (var j = 0; j < copy.length; j++) {
      try { copy[j].apply(null, args); } catch (e) { console.error('[EventBus]', event, e); }
    }
  }

  function once(event, fn) {
    var remove = on(event, function () {
      remove();
      fn.apply(null, arguments);
    });
    return remove;
  }

  global.EventBus = { on: on, off: off, emit: emit, once: once };
})(typeof window !== 'undefined' ? window : global);
