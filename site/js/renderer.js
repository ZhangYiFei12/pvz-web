/* ===========================================================
   renderer.js — Canvas 绘制层
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
    Renderer.cssW = cssW;
    Renderer.cssH = cssH;
  }

  /* ---------------- 草坪 ---------------- */
  function drawLawn(game) {
    const { W, H, HUD_W, TOP_OFFSET, COLS, ROWS, CELL_W, CELL_H } = CFG;

    // 天空 / 背景
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, '#6fb3e0');
    skyGrad.addColorStop(0.16, '#8fc48a');
    skyGrad.addColorStop(1, '#5d3a1e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // 格子草坪（略降亮度与饱和度，让单位更突出）
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = HUD_W + c * CELL_W;
        const y = TOP_OFFSET + r * CELL_H;
        ctx.fillStyle = (r + c) % 2 === 0 ? '#8cbb3c' : '#7aab30';
        ctx.fillRect(x, y, CELL_W, CELL_H);

        // 草纹理
        ctx.strokeStyle = 'rgba(255,255,255,.05)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + .5, y + .5, CELL_W - 1, CELL_H - 1);
      }
    }

    // 草坪整体轻微阴影
    ctx.fillStyle = 'rgba(0,0,0,.06)';
    ctx.fillRect(HUD_W, TOP_OFFSET + ROWS * CELL_H - 6, COLS * CELL_W, 6);

    // 左侧房屋区
    const houseGrad = ctx.createLinearGradient(0, 0, HUD_W, 0);
    houseGrad.addColorStop(0, '#5d4037');
    houseGrad.addColorStop(1, '#3e2723');
    ctx.fillStyle = houseGrad;
    ctx.fillRect(0, 0, HUD_W, H);

    // 房屋砖纹
    ctx.strokeStyle = 'rgba(0,0,0,.18)';
    ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 18) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(HUD_W, y); ctx.stroke();
      const off = (Math.floor(y / 18) % 2) * 20;
      for (let x = off; x < HUD_W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 18); ctx.stroke();
      }
    }

    // 房屋门
    ctx.fillStyle = '#2e1a10';
    ctx.fillRect(HUD_W - 30, H * 0.38, 30, 78);
    ctx.fillStyle = '#8d6e63';
    ctx.beginPath();
    ctx.arc(HUD_W - 8, H * 0.38 + 40, 3, 0, Math.PI * 2);
    ctx.fill();

    // 右侧“墓碑/道路”装饰
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    ctx.fillRect(W - 6, TOP_OFFSET, 6, ROWS * CELL_H);

    // 浓雾效果
    if (game && game.level && game.level.fog) {
      ctx.fillStyle = `rgba(200, 210, 220, ${game.level.fog})`;
      ctx.fillRect(HUD_W, TOP_OFFSET, COLS * CELL_W, ROWS * CELL_H);
    }
  }

  /* ---------------- 悬停 / 预览格子 ---------------- */
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
    ctx.globalAlpha = .45;
    ctx.fillStyle = ok ? '#ffffff' : '#ff5252';
    ctx.fillRect(x, y, CFG.CELL_W, CFG.CELL_H);
    ctx.globalAlpha = .9;
    ctx.strokeStyle = ok ? '#ffffff' : '#ff5252';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, CFG.CELL_W - 3, CFG.CELL_H - 3);

    // 幽灵预览
    if (ok && game.selected && !game.shovelMode) {
      ctx.globalAlpha = .55;
      ctx.font = '52px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(PLANTS[game.selected].emoji, x + CFG.CELL_W / 2, y + CFG.CELL_H / 2);
    }
    ctx.restore();
  }

  /* ---------------- 视觉辅助：让单位在草坪上清晰可见 ---------------- */

  /**
   * 统一的 Emoji 绘制：深色光晕 + 可选底板。
   * 纯色草坪（尤其浓雾关）上，没有深色勾边的 Emoji 会“发淡”，
   * 这里用 shadowBlur 打出深色光晕，并可选在后方垫一块暗色底板。
   */
  function drawEmoji(text, size, opts = {}) {
    const {
      plate = 0,                       // >0 时在后方画暗色椭圆底板的宽度
      plateH = 0,
      plateAlpha = .26,
      halo = 5,                        // 深色光晕强度
      alpha = 1,
      y = 0,
    } = opts;

    ctx.save();
    if (alpha !== 1) ctx.globalAlpha *= alpha;

    // 1) 暗色底板：保证与草坪底色分离
    if (plate > 0) {
      ctx.save();
      ctx.globalAlpha *= plateAlpha;
      const g = ctx.createRadialGradient(0, y, 2, 0, y, plate / 2);
      g.addColorStop(0, 'rgba(10,16,4,.95)');
      g.addColorStop(.65, 'rgba(10,16,4,.55)');
      g.addColorStop(1, 'rgba(10,16,4,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, y, plate / 2, (plateH || plate * .78) / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2) Emoji 本体：深色光晕 + 投影
    ctx.font = `${size}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (halo > 0) {
      ctx.shadowColor = 'rgba(8,14,2,.95)';
      ctx.shadowBlur = halo;
      ctx.shadowOffsetY = 2;
    }
    ctx.fillText(text, 0, y);

    // 3) 再叠一层更紧的光晕，强化边缘
    if (halo > 0) {
      ctx.shadowBlur = halo * .45;
      ctx.shadowOffsetY = 0;
      ctx.fillText(text, 0, y);
    }
    ctx.restore();
  }

  /* ---------------- 植物 ---------------- */
  function drawPlants(game) {
    for (const p of game.plants) drawPlant(p);
  }

  function drawPlant(p) {
    const s = easeOutBack(p.scale);
    const bobY = Math.sin(performance.now() / 620 + p.bob) * (p.isProducer ? 2.2 : 1.1);

    ctx.save();
    ctx.translate(p.x, p.y + bobY);
    ctx.scale(s, s);

    // 影子
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.beginPath();
    ctx.ellipse(0, 30, 26, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // 血条（受伤时）
    if (p.hp < p.maxHp && !p.isInstant) {
      const w = 46, h = 5;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(-w / 2, -44, w, h);
      const ratio = Math.max(0, p.hp / p.maxHp);
      ctx.fillStyle = ratio > .5 ? '#66bb6a' : ratio > .25 ? '#ffca28' : '#ef5350';
      ctx.fillRect(-w / 2, -44, w * ratio, h);
    }

    ctx.globalAlpha = p.chewingUntil > performance.now() ? .82 : 1;
    const hurt = p.hurtFlash > 0;
    const H = hurt ? 6 + p.hurtFlash * 6 : 5;

    if (p.isMine && !p.armed) {
      // 土豆雷未激活：半埋的土豆 + 倒计时环
      drawEmoji('🥔', 54, { halo: H, alpha: .85, y: 8 });
      const total = p.def.armTime;
      const left = Math.max(0, p.armedAt - performance.now());
      const ratio = 1 - left / total;
      ctx.save();
      ctx.globalAlpha *= 1;
      ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#fff8d6'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2); ctx.stroke();
      ctx.restore();
    } else if (p.isMine) {
      // 已武装：加一圈警示光环
      ctx.save();
      ctx.globalAlpha *= .45 + Math.sin(performance.now() / 260) * .18;
      ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 2, 28, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      drawEmoji('🥔', 54, { halo: H });
    } else if (p.isChomper) {
      const chewing = p.chewingUntil > performance.now();
      if (chewing) {
        ctx.save();
        ctx.globalAlpha *= .5;
        ctx.strokeStyle = '#ffab91'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      drawEmoji('🪴', chewing ? 46 : 54, { halo: H });
    } else if (p.isInstant) {
      // 一次性植物：脉动光环，强调“用完即没”
      ctx.save();
      ctx.globalAlpha *= .5 + Math.sin(performance.now() / 110) * .3;
      ctx.strokeStyle = '#ff7043'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(0, 0, 29, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      drawEmoji(p.def.emoji, 54, { halo: H + 2 });
    } else {
      // 普通植物：暗色底板 + 深色光晕
      drawEmoji(p.def.emoji, 54, { plate: 62, plateH: 58, plateAlpha: .28, halo: H });
    }

    ctx.restore();
  }

  /* ---------------- 僵尸 ---------------- */
  function drawZombies(game) {
    // 按行排序保证遮挡正确
    const list = [...game.zombies].sort((a, b) => a.y - b.y);
    for (const z of list) drawZombie(z);
  }

  function drawZombie(z) {
    ctx.save();
    ctx.translate(z.x, z.y);

    if (z.dead) {
      // 死亡：下沉 + 淡出 + 倾倒
      const t = z.dying;
      ctx.globalAlpha = 1 - t;
      ctx.rotate(t * 0.9);
      ctx.translate(0, t * 18);
      ctx.scale(1, 1 - t * .3);
    } else {
      // 行走上下起伏
      const bob = Math.sin(z.walkPhase) * 3;
      ctx.translate(0, bob);
      // 轻微晃动
      ctx.rotate(Math.sin(z.walkPhase / 2) * 0.045);
    }

    // 影子
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath();
    ctx.ellipse(0, 32, 24, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // 减速光晕
    if (z.frozen > 0 && !z.dead) {
      ctx.save();
      ctx.globalAlpha = z.frozen * .45;
      ctx.fillStyle = '#4fc3f7';
      ctx.beginPath();
      ctx.ellipse(0, -6, 30, 44, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 受伤闪白 / 减速染色
    if (z.hurtFlash > 0) {
      ctx.filter = `brightness(${1 + z.hurtFlash * 1.6}) saturate(.45)`;
    } else if (z.frozen > .35 && !z.dead) {
      ctx.filter = `brightness(${1 + z.frozen * .35}) saturate(${1 - z.frozen * .55})`;
    }

    // 僵尸主体：红棕色底板 + 强深色光晕，与绿草坪强烈区分
    const halo = z.dead ? 3 : (z.attacking ? 10 : 8);
    drawEmoji(z.def.emoji, 52, {
      plate: z.dead ? 0 : 66,
      plateH: z.dead ? 0 : 68,
      plateAlpha: .34,
      halo,
    });
    ctx.filter = 'none';

    // 护具（未被打掉时）—— 同样加光晕以保证可读
    if (z.def.helmet && !z.armLost && !z.dead) {
      drawEmoji(z.def.helmet, 24, { halo: 4, y: -27 });
    }

    // 撑杆僵尸的背心
    if (z.def.canVault && !z.hasVaulted && !z.dead) {
      drawEmoji('🎽', 30, { halo: 3, y: 4 });
    }

    // 血条
    if (!z.dead && z.hp < z.maxHp) {
      const w = 48, h = 6;
      ctx.fillStyle = 'rgba(0,0,0,.7)';
      ctx.fillRect(-w / 2 - 1, -41, w + 2, h + 2);
      const ratio = Math.max(0, z.hp / z.maxHp);
      ctx.fillStyle = ratio > .5 ? '#ff5252' : ratio > .22 ? '#ff9800' : '#b71c1c';
      ctx.fillRect(-w / 2, -40, w * ratio, h);
    }

    // 攻击提示
    if (z.attacking && !z.dead) {
      drawEmoji('💢', 18, { halo: 3, alpha: .95, y: -20 });
      ctx.save();
      ctx.translate(27, -20);
      drawEmoji('💢', 18, { halo: 3, alpha: .9 });
      ctx.restore();
    }

    ctx.restore();
  }

  /* ---------------- 子弹 ---------------- */
  function drawProjectiles(game) {
    for (const p of game.projectiles) {
      const isSnow = p.type === 'snow';
      // 亮黄色调填充 + 近黑描边：在绿色草坪上对比度最高
      const fill = isSnow ? '#b3e5fc' : '#d4f06a';
      const edge = isSnow ? '#01579b' : '#1b3a06';

      // 拖尾：同样带深色勾边
      p.trail.forEach(t => {
        if (t.life <= 0) return;
        ctx.globalAlpha = t.life * .55;
        ctx.fillStyle = edge;
        ctx.beginPath(); ctx.arc(t.x, t.y, 5.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = fill;
        ctx.beginPath(); ctx.arc(t.x, t.y, 3.8, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;

      // 外发光
      ctx.save();
      const glow = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 17);
      glow.addColorStop(0, isSnow ? 'rgba(179,229,252,.8)' : 'rgba(212,240,106,.75)');
      glow.addColorStop(1, isSnow ? 'rgba(179,229,252,0)' : 'rgba(212,240,106,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(p.x, p.y, 17, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // 弹体：粗深色描边 → 亮色填充 → 白色高光
      ctx.fillStyle = edge;
      ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = fill;
      ctx.beginPath(); ctx.arc(p.x, p.y, 6.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.95)';
      ctx.beginPath(); ctx.arc(p.x - 2.4, p.y - 2.4, 2.6, 0, Math.PI * 2); ctx.fill();

      // 寒冰弹：外圈霜环
      if (isSnow) {
        ctx.strokeStyle = 'rgba(255,255,255,.9)';
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(p.x, p.y, 10.2, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  /* ---------------- 阳光 ---------------- */
  function drawSuns(game) {
    const now = performance.now();
    for (const s of game.suns) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.globalAlpha = Math.min(1, s.life * 2.2);

      const pulse = 1 + Math.sin(now / 260 + s.phase) * .07;
      const r = 20 * pulse;

      // 光晕
      const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 2.1);
      glow.addColorStop(0, 'rgba(255,235,130,.95)');
      glow.addColorStop(.45, 'rgba(255,214,64,.55)');
      glow.addColorStop(1, 'rgba(255,200,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, 0, r * 2.1, 0, Math.PI * 2); ctx.fill();

      // 核心
      const core = ctx.createRadialGradient(-3, -3, 1, 0, 0, r);
      core.addColorStop(0, '#fffde7');
      core.addColorStop(.6, '#ffd54f');
      core.addColorStop(1, '#f9a825');
      ctx.fillStyle = core;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

      // 光芒
      ctx.strokeStyle = 'rgba(255,236,150,.85)';
      ctx.lineWidth = 2.4;
      for (let i = 0; i < 8; i++) {
        const a = now / 1400 + i * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (r + 2), Math.sin(a) * (r + 2));
        ctx.lineTo(Math.cos(a) * (r + 8), Math.sin(a) * (r + 8));
        ctx.stroke();
      }

      // 剩余时间提示
      if (s.life < .3) {
        ctx.strokeStyle = `rgba(255,80,80,${.9 - s.life * 3})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, 0, r + 7, 0, Math.PI * 2); ctx.stroke();
      }

      // 暗色外圈，防止阳光在亮色背景上“化掉”
      ctx.strokeStyle = 'rgba(90,60,0,.45)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r + 1, 0, Math.PI * 2); ctx.stroke();

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
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,.75)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- 爆炸特效 ---------------- */
  function drawExplosions(game) {
    const now = performance.now();
    for (const e of game.explosions) {
      const t = (now - e.start) / e.duration;
      if (t < 0 || t > 1) continue;
      ctx.save();
      ctx.globalAlpha = (1 - t) * .8;

      if (e.type === 'circle') {
        const r = e.radius * easeOutCubic(Math.min(1, t * 1.6));
        const g = ctx.createRadialGradient(e.x, e.y, r * .1, e.x, e.y, r);
        g.addColorStop(0, 'rgba(255,255,200,.95)');
        g.addColorStop(.4, 'rgba(255,152,0,.8)');
        g.addColorStop(1, 'rgba(244,67,54,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.fill();
      } else if (e.type === 'lane') {
        const h = CFG.CELL_H * .92;
        const g = ctx.createLinearGradient(0, e.y - h / 2, 0, e.y + h / 2);
        g.addColorStop(0, 'rgba(255,193,7,0)');
        g.addColorStop(.5, `rgba(255,87,34,${(1 - t)})`);
        g.addColorStop(1, 'rgba(255,193,7,0)');
        ctx.fillStyle = g;
        ctx.fillRect(CFG.HUD_W, e.y - h / 2, CFG.COLS * CFG.CELL_W, h);
      }
      ctx.restore();
    }
  }

  /* ---------------- 波次预警 ---------------- */
  function drawWaveWarning(game) {
    if (!game.waveWarnUntil || performance.now() > game.waveWarnUntil) return;
    const left = game.waveWarnUntil - performance.now();
    const alpha = Math.min(1, left / 400) * Math.abs(Math.sin(performance.now() / 180)) * .85;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 40px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,.8)';
    ctx.strokeText('一大波僵尸正在接近！', CFG.W / 2, CFG.TOP_OFFSET + 96);
    ctx.fillStyle = '#ff5252';
    ctx.fillText('一大波僵尸正在接近！', CFG.W / 2, CFG.TOP_OFFSET + 96);
    ctx.restore();

    // 红色边框脉冲
    ctx.save();
    ctx.globalAlpha = alpha * .55;
    ctx.strokeStyle = '#ff1744';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, CFG.W - 10, CFG.H - 10);
    ctx.restore();
  }

  /* ---------------- 小推车 ---------------- */
  function drawMowers(game) {
    for (const m of game.mowers) {
      if (m.active) continue;              // 已开动的由 drawActiveMower 画
      if (m.used) continue;
      const y = Grid.cellCY(m.row) + 20;
      ctx.save();
      ctx.translate(m.x, y);
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      ctx.beginPath(); ctx.ellipse(0, 10, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.font = '30px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🚜', 0, 0);
      ctx.restore();
    }
  }

  function drawActiveMowers(game) {
    for (const m of game.mowers) {
      if (!m.active) continue;
      const y = Grid.cellCY(m.row) + 20;
      ctx.save();
      ctx.translate(m.x, y);
      // 尘土
      ctx.globalAlpha = .5;
      ctx.fillStyle = '#d7ccc8';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(-18 - i * 12, (Math.random() * 8 - 4), 4 + Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.rotate(Math.sin(m.spin) * .12);
      ctx.font = '32px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🚜', 0, 0);
      ctx.restore();
    }
  }

  /* ---------------- 主绘制 ---------------- */
  function draw(game) {
    ctx.clearRect(0, 0, CFG.W, CFG.H);
    drawLawn(game);
    drawHover(game);
    drawExplosions(game);
    drawMowers(game);
    drawPlants(game);
    drawProjectiles(game);
    drawZombies(game);
    drawActiveMowers(game);
    drawSuns(game);
    drawParticles(game);
    drawWaveWarning(game);
  }

  /* ---------------- 工具 ---------------- */
  function easeOutBack(x) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }
  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

  return { init, resize, draw, get ctx() { return ctx; }, get canvas() { return canvas; } };
})();
