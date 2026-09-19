#!/usr/bin/env node
/* ===========================================================
   live-verify.cjs — 对线上已部署站点跑真实浏览器验收

   做法：抓取线上 index.html → 把相对资源路径改写为线上绝对地址
   → 注入本地探针脚本 → 用本地服务打开（资源仍从线上 CDN 加载）。
   这样验证的是「真正部署的 HTML + 真正部署的资源」。

   用法: node tools/live-verify.cjs [线上地址]
   =========================================================== */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const BASE = (process.argv[2] || 'https://pvz-web-br3.pages.dev').replace(/\/$/, '');
const PORT = 8917;
const PROBE = path.join(__dirname, 'browser', 'probe.js');

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchText(new URL(res.headers.location, url).href).then(resolve, reject);
      }
      let d = '';
      res.setEncoding('utf8');
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', reject);
  });
}

function findBrowser() {
  return [
    process.env.CHROME_PATH,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean).find(p => { try { return fs.existsSync(p); } catch { return false; } });
}

(async () => {
  const browser = findBrowser();
  if (!browser) { console.log('⚠️  未找到 Chrome/Edge，跳过线上验证'); process.exit(0); }

  console.log(`🌐 验证线上站点: ${BASE}`);
  console.log(`🖥️  浏览器: ${path.basename(browser)}\n`);

  // 1) 抓取线上首页
  let index;
  try {
    index = await fetchText(BASE + '/');
  } catch (e) {
    console.log('❌ 无法访问线上站点:', e.message);
    process.exit(1);
  }
  if (index.status !== 200) { console.log('❌ 首页返回 HTTP', index.status); process.exit(1); }

  let html = index.body;

  // 2) 相对资源路径 → 线上绝对地址（保证加载的是线上 CDN 上的文件）
  html = html.replace(/(href|src)="(?!https?:|\/\/|data:)([^"]+)"/g,
    (m, attr, p) => `${attr}="${BASE}/${p.replace(/^\.?\//, '')}"`);

  // 3) 注入探针（探针本身不部署，从本地读取）
  const probe = fs.readFileSync(PROBE, 'utf8');
  html = html.replace('</body>', `<script>${probe}</script>\n</body>`);

  // 4) 本地起服务托管改写后的页面（脚本仍从线上加载）
  let PAGE = html;
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(PAGE);
  });
  await new Promise(r => server.listen(PORT, r));

  // 5) 跑 headless 浏览器
  let dom;
  try {
    dom = await new Promise((resolve, reject) => {
      const c = spawn(browser, ['--headless=new', '--disable-gpu', '--no-sandbox',
        '--window-size=1100,880', '--virtual-time-budget=14000', '--dump-dom',
        `http://localhost:${PORT}/`], { stdio: ['ignore', 'pipe', 'ignore'] });
      let b = '';
      const t = setTimeout(() => { c.kill(); reject(new Error('浏览器超时')); }, 90000);
      c.stdout.on('data', d => b += d);
      c.on('close', () => { clearTimeout(t); resolve(b); });
      c.on('error', reject);
    });
  } catch (e) {
    console.log('❌ 浏览器执行失败:', e.message);
    server.close();
    process.exit(1);
  }
  server.close();

  const m = dom.match(/data-probe="([\s\S]*?)"/);
  if (!m) {
    console.log('❌ 未取到探针结果（线上资源可能加载失败）');
    process.exit(1);
  }

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
