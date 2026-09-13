/* ===========================================================
   game.js — 核心逻辑：状态机、波次调度、交互、主循环
   =========================================================== */

const STATE = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', RESULT: 'result' };

class Game {
  constructor() {
    this.state = STATE.MENU;
    this.level = null;
    this.levelIndex = 0;

    this.plants = [];
    this.zombies = [];
    this.projectiles = [];
    this.suns = [];
    this.particles = [];
    this.texts = [];
    this.explosions = [];
    this.mowers = Array.from({ length: CFG.ROWS }, (_, row) => ({
      row, x: CFG.HUD_W - 26, used: false, active: false, spin: 0,
    }));

    this.grid = [];
    this.resetGrid();

    this.sun = 50;
    this.selected = null;      // 选中的植物 id
    this.shovelMode = false;
    this.hover = null;

    this.cooldowns = {};       // 植物 id → 冷却结束时间
    this.waveIndex = 0;
    this.waveTimer = 0;
    this.endlessN = 0;
    this.nextWaveAt = 0;
    this.gameTime = 0;

    this.stats = { killed: 0, planted: 0, sunCollected: 0, score: 0, waves: 0, leaked: 0 };
    this.waveWarnUntil = 0;

    this.lastFrame = 0;
    this.acc = 0;
    this.rafId = null;
    this.skySunTimer = 0;
    this.shakeUntil = 0;
    this.shakeMag = 0;

    this.onStateChange = () => {};
    this.onFinish = () => {};
  }

  resetGrid() {
    this.grid = Array.from({ length: CFG.ROWS }, () => Array(CFG.COLS).fill(null));
  }

  /* ================= 关卡启动 ================= */
  startLevel(idx) {
    this.levelIndex = idx;
    this.level = LEVELS[idx];

    this.resetGrid();
    this.plants = [];
    this.zombies = [];
    this.projectiles = [];
    this.suns = [];
    this.particles = [];
    this.texts = [];
    this.explosions = [];
    this.mowers = Array.from({ length: CFG.ROWS }, (_, row) => ({
      row, x: CFG.HUD_W - 26, used: false, active: false, spin: 0,
    }));

    this.sun = this.level.sunStart ?? CFG.SUN_START;
    this.selected = null;
    this.shovelMode = false;
    this.cooldowns = {};
    this.waveIndex = 0;
    this.waveTimer = 0;
    this.endlessN = 0;
    this.gameTime = 0;
    this.stats = { killed: 0, planted: 0, sunCollected: 0, score: 0, waves: 0, leaked: 0 };
    this.waveWarnUntil = 0;
    this.skySunTimer = performance.now() + 3500;
    this.shakeUntil = 0;

    // 首个波次时间
    if (this.level.endless) {
      this.nextWaveAt = performance.now() + 10000;
    } else {
      this.nextWaveAt = performance.now() + (this.level.waves[0]?.at ?? 12000);
    }

    this.state = STATE.PLAYING;
    this.lastFrame = performance.now();
    this.onStateChange();
  }

  /* ================= 主循环 ================= */
  loop(now) {
    this.rafId = requestAnimationFrame(t => this.loop(t));

    let dt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    if (dt > 0.05) dt = 0.05;      // 防止切标签后瞬移
    if (dt <= 0) return;

    if (this.state === STATE.PLAYING) {
      this.update(dt, now);
    } else if (this.state === STATE.PAUSED) {
      // 暂停时只更新粒子淡出
    }
    Renderer.draw(this);
  }

  update(dt, now) {
    this.gameTime += dt;

    this.updateWaves(now);
    this.updateMowers(dt);

    for (const p of this.plants) p.update(dt, this);
    for (const z of this.zombies) z.update(dt, this);
    for (const pr of this.projectiles) pr.update(dt, this);
    for (const s of this.suns) s.update(dt, this);
    for (const pa of this.particles) pa.update(dt);
    for (const t of this.texts) t.update(dt);

    this.checkMines();
    this.updateSkySun(now);

    // 清理
    this.plants = this.plants.filter(p => {
      if (p.dead) {
        if (this.grid[p.row] && this.grid[p.row][p.col] === p) this.grid[p.row][p.col] = null;
        this.puff(p.x, p.y, '#a5d6a7', 8);
        return false;
      }
      return true;
    });
    this.zombies = this.zombies.filter(z => {
      if (z.dead && z.dying >= 1) {
        if (!z.reachedHouse && z.hp <= 0) this.onZombieKilled(z);
        return false;
      }
      return true;
    });
    this.projectiles = this.projectiles.filter(p => !p.dead);
    this.suns = this.suns.filter(s => !s.dead);
    this.particles = this.particles.filter(p => !p.dead);
    this.texts = this.texts.filter(t => !t.dead);
    this.explosions = this.explosions.filter(e => now - e.start < e.duration);

    // 所有波次已放出且场上无僵尸 → 胜利（每帧检查，而非只在最后一波生成时检查）
    if (this.level && !this.level.endless &&
        this.waveIndex >= this.level.waves.length &&
        !this.zombies.some(z => !z.dead)) {
      this.finish(true);
    }

    this.syncUI();
  }

  /* ================= 小推车（每行保底防线） ================= */
  mowerFor(row) {
    return this.mowers.find(m => m.row === row && !m.used);
  }

  triggerMower(mower) {
    if (mower.used) return;
    mower.used = true;
    mower.active = true;
    mower.x = CFG.HUD_W - 26;
    this.toast('小推车启动！');
    Sound.shovel();
    this.shake(300, 8);
  }

  updateMowers(dt) {
    for (const m of this.mowers) {
      if (!m.active) continue;
      m.spin += dt * 30;
      m.x += 560 * dt;
      for (const z of this.zombies) {
        if (z.dead || z.row !== m.row) continue;
        if (Math.abs(z.x - m.x) < 46) {
          z.damage(999999);
          this.showText(z.x, z.y - 30, '💥', '#ffb300', 22);
          this.puff(z.x, z.y, '#ffb300', 8);
        }
      }
      if (m.x > CFG.W + 40) m.active = false;
    }
  }

  /* ================= 波次调度 ================= */
  updateWaves(now) {
    if (this.level.endless) {
      if (now >= this.nextWaveAt) {
        this.endlessN++;
        const w = endlessWave(this.endlessN);
        if (w.big) this.warnWave();
        this.spawnWave(w.types);
        this.stats.waves++;
        this.nextWaveAt = now + w.interval;
        this.showText(CFG.W / 2, 60, `第 ${this.endlessN} 波`, '#ffd54f', 22);
      }
      return;
    }

    const waves = this.level.waves;
    if (this.waveIndex >= waves.length) return;

    const wave = waves[this.waveIndex];
    if (now >= this.nextWaveAt) {
      if (wave.big) this.warnWave();
      this.spawnWave(wave.types);
      this.stats.waves++;
      this.waveIndex++;
      if (this.waveIndex < waves.length) {
        this.nextWaveAt = now + (waves[this.waveIndex].at - wave.at);
      } else {
        this.nextWaveAt = Infinity;
        this.checkWin();
      }
    }
  }

  warnWave() {
    this.waveWarnUntil = performance.now() + 2600;
    Sound.waveWarn();
  }

  spawnWave(typesExpr) {
    const types = parseTypes(typesExpr);
    types.forEach((id, i) => {
      const row = Math.floor(Math.random() * CFG.ROWS);
      const z = new Zombie(id, row, i * 26 + Math.random() * 30);
      this.zombies.push(z);
    });
  }

  checkWin() {
    if (this.level.endless) return;
    const wavesLeft = this.waveIndex < this.level.waves.length;
    if (wavesLeft) return;
    // 所有波次已放出，等场上僵尸清空
    const alive = this.zombies.some(z => !z.dead && !z.reachedHouse);
    if (!alive) this.finish(true);
  }

  /* ================= 阳光 ================= */
  updateSkySun(now) {
    if (!this.level.skySun) return;
    if (now < this.skySunTimer) return;
    this.skySunTimer = now + CFG.SKY_SUN_MIN + Math.random() * (CFG.SKY_SUN_MAX - CFG.SKY_SUN_MIN);

    const x = CFG.HUD_W + 40 + Math.random() * (CFG.COLS * CFG.CELL_W - 80);
    const targetY = CFG.TOP_OFFSET + 20 + Math.random() * (CFG.ROWS * CFG.CELL_H - 60);
    this.suns.push(new Sun(x, CFG.TOP_OFFSET - 30, targetY, 'sky'));
  }

  spawnSun(x, y, source) {
    const targetY = Math.min(CFG.H - 40, Math.max(CFG.TOP_OFFSET + 20, y + 10));
    const s = new Sun(x, y, targetY, source);
    s.falling = false;
    this.suns.push(s);
  }

  spawnProjectile(plant, x, y) {
    this.projectiles.push(new Projectile(plant, x, y));
  }

  collectSun(s) {
    s.collected = true;
    this.sun = Math.min(CFG.SUNBANK_MAX, this.sun + s.value);
    this.stats.sunCollected += s.value;
    this.stats.score += 2;
    Sound.sunCollect();
    this.bumpSunBox();
  }

  bumpSunBox() {
    const el = document.getElementById('sun-count');
    if (!el) return;
    const box = document.getElementById('sun-box');
    box.classList.remove('bump');
    void box.offsetWidth;
    box.classList.add('bump');
  }

  /* ================= 种植 / 铲除 ================= */
  plantAt(x, row) {
    // 找到覆盖 x 的植物（僵尸从右往左，取最靠近的）
    let best = null;
    for (const p of this.plants) {
      if (p.row !== row) continue;
      if (x >= p.x - 30 && x <= p.x + 30) {
        if (!best || p.x > best.x) best = p;
      }
    }
    return best;
  }

  tryPlant(col, row) {
    if (this.state !== STATE.PLAYING) return;
    const def = PLANTS[this.selected];
    if (!def) return;

    if (this.grid[row][col]) { this.toast('这里已经有植物了'); Sound.error(); return; }
    if (this.sun < def.cost) { this.toast('阳光不足'); Sound.error(); return; }
    const cdLeft = (this.cooldowns[def.id] || 0) - performance.now();
    if (cdLeft > 0) { this.toast('该植物冷却中'); Sound.error(); return; }

    const p = new Plant(def.id, col, row);
    this.plants.push(p);
    this.grid[row][col] = p;
    this.sun -= def.cost;
    this.cooldowns[def.id] = performance.now() + def.cd;
    this.stats.planted++;
    Sound.plant();
    this.puff(p.x, p.y + 24, '#8d6e63', 6);

    // 一次性植物立即触发
    if (p.isInstant) this.triggerInstant(p);

    // 选中态保留（方便连续种植），但若阳光不够则取消
    if (this.sun < def.cost) this.selected = null;
    this.syncUI();
  }

  tryShovel(col, row) {
    const p = this.grid[row][col];
    if (!p) { this.toast('这里没有植物'); Sound.error(); return; }
    this.removePlant(p);
    this.shovelMode = false;
    this.toast('已移除植物');
    Sound.shovel();
  }

  removePlant(p) {
    p.dead = true;
    if (this.grid[p.row] && this.grid[p.row][p.col] === p) this.grid[p.row][p.col] = null;
    this.plants = this.plants.filter(x => x !== p);
    this.puff(p.x, p.y, '#a5d6a7', 10);
  }

  /* ================= 一次性植物 ================= */
  triggerInstant(p) {
    const now = performance.now();
    if (p.def.tags.includes('explode')) {
      const r = p.def.blastRadius * CFG.CELL_W;
      this.explosions.push({ type: 'circle', x: p.x, y: p.y, radius: r, start: now, duration: 620 });
      this.zombies.forEach(z => {
        if (z.dead) return;
        if (Math.hypot(z.x - p.x, z.y - p.y) < r + 20) {
          z.damage(p.def.blastDamage);
          this.showText(z.x, z.y - 30, '💥', '#ff7043', 22);
        }
      });
      this.shake(500, 12);
      Sound.explode();
      setTimeout(() => this.removePlant(p), 60);
    } else if (p.def.tags.includes('laneBurn')) {
      this.explosions.push({
        type: 'lane', y: Grid.cellCY(p.row), start: now, duration: 900,
      });
      this.zombies.forEach(z => {
        if (z.dead || z.row !== p.row) return;
        z.damage(p.def.burnDamage);
      });
      this.shake(420, 8);
      Sound.explode();
      setTimeout(() => this.removePlant(p), 60);
    }
  }

  /* ================= 土豆雷 ================= */
  checkMines() {
    for (const p of this.plants) {
      if (!p.isMine) continue;
      if (!p.armed && now_() >= p.armedAt) {
        p.armed = true;
        this.puff(p.x, p.y, '#ffd54f', 6);
      }
      if (!p.armed) continue;

      const hit = this.zombies.find(z =>
        !z.dead && z.row === p.row && Math.abs(z.x - p.x) < 40);
      if (hit) {
        this.explosions.push({
          type: 'circle', x: p.x, y: p.y, radius: CFG.CELL_W * 1.2,
          start: now_(), duration: 600,
        });
        this.zombies.forEach(z => {
          if (!z.dead && Math.hypot(z.x - p.x, z.y - p.y) < CFG.CELL_W * 1.3) {
            z.damage(p.def.blastDamage);
          }
        });
        this.shake(360, 7);
        Sound.explode();
        this.removePlant(p);
      }
    }
  }

  /* ================= 大嘴花 ================= */
  doChomp(plant, zombie) {
    zombie.damage(999999);
    plant.chewingUntil = performance.now() + plant.def.chewTime;
    this.showText(plant.x, plant.y - 34, '😋', '#aed581', 22);
    this.puff(plant.x, plant.y, '#c5e1a5', 8);
    Sound.chomp();
    this.stats.score += 3;
  }

  /* ================= 僵尸事件 ================= */
  onZombieKilled(z) {
    this.stats.killed++;
    this.stats.score += z.def.score;
    this.puff(z.x, z.y, '#7cb342', 10);
    Sound.zombieDie();
    if (z.def.id === 'gargantuar') this.shake(400, 10);
  }

  onZombieReachedHouse(z) {
    this.stats.leaked = (this.stats.leaked || 0) + 1;
    this.puff(z.x, z.y, '#e53935', 14);
    this.shake(600, 16);
    Sound.lose();
    this.finish(false);
  }

  /* ================= 特效辅助 ================= */
  puff(x, y, color, n = 6) {
    for (let i = 0; i < n; i++) {
      this.particles.push(new Particle(x, y, color, {
        vx: (Math.random() * 2 - 1) * 110,
        vy: (Math.random() * -1.2 - 0.2) * 80,
        size: 2 + Math.random() * 3,
        decay: 1.8 + Math.random(),
      }));
    }
  }

  showText(x, y, text, color, size) {
    this.texts.push(new FloatText(x, y, text, color, size));
  }

  shake(duration, magnitude) {
    this.shakeUntil = performance.now() + duration;
    this.shakeMag = magnitude;
  }

  toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 1400);
  }

  /* ================= 结算 ================= */
  finish(win) {
    if (this.state === STATE.RESULT) return;
    this.state = STATE.RESULT;

    const score = this.stats.score + (win ? 200 + this.level.id * 100 : 0);
    this.stats.score = score;
    this.saveProgress(win, score);

    if (win) Sound.win(); else Sound.lose();

    this.onFinish(win, score);
    this.onStateChange();
  }

  saveProgress(win, score) {
    try {
      const raw = localStorage.getItem('pvz-web-progress');
      const data = raw ? JSON.parse(raw) : { unlocked: 1, best: 0, stars: {} };
      data.best = Math.max(data.best || 0, score);
      if (win) {
        const next = this.level.id + 1;
        data.unlocked = Math.max(data.unlocked || 1, Math.min(next, LEVELS.length));
        data.stars = data.stars || {};
        data.stars[this.level.id] = Math.max(data.stars[this.level.id] || 0, this.computeStars());
      }
      localStorage.setItem('pvz-web-progress', JSON.stringify(data));
    } catch (e) { /* 隐私模式下忽略 */ }
  }

  computeStars() {
    const lost = this.stats.leaked || 0;
    if (lost === 0) return 3;
    if (lost <= 1) return 2;
    return 1;
  }

  static loadProgress() {
    try {
      const raw = localStorage.getItem('pvz-web-progress');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { unlocked: 1, best: 0, stars: {} };
  }

  /* ================= 输入 ================= */
  selectPlant(id) {
    if (this.shovelMode) this.shovelMode = false;
    if (this.selected === id) { this.selected = null; }
    else {
      const cdLeft = (this.cooldowns[id] || 0) - performance.now();
      if (cdLeft > 0) { this.toast('该植物冷却中'); Sound.error(); return; }
      if (this.sun < PLANTS[id].cost) { this.toast('阳光不足'); Sound.error(); return; }
      this.selected = id;
      Sound.click();
    }
    this.syncUI();
  }

  toggleShovel() {
    this.shovelMode = !this.shovelMode;
    if (this.shovelMode) this.selected = null;
    Sound.click();
    this.syncUI();
  }

  onPointerMove(x, y) {
    this.hover = Grid.pick(x, y);
  }

  onPointerDown(x, y) {
    if (this.state !== STATE.PLAYING) return;

    // 先判定是否点中阳光（优先级最高）
    for (let i = this.suns.length - 1; i >= 0; i--) {
      const s = this.suns[i];
      if (!s.collected && s.hitTest(x, y)) { this.collectSun(s); return; }
    }

    const cell = Grid.pick(x, y);
    if (!cell) return;

    if (this.shovelMode) { this.tryShovel(cell.col, cell.row); this.syncUI(); return; }
    if (this.selected) { this.tryPlant(cell.col, cell.row); return; }
  }

  /* ================= UI 同步 ================= */
  syncUI() {
    const sunEl = document.getElementById('sun-count');
    if (sunEl) sunEl.textContent = this.sun;

    // 种子卡状态
    document.querySelectorAll('.seed').forEach(el => {
      const id = el.dataset.plant;
      const def = PLANTS[id];
      const cdLeft = Math.max(0, (this.cooldowns[id] || 0) - performance.now());
      const mask = el.querySelector('.cd-mask');
      if (mask) {
        const ratio = def.cd > 0 ? cdLeft / def.cd : 0;
        mask.style.transform = `scaleY(${ratio})`;
      }
      const canAfford = this.sun >= def.cost;
      el.classList.toggle('disabled', cdLeft > 0 || !canAfford);
      el.classList.toggle('selected', this.selected === id);
    });

    const shovelBtn = document.getElementById('btn-shovel');
    if (shovelBtn) shovelBtn.classList.toggle('active', this.shovelMode);

    // 关卡进度
    const badge = document.getElementById('level-badge');
    if (badge) {
      badge.textContent = this.level
        ? (this.level.endless ? `无尽 · 第 ${this.endlessN} 波` : `第 ${this.level.id} 关 · ${this.level.name}`)
        : '';
    }
    const bar = document.getElementById('progress-bar');
    if (bar) {
      let pct = 0;
      if (this.level && !this.level.endless) {
        pct = (this.waveIndex / this.level.waves.length) * 100;
      } else if (this.level && this.level.endless) {
        pct = ((this.endlessN % 10) / 10) * 100;
      }
      bar.style.width = pct + '%';
    }
    const flags = document.getElementById('progress-flags');
    if (flags && this.level && !this.level.endless) {
      if (flags.children.length !== this.level.waves.length) {
        flags.innerHTML = this.level.waves
          .map(() => '<div class="flag"></div>').join('');
      }
      [...flags.children].forEach((f, i) => f.classList.toggle('done', i < this.waveIndex));
    }
  }

  /* ================= 渲染入口（含震屏） ================= */
  get shakeOffset() {
    const now = performance.now();
    if (now > this.shakeUntil) return { x: 0, y: 0 };
    const k = (this.shakeUntil - now) / 500;
    return {
      x: (Math.random() * 2 - 1) * this.shakeMag * k,
      y: (Math.random() * 2 - 1) * this.shakeMag * k,
    };
  }

  static now() { return performance.now(); }
}

function now_() { return performance.now(); }
