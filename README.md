# 🌻 植物大战僵尸 · 网页版

一个用 **纯前端 Canvas + 原生 JavaScript** 实现的植物大战僵尸网页游戏。
**零运行时依赖、无构建步骤**，克隆下来直接打开就能玩，可一键部署到 Cloudflare Pages。

<p align="center">
  <b>5 个关卡（含无尽模式）· 9 种植物 · 7 种僵尸 · 每行小推车保底</b>
</p>

---

## ✨ 特性

| 模块 | 内容 |
|------|------|
| **植物**（9 种） | 向日葵、豌豆射手、坚果墙、寒冰射手、双发射手、樱桃炸弹、火爆辣椒、土豆雷、大嘴花 |
| **僵尸**（7 种） | 普通、路障、铁桶、撑杆（跳过植物）、舞王、橄榄球、巨人（一击摧毁植物） |
| **关卡**（5 个） | 4 个递进难度关卡 + 1 个无限波次生存模式 |
| **系统** | 阳光经济、种子卡冷却、每行小推车保底、铲子、波次预警、进度存档（localStorage） |
| **表现** | 粒子特效、伤害飘字、震屏、爆炸光环、浓雾关卡、受击闪白、血条 |
| **音效** | 全部由 WebAudio 实时合成，**无音频文件依赖** |
| **操作** | 鼠标 / 触屏 / 键盘（`1`-`6` 选卡、`S` 铲子、`空格` 暂停、`Esc` 取消） |
| **适配** | 响应式画布，按 DPR 渲染，手机端可玩 |

---

## 🚀 本地运行

因为使用原生脚本（非 ES module），**直接双击 `site/index.html` 就能玩**。
若想用本地服务器：

```bash
npm run dev          # → http://localhost:5173
```

或者用 Python：

```bash
python -m http.server 8000 --directory site
```

---

## ☁️ 部署到 Cloudflare Pages

只有 **`site/` 目录**会被发布（`wrangler.toml` 中 `pages_build_output_dir = "site"`），
所以 `tools/`、`README.md` 等开发文件不会出现在线上站点。
项目**无需 build command**。

### 方式 A：Git 集成（推荐 · 推送即自动部署）

1. 推送到 GitHub：

   ```bash
   cd pvz-web
   git init
   git add .
   git commit -m "feat: 网页版植物大战僵尸"
   git branch -M main
   git remote add origin https://github.com/<你的用户名>/pvz-web.git
   git push -u origin main
   ```

2. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**

3. 选择 `pvz-web` 仓库，按下表填写：

   | 配置项 | 值 |
   |--------|-----|
   | Framework preset | `None` |
   | Build command | **（留空）** |
   | Build output directory | `site` |

4. 点击 **Save and Deploy**。之后每次 `git push` 都会自动重新部署。

> 若在仓库根目录执行 `wrangler` 时它自动读取了 `wrangler.toml`，
> 则 build output directory 会自动识别为 `site`。

### 方式 B：命令行直接上传

```bash
npx wrangler login                 # 浏览器授权一次
npm run deploy                     # = wrangler pages deploy site --project-name pvz-web
```

预览环境（不覆盖生产）：

```bash
npm run deploy:preview
```

### 方式 C：GitHub Actions 自动部署

`.github/workflows/deploy.yml` 已就绪：先跑全部测试，测试通过才部署。
在仓库 **Settings → Secrets and variables → Actions** 添加两个 Secret：

| Secret 名称 | 从哪里获取 |
|-------------|-----------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create Token，权限选 **Cloudflare Pages: Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard 右侧栏的 Account ID |

> ⚠️ 若已用方式 A 的 Git 集成，Cloudflare 自身即可自动部署，
> 此时可忽略方式 C，或删除该 workflow 以免重复部署。

---

## 🎮 玩法

1. **收集阳光** ☀️ — 点击天上掉落的阳光，或种向日葵持续产出。
2. **种植植物** 🌱 — 点顶部种子卡选中 → 点草坪格子种下。再点一次可取消。
3. **挡住僵尸** 🧟 — 别让僵尸走到最左边；每行有一台小推车作为最后防线（**只能用一次**）。
4. **撑过所有波次** 🚩 — 进度条上的旗标代表波次，全部清空即通关。

**新手建议**：前两列先铺满向日葵滚经济 → 第 2~5 列放射手 → 第 7~8 列放坚果墙 → 僵尸逼近时用樱桃炸弹救场。

### 键盘快捷键

| 按键 | 功能 |
|------|------|
| `1` ~ `6` | 选择对应种子卡 |
| `S` | 切换铲子 |
| `空格` | 暂停 / 继续 |
| `Esc` | 取消当前选择 |
| `H` | 打开帮助 |

---

## 🧪 测试

三层测试，**全部零依赖**（无需 `npm install`）。

```bash
npm test              # 冒烟 + DOM 集成 + 真实浏览器（110 项断言）
npm run test:smoke    # 逻辑层：38 项单元检查 + 完整游戏循环
npm run test:dom      # UI 层：加载 main.js，模拟点击/键盘，46 项集成检查
npm run test:browser  # 真实浏览器：headless Edge/Chrome，26 项像素级断言
npm run test:balance  # 平衡性：AI 自动试玩，输出各关通关率
npm run test:all      # 全部
```

| 脚本（`tools/`） | 作用 |
|------|------|
| `smoke-test.cjs` | 桩化 DOM/Canvas，断言核心逻辑（含小推车、炸弹、大嘴花、胜负判定） |
| `dom-test.cjs` | 加载 `main.js`，断言 UI 交互（选卡、种植、铲子、暂停、存档、结算） |
| `browser-test.cjs` | 起本地服务 + headless 浏览器，断言真实渲染像素 |
| `winrate.cjs` | AI 自动试玩，统计各关通关率 |
| `balance-sim.cjs` | 会玩 AI 的逐关试玩报告 |
| `diagnose.cjs` | 防线强度 / 阳光经济曲线诊断 |
| `engine-test.cjs` | 单只僵尸对满防线的击杀耗时验证 |

### 当前平衡性（AI 试玩 8 次/关，存在随机波动）

| 关卡 | 通关率 |
|------|--------|
| 第 1 关 白天 · 前院 | ~100% |
| 第 2 关 白天 · 强化 | ~65% |
| 第 3 关 白天 · 铁桶来袭 | ~55% |
| 第 4 关 浓雾 · 高难度 | ~50% |
| 第 5 关 无尽 · 生存挑战 | 平均坚持 ~300 秒 |

> 这是「固定策略 AI」的成绩；人类玩家通常明显更好。
> 用 `npm run test:balance` 可复现。

---

## 📁 项目结构

```
pvz-web/
├── site/                     ← 只有这个目录会被发布到 Cloudflare
│   ├── index.html            # 单页面入口（菜单 / HUD / 各种面板）
│   ├── css/style.css         # 全部样式（含响应式与移动端适配）
│   ├── js/
│   │   ├── config.js         # 网格参数 · 植物/僵尸/关卡定义 · 无尽波次生成
│   │   ├── audio.js          # WebAudio 合成音效
│   │   ├── entities.js       # Plant / Zombie / Projectile / Sun / 粒子
│   │   ├── renderer.js       # Canvas 绘制层
│   │   ├── game.js           # 核心：状态机 · 波次 · 碰撞 · 小推车 · 存档
│   │   └── main.js           # 启动 · UI 绑定 · 输入事件
│   └── _headers              # Cloudflare Pages 响应头（缓存 / 安全）
├── tools/                    # 测试与调参脚本（不部署）
│   ├── smoke-test.cjs
│   ├── dom-test.cjs
│   ├── browser-test.cjs
│   ├── browser/probe.{html,js}
│   └── ...
├── wrangler.toml             # Cloudflare Pages 配置（指向 site/）
├── .github/workflows/deploy.yml
├── package.json              # 仅含脚本，无依赖
└── README.md
```

### 架构要点

- **坐标系解耦**：游戏逻辑坐标固定为 `CFG.W × CFG.H`（`78+9×80` × `74+5×92`），
  渲染时用 `ctx.scale(dpr × scale)` 适配任意屏幕尺寸。
- **主循环**：`requestAnimationFrame` 驱动，`dt` 上限 `0.05s`，
  防止切换标签页回来后僵尸瞬移。
- **碰撞**：植物用网格数组按行列索引，命中判定用 `x` 距离，均为 O(n) 且足够快。
- **可测时间**：所有内部计时基于 `performance.now()`，
  测试中可替换为虚拟时钟，从而在毫秒内验证数分钟的游戏逻辑。

---

## 🎨 说明

- 美术为 **Canvas 绘制 + Emoji**，不含任何原版《植物大战僵尸》的美术资源，无版权风险。
- 音效为代码实时合成，不含音频文件。
- 本项目为学习 / 演示用途。

## 📄 License

MIT
