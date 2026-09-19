#!/usr/bin/env node
/* 完整通关实测：真实浏览器 + 虚拟时钟，自动打完一关 */
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), http = require('http');

const ROOT = path.resolve(process.argv[2] || '.');
const LEVEL = parseInt(process.argv[3] || '0', 10);
const PORT = 8941;
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8' };

const PLAY_JS = `
window.__VT = 1700000000000; performance.now = () => window.__VT;
window.__err = []; addEventListener('error', e => window.__err.push(e.message));
setTimeout(() => {
  const out = [];
  try {
    const G = window.__game;
    const cards = document.querySelectorAll('.level-card');
    if (cards[${LEVEL}]) cards[${LEVEL}].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    if (!G.level) G.startLevel(${LEVEL});   // 未解锁的关卡直接启动
    if (!G.level) { document.body.setAttribute('data-r', '无法启动关卡 ${LEVEL}'); document.title='DONE'; return; }
    out.push('进入关卡=' + G.level.code + ' ' + G.level.name);
    const P = G.level.plants;
    const T = () => window.__VT;
    for (let f = 0; f < 500 * 60; f++) {
      window.__VT += 1000 / 60;
      if (G.state !== 'playing') break;
      G.update(1 / 60, T());
      G.suns.forEach(s => { if (!s.collected) G.collectSun(s); });
      if (f % 18) continue;
      const front = {};
      G.zombies.forEach(z => { if (!z.dead && z.x < CFG.W) front[z.row] = Math.min(front[z.row] ?? 1e9, z.x); });
      const rows = Object.keys(front).map(Number);
      // 炸弹救场
      let bombed = false;
      for (const r of rows) {
        if (bombed) break;
        if (front[r] > Grid.cellCX(2)) continue;
        for (const k of ['cherrybomb','jalapeno']) {
          if (!P.includes(k) || G.sun < PLANTS[k].cost || (G.cooldowns[k]||0) > T()) continue;
          const c = Math.max(0, Math.min(CFG.COLS-2, Grid.colAt(front[r]) + 1));
          if (G.grid[r][c]) continue;
          G.selected = k; G.tryPlant(c, r); bombed = true; break;
        }
      }
      // 经济
      if (G.plants.filter(p=>p.defId==='sunflower').length < 10 && G.sun >= 50 && (G.cooldowns.sunflower||0) <= T()) {
        o: for (const c of [0,1]) for (let r = 0; r < 5; r++) {
          if (!G.grid[r][c]) { G.selected='sunflower'; G.tryPlant(c,r); break o; }
        }
      }
      // 坚果
      if (P.includes('wallnut') && G.sun >= 50 && (G.cooldowns.wallnut||0) <= T()) {
        for (const r of rows) for (const c of [8,7]) if (!G.grid[r][c]) { G.selected='wallnut'; G.tryPlant(c,r); break; }
      }
      // 输出
      const pick = () => { for (const s of ['repeater','snowpea','peashooter']) if (P.includes(s) && G.sun >= PLANTS[s].cost && (G.cooldowns[s]||0) <= T()) return s; return null; };
      o2: for (const r of [...rows,0,1,2,3,4].filter((v,i,a)=>a.indexOf(v)===i)) {
        for (const c of [2,3,4,5,6]) {
          if (G.grid[r][c]) continue;
          const s = pick(); if (!s) break o2;
          G.selected = s; G.tryPlant(c, r); break;
        }
      }
    }
    const prog = JSON.parse(localStorage.getItem('pvz-web-progress') || '{}');
    out.push('最终状态=' + G.state);
    out.push('波次=' + G.waveIndex + '/' + (G.level.waves.length || '∞'));
    out.push('击杀=' + G.stats.killed + '  漏过=' + (G.stats.leaked || 0));
    out.push('存活植物=' + G.plants.length + '  用过小推车=' + G.mowers.filter(m=>m.used).length + '/5');
    out.push('用时=' + Math.round(G.gameTime) + '秒');
    out.push('结算面板=' + (document.getElementById('result-overlay').classList.contains('hidden') ? '未弹出' : '已弹出'));
    out.push('解锁到第' + prog.unlocked + '关');
    out.push('JS错误=' + (window.__err.length ? window.__err.join(';') : '无'));
  } catch (e) { out.push('异常=' + e.message + ' @ ' + (e.stack||'').split('\\n')[1]); }
  document.body.setAttribute('data-r', out.join('\\n'));
  document.title = 'DONE';
}, 600);
`;

let PLAY_HTML = '';
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/__play') { res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'}); res.end(PLAY_HTML); return; }
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const BROWSER = [process.env.CHROME_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find(p => { try { return fs.existsSync(p); } catch { return false; } });

server.listen(PORT, async () => {
  const probeHtml = fs.readFileSync(path.join(ROOT, 'tools/browser/probe.html'), 'utf8')
    .replace('<script src="/tools/browser/probe.js"></script>', '<script>' + PLAY_JS + '</script>');
  PLAY_HTML = probeHtml;

  const dom = await new Promise((res, rej) => {
    const c = spawn(BROWSER, ['--headless=new','--disable-gpu','--no-sandbox',
      '--window-size=1100,900','--virtual-time-budget=120000','--dump-dom',
      `http://localhost:${PORT}/__play`], { stdio:['ignore','pipe','ignore'] });
    let b=''; const t=setTimeout(()=>{c.kill();res(b);},120000);
    c.stdout.on('data',d=>b+=d);
    c.on('close',()=>{clearTimeout(t);res(b);});
    c.on('error',rej);
  });
  server.close();

  const m = dom.match(/data-r="([\s\S]*?)"/);
  if (!m) { console.log('❌ 未取到结果'); process.exit(1); }
  const un = s => s.replace(/&#10;/g,'\n').replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  console.log(un(m[1]));
  const txt = un(m[1]);
  process.exit(/最终状态=result/.test(txt) && /漏过=0/.test(txt) && /JS错误=无/.test(txt) ? 0 : 1);
});
