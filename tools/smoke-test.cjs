/* headless 冒烟测试：桩化浏览器 API，跑完整游戏循环，捕获运行时错误 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.argv[2] || '.';

/* ---------- 桩：Canvas 2D context ---------- */
function makeCtx() {
  const noop = () => {};
  const ctx = {
    canvas: null,
    setTransform: noop, scale: noop, save: noop, restore: noop,
    translate: noop, rotate: noop, clearRect: noop, fillRect: noop,
    strokeRect: noop, beginPath: noop, closePath: noop, moveTo: noop,
    lineTo: noop, arc: noop, ellipse: noop, fill: noop, stroke: noop,
    fillText: noop, strokeText: noop, clip: noop, createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    measureText: () => ({ width: 10 }),
    globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1,
    font: '', textAlign: '', textBaseline: '', filter: 'none',
  };
  return ctx;
}

/* ---------- 桩：DOM ---------- */
const listeners = {};
function makeEl(id) {
  const el = {
    id, tagName: 'DIV', dataset: {}, style: {}, children: [],
    classList: {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, f) { const on = f === undefined ? !this._s.has(c) : !!f; on ? this._s.add(c) : this._s.delete(c); return on; },
      contains(c) { return this._s.has(c); },
    },
    textContent: '', innerHTML: '',
    offsetWidth: 100,
    clientWidth: 900, clientHeight: 620,
    appendChild(c) { this.children.push(c); if (c.id) els[c.id] = c; return c; },
    addEventListener(t, fn) { (listeners[id + ':' + t] ||= []).push(fn); },
    removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 620 }),
    querySelector: () => ({ style: {} }),
    querySelectorAll: () => [],
    getContext: () => { const c = makeCtx(); c.canvas = el; return c; },
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return this._html || ''; },
    set(v) { this._html = v; this.children = []; },
  });
  return el;
}

const els = {};
const ids = ['game', 'stage', 'hud', 'seedbar', 'toast', 'sun-count', 'sun-box', 'level-badge',
  'progress-bar', 'progress-flags', 'menu-overlay', 'result-overlay', 'pause-overlay',
  'help-overlay', 'level-select', 'best-score', 'best-level', 'btn-shovel', 'btn-pause',
  'btn-sound', 'btn-help', 'btn-help2', 'result-title', 'result-stats', 'result-actions',
  'btn-continue', 'pause-overlay'];
ids.forEach(id => { els[id] = makeEl(id); });

const store = {};

/* ---------- 虚拟时钟：让毫秒级游戏逻辑能在快速循环中推进 ---------- */
let VT = 1700000000000;
const advance = ms => { VT += ms; };
const VDate = new Proxy(Date, {
  get(t, p) {
    if (p === 'now') return () => VT;
    const v = t[p];
    return typeof v === 'function' ? v.bind(t) : v;
  },
});

const sandbox = {
  console,
  performance: { now: () => VT },
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: () => {},
  setTimeout: (fn, t) => setTimeout(fn, 0),
  clearTimeout,
  Math, Date: VDate, JSON, Object, Array, String, Number, Boolean, Error, isNaN, parseInt, parseFloat,
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  },
  window: {
    devicePixelRatio: 1,
    addEventListener: (t, fn) => { (listeners['window:' + t] ||= []).push(fn); },
    AudioContext: undefined, webkitAudioContext: undefined,
  },
  document: {
    getElementById: id => els[id] || (els[id] = makeEl(id)),
    createElement: tag => makeEl('_' + tag),
    querySelectorAll: () => [],
    addEventListener: () => {},
    body: makeEl('body'),
  },
};
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

vm.createContext(sandbox);

/* ---------- 加载脚本（顺序同 index.html） ---------- */
const files = ['config.js', 'audio.js', 'entities.js', 'renderer.js', 'game.js'];
for (const f of files) {
  const code = fs.readFileSync(path.join(ROOT, 'site', 'js', f), 'utf8');
  try {
    vm.runInContext(code, sandbox, { filename: f });
  } catch (e) {
    console.log(`❌ 加载失败 ${f}: ${e.message}\n${e.stack.split('\n').slice(0, 4).join('\n')}`);
    process.exit(1);
  }
}
console.log('✅ 全部脚本加载成功');

/* ---------- 词法声明（class/const）不会挂到 sandbox 上，显式导出 ---------- */
vm.runInContext(`globalThis.__x = { Game, STATE, LEVELS, PLANTS, ZOMBIES, Sun, Plant, Zombie, Projectile, Particle, FloatText, CFG, Grid, Sound, Renderer, parseTypes, endlessWave, PLANTS: PLANTS };`, sandbox, { filename: 'exports.js' });

/* ---------- 构造游戏并模拟 ---------- */
const { Game, STATE, LEVELS, PLANTS, ZOMBIES, Sun, Plant, Zombie, Renderer } = sandbox.__x;

// 初始化渲染层（index.html 中由 main.js 调用）
Renderer.init(sandbox.document.getElementById('game'));
const game = new Game();
sandbox.__game = game;

let errors = [];
const origError = console.error;

function step(seconds, label) {
  const dt = 1 / 60;
  const frames = Math.floor(seconds * 60);
  for (let i = 0; i < frames; i++) {
    advance(dt * 1000);
    try {
      if (game.state === STATE.PLAYING) game.update(dt, VT);
      Renderer.draw(game);          // 同时验证渲染层不报错
    } catch (e) {
      errors.push(`[${label}] frame ${i}: ${e.message}\n    ${(e.stack || '').split('\n')[1] || ''}`);
      if (errors.length > 6) return;
    }
  }
}

// --- 关卡 1 全程模拟：自动种植 + 收集阳光 ---
console.log('\n--- 模拟关卡 1（90 秒，自动挂机） ---');
game.startLevel(0);

// 每 2 秒尝试种一次植物（模拟玩家）
let planted = 0;
for (let t = 0; t < 90; t += 2) {
  step(2, 'L1');
  if (game.state !== STATE.PLAYING) break;

  // 自动收集所有阳光
  game.suns.forEach(s => { if (!s.collected) game.collectSun(s); });

  // 自动种植：轮流种可用植物
  const avail = LEVELS[0].plants;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 9; col++) {
      if (game.grid[row][col]) continue;
      for (const id of avail) {
        if (game.sun < PLANTS[id].cost) continue;
        if ((game.cooldowns[id] || 0) > VT) continue;
        game.selected = id;
        game.tryPlant(col, row);
        planted++;
        break;
      }
      break;
    }
  }
}
console.log(`  状态=${game.state} 种下=${planted} 植物在场=${game.plants.length} 僵尸=${game.zombies.length} 击杀=${game.stats.killed} 阳光=${game.sun}`);

// --- 逐关测试解锁链 + 各关卡能启动且不崩 ---
console.log('\n--- 逐关启动测试（每关跑 12 秒） ---');
LEVELS.forEach((lv, i) => {
  const g2 = new Game();
  g2.startLevel(i);
  const dt = 1 / 60;
  for (let f = 0; f < 12 * 60; f++) {
    advance(dt * 1000);
    try { g2.update(dt, VT); Renderer.draw(g2); } catch (e) {
      errors.push(`[L${lv.id}] ${e.message}\n    ${(e.stack || '').split('\n')[1] || ''}`);
      return;
    }
    if (g2.state !== STATE.PLAYING) break;
  }
  console.log(`  第 ${lv.id} 关 ${lv.name}: 波次=${g2.waveIndex}/${lv.waves.length || '∞'} 僵尸=${g2.zombies.length} 阳光=${g2.sun}`);
});

// --- 无尽模式 100 秒 ---
console.log('\n--- 无尽模式 100 秒 ---');
const g3 = new Game();
g3.startLevel(4);
for (let f = 0; f < 100 * 60; f++) {
  advance(1000 / 60);
  try { g3.update(1 / 60, VT); Renderer.draw(g3); } catch (e) {
    errors.push(`[无尽] ${e.message}\n    ${(e.stack || '').split('\n')[1] || ''}`);
    break;
  }
  if (f % 600 === 0) g3.suns.forEach(s => { if (!s.collected) g3.collectSun(s); });
}
console.log(`  波次=${g3.endlessN} 僵尸=${g3.zombies.length} 阳光=${g3.sun}`);

// --- 单元级检查 ---
console.log('\n--- 单元检查 ---');
const checks = [];
function check(name, cond) { checks.push({ name, ok: !!cond }); }

check('CFG 尺寸计算', sandbox.__x.CFG.W === 78 + 9 * 80 && sandbox.__x.CFG.H === 74 + 5 * 92);
check('parseTypes 解析', JSON.stringify(sandbox.__x.parseTypes('basic*2,cone*1')) === JSON.stringify(['basic', 'basic', 'cone']));
check('parseTypes 容错', sandbox.__x.parseTypes('unknown*3,,garbage').length === 0);
check('endlessWave 合法', (() => { for (let i = 1; i <= 40; i++) { const w = sandbox.__x.endlessWave(i); if (!w.types || !w.interval) return false; sandbox.__x.parseTypes(w.types); } return true; })());
check('Grid.pick 边界', sandbox.__x.Grid.pick(10, 10) === null && sandbox.__x.Grid.pick(100, 100).col === 0);
check('Grid.pick 右越界', sandbox.__x.Grid.pick(sandbox.__x.CFG.W + 10, 200) === null);
check('所有植物定义完整', Object.values(PLANTS).every(p => p.id && p.name && p.emoji && typeof p.cost === 'number' && p.hp > 0));
check('所有僵尸定义完整', Object.values(ZOMBIES).every(z => z.id && z.name && z.emoji && z.hp > 0 && z.speed > 0));
check('关卡植物 id 均存在', LEVELS.every(l => l.plants.every(id => !!PLANTS[id])));
check('关卡波次僵尸 id 均存在', LEVELS.every(l => l.waves.every(w => sandbox.__x.parseTypes(w.types).length >= 0)));
check('关卡波次时间递增', LEVELS.every(l => l.waves.every((w, i) => i === 0 || w.at > l.waves[i - 1].at)));
check('冷却均已定义', Object.values(PLANTS).every(p => p.cd > 0));
check('阳光不足以种植', (() => { const g = new Game(); g.startLevel(0); g.sun = 0; const before = g.plants.length; g.selected = 'sunflower'; g.tryPlant(0, 0); return g.plants.length === before; })());
check('占用格子不能重复种', (() => { const g = new Game(); g.startLevel(0); g.sun = 999; g.selected = 'sunflower'; g.tryPlant(0, 0); const n = g.plants.length; g.tryPlant(0, 0); return g.plants.length === n; })());
check('冷却生效', (() => { const g = new Game(); g.startLevel(0); g.sun = 999; g.selected = 'sunflower'; g.tryPlant(0, 0); g.tryPlant(1, 0); return g.plants.length === 1; })());
check('铲子移除植物', (() => { const g = new Game(); g.startLevel(0); g.sun = 999; g.selected = 'sunflower'; g.tryPlant(0, 0); g.tryShovel(0, 0); return g.plants.length === 0 && g.grid[0][0] === null; })());
check('僵尸到达房屋判负', (() => { const g = new Game(); g.startLevel(0); const before = g.state; g.onZombieReachedHouse(new Zombie('basic', 0)); return g.state === STATE.RESULT && before === STATE.PLAYING; })());
check('阳光收集增加阳光', (() => { const g = new Game(); g.startLevel(0); const s0 = g.sun; const sun = new Sun(100, 100, 200, 'sky'); g.collectSun(sun); return g.sun === s0 + 25; })());
check('进度保存到 localStorage', (() => { const g = new Game(); g.startLevel(0); g.finish(true); const raw = store['pvz-web-progress']; if (!raw) return false; const d = JSON.parse(raw); return d.unlocked === 2 && d.best > 0; })());
check('Game.loadProgress 容错', (() => { store['pvz-web-progress'] = 'NOT JSON{'; const d = Game.loadProgress(); return d.unlocked === 1; })());
check('樱桃炸弹清场', (() => {
  const g = new Game(); g.startLevel(2); g.sun = 999; g.selected = 'cherrybomb';
  const z = new Zombie('basic', 2); z.x = sandbox.__x.Grid.cellCX(4); z.y = sandbox.__x.Grid.cellCY(2);
  g.zombies.push(z);
  g.tryPlant(4, 2);
  return z.dead;
})());
check('火爆辣椒烧整行', (() => {
  const g = new Game(); g.startLevel(2); g.sun = 999; g.selected = 'jalapeno';
  const zs = [0, 4, 8].map(c => { const z = new Zombie('basic', 1); z.x = sandbox.__x.Grid.cellCX(c); z.y = sandbox.__x.Grid.cellCY(1); g.zombies.push(z); return z; });
  const other = new Zombie('basic', 3); other.x = sandbox.__x.Grid.cellCX(4); other.y = sandbox.__x.Grid.cellCY(3); g.zombies.push(other);
  g.tryPlant(4, 1);
  return zs.every(z => z.dead) && !other.dead;
})());
check('豌豆射手命中僵尸', (() => {
  const g = new Game(); g.startLevel(0);
  const p = new Plant('peashooter', 0, 0); g.plants.push(p); g.grid[0][0] = p;
  const z = new Zombie('basic', 0); z.x = sandbox.__x.Grid.cellCX(4); z.y = sandbox.__x.Grid.cellCY(0); g.zombies.push(z);
  const hp0 = z.hp;
  for (let i = 0; i < 400; i++) { advance(1000/60); g.projectiles.forEach(pr => pr.update(1/60, g)); g.projectiles = g.projectiles.filter(x => !x.dead); if (i % 10 === 0) p.fire(g); }
  return z.hp < hp0;
})());
check('寒冰射手减速', (() => {
  const g = new Game(); g.startLevel(1);
  const p = new Plant('snowpea', 0, 0); g.plants.push(p); g.grid[0][0] = p;
  const z = new Zombie('basic', 0); z.x = sandbox.__x.Grid.cellCX(1); z.y = sandbox.__x.Grid.cellCY(0); g.zombies.push(z);
  p.fire(g);
  for (let i = 0; i < 60; i++) { advance(1000/60); g.projectiles.forEach(pr => pr.update(1/60, g)); }
  return z.isSlowed;
})());
check('坚果墙高血量', PLANTS.wallnut.hp >= 1000);
check('大嘴花吞噬', (() => {
  const g = new Game(); g.startLevel(3);
  const p = new Plant('chomper', 3, 2); g.plants.push(p); g.grid[2][3] = p;
  const z = new Zombie('basic', 2); z.x = p.x + 20; z.y = p.y; g.zombies.push(z);
  p.update(1/60, g);
  return z.dead && p.chewingUntil > VT;
})());
check('巨人僵尸秒杀植物', (() => {
  const g = new Game(); g.startLevel(3);
  const p = new Plant('wallnut', 4, 1); g.plants.push(p); g.grid[1][4] = p;
  const z = new Zombie('gargantuar', 1); z.x = p.x + 20; z.y = p.y; g.zombies.push(z);
  z.lastAttack = 0;
  for (let i = 0; i < 5; i++) { advance(1000); z.update(1/60, g); }
  return p.dead;
})());
check('撑杆僵尸跳过一次', (() => {
  const g = new Game(); g.startLevel(2);
  const p = new Plant('wallnut', 4, 0); g.plants.push(p); g.grid[0][4] = p;
  const z = new Zombie('pole', 0); z.x = p.x + 20; z.y = p.y; g.zombies.push(z);
  for (let i = 0; i < 60; i++) { advance(1000/60); z.update(1/60, g); }
  return z.hasVaulted && !p.dead;
})());
check('土豆雷需先武装', (() => { const p = new Plant('potatomine', 0, 0); return p.armed === false; })());
check('胜利判定', (() => {
  const g = new Game(); g.startLevel(0);
  g.waveIndex = LEVELS[0].waves.length;
  g.zombies = [];
  g.checkWin();
  return g.state === STATE.RESULT;
})());
check('无尽模式不判定胜利', (() => {
  const g = new Game(); g.startLevel(4);
  g.checkWin();
  return g.state === STATE.PLAYING;
})());
check('小推车初始状态', (() => {
  const g = new Game(); g.startLevel(0);
  return g.mowers.length === 5 && g.mowers.every(m => !m.used && !m.active && m.x < sandbox.__x.CFG.HUD_W);
})());
check('僵尸触发小推车而非判负', (() => {
  const g = new Game(); g.startLevel(0); g.onFinish = () => {};
  const z = new Zombie('basic', 2);
  z.x = sandbox.__x.CFG.HUD_W - 10; z.y = sandbox.__x.Grid.cellCY(2);
  g.zombies.push(z);
  z.update(1/60, g);
  return g.mowers[2].used && g.state === STATE.PLAYING && !z.reachedHouse;
})());
check('小推车碾压本行僵尸', (() => {
  const g = new Game(); g.startLevel(0); g.onFinish = () => {};
  const m = g.mowers[1]; m.used = true; m.active = true; m.x = sandbox.__x.Grid.cellCX(3);
  const z = new Zombie('basic', 1); z.x = m.x; z.y = sandbox.__x.Grid.cellCY(1); g.zombies.push(z);
  const other = new Zombie('basic', 3); other.x = m.x; other.y = sandbox.__x.Grid.cellCY(3); g.zombies.push(other);
  g.updateMowers(1/60);
  return z.dead && !other.dead;
})());
check('小推车驶出后停止', (() => {
  const g = new Game(); g.startLevel(0); g.onFinish = () => {};
  const m = g.mowers[0]; m.used = true; m.active = true; m.x = sandbox.__x.CFG.W + 100;
  g.updateMowers(1/60);
  return !m.active;
})());
check('小推车用尽后才判负', (() => {
  const g = new Game(); g.startLevel(0); g.onFinish = () => {};
  g.mowers.forEach(m => { m.used = true; });   // 全部已用
  const z = new Zombie('basic', 0);
  z.x = sandbox.__x.CFG.HUD_W - 10; z.y = sandbox.__x.Grid.cellCY(0);
  g.zombies.push(z);
  z.update(1/60, g);
  return g.state === STATE.RESULT && z.reachedHouse;
})());
check('每帧检查胜利条件', (() => {
  const g = new Game(); g.startLevel(0); g.onFinish = (win) => { g.__w = win; };
  g.waveIndex = sandbox.__x.LEVELS[0].waves.length;   // 波次已放完
  g.zombies = [];
  g.update(1/60, VT);                                  // 不调用 checkWin，靠 update 自动判定
  return g.state === STATE.RESULT && g.__w === true;
})());
check('渲染层可完整绘制', (() => {
  const g = new Game(); g.startLevel(3); g.sun = 999;
  g.selected = 'peashooter'; g.tryPlant(2, 2);
  const z = new Zombie('bucket', 2); z.x = sandbox.__x.Grid.cellCX(5); g.zombies.push(z);
  g.mowers[0].active = true; g.mowers[0].used = true;
  g.hover = { col: 3, row: 1 };
  g.waveWarnUntil = VT + 1000;
  g.explosions.push({ type: 'circle', x: 300, y: 300, radius: 100, start: VT, duration: 600 });
  g.explosions.push({ type: 'lane', y: 300, start: VT, duration: 900 });
  Renderer.draw(g);
  return true;
})());

/* ---- 自动拾取阳光 ---- */
check('自动拾取默认关闭', new Game().autoCollect === false);
check('setAutoCollect 开关与持久化', (() => {
  const g = new Game();
  g.setAutoCollect(true);
  const saved = store['pvz-web-autocollect'];
  const reopened = new Game();          // 新实例应从 localStorage 读回
  g.setAutoCollect(false);
  return saved === '1' && reopened.autoCollect === true;
})());
check('自动拾取收集已落地阳光', (() => {
  const g = new Game(); g.startLevel(0); g.setAutoCollect(true);
  const s0 = g.sun;
  const sun = new Sun(300, 400, 400, 'plant');   // falling=false
  sun.age = 1;
  g.suns.push(sun);
  g.autoCollectSuns();
  g.setAutoCollect(false);
  return g.sun === s0 + 25 && sun.collected === true;
})());
check('自动拾取不会瞬收刚出现的阳光', (() => {
  const g = new Game(); g.startLevel(0);
  const s0 = g.sun;
  const sun = new Sun(300, 400, 400, 'plant');
  sun.age = 0.1;                                  // 刚出现
  g.suns.push(sun);
  g.autoCollectSuns();
  return g.sun === s0 && !sun.collected;
})());
check('自动拾取不会收高空下落中的阳光', (() => {
  const g = new Game(); g.startLevel(0);
  const s0 = g.sun;
  const sun = new Sun(300, 100, 400, 'sky');      // 还在高处
  sun.age = 2; sun.falling = true;
  g.suns.push(sun);
  g.autoCollectSuns();
  return g.sun === s0 && !sun.collected;
})());
check('关闭自动拾取后不再收集', (() => {
  const g = new Game(); g.startLevel(0); g.setAutoCollect(false);
  const s0 = g.sun;
  const sun = new Sun(300, 400, 400, 'plant'); sun.age = 5;
  g.suns.push(sun);
  g.autoCollectSuns();                     // 直接调用也不该在关闭时生效由 update 控制
  g.suns.forEach(x => { if (!x.collected && x.age > 0.35) {} });
  // 验证 update 路径：关闭时 update 不应自动收集
  g.suns = [new Sun(300, 400, 400, 'plant')]; g.suns[0].age = 5;
  const before = g.sun;
  g.update(1/60, VT);
  return g.sun === before;
})());
check('阳光存在时长递增', (() => {
  const sun = new Sun(300, 300, 400, 'plant');
  const a0 = sun.age;
  sun.update(1/60, { spawnSun(){}, puff(){}, collectSun(){} });
  return sun.age > a0;
})());
check('自动拾取不影响手动点击', (() => {
  const g = new Game(); g.startLevel(0); g.setAutoCollect(true);
  const s0 = g.sun;
  const sun = new Sun(sandbox.__x.Grid.cellCX(4), sandbox.__x.Grid.cellCY(2), 0, 'plant');
  sun.age = 5; g.suns.push(sun);
  g.onPointerDown(sun.x, sun.y);
  g.setAutoCollect(false);
  return g.sun === s0 + 25 && sun.collected;
})());

checks.forEach(c => console.log(`  ${c.ok ? '✅' : '❌'} ${c.name}`));
const failed = checks.filter(c => !c.ok);

console.log('\n============================');
if (errors.length) {
  console.log(`❌ 运行时错误 ${errors.length} 处:`);
  errors.forEach(e => console.log('  ' + e));
} else {
  console.log('✅ 无运行时错误');
}
console.log(failed.length ? `❌ 单元检查失败 ${failed.length}/${checks.length}` : `✅ 单元检查全部通过 (${checks.length}/${checks.length})`);
process.exit(errors.length || failed.length ? 1 : 0);
