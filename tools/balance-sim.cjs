/* 平衡性调参：用“会玩的玩家”AI 验证每关可通关，并输出经济曲线 */
const fs = require('fs'), path = require('path'), vm = require('vm');

let VT = 1700000000000;
const advance = ms => { VT += ms; };
const VDate = new Proxy(Date, { get(t,p){ if(p==='now') return ()=>VT; const v=t[p]; return typeof v==='function'?v.bind(t):v; } });
const noop = () => {};
const makeCtx = () => new Proxy({}, { get:(t,p)=>{
  if(p==='createLinearGradient'||p==='createRadialGradient') return ()=>({addColorStop:noop});
  if(p==='measureText') return ()=>({width:10});
  return p in t ? t[p] : noop; }, set:(t,p,v)=>{t[p]=v;return true;} });
function makeEl(id) {
  const el = { id, tagName:'DIV', dataset:{}, style:{}, children:[], offsetWidth:100, clientWidth:900, clientHeight:620,
    classList:{_s:new Set(),add(...c){c.forEach(x=>this._s.add(x));},remove(...c){c.forEach(x=>this._s.delete(x));},toggle(c,f){const on=f===undefined?!this._s.has(c):!!f;on?this._s.add(c):this._s.delete(c);return on;},contains(c){return this._s.has(c);}},
    textContent:'', appendChild(c){this.children.push(c);return c;}, addEventListener(){}, removeEventListener(){},
    getBoundingClientRect:()=>({left:0,top:0,width:900,height:620}), querySelector:()=>({style:{}}), querySelectorAll:()=>[], getContext:()=>makeCtx() };
  Object.defineProperty(el,'innerHTML',{get(){return this._h||'';},set(v){this._h=v;this.children=[];}});
  return el;
}
const els = {}, store = {};
const sandbox = {
  console, performance:{now:()=>VT}, requestAnimationFrame:()=>1, cancelAnimationFrame:noop,
  setTimeout:(fn)=>setTimeout(fn,0), clearTimeout,
  Math, Date:VDate, JSON, Object, Array, String, Number, Boolean, Error, isNaN, parseInt, parseFloat,
  localStorage:{getItem:k=>(k in store?store[k]:null),setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}},
  window:{devicePixelRatio:1,addEventListener(){},AudioContext:undefined,webkitAudioContext:undefined},
  document:{getElementById:id=>els[id]||(els[id]=makeEl(id)),createElement:t=>makeEl('_'+t),querySelectorAll:()=>[],addEventListener(){},body:makeEl('body')},
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
['config.js', 'audio.js', 'sprites.js', 'sprites-zombie.js', 'entities.js', 'renderer-hud.js', 'renderer.js', 'game.js'].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join('.','site','js',f),'utf8'), sandbox, {filename:f}));
vm.runInContext('globalThis.__x = { Game, STATE, LEVELS, PLANTS, ZOMBIES, CFG, Grid };', sandbox);
const { Game, STATE, LEVELS, PLANTS, CFG, Grid } = sandbox.__x;

/** 会玩的玩家 AI：
 *  阶段1 前 25 秒：优先铺满 col0-1 向日葵（8-10个）
 *  阶段2：col2-5 铺射手（优先双发/寒冰）
 *  阶段3：col6-7 坚果墙
 *  全程：僵尸过 col3 用炸弹救场；阳光够就补输出
 */
function playLevel(idx, log) {
  const g = new Game();
  g.startLevel(idx);
  const L = LEVELS[idx];
  const dt = 1/60;
  let leaks = 0;
  const origFinish = g.onFinish;
  g.onFinish = (win, score) => { g.__win = win; };

  const can = (id) => L.plants.includes(id);
  const cdOk = (id) => (g.cooldowns[id] || 0) <= VT;
  const sunflowerCount = () => g.plants.filter(p => p.defId === 'sunflower').length;
  const shooterCols = [2,3,4,5,6];

  for (let f = 0; f <= 400*60; f++) {
    advance(dt*1000);
    if (g.state !== STATE.PLAYING) break;
    try { g.update(dt, VT); } catch(e) { return { err: e.message+'\n'+e.stack.split('\n')[1], sec:f/60 }; }
    g.suns.forEach(s => { if (!s.collected) g.collectSun(s); });

    if (f % 18 !== 0) continue;   // 每 0.3s 决策

    // 每行最靠左的僵尸 x
    const front = {};
    g.zombies.forEach(z => { if (!z.dead && z.x < CFG.W) front[z.row] = Math.min(front[z.row] ?? 1e9, z.x); });

    // --- 0) 救场：僵尸逼近 col2 以内，用樱桃/辣椒 ---
    let bombed = false;
    for (const [rs, zx] of Object.entries(front)) {
      if (bombed) break;
      const row = +rs;
      if (zx > Grid.cellCX(2)) continue;
      for (const bomb of ['cherrybomb','jalapeno']) {
        if (!can(bomb) || g.sun < PLANTS[bomb].cost || !cdOk(bomb)) continue;
        const col = Math.max(0, Math.min(CFG.COLS-2, Grid.colAt(zx) + (bomb==='cherrybomb'?0:0)));
        if (g.grid[row][col]) continue;
        g.selected = bomb; g.tryPlant(col, row);
        if (log) log.push(`t=${(f/60).toFixed(0)}s 🍒${bomb} row${row} col${col}`);
        bombed = true; break;
      }
    }

    // --- 1) 经济：col0-1 向日葵 ---
    if (sunflowerCount() < 10 && g.sun >= PLANTS.sunflower.cost && cdOk('sunflower') && can('sunflower')) {
      outer1:
      for (const col of [0,1]) for (let row = 0; row < CFG.ROWS; row++) {
        if (!g.grid[row][col]) { g.selected='sunflower'; g.tryPlant(col,row); if (log) log.push(`t=${(f/60).toFixed(0)}s 🌻 row${row} col${col}`); break outer1; }
      }
    }

    // --- 2) 前排坚果：col 7（有僵尸接近时优先）---
    const rowsWithZombie = Object.keys(front).map(Number);
    if (can('wallnut') && g.sun >= PLANTS.wallnut.cost && cdOk('wallnut')) {
      for (const row of rowsWithZombie) {
        if (!g.grid[row][7]) { g.selected='wallnut'; g.tryPlant(7,row); if (log) log.push(`t=${(f/60).toFixed(0)}s 🌰 row${row} col7`); break; }
      }
    }

    // --- 3) 输出：col2-6 射手（优先给有僵尸的行补）---
    const pickShooter = () => {
      for (const s of ['repeater','snowpea','peashooter']) {
        if (can(s) && g.sun >= PLANTS[s].cost && cdOk(s)) return s;
      }
      return null;
    };
    const rowsOrder = [...rowsWithZombie, 0,1,2,3,4].filter((v,i,a)=>a.indexOf(v)===i);
    outer3:
    for (const row of rowsOrder) {
      for (const col of shooterCols) {
        if (g.grid[row][col]) continue;
        const s = pickShooter();
        if (!s) break outer3;
        g.selected = s; g.tryPlant(col, row);
        if (log) log.push(`t=${(f/60).toFixed(0)}s 🌱${s} row${row} col${col}`);
        break;
      }
    }
  }

  return { win: !!g.__win, state: g.state, sec: Math.round(g.gameTime),
    waves: g.waveIndex, total: L.waves.length || '∞', killed: g.stats.killed,
    score: g.stats.score, plants: g.plants.length, sun: g.sun,
    endlessWaves: g.endlessN,
    sunflowers: sunflowerCount(),
    shooters: g.plants.filter(p=>PLANTS[p.defId].tags.includes('shooter')).length };
}

const showDetail = process.argv.includes('-v');
console.log('=== 会玩玩家 AI 试玩结果 ===\n');
const results = [];
for (let i = 0; i < LEVELS.length; i++) {
  const L = LEVELS[i];
  const log = [];
  const r = playLevel(i, log);
  results.push({ L, r });
  const isEndless = !!L.endless;
  const ok = isEndless
    ? `♾️ 坚持 ${r.sec}s / ${r.endlessWaves} 波`
    : (r.win ? '✅ 通关' : (r.err ? '💥 崩溃' : '💀 失败'));
  console.log(`第 ${L.id} 关 ${L.name}  ${ok}`);
  console.log(`    用时 ${r.sec}s | ${isEndless ? `波次 ${r.endlessWaves}` : `波次 ${r.waves}/${r.total}`} | 击杀 ${r.killed} | 植物 ${r.plants}(🌻${r.sunflowers} 🌱${r.shooters}) | 得分 ${r.score}`);
  if (r.err) console.log('    ', r.err);
  if (showDetail) { console.log('     操作:'); log.slice(0,60).forEach(a => console.log('       ', a)); }
  console.log();
}

const failed = results.filter(x => !x.L.endless && !x.r.win && !x.r.err);
console.log(failed.length ? `⚠️ ${failed.length} 关未通过: ${failed.map(x=>'L'+x.L.id).join(', ')}` : '✅ 全部常规关卡可通关');
const endless = results.find(x => x.L.endless);
if (endless) console.log(`♾️ 无尽模式: 坚持 ${endless.r.sec}s，抵达第 ${endless.r.endlessWaves} 波`);
