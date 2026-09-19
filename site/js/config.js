/* ===========================================================
   config.js — 全局配置：网格、UI 布局、植物、僵尸、关卡
   =========================================================== */

const CFG = {
  COLS: 9,
  ROWS: 5,
  CELL_W: 96,
  CELL_H: 100,
  HUD_W: 108,          // 左侧房屋区宽度
  TOP_OFFSET: 96,      // 顶部种子槽高度
  BOTTOM_H: 64,        // 底部进度条区域

  get W() { return this.HUD_W + this.COLS * this.CELL_W; },   // 972
  get H() { return this.TOP_OFFSET + this.ROWS * this.CELL_H + this.BOTTOM_H; }, // 660

  SUN_START: 50,
  SUNBANK_MAX: 9990,

  SKY_SUN_MIN: 6000,
  SKY_SUN_MAX: 10000,

  BITE_DPS: 100,
};

/* ---------------- UI 布局（画布内 HUD） ---------------- */
const UI = {
  panel:   { x: 4, y: 4, w: 964, h: 86 },      // 顶部木质面板
  sunBox:  { x: 12, y: 8, w: 92, h: 78 },      // 阳光计数器
  seedStart: 112,                              // 种子卡起始 x
  seedMaxW: 78,                                // 种子卡最大宽度
  seedGap: 4,
  seedH: 78,
  seedY: 8,
  shovel:  { w: 54, h: 78 },                   // 铲子（紧跟种子卡）
  pause:   { w: 42, h: 36 },                   // 暂停按钮
  progress:{ x: 210, y: 612, w: 700, h: 22 },  // 底部进度条
};

/** 依据本关植物列表计算种子卡矩形（同时供绘制与点击命中使用） */
function seedRects(plantIds) {
  const n = plantIds.length;
  if (!n) return [];
  const right = CFG.W - 12 - UI.pause.w - 8 - UI.shovel.w - 8;   // 给铲子和暂停留位
  const avail = right - UI.seedStart;
  const w = Math.min(UI.seedMaxW, Math.floor((avail - UI.seedGap * (n - 1)) / n));
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: plantIds[i],
      x: UI.seedStart + i * (w + UI.seedGap),
      y: UI.seedY, w, h: UI.seedH,
    });
  }
  return out;
}

/** 铲子 / 暂停按钮矩形 */
function shovelRect(plantIds) {
  const rects = seedRects(plantIds);
  const last = rects.length ? rects[rects.length - 1] : { x: UI.seedStart, w: 0 };
  return { x: last.x + last.w + 10, y: UI.seedY, w: UI.shovel.w, h: UI.shovel.h };
}
function pauseRect() {
  return { x: CFG.W - 12 - UI.pause.w, y: UI.seedY, w: UI.pause.w, h: UI.pause.h };
}
const hitRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/* ---------------- 植物定义 ---------------- */
const PLANTS = {
  sunflower: {
    id: 'sunflower', name: '向日葵', cost: 50, cd: 5000, hp: 300,
    produce: 7000, tags: ['producer'],
    desc: '持续产出阳光，经济核心',
  },
  peashooter: {
    id: 'peashooter', name: '豌豆射手', cost: 100, cd: 5000, hp: 300,
    damage: 20, rate: 1400, projectile: 'pea', tags: ['shooter'],
    desc: '向本行前方发射豌豆',
  },
  wallnut: {
    id: 'wallnut', name: '坚果墙', cost: 50, cd: 18000, hp: 1600,
    tags: ['blocker'],
    desc: '高血量，用来挡住僵尸',
  },
  snowpea: {
    id: 'snowpea', name: '寒冰射手', cost: 175, cd: 5000, hp: 300,
    damage: 20, rate: 1400, projectile: 'snow', tags: ['shooter', 'slower'],
    desc: '豌豆附带减速效果',
  },
  repeater: {
    id: 'repeater', name: '双发射手', cost: 200, cd: 5000, hp: 300,
    damage: 20, rate: 1400, shots: 2, projectile: 'pea', tags: ['shooter'],
    desc: '一次发射两颗豌豆',
  },
  cherrybomb: {
    id: 'cherrybomb', name: '樱桃炸弹', cost: 150, cd: 20000, hp: 9999,
    tags: ['instant', 'explode'], blastRadius: 1.6, blastDamage: 1800,
    desc: '引爆 3×3 范围，秒杀小僵尸',
  },
  jalapeno: {
    id: 'jalapeno', name: '火爆辣椒', cost: 125, cd: 20000, hp: 9999,
    tags: ['instant', 'laneBurn'], burnDamage: 1800,
    desc: '烧尽一整行的僵尸',
  },
  potatomine: {
    id: 'potatomine', name: '土豆雷', cost: 25, cd: 18000, hp: 300,
    armTime: 10000, blastDamage: 1800, tags: ['mine'],
    desc: '埋雷 10 秒后引爆碰到的僵尸',
  },
  chomper: {
    id: 'chomper', name: '大嘴花', cost: 150, cd: 8000, hp: 300,
    chewTime: 12000, tags: ['chomper'],
    desc: '吞掉一只僵尸，咀嚼期间无防备',
  },
};

/* ---------------- 僵尸定义 ---------------- */
const ZOMBIES = {
  basic: {
    id: 'basic', name: '普通僵尸', hp: 200, speed: 14.5,
    damage: 100, attackRate: 800, score: 10,
  },
  cone: {
    id: 'cone', name: '路障僵尸', hp: 560, speed: 14.5,
    damage: 100, attackRate: 800, score: 20, helmet: true,
  },
  bucket: {
    id: 'bucket', name: '铁桶僵尸', hp: 1300, speed: 14.0,
    damage: 100, attackRate: 800, score: 35, helmet: true,
  },
  pole: {
    id: 'pole', name: '撑杆僵尸', hp: 340, speed: 28,
    damage: 100, attackRate: 800, score: 30, canVault: true,
  },
  newspaper: {
    id: 'newspaper', name: '报纸僵尸', hp: 400, speed: 12,
    damage: 100, attackRate: 800, score: 25, enrage: 2.6,
  },
  screen: {
    id: 'screen', name: '铁门僵尸', hp: 1100, speed: 12.5,
    damage: 100, attackRate: 800, score: 40, helmet: true,
  },
  football: {
    id: 'football', name: '橄榄球僵尸', hp: 1600, speed: 26,
    damage: 100, attackRate: 700, score: 60, helmet: true,
  },
  dancer: {
    id: 'dancer', name: '舞王僵尸', hp: 500, speed: 17,
    damage: 100, attackRate: 800, score: 45, summon: true,
  },
  gargantuar: {
    id: 'gargantuar', name: '巨人僵尸', hp: 3000, speed: 10,
    damage: 100, attackRate: 900, score: 120, smash: true,
  },
};

/* ---------------- 关卡定义 ---------------- */
const ALL_PLANTS = ['sunflower','peashooter','wallnut','snowpea','repeater','cherrybomb','jalapeno','potatomine','chomper'];

const LEVELS = [
  {
    id: 1, code: '1-1', name: '白天 · 前院',
    desc: '教学关：用向日葵攒阳光，豌豆射手清理僵尸',
    plants: ['sunflower','peashooter','wallnut','potatomine'],
    sunStart: 75, skySun: true,
    waves: [
      { at: 22000, types: 'basic*1' },
      { at: 44000, types: 'basic*2' },
      { at: 66000, types: 'basic*2,cone*1' },
      { at: 90000, types: 'basic*2,cone*1', big: true },
      { at: 116000, types: 'basic*3,cone*1' },
    ],
  },
  {
    id: 2, code: '1-2', name: '白天 · 强化',
    desc: '路障僵尸登场，用寒冰射手减速它们',
    plants: ['sunflower','peashooter','wallnut','snowpea','potatomine','cherrybomb'],
    sunStart: 100, skySun: true,
    waves: [
      { at: 20000, types: 'basic*2' },
      { at: 40000, types: 'cone*2,basic*1' },
      { at: 60000, types: 'cone*2,basic*2' },
      { at: 82000, types: 'cone*2,basic*2', big: true },
      { at: 106000, types: 'cone*3,basic*2' },
      { at: 132000, types: 'cone*2,pole*2,basic*2', big: true },
    ],
  },
  {
    id: 3, code: '1-3', name: '白天 · 铁桶来袭',
    desc: '铁桶僵尸血量极高，需要双重火力',
    plants: ['sunflower','peashooter','wallnut','snowpea','repeater','cherrybomb','jalapeno','potatomine'],
    sunStart: 125, skySun: true,
    waves: [
      { at: 20000, types: 'basic*2,cone*1' },
      { at: 40000, types: 'cone*3' },
      { at: 60000, types: 'bucket*1,cone*2' },
      { at: 82000, types: 'bucket*1,cone*2,basic*2', big: true },
      { at: 106000, types: 'bucket*1,pole*2,cone*2' },
      { at: 130000, types: 'bucket*2,cone*2', big: true },
      { at: 156000, types: 'bucket*2,pole*2,cone*2,basic*2', big: true },
    ],
  },
  {
    id: 4, code: '1-4', name: '浓雾 · 高难度',
    desc: '报纸僵尸与铁门僵尸登场，注意它们的护具',
    plants: ALL_PLANTS,
    sunStart: 200, skySun: true, fog: 0.2,
    waves: [
      { at: 20000, types: 'basic*3,cone*1' },
      { at: 42000, types: 'cone*3,newspaper*1' },
      { at: 64000, types: 'bucket*1,cone*2,screen*1', big: true },
      { at: 88000, types: 'football*1,cone*2,basic*1' },
      { at: 112000, types: 'bucket*2,pole*2,newspaper*2', big: true },
      { at: 136000, types: 'football*1,bucket*1,dancer*1' },
      { at: 162000, types: 'screen*2,football*1,pole*1', big: true },
      { at: 188000, types: 'gargantuar*1,bucket*1', big: true },
    ],
  },
  {
    id: 5, code: '∞', name: '无尽 · 生存挑战',
    desc: '波次无限，难度持续攀升，挑战最高分',
    plants: ALL_PLANTS,
    sunStart: 200, skySun: true,
    endless: true, waves: [],
  },
];

/* 无尽模式波次生成器 */
function endlessWave(n) {
  const budget = 3 + n * 1.7;
  const pool = [
    { id: 'basic',     cost: 1 },
    { id: 'cone',      cost: 2 },
    { id: 'newspaper', cost: 2.2, from: 3 },
    { id: 'pole',      cost: 2.4, from: 4 },
    { id: 'bucket',    cost: 3.5, from: 5 },
    { id: 'screen',    cost: 3.6, from: 6 },
    { id: 'dancer',    cost: 3.5, from: 7 },
    { id: 'football',  cost: 5,   from: 9 },
    { id: 'gargantuar',cost: 9,   from: 13 },
  ].filter(z => !z.from || n >= z.from);

  const counts = {};
  let left = budget, guard = 0;
  while (left > 1 && guard++ < 200) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick.cost > left) continue;
    counts[pick.id] = (counts[pick.id] || 0) + 1;
    left -= pick.cost;
  }
  const parts = Object.entries(counts).map(([k, v]) => `${k}*${v}`);
  return {
    types: parts.join(',') || 'basic*1',
    big: n % 5 === 0,
    interval: Math.max(12000, 30000 - n * 1000),
  };
}

/* 解析 "basic*3,cone*2" → ['basic','basic','basic','cone','cone'] */
function parseTypes(expr) {
  if (!expr) return [];
  const out = [];
  expr.split(',').forEach(part => {
    const [rawId, rawN] = part.split('*');
    const id = rawId.trim();
    if (!ZOMBIES[id]) return;
    const n = Math.max(1, parseInt(rawN || '1', 10) || 1);
    for (let i = 0; i < n; i++) out.push(id);
  });
  return out;
}
