/* ===========================================================
   renderer.js — Canvas 绘制层（原版风格）
   =========================================================== */

const Renderer = (() => {
  let canvas, ctx;
  let dpr = 1;

  function init(cv) {
    canvas = cv;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const stage = document.getElementById('stage');
    const availW = Math.max(320, stage.clientWidth - 16);
    const availH = Math.max(240, stage.clientHeight - 16);
    const scale = Math.min(availW / CFG.W, availH / CFG.H, 1);

    const cssW = Math.floor(CFG.W * scale);
    const cssH = Math.floor(CFG.H * scale);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr * scale, dpr * scale);
    Renderer.scale = scale;
  }

  /* ---------------- 背景：天空 / 草坪 / 房屋 ---------------- */
  function drawBackground(game) {
    const { W, H, HUD_W, TOP_OFFSET, COLS, ROWS, CELL_W, CELL_H } = CFG;
    const lawnY = TOP_OFFSET;
    const lawnH = ROWS * CELL_H;

    // 天空
    const sky = ctx.createLinearGradient(0, 0, 0, lawnY + 40);
    sky.addColorStop(0, '#8fd0f0');
    sky.addColorStop(.55, '#bfe6b8');
    sky.addColorStop(1, '#9ecb7c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, lawnY + 40);

    // 远景灌木
    ctx.save();
    ctx.globalAlpha = .5;
    ctx.fillStyle = '#6fae4e';
    for (let i = 0; i < 14; i++) {
      const x = i * 76 + 20, r = 26 + (i % 3) * 9;
      ctx.beginPath(); ctx.arc(x, lawnY + 4, r, Math.PI, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // 草坪棋盘格
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = HUD_W + c * CELL_W, y = lawnY + r * CELL_H;
        ctx.fillStyle = (r + c) % 2 === 0 ? '#8fc63d' : '#7cb52f';
        ctx.fillRect(x, y, CELL_W, CELL_H);
      }
    }
    // 右侧延伸（僵尸出场区）
    for (let r = 0; r < ROWS; r++) {
      ctx.fillStyle = r % 2 === 0 ? '#7cb52f' : '#8fc63d';
      ctx.fillRect(HUD_W + COLS * CELL_W, lawnY + r * CELL_H, W - (HUD_W + COLS * CELL_W), CELL_H);
    }
    // 草纹理
    ctx.save();
    ctx.globalAlpha = .07;
    ctx.strokeStyle = '#1b3a06'; ctx.lineWidth = 1;
    for (let r = 0; r <= ROWS; r++) {
      const y = lawnY + r * CELL_H;
      ctx.beginPath(); ctx.moveTo(HUD_W, y + .5); ctx.lineTo(W, y + .5); ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      const x = HUD_W + c * CELL_W;
      ctx.beginPath(); ctx.moveTo(x + .5, lawnY); ctx.lineTo(x + .5, lawnY + lawnH); ctx.stroke();
    }
    ctx.restore();

    // 左侧房屋
    ctx.save();
    const hg = ctx.createLinearGradient(0, 0, HUD_W, 0);
    hg.addColorStop(0, '#c9b18c');
    hg.addColorStop(.75, '#a58a63');
    hg.addColorStop(1, '#8a7050');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, HUD_W, H);
    // 砖纹
    ctx.strokeStyle = 'rgba(90,60,30,.28)'; ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(HUD_W, y + .5); ctx.stroke();
      const off = (Math.floor(y / 20) % 2) * 22;
      for (let x = off; x < HUD_W; x += 44) {
        ctx.beginPath(); ctx.moveTo(x + .5, y); ctx.lineTo(x + .5, y + 20); ctx.stroke();
      }
    }
    // 屋檐
    ctx.fillStyle = '#7a4a2a';
    ctx.fillRect(0, 0, HUD_W, 14);
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.fillRect(0, 14, HUD_W, 4);
    // 窗
    const wy = lawnY + 40;
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(20, wy, 60, 56);
    ctx.fillStyle = '#7ec8e3';
    ctx.fillRect(25, wy + 5, 50, 46);
    ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(50, wy + 5); ctx.lineTo(50, wy + 51); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(25, wy + 28); ctx.lineTo(75, wy + 28); ctx.stroke();
    // 门
    const dy = lawnY + 220;
    ctx.fillStyle = '#4e342e';
    ctx.beginPath();
    ctx.moveTo(24, dy + 84); ctx.lineTo(24, dy + 26);
    ctx.quadraticCurveTo(52, dy - 6, 80, dy + 26);
    ctx.lineTo(80, dy + 84); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2e1a10'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath(); ctx.arc(70, dy + 56, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 右侧道路
    ctx.save();
    const rw = W - (HUD_W + COLS * CELL_W);
    const rg = ctx.createLinearGradient(HUD_W + COLS * CELL_W, 0, W, 0);
    rg.addColorStop(0, 'rgba(90,70,40,.35)');
    rg.addColorStop(1, 'rgba(60,45,25,.75)');
    ctx.fillStyle = rg;
    ctx.fillRect(HUD_W + COLS * CELL_W, lawnY, rw, lawnH);
    ctx.restore();

    // 底部泥土
    ctx.fillStyle = '#4a3318';
    ctx.fillRect(0, lawnY + lawnH, W, H - (lawnY + lawnH));

    // 浓雾
    if (game && game.level && game.level.fog) {
      ctx.save();
      const f = ctx.createLinearGradient(HUD_W, 0, W, 0);
      f.addColorStop(0, `rgba(205,215,225,${game.level.fog * .4})`);
      f.addColorStop(.45, `rgba(205,215,225,${game.level.fog})`);
      f.addColorStop(1, `rgba(205,215,225,${game.level.fog * .75})`);
      ctx.fillStyle = f;
      ctx.fillRect(HUD_W, lawnY, W - HUD_W, lawnH);
      ctx.restore();
    }
  }

  /* ---------------- 悬停预览 ---------------- */
  function drawHover(game) {
    if (!game.hover) return;
    const { col, row } = game.hover;
    const x = Grid.colX(col), y = Grid.rowY(row);
    const occupied = game.grid[row][col];

    let ok = true;
    if (game.shovelMode) ok = !!occupied;
    else if (!game.selected) return;
    else ok = !occupied && game.sun >= PLANTS[game.selected].cost;

    ctx.save();
    ctx.globalAlpha = .32;
    ctx.fillStyle = ok ? '#ffffff' : '#ff5252';
    ctx.fillRect(x, y, CFG.CELL_W, CFG.CELL_H);
    ctx.globalAlpha = .95;
    ctx.strokeStyle = ok ? '#ffffff' : '#ff5252';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 2, y + 2, CFG.CELL_W - 4, CFG.CELL_H - 4);

    if (ok && game.selected && !game.shovelMode) {
      ctx.globalAlpha = .6;
      ctx.save();
      ctx.translate(x + CFG.CELL_W / 2, y + CFG.CELL_H / 2 + 14);
      Sprites.plant(ctx, game.selected, performance.now() / 1000, {});
      ctx.restore();
    }
    ctx.restore();
  }

  /* ---------------- 植物 ---------------- */
  function drawPlants(game) {
    const t = performance.now() / 1000;
    for (const p of game.plants) {
      const s = easeOutBack(p.scale);
      const bob = Math.sin(t * 2.4 + p.bob) * (p.isProducer ? 1.6 : .9);

      ctx.save();
      ctx.translate(p.x, p.y + 30 + bob);
      ctx.scale(s, s);

      // 地面阴影
      ctx.save();
      ctx.globalAlpha = .26;
      ctx.fillStyle = '#1b3a06';
      ctx.beginPath();
      ctx.ellipse(0, 4, 26, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 受伤闪白
      if (p.hurtFlash > 0) {
        ctx.filter = `brightness(${1 + p.hurtFlash * .9}) saturate(${1 - p.hurtFlash * .3})`;
      }

      const o = { seed: p.bob, damage: p.isBlocker ? 1 - p.hp / p.maxHp : 0 };
      if (p.isMine) { o.armed = p.armed; o.armRatio = 1 - Math.max(0, p.armedAt - performance.now()) / (p.def.armTime || 1); }
      if (p.isChomper) o.chewing = p.chewingUntil > performance.now();
      if (p.isShooter) {
        const since = performance.now() - p.lastShot;
        o.recoil = since < 140 ? 1 - since / 140 : 0;
      }
      if (p.isInstant) {
        ctx.globalAlpha = .88 + Math.sin(t * 14) * .12;
      }

      Sprites.plant(ctx, p.defId, t, o);
      ctx.filter = 'none';

      // 血条
      if (p.hp < p.maxHp && !p.isInstant) {
        const w = 44, h = 6;
        ctx.fillStyle = 'rgba(0,0,0,.62)';
        ctx.fillRect(-w / 2 - 1, -50, w + 2, h + 2);
        const ratio = Math.max(0, p.hp / p.maxHp);
        ctx.fillStyle = ratio > .5 ? '#66bb6a' : ratio > .25 ? '#ffca28' : '#ef5350';
        ctx.fillRect(-w / 2, -49, w * ratio, h);
      }
      ctx.restore();
    }
  }

  /* ---------------- 僵尸 ---------------- */
  function drawZombies(game) {
    const t = performance.now() / 1000;
    const list = [...game.zombies].sort((a, b) => a.y - b.y);
    for (const z of list) {
      ctx.save();
      ctx.translate(z.x, z.y + 34);

      // 地面阴影
      ctx.save();
      ctx.globalAlpha = .28;
      ctx.fillStyle = '#1b3a06';
      ctx.beginPath();
      ctx.ellipse(0, 2, 24, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 减速染色
      if (z.frozen > .25 && !z.dead) {
        ctx.filter = `brightness(${1 + z.frozen * .3}) saturate(${1 - z.frozen * .5})`;
      }
      if (z.hurtFlash > 0) {
        ctx.filter = `brightness(${1 + z.hurtFlash * 1.3}) saturate(.5)`;
      }

      const o = {
        walk: z.walkPhase,
        hurt: z.hurtFlash,
        armLost: z.armLost,
        dying: z.dying,
        scale: z.defId === 'gargantuar' ? 1.45 : 1,
      };

      if (z.dead) ZombieArt.drawDying(ctx, z.defId, t, o);
      else ZombieArt.draw(ctx, z.defId, t, o);
      ctx.filter = 'none';

      // 血条
      if (!z.dead && z.hp < z.maxHp) {
        const w = 46, h = 6;
        const top = z.defId === 'gargantuar' ? -96 : -70;
        ctx.fillStyle = 'rgba(0,0,0,.7)';
        ctx.fillRect(-w / 2 - 1, top - 1, w + 2, h + 2);
        const ratio = Math.max(0, z.hp / z.maxHp);
        ctx.fillStyle = ratio > .5 ? '#ff5252' : ratio > .22 ? '#ff9800' : '#b71c1c';
        ctx.fillRect(-w / 2, top, w * ratio, h);
      }

      // 啃食提示
      if (z.attacking && !z.dead) {
        ctx.save();
        ctx.globalAlpha = .85 + Math.sin(t * 12) * .15;
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💢', 26, -34);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  /* ---------------- 子弹 ---------------- */
  function drawProjectiles(game) {
    for (const p of game.projectiles) {
      const isSnow = p.type === 'snow';
      // 拖尾
      p.trail.forEach(tr => {
        if (tr.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = tr.life * .4;
        ctx.fillStyle = isSnow ? '#b3e5fc' : '#8bc34a';
        ctx.beginPath(); ctx.arc(tr.x, tr.y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });

      ctx.save();
      ctx.translate(p.x, p.y);
      // 豌豆：亮黄绿球体 + 近黑描边，保证在绿草坪上醒目
      const r = 8.5;
      const g = ctx.createRadialGradient(-r * .4, -r * .4, 1, 0, 0, r);
      if (isSnow) {
        g.addColorStop(0, '#ffffff'); g.addColorStop(.45, '#9fe4f5'); g.addColorStop(1, '#3fa6c4');
      } else {
        g.addColorStop(0, '#f8ffd0'); g.addColorStop(.45, '#d4ec62'); g.addColorStop(1, '#8bc34a');
      }
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#16300a'; ctx.lineWidth = 2.8; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.95)';
      ctx.beginPath(); ctx.arc(-2.8, -2.8, 2.8, 0, Math.PI * 2); ctx.fill();
      if (isSnow) {
        ctx.strokeStyle = 'rgba(235,252,255,.9)'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(0, 0, r + 2.6, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* ---------------- 阳光 ---------------- */
  function drawSuns(game) {
    const t = performance.now() / 1000;
    for (const s of game.suns) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.globalAlpha = Math.min(1, s.life * 2.4);
      ctx.scale(.95 + Math.sin(t * 3 + s.phase) * .05, .95 + Math.sin(t * 3 + s.phase) * .05);
      Sprites.sun(ctx, t + s.phase, 19);
      if (s.life < .3) {
        ctx.strokeStyle = `rgba(255,70,70,${.9 - s.life * 3})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* ---------------- 小推车 ---------------- */
  function drawMowers(game) {
    const t = performance.now() / 1000;
    for (const m of game.mowers) {
      if (m.used && !m.active) continue;
      const y = Grid.cellCY(m.row) + 22;
      ctx.save();
      ctx.translate(m.x, y);
      ctx.save();
      ctx.globalAlpha = .26;
      ctx.fillStyle = '#1b3a06';
      ctx.beginPath(); ctx.ellipse(0, 8, 20, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (m.active) {
        ctx.save();
        ctx.globalAlpha = .5;
        ctx.fillStyle = '#d7ccc8';
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(-20 - i * 13, Math.random() * 8 - 4, 4 + Math.random() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      Sprites.mower(ctx, t, m.active);
      ctx.restore();
    }
  }

  /* ---------------- 粒子 / 飘字 ---------------- */
  function drawParticles(game) {
    for (const p of game.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * Math.max(.2, p.life), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const t of game.texts) {
      ctx.globalAlpha = Math.max(0, t.life);
      ctx.font = `bold ${t.size}px "PingFang SC","Microsoft YaHei",sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,.8)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- 爆炸 ---------------- */
  function drawExplosions(game) {
    const now = performance.now();
    for (const e of game.explosions) {
      const t = (now - e.start) / e.duration;
      if (t < 0 || t > 1) continue;
      ctx.save();
      ctx.globalAlpha = (1 - t) * .85;
      if (e.type === 'circle') {
        const r = e.radius * easeOutCubic(Math.min(1, t * 1.6));
        const g = ctx.createRadialGradient(e.x, e.y, r * .1, e.x, e.y, r);
        g.addColorStop(0, 'rgba(255,255,210,.95)');
        g.addColorStop(.35, 'rgba(255,170,40,.85)');
        g.addColorStop(.7, 'rgba(244,80,40,.5)');
        g.addColorStop(1, 'rgba(180,40,20,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.fill();
      } else if (e.type === 'lane') {
        const h = CFG.CELL_H * .95;
        const g = ctx.createLinearGradient(0, e.y - h / 2, 0, e.y + h / 2);
        g.addColorStop(0, 'rgba(255,193,7,0)');
        g.addColorStop(.35, `rgba(255,120,20,${(1 - t) * .9})`);
        g.addColorStop(.5, `rgba(255,235,120,${(1 - t)})`);
        g.addColorStop(.65, `rgba(255,120,20,${(1 - t) * .9})`);
        g.addColorStop(1, 'rgba(255,193,7,0)');
        ctx.fillStyle = g;
        ctx.fillRect(CFG.HUD_W, e.y - h / 2, CFG.W - CFG.HUD_W, h);
      }
      ctx.restore();
    }
  }

  /* ---------------- 波次预警 ---------------- */
  function drawWaveWarning(game) {
    if (!game.waveWarnUntil || performance.now() > game.waveWarnUntil) return;
    const left = game.waveWarnUntil - performance.now();
    const alpha = Math.min(1, left / 400) * Math.abs(Math.sin(performance.now() / 190)) * .9;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 42px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(0,0,0,.85)';
    ctx.strokeText('一大波僵尸正在接近！', CFG.W / 2, CFG.TOP_OFFSET + 110);
    ctx.fillStyle = '#ff5252';
    ctx.fillText('一大波僵尸正在接近！', CFG.W / 2, CFG.TOP_OFFSET + 110);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha * .5;
    ctx.strokeStyle = '#ff1744'; ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, CFG.W - 10, CFG.H - 10);
    ctx.restore();
  }

  /* ---------------- 关卡开场 ---------------- */
  function drawIntro(game) {
    const el = game.introUntil - performance.now();
    if (!game.introUntil || el <= 0) return;
    const total = game.introDuration || 2600;
    const k = 1 - el / total;
    let text = '', sub = '';
    if (k < .38) { text = game.level.code; sub = game.level.name; }
    else if (k < .7) { text = '准备…'; }
    else { text = '种植！'; }

    const a = Math.min(1, el / 300) * Math.min(1, k / .06);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(12,8,2,.55)';
    ctx.fillRect(0, CFG.TOP_OFFSET + 120, CFG.W, 130);
    ctx.textAlign = 'center';
    ctx.font = 'bold 52px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,.9)';
    ctx.strokeText(text, CFG.W / 2, CFG.TOP_OFFSET + 178);
    ctx.fillStyle = '#ffe082';
    ctx.fillText(text, CFG.W / 2, CFG.TOP_OFFSET + 178);
    if (sub) {
      ctx.font = 'bold 20px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.lineWidth = 5;
      ctx.strokeText(sub, CFG.W / 2, CFG.TOP_OFFSET + 214);
      ctx.fillStyle = '#fff8dc';
      ctx.fillText(sub, CFG.W / 2, CFG.TOP_OFFSET + 214);
    }
    ctx.restore();
  }

  /* ---------------- 主绘制 ---------------- */
  function draw(game) {
    const t = performance.now() / 1000;
    ctx.clearRect(0, 0, CFG.W, CFG.H);
    drawBackground(game);
    if (game.level && game.state !== 'menu') {
      // 震屏只作用于游戏世界，HUD 保持稳定
      const off = game.shakeOffset || { x: 0, y: 0 };
      ctx.save();
      if (off.x || off.y) ctx.translate(off.x, off.y);
      drawHover(game);
      drawExplosions(game);
      drawMowers(game);
      drawPlants(game);
      drawProjectiles(game);
      drawZombies(game);
      drawSuns(game);
      drawParticles(game);
      ctx.restore();

      drawWaveWarning(game);
      drawIntro(game);
      Hud.draw(ctx, game, t);
    }
  }

  /* ---------------- 工具 ---------------- */
  function easeOutBack(x) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }
  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

  return { init, resize, draw, get ctx() { return ctx; }, get canvas() { return canvas; } };
})();
