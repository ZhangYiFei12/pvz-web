#!/usr/bin/env node
/* ===========================================================
   真实浏览器验收测试
   用 headless Edge/Chrome 加载游戏页面，跑像素级断言。

   用法: node tools/browser-test.cjs [项目根目录]
   =========================================================== */

const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(process.argv[2] || '.');   // 项目根（probe.html 通过 /site/ 前缀引用线上文件）
const PORT = 8917;

/* ---------- 静态文件服务 ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
};

function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(PORT, () => resolve(server));
  });
}

/* ---------- 查找浏览器 ---------- */
function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ].filter(Boolean);
  return candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });
}

(async () => {
  const server = await startServer();
  const browser = findBrowser();

  if (!browser) {
    console.log('⚠️  未找到 Chrome/Edge，跳过真实浏览器测试');
    console.log('   可设置环境变量 CHROME_PATH 指定浏览器路径');
    server.close();
    process.exit(0);
  }

  console.log(`🌐 浏览器: ${path.basename(browser)}`);
  console.log(`📁 服务根目录: ${ROOT}\n`);

  let dom;
  try {
    dom = await new Promise((resolve, reject) => {
      const args = [
        '--headless=new', '--disable-gpu', '--no-sandbox',
        '--window-size=1100,880', '--virtual-time-budget=9000',
        '--dump-dom', `http://localhost:${PORT}/tools/browser/probe.html`,
      ];
      const child = spawn(browser, args, { stdio: ['ignore', 'pipe', 'ignore'] });
      let buf = '';
      const timer = setTimeout(() => { child.kill(); reject(new Error('浏览器超时 (90s)')); }, 90000);
      child.stdout.on('data', d => { buf += d; });
      child.on('error', e => { clearTimeout(timer); reject(e); });
      child.on('close', () => { clearTimeout(timer); resolve(buf); });
    });
  } catch (e) {
    console.log('❌ 浏览器执行失败:', e.message);
    server.close();
    process.exit(1);
  }

  server.close();

  const m = dom.match(/data-probe="([\s\S]*?)"/);
  if (!m) {
    console.log('❌ 未能取到探针结果（页面可能未加载完成）');
    process.exit(1);
  }

  const unescape = s => s
    .replace(/&#10;/g, '\n').replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

  const lines = unescape(m[1]).split('\n').filter(Boolean);
  lines.forEach(l => {
    const [st, name, detail] = l.split(' | ');
    const icon = st === 'PASS' ? '✅' : '❌';
    console.log(`  ${icon} ${name}${detail ? '  → ' + detail : ''}`);
  });

  const failed = lines.filter(l => l.startsWith('FAIL'));
  console.log('\n============================');
  if (failed.length) {
    console.log(`❌ 真实浏览器测试 ${failed.length}/${lines.length} 项失败`);
    process.exit(1);
  }
  console.log(`✅ 真实浏览器测试全部通过 (${lines.length}/${lines.length})`);
})();
