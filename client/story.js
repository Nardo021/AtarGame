// 默认剧情（可被服务端热更新覆盖）
(function () {
  var nodes = {
    start: {
      text: '2026年1月1日，早晨。你在学校，数学课正在进行。',
      next: 'class_afk',
      choices: []
    },
    class_afk: {
      text: '你选择挂机上课，认真听讲（或发呆）。',
      next: 'class_afk_continue',
      choices: []
    },
    class_afk_continue: {
      text: '时间在流逝……',
      next: null,
      choices: [{ id: 'next_block', text: '进入下一时间块', next: '__next_block__' }]
    },
    random_quiz: {
      text: '老师突然点名让你回答问题！',
      next: null,
      choices: [
        { id: 'quiz_correct', text: '尝试回答', next: 'quiz_ok', delta: { atar: 3, reputation: 2 } },
        { id: 'quiz_wrong', text: '回答错误', next: 'quiz_fail', delta: { mood: -3, stress: 3 } },
        { id: 'quiz_fake', text: '装懂蒙混', next: 'quiz_fake_end', delta: { mood: -1, stress: 1 } }
      ]
    },
    quiz_fake_end: {
      text: '老师将信将疑地让你坐下了。',
      next: '__resume__',
      choices: []
    },
    quiz_ok: {
      text: '答对了！老师点头赞许。',
      next: '__resume__',
      choices: []
    },
    quiz_fail: {
      text: '答错了，有点尴尬。',
      next: '__resume__',
      choices: []
    },
    random_sleep: {
      text: '你不知不觉睡着了……',
      next: '__resume__',
      choices: [],
      delta: { health: 1, atar: 0, reputation: -1 }
    },
    random_talk: {
      text: '同桌凑过来小声跟你说话。',
      next: null,
      choices: [
        { id: 'talk_respond', text: '敷衍回应', next: '__resume__', delta: { mood: 2, reputation: 1, atar: -1 } },
        { id: 'talk_ignore', text: '继续听课', next: '__resume__', delta: { mood: 0, atar: 2 } }
      ]
    },
    random_board: {
      text: '被点名上台做题！压力好大。',
      next: null,
      choices: [
        { id: 'board_ok', text: '做对了', next: '__resume__', delta: { stress: 4, atar: 4 } },
        { id: 'board_fail', text: '做错了', next: '__resume__', delta: { stress: 4, mood: -2 } }
      ]
    },
    forced_rest: {
      text: '身体不适，今天必须休息，无法外出。',
      next: '__resume__',
      choices: []
    },
    forced_low_mood: {
      text: '心情很差，做什么都提不起劲。',
      next: '__resume__',
      choices: []
    },
    forced_burnout: {
      text: '压力过大，学习效率明显下降。',
      next: '__resume__',
      choices: []
    }
  };

  window.__DEFAULT_STORY__ = { nodes: nodes };
})();
