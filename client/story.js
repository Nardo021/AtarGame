/**
 * 剧情内容库（中文）：上课插入 / 校园日常 / 社团链 / 网吧线 / 家庭线 / 成长转折 / 黑化 / 真结局 / NG+ / 随机小剧场
 * 节点 id 供 scheduler 按时段/地点/概率/日期触发；选择写 action_logs 由 game.js 统一处理
 */
(function (global) {
  var nodes = {};

  // ========== 上课时段概率插入（挂机不弹主动剧情，仅概率插入）==========
  nodes.random_quiz = {
    id: 'random_quiz',
    text: '老师突然点名让你回答问题！',
    next: null,
    choices: [
      { id: 'quiz_correct', text: '尝试回答', next: 'quiz_ok', delta: { atar: 3, reputation: 2 } },
      { id: 'quiz_wrong', text: '回答错误', next: 'quiz_fail', delta: { mood: -3, stress: 3 } },
      { id: 'quiz_fake', text: '装懂蒙混', next: 'quiz_fake_end', delta: { mood: -1, stress: 1 } }
    ]
  };
  nodes.quiz_ok = { id: 'quiz_ok', text: '答对了！老师点头赞许。', next: '__resume__', choices: [] };
  nodes.quiz_fail = { id: 'quiz_fail', text: '答错了，有点尴尬。', next: '__resume__', choices: [] };
  nodes.quiz_fake_end = { id: 'quiz_fake_end', text: '老师将信将疑地让你坐下了。', next: '__resume__', choices: [] };

  nodes.random_sleep = {
    id: 'random_sleep',
    text: '你不知不觉睡着了……同桌捅了你一下才醒。',
    next: '__resume__',
    choices: [],
    delta: { fatigue: -5, reputation: -1, atar: -1 }
  };

  nodes.random_talk = {
    id: 'random_talk',
    text: '同桌凑过来小声跟你说话：「下节体育一起组队呗？」',
    next: null,
    choices: [
      { id: 'talk_respond', text: '敷衍回应', next: '__resume__', delta: { mood: 2, social: 1, atar: -1 }, socialGain: true },
      { id: 'talk_ignore', text: '继续听课', next: '__resume__', delta: { mood: 0, atar: 2 } }
    ]
  };

  nodes.random_board = {
    id: 'random_board',
    text: '被点名上台做题！压力好大。',
    next: null,
    choices: [
      { id: 'board_ok', text: '做对了', next: '__resume__', delta: { stress: 4, atar: 4 } },
      { id: 'board_fail', text: '做错了', next: '__resume__', delta: { stress: 4, mood: -2 } }
    ]
  };

  // ========== 强制事件（健康/心情/压力）==========
  nodes.forced_rest = { id: 'forced_rest', text: '身体不适，今天必须休息，无法外出。', next: '__resume__', choices: [], delta: { health: 5 } };
  nodes.forced_low_mood = { id: 'forced_low_mood', text: '心情很差，做什么都提不起劲。', next: '__resume__', choices: [], delta: { mood: 5 } };
  nodes.forced_burnout = { id: 'forced_burnout', text: '压力过大，学习效率明显下降。', next: '__resume__', choices: [], delta: { stress: -10 } };

  // ========== 校园日常事件池（每地点多则）==========
  var campusClassroom = [
    { id: 'campus_classroom_1', text: '课间你在座位上翻笔记，前排同学回头问你这题怎么做。', choices: [
      { id: 'a', text: '耐心讲解', next: '__next_block__', delta: { reputation: 2, logic: 1 }, socialGain: true },
      { id: 'b', text: '说自己也还没懂', next: '__next_block__', delta: { mood: -1 } }
    ]},
    { id: 'campus_classroom_2', text: '黑板旁贴着月考成绩单，有人围着看。', choices: [
      { id: 'a', text: '也过去看一眼', next: '__next_block__', delta: { stress: 2 } },
      { id: 'b', text: '不看了，继续写题', next: '__next_block__', delta: { atar: 1 } }
    ]},
    { id: 'campus_classroom_3', text: '值日生正在擦黑板，粉笔灰飘过来。', choices: [
      { id: 'a', text: '帮忙开窗', next: '__next_block__', delta: { reputation: 1, health: 0 } },
      { id: 'b', text: '低头写作业', next: '__next_block__', delta: {} }
    ]},
    { id: 'campus_classroom_4', text: '有人传小纸条到你桌上，写着「放学一起走吗」。', choices: [
      { id: 'a', text: '回一个「好」', next: '__next_block__', delta: { mood: 3, social: 2 }, socialGain: true },
      { id: 'b', text: '揉掉不理会', next: '__next_block__', delta: { mood: -1 } }
    ]},
    { id: 'campus_classroom_5', text: '老师拖堂了五分钟，大家小声抱怨。', choices: [
      { id: 'a', text: '趁机多记两句', next: '__next_block__', delta: { atar: 2, fatigue: 1 } },
      { id: 'b', text: '发呆等下课', next: '__next_block__', delta: { mood: -1 } }
    ]},
    { id: 'campus_classroom_6', text: '教室后排有人在讨论周末去哪玩。', choices: [
      { id: 'a', text: '凑过去听', next: '__next_block__', delta: { mood: 2, social: 1 }, socialGain: true },
      { id: 'b', text: '戴耳机背书', next: '__next_block__', delta: { atar: 1 } }
    ]},
    { id: 'campus_classroom_7', text: '你的笔没水了，同桌递来一支。', choices: [
      { id: 'a', text: '道谢接过', next: '__next_block__', delta: { mood: 1, reputation: 1 } },
      { id: 'b', text: '说不用，自己找', next: '__next_block__', delta: {} }
    ]},
    { id: 'campus_classroom_8', text: '窗户外有只鸟停在树枝上，你多看了两眼。', choices: [
      { id: 'a', text: '看一会儿再学', next: '__next_block__', delta: { mood: 2, fatigue: -1 } },
      { id: 'b', text: '马上收回注意力', next: '__next_block__', delta: { atar: 0 } }
    ]},
    { id: 'campus_classroom_9', text: '有人问你要不要一起订奶茶。', choices: [
      { id: 'a', text: '订一杯', next: '__next_block__', delta: { mood: 2, social: 1 }, socialGain: true },
      { id: 'b', text: '不订，省钱', next: '__next_block__', delta: {} }
    ]},
    { id: 'campus_classroom_10', text: '班主任在门口叫了你的名字，让你去办公室一趟。', choices: [
      { id: 'a', text: '紧张地过去', next: '__next_block__', delta: { stress: 3 } },
      { id: 'b', text: '平静地去', next: '__next_block__', delta: { reputation: 1 } }
    ]}
  ];
  campusClassroom.forEach(function (n) { nodes[n.id] = n; });

  var campusCorridor = [
    { id: 'campus_corridor_1', text: '走廊里两个同学在争论一道题，你路过时被拉住问「你觉得呢？」', choices: [
      { id: 'a', text: '认真分析', next: '__next_block__', delta: { logic: 1, reputation: 2 }, socialGain: true },
      { id: 'b', text: '说不知道', next: '__next_block__', delta: {} }
    ]},
    { id: 'campus_corridor_2', text: '公告栏贴着社团招新海报。', choices: [
      { id: 'a', text: '仔细看看', next: 'campus_corridor_2b', delta: {} },
      { id: 'b', text: '匆匆走过', next: '__next_block__', delta: {} }
    ]},
    { id: 'campus_corridor_2b', text: '有几个社团挺有意思，要不要记一下？', choices: [
      { id: 'a', text: '记下活动室位置', next: '__next_block__', delta: { mood: 1 }, flags: { saw_club_post: 1 } },
      { id: 'b', text: '算了', next: '__next_block__', delta: {} }
    ]},
    { id: 'campus_corridor_3', text: '洗手间门口碰到同班同学，对方冲你点头。', choices: [
      { id: 'a', text: '也点头打招呼', next: '__next_block__', delta: { reputation: 1 } },
      { id: 'b', text: '低头快步过', next: '__next_block__', delta: {} }
    ]},
    { id: 'campus_corridor_4', text: '有人抱着一摞作业本差点撞到你。', choices: [
      { id: 'a', text: '帮忙扶一把', next: '__next_block__', delta: { reputation: 2 }, socialGain: true },
      { id: 'b', text: '侧身让开', next: '__next_block__', delta: {} }
    ]},
    { id: 'campus_corridor_5', text: '楼梯口有老师在训人，你放轻脚步经过。', choices: [
      { id: 'a', text: '快步离开', next: '__next_block__', delta: { stress: 1 } },
      { id: 'b', text: '正常走', next: '__next_block__', delta: {} }
    ]},
    { id: 'campus_corridor_6', text: '走廊窗边有人在背单词，声音很小。', choices: [
      { id: 'a', text: '也站旁边背一会儿', next: '__next_block__', delta: { atar: 1 } },
      { id: 'b', text: '去别处', next: '__next_block__', delta: {} }
    ]},
    { id: 'campus_corridor_7', text: '有人掉了饭卡，你捡起来递还。', choices: [
      { id: 'a', text: '递还并说不用谢', next: '__next_block__', delta: { reputation: 2 }, socialGain: true },
      { id: 'b', text: '默默递还', next: '__next_block__', delta: { reputation: 1 } }
    ]},
    { id: 'campus_corridor_8', text: '两个别班的人指着你说「就他/她」，你有点不自在。', choices: [
      { id: 'a', text: '装作没听见', next: '__next_block__', delta: { mood: -1, stress: 1 } },
      { id: 'b', text: '看回去', next: '__next_block__', delta: { stress: 2 } }
    ]},
    { id: 'campus_corridor_9', text: '值周生提醒你「别跑」，你放慢脚步。', choices: [
      { id: 'a', text: '点头认错', next: '__next_block__', delta: { reputation: 0 } },
      { id: 'b', text: '没理继续走', next: '__next_block__', delta: { reputation: -1 } }
    ]},
    { id: 'campus_corridor_10', text: '有人在发传单，塞给你一张「补习班试听」。', choices: [
      { id: 'a', text: '收下看看', next: '__next_block__', delta: {} },
      { id: 'b', text: '婉拒', next: '__next_block__', delta: {} }
    ]}
  ];
  campusCorridor.forEach(function (n) { nodes[n.id] = n; });

  var campusField = [
    { id: 'campus_field_1', text: '操场上有人在打球，球滚到你脚边。', choices: [
      { id: 'a', text: '踢回去', next: '__next_block__', delta: { mood: 2, social: 1 }, socialGain: true },
      { id: 'b', text: '捡起来递过去', next: '__next_block__', delta: { reputation: 1 } }
    ]},
    { id: 'campus_field_2', text: '体育老师吹哨集合，你小跑过去。', choices: [
      { id: 'a', text: '认真做准备活动', next: '__next_block__', delta: { health: 1 } },
      { id: 'b', text: '随便动两下', next: '__next_block__', delta: {} }
    ]},
    { id: 'campus_field_3', text: '有人邀请你一起跑圈。', choices: [
      { id: 'a', text: '一起跑', next: '__next_block__', delta: { stamina: 2, social: 1 }, socialGain: true },
      { id: 'b', text: '婉拒', next: '__next_block__', delta: {} }
    ]},
    { id: 'campus_field_4', text: '树荫下有人在聊天，笑声传过来。', choices: [
      { id: 'a', text: '凑过去听', next: '__next_block__', delta: { mood: 2, social: 1 }, socialGain: true },
      { id: 'b', text: '在旁边休息', next: '__next_block__', delta: { fatigue: -2 } }
    ]},
    { id: 'campus_field_5', text: '你发现地上有别人落下的钥匙扣。', choices: [
      { id: 'a', text: '交给失物招领', next: '__next_block__', delta: { reputation: 2 } },
      { id: 'b', text: '先拿着等认领', next: '__next_block__', delta: { reputation: 1 } }
    ]},
    { id: 'campus_field_6', text: '自由活动时间，你站在场边发呆。', choices: [
      { id: 'a', text: '找个人少的地方坐', next: '__next_block__', delta: { fatigue: -1 } },
      { id: 'b', text: '随便走走', next: '__next_block__', delta: { mood: 1 } }
    ]},
    { id: 'campus_field_7', text: '有人问你会不会打羽毛球。', choices: [
      { id: 'a', text: '会，打一会儿', next: '__next_block__', delta: { health: 1, social: 2 }, socialGain: true },
      { id: 'b', text: '不会', next: '__next_block__', delta: {} }
    ]},
    { id: 'campus_field_8', text: '太阳很晒，你躲到看台下面。', choices: [
      { id: 'a', text: '趁机背几个单词', next: '__next_block__', delta: { atar: 1 } },
      { id: 'b', text: '闭眼休息', next: '__next_block__', delta: { fatigue: -2 } }
    ]},
    { id: 'campus_field_9', text: '班里几个同学在练接力，缺一个人。', choices: [
      { id: 'a', text: '顶上', next: '__next_block__', delta: { stamina: 1, reputation: 2 }, socialGain: true },
      { id: 'b', text: '摆手拒绝', next: '__next_block__', delta: {} }
    ]},
    { id: 'campus_field_10', text: '操场边的小卖部排着队，你有点渴。', choices: [
      { id: 'a', text: '排队买水', next: '__next_block__', delta: { health: 1 } },
      { id: 'b', text: '回教室喝', next: '__next_block__', delta: {} }
    ]}
  ];
  campusField.forEach(function (n) { nodes[n.id] = n; });

  var campusClubroom = [
    { id: 'campus_clubroom_1', text: '活动室里只有一位学长在整理东西。', choices: [
      { id: 'a', text: '打招呼问问能帮忙吗', next: '__next_block__', delta: { reputation: 2, social: 1 }, socialGain: true },
      { id: 'b', text: '安静找地方坐', next: '__next_block__', delta: {} }
    ]},
    { id: 'campus_clubroom_2', text: '黑板上写着下周活动安排。', choices: [
      { id: 'a', text: '记下时间', next: '__next_block__', delta: {}, flags: { club_notice_seen: 1 } },
      { id: 'b', text: '扫一眼', next: '__next_block__', delta: {} }
    ]},
    { id: 'campus_clubroom_3', text: '有人带来零食分给大家。', choices: [
      { id: 'a', text: '道谢接过', next: '__next_block__', delta: { mood: 2, social: 1 }, socialGain: true },
      { id: 'b', text: '婉拒', next: '__next_block__', delta: {} }
    ]},
    { id: 'campus_clubroom_4', text: '社长在讲比赛的事，大家围成一圈。', choices: [
      { id: 'a', text: '认真听', next: '__next_block__', delta: { reputation: 1 }, flags: { club_meeting_attend: 1 } },
      { id: 'b', text: '在角落做自己的事', next: '__next_block__', delta: {} }
    ]},
    { id: 'campus_clubroom_5', text: '柜子里有旧海报和奖状，你好奇看了看。', choices: [
      { id: 'a', text: '问学长过去的事', next: '__next_block__', delta: { social: 1 }, socialGain: true },
      { id: 'b', text: '看完就放回', next: '__next_block__', delta: {} }
    ]},
    { id: 'campus_clubroom_6', text: '有人提议周末加练，问你来不来。', choices: [
      { id: 'a', text: '来', next: '__next_block__', delta: { stamina: 0, social: 2 }, socialGain: true, flags: { club_weekend_yes: 1 } },
      { id: 'b', text: '再说吧', next: '__next_block__', delta: {} }
    ]},
    { id: 'campus_clubroom_7', text: '活动室空调坏了，大家扇着本子抱怨。', choices: [
      { id: 'a', text: '一起吐槽', next: '__next_block__', delta: { mood: 1, social: 1 }, socialGain: true },
      { id: 'b', text: '去接杯水', next: '__next_block__', delta: { health: 0 } }
    ]},
    { id: 'campus_clubroom_8', text: '新人自我介绍环节轮到你。', choices: [
      { id: 'a', text: '简单说两句', next: '__next_block__', delta: { social: 2 }, socialGain: true },
      { id: 'b', text: '说「和大家一样来学习的」', next: '__next_block__', delta: { social: 1 } }
    ]},
    { id: 'campus_clubroom_9', text: '有人在练乐器，你听了一会儿。', choices: [
      { id: 'a', text: '夸一句', next: '__next_block__', delta: { mood: 1, reputation: 1 }, socialGain: true },
      { id: 'b', text: '不打扰', next: '__next_block__', delta: {} }
    ]},
    { id: 'campus_clubroom_10', text: '活动结束大家陆续离开，你最后一个关灯。', choices: [
      { id: 'a', text: '检查门窗', next: '__next_block__', delta: { reputation: 2 } },
      { id: 'b', text: '关灯锁门', next: '__next_block__', delta: { reputation: 1 } }
    ]}
  ];
  campusClubroom.forEach(function (n) { nodes[n.id] = n; });

  var campusHome = [
    { id: 'campus_home_1', text: '回到家，桌上留着便条：「饭在锅里」。', choices: [
      { id: 'a', text: '热了吃', next: '__next_block__', delta: { health: 2, mood: 1 } },
      { id: 'b', text: '随便吃点别的', next: '__next_block__', delta: { health: 1 } }
    ]},
    { id: 'campus_home_2', text: '你房间的灯坏了，一闪一闪的。', choices: [
      { id: 'a', text: '跟家长说', next: '__next_block__', delta: {} },
      { id: 'b', text: '先凑合用台灯', next: '__next_block__', delta: { stress: 1 } }
    ]},
    { id: 'campus_home_3', text: '楼下有邻居在吵架，声音传上来。', choices: [
      { id: 'a', text: '戴耳机', next: '__next_block__', delta: { mood: -1 } },
      { id: 'b', text: '当背景音写作业', next: '__next_block__', delta: { stress: 1 } }
    ]},
    { id: 'campus_home_4', text: '你发现冰箱上贴了张「加油」的便签。', choices: [
      { id: 'a', text: '看了一会儿，收好', next: '__next_block__', delta: { mood: 3 } },
      { id: 'b', text: '没在意', next: '__next_block__', delta: {} }
    ]},
    { id: 'campus_home_5', text: '想熬夜刷题，但眼皮已经在打架。', choices: [
      { id: 'a', text: '再撑半小时', next: '__next_block__', delta: { atar: 1, fatigue: 5 } },
      { id: 'b', text: '先睡，明早再说', next: '__next_block__', delta: { fatigue: -5 } }
    ]},
    { id: 'campus_home_6', text: '家长推门进来送水果。', choices: [
      { id: 'a', text: '道谢并聊两句', next: '__next_block__', delta: { mood: 2 }, flags: { family_chat: 1 } },
      { id: 'b', text: '说在忙', next: '__next_block__', delta: { mood: 0 } }
    ]},
    { id: 'campus_home_7', text: '周末早上被阳光晒醒。', choices: [
      { id: 'a', text: '起床吃早饭', next: '__next_block__', delta: { health: 1, stamina: 1 } },
      { id: 'b', text: '再睡一会儿', next: '__next_block__', delta: { fatigue: -3 } }
    ]},
    { id: 'campus_home_8', text: '书桌上堆满了卷子，你叹了口气。', choices: [
      { id: 'a', text: '整理一下再写', next: '__next_block__', delta: { mood: 1 } },
      { id: 'b', text: '扒开一块地方就写', next: '__next_block__', delta: { stress: 1 } }
    ]},
    { id: 'campus_home_9', text: '家里没人，你难得清静。', choices: [
      { id: 'a', text: '专心学习', next: '__next_block__', delta: { atar: 2 } },
      { id: 'b', text: '放松一下', next: '__next_block__', delta: { mood: 2, fatigue: -2 } }
    ]},
    { id: 'campus_home_10', text: '睡前刷了会儿手机，越刷越精神。', choices: [
      { id: 'a', text: '强行关机睡', next: '__next_block__', delta: { fatigue: -3 } },
      { id: 'b', text: '再刷十分钟', next: '__next_block__', delta: { fatigue: 2 } }
    ]}
  ];
  campusHome.forEach(function (n) { nodes[n.id] = n; });

  var campusCafe = [
    { id: 'campus_cafe_1', text: '网吧里烟雾缭绕，你找了个靠窗的机位。', choices: [
      { id: 'a', text: '先写一会儿作业', next: '__next_block__', delta: { atar: 1, stress: -1 } },
      { id: 'b', text: '直接开游戏', next: '__next_block__', delta: { mood: 2, fatigue: 2 } }
    ]},
    { id: 'campus_cafe_2', text: '旁边有人在组队打本，喊「缺一输出」。', choices: [
      { id: 'a', text: '不理会', next: '__next_block__', delta: {} },
      { id: 'b', text: '凑过去问一句', next: '__next_block__', delta: { social: 1 }, socialGain: true }
    ]},
    { id: 'campus_cafe_3', text: '网管提醒你「学生证优惠到点咯」。', choices: [
      { id: 'a', text: '续费', next: '__next_block__', delta: { mood: 0 } },
      { id: 'b', text: '下机', next: '__next_block__', delta: { fatigue: -1 } }
    ]},
    { id: 'campus_cafe_4', text: '你连续输了三把，有点上头。', choices: [
      { id: 'a', text: '再开一局', next: '__next_block__', delta: { stress: 2, mood: -1 } },
      { id: 'b', text: '关掉休息', next: '__next_block__', delta: { fatigue: -1 } }
    ]},
    { id: 'campus_cafe_5', text: '有人在你身后看屏，你感觉不自在。', choices: [
      { id: 'a', text: '回头看一眼', next: '__next_block__', delta: { stress: 1 } },
      { id: 'b', text: '当没看见', next: '__next_block__', delta: {} }
    ]},
    { id: 'campus_cafe_6', text: '网吧搞活动，连胜有饮料送。', choices: [
      { id: 'a', text: '试试', next: '__next_block__', delta: { mood: 2 } },
      { id: 'b', text: '不参与', next: '__next_block__', delta: {} }
    ]},
    { id: 'campus_cafe_7', text: '你发现常坐的位子被人占了。', choices: [
      { id: 'a', text: '换一台', next: '__next_block__', delta: {} },
      { id: 'b', text: '等那人走', next: '__next_block__', delta: { mood: -1 } }
    ]},
    { id: 'campus_cafe_8', text: '屏幕弹窗「防沉迷提醒」。', choices: [
      { id: 'a', text: '点掉继续', next: '__next_block__', delta: { fatigue: 1 } },
      { id: 'b', text: '趁势下机', next: '__next_block__', delta: { fatigue: -2 } }
    ]},
    { id: 'campus_cafe_9', text: '隔壁在讨论月考答案，你听了一耳朵。', choices: [
      { id: 'a', text: '插话对答案', next: '__next_block__', delta: { stress: 1 } },
      { id: 'b', text: '不听，打自己的', next: '__next_block__', delta: {} }
    ]},
    { id: 'campus_cafe_10', text: '准备走时有人拍你肩：「常来啊。」', choices: [
      { id: 'a', text: '点头', next: '__next_block__', delta: { social: 1 }, socialGain: true },
      { id: 'b', text: '敷衍应声', next: '__next_block__', delta: {} }
    ]}
  ];
  campusCafe.forEach(function (n) { nodes[n.id] = n; });

  // ========== 社团活动链（多日连续）==========
  nodes.club_intro = { id: 'club_intro', text: '社长在活动室门口拦住你：「我们社下周三有校内展示，能来帮忙吗？」', next: null, choices: [
    { id: 'yes', text: '可以', next: 'club_meet_1', delta: { reputation: 2 }, flags: { club_chain: 1 } },
    { id: 'no', text: '可能没空', next: '__next_block__', delta: {} }
  ]};
  nodes.club_meet_1 = { id: 'club_meet_1', text: '第一次排练，大家分工：你负责道具。', next: null, choices: [
    { id: 'ok', text: '没问题', next: '__next_block__', delta: { social: 2 }, socialGain: true, flags: { club_chain: 2 } },
    { id: 'hard', text: '尽量', next: '__next_block__', delta: { social: 1 }, flags: { club_chain: 2 } }
  ]};
  nodes.club_meet_2 = { id: 'club_meet_2', text: '第二次排练，社长说「你上次做的那个能用，再做一个备用的吧。」', next: null, choices: [
    { id: 'ok', text: '好', next: '__next_block__', delta: { logic: 1, reputation: 2 }, flags: { club_chain: 3 } },
    { id: 'tired', text: '有点累，下次吧', next: '__next_block__', delta: { mood: -1 }, flags: { club_chain: 2 } }
  ]};
  nodes.club_meet_3 = { id: 'club_meet_3', text: '展示前一天，大家最后走一遍流程，社长冲你竖大拇指。', next: null, choices: [
    { id: 'happy', text: '松了口气', next: 'club_contest', delta: { mood: 3 }, flags: { club_chain: 4 } },
    { id: 'calm', text: '明天加油', next: 'club_contest', delta: { stress: -1 }, flags: { club_chain: 4 } }
  ]};
  nodes.club_contest = { id: 'club_contest', text: '展示当天，台下坐了不少人。你们顺利完成了，掌声响起。', next: null, choices: [
    { id: 'end', text: '和大家击掌', next: 'club_finale', delta: { reputation: 5, mood: 5, social: 2 }, socialGain: true, flags: { club_chain: 5 } }
  ]};
  nodes.club_finale = { id: 'club_finale', text: '社长说「下次比赛一起冲省赛吧。」你点点头。', next: null, choices: [{ id: 'ok', text: '继续', next: '__next_block__', delta: {}, flags: { club_chain_done: 1 } }] };

  // ========== 网吧剧情线（沉迷/比赛/认识人）==========
  nodes.cafe_first = { id: 'cafe_first', text: '第一次来这家网吧，网管抬头看你：「学生？包时划算。」', next: null, choices: [
    { id: 'try', text: '试试包时', next: '__next_block__', delta: { mood: 1 }, flags: { cafe_chain: 1 } },
    { id: 'no', text: '先上两小时', next: '__next_block__', delta: {}, flags: { cafe_chain: 0 } }
  ]};
  nodes.cafe_addict_1 = { id: 'cafe_addict_1', text: '你发现自己这周已经来了四次，作业有点拖。', next: null, choices: [
    { id: 'cut', text: '这周不来了', next: '__next_block__', delta: { stress: -2 }, flags: { cafe_addiction: 0 } },
    { id: 'again', text: '再玩一次就收心', next: 'cafe_addict_2', delta: { fatigue: 3, atar: -1 }, flags: { cafe_addiction: 1 } }
  ]};
  nodes.cafe_addict_2 = { id: 'cafe_addict_2', text: '凌晨你才下机，头昏脑涨。明天还有早课。', next: null, choices: [{ id: 'ok', text: '……', next: '__next_block__', delta: { health: -2, fatigue: 5 } }] };
  nodes.cafe_match_1 = { id: 'cafe_match_1', text: '网吧举办小型比赛，报名费不贵，第一名有奖金。', next: null, choices: [
    { id: 'join', text: '报名', next: 'cafe_match_2', delta: {}, flags: { cafe_match: 1 } },
    { id: 'watch', text: '围观', next: '__next_block__', delta: { mood: 1 } }
  ]};
  nodes.cafe_match_2 = { id: 'cafe_match_2', text: '你们队打到半决赛，输了。队友拍拍你：「下次再来。」', next: null, choices: [
    { id: 'ok', text: '下次再来', next: '__next_block__', delta: { social: 2, mood: 1 }, socialGain: true, flags: { cafe_match_done: 1 } }
  ]};
  nodes.cafe_friend_1 = { id: 'cafe_friend_1', text: '常坐你旁边的那个人今天主动搭话：「你也玩这个？加个好友呗。」', next: null, choices: [
    { id: 'add', text: '加', next: '__next_block__', delta: { social: 2 }, socialGain: true, flags: { cafe_friend: 1 } },
    { id: 'refuse', text: '不太加陌生人', next: '__next_block__', delta: {} }
  ]};
  nodes.cafe_friend_2 = { id: 'cafe_friend_2', text: '后来你们偶尔一起组队，他/她说「考完试一起出来玩啊」。', next: null, choices: [{ id: 'ok', text: '好', next: '__next_block__', delta: { mood: 2 }, flags: { cafe_friend_done: 1 } }] };

  // ========== 家庭剧情线（父母压力/支持）==========
  nodes.family_dinner_1 = { id: 'family_dinner_1', text: '晚饭时家长问：「最近成绩怎么样？」', next: null, choices: [
    { id: 'good', text: '还行', next: 'family_support_1', delta: {} },
    { id: 'bad', text: '不太理想', next: 'family_pressure_1', delta: { stress: 3 } }
  ]};
  nodes.family_pressure_1 = { id: 'family_pressure_1', text: '「别总玩手机，多看看书。」你低头扒饭。', next: null, choices: [
    { id: 'nod', text: '知道了', next: '__next_block__', delta: { stress: 2 }, flags: { family_pressure: 1 } },
    { id: 'argue', text: '我没总玩', next: '__next_block__', delta: { mood: -2, stress: 3 }, flags: { family_argue: 1 } }
  ]};
  nodes.family_support_1 = { id: 'family_support_1', text: '「压力大就跟我们说，别硬扛。」', next: null, choices: [
    { id: 'thanks', text: '嗯，谢谢', next: '__next_block__', delta: { mood: 3 }, flags: { family_support: 1 } },
    { id: 'ok', text: '没事', next: '__next_block__', delta: { mood: 1 } }
  ]};
  nodes.family_talk_1 = { id: 'family_talk_1', text: '周末家长想带你出去吃饭，问你有没有空。', next: null, choices: [
    { id: 'go', text: '去', next: '__next_block__', delta: { mood: 4 }, socialGain: true, flags: { family_out: 1 } },
    { id: 'study', text: '想在家复习', next: '__next_block__', delta: { atar: 1 } }
  ]};
  nodes.family_talk_2 = { id: 'family_talk_2', text: '你主动跟家长说了最近的烦恼，对方沉默了一会儿说「我们相信你」。', next: null, choices: [{ id: 'ok', text: '……', next: '__next_block__', delta: { mood: 5, stress: -5 }, flags: { family_talk_done: 1 } }] };

  // ========== 成长转折事件（大失败/大成功）==========
  nodes.growth_big_fail = { id: 'growth_big_fail', text: '一次重要考试考砸了。你盯着分数看了很久。', next: null, choices: [
    { id: 'cry', text: '很难受', next: '__next_block__', delta: { mood: -10, stress: 5 }, flags: { growth_fail: 1 } },
    { id: 'calm', text: '下次扳回来', next: '__next_block__', delta: { mood: -3, stress: 2 }, flags: { growth_fail: 1 } }
  ]};
  nodes.growth_big_success = { id: 'growth_big_success', text: '你拿到了从未有过的高分，老师当堂表扬。', next: null, choices: [
    { id: 'happy', text: '开心', next: '__next_block__', delta: { mood: 8, atar: 2 }, flags: { growth_success: 1 } },
    { id: 'humble', text: '保持冷静', next: '__next_block__', delta: { mood: 4, reputation: 2 }, flags: { growth_success: 1 } }
  ]};
  nodes.growth_crisis = { id: 'growth_crisis', text: '连续几天状态很差，你怀疑自己是不是不行。', next: null, choices: [
    { id: 'rest', text: '先休息一天', next: '__next_block__', delta: { fatigue: -10, mood: 2 }, flags: { growth_crisis: 1 } },
    { id: 'push', text: '硬撑', next: '__next_block__', delta: { stress: 5, fatigue: 5 } }
  ]};
  nodes.growth_breakthrough = { id: 'growth_breakthrough', text: '某道卡了很久的题突然想通了，你兴奋得拍桌子。', next: null, choices: [{ id: 'ok', text: '继续', next: '__next_block__', delta: { atar: 3, mood: 5 }, flags: { growth_breakthrough: 1 } }] };

  // ========== 黑化路线（stress 过高）==========
  nodes.dark_warning = { id: 'dark_warning', text: '你最近总是烦躁，一点小事就想发火。', next: null, choices: [
    { id: 'ignore', text: '没事', next: '__next_block__', delta: {}, flags: { dark_warn: 1 } },
    { id: 'rest', text: '找时间放松', next: '__next_block__', delta: { stress: -5 }, flags: { dark_avoid: 1 } }
  ]};
  nodes.dark_breakdown = { id: 'dark_breakdown', text: '你在教室里和同学起了冲突，事后很后悔。', next: null, choices: [
    { id: 'apologize', text: '事后道歉', next: '__next_block__', delta: { reputation: -2, stress: -3 }, flags: { dark_breakdown: 1 } },
    { id: 'cold', text: '不想解释', next: 'dark_route_1', delta: { reputation: -3 }, flags: { dark_route: 1 } }
  ]};
  nodes.dark_route_1 = { id: 'dark_route_1', text: '你开始刻意和人保持距离，觉得一个人更轻松。', next: '__next_block__', choices: [], delta: { mood: -2, social: -2 }, flags: { dark_route: 1 } };

  // ========== 真结局条件树（atar/affection/stress/关键 flags）==========
  nodes.ending_normal = { id: 'ending_normal', text: '毕业那天，你拿着成绩单走出校门。平凡的一年，但你也尽力了。', next: null, choices: [{ id: 'ok', text: '……', next: '__end__', delta: {} }] };
  nodes.ending_good = { id: 'ending_good', text: '你考出了理想的成绩，和家人、朋友一起庆祝。这一年的努力没有白费。', next: null, choices: [{ id: 'ok', text: '……', next: '__end__', delta: {} }] };
  nodes.ending_true = { id: 'ending_true', text: '你不仅成绩优异，也和身边的人建立了真正的联系。你知道，未来的路还长，但你已经准备好了。', next: null, choices: [{ id: 'ok', text: '……', next: '__end__', delta: {} }] };
  nodes.ending_bad = { id: 'ending_bad', text: '压力与疲惫压垮了你。你拿着成绩单，不知该往哪里去。', next: null, choices: [{ id: 'ok', text: '……', next: '__end__', delta: {} }] };

  // ========== 多周目继承（New Game+）==========
  nodes.ng_plus_start = { id: 'ng_plus_start', text: '新的一周目开始了。你隐约记得上次的教训，似乎能少走一些弯路。', next: null, choices: [{ id: 'ok', text: '继续', next: '__next_block__', delta: {}, flags: { ng_plus: 1 } }] };
  nodes.ng_plus_unlock_1 = { id: 'ng_plus_unlock_1', text: '你触发了上一周目未曾见过的剧情……', next: null, choices: [{ id: 'ok', text: '继续', next: '__next_block__', delta: { mood: 2 }, flags: { ng_plus_unlock: 1 } }] };

  // ========== 随机小剧场（轻量、短）==========
  var mini = [
    { id: 'mini_1', text: '走廊里有人摔了一跤，书撒了一地。', choices: [{ id: 'a', text: '帮忙捡', next: '__next_block__', delta: { reputation: 1 } }, { id: 'b', text: '绕开', next: '__next_block__', delta: {} }] },
    { id: 'mini_2', text: '自动贩卖机卡住了，有人踹了一脚，饮料掉了出来。', choices: [{ id: 'a', text: '笑', next: '__next_block__', delta: { mood: 1 } }, { id: 'b', text: '走开', next: '__next_block__', delta: {} }] },
    { id: 'mini_3', text: '有人问你借橡皮。', choices: [{ id: 'a', text: '借', next: '__next_block__', delta: { reputation: 1 } }, { id: 'b', text: '没有', next: '__next_block__', delta: {} }] },
    { id: 'mini_4', text: '窗外下雨了，你没带伞。', choices: [{ id: 'a', text: '等雨停', next: '__next_block__', delta: {} }, { id: 'b', text: '冲出去', next: '__next_block__', delta: { health: -1 } }] },
    { id: 'mini_5', text: '食堂阿姨多给你打了一勺菜。', choices: [{ id: 'a', text: '道谢', next: '__next_block__', delta: { mood: 1 } }, { id: 'b', text: '点头', next: '__next_block__', delta: {} }] },
    { id: 'mini_6', text: '有人在你桌上放了颗糖。', choices: [{ id: 'a', text: '吃掉', next: '__next_block__', delta: { mood: 1 } }, { id: 'b', text: '收起来', next: '__next_block__', delta: {} }] },
    { id: 'mini_7', text: '黑板上的值日名单写了你的名字。', choices: [{ id: 'a', text: '认命去扫', next: '__next_block__', delta: { reputation: 1 } }, { id: 'b', text: '找人换', next: '__next_block__', delta: {} }] },
    { id: 'mini_8', text: '同桌睡着了，老师正在往这边看。', choices: [{ id: 'a', text: '捅醒他', next: '__next_block__', delta: { reputation: 1 } }, { id: 'b', text: '不管', next: '__next_block__', delta: {} }] },
    { id: 'mini_9', text: '有人传错纸条到你手里。', choices: [{ id: 'a', text: '递回去', next: '__next_block__', delta: { reputation: 1 } }, { id: 'b', text: '扔了', next: '__next_block__', delta: {} }] },
    { id: 'mini_10', text: '体育课自由活动，你坐在看台上。', choices: [{ id: 'a', text: '看别人打球', next: '__next_block__', delta: { mood: 1 } }, { id: 'b', text: '发呆', next: '__next_block__', delta: {} }] },
    { id: 'mini_11', text: '放学路上碰到卖烤红薯的。', choices: [{ id: 'a', text: '买一个', next: '__next_block__', delta: { mood: 2 } }, { id: 'b', text: '不买', next: '__next_block__', delta: {} }] },
    { id: 'mini_12', text: '电梯里只有你和陌生人，有点尴尬。', choices: [{ id: 'a', text: '看手机', next: '__next_block__', delta: {} }, { id: 'b', text: '盯着楼层', next: '__next_block__', delta: {} }] },
    { id: 'mini_13', text: '你发现作业本和同桌的拿错了。', choices: [{ id: 'a', text: '换回来', next: '__next_block__', delta: {} }, { id: 'b', text: '将错就错', next: '__next_block__', delta: { stress: 1 } }] },
    { id: 'mini_14', text: '午休时教室很安静，你趴着眯了一会儿。', choices: [{ id: 'a', text: '睡醒精神好', next: '__next_block__', delta: { fatigue: -2 } }, { id: 'b', text: '没睡着', next: '__next_block__', delta: {} }] },
    { id: 'mini_15', text: '有人夸你「今天气色不错」。', choices: [{ id: 'a', text: '谢谢', next: '__next_block__', delta: { mood: 1 } }, { id: 'b', text: '是吗', next: '__next_block__', delta: {} }] }
  ];
  mini.forEach(function (n) { nodes[n.id] = n; });

  // 入口
  nodes.start = { id: 'start', text: '2026年1月1日，早晨。你在学校，数学课正在进行。', next: 'class_afk', choices: [] };
  nodes.class_afk = { id: 'class_afk', text: '你选择挂机上课，认真听讲（或发呆）。', next: 'class_afk_continue', choices: [] };
  nodes.class_afk_continue = { id: 'class_afk_continue', text: '时间在流逝……', next: null, choices: [{ id: 'next_block', text: '进入下一时间块', next: '__next_block__' }] };

  global.__DEFAULT_STORY__ = { nodes: nodes };
})(typeof window !== 'undefined' ? window : global);
