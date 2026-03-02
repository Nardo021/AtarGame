/**
 * Dialogue: VN dialogue box with typewriter effect
 */
(function (global) {
  var typewriterTimer = null;
  var fullText = '';
  var displayedChars = 0;
  var isTyping = false;
  var onTypingComplete = null;

  function init() {
    var box = document.getElementById('dialogue-box');
    if (box) {
      box.addEventListener('click', handleClick);
    }

    EventBus.on('vn:say', function (data) {
      show(data.who, data.text);
    });

    EventBus.on('vn:choice', function (data) {
      showChoices(data);
    });
  }

  function show(who, text) {
    var box = document.getElementById('dialogue-box');
    var nameplate = document.getElementById('nameplate');
    var textEl = document.getElementById('dialogue-text');
    var indicator = document.getElementById('dialogue-indicator');
    var choicesEl = document.getElementById('choices-container');

    if (choicesEl) choicesEl.style.display = 'none';

    if (box) box.style.display = 'block';

    if (nameplate) {
      if (who && who !== 'NARRATOR') {
        nameplate.textContent = who === 'MR_TA' ? (getCharNameplate() || 'Mr Ta') : who;
        nameplate.style.display = 'inline-block';
      } else {
        nameplate.textContent = '';
        nameplate.style.display = 'none';
      }
    }

    if (indicator) indicator.style.display = 'none';

    fullText = text || '';
    displayedChars = 0;
    isTyping = true;

    if (textEl) textEl.textContent = '';

    startTypewriter();
    Media.playSfx('typewriter');
  }

  function getCharNameplate() {
    var charEl = document.getElementById('char-left');
    return charEl ? charEl.dataset.nameplate : null;
  }

  function startTypewriter() {
    clearTypewriter();
    var textEl = document.getElementById('dialogue-text');
    if (!textEl) return;

    var speed = (Store.getState().settings || {}).textSpeed || 40;

    typewriterTimer = setInterval(function () {
      displayedChars++;
      textEl.textContent = fullText.substring(0, displayedChars);

      if (displayedChars >= fullText.length) {
        finishTyping();
      }
    }, speed);
  }

  function clearTypewriter() {
    if (typewriterTimer) {
      clearInterval(typewriterTimer);
      typewriterTimer = null;
    }
  }

  function finishTyping() {
    clearTypewriter();
    isTyping = false;

    var textEl = document.getElementById('dialogue-text');
    if (textEl) textEl.textContent = fullText;

    var indicator = document.getElementById('dialogue-indicator');
    if (indicator) indicator.style.display = 'block';
  }

  function handleClick(e) {
    e.stopPropagation();

    if (isTyping) {
      finishTyping();
      return;
    }

    hide();
    Engine.advance();
  }

  function showChoices(data) {
    var box = document.getElementById('dialogue-box');
    var choicesEl = document.getElementById('choices-container');
    var nameplate = document.getElementById('nameplate');
    var textEl = document.getElementById('dialogue-text');
    var indicator = document.getElementById('dialogue-indicator');

    if (box) box.style.display = 'block';
    if (indicator) indicator.style.display = 'none';

    if (nameplate) {
      nameplate.textContent = '';
      nameplate.style.display = 'none';
    }

    if (textEl) textEl.textContent = data.text || '';

    if (!choicesEl) return;
    choicesEl.innerHTML = '';
    choicesEl.style.display = 'flex';

    for (var i = 0; i < data.options.length; i++) {
      (function (index) {
        var btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = data.options[index].label;
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          Media.playSfx('choice');
          choicesEl.style.display = 'none';
          Engine.selectChoice(index);
        });
        choicesEl.appendChild(btn);
      })(i);
    }
  }

  function hide() {
    var box = document.getElementById('dialogue-box');
    var choicesEl = document.getElementById('choices-container');
    if (box) box.style.display = 'none';
    if (choicesEl) choicesEl.style.display = 'none';
    clearTypewriter();
  }

  function isVisible() {
    var box = document.getElementById('dialogue-box');
    return box && box.style.display !== 'none';
  }

  global.Dialogue = {
    init: init,
    show: show,
    showChoices: showChoices,
    hide: hide,
    isVisible: isVisible
  };
})(typeof window !== 'undefined' ? window : global);
