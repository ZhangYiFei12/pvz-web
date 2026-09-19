/* ===========================================================
   sprites.js — 原版风格的程序化绘制（第一部分：工具 + 植物）
   全部用 Canvas 路径手绘，不依赖任何图片资源。
   坐标系：以单位脚下中心为原点 (0,0)，向上为负 y。
   =========================================================== */

const Sprites = (() => {

  const OUT = '#241608';        // 统一粗描边

  /* ---------------- 基础绘制工具 ---------------- */
  function ell(ctx, x, y, rx, ry, fill, stroke, lw = 2.5) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }

  function circ(ctx, x, y, r, fill, stroke, lw = 2.5) {
    ell(ctx, x, y, r, r, fill, stroke, lw);
  }

  function rr(ctx, x, y, w, h, r, fill, stroke, lw = 2.5) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }

  function poly(ctx, pts, fill, stroke, lw = 2.5) {
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }

  /** 粗肢体：带描边的圆头线段 */
  function limb(ctx, x1, y1, x2, y2, w, fill, stroke) {
    ctx.save();
    ctx.lineCap = 'round';
    if (stroke) {
      ctx.strokeStyle = stroke; ctx.lineWidth = w + 3;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.strokeStyle = fill; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();
  }

  /** 叶片（带中脉） */
  function leaf(ctx, x, y, len, ang, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ell(ctx, len / 2, 0, len / 2, len * 0.26, color, OUT, 2);
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(len - 2, 0); ctx.stroke();
    ctx.restore();
  }

  /* ---------------- 表情 ---------------- */
  function face(ctx, x, y, s, opts = {}) {
    const { eyeR = 3.2, angry = false, smile = true, mouth = 5, dead = false } = opts;
    circ(ctx, x - s * 0.42, y, eyeR, '#fff', OUT, 1.6);
    circ(ctx, x + s * 0.42, y, eyeR, '#fff', OUT, 1.6);
    circ(ctx, x - s * 0.42, y + 0.4, eyeR * 0.52, '#1a1008');
    circ(ctx, x + s * 0.42, y + 0.4, eyeR * 0.52, '#1a1008');
    if (angry) {
      limb(ctx, x - s * 0.78, y - 6.5, x - s * 0.14, y - 3.4, 2.6, OUT);
      limb(ctx, x + s * 0.78, y - 6.5, x + s * 0.14, y - 3.4, 2.6, OUT);
    }
    if (dead) {
      ctx.save();
      ctx.strokeStyle = OUT; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      [-1, 1].forEach(d => {
        const ex = x + d * s * 0.42;
        ctx.beginPath(); ctx.moveTo(ex - 3, y - 3); ctx.lineTo(ex + 3, y + 3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex + 3, y - 3); ctx.lineTo(ex - 3, y + 3); ctx.stroke();
      });
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath();
    if (smile) ctx.arc(x, y + 4.5, mouth, 0.18 * Math.PI, 0.82 * Math.PI);
    else ctx.arc(x, y + 9.5, mouth, 1.18 * Math.PI, 1.82 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  /* ===========================================================
     植物
     =========================================================== */

  function stem(ctx, h, leafY, tint) {
    const g = tint || '#4a8c1c';
    limb(ctx, 0, 30, 0, 30 - h, 7, g, OUT);
    leaf(ctx, -2, leafY, 26, Math.PI - 0.35, '#63a82a');
    leaf(ctx, 2, leafY + 3, 26, 0.35, '#5c9e26');
  }

  /* --- 向日葵 --- */
  function sunflower(ctx, t, o = {}) {
    const sway = Math.sin(t * 2.2 + (o.seed || 0)) * 2.2;
    stem(ctx, 34, 22);
    ctx.save();
    ctx.translate(sway, -10);
    const spin = Math.sin(t * 1.1) * 0.05;
    for (let i = 0; i < 12; i++) {
      ctx.save();
      ctx.rotate(i / 12 * Math.PI * 2 + spin);
      ell(ctx, 0, -24, 8.5, 13, i % 2 ? '#ffd93b' : '#ffc400', OUT, 2.2);
      ctx.restore();
    }
    circ(ctx, 0, 0, 19, '#c8791a', OUT, 2.6);
    circ(ctx, 0, 0, 15.5, '#e8a13a');
    ctx.save();
    ctx.globalAlpha = .35;
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2;
      circ(ctx, Math.cos(a) * 8.5, Math.sin(a) * 8.5, 1.7, '#8a4d0c');
    }
    ctx.restore();
    face(ctx, 0, -1, 15, { eyeR: 3.4, mouth: 5.5 });
    ctx.restore();
  }

  /* --- 射手（豌豆 / 寒冰 / 双发） --- */
  function shooter(ctx, t, o = {}) {
    const { snow = false, twin = false, seed = 0, color = '#5fb32a', dark = '#3f8a17' } = o;
    const body = snow ? '#7fd4e8' : color;
    const bodyD = snow ? '#3fa6c4' : dark;
    const recoil = o.recoil || 0;
    const bob = Math.sin(t * 2.6 + seed) * 1.6;

    stem(ctx, 30, 20, snow ? '#4a9a5c' : '#4a8c1c');
    ctx.save();
    ctx.translate(-recoil * 4, -12 + bob);

    circ(ctx, 0, 0, 17, body, OUT, 2.6);
    ctx.save(); ctx.globalAlpha = .28;
    ell(ctx, -5, -6, 7, 5, '#ffffff');
    ctx.restore();

    const tubes = twin ? [-6.5, 5.5] : [0];
    tubes.forEach(ty => {
      rr(ctx, 11, ty - 6.5, 15, 13, 5, body, OUT, 2.4);
      circ(ctx, 26, ty, 6.2, bodyD, OUT, 2.2);
      circ(ctx, 26.5, ty, 3.4, '#1d3a08');
    });

    circ(ctx, -3, -7, 3.6, '#fff', OUT, 1.7);
    circ(ctx, -3.7, -6.6, 1.9, '#1a1008');
    limb(ctx, -9, -13, -1, -11, 2.2, OUT);
    ctx.restore();

    if (snow) {
      ctx.save();
      ctx.globalAlpha = .9;
      [[-14, -20], [13, -22], [17, 12]].forEach(([x, y]) => {
        ctx.strokeStyle = '#eafcff'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const a = i / 3 * Math.PI;
          ctx.beginPath();
          ctx.moveTo(x - Math.cos(a) * 4, y - Math.sin(a) * 4);
          ctx.lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4);
          ctx.stroke();
        }
      });
      ctx.restore();
    }
  }

  /* --- 坚果墙 --- */
  function wallnut(ctx, t, o = {}) {
    const dmg = o.damage || 0;
    const squash = 1 + Math.sin(t * 1.6) * .02;
    ctx.save();
    ctx.scale(1, squash);
    ell(ctx, 0, -2, 23, 30, '#d9a154', OUT, 3);
    ctx.save(); ctx.globalAlpha = .32;
    ell(ctx, -8, -14, 8, 11, '#f5d9a8');
    ctx.restore();
    ctx.save(); ctx.globalAlpha = .16;
    ell(ctx, 4, 18, 15, 8, '#7a4a12');
    ctx.restore();
    face(ctx, 0, -6, 17, { eyeR: 3.8, mouth: 6.5, smile: dmg < .55 });
    if (dmg > .3) {
      const cracks = [
        [[-16, -20], [-10, -10], [-14, -2]],
        [[15, -18], [10, -8], [16, 2]],
        [[-18, 12], [-8, 8], [-2, 16]],
        [[12, 14], [6, 20]],
      ];
      ctx.save();
      ctx.strokeStyle = '#5a3a10'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      const n = Math.max(1, Math.round(dmg * cracks.length));
      for (let i = 0; i < n; i++) {
        const c = cracks[i];
        ctx.beginPath();
        c.forEach((p, j) => j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  /* --- 樱桃炸弹 --- */
  function cherrybomb(ctx, t, o = {}) {
    const pulse = 1 + Math.sin(t * 15) * .06 + (o.fuse || 0) * .3;
    ctx.save();
    ctx.scale(pulse, pulse);
    limb(ctx, -8, -14, -3, -30, 3, '#4a8c1c', OUT);
    limb(ctx, 9, -12, 4, -30, 3, '#4a8c1c', OUT);
    ell(ctx, 0, -32, 7, 4, '#63a82a', OUT, 2);
    circ(ctx, -10, 2, 15, '#d62f3c', OUT, 2.8);
    circ(ctx, 11, 4, 15, '#e8444f', OUT, 2.8);
    ctx.save(); ctx.globalAlpha = .38;
    circ(ctx, -14, -4, 4.5, '#ff9aa2');
    circ(ctx, 7, -2, 4.5, '#ff9aa2');
    ctx.restore();
    face(ctx, -10, 0, 13, { eyeR: 3.2, angry: true, smile: false });
    face(ctx, 11, 2, 13, { eyeR: 3.2, angry: true, smile: false });
    ctx.restore();
  }

  /* --- 火爆辣椒 --- */
  function jalapeno(ctx, t) {
    ctx.save();
    ctx.translate(Math.sin(t * 16) * 1.2, 0);
    ctx.rotate(-0.12);
    ctx.beginPath();
    ctx.moveTo(-9, -20);
    ctx.quadraticCurveTo(-20, 4, -5, 26);
    ctx.quadraticCurveTo(4, 34, 11, 20);
    ctx.quadraticCurveTo(18, 0, 9, -20);
    ctx.closePath();
    ctx.fillStyle = '#d8342a'; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.8; ctx.stroke();
    ctx.save(); ctx.globalAlpha = .32;
    ell(ctx, -5, 0, 4, 12, '#ff8a7a');
    ctx.restore();
    limb(ctx, 0, -20, 2, -30, 5, '#4a8c1c', OUT);
    ell(ctx, 2, -31, 7, 4, '#63a82a', OUT, 2);
    face(ctx, 1, -2, 13, { eyeR: 3.2, angry: true, smile: false });
    ctx.restore();
  }

  /* --- 土豆雷 --- */
  function potatomine(ctx, t, o = {}) {
    const armed = o.armed;
    const ratio = o.armRatio != null ? o.armRatio : 1;
    ctx.save();
    if (!armed) ctx.globalAlpha = .5 + ratio * .45;
    ell(ctx, 0, 8, 22, 15, '#c99a5e', OUT, 2.8);
    ctx.save(); ctx.globalAlpha = .28;
    ell(ctx, -7, 3, 7, 4.5, '#f0d3a8');
    ctx.restore();
    limb(ctx, -6, -4, -9, -14, 3, '#4a8c1c', OUT);
    limb(ctx, 5, -4, 8, -13, 3, '#4a8c1c', OUT);
    ell(ctx, -10, -15, 5, 3.2, '#63a82a', OUT, 1.8);
    ell(ctx, 9, -14, 5, 3.2, '#63a82a', OUT, 1.8);
    circ(ctx, -6, 6, 3.2, '#fff', OUT, 1.6);
    circ(ctx, 7, 6, 3.2, '#fff', OUT, 1.6);
    circ(ctx, -6, 6.4, 1.7, '#1a1008');
    circ(ctx, 7, 6.4, 1.7, '#1a1008');
    if (armed) {
      const blink = .55 + Math.sin(t * 7) * .45;
      ctx.save();
      ctx.globalAlpha = blink;
      circ(ctx, 0, -7, 4.5, '#ff3b30', '#7a0d06', 2);
      ctx.globalAlpha = blink * .3;
      circ(ctx, 0, -7, 9, 'rgba(255,59,48,.7)');
      ctx.restore();
    }
    ctx.restore();
  }

  /* --- 大嘴花 --- */
  function chomper(ctx, t, o = {}) {
    const chewing = o.chewing;
    const open = chewing ? 0.1 : (0.5 + Math.sin(t * 2.4) * 0.2);
    stem(ctx, 26, 18, '#5b8f2a');
    ctx.save();
    ctx.translate(0, -16);

    ctx.save();
    ctx.rotate(-open * 0.45);
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.quadraticCurveTo(-20, -22, 4, -24);
    ctx.quadraticCurveTo(24, -24, 26, -6);
    ctx.quadraticCurveTo(10, -2, -16, 0);
    ctx.closePath();
    ctx.fillStyle = '#8e3fa8'; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.8; ctx.stroke();
    for (let i = 0; i < 4; i++) {
      poly(ctx, [[2 + i * 6, -9], [5.5 + i * 6, -9], [3.8 + i * 6, -1.5]], '#fff8e6', OUT, 1.4);
    }
    ctx.save(); ctx.globalAlpha = .3;
    circ(ctx, -6, -16, 3.2, '#d38ae8');
    circ(ctx, 12, -18, 2.6, '#d38ae8');
    ctx.restore();
    ctx.restore();

    ctx.save();
    ctx.rotate(open * 0.3);
    ctx.beginPath();
    ctx.moveTo(-14, 2);
    ctx.quadraticCurveTo(-4, 20, 18, 12);
    ctx.quadraticCurveTo(26, 8, 26, -4);
    ctx.quadraticCurveTo(6, 2, -14, 2);
    ctx.closePath();
    ctx.fillStyle = '#7a3494'; ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.8; ctx.stroke();
    for (let i = 0; i < 4; i++) {
      poly(ctx, [[4 + i * 6, 3], [7.5 + i * 6, 3], [5.8 + i * 6, -3.5]], '#fff8e6', OUT, 1.4);
    }
    ctx.restore();

    circ(ctx, 2, -26, 3.4, '#fff', OUT, 1.6);
    circ(ctx, 2, -25.6, 1.8, '#1a1008');
    ctx.restore();

    if (chewing) {
      ctx.save();
      ctx.globalAlpha = .45 + Math.sin(t * 9) * .25;
      ctx.strokeStyle = '#ffab91'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, -16, 28, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  const PLANT_FNS = {
    sunflower,
    peashooter: (c, t, o) => shooter(c, t, o),
    snowpea: (c, t, o) => shooter(c, t, { ...o, snow: true }),
    repeater: (c, t, o) => shooter(c, t, { ...o, twin: true, color: '#4fa324', dark: '#357a12' }),
    wallnut, cherrybomb, jalapeno, potatomine, chomper,
  };

  function plant(ctx, id, t, o = {}) {
    const fn = PLANT_FNS[id];
    if (!fn) return;
    ctx.save();
    fn(ctx, t, o);
    ctx.restore();
  }

  /* ===========================================================
     阳光 / 小推车 / 种子卡（HUD 用）
     =========================================================== */

  function sun(ctx, t, r = 20) {
    const pulse = 1 + Math.sin(t * 3.4) * .06;
    const R = r * pulse;
    ctx.save();
    // 光芒
    ctx.save();
    ctx.rotate(t * 0.9);
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.rotate(i / 8 * Math.PI * 2);
      poly(ctx, [[0, -R - 3], [5.5, -R - 12], [0, -R - 16], [-5.5, -R - 12]],
        'rgba(255,214,60,.95)', null);
      ctx.restore();
    }
    ctx.restore();
    // 光晕
    const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, R * 1.9);
    glow.addColorStop(0, 'rgba(255,240,150,.95)');
    glow.addColorStop(.5, 'rgba(255,210,50,.5)');
    glow.addColorStop(1, 'rgba(255,200,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, R * 1.9, 0, Math.PI * 2); ctx.fill();
    // 本体
    const core = ctx.createRadialGradient(-R * .3, -R * .3, 1, 0, 0, R);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(.4, '#fff6b0');
    core.addColorStop(.75, '#ffd54f');
    core.addColorStop(1, '#f5a623');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(160,110,0,.5)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function mower(ctx, t, active) {
    ctx.save();
    // 车身
    rr(ctx, -19, -20, 38, 22, 6, '#c0392b', OUT, 2.6);
    ctx.save(); ctx.globalAlpha = .3;
    rr(ctx, -16, -18, 32, 7, 4, '#ff8a7a');
    ctx.restore();
    // 滚筒刀片
    ctx.save();
    ctx.translate(0, 2);
    if (active) ctx.rotate(t * 22);
    circ(ctx, 0, 0, 8.5, '#b0bec5', OUT, 2.2);
    for (let i = 0; i < 6; i++) {
      ctx.save(); ctx.rotate(i / 6 * Math.PI * 2);
      limb(ctx, 0, 0, 7, 0, 2.2, '#78909c');
      ctx.restore();
    }
    ctx.restore();
    // 轮子
    circ(ctx, -12, 6, 6, '#37474f', OUT, 2.2);
    circ(ctx, 12, 6, 6, '#37474f', OUT, 2.2);
    // 把手
    limb(ctx, 14, -18, 24, -30, 4, '#90a4ae', OUT);
    ctx.restore();
  }

  /** 种子卡上的植物小图（等比缩小绘制） */
  function packetIcon(ctx, id, x, y, size, t) {
    ctx.save();
    ctx.translate(x, y);
    const s = size / 78;
    ctx.scale(s, s);
    ctx.translate(0, 12);
    const fn = PLANT_FNS[id];
    if (fn) fn(ctx, t || 0, {});
    ctx.restore();
  }

  return { plant, sun, mower, packetIcon, ell, circ, rr, poly, limb, leaf, face,
           get PLANT_IDS() { return Object.keys(PLANT_FNS); } };
})();
