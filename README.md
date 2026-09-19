# 🌻 植物大战僵尸 · 网页版

> **🎮 在线试玩：<https://pvz-web-br3.pages.dev/>**
> 源码：<https://github.com/ZhangYiFei12/pvz-web>

一个用 **纯前端 Canvas + 原生 JavaScript** 实现的植物大战僵尸网页游戏。
**零运行时依赖、无构建步骤**，克隆下来直接打开就能玩。

画面**全部用 Canvas 路径手绘**（不使用任何图片素材，也不使用 Emoji），
力求还原原版的卡通画风：木质种子槽、阳光计数器、条纹草坪、左侧房屋、
底部带旗标的进度条，以及会走路、会啃植物的僵尸。

---

## ✨ 特性

| 模块 | 内容 |
|------|------|
| **植物**（9 种） | 向日葵、豌豆射手、坚果墙、寒冰射手、双发射手、樱桃炸弹、火爆辣椒、土豆雷、大嘴花 |
| **僵尸**（9 种） | 普通、路障、铁桶、撑杆（跳过植物）、报纸（被打掉后暴走）、铁门、舞王、橄榄球、巨人（一击摧毁植物） |
| **关卡**（5 个） | `1-1` ~ `1-4` 递进难度 + `∞` 无尽生存 |
| **原版 UI** | 顶部木质种子槽（含冷却遮罩）、阳光计数器、铲子、暂停按钮、底部进度条与波次旗标、关卡开场「准备…种植！」 |
| **原版玩法** | 阳光经济、种子卡冷却、每行小推车保底、波次预警、浓雾关卡、护具可被打掉、报纸僵尸暴走 |
| **手绘动画** | 僵尸走路摆腿/摆臂/张嘴、植物摇摆/射击后坐力、坚果墙随伤害开裂、土豆雷武装指示灯、大嘴花开合 |
| **音效** | WebAudio 实时合成，无音频文件 |
| **操作** | 鼠标 / 触屏 / 键盘（`1`-`9` 选卡、`S` 铲子、`G` 自动拾取、`空格` 暂停、`Esc` 取消） |
| **适配** | 响应式画布，按 DPR 渲染，手机端可玩 |

---

## 🚀 本地运行

因为使用原生脚本（非 ES module），**直接双击 `site/index.html` 就能玩**。
若想用本地服务器：

```bash
npm run dev          # → http://localhost:5173
```

或：

```bash
python -m http.server 8000 --directory site
```

---

## 🎮 玩法

1. **收集阳光** ☀️ — 点击天上掉落的阳光，或种向日葵持续产出。
2. **种植植物** 🌱 — 点顶部种子卡选中 → 点草坪格子种下。再点一次可取消。
3. **挡住僵尸** 🧟 — 别让僵尸走到最左边；每行有一台小推车作为最后防线（**只能用一次**）。
4. **撑过所有波次** 🚩 — 底部进度条上的旗标代表波次，全部清空即通关。

**新手建议**：前两列先铺满向日葵滚经济 → 第 2~5 列放射手 → 第 7~8 列放坚果墙 →
僵尸逼近时用樱桃炸弹救场。

### 🧟 僵尸图鉴

| 僵尸 | 特点 |
|------|------|
| 普通僵尸 | 基础单位 |
| 路障僵尸 | 头顶锥筒，血量翻倍；锥筒会被打掉 |
| 铁桶僵尸 | 头顶铁桶，血量极高 |
| 撑杆僵尸 | 移动快，会跳过遇到的第一株植物 |
| 报纸僵尸 | 报纸被打掉后移动速度暴增 |
| 铁门僵尸 | 正面有铁门格挡，血量高 |
| 舞王僵尸 | 爆炸头 + 白西装 |
| 橄榄球僵尸 | 头盔护具，又快又硬 |
| 巨人僵尸 | 体型巨大，一击摧毁植物 |

### ⌨️ 快捷键

| 按键 | 功能 |
|------|------|
| `1` ~ `9` | 选择对应种子卡 |
| `S` | 切换铲子 |
| `G` | 开启 / 关闭自动拾取阳光 |
| `空格` | 暂停 / 继续 |
| `Esc` | 取消当前选择 |
| `H` | 打开帮助 |

### ☀️ 自动拾取阳光

默认**关闭**。三种开启方式：暂停面板按钮 / `G` 键 / 帮助面板勾选。
开启后阳光落地即被自动收走（带 0.35 秒延迟，保留视觉反馈），设置会记住。

---

## 🧪 测试

四层测试，**全部零依赖**（无需 `npm install`）。

```bash
npm test              # 冒烟 + DOM 集成 + 真实浏览器（140 项断言）
npm run test:smoke    # 逻辑层：52 项单元检查 + 完整游戏循环
npm run test:dom      # UI 层：加载 main.js，模拟画布点击/键盘，55 项集成检查
npm run test:browser  # 真实浏览器：headless Edge/Chrome，33 项像素级断言
npm run test:play     # 完整通关实测（逐关自动打完，校验 0 漏过 / 无 JS 错误）
npm run test:balance  # 平衡性：AI 自动试玩，输出各关通关率
npm run test:live     # 对线上 Cloudflare 站点跑真实浏览器验收
npm run test:all      # 全部
```

| 脚本（`tools/`） | 作用 |
|------|------|
| `smoke-test.cjs` | 桩化 DOM/Canvas，断言核心逻辑（小推车、炸弹、大嘴花、胜负判定、自动拾取） |
| `dom-test.cjs` | 加载 `main.js`，断言画布内 HUD 的点击命中、键盘、设置持久化、结算 |
| `browser-test.cjs` | 起本地服务 + headless 浏览器，断言真实渲染像素与对比度 |
| `playthrough.cjs` | 逐关自动打完，验证可通关性与无运行时错误 |
| `preview-map.cjs` | **把渲染结果转成 ASCII 色彩图**，在终端审视画面构图 |
| `winrate.cjs` | AI 自动试玩，统计各关通关率 |
| `balance-sim.cjs` | 会玩 AI 的逐关试玩报告 |
| `diagnose.cjs` | 防线强度 / 阳光经济曲线诊断 |
| `engine-test.cjs` | 单只僵尸对满防线的击杀耗时验证 |
| `live-verify.cjs` | 对线上已部署站点跑同一套浏览器断言 |

### 可见性指标（真实浏览器像素测量）

| 指标 | 数值 |
|------|------|
| 僵尸区域与草坪亮度差 | ~78（亮度 99 vs 176） |
| 9 / 9 种植物清晰可辨 | ✅ |
| 9 / 9 种僵尸变体可绘制 | ✅ |
| 豌豆与草坪色差 | ~89 |

实现方式：所有单位手绘时统一带**近黑粗描边**，僵尸额外加深色地面阴影，
草坪降低饱和度避免"荧光绿"抢注意力；种子卡、僵尸血条均有描边保证可读。

### 当前平衡性（AI 试玩 8 次/关）

| 关卡 | 通关率 |
|------|--------|
| `1-1` 白天 · 前院 | 100% |
| `1-2` 白天 · 强化 | 88% |
| `1-3` 白天 · 铁桶来袭 | 88% |
| `1-4` 浓雾 · 高难度 | 88% |
| `∞` 无尽 · 生存挑战 | 平均坚持 ~387 秒 |

### 完整通关实测

| 关卡 | 波次 | 漏过 | 用时 |
|------|------|------|------|
| `1-1` | 5/5 | 0 | 133s |
| `1-2` | 6/6 | 0 | 148s |
| `1-3` | 7/7 | 0 | 209s |
| `1-4` | 8/8 | 0 | 289s |
| `∞` | — | — | 445s（140 击杀） |

---

## 📁 项目结构

```
pvz-web/
├── site/                     ← 只有这个目录会被发布到 Cloudflare
│   ├── index.html            # 单页面入口（弹窗层）
│   ├── css/style.css         # 外层框架与弹窗样式
│   ├── js/
│   │   ├── config.js         # 网格 · UI 布局 · 植物/僵尸/关卡数据
│   │   ├── audio.js          # WebAudio 合成音效
│   │   ├── sprites.js        # 植物 / 阳光 / 小推车 的手绘（Canvas 路径）
│   │   ├── sprites-zombie.js # 僵尸手绘（9 种变体 + 行走动画）
│   │   ├── entities.js       # Plant / Zombie / Projectile / Sun / 粒子
│   │   ├── renderer-hud.js   # 画布内 HUD（种子槽 / 阳光栏 / 进度条）
│   │   ├── renderer.js       # 草坪 / 房屋 / 实体绘制
│   │   ├── game.js           # 核心：状态机 · 波次 · 碰撞 · 小推车 · 存档
│   │   └── main.js           # 启动 · 弹窗 · 输入事件
│   └── _headers              # Cloudflare Pages 响应头
├── tools/                    # 测试与调参脚本（不部署）
├── wrangler.toml             # Cloudflare Pages 配置（指向 site/）
├── .github/workflows/deploy.yml
├── package.json              # 仅含脚本，无依赖
└── README.md
```

### 架构要点

- **全部程序化绘制**：`sprites.js` / `sprites-zombie.js` 用 Canvas 路径手绘，
  单位以「脚下中心」为原点，便于按格子对齐与做动画。
- **坐标系解耦**：逻辑坐标固定为 `972 × 660`，渲染时 `ctx.scale(dpr × scale)`
  适配任意屏幕；鼠标坐标反算回逻辑坐标，因此点击命中与分辨率无关。
- **HUD 画进画布**：种子槽 / 阳光栏 / 进度条都是 Canvas 绘制，
  `seedRects()` / `shovelRect()` / `pauseRect()` 同时供绘制与点击命中使用，
  保证「看到的位置」与「可点的位置」永远一致。
- **震屏只作用于游戏世界**，HUD 保持稳定。
- **可测时间**：所有计时基于 `performance.now()`，测试中替换为虚拟时钟，
  可在毫秒内验证数分钟的游戏逻辑。

---

## ☁️ 部署到 Cloudflare Pages

**当前线上地址：<https://pvz-web-br3.pages.dev/>**

只有 **`site/` 目录**会被发布（`wrangler.toml` 中 `pages_build_output_dir = "site"`），
所以 `tools/`、`README.md` 等开发文件不会出现在线上。项目**无需 build command**。

### 方式 A：命令行直接上传（当前采用）

```bash
npm run deploy      # = wrangler pages deploy site --project-name pvz-web
```

首次在新机器上部署：

```bash
npx wrangler login
npx wrangler pages project create pvz-web --production-branch main --force
```

> `--force` 仅在创建项目时需要（Wrangler 4.131+ 默认会委托给 Workers）。

### 方式 B：Git 集成（推送即自动部署）

Cloudflare Dashboard → **Workers & Pages** → `pvz-web` → **Settings** →
**Builds & deployments** → **Connect to Git** → 选仓库：

| 配置项 | 值 |
|--------|-----|
| Framework preset | `None` |
| Build command | **（留空）** |
| Build output directory | `site` |

### 方式 C：GitHub Actions（需额外配置）

`.github/workflows/deploy.yml` 已就绪：先跑全部测试，通过才部署。
默认**不启用**（避免未配置 Secret 时报红）。启用步骤：

1. **Settings → Secrets and variables → Actions** 添加两个 Secret：

   | Secret | 获取方式 |
   |--------|---------|
   | `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create，权限 **Cloudflare Pages: Edit** |
   | `CLOUDFLARE_ACCOUNT_ID` | `cbe14bf39d3ffca77025e06225cd0b46` |

2. 同页面 **Variables** 标签添加 `CF_PAGES_ENABLED` = `true`

### 网络受限环境下推送 GitHub

若 `github.com:443` 被阻断但 `api.github.com` 可用，可改用 **SSH over 443**：

```bash
git remote set-url origin ssh://git@ssh.github.com:443/<用户名>/pvz-web.git
git push -u origin main
```

可先用 `ssh -T -p 443 git@ssh.github.com` 验证连通性。

---

## 🎨 说明

- 美术为**原创 Canvas 手绘**，风格致敬原版《植物大战僵尸》，
  但**未使用任何原版美术资源**，无版权风险。
- 音效为代码实时合成。
- 本项目为学习 / 演示用途。

## 📄 License

MIT
