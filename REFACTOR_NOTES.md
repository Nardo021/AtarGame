# AtarGame → Only Math — VN 重写说明

## 一、重写概述

本次将 AtarGame 客户端完全重写为 **"Only Math"** 视觉小说（VN）风格游戏。

**核心变更**：
- 6 场景 + 地图系统 → 2 场景（CLASSROOM / HOME）
- 多角色 → 单角色（Mr Ta / Don Ta）
- 散落剧情节点 → JSON 驱动的 milestone + condition 剧情系统
- 复杂 9 属性 → 精简 4 属性（atar / mood / health / stress）
- 无主菜单 → 完整 VN 界面（主菜单 / 设置 / 存档 / 结局）
- 服务端 API 保持不变

## 二、新旧结构对比

### 旧结构（已删除）
```
client/
  game.js, ui.js, story.js, map.js, history.js
  rules.js, scheduler.js, calendar.js, gallery.js, vn_media.js
  core/router.js
```

### 新结构
```
client/
  index.html                     # 全新 VN 入口
  style.css                      # VN 风格暗色主题
  api.js                         # 保留（统一 API client）
  i18n.js                        # 保留
  core/
    events.js                    # 保留（事件总线）
    state.js                     # 重写：snapshotVersion=2, 4 属性 + counters + mods + flags + tmp
    time.js                      # 重写：CLASS_AM/BREAK/CLASS_PM/AFTER_SCHOOL/EVENING/NIGHT
    transitions.js               # 增强：支持 desaturate/blur/vignette 效果
  game/
    story/story.v1.json          # 剧情数据（5 章 + 11 里程碑 + 7 随机事件 + 6 结局）
    engine.js                    # 新建：VN 脚本解释器（bg/char/say/choice/branch/calc/flag/add/set/screen/ending）
    rules.js                     # 重写：配置驱动平衡系统（moodFactor/healthFactor/depressFactor/sickFactor）
    scheduler.js                 # 重写：milestone 检查 + 随机事件 + 时段调度
    actions.js                   # 新建：CLASS/STUDY/REST/PLAY 行动
  ui/
    app.js                       # 顶层控制器（屏幕切换 + 认证 + 初始化）
    mainMenu.js                  # 主菜单
    settings.js                  # 设置面板（音量/文字速度）
    gameScreen.js                # 游戏界面（背景/角色管理 + VN 事件处理）
    dialogue.js                  # VN 对话框（打字机效果 + 选项）
    hud.js                       # HUD（ATAR/Mood/Health 条 + 日期时段）
    actionPanel.js               # 行动选择面板（带效果预估）
    saveLoad.js                  # 3 槽存档读档
    media.js                     # BGM/SFX 音频管理
  assets/
    bg/                          # 5 张背景（classroom_day/evening/rain/sunset + home_night）
    char/                        # 3 个表情立绘（neutral/stern/soft）
    sfx/                         # 7 个音效（click/choice/save/transition/typewriter/rain_loop/heartbeat）
    assets_manifest.json         # 资源清单
    CREDITS.md                   # 版权说明
```

### 保留的独立页面
- `board.html` + `board.js` — 留言板
- `leaderboard.html` + `leaderboard.js` — 排行榜
- `admin/` — 管理后台（完全不变）

## 三、关键 API 契约

服务端所有 API 不变，新增：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/story` | GET | 返回 `story.v1.json` 内容 |
| `/api/config` | GET | 现包含 `balance` key（数值平衡参数） |

## 四、Config Key 列表

### `balance`（game_configs, ab_group=NULL）

| Key | 默认值 | 说明 |
|-----|--------|------|
| studyMultiplier | 1.0 | 学习效率倍率 |
| classATAR / classHealth / classMood | 1.2 / -0.8 / -0.6 | 上课效果 |
| studyATAR / studyHealth / studyMood | 2.0 / -2.5 / -2.0 | 学习效果 |
| restHealth / restMood | 3.0 / 2.0 | 休息效果 |
| playATAR / playHealth / playMood | -1.5 / 1.0 / 6.0 | 玩耍效果 |
| sickThreshold | 20 | 生病效果触发阈值 |
| depressThreshold | 20 | 抑郁效果触发阈值 |
| depressDailyHealthDrain | 2 | 抑郁时每日健康损耗 |
| burnoutStreak1 / burnoutStreak2 | 3 / 5 | 连续学习惩罚阈值 |
| burnoutExtraHealth1 / burnoutExtraMood2 | 1 / 2 | 连续学习额外惩罚 |
| finalExamRandomMin / Max | -3 / 3 | 期末考试随机波动 |

## 五、Snapshot 版本兼容

- **v0**（旧格式）：扁平结构 `{ atar, mood, health, date_iso, ... }` → 映射到新格式
- **v1**（第一次重构）：`{ stats, time, flags, meta }` → 映射到新格式
- **v2**（当前）：`{ stats, time, flags, counters, mods, meta, triggeredMilestones }`

`state.js` 的 `restoreFromSnapshot()` 自动检测版本并迁移。

## 六、剧情引擎指令集

| 指令 | 参数 | 效果 |
|------|------|------|
| `bg` | asset | 切换背景 |
| `char` | id, pose, nameplate | 显示/切换角色 |
| `say` | who, text | 打字机对话（暂停等待点击） |
| `choice` | id, text, options[] | 选项（暂停等待选择，应用 effects） |
| `branch` | branches[] | 条件分支（if/else） |
| `calc` | set[] | 表达式计算（clamp/round/rand） |
| `flag` | set{} | 设置 flags |
| `add` | path, value | 数值加减 |
| `set` | path, value/valueFrom | 直接设置 |
| `screen` | fx | 视觉效果（desaturate/blur/vignette） |
| `ending` | id, name, text | 触发结局 |

## 七、未来扩展点

1. **新角色**：在 `story.v1.json` 的 `characters` 添加，在 `assets/char/` 添加立绘
2. **新场景**：添加背景图 + 在 `scenes` 列表注册
3. **A/B 测试**：修改 `game_configs_ab` 表中的 `balance` key
4. **新事件**：在 `events` 数组和 `randomEvents` 池中添加
5. **活动**：通过 config 添加限时活动参数，engine 支持条件判断
6. **多语言**：story.v1.json 支持 text_zh / text_en 字段，配合 i18n.js
