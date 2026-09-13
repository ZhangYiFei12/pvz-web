/* ===========================================================
   entities.js — 植物 / 僵尸 / 子弹 / 阳光 / 粒子
   =========================================================== */

let _uid = 1;
const nextId = () => _uid++;

/* ------------------------------------------------------------------
   网格坐标工具
   ------------------------------------------------------------------ */
const Grid = {
  colX(c) { return CFG.HUD_W + c * CFG.CELL_W; },
  rowY(r) { return CFG.TOP_OFFSET + r * CFG.CELL_H; },
  cellCX(c) { return this.colX(c) + CFG.CELL_W / 2; },
  cellCY(r) { return this.rowY(r) + CFG.CELL_H / 2; },
  /** 画布坐标 → 格子；不在草坪内返回 null */
  pick(x, y) {
    const c = Math.floor((x - CFG.HUD_W) / CFG.CELL_W);
    const r = Math.floor((y - CFG.TOP_OFFSET) / CFG.CELL_H);
    if (c < 0 || c >= CFG.COLS || r < 0 || r >= CFG.ROWS) return null;
    return { col: c, row: r };
  },
  /** 僵尸 x 位置对应的格子列 */
  colAt(x) { return Math.floor((x - CFG.HUD_W) / CFG.CELL_W); },
};

/* ------------------------------------------------------------------
   Plant — 植物
   ------------------------------------------------------------------ */
class Plant {
  constructor(defId, col, row) {
    this.id = nextId();
    this.def = PLANTS[defId];
    this.defId = defId;
    this.col = col;
    this.row = row;
    this.x = Grid.cellCX(col);
    this.y = Grid.cellCY(row);
    this.maxHp = this.def.hp;
    this.hp = this.def.hp;
    this.dead = false;

    const now = performance.now();
    this.plantedAt = now;

    // 攻击计时
    this.lastShot = now + 300;
    this.shotQueue = 0;

    // 产阳光计时
    this.lastProduce = now + 2000 + Math.random() * 1500;

    // 一次性植物
    this.triggered = false;

    // 土豆雷
    this.armedAt = now + (this.def.armTime || 0);
    this.armed = !this.def.armTime;

    // 大嘴花咀嚼
    this.chewingUntil = 0;

    // 视觉
    this.scale = 0;
    this.hurtFlash = 0;
    this.bob = Math.random() * Math.PI * 2;
  }

  get isProducer() { return !!this.def.produce; }
  get isShooter()  { return this.def.tags.includes('shooter'); }
  get isInstant()  { return this.def.tags.includes('instant'); }
  get isBlocker()  { return this.def.tags.includes('blocker'); }
  get isMine()     { return this.def.tags.includes('mine'); }
  get isChomper()  { return this.def.tags.includes('chomper'); }

  update(dt, game) {
    const now = performance.now();
    this.scale = Math.min(1, this.scale + dt * 5);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 4);

    if (this.isInstant) return;   // 一次性由 game 处理
    if (this.isChomper) {
      if (now < this.chewingUntil) return;
      const target = game.zombies.find(z =>
        !z.dead && z.row === this.row && !z.vaulting &&
        z.x > this.x - 10 && z.x < this.x + CFG.CELL_W * 1.1);
      if (target) { game.doChomp(this, target); }
      return;
    }
    if (this.isMine) return;      // 引爆由 game 检测

    if (this.isProducer) {
      const interval = this.def.produce;
      if (now - this.lastProduce >= interval) {
        this.lastProduce = now;
        game.spawnSun(this.x + (Math.random() * 20 - 10), this.y - 8, 'plant');
        game.puff(this.x, this.y - 10, '#ffe066', 6);
      }
    }

    if (this.isShooter) {
      const hasTarget = game.zombies.some(z =>
        !z.dead && z.row === this.row && z.x > this.x - 20);
      if (hasTarget && now - this.lastShot >= this.def.rate) {
        this.lastShot = now;
        this.shotQueue = (this.def.shots || 1) - 1;
        this.fire(game);
      }
      // 双发射手第二发
      if (this.shotQueue > 0 && now - this.lastShot >= 180) {
        this.shotQueue--;
        this.fire(game);
      }
      if (!hasTarget) this.shotQueue = 0;
    }
  }

  fire(game) {
    game.spawnProjectile(this, this.x + 22, this.y - 14);
    if (this.def.projectile === 'snow') Sound.snowShoot(); else Sound.shoot();
  }

  damage(amount) {
    this.hp -= amount;
    this.hurtFlash = 1;
    if (this.hp <= 0) this.dead = true;
  }

  /** 被吃掉：逐次扣血 */
  chew(amount) { this.damage(amount); }
}

/* ------------------------------------------------------------------
   Zombie — 僵尸
   ------------------------------------------------------------------ */
class Zombie {
  constructor(defId, row, xOffset = 0) {
    this.id = nextId();
    this.def = ZOMBIES[defId];
    this.defId = defId;
    this.row = row;
    this.maxHp = this.def.hp;
    this.hp = this.def.hp;
    this.x = CFG.W + 30 + xOffset + Math.random() * 20;
    this.y = Grid.cellCY(row) + 6;
    this.speed = this.def.speed;
    this.dead = false;
    this.reachedHouse = false;

    this.slowUntil = 0;
    this.frozen = 0;                 // 0..1 视觉
    this.attacking = false;
    this.lastAttack = 0;

    this.vaulting = false;
    this.vaultT = 0;
    this.hasVaulted = false;

    this.walkPhase = Math.random() * Math.PI * 2;
    this.hurtFlash = 0;
    this.armLost = false;            // 视效：被打掉护具
    this.helmetHp = this.def.helmet ? this.maxHp * 0.5 : 0;
    this.dying = 0;                  // 死亡动画进度
    this.smashCooldown = 0;
  }

  get isSlowed() { return performance.now() < this.slowUntil; }

  applySlow(ms = 4000) {
    this.slowUntil = Math.max(this.slowUntil, performance.now() + ms);
  }

  update(dt, game) {
    const now = performance.now();

    if (this.dead) { this.dying = Math.min(1, this.dying + dt * 2.6); return; }

    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 4);
    this.frozen = this.isSlowed ? Math.min(1, this.frozen + dt * 4) : Math.max(0, this.frozen - dt * 2);

    // 撑杆跳
    if (this.vaulting) {
      this.vaultT += dt;
      this.x -= 130 * dt;
      this.y = Grid.cellCY(this.row) + 6 - Math.sin(Math.min(1, this.vaultT / 0.7) * Math.PI) * 58;
      if (this.vaultT >= 0.7) { this.vaulting = false; this.y = Grid.cellCY(this.row) + 6; }
      return;
    }

    const slowFactor = this.isSlowed ? 0.45 : 1;
    this.walkPhase += dt * 7 * slowFactor;

    // 找前方植物
    const target = game.plantAt(this.x - 16, this.row);

    if (target) {
      // 撑杆僵尸：跳过遇到的第一株植物
      if (this.def.canVault && !this.hasVaulted) {
        this.vaulting = true;
        this.hasVaulted = true;
        this.vaultT = 0;
        return;
      }

      this.attacking = true;
      if (now - this.lastAttack >= this.def.attackRate) {
        this.lastAttack = now;
        if (this.def.smash) {
          target.damage(target.maxHp);      // 巨人：一击摧毁
          game.puff(target.x, target.y, '#8d6e63', 10);
          Sound.explode();
        } else {
          target.chew(this.def.damage);
          game.puff(target.x + 12, target.y, '#9ccc65', 3);
          Sound.hit();
        }
      }
      return;
    }

    this.attacking = false;

    // 前进
    this.x -= this.speed * slowFactor * dt;

    // 到达房屋：先看该行是否还有小推车
    if (this.x < CFG.HUD_W - 6) {
      const mower = game.mowerFor(this.row);
      if (mower) {
        game.triggerMower(mower);
        this.x = Math.max(this.x, CFG.HUD_W + 2);
      } else {
        this.reachedHouse = true;
        this.dead = true;
        game.onZombieReachedHouse(this);
      }
    }
  }

  damage(amount) {
    if (this.dead) return;
    this.hp -= amount;
    this.hurtFlash = 1;
    if (this.helmetHp > 0) {
      this.helmetHp -= amount;
      if (this.helmetHp <= 0) this.armLost = true;
    }
    if (this.hp <= 0) {
      this.dead = true;
      this.dying = 0;
    }
  }

  get isDying() { return this.dead && this.dying < 1; }
}

/* ------------------------------------------------------------------
   Projectile — 子弹
   ------------------------------------------------------------------ */
class Projectile {
  constructor(plant, x, y) {
    this.id = nextId();
    this.row = plant.row;
    this.x = x;
    this.y = y;
    this.speed = 460;
    this.damage = plant.def.damage;
    this.type = plant.def.projectile;   // 'pea' | 'snow'
    this.dead = false;
    this.trail = [];
  }

  update(dt, game) {
    this.x += this.speed * dt;
    this.trail.push({ x: this.x, y: this.y, life: 1 });
    if (this.trail.length > 6) this.trail.shift();
    this.trail.forEach(t => t.life -= dt * 5);

    if (this.x > CFG.W + 20) { this.dead = true; return; }

    const hit = game.zombies.find(z =>
      !z.dead && z.row === this.row && !z.vaulting &&
      Math.abs(z.x - this.x) < 26);
    if (hit) {
      hit.damage(this.damage);
      if (this.type === 'snow') hit.applySlow(5000);
      game.puff(this.x, this.y, this.type === 'snow' ? '#b3e5fc' : '#8bc34a', 4);
      Sound.zombieHit();
      this.dead = true;
    }
  }
}

/* ------------------------------------------------------------------
   Sun — 阳光
   ------------------------------------------------------------------ */
class Sun {
  constructor(x, y, targetY, source) {
    this.id = nextId();
    this.x = x;
    this.y = y;
    this.targetY = targetY;
    this.value = 25;
    this.dead = false;
    this.source = source || 'sky';
    this.life = 1;
    this.collected = false;
    this.collectT = 0;
    this.fromX = x; this.fromY = y;
    this.phase = Math.random() * Math.PI * 2;
    this.falling = source === 'sky';
    this.vy = 0;
    this.bob = Math.random() * Math.PI * 2;
  }

  update(dt, game) {
    const now = performance.now();

    if (this.collected) {
      this.collectT += dt * 2.4;
      // 飞向阳光计数器
      const tx = 40, ty = 28;
      this.x += (tx - this.x) * Math.min(1, dt * 6);
      this.y += (ty - this.y) * Math.min(1, dt * 6);
      this.life = Math.max(0, 1 - this.collectT);
      if (this.collectT >= 1) this.dead = true;
      return;
    }

    if (this.falling) {
      this.vy = Math.min(60, this.vy + 26 * dt);
      this.y += this.vy * dt;
      if (this.y >= this.targetY) { this.y = this.targetY; this.falling = false; }
    } else {
      this.bob += dt * 3;
      this.y = this.targetY + Math.sin(this.bob) * 3;
    }

    this.life -= dt * 0.028;     // 约 35 秒消失
    if (this.life <= 0) this.dead = true;
  }

  hitTest(x, y) {
    return Math.hypot(x - this.x, y - this.y) < 30;
  }
}

/* ------------------------------------------------------------------
   Particle — 粒子特效
   ------------------------------------------------------------------ */
class Particle {
  constructor(x, y, color, opts = {}) {
    this.x = x; this.y = y;
    this.vx = opts.vx ?? (Math.random() * 2 - 1) * 90;
    this.vy = opts.vy ?? (Math.random() * -1 - 0.3) * 90;
    this.life = 1;
    this.decay = opts.decay ?? (1.6 + Math.random());
    this.size = opts.size ?? (2 + Math.random() * 3);
    this.color = color;
    this.gravity = opts.gravity ?? 180;
    this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += this.gravity * dt;
    this.life -= this.decay * dt;
    if (this.life <= 0) this.dead = true;
  }
}

/* 飘字（伤害数字 / 提示） */
class FloatText {
  constructor(x, y, text, color = '#fff', size = 16) {
    this.x = x; this.y = y; this.text = text; this.color = color;
    this.size = size; this.life = 1; this.dead = false;
  }
  update(dt) {
    this.y -= 34 * dt;
    this.life -= dt * 0.9;
    if (this.life <= 0) this.dead = true;
  }
}
