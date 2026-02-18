/**
 * 管理后台公共：深浅色主题、侧栏高亮、中英文切换
 */
(function () {
  var THEME_KEY = 'admin-theme';
  var theme = localStorage.getItem(THEME_KEY) || 'dark';
  var root = document.documentElement;
  root.setAttribute('data-theme', theme);

  function t(key) { return (window.I18n && window.I18n.t(key)) || key; }
  function applyTheme(tval) {
    theme = tval || theme;
    root.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    var btn = document.getElementById('admin-theme-btn');
    if (btn) {
      btn.innerHTML = theme === 'dark' ? '☀️ ' + t('admin_theme_light') : '🌙 ' + t('admin_theme_dark');
      btn.title = theme === 'dark' ? 'Switch to light' : 'Switch to dark';
    }
  }

  function toggleTheme() {
    applyTheme(theme === 'dark' ? 'light' : 'dark');
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (window.I18n) {
      window.I18n.apply();
      var lzh = document.getElementById('admin-lang-zh');
      var len = document.getElementById('admin-lang-en');
      if (lzh) lzh.onclick = function (e) { e.preventDefault(); window.I18n.setLang('zh'); window.I18n.apply(); applyTheme(theme); lzh.classList.add('active'); if (len) len.classList.remove('active'); };
      if (len) len.onclick = function (e) { e.preventDefault(); window.I18n.setLang('en'); window.I18n.apply(); applyTheme(theme); len.classList.add('active'); if (lzh) lzh.classList.remove('active'); };
      if (window.I18n.getLang() === 'en') { if (len) len.classList.add('active'); } else { if (lzh) lzh.classList.add('active'); }
    }
    applyTheme(theme);
    var btn = document.getElementById('admin-theme-btn');
    if (btn) { btn.onclick = toggleTheme; btn.innerHTML = theme === 'dark' ? '☀️ ' + t('admin_theme_light') : '🌙 ' + t('admin_theme_dark'); }
    var page = window.location.pathname.split('/').pop() || 'index.html';
    var current = document.querySelector('.admin-sidebar-nav a[href="' + page + '"]');
    if (current) current.classList.add('active');
  });
})();
