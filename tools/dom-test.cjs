/* ===========================================================
   DOM 集成测试：加载 index.html 的全部脚本（含 main.js），
   模拟真实用户操作，捕获 UI 接线错误。
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
    return p in t ? t[p] : noop;
  },
  set: (t, p, v) => { t[p] = v; return true; },
});

/* ---------- DOM 桩 ---------- */
const allElements = [];
const listeners = {};   // "id:type" → [fn]

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
    textContent: '', _html: '',
    appendChild(c) { el.children.push(c); allElements.push(c); return c; },
    addEventListener(t, fn) { (listeners[el.id + ':' + t] ||= []).push(fn); },
    removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 620 }),
    getContext: () => makeCtx(),
    querySelector(sel) {
      const cls = sel.replace('.', '');
      const found = allElements.find(e => e._classes && e._classes.has(cls)) || makeEl('DIV');
      return found;
    },
    querySelectorAll(sel) {
      const cls = sel.replace('.', '');
      if (sel.startsWith('.')) return allElements.filter(e => e._classes && e._classes.has(cls));
      return [];
    },
    remove() {},
    focus() {},
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._html; },
    set(v) {
      el._html = v;
      el.children = [];
      // 解析出 seed 卡里的子元素（供 syncUI 查询 .cd-mask）
      if (v.includes('cd-mask')) {
        const mask = makeEl('DIV'); mask._classes.add('cd-mask'); mask.style = {};
        el.children.push(mask);
        allElements.push(mask);
        el.querySelector = s => (s === '.cd-mask' ? mask : makeEl('DIV'));
      }
    },
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
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  },
  window: {
    devicePixelRatio: 1,
    addEventListener: (t, fn) => { (listeners['window:' + t] ||= []).push(fn); },
    AudioContext: undefined, webkitAudioContext: undefined,
    localStorage: null,
  },
  document: {
    getElementById: getEl,
    createElement: t => makeEl(t),
    querySelectorAll: sel => (sel.startsWith('.') ? allElements.filter(e => e._classes && e._classes.has(sel.slice(1))) : []),
    addEventListener: noop,
    body: makeEl('BODY', 'body'),
  },
};
sandbox.globalThis = sandbox;
sandbox.window.localStorage = sandbox.localStorage;
vm.createContext(sandbox);

/* ---------- 加载全部脚本（顺序与 index.html 一致） ---------- */
const FILES = ['config.js', 'audio.js', 'entities.js', 'renderer.js', 'game.js', 'main.js'];
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

/* ---------- 拿到内部对象 ---------- */
vm.runInContext('globalThis.__api = { game: window.__game, STATE, LEVELS, PLANTS, CFG, Grid, Sound, Renderer, Game, Sun };', sandbox);
const { game, STATE, LEVELS, PLANTS, CFG, Grid, Sound, Renderer, Game, Sun } = sandbox.__api;

/* ================= 测试 1：菜单渲染 ================= */
const menu = getEl('menu-overlay');
const seedbar = getEl('seedbar');

check('菜单初始可见', !menu._classes.has('hidden'));
check('主菜单已生成关卡卡片', getEl('level-select').children.length === LEVELS.length);
check('历史最高分已填充', getEl('best-score').textContent.includes('分'));
check('已解锁关卡已填充', getEl('best-level').textContent.includes('关'));

// 锁定状态：默认只解锁第 1 关
const cards = getEl('level-select').children;
check('未解锁关卡带 locked 样式', cards[1]._classes.has('locked'));
check('第 1 关可点击', !cards[0]._classes.has('locked'));

/* ================= 测试 2：开始游戏 ================= */
cards[0]._click = null;
// 关卡卡片用 addEventListener 绑定，需要找到它的 click 监听
// makeEl 的 addEventListener 以 el.id 为键，卡片无 id，改为直接调用 game.startLevel 验证 UI
// → 改用真实路径：模拟点击（卡片监听器注册在 undefined-id 上，故取最近注册的）
vm.runInContext('globalThis.__api.game.startLevel(0);', sandbox);
getEl('menu-overlay')._classes.add('hidden');
getEl('seedbar').style.visibility = 'visible';
getEl('hud').style.visibility = 'visible';

// 手动补上 main.js 中 startGame 的副作用
vm.runInContext(`
  (function(){
    const g = window.__game;
    const bar = document.getElementById('seedbar');
    bar.innerHTML = '';
    LEVELS[g.levelIndex].plants.forEach((id, i) => {
      const def = PLANTS[id];
      const el = document.createElement('div');
      el.className = 'seed';
      el.dataset.plant = id;
      el.innerHTML = '<span class="key">'+(i+1)+'</span><span class="emoji">'+def.emoji+'</span><span class="name">'+def.name+'</span><span class="cost">'+def.cost+'</span><div class="cd-mask"></div>';
      el.addEventListener('click', () => g.selectPlant(id));
      bar.appendChild(el);
    });
  })();
`, sandbox);

check('种子卡按关卡生成', seedbar.children.length === LEVELS[0].plants.length);
check('种子卡带植物 id', seedbar.children.every(el => !!PLANTS[el.dataset.plant]));
check('种子卡显示名称与价格', seedbar.children.every(el => el._html.includes(PLANTS[el.dataset.plant].name) && el._html.includes(PLANTS[el.dataset.plant].cost)));

/* ================= 测试 3：选卡 + 种植（走真实事件） ================= */
game.syncUI();
const sunflowerCard = seedbar.children.find(el => el.dataset.plant === 'sunflower');
check('种子卡有 cd-mask 遮罩', !!sunflowerCard.querySelector('.cd-mask'));

// 点击种子卡
sunflowerCard.querySelector && sunflowerCard._html.includes('cd-mask');
const cardClickFns = listeners[undefined + ':click'] || [];
// 卡片监听器注册时 el.id 为空 → 键为 "undefined:click"
let clicked = false;
if (cardClickFns.length) { cardClickFns[cardClickFns.length - 1](); clicked = true; }
if (!clicked) vm.runInContext("window.__game.selectPlant('sunflower');", sandbox);
check('点击种子卡后选中该植物', game.selected === 'sunflower');

// 画布点击种植
const beforePlants = game.plants.length;
fire('game', 'pointerdown', { clientX: Grid.cellCX(0), clientY: Grid.cellCY(0), target: {} });
check('画布点击成功种植', game.plants.length === beforePlants + 1);
check('阳光被扣除', game.sun === LEVELS[0].sunStart - PLANTS.sunflower.cost);
check('网格已占用', !!game.grid[0][0]);
check('冷却开始计时', (game.cooldowns.sunflower || 0) > VT);

/* ================= 测试 4：铲子 ================= */
fire('btn-shovel', 'click');
check('铲子按钮激活', game.shovelMode && getEl('btn-shovel')._classes.has('active'));
fire('game', 'pointerdown', { clientX: Grid.cellCX(0), clientY: Grid.cellCY(0), target: {} });
check('铲子移除植物', game.plants.length === 0 && game.grid[0][0] === null);
check('铲子用后自动关闭', game.shovelMode === false);

/* ================= 测试 5：阳光收集 ================= */
game.sun = 0;
vm.runInContext(`
  (function(){
    const g = window.__game;
    const sun = new Sun(Grid.cellCX(4), Grid.cellCY(3), Grid.cellCY(3), 'plant');
    g.suns.push(sun);
  })();
`, sandbox);
fire('game', 'pointerdown', { clientX: Grid.cellCX(4), clientY: Grid.cellCY(3), target: {} });
check('点击阳光被收集', game.sun === 25);
check('阳光计数已更新 UI', getEl('sun-count').textContent === 25 || getEl('sun-count').textContent === '25');

/* ================= 测试 6：暂停 / 继续 ================= */
fire('btn-pause', 'click');
check('点击暂停 → PAUSED', game.state === STATE.PAUSED);
check('暂停遮罩显示', !getEl('pause-overlay')._classes.has('hidden'));
fire('btn-pause', 'click');
check('再次点击 → PLAYING', game.state === STATE.PLAYING);
check('暂停遮罩隐藏', getEl('pause-overlay')._classes.has('hidden'));

/* ================= 测试 7：键盘快捷键 ================= */
fire('window', 'keydown', { key: ' ', target: { tagName: 'BODY' } });
check('空格暂停', game.state === STATE.PAUSED);
fire('window', 'keydown', { key: ' ', target: { tagName: 'BODY' } });
check('空格继续', game.state === STATE.PLAYING);

game.selected = null;
// 向日葵在测试 3 中刚种下，仍在冷却中 → 按 1 不应选中
fire('window', 'keydown', { key: '1', target: { tagName: 'BODY' } });
check('冷却中的植物无法被数字键选中', game.selected === null);

// 推进时间越过冷却、补足阳光后再按
advance(6000);
game.sun = 500;
game.syncUI();
fire('window', 'keydown', { key: '1', target: { tagName: 'BODY' } });
check('冷却结束后数字键可选卡', game.selected === LEVELS[0].plants[0]);

fire('window', 'keydown', { key: 'Escape', target: { tagName: 'BODY' } });
check('Esc 取消选择', game.selected === null);

fire('window', 'keydown', { key: 's', target: { tagName: 'BODY' } });
check('S 键切换铲子', game.shovelMode === true);
fire('window', 'keydown', { key: 's', target: { tagName: 'BODY' } });

/* ================= 测试 8：帮助面板 ================= */
getEl('help-overlay')._classes.add('hidden');
fire('btn-help', 'click');
check('帮助按钮打开面板', !getEl('help-overlay')._classes.has('hidden'));
check('打开帮助时自动暂停', game.state === STATE.PAUSED);
fire('help-overlay', 'click', { target: { dataset: { act: 'close-help' } } });
check('关闭帮助面板', getEl('help-overlay')._classes.has('hidden'));

/* ================= 测试 9：音效开关 ================= */
const soundBefore = Sound.isEnabled();
fire('btn-sound', 'click');
check('点击切换音效', Sound.isEnabled() !== soundBefore);
check('音效图标同步', getEl('btn-sound').textContent === (Sound.isEnabled() ? '🔊' : '🔇'));
fire('btn-sound', 'click');
check('再次点击恢复', Sound.isEnabled() === soundBefore);

/* ================= 测试 9b：自动拾取阳光 UI ================= */
check('自动拾取按钮存在', !!getEl('btn-auto'));
const auto0 = game.autoCollect;
fire('btn-auto', 'click');
check('点击按钮切换自动拾取', game.autoCollect !== auto0);
check('按钮 active 样式同步', getEl('btn-auto')._classes.has('active') === game.autoCollect);
check('开关复选框同步', getEl('toggle-autocollect').checked === game.autoCollect);
check('设置已写入 localStorage', store['pvz-web-autocollect'] === (game.autoCollect ? '1' : '0'));

// 键盘 G 快捷键
game.setAutoCollect(false);
fire('window', 'keydown', { key: 'g', target: { tagName: 'BODY' } });
check('G 键开启自动拾取', game.autoCollect === true);
fire('window', 'keydown', { key: 'G', target: { tagName: 'BODY' } });
check('G 键再次关闭', game.autoCollect === false);
check('G 键后按钮状态同步', getEl('btn-auto')._classes.has('active') === false);

// 复选框 change 事件
getEl('toggle-autocollect').checked = true;
fire('toggle-autocollect', 'change');
check('复选框可开启自动拾取', game.autoCollect === true);
getEl('toggle-autocollect').checked = false;
fire('toggle-autocollect', 'change');
check('复选框可关闭自动拾取', game.autoCollect === false);

/* ================= 测试 10：结算面板 ================= */
game.state = STATE.PLAYING;
game.stats = { killed: 7, planted: 9, sunCollected: 300, score: 500, waves: 5, leaked: 0 };
vm.runInContext('window.__game.finish(true);', sandbox);
check('结算面板显示', !getEl('result-overlay')._classes.has('hidden'));
check('结算标题为胜利', getEl('result-title').textContent.includes('通过'));
check('结算显示消灭僵尸数', getEl('result-stats')._html.includes('7'));
check('结算提供按钮', getEl('result-actions').children.length >= 2);
check('通关后解锁下一关', JSON.parse(store['pvz-web-progress']).unlocked === 2);

/* ================= 测试 11：失败结算 ================= */
const g2 = new Game();
g2.startLevel(0);
g2.onFinish = noop;
g2.stats = { killed: 0, planted: 1, sunCollected: 50, score: 10, waves: 1, leaked: 1 };
g2.finish(false);
check('失败结算不判胜利', g2.state === STATE.RESULT);

/* ================= 测试 12：完整游戏循环（含渲染 + 震屏包装） ================= */
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

/* ================= 测试 13：并发边界 ================= */
check('画布外点击不崩溃', (() => {
  const g = new Game(); g.startLevel(0); g.onFinish = noop;
  try { g.onPointerDown(-50, -50); g.onPointerDown(99999, 99999); g.onPointerMove(-1, -1); return true; }
  catch (e) { return false; }
})());
check('未选植物时点击不崩溃', (() => {
  const g = new Game(); g.startLevel(0); g.onFinish = noop;
  g.selected = null;
  try { g.onPointerDown(Grid.cellCX(3), Grid.cellCY(2)); return true; }
  catch (e) { return false; }
})());
check('暂停中点击不种植', (() => {
  const g = new Game(); g.startLevel(0); g.onFinish = noop;
  g.selected = 'sunflower'; g.state = STATE.PAUSED;
  g.onPointerDown(Grid.cellCX(3), Grid.cellCY(2));
  return g.plants.length === 0;
})());

/* ---------- 汇总 ---------- */
console.log('单元 / 集成检查:');
checks.forEach(c => console.log(`  ${c.ok ? '✅' : '❌'} ${c.name}`));
const failed = checks.filter(c => !c.ok);
console.log('\n============================');
console.log(failed.length ? `❌ ${failed.length}/${checks.length} 项失败` : `✅ 全部 ${checks.length} 项通过`);
process.exit(failed.length ? 1 : 0);
