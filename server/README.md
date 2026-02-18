# 后端说明

Node.js + Express + SQLite 后端，端口 3000，静态托管 `/client`。

## 如何运行

```bash
cd server
npm install
npm start
```

浏览器访问：http://localhost:3000（前端在 `/client` 时访问根路径即可）。

## 如何改管理员密码

**部署时必须修改默认管理员密码。**

默认管理员账号：`admin` / `caifu2001`。若环境变量 `ADMIN_PASSWORD` 已设置，则：

- 首次启动时会用 `ADMIN_PASSWORD` 创建 admin 用户；
- 之后每次启动若存在 `ADMIN_PASSWORD`，会**更新** admin 密码为该值。

示例（Windows）：

```bash
set ADMIN_PASSWORD=你的新密码
npm start
```

Linux/macOS：

```bash
export ADMIN_PASSWORD=你的新密码
npm start
```

## 数据库

- 文件路径：`./data/app.db`（即 `server/data/app.db`）
- 可通过环境变量 `DB_PATH` 指定，例如：`DB_PATH=/var/data/app.db npm start`
- 启动时自动执行 `schema.sql` 做迁移/建表；表已存在则跳过。

## 用户侧 API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 注册 |
| POST | /api/auth/login | 登录（限流） |
| POST | /api/auth/logout | 登出 |
| GET | /api/me | 当前用户（需登录） |
| GET | /api/saves | 存档列表（需登录） |
| GET | /api/saves/:slot | 读档（需登录） |
| POST | /api/saves/:slot | 存档 state_json/summary_json（需登录） |
| POST | /api/logs/action | 写 action_logs（需登录） |
| POST | /api/logs/event | 写 event_logs（需登录） |
| GET | /api/messages | 广播消息 |
| GET | /api/board | 留言列表 |
| POST | /api/board | 发帖（需登录） |
| GET | /api/leaderboard | 排行榜（按 saves.summary_json 中的 atar 聚合） |

登录态通过 httpOnly cookie `token`（JWT）传递；请求时需带 `credentials: 'include'`。

## 如何进入 Admin 后台

1. 使用**管理员账号**登录（默认 `admin` / `caifu2001`，部署务必改密码见上）。
2. 打开后台登录页：**http://localhost:3000/admin/login.html**
3. 输入管理员用户名与密码，登录成功后会跳转到 **http://localhost:3000/admin/index.html**。
4. 仅 `role === 'admin'` 的用户可访问 `/api/admin/*` 及 `/admin/*` 页面；普通用户访问会重定向到 `admin/login.html`。

后台页面（均为原生 HTML/JS/CSS）：

- **/admin/index.html** — 用户列表、搜索与分页、用户详情、存档编辑、禁用/启用、重置密码、冻结/解冻、冒充进入游戏、注入事件
- **/admin/story.html** — 剧情 JSON 编辑、格式化与校验、保存新版本、版本历史与回滚
- **/admin/config.html** — 游戏配置（key/value/ab_group）、配置变更历史、A/B 用户分配
- **/admin/audit.html** — 审计日志分页查看
- **/admin/broadcast.html** — 全局广播（写 messages 表）
- **/admin/analytics.html** — 运营分析（留存、漏斗、结局、活跃时段、事件 Top、行为热力图、节点流、劝退点；可选时间范围 from/to）

## Admin Metrics API（/api/admin/metrics/*，需 admin）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/metrics/retention | 留存 D1/D7/D30（按首次 action 日期 cohort），可选 from/to |
| GET | /api/admin/metrics/funnel | 行为漏斗（进入→自由行动→存档→结局），可选 from/to |
| GET | /api/admin/metrics/node-flow | 节点流（node_id 访问次数 + 边次数），可选 from/to |
| GET | /api/admin/metrics/endings | 结局分布（saves.summary_json 解析） |
| GET | /api/admin/metrics/churn-risk | 劝退点（forced 事件后 3 天未活跃比例），可选 from/to |
| GET | /api/admin/metrics/activity | 活跃时间段（按小时、按星期），可选 from/to |
| GET | /api/admin/metrics/heatmap | 行为热力图（location × action_type），可选 from/to |
| GET | /api/admin/metrics/events-top | 事件 Top（event_id 次数），可选 from/to |

## Admin API（RBAC：仅 admin 可访问）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/users | 用户列表（search, page, limit） |
| POST | /api/admin/users | 新建用户 |
| PATCH | /api/admin/users/:id | 禁用/启用、角色 |
| DELETE | /api/admin/users/:id | 删除用户 |
| POST | /api/admin/users/:id/reset-password | 重置密码 |
| GET | /api/admin/users/:id/saves | 该用户存档列表 |
| GET | /api/admin/users/:id/saves/:slot | 读该用户某槽位存档 |
| PUT | /api/admin/users/:id/saves/:slot | 覆盖存档（校验 JSON，旧版备份到 audit_logs） |
| POST | /api/admin/users/:id/impersonate | 冒充该用户（短期 cookie，跳转 /） |
| POST | /api/admin/users/:id/freeze | 冻结/解冻（user_freeze 表） |
| POST | /api/admin/users/:id/push-event | 注入强制事件（event_logs + calendar_events） |
| POST | /api/admin/broadcast | 写 messages 广播 |
| GET | /api/admin/audit | 审计日志（limit, offset） |
| GET | /api/admin/story | 当前剧情 + 版本列表 |
| PUT | /api/admin/story | 保存新版本 + note + 审计 |
| POST | /api/admin/story/rollback/:versionId | 回滚到指定版本 |
| GET | /api/admin/config | 配置列表 |
| PUT | /api/admin/config | 按 key（及可选 ab_group）写 game_configs |
| GET | /api/admin/config/versions | 配置变更历史（audit） |
| POST | /api/admin/ab/assign | 给用户分配 A/B 组 |
