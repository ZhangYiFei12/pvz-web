/* 真实浏览器中的画面验证：像素级断言 */
window.__err = [];
window.addEventListener('error', e => window.__err.push('ERROR: ' + e.message + ' @' + (e.filename || '') + ':' + e.lineno));
window.addEventListener('unhandledrejection', e => window.__err.push('REJECT: ' + e.reason));

function px(ctx, x, y) {
  const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
  return { r: d[0], g: d[1], b: d[2], a: d[3] };
}
function near(c, r, g, b, tol = 40) {
  return Math.abs(c.r - r) <= tol && Math.abs(c.g - g) <= tol && Math.abs(c.b - b) <= tol;
}

setTimeout(() => {
  const out = [];
  let G, R, cv, ctx, s;
  try {
    G = window.__game;
    R = Renderer;          // const 声明在同一全局词法作用域，可直接引用
    cv = document.getElementById('game');
    ctx = cv.getContext('2d');
    s = R.scale;
  } catch (e) {
    document.body.setAttribute('data-probe', 'FAIL | 探针初始化异常 | ' + e.message);
    document.title = 'DONE';
    return;
  }

  const check = (name, ok, detail) => out.push((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : ''));

  try {
    check('无 JS 错误', window.__err.length === 0, window.__err.join(';'));

    // 走真实 UI 路径：点击第 1 关卡片
    const card = document.querySelector('.level-card');
    check('关卡卡片存在', !!card);
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    check('点击关卡后进入游戏', G.state === 'playing', 'state=' + G.state);
    check('种子卡槽已生成', document.getElementById('seedbar').children.length === LEVELS[0].plants.length,
          'cards=' + document.getElementById('seedbar').children.length);
    G.sun = 9999;
    const put = (id, c, r) => { G.selected = id; G.tryPlant(c, r); G.cooldowns = {}; };
    for (let r = 0; r < 5; r++) {
      put('sunflower', 0, r); put('sunflower', 1, r);
      put('peashooter', 2, r); put('snowpea', 3, r); put('wallnut', 7, r);
    }
    G.spawnWave('basic*2,cone*2,bucket*1');
    for (let i = 0; i < 240; i++) G.update(1 / 60, performance.now() + i * 16);
    R.draw(G);

    check('关卡已加载', !!G.level, G.level && G.level.name);
    check('植物已种植 (25株)', G.plants.length === 25, '实际=' + G.plants.length);
    check('僵尸已生成', G.zombies.length >= 5, '实际=' + G.zombies.length);
    check('小推车 5 台', G.mowers.length === 5);
    check('画布已按 DPR 缩放', cv.width > 0 && cv.height > 0, cv.width + 'x' + cv.height + ' scale=' + s.toFixed(3));

    // --- 草坪像素验证 ---
    const _CFG = CFG;
    const lawnA = px(ctx, (_CFG.HUD_W + 20) * s * (cv.width / (_CFG.W * s)) / (cv.width / (_CFG.W * s)) + 0, 0); // dummy
    // 直接用逻辑坐标 → 物理像素
    const dpr = cv.width / (_CFG.W * s);
    const at = (lx, ly) => px(ctx, lx * s * dpr, ly * s * dpr);

    const g00 = at(_CFG.HUD_W + 20, _CFG.TOP_OFFSET + 20);      // 草格 (0,0)
    const g01 = at(_CFG.HUD_W + _CFG.CELL_W + 20, _CFG.TOP_OFFSET + 20); // 草格 (1,0) 另一色
    check('草坪格 1 为绿色', g00.g > g00.r && g00.g > 100, `rgb(${g00.r},${g00.g},${g00.b})`);
    check('相邻草格颜色不同（棋盘格）', Math.abs(g00.g - g01.g) + Math.abs(g00.r - g01.r) > 5, `(0,0)=${g00.g} (1,0)=${g01.g}`);

    const house = at(30, 300);
    check('左侧房屋区为棕色', house.r > house.g && house.r > house.b, `rgb(${house.r},${house.g},${house.b})`);

    const sky = at(400, 20);
    check('顶部为天空色', sky.b > sky.r || sky.a === 0, `rgb(${sky.r},${sky.g},${sky.b})`);

    // --- 植物绘制验证：向日葵中心应有黄色 ---
    const sunPx = at(_CFG.HUD_W + _CFG.CELL_W * 0 + _CFG.CELL_W / 2, _CFG.TOP_OFFSET + _CFG.CELL_H / 2);
    check('向日葵位置有内容绘制', sunPx.a > 0, `rgb(${sunPx.r},${sunPx.g},${sunPx.b}) a=${sunPx.a}`);

    // --- 阳光绘制验证 ---
    G.suns.length = 0;
    G.suns.push(new Sun(300, 300, 300, 'plant'));
    R.draw(G);
    const sunlight = at(300, 296);
    check('阳光为黄/橙色发光体', sunlight.r > 180 && sunlight.g > 140, `rgb(${sunlight.r},${sunlight.g},${sunlight.b})`);

    // --- 僵尸绘制验证 ---
    G.suns.length = 0;
    G.zombies.length = 0;
    G.spawnWave('basic*1');
    G.zombies.forEach(zz => { zz.x = 500; });
    R.draw(G);
    const zPx = at(500, _CFG.TOP_OFFSET + _CFG.CELL_H / 2 + 6);
    check('僵尸位置有内容绘制', zPx.a > 0, `rgb(${zPx.r},${zPx.g},${zPx.b})`);

    /* ---------- 对比度验证：单位与草坪底色的亮度差 ---------- */
    const lum = c => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

    // 草坪底色（无单位区域）
    const clearBoard = () => {
      G.plants.length = 0; G.zombies.length = 0;
      G.suns.length = 0; G.projectiles.length = 0;
      G.grid = Array.from({ length: 5 }, () => Array(9).fill(null));
    };
    clearBoard();
    R.draw(G);
    const bg = at(_CFG.HUD_W + _CFG.CELL_W * 4.5, _CFG.TOP_OFFSET + _CFG.CELL_H * 4.5);

    // 僵尸所在区域平均亮度 vs 背景
    G.spawnWave('basic*3');
    G.zombies.forEach(zz => { zz.x = 500; zz.y = _CFG.TOP_OFFSET + _CFG.CELL_H / 2 + 6; });
    R.draw(G);
    let zLum = 0, n = 0;
    for (let dx = -18; dx <= 18; dx += 6) {
      for (let dy = -20; dy <= 20; dy += 10) {
        const c = at(500 + dx, _CFG.TOP_OFFSET + _CFG.CELL_H / 2 + 6 + dy);
        zLum += lum(c); n++;
      }
    }
    zLum /= n;
    const bgLum = lum(bg);
    check('僵尸与草坪有明显亮度差', Math.abs(zLum - bgLum) > 18,
          `僵尸=${zLum.toFixed(0)} 草坪=${bgLum.toFixed(0)} 差=${Math.abs(zLum - bgLum).toFixed(0)}`);

    // 豌豆子弹亮度和饱和度（应在草坪上突出）
    G.zombies.length = 0; G.projectiles.length = 0;
    G.sun = 9999;
    G.selected = 'peashooter'; G.cooldowns = {}; G.tryPlant(2, 2);
    const shooter = G.plants[G.plants.length - 1];
    check('射手已就位（豌豆测试前置条件）', !!shooter, 'plants=' + G.plants.length + ' grid22=' + !!G.grid[2][2]);
    G.spawnProjectile(shooter, 500, _CFG.TOP_OFFSET + _CFG.CELL_H * 2.5 - 14);
    R.draw(G);
    const pea = at(500, _CFG.TOP_OFFSET + _CFG.CELL_H * 2.5 - 14);
    const peaSat = Math.max(pea.r, pea.g, pea.b) - Math.min(pea.r, pea.g, pea.b);
    check('豌豆子弹色彩鲜明（有饱和度）', peaSat > 40 || pea.g > pea.r + 30,
          `rgb(${pea.r},${pea.g},${pea.b}) 饱和=${peaSat}`);

    // 阳光亮度应显著高于草坪
    G.projectiles.length = 0; G.suns.length = 0;
    G.plants.length = 0; G.grid = Array.from({ length: 5 }, () => Array(9).fill(null));
    G.suns.push(new Sun(300, 300, 300, 'plant'));
    R.draw(G);
    const sunLum = lum(at(300, 300));
    check('阳光明显比草坪亮', sunLum - bgLum > 40,
          `阳光=${sunLum.toFixed(0)} 草坪=${bgLum.toFixed(0)}`);

    // --- 自动拾取功能（真实 UI） ---
    const autoBtnEl = document.getElementById('btn-auto');
    check('自动拾取按钮存在', !!autoBtnEl);
    check('默认关闭', G.autoCollect === false);
    autoBtnEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    check('点击后开启', G.autoCollect === true);
    check('按钮高亮', autoBtnEl.classList.contains('active'));
    // 真实跑一段时间，验证阳光被自动收走
    G.suns.length = 0;
    G.sun = 0;
    for (let i = 0; i < 5; i++) {
      const s = new Sun(200 + i * 40, 350, 350, 'plant');
      s.age = 1;
      G.suns.push(s);
    }
    for (let i = 0; i < 60; i++) G.update(1 / 60, performance.now() + i * 16);
    check('自动拾取真实生效', G.sun >= 125, '阳光=' + G.sun);
    autoBtnEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    check('再次点击关闭', G.autoCollect === false);

    // --- 小推车绘制验证 ---
    R.draw(G);
    const mPx = at(_CFG.HUD_W - 26, _CFG.TOP_OFFSET + _CFG.CELL_H / 2 + 20);
    check('小推车位置有内容绘制', mPx.a > 0, `rgb(${mPx.r},${mPx.g},${mPx.b})`);

    // --- 进度条 / UI ---
    window.__game.waveIndex = 2;
    G.syncUI();
    const bar = document.getElementById('progress-bar');
    check('进度条随波次更新', parseFloat(bar.style.width) > 0, 'width=' + bar.style.width);
    const flags = document.getElementById('progress-flags').children;
    check('进度旗标数量匹配波次', flags.length === LEVELS[0].waves.length, flags.length + ' vs ' + LEVELS[0].waves.length);
    const doneFlags = [...flags].filter(f => f.classList.contains('done')).length;
    check('已完成波次旗标被标记', doneFlags === 2, 'done=' + doneFlags);

    // --- 种子卡冷却遮罩 ---
    G.cooldowns.sunflower = performance.now() + 5000;
    G.syncUI();
    const sc = document.querySelector('.seed[data-plant="sunflower"]');
    check('冷却中种子卡有 disabled 样式', sc && sc.classList.contains('disabled'));
    const mask = sc && sc.querySelector('.cd-mask');
    check('冷却遮罩有 scaleY 值', mask && /scaleY\(/.test(mask.style.transform), mask && mask.style.transform);

    // --- 响应式：缩小窗口后画布自适应 ---
    const w0 = cv.style.width;
    R.resize();
    check('画布尺寸合法', parseFloat(cv.style.width) > 0, cv.style.width + 'x' + cv.style.height);

    // --- 结算流程 ---
    G.stats = { killed: 3, planted: 5, sunCollected: 100, score: 200, waves: 2, leaked: 0 };
    G.finish(true);
    check('结算面板弹出', !document.getElementById('result-overlay').classList.contains('hidden'));
    check('结算标题正确', document.getElementById('result-title').textContent.includes('通过'));
    check('结算按钮已生成', document.getElementById('result-actions').children.length >= 2);
  } catch (e) {
    out.push('FAIL | 探针异常 | ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]);
  }

  document.body.setAttribute('data-probe', out.join('\n'));
  document.title = 'DONE';
}, 500);
