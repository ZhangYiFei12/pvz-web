/* ===========================================================
   config.js — 全局配置：网格、植物、僵尸、关卡
   =========================================================== */

const CFG = {
  COLS: 9,
  ROWS: 5,
  CELL_W: 80,
  CELL_H: 92,
  TOP_OFFSET: 74,      // 草坪顶部留白（天空区，用于落阳光）
  HUD_W: 78,           // 左侧“房屋”区域宽度
  get W() { return this.HUD_W + this.COLS * this.CELL_W; },
  get H() { return this.TOP_OFFSET + this.ROWS * this.CELL_H; },

  SUN_START: 50,
  SUNBANK_MAX: 9990,

  SKY_SUN_MIN: 5500,   // 天降阳光最小间隔（ms）
  SKY_SUN_MAX: 9000,

  ZOMBIE_HITBOX_W: 46,
  ZOMBIE_HITBOX_H: 74,

  FPS_CAP: 60,
};

/* ---------------- 植物定义 ---------------- */
/* cost: 阳光消耗；cd: 冷却(ms)；hp: 生命；damage: 单次伤害
   rate: 攻击间隔(ms)；produce: 产阳光间隔(ms)；tags: 特性标记 */
const PLANTS = {
  sunflower: {
    id: 'sunflower', name: '向日葵', emoji: '🌻', cost: 50, cd: 5000, hp: 300,
    produce: 7000, tags: ['producer'],
    desc: '持续产出阳光，经济核心',
  },
  peashooter: {
    id: 'peashooter', name: '豌豆射手', emoji: '🌱', cost: 100, cd: 5000, hp: 300,
    damage: 20, rate: 1400, projectile: 'pea', tags: ['shooter'],
    desc: '向本行前方发射豌豆',
  },
  wallnut: {
    id: 'wallnut', name: '坚果墙', emoji: '🌰', cost: 50, cd: 18000, hp: 1600,
    tags: ['blocker'],
    desc: '高血量，用来挡住僵尸',
  },
  snowpea: {
    id: 'snowpea', name: '寒冰射手', emoji: '❄️', cost: 175, cd: 5000, hp: 300,
    damage: 20, rate: 1400, projectile: 'snow', tags: ['shooter', 'slower'],
    desc: '豌豆附带减速效果',
  },
  repeater: {
    id: 'repeater', name: '双发射手', emoji: '🌿', cost: 200, cd: 5000, hp: 300,
    damage: 20, rate: 1400, shots: 2, projectile: 'pea', tags: ['shooter'],
    desc: '一次发射两颗豌豆',
  },
  cherrybomb: {
    id: 'cherrybomb', name: '樱桃炸弹', emoji: '🍒', cost: 150, cd: 20000, hp: 9999,
    tags: ['instant', 'explode'], blastRadius: 1.6, blastDamage: 1800,
    desc: '引爆 3×3 范围，秒杀小僵尸',
  },
  jalapeno: {
    id: 'jalapeno', name: '火爆辣椒', emoji: '🌶️', cost: 125, cd: 20000, hp: 9999,
    tags: ['instant', 'laneBurn'], burnDamage: 1800,
    desc: '烧尽一整行的僵尸',
  },
  potatomine: {
    id: 'potatomine', name: '土豆雷', emoji: '🥔', cost: 25, cd: 18000, hp: 300,
    armTime: 10000, blastDamage: 1800, tags: ['mine'],
    desc: '埋雷 10 秒后引爆碰到的僵尸',
  },
  chomper: {
    id: 'chomper', name: '大嘴花', emoji: '🪴', cost: 150, cd: 8000, hp: 300,
    chewTime: 12000, tags: ['chomper'],
    desc: '吞掉一只僵尸，咀嚼期间无防备',
  },
};

/* ---------------- 僵尸定义 ---------------- */
const ZOMBIES = {
  basic: {
    id: 'basic', name: '普通僵尸', emoji: '🧟', hp: 200, speed: 14.5,
    damage: 100, attackRate: 800, score: 10,
  },
  cone: {
    id: 'cone', name: '路障僵尸', emoji: '🧟‍♂️', hp: 560, speed: 14.5,
    damage: 100, attackRate: 800, score: 20, helmet: '🔺',
  },
  bucket: {
    id: 'bucket', name: '铁桶僵尸', emoji: '🧟‍♀️', hp: 1300, speed: 14.0,
    damage: 100, attackRate: 800, score: 35, helmet: '🪣',
  },
  pole: {
    id: 'pole', name: '撑杆僵尸', emoji: '🏃', hp: 340, speed: 28,
    damage: 100, attackRate: 800, score: 30, canVault: true,
  },
  football: {
    id: 'football', name: '橄榄球僵尸', emoji: '🏈', hp: 1600, speed: 26,
    damage: 100, attackRate: 700, score: 60, helmet: '🏈',
  },
  dancer: {
    id: 'dancer', name: '舞王僵尸', emoji: '🕺', hp: 500, speed: 17,
    damage: 100, attackRate: 800, score: 45, summon: true,
  },
  gargantuar: {
    id: 'gargantuar', name: '巨人僵尸', emoji: '👹', hp: 3000, speed: 10,
    damage: 100, attackRate: 900, score: 120, smash: true,
  },
};

/* ---------------- 关卡定义 ---------------- */
/* waves: [{ at: 毫秒, types: '表达式' }]
   types 表达式格式 "basic:2,cone:1" 或 "basic*3" */
const ALL_PLANTS = ['sunflower','peashooter','wallnut','snowpea','repeater','cherrybomb','jalapeno','potatomine','chomper'];

const LEVELS = [
  {
    id: 1, name: '白天 · 前院',
    desc: '教学关：用向日葵攒阳光，豌豆射手清理僵尸',
    plants: ['sunflower','peashooter','wallnut','potatomine'],
    sunStart: 75,
    skySun: true,
    waves: [
      { at: 20000, types: 'basic*1' },
      { at: 40000, types: 'basic*2' },
      { at: 60000, types: 'basic*2,cone*1' },
      { at: 82000, types: 'basic*2,cone*1', big: true },
      { at: 106000, types: 'basic*3,cone*1' },
    ],
  },
  {
    id: 2, name: '白天 · 强化',
    desc: '路障僵尸登场，用寒冰射手减速它们',
    plants: ['sunflower','peashooter','wallnut','snowpea','potatomine','cherrybomb'],
    sunStart: 100,
    skySun: true,
    waves: [
      { at: 18000, types: 'basic*2' },
      { at: 36000, types: 'cone*2,basic*1' },
      { at: 55000, types: 'cone*2,basic*2' },
      { at: 76000, types: 'cone*2,basic*2', big: true },
      { at: 98000, types: 'cone*3,basic*2' },
      { at: 122000, types: 'cone*2,pole*2,basic*2', big: true },
    ],
  },
  {
    id: 3, name: '白天 · 铁桶来袭',
    desc: '铁桶僵尸血量极高，需要双重火力',
    plants: ['sunflower','peashooter','wallnut','snowpea','repeater','cherrybomb','jalapeno','potatomine'],
    sunStart: 125,
    skySun: true,
    waves: [
      { at: 18000, types: 'basic*2,cone*1' },
      { at: 38000, types: 'cone*3' },
      { at: 58000, types: 'bucket*1,cone*2' },
      { at: 80000, types: 'bucket*1,cone*2,basic*2', big: true },
      { at: 102000, types: 'bucket*1,pole*2,cone*2' },
      { at: 126000, types: 'bucket*2,cone*2', big: true },
      { at: 150000, types: 'bucket*2,pole*2,cone*2,basic*2', big: true },
    ],
  },
  {
    id: 4, name: '浓雾 · 高难度',
    desc: '僵尸更强更密，大嘴花与樱桃炸弹是主力',
    plants: ALL_PLANTS,
    sunStart: 200,
    skySun: true,
    fog: 0.22,
    waves: [
      { at: 18000, types: 'basic*3,cone*1' },
      { at: 40000, types: 'cone*3,pole*1' },
      { at: 62000, types: 'bucket*1,cone*2', big: true },
      { at: 86000, types: 'football*1,cone*2,basic*1' },
      { at: 110000, types: 'bucket*2,pole*2,cone*1', big: true },
      { at: 134000, types: 'football*1,bucket*1,dancer*1' },
      { at: 160000, types: 'bucket*2,football*1,pole*1', big: true },
      { at: 186000, types: 'gargantuar*1,bucket*1', big: true },
    ],
  },
  {
    id: 5, name: '无尽 · 生存挑战',
    desc: '波次无限，难度持续攀升，挑战最高分',
    plants: ALL_PLANTS,
    sunStart: 200,
    skySun: true,
    endless: true,
    waves: [],
  },
];

/* 无尽模式波次生成器 */
function endlessWave(n) {
  // n 从 1 开始；budget 与 interval 共同决定难度曲线
  const budget = 3 + n * 1.7;
  const pool = [
    { id: 'basic',  w: 1,   cost: 1 },
    { id: 'cone',   w: n >= 2 ? 1 : 0, cost: 2 },
    { id: 'pole',   w: n >= 3 ? 0.8 : 0, cost: 2.2 },
    { id: 'bucket', w: n >= 4 ? 1 : 0, cost: 3.5 },
    { id: 'dancer', w: n >= 6 ? 0.5 : 0, cost: 3.5 },
    { id: 'football', w: n >= 8 ? 0.6 : 0, cost: 5 },
    { id: 'gargantuar', w: n >= 12 ? 0.2 + (n - 12) * 0.04 : 0, cost: 9 },
  ].filter(z => z.w > 0);

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
