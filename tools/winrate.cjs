const fs=require('fs'),path=require('path'),vm=require('vm');
let VT=1700000000000;const advance=ms=>{VT+=ms;};
const VDate=new Proxy(Date,{get(t,p){if(p==='now')return()=>VT;const v=t[p];return typeof v==='function'?v.bind(t):v;}});
const noop=()=>{};
const makeCtx=()=>new Proxy({},{get:(t,p)=>{if(p==='createLinearGradient'||p==='createRadialGradient')return()=>({addColorStop:noop});if(p==='measureText')return()=>({width:10});return p in t?t[p]:noop;},set:(t,p,v)=>{t[p]=v;return true;}});
function makeEl(id){const el={id,tagName:'DIV',dataset:{},style:{},children:[],offsetWidth:100,clientWidth:900,clientHeight:620,
 classList:{_s:new Set(),add(...c){c.forEach(x=>this._s.add(x));},remove(...c){c.forEach(x=>this._s.delete(x));},toggle(c,f){const on=f===undefined?!this._s.has(c):!!f;on?this._s.add(c):this._s.delete(c);return on;},contains(c){return this._s.has(c);}},
 textContent:'',appendChild(c){this.children.push(c);return c;},addEventListener(){},removeEventListener(){},
 getBoundingClientRect:()=>({left:0,top:0,width:900,height:620}),querySelector:()=>({style:{}}),querySelectorAll:()=>[],getContext:()=>makeCtx()};
 Object.defineProperty(el,'innerHTML',{get(){return this._h||'';},set(v){this._h=v;this.children=[];}});return el;}
const els={},store={};
const sandbox={console,performance:{now:()=>VT},requestAnimationFrame:()=>1,cancelAnimationFrame:noop,
 setTimeout:(fn)=>setTimeout(fn,0),clearTimeout,Math,Date:VDate,JSON,Object,Array,String,Number,Boolean,Error,isNaN,parseInt,parseFloat,
 localStorage:{getItem:k=>(k in store?store[k]:null),setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}},
 window:{devicePixelRatio:1,addEventListener(){},AudioContext:undefined,webkitAudioContext:undefined},
 document:{getElementById:id=>els[id]||(els[id]=makeEl(id)),createElement:t=>makeEl('_'+t),querySelectorAll:()=>[],addEventListener(){},body:makeEl('body')}};
sandbox.globalThis=sandbox;vm.createContext(sandbox);
['config.js', 'audio.js', 'sprites.js', 'sprites-zombie.js', 'entities.js', 'renderer-hud.js', 'renderer.js', 'game.js'].forEach(f=>vm.runInContext(fs.readFileSync(path.join('.','site','js',f),'utf8'),sandbox,{filename:f}));
vm.runInContext('globalThis.__x={Game,STATE,LEVELS,PLANTS,CFG,Grid};',sandbox);
const {Game,STATE,LEVELS,PLANTS,CFG,Grid}=sandbox.__x;

function play(idx,skill){
 const g=new Game();g.startLevel(idx);const L=LEVELS[idx];const dt=1/60;
 g.onFinish=(win)=>{g.__win=win;};
 const can=id=>L.plants.includes(id);
 const cdOk=id=>(g.cooldowns[id]||0)<=VT;
 const nSun=()=>g.plants.filter(p=>p.defId==='sunflower').length;
 const offsets=[0,1,2,3,4];
 for(let f=0;f<=600*60;f++){
  advance(dt*1000);
  if(g.state!==STATE.PLAYING)break;
  g.update(dt,VT);
  g.suns.forEach(s=>{if(!s.collected)g.collectSun(s);});
  // skill: 反应延迟（帧）
  if(f%skill!==0)continue;
  const front={};
  g.zombies.forEach(z=>{if(!z.dead&&z.x<CFG.W)front[z.row]=Math.min(front[z.row]??1e9,z.x);});
  const rowsZ=Object.keys(front).map(Number);
  // 救场炸弹
  let bombed=false;
  for(const row of rowsZ){
   if(bombed)break;
   if(front[row]>Grid.cellCX(2))continue;
   for(const b of ['cherrybomb','jalapeno']){
    if(!can(b)||g.sun<PLANTS[b].cost||!cdOk(b))continue;
    const col=Math.max(0,Math.min(CFG.COLS-2,Grid.colAt(front[row])+1));
    if(g.grid[row][col])continue;
    g.selected=b;g.tryPlant(col,row);bombed=true;break;
   }
  }
  if(nSun()<10&&g.sun>=50&&cdOk('sunflower')&&can('sunflower')){
   o:for(const col of [0,1])for(let row=0;row<5;row++){if(!g.grid[row][col]){g.selected='sunflower';g.tryPlant(col,row);break o;}}
  }
  if(can('wallnut')&&g.sun>=50&&cdOk('wallnut')){
   for(const row of rowsZ){for(const wc of [8,7]){if(!g.grid[row][wc]){g.selected='wallnut';g.tryPlant(wc,row);break;}}}
  }
  const pick=()=>{for(const s of ['repeater','snowpea','peashooter'])if(can(s)&&g.sun>=PLANTS[s].cost&&cdOk(s))return s;return null;};
  const order=[...rowsZ,0,1,2,3,4].filter((v,i,a)=>a.indexOf(v)===i);
  o2:for(const row of order){for(const col of [2,3,4,5,6,7,8]){if(g.grid[row][col])continue;const s=pick();if(!s)break o2;g.selected=s;g.tryPlant(col,row);break;}}
 }
 return {win:!!g.__win,sec:Math.round(g.gameTime),killed:g.stats.killed,leaked:g.stats.leaked||0,waves:g.waveIndex};
}

console.log('每关 8 次试玩（AI 决策间隔 18 帧 ≈ 0.3s）\n');
for(let i=0;i<LEVELS.length;i++){
 const L=LEVELS[i];
 if(L.endless){
  const rs=[];for(let k=0;k<5;k++)rs.push(play(i,18));
  const avg=Math.round(rs.reduce((s,r)=>s+r.sec,0)/rs.length);
  console.log(`第 ${L.id} 关 ${L.name}: ♾️ 平均坚持 ${avg}s, 击杀 ${Math.round(rs.reduce((s,r)=>s+r.killed,0)/rs.length)}`);
  continue;
 }
 let wins=0;const details=[];
 for(let k=0;k<8;k++){const r=play(i,18);if(r.win)wins++;details.push(`${r.win?'W':'L'}(${r.killed}杀/${r.leaked}漏)`);}
 const rate=Math.round(wins/8*100);
 const bar='█'.repeat(wins)+'░'.repeat(8-wins);
 console.log(`第 ${L.id} 关 ${L.name}: ${bar} ${rate}%  ${details.join(' ')}`);
}
