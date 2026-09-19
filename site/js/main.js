/* ===========================================================
   main.js — 启动 / UI 绑定 / 输入事件
   HUD（阳光栏 / 种子槽 / 进度条）已全部画进画布，
   这里只负责弹窗层与输入。
   =========================================================== */

(function () {
  const canvas = document.getElementById('game');
  Renderer.init(canvas);

  const game = new Game();
  window.__game = game;   // 便于调试

  const $ = id => document.getElementById(id);

  /* ---------------- 主菜单 ---------------- */
  let progress = Game.loadProgress();

  function buildLevelSelect() {
    progress = Game.loadProgress();
    const wrap = $('level-select');
    wrap.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const locked = lv.id > (progress.unlocked || 1);
      const stars = (progress.stars && progress.stars[lv.id]) || 0;
      const el = document.createElement('div');
      el.className = 'level-card' + (locked ? ' locked' : '');
      el.innerHTML = `
        <div class="lv-num">${lv.endless ? '♾️ ENDLESS' : 'LEVEL ' + lv.code}</div>
        <div class="lv-name">${locked ? '🔒 ' : ''}${lv.name}</div>
        <div class="lv-desc">${lv.desc}</div>
        <div class="lv-stars">${locked ? '未解锁' : (stars ? '⭐'.repeat(stars) + '☆'.repeat(3 - stars) : '未通关')}</div>`;
      if (!locked) {
        el.addEventListener('click', () => { Sound.unlock(); Sound.click(); startGame(i); });
      }
      wrap.appendChild(el);
    });
    $('best-score').textContent = (progress.best || 0) + ' 分';
    $('best-level').textContent = Math.min(progress.unlocked || 1, LEVELS.length) + ' 关';
  }

  function showMenu() {
    game.state = STATE.MENU;
    buildLevelSelect();
    $('menu-overlay').classList.remove('hidden');
    $('result-overlay').classList.add('hidden');
    $('pause-overlay').classList.add('hidden');
  }

  function startGame(idx) {
    $('menu-overlay').classList.add('hidden');
    $('result-overlay').classList.add('hidden');
    $('pause-overlay').classList.add('hidden');
    Renderer.resize();
    game.startLevel(idx);
  }

  /* ---------------- 暂停 ---------------- */
  function togglePause() {
    if (game.state === STATE.PLAYING) game.state = STATE.PAUSED;
    else if (game.state === STATE.PAUSED) game.state = STATE.PLAYING;
    else return;
    $('pause-overlay').classList.toggle('hidden', game.state !== STATE.PAUSED);
  }
  game.onPauseRequest = () => { Sound.unlock(); togglePause(); };

  /* ---------------- 结算 ---------------- */
  game.onFinish = (win, score) => {
    const title = $('result-title');
    title.textContent = win ? '🎉 关卡通过！' : '💀 僵尸吃掉了你的脑子…';
    title.className = win ? 'win' : 'lose';

    const s = game.stats;
    $('result-stats').innerHTML = `
      <div class="stat"><span>最终得分</span><strong>${score}</strong></div>
      <div class="stat"><span>消灭僵尸</span><strong>${s.killed}</strong></div>
      <div class="stat"><span>种植植物</span><strong>${s.planted}</strong></div>
      <div class="stat"><span>收集阳光</span><strong>${s.sunCollected}</strong></div>
      <div class="stat"><span>抵挡波次</span><strong>${s.waves}</strong></div>
      <div class="stat"><span>用时</span><strong>${Math.floor(game.gameTime)} 秒</strong></div>`;

    const actions = $('result-actions');
    actions.innerHTML = '';
    const mk = (label, cls, fn) => {
      const b = document.createElement('button');
      b.className = 'btn ' + (cls || '');
      b.textContent = label;
      b.addEventListener('click', () => { Sound.unlock(); Sound.click(); fn(); });
      actions.appendChild(b);
    };

    if (win && game.levelIndex + 1 < LEVELS.length) {
      mk('进入下一关 →', 'primary', () => startGame(game.levelIndex + 1));
    }
    mk('重玩本关', win ? '' : 'primary', () => startGame(game.levelIndex));
    mk('返回主菜单', '', () => {
      $('result-overlay').classList.add('hidden');
      showMenu();
    });

    $('result-overlay').classList.remove('hidden');
  };

  /* ---------------- 设置：音效 / 自动拾取 ---------------- */
  const soundBtn = $('btn-sound');
  const autoBtn = $('btn-auto');
  const autoToggle = $('toggle-autocollect');

  function syncSettingsUI() {
    const sOn = Sound.isEnabled();
    if (soundBtn) {
      soundBtn.textContent = sOn ? '🔊 音效：开' : '🔇 音效：关';
      soundBtn.classList.toggle('muted', !sOn);
    }
    const aOn = game.autoCollect;
    if (autoBtn) {
      autoBtn.textContent = aOn ? '☀️ 自动拾取阳光：开' : '☀️ 自动拾取阳光：关';
      autoBtn.classList.toggle('active', aOn);
    }
    if (autoToggle) autoToggle.checked = aOn;
  }

  function setAuto(on) {
    game.setAutoCollect(on);
    syncSettingsUI();
    game.toast(on ? '已开启自动拾取阳光' : '已关闭自动拾取阳光');
  }

  if (soundBtn) soundBtn.addEventListener('click', () => {
    Sound.unlock();
    Sound.setEnabled(!Sound.isEnabled());
    syncSettingsUI();
  });
  if (autoBtn) autoBtn.addEventListener('click', () => { Sound.unlock(); setAuto(!game.autoCollect); });
  if (autoToggle) autoToggle.addEventListener('change', () => setAuto(autoToggle.checked));
  syncSettingsUI();

  /* ---------------- 弹窗 ---------------- */
  const helpOverlay = $('help-overlay');
  const openHelp = () => { Sound.unlock(); helpOverlay.classList.remove('hidden'); if (game.state === STATE.PLAYING) togglePause(); };
  const closeHelp = () => helpOverlay.classList.add('hidden');

  const helpBtn = $('btn-help');
  const helpBtn2 = $('btn-help2');
  if (helpBtn) helpBtn.addEventListener('click', openHelp);
  if (helpBtn2) helpBtn2.addEventListener('click', openHelp);
  helpOverlay.addEventListener('click', e => {
    if (e.target === helpOverlay || e.target.dataset.act === 'close-help') closeHelp();
  });

  $('pause-overlay').addEventListener('click', e => {
    const act = e.target.dataset.act;
    if (act === 'resume') togglePause();
    else if (act === 'restart') { $('pause-overlay').classList.add('hidden'); startGame(game.levelIndex); }
    else if (act === 'menu') { $('pause-overlay').classList.add('hidden'); showMenu(); }
  });

  /* ---------------- 画布输入 ---------------- */
  function toCanvasCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scale = Renderer.scale || 1;
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
  }

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    Sound.unlock();
    const { x, y } = toCanvasCoords(e.clientX, e.clientY);
    game.onPointerMove(x, y);
    game.onPointerDown(x, y);
  });

  canvas.addEventListener('pointermove', e => {
    const { x, y } = toCanvasCoords(e.clientX, e.clientY);
    game.onPointerMove(x, y);
  });

  canvas.addEventListener('pointerleave', () => { game.hover = null; });

  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    game.selected = null;
    game.shovelMode = false;
  });

  /* ---------------- 键盘 ---------------- */
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();

    if (k === ' ') {
      e.preventDefault();
      if (game.state === STATE.PLAYING || game.state === STATE.PAUSED) togglePause();
      return;
    }
    if (k === 'escape') {
      if (game.state === STATE.PLAYING) { game.selected = null; game.shovelMode = false; }
      return;
    }
    if (k === 's' && game.state === STATE.PLAYING) { game.toggleShovel(); return; }
    if (k === 'g') { setAuto(!game.autoCollect); return; }
    if (k === 'h') { openHelp(); return; }

    if (game.state === STATE.PLAYING && /^[1-9]$/.test(k)) {
      const idx = parseInt(k, 10) - 1;
      const rects = seedRects(game.level.plants);
      if (rects[idx]) game.selectPlant(rects[idx].id);
    }
  });

  /* ---------------- 启动 ---------------- */
  showMenu();
  game.lastFrame = performance.now();
  game.rafId = requestAnimationFrame(t => game.loop(t));
  window.addEventListener('resize', () => Renderer.resize());
})();
