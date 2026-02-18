# ATAR 养成 - Web Galgame / 视觉小说

全栈 Web 视觉小说：**地图点击场景切换**、工作日课表/周末自由、上课挂机与随机事件、数值养成（含 logic/social/stamina/fatigue）、日历与日记、场景过渡动画、登录/云存档、上帝后台、运营分析、排行榜与留言板。

## 技术栈

- **前端**：原生 HTML/CSS/JS（无 React/Vue）
- **后端**：Node.js + Express
- **数据库**：SQLite（sql.js，无需本地编译）
- **鉴权**：JWT（httpOnly Cookie）
- **密码**：bcrypt

## 运行步骤（一键运行）

1. 安装依赖（在项目根目录或 server 目录）：
   ```bash
   cd server
   npm install
   ```
   本项目使用 **sql.js**（纯 JavaScript SQLite），Windows/Linux/macOS 均可直接 `npm install`，无需 Visual Studio。

2. 启动服务：
   ```bash
   cd server
   npm start
   ```
   或在项目根目录执行：`node server/server.js`（需已执行过上述 `npm install`）。

3. 浏览器访问：
   - 游戏：http://localhost:3000
   - 管理后台：http://localhost:3000/admin/
   - 排行榜：http://localhost:3000/leaderboard.html
   - 留言板：http://localhost:3000/board.html

## 端口与数据库

- **端口**：默认 `3000`，可通过环境变量 `PORT` 修改。
- **数据库位置**：`server/data/atar.db`（可通过环境变量 `DB_PATH` 指定）。

## 管理员默认账号与密码

- **用户名**：`admin`
- **默认密码**：`caifu2001`

**部署时必须修改默认密码。** 使用环境变量覆盖：

```bash
set ADMIN_PASSWORD=你的新密码
npm start
```

（Linux/macOS 使用 `export ADMIN_PASSWORD=你的新密码`）

首次运行若无 admin 用户会自动创建；若已存在且设置了 `ADMIN_PASSWORD`，会更新 admin 密码。

## 素材与许可

- **背景**：教室、走廊、操场、社团部、卧室、网吧、地图 — 见 `client/assets/bg-*.svg` 及 `client/assets/assets_manifest.json`。
- **立绘**：玩家、老师、同桌、社团前辈、网吧店员 — 见 `client/assets/char-*.svg`。

当前均为项目内 **SVG 占位图**，保证离线可运行。可替换为自有或可商用素材；若使用 Cursor browser 等拉取 CC0 素材，请下载到 `client/assets/` 并更新 `assets_manifest.json`，在项目内注明素材来源与许可（如 Unsplash License / CC0）。

建议来源：Unsplash、Pixabay、OpenGameArt。

## 项目结构

```
/server
  package.json, server.js, db.js, schema.sql
  auth.js, middleware.js, user.routes.js, admin.routes.js, metrics.routes.js
  audit.js, rateLimit.js, simulator.js, storyStore.js
/client
  index.html, style.css, ui.js, game.js, map.js
  story.js, scheduler.js, rules.js, api.js, history.js, calendar.js
  leaderboard.html, leaderboard.js, board.html, board.js
  assets/           # 背景与立绘（assets_manifest.json + SVG 占位）
/client/admin       # 管理后台（独立登录、侧栏、多页）
```

## 功能概览

- **地图与场景**：MAP 视图（地图背景 + 可点击热点）→ 点击建筑进入 SCENE；场景内可「返回地图」；热点可用性随时段、周末、健康/心情/疲劳、冻结状态变化（`map.js` 配置 rect + available(state)）。
- **时间**：2026-01-01～2026-12-31。工作日（周一～五）7 时段：早课、课间、第二节、午餐、下午课、放学、晚上；周末 4 时段：Morning/Afternoon/Evening/Night，自由模式。
- **通勤**：travel 消耗时段并记录 action_logs；home↔school 1 块，school↔internet_cafe 1 块，home↔internet_cafe 2 块。
- **上课挂机**：工作日上课时段（早课/第二节/下午课）挂机结算（atar/mood/stress/fatigue 等），按概率插入随机事件：老师抽查、睡着、同桌搭话、上台解题；抽查/解题成功率由 logic 决定（`rules.js`）。
- **数值**：atar、mood、health、stress、reputation、logic、social、stamina、fatigue（0–100）；疲劳影响学习收益；睡觉/休息降疲劳并恢复（受 stamina 影响）；跨天自然变化可配置。
- **场景过渡**：MAP↔SCENE、SCENE↔SCENE 支持 fade/slide/blur，`ui.js` 的 transitionManager 统一封装，动画期间锁定输入。
- **日历**：月/周/日视图，事件预告（考试等），日记（每日结束自动写入模板总结），点击某日可查看该日行动与事件（API：`/api/calendar`、`/api/diary`、`/api/day-log`）。
- **剧情**：story.js + scheduler.js 数据驱动；action_logs/event_logs 记录供回放与 analytics。
- **账号与云存档**：注册/登录（邀请码必填）、三槽云存档、行动与事件日志。
- **运营分析**：留存、路径热图、漏斗、结局分布、劝退点、NPC 排行、活跃时间段等。
- **God Mode**：在线近似、实时监控、强制事件、广播、冻结、剧情热更新与回滚、回档、模拟、A/B 分组、审计。
- **排行榜与留言板**：ATAR 排行、发帖/列表，后台可删帖。
