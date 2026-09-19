#!/usr/bin/env node
/* ===========================================================
   preview-map.cjs — 把渲染结果转成 ASCII 色彩图，便于终端审视画面
   用法: node tools/preview-map.cjs [项目根]
   =========================================================== */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');

const ROOT = path.resolve(process.argv[2] || '.');
const PORT = 8921;
const COLS = 96, ROWS = 40;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

let PREVIEW_HTML = '';
function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/__preview') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(PREVIEW_HTML); return;
      }
      if (p === '/') p = '/index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('nf'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(PORT, () => resolve(server));
  });
}

function findBrowser() {
  return [
    process.env.CHROME_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium',
  ].filter(Boolean).find(p => { try { return fs.existsSync(p); } catch { return false; } });
}

const MAP_JS = `
window.__VT = 1700000000000; performance.now = () => window.__VT;
window.__err = []; addEventListener('error', e => window.__err.push(e.message));
setTimeout(() => {
  try {
    const G = window.__game;
    if (!G) { document.body.setAttribute('data-map', 'DIAG: __game missing; cards=' + document.querySelectorAll('.level-card').length + '; R=' + (typeof Renderer) + '; C=' + (typeof CFG)); document.title='DONE'; return; }
    const card = document.querySelector('.level-card');
    if (!card) { document.body.setAttribute('data-map', 'DIAG: no card; cards=' + document.querySelectorAll('.level-card').length + '; lvsel=' + (document.getElementById('level-select')||{}).innerHTML); document.title='DONE'; return; }
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    G.sun = 9999; G.introUntil = 0;
    const put = (id, c, r) => { G.selected = id; G.cooldowns = {}; G.tryPlant(c, r); };
    for (let r = 0; r < 5; r++) {
      put('sunflower', 0, r); put('peashooter', 1, r);
      put('snowpea', 2, r); put('repeater', 3, r); put('wallnut', 6, r);
    }
    put('cherrybomb', 4, 1);
    put('potatomine', 5, 3);
    G.spawnWave('basic*1,cone*1,bucket*1,football*1,gargantuar*1,newspaper*1,screen*1');
    G.zombies.forEach((z, i) => { z.x = 300 + i * 92; z.y = Grid.cellCY(i % 5) + 6; });
    G.suns.push(new Sun(700, 300, 300, 'plant'));
    G.suns.push(new Sun(820, 480, 480, 'plant'));
    for (let i = 0; i < 40; i++) G.update(1/60, window.__VT + i * 16);
    G.introUntil = 0;
    Renderer.draw(G);

    const cv = document.getElementById('game'), ctx = cv.getContext('2d');
    const W = ${COLS}, H = ${ROWS};
    const rows = [];
    for (let j = 0; j < H; j++) {
      let line = '';
      for (let i = 0; i < W; i++) {
        const x = Math.round((i + .5) / W * cv.width);
        const y = Math.round((j + .5) / H * cv.height);
        const d = ctx.getImageData(x, y, 1, 1).data;
        line += classify(d[0], d[1], d[2]);
      }
      rows.push(line);
    }
    document.body.setAttribute('data-map', rows.join('\\n'));
    document.body.setAttribute('data-err', window.__err.join(';') || 'none');
  } catch (e) {
    document.body.setAttribute('data-map', 'EXC: ' + e.message);
  }
  document.title = 'DONE';
}, 600);

function classify(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), v = mx / 255, sat = mx ? (mx - mn) / mx : 0;
  // 近黑 → 描边
  if (v < 0.20) return '@';
  // 低饱和
  if (sat < 0.16) {
    if (v > 0.86) return '*';      // 白
    if (v > 0.6) return '+';       // 浅灰
    if (v > 0.35) return '-';      // 灰
    return '@';
  }
  const h = (() => {
    if (mx === mn) return 0;
    let hh;
    if (mx === r) hh = ((g - b) / (mx - mn)) % 6;
    else if (mx === g) hh = (b - r) / (mx - mn) + 2;
    else hh = (r - g) / (mx - mn) + 4;
    return (hh * 60 + 360) % 360;
  })();
  // 蓝青（天空）
  if (h >= 170 && h < 250) return v > .7 ? '.' : 'c';
  // 绿
  if (h >= 70 && h < 170) {
    if (v > .78 && sat > .45) return 'Y';   // 亮黄绿（豌豆/亮草）
    if (h < 95 && sat > .5 && v > .55) return 'y';  // 黄绿
    return v > .55 ? ':' : ';';             // 草坪
  }
  // 黄 / 橙（阳光、木质）
  if (h >= 35 && h < 70) {
    if (v > .8) return 'O';                 // 亮黄
    return v > .5 ? 'w' : '#';              // 木色
  }
  // 红 / 橙红
  if (h < 20 || h >= 340) return v > .5 ? 'R' : 'r';
  // 棕（房屋砖墙）
  if (h >= 20 && h < 35) return v > .6 ? 'w' : '#';
  // 紫（僵尸衣服 / 大嘴花）
  if (h >= 250 && h < 340) return v > .45 ? 'P' : 'p';
  return '?';
}
`;

(async () => {
  const server = await startServer();
  const browser = findBrowser();
  if (!browser) { console.log('未找到浏览器'); server.close(); process.exit(1); }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/site/css/style.css"></head><body>
<div id="stage"><canvas id="game"></canvas><div id="toast" class="hidden"></div>
<div id="pause-overlay" class="overlay hidden"><div class="panel"><div class="btn-row">
<button id="btn-sound" class="btn small"></button><button id="btn-auto" class="btn small"></button></div></div></div></div>
<div id="menu-overlay" class="overlay"><div class="panel wide"><div id="level-select"></div>
<div class="btn-row"><button id="btn-help2" class="btn"></button></div>
<div class="best-box"><strong id="best-score"></strong><strong id="best-level"></strong></div></div></div>
<div id="result-overlay" class="overlay hidden"><div class="panel"><h2 id="result-title"></h2>
<div id="result-stats"></div><div class="btn-row" id="result-actions"></div></div></div>
<div id="help-overlay" class="overlay hidden"><div class="panel wide"><div class="help-grid"></div>
<label class="switch-row"><input type="checkbox" id="toggle-autocollect">
<span class="switch-track"><span class="switch-knob"></span></span><span class="switch-label"></span></label>
<div class="btn-row"><button class="btn primary" data-act="close-help"></button></div></div></div>
<script src="/site/js/config.js"></script><script src="/site/js/audio.js"></script>
<script src="/site/js/sprites.js"></script><script src="/site/js/sprites-zombie.js"></script>
<script src="/site/js/entities.js"></script><script src="/site/js/renderer-hud.js"></script>
<script src="/site/js/renderer.js"></script><script src="/site/js/game.js"></script>
<script src="/site/js/main.js"></script>
<script>${MAP_JS}</script>
</body></html>`;

  PREVIEW_HTML = html;

  const dom = await new Promise((res, rej) => {
    const c = spawn(browser, ['--headless=new', '--disable-gpu', '--no-sandbox',
      '--window-size=1100,900', '--virtual-time-budget=12000', '--dump-dom',
      `http://localhost:${PORT}/__preview`], { stdio: ['ignore', 'pipe', 'ignore'] });
    let b = '';
    const t = setTimeout(() => { c.kill(); res(b); }, 60000);
    c.stdout.on('data', d => b += d);
    c.on('close', () => { clearTimeout(t); res(b); });
    c.on('error', rej);
  });

  server.close();

  const m = dom.match(/data-map="([\s\S]*?)"/);
  if (!m) { console.log('❌ 未取到渲染结果'); process.exit(1); }
  const map = m[1].replace(/&#10;/g, '\n').replace(/&amp;/g, '&');
  const err = (dom.match(/data-err="([^"]*)"/) || [])[1];

  console.log('图例: @描边/暗  *白  +浅灰  -灰  .天空  c青  :亮草  ;暗草  Y亮黄绿  y黄绿');
  console.log('      O阳光/金黄  w浅木  #深木/棕  R红  r暗红  P紫  p暗紫  ?其他');
  console.log('─'.repeat(COLS + 2));
  map.split('\n').forEach(l => console.log(' ' + l));
  console.log('─'.repeat(COLS + 2));
  console.log('JS 错误:', err || 'none');
})();
