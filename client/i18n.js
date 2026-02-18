/**
 * 整站中英文双语
 */
(function (global) {
  var LANG_KEY = 'atar-lang';
  var lang = localStorage.getItem(LANG_KEY) || 'zh';

  var strings = {
    zh: {
      title: 'ATAR 养成',
      login_username: '用户名',
      login_password: '密码',
      login_invite: '邀请码（仅注册必填）',
      remember_me: '记住我',
      btn_login: '登录',
      btn_register: '注册',
      link_leaderboard: '排行榜',
      link_board: '留言板',
      hud_atar: 'ATAR',
      hud_mood: '心情',
      hud_health: '健康',
      hud_stress: '压力',
      hud_fatigue: '疲劳',
      hud_location: '地点',
      hud_time: '时间',
      loc_home: '家',
      loc_school: '学校',
      loc_internet_cafe: '网吧',
      location_classroom: '教室',
      location_corridor: '走廊',
      location_field: '操场',
      location_clubroom: '社团部',
      location_home: '家',
      location_internet_cafe: '网吧',
      btn_map: '地图',
      btn_back_map: '返回地图',
      btn_calendar: '日历',
      btn_afk: '上课（挂机）',
      btn_travel: '移动',
      btn_sleep: '睡觉',
      btn_pause: '暂停',
      btn_history: '历史',
      btn_save: '存档',
      btn_load: '读档',
      history_title: '对话历史',
      calendar_title: '日历',
      btn_close: '关闭',
      save_ok: '存档成功',
      save_fail: '存档失败',
      load_ok: '读档成功',
      load_fail: '读档失败',
      btn_resume: '继续',
      go_home_first: '请先回家',
      no_dest: '暂无可用目的地',
      afk_text: '挂机中…',
      back_game: '← 返回游戏',
      lb_title: 'ATAR 排行榜',
      lb_mode: '排行依据：',
      lb_best_ever: '历史最高 ATAR',
      lb_latest: '最近存档',
      lb_best_day: '当日最佳',
      lb_rank: '排名',
      lb_user: '用户',
      lb_date: '日期',
      board_title: '留言板',
      board_placeholder: '说点什么…（需登录）',
      board_post: '发布',
      lang_zh: '中文',
      lang_en: 'English',
      admin_title: 'ATAR 管理',
      admin_nav_home: '首页',
      admin_nav_analytics: '运营分析',
      admin_nav_users: '用户管理',
      admin_nav_invite: '邀请码',
      admin_nav_story: '剧情管理',
      admin_nav_broadcast: '广播',
      admin_nav_operate: '玩家操作',
      admin_nav_system: '系统',
      admin_nav_logout: '退出',
      admin_theme_light: '浅色模式',
      admin_theme_dark: '深色模式',
      admin_login_title: '管理员登录',
      admin_login_username: '用户名',
      admin_login_password: '密码',
      admin_login_btn: '登录',
      admin_back_game: '← 返回游戏',
      admin_err_need_admin: '需要管理员账号',
      admin_err_login_fail: '登录失败',
      admin_err_enter_cred: '请输入用户名和密码'
    },
    en: {
      title: 'ATAR',
      login_username: 'Username',
      login_password: 'Password',
      login_invite: 'Invite code (required for register)',
      remember_me: 'Remember me',
      btn_login: 'Login',
      btn_register: 'Register',
      link_leaderboard: 'Leaderboard',
      link_board: 'Board',
      hud_atar: 'ATAR',
      hud_mood: 'Mood',
      hud_health: 'Health',
      hud_stress: 'Stress',
      hud_fatigue: 'Fatigue',
      hud_location: 'Location',
      hud_time: 'Time',
      loc_home: 'Home',
      loc_school: 'School',
      loc_internet_cafe: 'Internet Cafe',
      location_classroom: 'Classroom',
      location_corridor: 'Corridor',
      location_field: 'Field',
      location_clubroom: 'Club Room',
      location_home: 'Home',
      location_internet_cafe: 'Internet Cafe',
      btn_map: 'Map',
      btn_back_map: 'Back to Map',
      btn_calendar: 'Calendar',
      btn_afk: 'Class (AFK)',
      btn_travel: 'Travel',
      btn_sleep: 'Sleep',
      btn_pause: 'Pause',
      btn_history: 'History',
      btn_save: 'Save',
      btn_load: 'Load',
      history_title: 'Dialogue History',
      calendar_title: 'Calendar',
      btn_close: 'Close',
      save_ok: 'Saved',
      save_fail: 'Save failed',
      load_ok: 'Loaded',
      load_fail: 'Load failed',
      btn_resume: 'Resume',
      go_home_first: 'Go home first',
      no_dest: 'No destination available',
      afk_text: 'AFK…',
      back_game: '← Back to Game',
      lb_title: 'ATAR Leaderboard',
      lb_mode: 'Sort by:',
      lb_best_ever: 'Best ATAR Ever',
      lb_latest: 'Latest Save',
      lb_best_day: 'Best Today',
      lb_rank: 'Rank',
      lb_user: 'User',
      lb_date: 'Date',
      board_title: 'Board',
      board_placeholder: 'Say something… (login required)',
      board_post: 'Post',
      lang_zh: '中文',
      lang_en: 'English',
      admin_title: 'ATAR Admin',
      admin_nav_home: 'Dashboard',
      admin_nav_analytics: 'Analytics',
      admin_nav_users: 'Users',
      admin_nav_invite: 'Invite Codes',
      admin_nav_story: 'Story',
      admin_nav_broadcast: 'Broadcast',
      admin_nav_operate: 'Players',
      admin_nav_system: 'System',
      admin_nav_logout: 'Logout',
      admin_theme_light: 'Light',
      admin_theme_dark: 'Dark',
      admin_login_title: 'Admin Login',
      admin_login_username: 'Username',
      admin_login_password: 'Password',
      admin_login_btn: 'Login',
      admin_back_game: '← Back to Game',
      admin_err_need_admin: 'Admin account required',
      admin_err_login_fail: 'Login failed',
      admin_err_enter_cred: 'Enter username and password'
    }
  };

  function t(key) { return (strings[lang] && strings[lang][key]) || strings.zh[key] || key; }
  function locationName(locKey) {
      var k = (locKey || '').replace(/-/g, '_');
      return t('location_' + k) || t('loc_' + k) || locKey;
    }
  function setLang(l) { lang = l === 'en' ? 'en' : 'zh'; localStorage.setItem(LANG_KEY, lang); }
  function getLang() { return lang; }

  function apply() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (key) el.placeholder = t(key);
    });
    var title = document.querySelector('title');
    if (title && document.body.getAttribute('data-i18n-title')) title.textContent = t('title') + (document.body.getAttribute('data-i18n-title') || '');
  }

  function toggle() {
    setLang(lang === 'zh' ? 'en' : 'zh');
    apply();
    if (global.UI && global.UI.onLangChange) global.UI.onLangChange();
  }

  global.I18n = {
    t: t,
    locationName: locationName,
    setLang: setLang,
    getLang: getLang,
    apply: apply,
    toggle: toggle
  };
})(typeof window !== 'undefined' ? window : this);
