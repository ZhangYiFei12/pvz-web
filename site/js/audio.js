/* ===========================================================
   audio.js — 纯 WebAudio 合成音效（无音频文件依赖）
   =========================================================== */

const Sound = (() => {
  let ctx = null;
  let master = null;
  let enabled = true;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.28;
    master.connect(ctx.destination);
  }

  /** 浏览器要求首次用户交互后才能播放音频 */
  function unlock() {
    init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function tone({ freq = 440, dur = 0.12, type = 'sine', vol = 0.5, slideTo = null, delay = 0 }) {
    if (!enabled || !ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain); gain.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }

  function noise({ dur = 0.16, vol = 0.35, delay = 0, hp = 300 }) {
    if (!enabled || !ctx) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = hp;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter); filter.connect(gain); gain.connect(master);
    src.start(t0);
  }

  const S = {
    unlock, init,
    setEnabled(v) { enabled = v; },
    isEnabled() { return enabled; },

    plant()      { tone({ freq: 320, slideTo: 620, dur: 0.10, type: 'triangle', vol: .35 }); },
    sunCollect() { tone({ freq: 780, slideTo: 1180, dur: 0.10, type: 'sine', vol: .38 }); tone({ freq: 1180, dur: .08, type:'sine', vol:.22, delay:.06 }); },
    shoot()      { tone({ freq: 900, slideTo: 500, dur: 0.06, type: 'square', vol: .14 }); },
    snowShoot()  { tone({ freq: 1400, slideTo: 800, dur: 0.09, type: 'sine', vol: .16 }); },
    hit()        { noise({ dur: 0.07, vol: .2, hp: 900 }); },
    zombieHit()  { tone({ freq: 180, slideTo: 90, dur: 0.10, type: 'sawtooth', vol: .2 }); },
    zombieDie()  { tone({ freq: 200, slideTo: 60, dur: 0.34, type: 'sawtooth', vol: .26 }); noise({ dur: .22, vol: .16, hp: 200 }); },
    explode()    { noise({ dur: 0.5, vol: .5, hp: 80 }); tone({ freq: 120, slideTo: 40, dur: .45, type: 'sawtooth', vol: .35 }); },
    chomp()      { tone({ freq: 260, slideTo: 110, dur: 0.18, type: 'square', vol: .28 }); },
    shovel()     { tone({ freq: 520, slideTo: 200, dur: 0.14, type: 'triangle', vol: .3 }); },
    error()      { tone({ freq: 180, dur: 0.14, type: 'square', vol: .24 }); },
    waveWarn()   { tone({ freq: 240, dur: .28, type: 'sawtooth', vol: .3 }); tone({ freq: 200, dur: .3, type:'sawtooth', vol:.3, delay:.3 }); },
    win()        { [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: .3, type: 'triangle', vol: .32, delay: i * 0.13 })); },
    lose()       { [400, 340, 280, 200].forEach((f, i) => tone({ freq: f, dur: .38, type: 'sawtooth', vol: .3, delay: i * 0.16 })); },
    click()      { tone({ freq: 640, dur: .05, type: 'square', vol: .16 }); },
  };

  return S;
})();
