# Only Math — VN 风格 Web 视觉小说

一个关于 ATAR 考试压力的视觉小说游戏。你是一名澳大利亚高中生，面对严厉的数学老师 Mr Ta，在成绩、健康与心理之间寻找平衡。

## 游戏特色

- **VN 风格**：全屏背景 + 角色立绘 + 打字机对话 + 选项分支
- **数值养成**：ATAR / 心情 / 健康 三大属性，影响剧情走向
- **6 种结局**：过劳死亡 / 抑郁崩溃 / 99.95 机器 / 理解 / 高分但完整 / 普通毕业
- **5 章剧情**：开学誓言 → 压力 → 崩溃 → 对抗 → 考试
- **配置驱动**：所有数值平衡参数可通过后台热更新

## 技术栈

- **前端**：原生 HTML/CSS/JS（无 React/Vue）
- **后端**：Node.js + Express
- **数据库**：SQLite（sql.js）
- **鉴权**：JWT（httpOnly Cookie）+ bcrypt

## 快速开始

```bash
# 安装依赖
cd server && npm install

# 数据库迁移 + 初始化平衡配置
cd .. && npm run migrate && npm run seed-balance

# 启动
npm start
```

浏览器访问：
- 游戏：http://localhost:3000
- 管理后台：http://localhost:3000/admin/login.html
- 排行榜：http://localhost:3000/leaderboard.html
- 留言板：http://localhost:3000/board.html

## 管理员默认账号

- **用户名**：`admin`
- **默认密码**：`caifu2001`

部署时请通过环境变量修改：
```bash
export ADMIN_PASSWORD=新密码
npm start
```

## 项目结构

```
client/
  index.html, style.css          # 游戏入口
  api.js, i18n.js                 # API 客户端 + 国际化
  core/                           # 核心模块（事件总线/状态/时间/过渡）
  game/                           # 游戏逻辑（引擎/规则/调度/行动）
    story/story.v1.json           # 剧情数据
  ui/                             # UI 组件（主菜单/对话/HUD/行动面板/存档）
  assets/                         # 素材（背景/立绘/音效）
  admin/                          # 管理后台
  board.html, leaderboard.html   # 独立页面

server/
  server.js                       # Express 入口
  core/                           # 核心模块（DB/Auth/验证/错误/限流/审计）
  modules/                        # 业务模块（user/save/game/community/admin）
  scripts/                        # 迁移 + 配置种子
  schema.sql                      # 数据库 Schema
```

## 数值平衡系统

所有参数从 `game_configs` 表读取，可通过管理后台修改：

| 行动 | ATAR | 健康 | 心情 | 备注 |
|------|------|------|------|------|
| 上课 | +1.2 | -0.8 | -0.6 | 受 mood/health 倍率影响 |
| 学习 | +2.0 | -2.5 | -2.0 | 连续学习惩罚叠加 |
| 休息 | 0 | +3.0 | +2.0 | 抑郁时效果减半 |
| 出去玩 | -1.5 | +1.0 | +6.0 | 心情回升但 ATAR 下降 |

## 素材说明

当前素材为 AI 生成占位图。替换方法：
1. 将新素材放入 `client/assets/bg/` 或 `client/assets/char/`
2. 更新 `client/assets/assets_manifest.json`
3. 在 `client/assets/CREDITS.md` 记录来源

推荐素材来源：
- **Potat0Master**（itch.io）— 学校背景 + 教师立绘，royalty-free
- **Kenney**（kenney.nl）— UI 音效，CC0
- **OpenGameArt** — 环境音效，CC0

## LiveOps 与 A/B 测试

- 注册时自动分配 A/B 组
- `GET /api/config` 返回合并后的配置
- 管理后台可按组设置不同参数
- 运营分析支持 A/B 对比

详细说明见 `REFACTOR_NOTES.md`。
