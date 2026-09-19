/* ===========================================================
   sprites-zombie.js — 原版风格僵尸（程序化手绘）
   面朝左行走。原点在脚下中心，向上为负 y。
   =========================================================== */

const ZombieArt = (() => {

  const OUT = '#241608';
  const SKIN = '#a8c48f', SKIN_D = '#87a56e';
  const SHIRT = '#6d6f9e', SHIRT_D = '#4d4f78';
  const PANTS = '#474754', PANTS_D = '#33333d';

  /* ---------- 工具 ---------- */
  const ell = (c, x, y, rx, ry, f, s, lw = 2.4) => {
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (f) { c.fillStyle = f; c.fill(); }
    if (s) { c.strokeStyle = s; c.lineWidth = lw; c.stroke(); }
  };
  const circ = (c, x, y, r, f, s, lw = 2.4) => ell(c, x, y, r, r, f, s, lw);
  const rr = (c, x, y, w, h, r, f, s, lw = 2.4) => {
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
    if (f) { c.fillStyle = f; c.fill(); }
    if (s) { c.strokeStyle = s; c.lineWidth = lw; c.stroke(); }
  };
  const poly = (c, pts, f, s, lw = 2.4) => {
    c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
    c.closePath();
    if (f) { c.fillStyle = f; c.fill(); }
    if (s) { c.strokeStyle = s; c.lineWidth = lw; c.stroke(); }
  };
  const limb = (c, x1, y1, x2, y2, w, f, s) => {
    c.save(); c.lineCap = 'round';
    if (s) { c.strokeStyle = s; c.lineWidth = w + 3; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
    c.strokeStyle = f; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    c.restore();
  };

  /* ---------- 腿（带行走摆动） ---------- */
  function legs(c, swing) {
    const draw = (hipX, phase, front) => {
      const sw = swing * phase;
      c.save();
      c.translate(hipX, 8);
      c.rotate(sw * 0.5);
      limb(c, 0, 0, 0, 20, 8, front ? PANTS : PANTS_D, OUT);
      c.translate(0, 20);
      c.rotate(-sw * 0.3);
      // 破鞋
      rr(c, -5, -3, 15, 8, 3.5, front ? '#3a3a44' : '#2c2c34', OUT, 2.2);
      c.restore();
    };
    draw(4, -1, false);   // 后腿
    draw(-1, 1, true);    // 前腿
  }

  /* ---------- 躯干（破烂衬衫） ---------- */
  function torso(c) {
    c.beginPath();
    c.moveTo(-8, -26);
    c.quadraticCurveTo(-11, -8, -8, 12);
    c.lineTo(10, 12);
    c.quadraticCurveTo(12, -8, 9, -26);
    c.quadraticCurveTo(0, -30, -8, -26);
    c.closePath();
    c.fillStyle = SHIRT; c.fill();
    c.strokeStyle = OUT; c.lineWidth = 2.6; c.stroke();
    // 破洞与阴影
    c.save(); c.globalAlpha = .35;
    c.fillStyle = SHIRT_D;
    poly(c, [[2, 12], [10, 12], [9, -4], [3, -2]], SHIRT_D, null);
    c.restore();
    // 破布条
    poly(c, [[-8, 12], [-4, 17], [0, 12]], SHIRT, OUT, 2);
    poly(c, [[4, 12], [7, 16], [10, 12]], SHIRT, OUT, 2);
    // 领口
    poly(c, [[-8, -26], [0, -20], [9, -26]], '#8a8cb4', OUT, 2);
  }

  /* ---------- 手臂（前伸） ---------- */
  function arms(c, sway, lift = 0) {
    const y0 = -20 - lift;
    // 后臂
    limb(c, 2, y0 + 3, -18, y0 + 8 + sway, 7, SKIN_D, OUT);
    circ(c, -19, y0 + 8 + sway, 5, SKIN_D, OUT, 2.2);
    // 前臂
    limb(c, -1, y0, -26, y0 + 2 - sway, 7.5, SKIN, OUT);
    circ(c, -27, y0 + 2 - sway, 5.5, SKIN, OUT, 2.2);
    // 手指
    limb(c, -30, y0 + 1 - sway, -33, y0 - 2 - sway, 2.6, SKIN, OUT);
    limb(c, -30, y0 + 4 - sway, -33, y0 + 6 - sway, 2.6, SKIN, OUT);
  }

  /* ---------- 头 ---------- */
  function head(c, o = {}) {
    const { hurt = 0, jaw = 0, skin = SKIN, skinD = SKIN_D } = o;
    c.save();
    // 脖子
    limb(c, 2, -30, 2, -34, 7, skinD, OUT);
    // 头骨
    ell(c, 2, -46, 14.5, 15.5, skin, OUT, 2.6);
    // 颧骨阴影
    c.save(); c.globalAlpha = .25;
    ell(c, 8, -44, 7, 9, skinD);
    c.restore();
    // 乱发
    c.fillStyle = '#2e2418';
    [[-9, -58], [-3, -61], [4, -60], [11, -57], [15, -52]].forEach(([x, y], i) => {
      poly(c, [[x - 5, y + 6], [x + (i % 2 ? 4 : -3), y - 5], [x + 6, y + 7]], '#2e2418', OUT, 1.8);
    });
    // 眼窝（凹陷）
    c.save(); c.globalAlpha = .3;
    ell(c, -4, -48, 5.5, 5, '#4a5a3a');
    ell(c, 7, -48, 5, 4.5, '#4a5a3a');
    c.restore();
    // 眼睛（一大一小，呆滞）
    circ(c, -4.5, -48, 3.8, '#f2f2ea', OUT, 1.8);
    circ(c, 7, -48, 3.0, '#f2f2ea', OUT, 1.8);
    circ(c, -5.5, -47.5, 1.9, '#1a1008');
    circ(c, 6.2, -47.5, 1.6, '#1a1008');
    // 眉
    limb(c, -9, -53.5, -1, -52, 2.2, OUT);
    limb(c, 4, -52, 10, -53.5, 2, OUT);
    // 嘴（张开，带牙）
    c.save();
    c.translate(1, -38 + jaw);
    poly(c, [[-8, 0], [8, -1], [7, 5], [-7, 6]], '#3a1f1a', OUT, 2.2);
    poly(c, [[-6, 0], [-3.5, 0], [-4.5, 3.5]], '#e8e2c8', null);
    poly(c, [[0, -0.5], [2.5, -0.5], [1.5, 3]], '#e8e2c8', null);
    poly(c, [[4, -0.8], [6.5, -0.8], [5.5, 2.8]], '#e8e2c8', null);
    c.restore();
    c.restore();
  }

  /* ---------- 护具 ---------- */
  function coneHat(c) {
    c.save();
    c.translate(2, -58);
    poly(c, [[-12, 2], [12, 2], [3, -26]], '#f57c00', OUT, 2.4);
    poly(c, [[-8.5, -6], [8.5, -6], [6.5, -13], [-6.5, -13]], '#fff3e0', null);
    poly(c, [[-12, 2], [12, 2], [12, 5], [-12, 5]], '#e65100', OUT, 2.2);
    c.restore();
  }

  function bucketHat(c) {
    c.save();
    c.translate(2, -58);
    poly(c, [[-13, 3], [13, 3], [11, -20], [-11, -20]], '#9aa7b0', OUT, 2.4);
    ell(c, 0, -20, 11, 3.5, '#b0bcc4', OUT, 2.2);
    ell(c, 0, 3, 13, 3.5, '#7d8b94', OUT, 2.2);
    c.save(); c.globalAlpha = .35;
    poly(c, [[-7, 2], [-3, 2], [-5, -18], [-9, -18]], '#dbe4e9', null);
    c.restore();
    c.restore();
  }

  function footballGear(c) {
    // 头盔
    c.save();
    c.translate(2, -52);
    ell(c, 0, 0, 17, 16, '#c62828', OUT, 2.6);
    c.save();
    c.beginPath(); c.ellipse(0, 0, 17, 16, 0, -0.55, 0.55);
    c.lineTo(14, 6); c.lineTo(14, -8); c.closePath();
    c.fillStyle = '#e0e0e0'; c.fill();
    c.restore();
    // 面罩
    limb(c, -14, 2, 2, 6, 3.4, '#9e9e9e', OUT);
    limb(c, -13, 7, 3, 10, 3.4, '#9e9e9e', OUT);
    c.restore();
    // 护肩
    c.save(); c.translate(0, -24);
    ell(c, -9, 0, 11, 7.5, '#c62828', OUT, 2.4);
    ell(c, 9, 0, 11, 7.5, '#c62828', OUT, 2.4);
    c.restore();
  }

  function poleGear(c, t) {
    // 运动背心
    c.save(); c.globalAlpha = .9;
    poly(c, [[-8, -24], [9, -24], [10, 10], [-7, 10]], '#fdd835', OUT, 2.2);
    c.restore();
    // 头带
    c.save();
    limb(c, -13, -54, 16, -56, 5, '#e53935', OUT);
    c.restore();
    // 撑杆
    c.save();
    c.rotate(-0.35);
    limb(c, -6, 4, -6, 70, 4, '#c8a165', OUT);
    c.restore();
  }

  function newspaperGear(c, t) {
    c.save();
    c.translate(-24, -14);
    c.rotate(-0.1 + Math.sin(t * 8) * 0.02);
    rr(c, -16, -14, 32, 26, 2, '#f5f0e0', OUT, 2.2);
    c.save(); c.globalAlpha = .55;
    c.fillStyle = '#5a5a5a';
    for (let i = 0; i < 5; i++) c.fillRect(-12, -10 + i * 4.5, 24 - (i % 2) * 7, 2);
    c.restore();
    c.restore();
  }

  function screenDoorGear(c) {
    c.save();
    c.translate(-26, -12);
    rr(c, -18, -26, 30, 56, 3, '#8d6e63', OUT, 2.6);
    c.save();
    c.fillStyle = 'rgba(120,150,160,.5)';
    c.fillRect(-15, -23, 24, 50);
    c.restore();
    c.strokeStyle = '#5d4037'; c.lineWidth = 1.6;
    for (let i = 1; i < 5; i++) {
      c.beginPath(); c.moveTo(-15, -23 + i * 10); c.lineTo(9, -23 + i * 10); c.stroke();
    }
    for (let i = 1; i < 3; i++) {
      c.beginPath(); c.moveTo(-15 + i * 8, -23); c.lineTo(-15 + i * 8, 27); c.stroke();
    }
    c.restore();
  }

  function dancerGear(c, t) {
    // 爆炸头
    c.save();
    c.translate(2, -56);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      circ(c, Math.cos(a) * 11, Math.sin(a) * 9 - 2, 7.5, '#2e2418', OUT, 2);
    }
    circ(c, 0, -2, 12, '#2e2418', OUT, 2);
    c.restore();
    // 白西装
    c.save();
    poly(c, [[-9, -25], [10, -25], [11, 12], [-8, 12]], '#fafafa', OUT, 2.4);
    c.save(); c.globalAlpha = .3;
    poly(c, [[-9, -25], [-3, -25], [-4, 12], [-8, 12]], '#cfcfcf', null);
    c.restore();
    limb(c, 1, -24, 1, 10, 2, '#bdbdbd');
    c.restore();
  }

  function gargantuarGear(c, t) {
    // 电线杆
    c.save();
    c.rotate(-0.5 + Math.sin(t * 3) * 0.04);
    limb(c, 10, -6, 30, -74, 9, '#8d6e63', OUT);
    limb(c, 26, -60, 40, -62, 6, '#795548', OUT);
    c.restore();
    // 铁链/破布
    c.save(); c.globalAlpha = .8;
    poly(c, [[-12, -20], [14, -20], [13, 14], [-11, 14]], '#5d4037', OUT, 2.4);
    c.restore();
  }

  /* ---------- 主入口 ---------- */
  function draw(c, variant, t, o = {}) {
    const v = variant || 'basic';
    const walk = o.walk || 0;
    const hurt = o.hurt || 0;
    const scale = o.scale || 1;

    c.save();
    if (scale !== 1) c.scale(scale, scale);

    const bob = Math.abs(Math.sin(walk)) * 1.8;
    const swing = Math.sin(walk);
    const sway = Math.sin(walk) * 1.4;

    // 巨人：更深肤色
    const skin = v === 'gargantuar' ? '#8fae78' : SKIN;
    const skinD = v === 'gargantuar' ? '#6f8f58' : SKIN_D;

    c.translate(sway, -bob);

    legs(c, swing);
    torso(c);
    if (v === 'dancer') dancerGear(c, t);
    arms(c, Math.sin(walk + 1) * 1.6, v === 'gargantuar' ? 6 : 0);
    head(c, { hurt, jaw: Math.abs(Math.sin(walk)) * 2.5, skin, skinD });

    if (v === 'cone' && !o.armLost) coneHat(c);
    if (v === 'bucket' && !o.armLost) bucketHat(c);
    if (v === 'football') footballGear(c);
    if (v === 'pole') poleGear(c, t);
    if (v === 'newspaper') newspaperGear(c, t);
    if (v === 'screen') screenDoorGear(c);
    if (v === 'gargantuar') gargantuarGear(c, t);

    c.restore();
  }

  /** 死亡：倒地 */
  function drawDying(c, variant, t, o = {}) {
    const k = o.dying != null ? o.dying : 0;   // 0..1
    c.save();
    c.globalAlpha = 1 - k;
    c.translate(0, k * 10);
    c.rotate(-k * 1.35);
    draw(c, variant, t, { ...o, walk: 0, scale: o.scale });
    c.restore();
  }

  return { draw, drawDying };
})();
