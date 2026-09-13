/* 对线上 Cloudflare 站点跑真实浏览器验收（不依赖本地服务器） */
const { spawn } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BASE = process.argv[2] || 'https://pvz-web-br3.pages.dev';
const BROWSER = process.argv[3] || [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(p => fs.existsSync(p));

if (!BROWSER) { console.log('❌ 未找到浏览器'); process.exit(1); }

const get = u => new Promise((res, rej) => {
  https.get(u, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(d)); }).on('error', rej);
});

(async () => {
  console.log(`🌐 验证线上站点: ${BASE}`);
  console.log(`🖥️  浏览器: ${path.basename(BROWSER)}\n`);

  const probe = fs.readFileSync(path.join(__dirname, 'browser', 'probe.js'), 'utf8');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>live</title>
<link rel="stylesheet" href="${BASE}/css/style.css"></head><body>
<div id="menu-overlay"></div><div id="result-overlay" class="hidden"></div>
<div id="pause-overlay" class="hidden"></div><div id="help-overlay" class="hidden"></div>
<header id="hud"><div id="sun-box"><span id="sun-count">50</span></div>
<button id="btn-shovel"></button><button id="btn-pause"></button><button id="btn-sound"></button><button id="btn-auto"></button><button id="btn-help"></button>
<div id="level-badge"></div><div id="progress-bar"></div><div id="progress-flags"></div></header>
<div id="seedbar"></div>
<div id="stage"><canvas id="game"></canvas><div id="toast"></div></div>
<div id="level-select"></div><div id="best-score"></div><div id="best-level"></div>
<div id="result-title"></div><div id="result-stats"></div><div id="result-actions"></div>
<div id="btn-continue"></div><div id="btn-help2"></div><input type="checkbox" id="toggle-autocollect">
<script src="${BASE}/js/config.js"></script><script src="${BASE}/js/audio.js"></script>
<script src="${BASE}/js/entities.js"></script><script src="${BASE}/js/renderer.js"></script>
<script src="${BASE}/js/game.js"></script><script src="${BASE}/js/main.js"></script>
<script>${probe}</script>
</body></html>`;

  const tmp = path.join(os.tmpdir(), 'pvz-live-probe.html');
  fs.writeFileSync(tmp, html, 'utf8');
  const tmpUrl = 'file:///' + tmp.replace(/\\/g, '/');

  const dom = await new Promise((res, rej) => {
    const c = spawn(BROWSER, ['--headless=new', '--disable-gpu', '--no-sandbox',
      '--window-size=1100,880', '--virtual-time-budget=14000', '--dump-dom', tmpUrl],
      { stdio: ['ignore', 'pipe', 'ignore'] });
    let b = '';
    const t = setTimeout(() => { c.kill(); res(b); }, 90000);
    c.stdout.on('data', d => b += d);
    c.on('close', () => { clearTimeout(t); res(b); });
    c.on('error', rej);
  });

  try { fs.unlinkSync(tmp); } catch (e) {}

  const m = dom.match(/data-probe="([\s\S]*?)"/);
  if (!m) { console.log('❌ 未取到探针结果（线上资源可能加载失败）'); process.exit(1); }

  const un = s => s.replace(/&#10;/g, '\n').replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

  const lines = un(m[1]).split('\n').filter(Boolean);
  lines.forEach(l => {
    const [st, name, detail] = l.split(' | ');
    console.log(`  ${st === 'PASS' ? '✅' : '❌'} ${name}${detail ? '  → ' + detail : ''}`);
  });

  const failed = lines.filter(l => l.startsWith('FAIL'));
  console.log('\n============================');
  if (failed.length) {
    console.log(`❌ 线上验证 ${failed.length}/${lines.length} 项失败`);
    process.exit(1);
  }
  console.log(`✅ 线上站点真实浏览器验证全部通过 (${lines.length}/${lines.length})`);
})();
