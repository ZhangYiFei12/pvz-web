/* ===========================================================
   main.js — 启动 / UI 绑定 / 输入事件
   =========================================================== */

(function () {
  const canvas = document.getElementById('game');
  Renderer.init(canvas);

  const game = new Game();
  window.__game = game;   // 便于调试

  /* ---------------- 种子卡（根据关卡生成） ---------------- */
  function buildSeedBar(level) {
    const bar = document.getElementById('seedbar');
    bar.innerHTML = '';
    level.plants.forEach((id, i) => {
      const def = PLANTS[id];
      const el = document.createElement('div');
      el.className = 'seed';
      el.dataset.plant = id;
      el.title = `${def.name} — ${def.desc}（${def.cost} 阳光）`;
      el.innerHTML = `
        <span class="key">${i + 1}</span>
        <span class="emoji">${def.emoji}</span>
        <span class="name">${def.name}</span>
        <span class="cost">${def.cost}</span>
        <div class="cd-mask"></div>`;
      el.addEventListener('click', () => {
        Sound.unlock();
        game.selectPlant(id);
      });
      bar.appendChild(el);
    });
  }

  /* ---------------- 主菜单 ---------------- */
  const progress = Game.loadProgress();

  function buildLevelSelect() {
    const wrap = document.getElementById('level-select');
    wrap.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const locked = lv.id > (progress.unlocked || 1);
      const stars = (progress.stars && progress.stars[lv.id]) || 0;
      const el = document.createElement('div');
      el.className = 'level-card' + (locked ? ' locked' : '');
      el.innerHTML = `
        <div class="lv-num">${lv.endless ? '♾️ ENDLESS' : 'LEVEL ' + lv.id}</div>
        <div class="lv-name">${locked ? '🔒 ' : ''}${lv.name}</div>
        <div class="lv-desc">${lv.desc}</div>
        <div class="lv-stars">${locked ? '未解锁' : (stars ? '⭐'.repeat(stars) + '☆'.repeat(3 - stars) : '未通关')}</div>`;
      if (!locked) {
        el.addEventListener('click', () => {
          Sound.unlock();
          Sound.click();
          startGame(i);
        });
      }
      wrap.appendChild(el);
    });

    document.getElementById('best-score').textContent = (progress.best || 0) + ' 分';
    document.getElementById('best-level').textContent = Math.min(progress.unlocked || 1, LEVELS.length) + ' 关';
  }

  function showMenu() {
    game.state = STATE.MENU;
    buildLevelSelect();
    document.getElementById('menu-overlay').classList.remove('hidden');
    document.getElementById('result-overlay').classList.add('hidden');
    document.getElementById('pause-overlay').classList.add('hidden');
    document.getElementById('hud').style.visibility = 'hidden';
    document.getElementById('seedbar').style.visibility = 'hidden';
  }

  function startGame(idx) {
    document.getElementById('menu-overlay').classList.add('hidden');
    document.getElementById('result-overlay').classList.add('hidden');
    document.getElementById('pause-overlay').classList.add('hidden');
    document.getElementById('hud').style.visibility = 'visible';
    document.getElementById('seedbar').style.visibility = 'visible';

    buildSeedBar(LEVELS[idx]);
    Renderer.resize();
    game.startLevel(idx);
    game.syncUI();
  }

  /* ---------------- 暂停 ---------------- */
  function togglePause(force) {
    if (game.state === STATE.PLAYING) game.state = STATE.PAUSED;
    else if (game.state === STATE.PAUSED) game.state = STATE.PLAYING;
    else return;
    const isPaused = game.state === STATE.PAUSED;
    document.getElementById('pause-overlay').classList.toggle('hidden', !isPaused);
    document.getElementById('btn-pause').textContent = isPaused ? '▶️' : '⏸️';
  }

  /* ---------------- 结算 ---------------- */
  game.onFinish = (win, score) => {
    const title = document.getElementById('result-title');
    title.textContent = win ? '🎉 关卡通过！' : '💀 僵尸吃掉了你的脑子…';
    title.className = win ? 'win' : 'lose';

    const s = game.stats;
    document.getElementById('result-stats').innerHTML = `
      <div class="stat"><span>最终得分</span><strong>${score}</strong></div>
      <div class="stat"><span>消灭僵尸</span><strong>${s.killed}</strong></div>
      <div class="stat"><span>种植植物</span><strong>${s.planted}</strong></div>
      <div class="stat"><span>收集阳光</span><strong>${s.sunCollected}</strong></div>
      <div class="stat"><span>抵挡波次</span><strong>${s.waves}</strong></div>
      <div class="stat"><span>用时</span><strong>${Math.floor(game.gameTime)} 秒</strong></div>`;

    const actions = document.getElementById('result-actions');
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
      game.state = STATE.MENU;
      document.getElementById('result-overlay').classList.add('hidden');
      showMenu();
    });

    document.getElementById('result-overlay').classList.remove('hidden');
  };

  /* ---------------- HUD 按钮 ---------------- */
  document.getElementById('btn-shovel').addEventListener('click', () => { Sound.unlock(); game.toggleShovel(); });
  document.getElementById('btn-pause').addEventListener('click', () => { Sound.unlock(); togglePause(); });

  const soundBtn = document.getElementById('btn-sound');
  function syncSoundBtn() {
    const on = Sound.isEnabled();
    soundBtn.textContent = on ? '🔊' : '🔇';
    soundBtn.classList.toggle('muted', !on);
  }
  soundBtn.addEventListener('click', () => {
    Sound.unlock();
    Sound.setEnabled(!Sound.isEnabled());
    syncSoundBtn();
  });
  syncSoundBtn();

  const helpOverlay = document.getElementById('help-overlay');
  const openHelp = () => { Sound.unlock(); helpOverlay.classList.remove('hidden'); if (game.state === STATE.PLAYING) togglePause(); };
  const closeHelp = () => helpOverlay.classList.add('hidden');

  /* ---------------- 自动拾取阳光 ---------------- */
  const autoBtn = document.getElementById('btn-auto');
  const autoToggle = document.getElementById('toggle-autocollect');

  function syncAutoUI() {
    const on = game.autoCollect;
    if (autoBtn) {
      autoBtn.classList.toggle('active', on);
      autoBtn.title = on ? '自动拾取阳光：已开启 (G)' : '自动拾取阳光：已关闭 (G)';
    }
    if (autoToggle) autoToggle.checked = on;
  }
  function setAuto(on) {
    game.setAutoCollect(on);
    syncAutoUI();
    game.toast(on ? '已开启自动拾取阳光' : '已关闭自动拾取阳光');
  }
  if (autoBtn) autoBtn.addEventListener('click', () => { Sound.unlock(); setAuto(!game.autoCollect); });
  if (autoToggle) autoToggle.addEventListener('change', () => setAuto(autoToggle.checked));
  syncAutoUI();
  document.getElementById('btn-help').addEventListener('click', openHelp);
  document.getElementById('btn-help2').addEventListener('click', openHelp);
  helpOverlay.addEventListener('click', e => {
    if (e.target === helpOverlay || e.target.dataset.act === 'close-help') closeHelp();
  });

  document.getElementById('pause-overlay').addEventListener('click', e => {
    const act = e.target.dataset.act;
    if (act === 'resume') togglePause();
    else if (act === 'restart') { document.getElementById('pause-overlay').classList.add('hidden'); startGame(game.levelIndex); }
    else if (act === 'menu') { document.getElementById('pause-overlay').classList.add('hidden'); showMenu(); }
  });

  /* ---------------- 画布输入 ---------------- */
  function toCanvasCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scale = Renderer.scale || 1;
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
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
    game.syncUI();
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
    if (k === 'escape' && game.state === STATE.PLAYING) {
      game.selected = null; game.shovelMode = false; game.syncUI();
      return;
    }
    if (k === 's' && game.state === STATE.PLAYING) { game.toggleShovel(); return; }
    if (k === 'g') { setAuto(!game.autoCollect); return; }
    if (k === 'h') { openHelp(); return; }

    if (game.state === STATE.PLAYING && /^[1-9]$/.test(k)) {
      const idx = parseInt(k, 10) - 1;
      const bar = document.getElementById('seedbar');
      const el = bar.children[idx];
      if (el) game.selectPlant(el.dataset.plant);
    }
  });

  /* ---------------- 震屏：包一层 draw ---------------- */
  const originalDraw = Renderer.draw;
  Renderer.draw = function (g) {
    const off = g.shakeOffset;
    const ctx = Renderer.ctx;
    ctx.save();
    if (off.x || off.y) ctx.translate(off.x, off.y);
    originalDraw(g);
    ctx.restore();
  };

  /* ---------------- 启动 ---------------- */
  game.onStateChange = () => {};
  showMenu();
  game.lastFrame = performance.now();
  game.rafId = requestAnimationFrame(t => game.loop(t));

  window.addEventListener('resize', () => Renderer.resize());
})();
