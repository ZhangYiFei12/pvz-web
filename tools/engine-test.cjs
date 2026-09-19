/* 引擎正确性测试：直接摆好满防线，验证僵尸能否被击杀 */
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
vm.runInContext('globalThis.__x = { Game, STATE, LEVELS, PLANTS, ZOMBIES, Sun, Plant, Zombie, CFG, Grid };', sandbox);
const { Game, STATE, LEVELS, PLANTS, Zombie, Sun, Plant, CFG, Grid } = sandbox.__x;

const g = new Game();
g.startLevel(0);
g.sun = 99999;

// 满防线：col0-1 向日葵，col2-4 豌豆，col7 坚果
for (let row = 0; row < 5; row++) {
  for (const col of [0,1]) { g.cooldowns = {}; g.selected='sunflower'; g.tryPlant(col,row); }
  for (const col of [2,3,4]) { g.cooldowns = {}; g.selected='peashooter'; g.tryPlant(col,row); }
  g.cooldowns = {}; g.selected='wallnut'; g.tryPlant(7,row);
}
console.log(`摆好防线: ${g.plants.length} 株植物 (期望 5*6=30)`);
console.log(`  向日葵=${g.plants.filter(p=>p.defId==='sunflower').length} 豌豆=${g.plants.filter(p=>p.defId==='peashooter').length} 坚果=${g.plants.filter(p=>p.defId==='wallnut').length}`);

// 手动放一只僵尸在 row0，观察
const z = new Zombie('basic', 0);
g.zombies.push(z);
const startX = z.x, startHp = z.hp;
console.log(`\n放置 1 只普通僵尸: row0, x=${startX.toFixed(0)}, hp=${startHp}`);

const dt = 1/60;
console.log('\nt(s) | 僵尸x | 僵尸hp | 子弹数 | 植物数 | 击杀');
for (let f = 0; f <= 60*60; f++) {
  advance(dt*1000);
  if (g.state === STATE.PLAYING) g.update(dt, VT);
  g.suns.forEach(s => { if(!s.collected) g.collectSun(s); });
  g.sun = 99999;
  if (f % (5*60) === 0) {
    console.log(`${String(Math.round(f/60)).padStart(4)} | ${z.x.toFixed(0).padStart(6)} | ${String(Math.round(z.hp)).padStart(6)} | ${String(g.projectiles.length).padStart(6)} | ${String(g.plants.length).padStart(6)} | ${g.stats.killed}`);
  }
  if (z.dead) { console.log(`\n✅ 僵尸在 ${(f/60).toFixed(1)}s 被击杀，挺进了 ${(startX - z.x).toFixed(0)}px`); break; }
  if (g.state !== STATE.PLAYING) { console.log(`\n❌ 状态变为 ${g.state} (僵尸到达房屋? reachedHouse=${z.reachedHouse})`); break; }
}
if (!z.dead && g.state === STATE.PLAYING) console.log(`\n⚠️ 60秒后僵尸仍存活: hpx=${z.x.toFixed(0)} hp=${z.hp.toFixed(0)} reachedHouse=${z.reachedHouse}`);
