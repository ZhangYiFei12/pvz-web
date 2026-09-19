/* ===========================================================
   DOM 集成测试：加载 index.html 的全部脚本（含 main.js），
   模拟真实用户操作（HUD 现在画在 Canvas 上，用逻辑坐标点击）。
   =========================================================== */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : '.';

let VT = 1700000000000;
const advance = ms => { VT += ms; };
const VDate = new Proxy(Date, { get(t, p) { if (p === 'now') return () => VT; const v = t[p]; return typeof v === 'function' ? v.bind(t) : v; } });
const noop = () => {};

/* ---------- Canvas 2D 桩 ---------- */
const makeCtx = () => new Proxy({}, {
  get: (t, p) => {
    if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop: noop });
    if (p === 'measureText') return () => ({ width: 10 });
    if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
    if (p === 'getLineDash') return () => [];
    return p in t ? t[p] : noop;
  },
  set: (t, p, v) => { t[p] = v; return true; },
});

/* ---------- DOM 桩 ---------- */
const allElements = [];
const listeners = {};

function makeEl(tagName = 'DIV', id = '') {
  const el = {
    tagName: tagName.toUpperCase(), id, dataset: {}, style: {}, children: [],
    offsetWidth: 100, clientWidth: 900, clientHeight: 620,
    _classes: new Set(),
    classList: {
      add(...c) { c.forEach(x => el._classes.add(x)); },
      remove(...c) { c.forEach(x => el._classes.delete(x)); },
      toggle(c, f) { const on = f === undefined ? !el._classes.has(c) : !!f; on ? el._classes.add(c) : el._classes.delete(c); return on; },
      contains(c) { return el._classes.has(c); },
    },
    textContent: '', _html: '', checked: false,
    appendChild(c) { el.children.push(c); allElements.push(c); return c; },
    addEventListener(t, fn) { (listeners[el.id + ':' + t] ||= []).push(fn); },
    removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 620 }),
    getContext: () => makeCtx(),
    querySelector: () => makeEl('DIV'),
    querySelectorAll: () => [],
    remove() {}, focus() {},
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._html; },
    set(v) { el._html = v; el.children = []; },
  });
  Object.defineProperty(el, 'className', {
    get() { return [...el._classes].join(' '); },
    set(v) { el._classes = new Set(String(v).split(/\s+/).filter(Boolean)); },
  });
  return el;
}

function getEl(id) {
  let e = allElements.find(x => x.id === id);
  if (!e) { e = makeEl('DIV', id); allElements.push(e); }
  return e;
}

const store = {};
const sandbox = {
  console,
  performance: { now: () => VT },
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: noop,
  setTimeout: (fn) => setTimeout(fn, 0),
  clearTimeout,
  Math, Date: VDate, JSON, Object, Array, String, Number, Boolean, Error, isNaN, parseInt, parseFloat,
  Uint8ClampedArray,
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
    getElementById: getEl,
    createElement: t => makeEl(t),
    querySelectorAll: () => [],
    addEventListener: noop,
    body: makeEl('BODY', 'body'),
  },
};
sandbox.globalThis = sandbox;
sandbox.window.localStorage = sandbox.localStorage;
vm.createContext(sandbox);

/* ---------- 加载全部脚本 ---------- */
const FILES = ['config.js', 'audio.js', 'sprites.js', 'sprites-zombie.js', 'entities.js', 'renderer-hud.js', 'renderer.js', 'game.js', 'main.js'];
for (const f of FILES) {
  const code = fs.readFileSync(path.join(ROOT, 'site', 'js', f), 'utf8');
  try {
    vm.runInContext(code, sandbox, { filename: f });
  } catch (e) {
    console.log(`❌ ${f} 执行失败: ${e.message}`);
    console.log(e.stack.split('\n').slice(0, 5).join('\n'));
    process.exit(1);
  }
}
console.log('✅ 全部脚本（含 main.js）加载成功\n');

/* ---------- 事件触发辅助 ---------- */
function fire(id, type, evt = {}) {
  const fns = listeners[id + ':' + type] || [];
  if (!fns.length) return false;
  fns.forEach(fn => fn({
    preventDefault: noop, stopPropagation: noop,
    target: { dataset: {}, tagName: 'DIV', ...(evt.target || {}) },
    clientX: 0, clientY: 0, key: '', ...evt,
  }));
  return true;
}

const checks = [];
const check = (name, cond) => checks.push({ name, ok: !!cond });

/* ---------- 导出内部对象 ---------- */
vm.runInContext(`globalThis.__x = { Game, STATE, LEVELS, PLANTS, ZOMBIES, Sun, Plant, Zombie, Projectile, Particle, FloatText, CFG, UI, Grid, Sound, Renderer, Hud, Sprites, ZombieArt, parseTypes, endlessWave, seedRects, shovelRect, pauseRect, hitRect };`, sandbox);
vm.runInContext('globalThis.__api = Object.assign({ game: window.__game }, globalThis.__x);', sandbox);
const { game, STATE, LEVELS, PLANTS, ZOMBIES, CFG, UI, Grid, Sound, Renderer, seedRects, shovelRect, pauseRect, Game, Sun, Zombie, Sprites, ZombieArt } = sandbox.__api;

/* ---------- 逻辑坐标 → 客户端坐标 ---------- */
const S = () => Renderer.scale || 1;
const clickLogical = (lx, ly) => fire('game', 'pointerdown', { clientX: lx * S(), clientY: ly * S() });
const moveLogical = (lx, ly) => fire('game', 'pointermove', { clientX: lx * S(), clientY: ly * S() });
const centerOf = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/* ================= 测试 1：菜单 ================= */
check('菜单初始可见', !getEl('menu-overlay')._classes.has('hidden'));
check('主菜单已生成关卡卡片', getEl('level-select').children.length === LEVELS.length);
check('历史最高分已填充', getEl('best-score').textContent.includes('分'));
check('已解锁关卡已填充', getEl('best-level').textContent.includes('关'));
const cards = getEl('level-select').children;
check('未解锁关卡带 locked 样式', cards[1]._classes.has('locked'));
check('第 1 关可点击', !cards[0]._classes.has('locked'));

/* ================= 测试 2：开始游戏 ================= */
cards[0]._click = null;
// 关卡卡片监听器注册在无 id 元素上，键为 "undefined:click"
const cardFns = listeners['undefined:click'] || [];
if (cardFns.length) cardFns[cardFns.length - 1]();
else vm.runInContext('window.__game.startLevel(0);', sandbox);
getEl('menu-overlay')._classes.add('hidden');

check('进入游戏状态', game.state === STATE.PLAYING);
check('关卡已加载', !!game.level && game.level.code === '1-1');
check('开场动画已启动', game.introUntil > VT);
check('种子卡布局已生成', seedRects(game.level.plants).length === LEVELS[0].plants.length);

/* ================= 测试 3：点击种子卡 + 种植 ================= */
advance(3000);   // 越过开场动画
const rects = seedRects(game.level.plants);
const sunflowerRect = rects.find(r => r.id === 'sunflower');
check('向日葵有种子卡', !!sunflowerRect);

let c = centerOf(sunflowerRect);
clickLogical(c.x, c.y);
check('点击种子卡后选中该植物', game.selected === 'sunflower');

const beforePlants = game.plants.length;
const cellCenter = { x: Grid.cellCX(0), y: Grid.cellCY(0) };
clickLogical(cellCenter.x, cellCenter.y);
check('点击草坪成功种植', game.plants.length === beforePlants + 1);
check('阳光被扣除', game.sun === LEVELS[0].sunStart - PLANTS.sunflower.cost);
check('网格已占用', !!game.grid[0][0]);
check('冷却开始计时', (game.cooldowns.sunflower || 0) > VT);

/* ================= 测试 4：铲子（画布内按钮） ================= */
const sh = shovelRect(game.level.plants);
c = centerOf(sh);
clickLogical(c.x, c.y);
check('点击铲子按钮激活', game.shovelMode === true);
clickLogical(cellCenter.x, cellCenter.y);
check('铲子移除植物', game.plants.length === 0 && game.grid[0][0] === null);
check('铲子用后自动关闭', game.shovelMode === false);

/* ================= 测试 5：阳光收集 ================= */
game.sun = 0;
vm.runInContext(`
  (function(){
    const g = window.__game;
    const sun = new Sun(Grid.cellCX(4), Grid.cellCY(3), Grid.cellCY(3), 'plant');
    sun.age = 5;
    g.suns.push(sun);
  })();
`, sandbox);
clickLogical(Grid.cellCX(4), Grid.cellCY(3));
check('点击阳光被收集', game.sun === 25);

/* ================= 测试 6：暂停按钮（画布内） ================= */
const pr = pauseRect();
c = centerOf(pr);
clickLogical(c.x, c.y);
check('点击暂停 → PAUSED', game.state === STATE.PAUSED);
check('暂停遮罩显示', !getEl('pause-overlay')._classes.has('hidden'));
clickLogical(c.x, c.y);
check('再次点击 → PLAYING', game.state === STATE.PLAYING);
check('暂停遮罩隐藏', getEl('pause-overlay')._classes.has('hidden'));

/* ================= 测试 7：键盘 ================= */
fire('window', 'keydown', { key: ' ', target: { tagName: 'BODY' } });
check('空格暂停', game.state === STATE.PAUSED);
fire('window', 'keydown', { key: ' ', target: { tagName: 'BODY' } });
check('空格继续', game.state === STATE.PLAYING);

game.selected = null;
game.cooldowns = {};
game.sun = 500;
fire('window', 'keydown', { key: '1', target: { tagName: 'BODY' } });
check('数字键 1 选中第一个植物', game.selected === LEVELS[0].plants[0]);

fire('window', 'keydown', { key: 'Escape', target: { tagName: 'BODY' } });
check('Esc 取消选择', game.selected === null);

fire('window', 'keydown', { key: 's', target: { tagName: 'BODY' } });
check('S 键切换铲子', game.shovelMode === true);
fire('window', 'keydown', { key: 's', target: { tagName: 'BODY' } });

/* ================= 测试 8：帮助面板 ================= */
getEl('help-overlay')._classes.add('hidden');
fire('btn-help2', 'click');
check('帮助按钮打开面板', !getEl('help-overlay')._classes.has('hidden'));
fire('help-overlay', 'click', { target: { dataset: { act: 'close-help' } } });
check('关闭帮助面板', getEl('help-overlay')._classes.has('hidden'));

/* ================= 测试 9：设置（音效 / 自动拾取） ================= */
const soundBefore = Sound.isEnabled();
fire('btn-sound', 'click');
check('点击切换音效', Sound.isEnabled() !== soundBefore);
check('音效按钮文字同步', getEl('btn-sound').textContent.includes(Sound.isEnabled() ? '开' : '关'));
fire('btn-sound', 'click');
check('再次点击恢复', Sound.isEnabled() === soundBefore);

check('自动拾取按钮存在', !!getEl('btn-auto'));
const auto0 = game.autoCollect;
fire('btn-auto', 'click');
check('点击按钮切换自动拾取', game.autoCollect !== auto0);
check('按钮 active 样式同步', getEl('btn-auto')._classes.has('active') === game.autoCollect);
check('开关复选框同步', getEl('toggle-autocollect').checked === game.autoCollect);
check('设置已写入 localStorage', store['pvz-web-autocollect'] === (game.autoCollect ? '1' : '0'));

game.setAutoCollect(false);
fire('window', 'keydown', { key: 'g', target: { tagName: 'BODY' } });
check('G 键开启自动拾取', game.autoCollect === true);
fire('window', 'keydown', { key: 'G', target: { tagName: 'BODY' } });
check('G 键再次关闭', game.autoCollect === false);

getEl('toggle-autocollect').checked = true;
fire('toggle-autocollect', 'change');
check('复选框可开启自动拾取', game.autoCollect === true);
getEl('toggle-autocollect').checked = false;
fire('toggle-autocollect', 'change');
check('复选框可关闭自动拾取', game.autoCollect === false);

/* ================= 测试 10：结算 ================= */
game.state = STATE.PLAYING;
game.stats = { killed: 7, planted: 9, sunCollected: 300, score: 500, waves: 5, leaked: 0 };
vm.runInContext('window.__game.finish(true);', sandbox);
check('结算面板显示', !getEl('result-overlay')._classes.has('hidden'));
check('结算标题为胜利', getEl('result-title').textContent.includes('通过'));
check('结算显示消灭僵尸数', getEl('result-stats')._html.includes('7'));
check('结算提供按钮', getEl('result-actions').children.length >= 2);
check('通关后解锁下一关', JSON.parse(store['pvz-web-progress']).unlocked === 2);

const g2 = new Game();
g2.startLevel(0);
g2.onFinish = noop;
g2.finish(false);
check('失败结算不判胜利', g2.state === STATE.RESULT);

/* ================= 测试 11：完整循环（update + draw） ================= */
const g3 = new Game();
g3.startLevel(0);
g3.onFinish = noop;
let loopErr = null;
try {
  for (let f = 0; f < 30 * 60; f++) {
    advance(1000 / 60);
    if (g3.state === STATE.PLAYING) g3.update(1 / 60, VT);
    g3.shake(100, 5);
    Renderer.draw(g3);
  }
} catch (e) { loopErr = e.message + ' @ ' + (e.stack || '').split('\n')[1]; }
check('30 秒完整循环（update+draw+震屏）无异常', !loopErr);
if (loopErr) console.log('  循环错误:', loopErr);

/* ================= 测试 12：边界 ================= */
check('画布外点击不崩溃', (() => {
  const g = new Game(); g.startLevel(0); g.onFinish = noop;
  try { g.onPointerDown(-50, -50); g.onPointerDown(99999, 99999); g.onPointerMove(-1, -1); return true; }
  catch (e) { return false; }
})());
check('HUD 区域点击不会误种', (() => {
  const g = new Game(); g.startLevel(0); g.onFinish = noop; g.sun = 999;
  g.selected = 'sunflower';
  const before = g.plants.length;
  g.onPointerDown(500, 40);   // 面板空白处
  return g.plants.length === before;
})());
check('暂停中点击不种植', (() => {
  const g = new Game(); g.startLevel(0); g.onFinish = noop;
  g.selected = 'sunflower'; g.state = STATE.PAUSED;
  g.onPointerDown(Grid.cellCX(3), Grid.cellCY(2));
  return g.plants.length === 0;
})());

/* ================= 测试 13：绘制层完整性 ================= */
check('全部植物可绘制', (() => {
  const ctx = Renderer.ctx;
  try {
    Sprites.PLANT_IDS.forEach(id => Sprites.plant(ctx, id, 0, {}));
    return true;
  } catch (e) { return false; }
})());
check('全部僵尸可绘制', (() => {
  const ctx = Renderer.ctx;
  try {
    Object.keys(ZOMBIES).forEach(id => {
      ZombieArt.draw(ctx, id, 0, { walk: 1 });
      ZombieArt.drawDying(ctx, id, 0, { dying: .5 });
    });
    return true;
  } catch (e) { return false; }
})());

/* ---------- 汇总 ---------- */
console.log('单元 / 集成检查:');
checks.forEach(c => console.log(`  ${c.ok ? '✅' : '❌'} ${c.name}`));
const failed = checks.filter(c => !c.ok);
console.log('\n============================');
console.log(failed.length ? `❌ ${failed.length}/${checks.length} 项失败` : `✅ 全部 ${checks.length} 项通过`);
process.exit(failed.length ? 1 : 0);
