/* 诊断：满防线 vs 完整关卡波次；以及阳光经济曲线 */
const fs = require('fs'), path = require('path'), vm = require('vm');

let VT = 1700000000000;
const advance = ms => { VT += ms; };
const VDate = new Proxy(Date, { get(t,p){ if(p==='now') return ()=>VT; const v=t[p]; return typeof v==='function'?v.bind(t):v; } });
const noop = () => {};
const makeCtx = () => new Proxy({}, { get:(t,p)=>{
  if(p==='createLinearGradient'||p==='createRadialGradient') return ()=>({addColorStop:noop});
  if(p==='measureText') return ()=>({width:10});
  return p in t ? t[p] : noop; }, set:(t,p,v)=>{t[p]=v;return true;} });
function makeEl(id){ const el={id,tagName:'DIV',dataset:{},style:{},children:[],offsetWidth:100,clientWidth:900,clientHeight:620,
  classList:{_s:new Set(),add(...c){c.forEach(x=>this._s.add(x));},remove(...c){c.forEach(x=>this._s.delete(x));},toggle(c,f){const on=f===undefined?!this._s.has(c):!!f;on?this._s.add(c):this._s.delete(c);return on;},contains(c){return this._s.has(c);}},
  textContent:'',appendChild(c){this.children.push(c);return c;},addEventListener(){},removeEventListener(){},
  getBoundingClientRect:()=>({left:0,top:0,width:900,height:620}),querySelector:()=>({style:{}}),querySelectorAll:()=>[],getContext:()=>makeCtx()};
  Object.defineProperty(el,'innerHTML',{get(){return this._h||'';},set(v){this._h=v;this.children=[];}}); return el; }
const els={},store={};
const sandbox={ console, performance:{now:()=>VT}, requestAnimationFrame:()=>1, cancelAnimationFrame:noop,
  setTimeout:(fn)=>setTimeout(fn,0), clearTimeout, Math, Date:VDate, JSON, Object, Array, String, Number, Boolean, Error, isNaN, parseInt, parseFloat,
  localStorage:{getItem:k=>(k in store?store[k]:null),setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}},
  window:{devicePixelRatio:1,addEventListener(){},AudioContext:undefined,webkitAudioContext:undefined},
  document:{getElementById:id=>els[id]||(els[id]=makeEl(id)),createElement:t=>makeEl('_'+t),querySelectorAll:()=>[],addEventListener(){},body:makeEl('body')} };
sandbox.globalThis=sandbox; vm.createContext(sandbox);
['config.js','audio.js','entities.js','renderer.js','game.js'].forEach(f=>vm.runInContext(fs.readFileSync(path.join('.','site','js',f),'utf8'),sandbox,{filename:f}));
vm.runInContext('globalThis.__x = { Game, STATE, LEVELS, PLANTS, ZOMBIES, CFG, Grid };', sandbox);
const { Game, STATE, LEVELS, PLANTS, CFG, Grid } = sandbox.__x;

const totalZombies = L => L.waves.reduce((s,w)=>s+sandbox.__x.parseTypes ? 0 : 0, 0);

function fullDefense(idx, label, layout) {
  const g = new Game();
  g.startLevel(idx);
  g.sun = 99999;
  const L = LEVELS[idx];
  // layout: {sunflower: [cols], peashooter:[cols], wallnut:[cols], snowpea:[...]}
  for (const [id, cols] of Object.entries(layout)) {
    for (let row = 0; row < 5; row++) for (const col of cols) {
      g.cooldowns = {}; g.selected = id; g.tryPlant(col, row);
    }
  }
  const dt = 1/60;
  let leaked = 0;
  const baseLeak = g.onZombieReachedHouse.bind(g);
  g.onZombieReachedHouse = z => { leaked++; baseLeak(z); };
  g.onFinish = () => {};

  for (let f = 0; f <= 300*60; f++) {
    advance(dt*1000);
    if (g.state !== STATE.PLAYING) break;
    g.update(dt, VT);
    g.suns.forEach(s => { if(!s.collected) g.collectSun(s); });
    g.sun = 99999;
  }
  const win = g.waveIndex >= L.waves.length && leaked === 0;
  console.log(`${label}: ${win ? '✅ 守住' : '❌ 被突破'} | 波次 ${g.waveIndex}/${L.waves.length} | 击杀 ${g.stats.killed} | 漏过 ${leaked} | 用时 ${Math.round(g.gameTime)}s`);
  return win;
}

console.log('=== A. 满防线能否守住关卡 1 ===');
fullDefense(0, '10🌻 + 15🌱(col2-4) + 5🌰(col7)', { sunflower:[0,1], peashooter:[2,3,4], wallnut:[7] });
fullDefense(0, '15🌱(col2-4) 无坚果', { peashooter:[2,3,4] });
fullDefense(0, '5🌱(col2仅1列)', { peashooter:[2] });
fullDefense(0, '10🌱(col2-3)', { peashooter:[2,3] });

console.log('\n=== B. 满防线能否守住关卡 3 ===');
fullDefense(2, '10🌻+10❄️+5🌰', { sunflower:[0,1], snowpea:[2,3], wallnut:[7] });
fullDefense(2, '10🌻+20🌱+5🌰', { sunflower:[0,1], peashooter:[2,3,4,5], wallnut:[7] });

console.log('\n=== C. 纯经济曲线（不种防御，看阳光涨多快）===');
{
  const g = new Game(); g.startLevel(0); g.onFinish=()=>{};
  const dt=1/60;
  let t=0;
  const marks=[];
  for (let f=0; f<=120*60; f++) {
    advance(dt*1000);
    if (g.state!==STATE.PLAYING) { marks.push(`[${Math.round(f/60)}s 被突破]`); break; }
    g.update(dt, VT);
    g.suns.forEach(s=>{ if(!s.collected) g.collectSun(s); });
    // 只种向日葵，never 防御
    if (f % 30 === 0 && g.sun >= 50 && (g.cooldowns.sunflower||0)<=VT) {
      outer: for (const col of [0,1]) for (let row=0;row<5;row++) {
        if (!g.grid[row][col]) { g.selected='sunflower'; g.tryPlant(col,row); break outer; }
      }
    }
    if (f % (15*60) === 0) marks.push(`${Math.round(f/60)}s: ☀️${g.sun} 🌻${g.plants.length} 🧟${g.zombies.length}`);
  }
  marks.forEach(m=>console.log('  '+m));
}

console.log('\n=== D. 第 1 关波次时间表（理论）===');
LEVELS[0].waves.forEach((w,i)=>{
  const types = sandbox.__x.parseTypes(w.types);
  console.log(`  波${i+1} @${w.at/1000}s: ${types.length}只 [${w.types}]${w.big?' (大波)':''}`);
});
console.log(`  波次总时长: ${LEVELS[0].waves[LEVELS[0].waves.length-1].at/1000}s，合计僵尸 ${LEVELS[0].waves.reduce((s,w)=>s+sandbox.__x.parseTypes(w.types).length,0)} 只`);
console.log('\n=== E. 各关僵尸总量 ===');
LEVELS.forEach(L=>{
  const n = L.waves.reduce((s,w)=>s+sandbox.__x.parseTypes(w.types).length,0);
  console.log(`  第${L.id}关: ${n} 只, 时长 ${(L.waves[L.waves.length-1]?.at||0)/1000}s, 起始阳光 ${L.sunStart}`);
});
