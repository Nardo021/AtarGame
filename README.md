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
   - 管理后台：http://localhost:3000/admin/login.html（单独登录页，与游戏账号分离）
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
管理后台使用**单独登录界面**（`/admin/login.html`），登录后使用 `admin_token` Cookie，与游戏端 `token` 分离，互不影响。

## 素材与许可

- **背景**：教室、走廊、操场、社团部、卧室、网吧、地图 — 见 `client/assets/bg-*.svg` 及 `client/assets/assets_manifest.json`。
- **立绘**：玩家、老师、同桌、社团前辈、网吧店员 — 见 `client/assets/char-*.svg`。

当前均为项目内 **SVG 占位图**（地图、教室/走廊/操场/社团/卧室/网吧背景 + 角色立绘），保证离线可运行。可替换为自有或可商用素材：放入 `client/assets/` 并更新 `assets_manifest.json`；或放入 `server/assets/`，通过 `http://localhost:3000/server-assets/` 访问并在前端链接。在项目内注明素材来源与许可（如 CC0）。

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

## 在线功能与 LiveOps 使用说明

### 排行榜（/leaderboard.html）

- **排行依据**（下拉选择）：
  - **历史最高 ATAR**（best_ever）：按用户曾达到的最高 ATAR 排序。
  - **最近存档**（latest）：按最近一次存档的 ATAR 排序。
  - **当日最佳**（last_day）：取「最近有存档的日期」当日，按该日各用户最佳 ATAR 排序。
- 接口：`GET /api/leaderboard?limit=50&mode=best_ever|latest|last_day`。

### 留言板（/board.html）

- **发帖**：需登录，内容 1～5000 字；含敏感词（如「违禁」「广告」「spam」）将拒绝发布。
- **分页**：`GET /api/board?page=1&limit=20&keyword=可选关键词`；支持按内容或用户名关键词筛选。
- **管理员删帖**：后台「系统」页 → 留言板删帖，输入帖子 ID，调用 `DELETE /api/admin/board/:id`（软删，`is_deleted=1`）。

### LiveOps：A/B 组与配置

- **注册自动分配**：新用户注册时按当前用户数奇偶自动写入 `ab_groups`（A 或 B）。
- **按组读配置**：`GET /api/config`（可带登录 Cookie）返回合并后的配置：先读 `game_configs`（默认，ab_group 为空），再按用户所在组读 `game_configs_ab` 同 key 覆盖。前端 `window.__CONFIG__` 用于规则、过渡动画等。
- **后台配置**：Admin → 配置：key 唯一；保存时若 **ab_group** 填 `A` 或 `B`，写入 `game_configs_ab`，否则写入 `game_configs`。
- **A/B 指标对比**：Admin → 运营分析 →「A/B 组对比」：展示各组用户数、ATAR 均值、留存 D1/D7、结局分布。接口：`GET /api/admin/metrics/ab`。

### 1000 玩家模拟器

- **接口**：
  - **发起模拟**：`POST /api/admin/simulate`，body：`{ n, strategyMix, seed? }`  
    - `n`：人数（1～10000，默认 1000）。  
    - `strategyMix`：策略占比，如 `{ study: 0.25, social: 0.25, mixed: 0.25, random: 0.25 }`；或前端选「学习优先」即 `{ study: 1, ... }`。  
    - `seed`：可选随机种子，不传则用时间戳。  
  - **查看历史**：`GET /api/admin/simulation-runs?limit=20`，返回最近模拟的 `id、ts、params_json、result_json`。
- **结果内容**：`result_json` 含 `atar_distribution`（区间人数）、`ending_distribution`（good/normal/bad）、`avg_stress`、`total_forced_events`、`avg_forced_per_player`。
- **使用方式**：Admin → 系统 →「1000 玩家模拟」：填数量、选策略（随机/学习优先/社交优先/混合）、可选种子 → 运行；下方「模拟历史」可刷新查看最近记录。

---

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
- **排行榜与留言板**：ATAR 排行（可选 best_ever / latest / last_day）、发帖/分页/关键词筛选，后台可删帖；留言板支持基础敏感词过滤。
- **LiveOps**：注册自动分配 A/B 组；不同组读取不同 `game_configs` / `game_configs_ab` 参数；运营分析中可对比 A/B 指标（atar 均值、留存、结局分布）。
- **1000 玩家模拟器**：`server/simulator.js` 模拟 N 名玩家跑一年，策略可选学习优先/社交优先/混合/随机；结果写入 `simulation_runs`；Admin 系统页可发起模拟并查看历史结果。
