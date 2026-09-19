/* 真实浏览器中的画面验证：像素级断言（原版画风版） */
window.__err = [];
window.addEventListener('error', e => window.__err.push('ERROR: ' + e.message + ' @' + (e.filename || '') + ':' + e.lineno));
window.addEventListener('unhandledrejection', e => window.__err.push('REJECT: ' + e.reason));

setTimeout(() => {
  const out = [];
  let G, R, cv, ctx, s, dpr;
  try {
    G = window.__game;
    R = Renderer;
    cv = document.getElementById('game');
    ctx = cv.getContext('2d');
    s = R.scale;
    dpr = cv.width / (CFG.W * s);
  } catch (e) {
    document.body.setAttribute('data-probe', 'FAIL | 探针初始化异常 | ' + e.message);
    document.title = 'DONE';
    return;
  }

  const check = (n, ok, d) => out.push((ok ? 'PASS' : 'FAIL') + ' | ' + n + (d ? ' | ' + d : ''));
  const px = (x, y) => { const d = ctx.getImageData(Math.round(x * s * dpr), Math.round(y * s * dpr), 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] }; };
  const at = (lx, ly) => px(lx, ly);
  const lum = c => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const dist = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);

  try {
    check('无 JS 错误', window.__err.length === 0, window.__err.join(';'));

    // ---- 走真实 UI 路径 ----
    const card = document.querySelector('.level-card');
    check('关卡卡片存在', !!card);
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    check('点击关卡后进入游戏', G.state === 'playing', 'state=' + G.state);
    check('开场动画已触发', G.introUntil > performance.now());

    // ---- 布局尺寸 ----
    check('画布尺寸符合新布局', Math.abs(CFG.W - 972) < 1 && Math.abs(CFG.H - 660) < 1, CFG.W + 'x' + CFG.H);
    check('种子卡布局生成', seedRects(G.level.plants).length === CFG.COLS - 5);

    // ---- 布防 ----
    G.sun = 9999;
    const put = (id, c, r) => { G.selected = id; G.cooldowns = {}; G.tryPlant(c, r); };
    for (let r = 0; r < 5; r++) {
      put('sunflower', 0, r); put('sunflower', 1, r);
      put('peashooter', 2, r); put('snowpea', 3, r); put('wallnut', 7, r);
    }
    G.plants.forEach(pp => { pp.scale = 1; });
    check('植物已种植 (25株)', G.plants.length === 25, '实际=' + G.plants.length);

    G.spawnWave('basic*1,cone*1,bucket*1,football*1,gargantuar*1');
    G.zombies.forEach((z, i) => { z.x = 380 + i * 78; });
    G.introUntil = 0;
    for (let i = 0; i < 90; i++) G.update(1 / 60, performance.now() + i * 16);
    R.draw(G);

    check('僵尸已生成 (5种)', G.zombies.length === 5, '实际=' + G.zombies.length);

    // ---- 草坪 ----
    const g00 = at(CFG.HUD_W + 20, CFG.TOP_OFFSET + 20);
    const g01 = at(CFG.HUD_W + CFG.CELL_W + 20, CFG.TOP_OFFSET + 20);
    check('草坪为绿色', g00.g > g00.r && g00.g > 120, `rgb(${g00.r},${g00.g},${g00.b})`);
    check('棋盘格交替', Math.abs(g00.g - g01.g) + Math.abs(g00.r - g01.r) > 5, `${g00.g} vs ${g01.g}`);

    // ---- 左侧房屋 ----
    const house = at(40, 400);
    check('左侧房屋为暖色砖墙', house.r > house.g && house.g > house.b, `rgb(${house.r},${house.g},${house.b})`);

    // ---- 顶部木质种子槽 ----
    const panel = at(CFG.W / 2, 46);
    check('顶部木质面板已绘制', panel.r > 100 && panel.r > panel.b + 40, `rgb(${panel.r},${panel.g},${panel.b})`);

    // 种子卡（卡面米黄色）
    const sr = seedRects(G.level.plants)[0];
    const cardPx = at(sr.x + sr.w / 2, sr.y + 6);
    check('种子卡已绘制', cardPx.r > 180 && cardPx.g > 170, `rgb(${cardPx.r},${cardPx.g},${cardPx.b})`);

    // 阳光计数器区域有太阳
    const sunBoxPx = at(UI.sunBox.x + UI.sunBox.w / 2, UI.sunBox.y + 26);
    check('阳光计数器有太阳图标', sunBoxPx.r > 200 && sunBoxPx.g > 160, `rgb(${sunBoxPx.r},${sunBoxPx.g},${sunBoxPx.b})`);

    // ---- 底部进度条 ----
    const pb = UI.progress;
    const barPx = at(pb.x + 10, pb.y + pb.h / 2);
    check('底部进度条已绘制', barPx.a > 0 && (barPx.g > 90 || barPx.r > 20), `rgb(${barPx.r},${barPx.g},${barPx.b})`);

    // ---- 僵尸对比度 ----
    const clearBoard = () => {
      G.plants.length = 0; G.zombies.length = 0; G.suns.length = 0; G.projectiles.length = 0;
      G.grid = Array.from({ length: 5 }, () => Array(9).fill(null));
    };
    clearBoard();
    R.draw(G);
    const bg = at(CFG.HUD_W + CFG.CELL_W * 4.5, CFG.TOP_OFFSET + CFG.CELL_H * 4.5);
    const bgL = lum(bg);

    G.spawnWave('basic*3');
    G.zombies.forEach(z => { z.x = 500; z.y = Grid.cellCY(2); });
    R.draw(G);
    let zl = 0, n = 0;
    for (let dx = -20; dx <= 20; dx += 5) {
      for (let dy = -46; dy <= 24; dy += 10) {
        zl += lum(at(500 + dx, Grid.cellCY(2) + 34 + dy)); n++;
      }
    }
    zl /= n;
    check('僵尸与草坪有明显亮度差', Math.abs(zl - bgL) > 20,
      `僵尸=${zl.toFixed(0)} 草坪=${bgL.toFixed(0)} 差=${Math.abs(zl - bgL).toFixed(0)}`);

    // 僵尸像素非纯草坪色（说明真的画上了东西）
    let drawn = 0;
    for (let dx = -18; dx <= 18; dx += 6) {
      for (let dy = -40; dy <= 20; dy += 8) {
        if (dist(at(500 + dx, Grid.cellCY(2) + 34 + dy), bg) > 28) drawn++;
      }
    }
    check('僵尸区域有大量非背景像素', drawn > 15, 'drawn=' + drawn + '/40');

    // ---- 各类僵尸都能画出来 ----
    const variants = Object.keys(ZOMBIES);
    let okVariants = 0;
    for (const v of variants) {
      clearBoard();
      G.spawnWave(v + '*1');
      if (!G.zombies.length) continue;
      G.zombies.forEach(z => { z.x = 500; z.y = Grid.cellCY(2); });
      R.draw(G);
      let cnt = 0;
      for (let dx = -24; dx <= 24; dx += 6) {
        for (let dy = -50; dy <= 24; dy += 8) {
          if (dist(at(500 + dx, Grid.cellCY(2) + 34 + dy), bg) > 28) cnt++;
        }
      }
      if (cnt > 8) okVariants++;
    }
    check('全部僵尸变体都能绘制', okVariants === variants.length, `${okVariants}/${variants.length}`);

    // ---- 植物对比度 ----
    clearBoard();
    G.sun = 9999;
    const plantIds = ['sunflower','peashooter','snowpea','repeater','wallnut','cherrybomb','jalapeno','potatomine','chomper'];
    let okPlants = 0; const plantDetail = [];
    for (const pid of plantIds) {
      clearBoard();
      G.selected = pid; G.cooldowns = {}; G.tryPlant(4, 2);
      G.plants.forEach(pp => { pp.scale = 1; });   // 跳过生长动画
      R.draw(G);
      let cnt = 0;
      const cx = Grid.cellCX(4), cy = Grid.cellCY(2);
      for (let dx = -30; dx <= 30; dx += 6) {
        for (let dy = -42; dy <= 34; dy += 8) {
          if (dist(at(cx + dx, cy + dy), bg) > 30) cnt++;
        }
      }
      if (cnt > 12) okPlants++; else plantDetail.push(pid + ':' + cnt);
    }
    check('全部植物都能清晰绘制', okPlants === plantIds.length,
      okPlants + '/' + plantIds.length + (plantDetail.length ? ' 弱:' + plantDetail.join(',') : ''));

    // ---- 豌豆 ----
    // 注意：画布缩放取整会使单像素采样落在小球的不同部位，
    // 因此改为区域内取最大色差，结果才稳定。
    const maxDistIn = (cx, cy, rad, step) => {
      let best = 0, bp = null;
      for (let dx = -rad; dx <= rad; dx += step) {
        for (let dy = -rad; dy <= rad; dy += step) {
          const c = at(cx + dx, cy + dy);
          const d = dist(c, bg);
          if (d > best) { best = d; bp = c; }
        }
      }
      return { d: best, c: bp };
    };

    clearBoard();
    G.sun = 9999;
    G.selected = 'peashooter'; G.cooldowns = {}; G.tryPlant(2, 2);
    const shooter = G.plants[G.plants.length - 1];
    G.spawnProjectile(shooter, 560, Grid.cellCY(2) - 14);
    R.draw(G);
    const peaBest = maxDistIn(560, Grid.cellCY(2) - 14, 8, 2);
    check('豌豆有鲜明色彩', peaBest.d > 50,
      `最强像素 rgb(${peaBest.c.r},${peaBest.c.g},${peaBest.c.b}) 色差=${peaBest.d.toFixed(0)}`);

    // ---- 阳光 ----
    clearBoard();
    G.suns.push(new Sun(300, 300, 300, 'plant'));
    R.draw(G);
    const sunBest = maxDistIn(300, 300, 6, 2);
    const sunL = lum(sunBest.c);
    check('阳光明显比草坪亮', sunL - bgL > 40, `${sunL.toFixed(0)} vs ${bgL.toFixed(0)}`);

    // ---- 小推车 ----
    clearBoard();
    R.draw(G);
    const mPx = at(CFG.HUD_W - 26, Grid.cellCY(0) + 22);
    check('小推车已绘制', dist(mPx, bg) > 20, `rgb(${mPx.r},${mPx.g},${mPx.b})`);

    // ---- 画布内 HUD 交互 ----
    clearBoard();
    G.sun = 500;
    G.selected = null; G.shovelMode = false;
    const rects = seedRects(G.level.plants);
    const r0 = rects[0];
    const toClient = (lx, ly) => {
      const rect = cv.getBoundingClientRect();
      return { clientX: rect.left + lx * s, clientY: rect.top + ly * s };
    };
    const clickAt = (lx, ly) => {
      const p = toClient(lx, ly);
      cv.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, ...p }));
    };

    clickAt(r0.x + r0.w / 2, r0.y + r0.h / 2);
    check('点击画布种子卡可选中', G.selected === r0.id, 'selected=' + G.selected);

    G.selected = null;
    const sh = shovelRect(G.level.plants);
    clickAt(sh.x + sh.w / 2, sh.y + sh.h / 2);
    check('点击画布铲子可激活', G.shovelMode === true);
    G.shovelMode = false;

    // 种植
    G.selected = 'sunflower';
    G.cooldowns = {};
    clickAt(Grid.cellCX(4), Grid.cellCY(2));
    check('点击草坪可种植', !!G.grid[2][4], 'plants=' + G.plants.length);

    // 暂停
    const pr = pauseRect();
    clickAt(pr.x + pr.w / 2, pr.y + pr.h / 2);
    check('点击画布暂停按钮生效', G.state === 'paused', 'state=' + G.state);
    clickAt(pr.x + pr.w / 2, pr.y + pr.h / 2);
    check('再次点击恢复', G.state === 'playing', 'state=' + G.state);

    // ---- 自动拾取 ----
    check('自动拾取按钮存在', !!document.getElementById('btn-auto'));
    const autoBtnEl = document.getElementById('btn-auto');
    autoBtnEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    check('点击后开启自动拾取', G.autoCollect === true);
    clearBoard();
    G.sun = 0;
    for (let i = 0; i < 5; i++) { const sn = new Sun(200 + i * 40, 350, 350, 'plant'); sn.age = 1; G.suns.push(sn); }
    for (let i = 0; i < 60; i++) G.update(1 / 60, performance.now() + i * 16);
    check('自动拾取真实生效', G.sun >= 125, '阳光=' + G.sun);
    autoBtnEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    check('再次点击关闭', G.autoCollect === false);

    // ---- 关卡切换 ----
    check('共 5 个关卡', LEVELS.length === 5);
    check('关卡编号为原版风格', LEVELS[0].code === '1-1' && LEVELS[1].code === '1-2');
  } catch (e) {
    out.push('FAIL | 探针异常 | ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]);
  }

  document.body.setAttribute('data-probe', out.join('\n'));
  document.title = 'DONE';
}, 600);
