/* ===========================================================
   renderer-hud.js — 画布内 HUD（原版风格）
   顶部木质种子槽 + 阳光计数器 + 铲子 + 暂停；底部进度条。
   =========================================================== */

const Hud = (() => {

  /* ---------------- 木质面板 ---------------- */
  function woodPanel(ctx, x, y, w, h, r = 10) {
    ctx.save();
    // 主体
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#a9743f');
    g.addColorStop(.5, '#8b5a2b');
    g.addColorStop(1, '#6b4420');
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#3d2612'; ctx.lineWidth = 3; ctx.stroke();

    // 木纹
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = .12;
    ctx.strokeStyle = '#3d2612'; ctx.lineWidth = 1.4;
    for (let i = 1; i < 7; i++) {
      const yy = y + (h / 7) * i;
      ctx.beginPath();
      ctx.moveTo(x, yy);
      for (let xx = x; xx <= x + w; xx += 26) {
        ctx.lineTo(xx, yy + Math.sin(xx * 0.06 + i) * 1.6);
      }
      ctx.stroke();
    }
    ctx.restore();

    // 高光
    ctx.save();
    ctx.globalAlpha = .18;
    ctx.fillStyle = '#ffe0b2';
    ctx.fillRect(x + 4, y + 3, w - 8, 3);
    ctx.restore();
    ctx.restore();
  }

  /* ---------------- 阳光计数器 ---------------- */
  function sunCounter(ctx, game, t) {
    const b = UI.sunBox;
    woodPanel(ctx, b.x, b.y, b.w, b.h, 8);

    // 太阳图标
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + 26);
    ctx.scale(.62, .62);
    Sprites.sun(ctx, t, 18);
    ctx.restore();

    // 数字
    ctx.save();
    ctx.font = 'bold 26px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(40,20,0,.85)';
    ctx.strokeText(game.sun, b.x + b.w / 2, b.y + 58);
    ctx.fillStyle = '#fff8dc';
    ctx.fillText(game.sun, b.x + b.w / 2, b.y + 58);
    ctx.restore();
  }

  /* ---------------- 种子卡 ---------------- */
  function seedPacket(ctx, game, r, def, t) {
    const now = performance.now();
    const cdLeft = Math.max(0, (game.cooldowns[def.id] || 0) - now);
    const cdRatio = def.cd > 0 ? Math.min(1, cdLeft / def.cd) : 0;
    const afford = game.sun >= def.cost;
    const selected = game.selected === def.id;
    const usable = afford && cdLeft <= 0;

    ctx.save();
    ctx.translate(r.x, r.y);
    if (selected) ctx.translate(0, -3);

    // 卡面
    const g = ctx.createLinearGradient(0, 0, 0, r.h);
    g.addColorStop(0, '#e8d9a8');
    g.addColorStop(1, '#c4ab72');
    ctx.beginPath();
    ctx.moveTo(7, 0); ctx.arcTo(r.w, 0, r.w, r.h, 7);
    ctx.arcTo(r.w, r.h, 0, r.h, 7); ctx.arcTo(0, r.h, 0, 0, 7);
    ctx.arcTo(0, 0, r.w, 0, 7); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = selected ? '#fff9c4' : '#6b4420';
    ctx.lineWidth = selected ? 4 : 2.5; ctx.stroke();

    // 植物图标
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(7, 0); ctx.arcTo(r.w, 0, r.w, r.h, 7);
    ctx.arcTo(r.w, r.h, 0, r.h, 7); ctx.arcTo(0, r.h, 0, 0, 7);
    ctx.arcTo(0, 0, r.w, 0, 7); ctx.closePath();
    ctx.clip();
    Sprites.packetIcon(ctx, def.id, r.w / 2, r.h * 0.44, r.w * 1.02, t);
    ctx.restore();

    // 名称
    ctx.save();
    ctx.font = 'bold 10px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.strokeText(def.name, r.w / 2, r.h - 15);
    ctx.fillStyle = '#4a3410';
    ctx.fillText(def.name, r.w / 2, r.h - 15);
    ctx.restore();

    // 价格
    ctx.save();
    ctx.font = 'bold 14px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.strokeText(def.cost, r.w / 2, r.h - 5);
    ctx.fillStyle = afford ? '#2e2005' : '#c62828';
    ctx.fillText(def.cost, r.w / 2, r.h - 5);
    ctx.restore();

    // 冷却遮罩（自上而下）
    if (cdRatio > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(7, 0); ctx.arcTo(r.w, 0, r.w, r.h, 7);
      ctx.arcTo(r.w, r.h, 0, r.h, 7); ctx.arcTo(0, r.h, 0, 0, 7);
      ctx.arcTo(0, 0, r.w, 0, 7); ctx.closePath();
      ctx.clip();
      ctx.fillStyle = 'rgba(15,10,4,.62)';
      ctx.fillRect(0, 0, r.w, r.h * cdRatio);
      ctx.restore();
    }

    // 阳光不足
    if (!afford) {
      ctx.save();
      ctx.globalAlpha = .38;
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.moveTo(7, 0); ctx.arcTo(r.w, 0, r.w, r.h, 7);
      ctx.arcTo(r.w, r.h, 0, r.h, 7); ctx.arcTo(0, r.h, 0, 0, 7);
      ctx.arcTo(0, 0, r.w, 0, 7); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /* ---------------- 铲子 / 暂停 ---------------- */
  function shovelBtn(ctx, game, r) {
    const active = game.shovelMode;
    ctx.save();
    ctx.translate(r.x, r.y);
    const g = ctx.createLinearGradient(0, 0, 0, r.h);
    g.addColorStop(0, active ? '#c5e1a5' : '#d7c9a0');
    g.addColorStop(1, active ? '#7cb342' : '#a89968');
    ctx.beginPath();
    ctx.moveTo(7, 0); ctx.arcTo(r.w, 0, r.w, r.h, 7);
    ctx.arcTo(r.w, r.h, 0, r.h, 7); ctx.arcTo(0, r.h, 0, 0, 7);
    ctx.arcTo(0, 0, r.w, 0, 7); ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = active ? '#33691e' : '#6b4420';
    ctx.lineWidth = active ? 4 : 2.5; ctx.stroke();

    // 铲子图形
    ctx.save();
    ctx.translate(r.w / 2, r.h / 2 + 4);
    ctx.rotate(-0.5);
    Sprites.limb(ctx, 0, -20, 0, 6, 6, '#c8a165', '#241608');
    ctx.beginPath();
    ctx.moveTo(-9, 5); ctx.lineTo(9, 5); ctx.lineTo(6, 20);
    ctx.quadraticCurveTo(0, 25, -6, 20); ctx.closePath();
    ctx.fillStyle = '#9e9e9e'; ctx.fill();
    ctx.strokeStyle = '#241608'; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.font = 'bold 10px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.65)';
    ctx.strokeText('铲子', r.w / 2, r.h - 9);
    ctx.fillStyle = '#4a3410';
    ctx.fillText('铲子', r.w / 2, r.h - 9);
    ctx.restore();
    ctx.restore();
  }

  function pauseBtn(ctx, r, paused) {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.beginPath();
    ctx.moveTo(6, 0); ctx.arcTo(r.w, 0, r.w, r.h, 6);
    ctx.arcTo(r.w, r.h, 0, r.h, 6); ctx.arcTo(0, r.h, 0, 0, 6);
    ctx.arcTo(0, 0, r.w, 0, 6); ctx.closePath();
    ctx.fillStyle = '#8b5a2b'; ctx.fill();
    ctx.strokeStyle = '#3d2612'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#fff8dc';
    if (paused) {
      ctx.beginPath();
      ctx.moveTo(r.w * .35, r.h * .25); ctx.lineTo(r.w * .72, r.h * .5);
      ctx.lineTo(r.w * .35, r.h * .75); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillRect(r.w * .32, r.h * .26, r.w * .13, r.h * .48);
      ctx.fillRect(r.w * .55, r.h * .26, r.w * .13, r.h * .48);
    }
    ctx.restore();
  }

  /* ---------------- 底部进度条 ---------------- */
  function progress(ctx, game, t) {
    const b = UI.progress;
    const L = game.level;
    if (!L) return;

    // 底槽
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(b.h / 2, b.y);
    ctx.arcTo(b.x + b.w, b.y, b.x + b.w, b.y + b.h, b.h / 2);
    ctx.arcTo(b.x + b.w, b.y + b.h, b.x, b.y + b.h, b.h / 2);
    ctx.arcTo(b.x, b.y + b.h, b.x, b.y, b.h / 2);
    ctx.arcTo(b.x, b.y, b.x + b.w, b.y, b.h / 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(20,12,4,.85)'; ctx.fill();
    ctx.strokeStyle = '#3d2612'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.restore();

    // 进度
    let ratio = 0, total = 0, cur = 0;
    if (L.endless) {
      total = 10;
      cur = game.endlessN % 10;
      ratio = cur / total;
    } else {
      total = L.waves.length;
      cur = game.waveIndex;
      ratio = total ? cur / total : 0;
    }
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(b.h / 2, b.y);
    ctx.arcTo(b.x + b.w, b.y, b.x + b.w, b.y + b.h, b.h / 2);
    ctx.arcTo(b.x + b.w, b.y + b.h, b.x, b.y + b.h, b.h / 2);
    ctx.arcTo(b.x, b.y + b.h, b.x, b.y, b.h / 2);
    ctx.arcTo(b.x, b.y, b.x + b.w, b.y, b.h / 2);
    ctx.closePath();
    ctx.clip();
    const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    g.addColorStop(0, '#7ec850'); g.addColorStop(1, '#4e8b28');
    ctx.fillStyle = g;
    ctx.fillRect(b.x, b.y, b.w * Math.max(0, Math.min(1, ratio)), b.h);
    ctx.restore();

    // 波次旗标
    if (!L.endless) {
      ctx.save();
      for (let i = 1; i <= total; i++) {
        const x = b.x + (b.w * i / total);
        const done = i <= cur;
        ctx.strokeStyle = done ? 'rgba(255,255,255,.75)' : 'rgba(0,0,0,.55)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, b.y + 2); ctx.lineTo(x, b.y + b.h - 2); ctx.stroke();
        if (done) {
          ctx.fillStyle = '#ff5252';
          ctx.beginPath();
          ctx.moveTo(x, b.y + 3);
          ctx.lineTo(x + 9, b.y + 7);
          ctx.lineTo(x, b.y + 11);
          ctx.closePath(); ctx.fill();
        }
      }
      ctx.restore();
    }

    // 僵尸头标记
    ctx.save();
    const mx = b.x + b.w * Math.max(0, Math.min(1, ratio));
    ctx.translate(mx, b.y + b.h / 2);
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fillStyle = '#e8e0d0'; ctx.fill();
    ctx.strokeStyle = '#3d2612'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.clip();
    ctx.save();
    ctx.translate(0, 6);
    ctx.scale(.5, .5);
    ZombieArt.draw(ctx, 'basic', t, { walk: 0 });
    ctx.restore();
    ctx.restore();

    // 文字
    ctx.save();
    ctx.font = 'bold 13px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,12,4,.9)';
    const label = L.endless ? `第 ${game.endlessN} 波` : `波次 ${cur}/${total}`;
    ctx.strokeText(label, b.x - 14, b.y + b.h / 2);
    ctx.fillStyle = '#ffe082';
    ctx.fillText(label, b.x - 14, b.y + b.h / 2);
    ctx.restore();
  }

  /* ---------------- 关卡名 ---------------- */
  function levelTag(ctx, game) {
    if (!game.level) return;
    ctx.save();
    ctx.font = 'bold 14px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,12,4,.9)';
    const txt = `${game.level.code}  ${game.level.name}`;
    ctx.strokeText(txt, UI.progress.x, UI.progress.y - 14);
    ctx.fillStyle = '#ffe082';
    ctx.fillText(txt, UI.progress.x, UI.progress.y - 14);
    ctx.restore();
  }

  /* ---------------- 主入口 ---------------- */
  function draw(ctx, game, t) {
    if (!game.level) return;
    woodPanel(ctx, UI.panel.x, UI.panel.y, UI.panel.w, UI.panel.h, 10);
    sunCounter(ctx, game, t);

    const rects = seedRects(game.level.plants);
    rects.forEach(r => seedPacket(ctx, game, r, PLANTS[r.id], t));
    shovelBtn(ctx, game, shovelRect(game.level.plants));
    pauseBtn(ctx, pauseRect(), game.state === 'paused');

    progress(ctx, game, t);
    levelTag(ctx, game);
  }

  return { draw, woodPanel };
})();
