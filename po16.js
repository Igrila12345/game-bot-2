'use strict';

const { VK } = require('vk-io');
const { Pool } = require('pg');

// ═══════════════════════════════════════════════════════════
//  КОНФИГУРАЦИЯ
// ═══════════════════════════════════════════════════════════
const TOKEN    = 'vk1.a.oEh4QG6VgTIGThreYGF25K63gp8D4IQHr95d6pORny5SJMNs8jJCQ6Ql6BlZA1xi9iy9hPnzR-sfV4pRG8WQ9rerkV1hWSX3-kf1Mp2ivisprjLDAo5KVwt87GPaL2TmzznLyWT_YjfvtSfCPRMPxWKrNPAIMKntvlY-vwjxvhXH5s6ibgsS6I-tMpLqPfT82LFT6CTvxnaGhzX8AV119g';
const ADMIN_ID = 788158121;
const DB_URL   = 'postgresql://neondb_owner:npg_v0XrEhzawWo5@ep-old-wildflower-aldp2klr-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require';

// ═══════════════════════════════════════════════════════════
//  КОНСТАНТЫ ИГРЫ
// ═══════════════════════════════════════════════════════════
const WORK_CD           = 30 * 60 * 1000;
const REST_CD           = 30 * 60 * 1000;
const BASE_INCOME       = 100;
const STAMINA_PER_WORK  = 20;
const MAX_STAMINA       = 100;
const DRILL_COST        = 2000;
const DRILL_INCOME      = 50;
const OIL_COST          = 5000;
const OIL_INCOME        = 100;
const PASSIVE_CAP_HOURS = 24;
const GUILD_COST        = 1000;

// Нелегальная работа
const BLACK_WORK_CD       = 2 * 60 * 60 * 1000;
const BLACK_WORK_INCOME   = 500;
const BLACK_CATCH_CHANCE  = 0.30;
const BLACK_FINE          = 1000;
const JAIL_DURATION       = 60 * 60 * 1000;
const ROOF_COST           = 3000;
const CONTRABAND_PRICE    = 300;

// Воровство
const STEAL_CD            = 4 * 60 * 60 * 1000;
const STEAL_CHANCE        = 0.45;
const STEAL_MIN_PCT       = 0.03;
const STEAL_MAX_PCT       = 0.08;
const STEAL_MIN_BALANCE   = 5000;

// Переводы
const TRANSFER_MIN        = 10;

// Вирус
const EPIDEMIC_CHANCE        = 0.15;
const EPIDEMIC_CHECK_INTERVAL = 60 * 60 * 1000;
const EPIDEMIC_DURATION      = 3 * 60 * 60 * 1000;
const VIRUS_STAMINA_LOSS     = 20;
const VIRUS_INCOME_PENALTY   = 0.5;
const MEDKIT_COST            = 300;
const VACCINE_COST           = 1000;
const VACCINE_DURATION       = 24 * 60 * 60 * 1000;
const ANTIBIOTIC_COST        = 500;

// Классы
const CLASSES = {
  'шахтёр':   { bonus: 'mine',     desc: '+20% к добыче при работе' },
  'инженер':  { bonus: 'drill',    desc: 'Буры приносят на 25% больше' },
  'нефтяник': { bonus: 'oil',      desc: 'Нефтяные вышки дают +30%' },
  'врач':     { bonus: 'heal',     desc: 'Может лечить других за половину стоимости аптечки' },
  'бригадир': { bonus: 'guild',    desc: 'Бонус для всей бригады +10%' },
};

// Ежедневный бонус (только для членов клана)
const DAILY_BONUS = {
  1: { type: 'coins', amount: 400,  label: '400 монет' },
  2: { type: 'coins', amount: 450,  label: '450 монет' },
  3: { type: 'coins', amount: 500,  label: '500 монет' },
  4: { type: 'coins', amount: 400,  label: '400 монет' },
  5: { type: 'coins', amount: 450,  label: '450 монет' },
  6: { type: 'coins', amount: 500,  label: '500 монет' },
  0: { type: 'drill', amount: 1,    label: '1 бур'    },
};

const PICKAXE = [
  { level: 1, bonus: 0,   cost: 500  },
  { level: 2, bonus: 30,  cost: 1500 },
  { level: 3, bonus: 60,  cost: 3000 },
  { level: 4, bonus: 90,  cost: 6000 },
  { level: 5, bonus: 120, cost: null },
];

const SHOP_ITEMS = {
  'еда':     { cost: 200,  desc: 'Восстанавливает 50 стамины' },
  'динамит': { cost: 500,  desc: 'Удваивает добычу и руды за один спуск / +100% к чёрной работе' },
  'крыша':   { cost: 3000, desc: 'Снижает шанс поимки при чёрной работе в 2 раза (постоянный эффект)' },
  'аптечка': { cost: 300,  desc: 'Лечит от вируса и восстанавливает 30 стамины' },
  'вакцина': { cost: 1000, desc: 'Защищает от вируса на 24 часа' },
  'антибиотик': { cost: 500, desc: 'Ускоряет выздоровление от вируса в 2 раза' },
};

// ═══════════════════════════════════════════════════════════
//  РУДЫ
// ═══════════════════════════════════════════════════════════
const ORES = {
  'уголь':    { emoji: '🪨', price: 50,   chance: [0.80, 0.80, 0.75, 0.70, 0.65], min: 1, max: 4 },
  'железо':   { emoji: '⚙️', price: 150,  chance: [0.35, 0.40, 0.50, 0.55, 0.60], min: 1, max: 3 },
  'алмаз':    { emoji: '💎', price: 500,  chance: [0.05, 0.10, 0.18, 0.28, 0.40], min: 1, max: 2 },
  'золото':   { emoji: '🥇', price: 800,  chance: [0.03, 0.07, 0.13, 0.22, 0.35], min: 1, max: 2 },
  'рубин':    { emoji: '🔴', price: 1200, chance: [0.01, 0.03, 0.07, 0.14, 0.25], min: 1, max: 1 },
  'платина':  { emoji: '🪙', price: 2000, chance: [0.00, 0.01, 0.03, 0.07, 0.15], min: 1, max: 1 },
};

// ═══════════════════════════════════════════════════════════
//  РЕСУРСЫ ДЛЯ КРАФТА
// ═══════════════════════════════════════════════════════════
const CRAFT_RESOURCES = {
  'железная_пластина':  { emoji: '🔩', name: 'Железная пластина',  chance: 0.15, min_lvl: 1 },
  'шестерня':           { emoji: '⚙️', name: 'Шестерня',           chance: 0.10, min_lvl: 2 },
  'алмазный_наконечник': { emoji: '💎', name: 'Алмазный наконечник', chance: 0.05, min_lvl: 3 },
  'магнит':             { emoji: '🧲', name: 'Магнитный стабилизатор', chance: 0.02, min_lvl: 4 },
  'смазка':             { emoji: '🧪', name: 'Смазка',             chance: 0.20, min_lvl: 1 },
};

// ═══════════════════════════════════════════════════════════
//  РЕЦЕПТЫ КРАФТА
// ═══════════════════════════════════════════════════════════
const CRAFT_RECIPES = {
  'бур_обычный': {
    name: 'Обычный бур',
    emoji: '⚙️',
    result_type: 'drill',
    result_amount: 1,
    drill_income: 50,
    ingredients: {
      'железо': 10,
      'уголь': 5,
    },
    coins_cost: 500,
    desc: '+50💰/час',
  },
  'бур_усиленный': {
    name: 'Усиленный бур',
    emoji: '🔩',
    result_type: 'drill_enhanced',
    result_amount: 1,
    drill_income: 100,
    ingredients: {
      'железная_пластина': 5,
      'шестерня': 3,
      'смазка': 1,
    },
    coins_cost: 1000,
    desc: '+100💰/час',
  },
  'бур_алмазный': {
    name: 'Алмазный бур',
    emoji: '💎',
    result_type: 'drill_diamond',
    result_amount: 1,
    drill_income: 250,
    ingredients: {
      'алмазный_наконечник': 2,
      'магнит': 1,
    },
    coins_cost: 3000,
    desc: '+250💰/час',
  },
  'вышка_нефтяная': {
    name: 'Нефтяная вышка',
    emoji: '🛢️',
    result_type: 'oil_rig',
    result_amount: 1,
    oil_income: 150,
    ingredients: {
      'железо': 20,
      'шестерня': 10,
      'смазка': 5,
    },
    coins_cost: 2500,
    desc: '+150💰/час',
  },
  'шестерня_крафт': {
    name: 'Шестерня (из железа)',
    emoji: '⚙️',
    result_type: 'craft_resource',
    result_item: 'шестерня',
    result_amount: 1,
    ingredients: {
      'железо': 5,
    },
    coins_cost: 200,
    desc: '5 железной руды → 1 шестерня',
  },
  'алмазный_наконечник_крафт': {
    name: 'Алмазный наконечник',
    emoji: '💎',
    result_type: 'craft_resource',
    result_item: 'алмазный_наконечник',
    result_amount: 1,
    ingredients: {
      'алмаз': 3,
      'железная_пластина': 2,
    },
    coins_cost: 500,
    desc: '3 алмаза + 2 пластины → 1 наконечник',
  },
  'магнит_крафт': {
    name: 'Магнитный стабилизатор',
    emoji: '🧲',
    result_type: 'craft_resource',
    result_item: 'магнит',
    result_amount: 1,
    ingredients: {
      'золото': 5,
      'рубин': 2,
    },
    coins_cost: 1000,
    desc: '5 золота + 2 рубина → 1 магнит',
  },
};

// ═══════════════════════════════════════════════════════════
//  ИНИЦИАЛИЗАЦИЯ
// ═══════════════════════════════════════════════════════════
const vk = new VK({ token: TOKEN });

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 60_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => {
  console.error('pg pool error:', err.message);
});

let globalEpidemic = false;
let epidemicEndTime = 0;

function startKeepalive() {
  setInterval(async () => {
    try { await pool.query('SELECT 1'); }
    catch (e) { console.error('keepalive fail:', e.message); }
  }, 4 * 60 * 1000);
}

// ═══════════════════════════════════════════════════════════
//  БАЗА ДАННЫХ
// ═══════════════════════════════════════════════════════════
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      user_id      BIGINT PRIMARY KEY,
      balance      BIGINT  DEFAULT 0,
      stamina      INT     DEFAULT 100,
      pickaxe_lvl  INT     DEFAULT 1,
      drills       INT     DEFAULT 0,
      oil_rigs     INT     DEFAULT 0,
      last_work    BIGINT  DEFAULT 0,
      last_rest    BIGINT  DEFAULT 0,
      last_drill   BIGINT  DEFAULT 0,
      last_oil     BIGINT  DEFAULT 0,
      guild_id     INT     DEFAULT NULL,
      last_black   BIGINT  DEFAULT 0,
      jail_until   BIGINT  DEFAULT 0,
      has_roof     BOOLEAN DEFAULT FALSE,
      last_steal   BIGINT  DEFAULT 0,
      last_daily   BIGINT  DEFAULT 0,
      hidden       BOOLEAN DEFAULT FALSE,
      banned       BOOLEAN DEFAULT FALSE,
      virus        INT     DEFAULT 0,
      virus_end    BIGINT  DEFAULT 0,
      vaccine_end  BIGINT  DEFAULT 0,
      player_class VARCHAR(32) DEFAULT NULL,
      is_admin     BOOLEAN DEFAULT FALSE,
      work_count   INT     DEFAULT 0,
      craft_level  INT     DEFAULT 1,
      drills_enhanced INT  DEFAULT 0,
      drills_diamond  INT  DEFAULT 0
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS guilds (
      id       SERIAL PRIMARY KEY,
      name     VARCHAR(64) UNIQUE NOT NULL,
      owner_id BIGINT NOT NULL,
      treasury BIGINT DEFAULT 0,
      level    INT    DEFAULT 1,
      xp       INT    DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS guild_invites (
      user_id  BIGINT PRIMARY KEY,
      guild_id INT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS inventory (
      user_id  BIGINT,
      item     VARCHAR(32),
      quantity INT DEFAULT 0,
      PRIMARY KEY (user_id, item)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      code       VARCHAR(64) PRIMARY KEY,
      reward_type VARCHAR(16) NOT NULL,
      reward_amount INT NOT NULL,
      max_uses   INT DEFAULT 1,
      uses       INT DEFAULT 0,
      created_by BIGINT NOT NULL,
      active     BOOLEAN DEFAULT TRUE
    );
    CREATE TABLE IF NOT EXISTS promo_uses (
      user_id BIGINT,
      code    VARCHAR(64),
      PRIMARY KEY (user_id, code)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_activity (
      chat_id    BIGINT,
      user_id    BIGINT,
      work_count INT DEFAULT 0,
      last_work  BIGINT DEFAULT 0,
      PRIMARY KEY (chat_id, user_id)
    );
  `);

  const newCols = [
    ['stamina',     'INT     DEFAULT 100'],
    ['pickaxe_lvl', 'INT     DEFAULT 1'],
    ['drills',      'INT     DEFAULT 0'],
    ['oil_rigs',    'INT     DEFAULT 0'],
    ['last_work',   'BIGINT  DEFAULT 0'],
    ['last_rest',   'BIGINT  DEFAULT 0'],
    ['last_drill',  'BIGINT  DEFAULT 0'],
    ['last_oil',    'BIGINT  DEFAULT 0'],
    ['guild_id',    'INT     DEFAULT NULL'],
    ['last_black',  'BIGINT  DEFAULT 0'],
    ['jail_until',  'BIGINT  DEFAULT 0'],
    ['has_roof',    'BOOLEAN DEFAULT FALSE'],
    ['last_steal',  'BIGINT  DEFAULT 0'],
    ['last_daily',  'BIGINT  DEFAULT 0'],
    ['hidden',      'BOOLEAN DEFAULT FALSE'],
    ['banned',      'BOOLEAN DEFAULT FALSE'],
    ['virus',       'INT     DEFAULT 0'],
    ['virus_end',   'BIGINT  DEFAULT 0'],
    ['vaccine_end', 'BIGINT  DEFAULT 0'],
    ['player_class', 'VARCHAR(32) DEFAULT NULL'],
    ['is_admin',    'BOOLEAN DEFAULT FALSE'],
    ['work_count',  'INT     DEFAULT 0'],
    ['craft_level', 'INT     DEFAULT 1'],
    ['drills_enhanced', 'INT DEFAULT 0'],
    ['drills_diamond',  'INT DEFAULT 0'],
  ];
  for (const [col, def] of newCols) {
    await pool.query(
      `ALTER TABLE players ADD COLUMN IF NOT EXISTS ${col} ${def}`
    ).catch(() => {});
  }

  const invCheck = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='inventory' AND column_name='item'
  `);
  if (invCheck.rows.length === 0) {
    await pool.query(`DROP TABLE IF EXISTS inventory CASCADE`);
    await pool.query(`
      CREATE TABLE inventory (
        user_id  BIGINT,
        item     VARCHAR(32),
        quantity INT DEFAULT 0,
        PRIMARY KEY (user_id, item)
      )
    `);
  }

  await pool.query(`
    UPDATE players SET
      stamina     = COALESCE(stamina, 100),
      pickaxe_lvl = COALESCE(pickaxe_lvl, 1),
      drills      = COALESCE(drills, 0),
      oil_rigs    = COALESCE(oil_rigs, 0),
      last_work   = COALESCE(last_work, 0),
      last_rest   = COALESCE(last_rest, 0),
      last_drill  = COALESCE(last_drill, 0),
      last_oil    = COALESCE(last_oil, 0),
      last_black  = COALESCE(last_black, 0),
      jail_until  = COALESCE(jail_until, 0),
      has_roof    = COALESCE(has_roof, FALSE),
      last_steal  = COALESCE(last_steal, 0),
      last_daily  = COALESCE(last_daily, 0),
      hidden      = COALESCE(hidden, FALSE),
      banned      = COALESCE(banned, FALSE),
      virus       = COALESCE(virus, 0),
      virus_end   = COALESCE(virus_end, 0),
      vaccine_end = COALESCE(vaccine_end, 0),
      is_admin    = COALESCE(is_admin, FALSE),
      work_count  = COALESCE(work_count, 0),
      craft_level = COALESCE(craft_level, 1),
      drills_enhanced = COALESCE(drills_enhanced, 0),
      drills_diamond  = COALESCE(drills_diamond, 0)
  `);

  await pool.query(`
    UPDATE players SET is_admin = TRUE WHERE user_id = $1
  `, [ADMIN_ID]);

  console.log('✅ База данных готова');
}

// ═══════════════════════════════════════════════════════════
//  ХЕЛПЕРЫ
// ═══════════════════════════════════════════════════════════
function sanitize(p) {
  p.balance     = Number(p.balance     ?? 0);
  p.stamina     = Number(p.stamina     ?? 100);
  p.pickaxe_lvl = Number(p.pickaxe_lvl ?? 1);
  p.drills      = Number(p.drills      ?? 0);
  p.oil_rigs    = Number(p.oil_rigs    ?? 0);
  p.last_work   = Number(p.last_work   ?? 0);
  p.last_rest   = Number(p.last_rest   ?? 0);
  p.last_drill  = Number(p.last_drill  ?? 0);
  p.last_oil    = Number(p.last_oil    ?? 0);
  p.last_black  = Number(p.last_black  ?? 0);
  p.jail_until  = Number(p.jail_until  ?? 0);
  p.has_roof    = Boolean(p.has_roof   ?? false);
  p.last_steal  = Number(p.last_steal  ?? 0);
  p.last_daily  = Number(p.last_daily  ?? 0);
  p.guild_id    = p.guild_id ? Number(p.guild_id) : null;
  p.hidden      = Boolean(p.hidden     ?? false);
  p.banned      = Boolean(p.banned     ?? false);
  p.virus       = Number(p.virus       ?? 0);
  p.virus_end   = Number(p.virus_end   ?? 0);
  p.vaccine_end = Number(p.vaccine_end ?? 0);
  p.player_class = p.player_class || null;
  p.is_admin    = Boolean(p.is_admin   ?? false);
  p.work_count  = Number(p.work_count  ?? 0);
  p.craft_level = Number(p.craft_level ?? 1);
  p.drills_enhanced = Number(p.drills_enhanced ?? 0);
  p.drills_diamond  = Number(p.drills_diamond  ?? 0);
  return p;
}

async function getPlayer(uid) {
  const r = await pool.query('SELECT * FROM players WHERE user_id=$1', [uid]);
  return r.rows[0] ? sanitize(r.rows[0]) : null;
}

async function getOrCreate(uid) {
  await pool.query(`
    INSERT INTO players (user_id, balance, stamina, pickaxe_lvl, drills, oil_rigs,
                         last_work, last_rest, last_drill, last_oil,
                         last_black, jail_until, has_roof, last_steal, last_daily,
                         hidden, banned, virus, virus_end, vaccine_end, player_class, is_admin,
                         work_count, craft_level, drills_enhanced, drills_diamond)
    VALUES ($1, 0, 100, 1, 0, 0, 0, 0, 0, 0, 0, 0, FALSE, 0, 0, FALSE, FALSE, 0, 0, 0, NULL, FALSE, 0, 1, 0, 0)
    ON CONFLICT DO NOTHING
  `, [uid]);
  return getPlayer(uid);
}

async function getName(uid) {
  try {
    const r = await vk.api.users.get({ user_ids: String(uid) });
    if (r && r[0]) return `${r[0].first_name} ${r[0].last_name}`;
    return `Игрок #${uid}`;
  } catch {
    return `Игрок #${uid}`;
  }
}

function fmtTime(ms) {
  if (ms <= 0) return '0 сек';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  if (h > 0) return `${h} ч ${m} мин`;
  if (m > 0) return `${m} мин ${s} сек`;
  return `${s} сек`;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function send(ctx, text) {
  await ctx.send(text);
}

async function addItem(uid, item, qty) {
  await pool.query(
    `INSERT INTO inventory(user_id, item, quantity) VALUES($1,$2,$3)
     ON CONFLICT(user_id,item) DO UPDATE SET quantity=inventory.quantity+$3`,
    [uid, item, qty]
  );
}

async function getItemQty(uid, item) {
  const r = await pool.query(
    'SELECT quantity FROM inventory WHERE user_id=$1 AND item=$2', [uid, item]
  );
  return Number(r.rows[0]?.quantity ?? 0);
}

async function removeItem(uid, item, qty) {
  await pool.query(
    `UPDATE inventory SET quantity=quantity-$1 WHERE user_id=$2 AND item=$3 AND quantity>=$1`,
    [qty, uid, item]
  );
}

function getMoscowDayOfWeek() {
  const now = new Date();
  const msk = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  return msk.getDay();
}

function getMoscowDayStart() {
  const now = new Date();
  const msk = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  msk.setHours(0, 0, 0, 0);
  const diff = now.getTime() - new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' })).getTime();
  return msk.getTime() + diff;
}

function updateVirusStatus(p) {
  const now = Date.now();
  
  if (p.vaccine_end > 0 && p.vaccine_end <= now) {
    p.vaccine_end = 0;
    if (p.virus === 2) p.virus = 0;
  }
  
  if (p.virus === 1 && p.virus_end > 0 && p.virus_end <= now) {
    p.virus = 0;
    p.virus_end = 0;
  }
  
  return p;
}

function getClassBonus(p, type) {
  if (!p.player_class) return 0;
  
  switch (type) {
    case 'mine':
      return p.player_class === 'шахтёр' ? 0.20 : 0;
    case 'drill':
      return p.player_class === 'инженер' ? 0.25 : 0;
    case 'oil':
      return p.player_class === 'нефтяник' ? 0.30 : 0;
    case 'heal':
      return p.player_class === 'врач' ? 0.50 : 0;
    case 'guild':
      return p.player_class === 'бригадир' ? 0.10 : 0;
    case 'craft':
      return p.player_class === 'инженер' ? 0.15 : 0;
    default:
      return 0;
  }
}

async function isAdmin(uid) {
  if (uid === ADMIN_ID) return true;
  const p = await getPlayer(uid);
  return p && p.is_admin;
}

// ═══════════════════════════════════════════════════════════
//  КОМАНДЫ ИГРЫ
// ═══════════════════════════════════════════════════════════

async function cmdStart(ctx, uid) {
  const pCheck = await getPlayer(uid);
  if (pCheck && pCheck.banned) {
    return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');
  }

  const existing = await getPlayer(uid);
  if (existing) {
    return send(ctx,
      '⛏️ Ты уже зарегистрирован!\n' +
      'Твой ID: ' + uid + '\n' +
      'Твой класс: ' + (existing.player_class || 'не выбран') + '\n' +
      'Напиши «Работа», чтобы начать добывать.\n' +
      'Напиши «Помощь» для списка команд.\n' +
      'Чтобы сменить класс: «Класс»'
    );
  }
  
  const classList = Object.entries(CLASSES).map(([name, info]) => 
    `• ${name} — ${info.desc}`
  ).join('\n');
  
  await send(ctx,
    '🎉 Добро пожаловать в Generational Miners!\n\n' +
    '🆔 Твой ID: ' + uid + '\n\n' +
    '👤 Выбери свой класс:\n' + classList + '\n\n' +
    'Напиши название класса, например: «Шахтёр»\n' +
    '⚠️ Класс можно будет сменить позже командой «Класс»'
  );
}

async function cmdSetClass(ctx, uid, className) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');
  
  if (!className) {
    const classList = Object.entries(CLASSES).map(([name, info]) => 
      `• ${name} — ${info.desc}`
    ).join('\n');
    return send(ctx,
      '👤 Доступные классы:\n' + classList + '\n\n' +
      'Твой текущий класс: ' + (p.player_class || 'не выбран') + '\n' +
      'Выбери класс: «Класс [название]»\n' +
      'Пример: «Класс шахтёр»'
    );
  }
  
  className = className.toLowerCase();
  if (!CLASSES[className]) {
    return send(ctx,
      '❌ Класс «' + className + '» не существует.\n' +
      'Доступные: ' + Object.keys(CLASSES).join(', ')
    );
  }
  
  if (p.player_class === className) {
    return send(ctx, '👤 У тебя уже выбран класс «' + className + '»!');
  }
  
  await pool.query(
    `UPDATE players SET player_class=$1 WHERE user_id=$2`,
    [className, uid]
  );
  
  const classEmoji = {
    'шахтёр': '⛏️',
    'инженер': '⚙️',
    'нефтяник': '🛢️',
    'врач': '🏥',
    'бригадир': '👑'
  };
  
  await send(ctx,
    `${classEmoji[className] || '👤'} Класс «${className}» выбран!\n` +
    `📋 ${CLASSES[className].desc}\n\n` +
    `Ты можешь сменить класс в любое время командой «Класс [название]»`
  );
}

async function cmdWork(ctx, uid) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  const now = Date.now();
  
  updateVirusStatus(p);

  if (p.jail_until > now) {
    const left = p.jail_until - now;
    return send(ctx,
      `🚨 Ты в тюрьме! Нельзя работать.\n` +
      `⏳ Выйдешь через ${fmtTime(left)}.`
    );
  }

  if (p.virus === 1 && p.virus_end > now) {
    return send(ctx,
      `🦠 Ты болен вирусом! Нельзя работать.\n` +
      `🏥 Вылечись командой «Лечить» или используй «Аптечка».\n` +
      `💉 Или купи «Вакцина» для защиты.\n` +
      `⏳ До выздоровления: ${fmtTime(p.virus_end - now)}`
    );
  }

  const left = WORK_CD - (now - p.last_work);
  if (left > 0)
    return send(ctx, `⏳ Ты устал! Следующий спуск через ${fmtTime(left)}.\n💡 Подсказка: купи и используй «еда» чтобы восстановить стамину, но кулдаун работы не сбрасывается.`);

  if (p.stamina < STAMINA_PER_WORK)
    return send(ctx,
      `😮‍💨 Нет сил для спуска в шахту!\n` +
      `❤️ Стамина: ${p.stamina}/${MAX_STAMINA} (нужно минимум ${STAMINA_PER_WORK})\n\n` +
      `Восстановить стамину:\n` +
      `• «Отдых» — полностью восстанавливает (кд 30 мин)\n` +
      `• «Использовать еда» или просто «Еда» — +50 стамины`
    );

  const pick = PICKAXE.find(l => l.level === p.pickaxe_lvl) || PICKAXE[0];
  let income = Math.floor(BASE_INCOME * (1 + pick.bonus / 100));

  const mineBonus = getClassBonus(p, 'mine');
  if (mineBonus > 0) {
    income = Math.floor(income * (1 + mineBonus));
  }

  const dynQty = await getItemQty(uid, 'динамит');
  const hasDyn = dynQty > 0;
  if (hasDyn) {
    income *= 2;
    await pool.query(
      `UPDATE inventory SET quantity=quantity-1 WHERE user_id=$1 AND item='динамит'`, [uid]
    );
  }

  let guildBonus = 0;
  if (p.guild_id) {
    const gr = await pool.query('SELECT level FROM guilds WHERE id=$1', [p.guild_id]);
    if (gr.rows[0]) {
      guildBonus = Number(gr.rows[0].level) * 5;
      const brigadir = await pool.query(
        `SELECT user_id FROM players WHERE guild_id=$1 AND player_class='бригадир' LIMIT 1`,
        [p.guild_id]
      );
      if (brigadir.rows.length > 0) {
        guildBonus += 10;
      }
      income = Math.floor(income * (1 + guildBonus / 100));
    }
  }

  if (globalEpidemic && p.virus !== 2) {
    income = Math.floor(income * (1 - VIRUS_INCOME_PENALTY));
  }

  const newSt = p.stamina - STAMINA_PER_WORK;
  await pool.query(
    `UPDATE players SET balance=balance+$1, stamina=$2, last_work=$3, work_count=work_count+1 WHERE user_id=$4`,
    [income, newSt, now, uid]
  );

  // Обновляем активность чата
  if (ctx.peerId && ctx.peerId > 2000000000) {
    const chatId = ctx.peerId - 2000000000;
    await pool.query(
      `INSERT INTO chat_activity (chat_id, user_id, work_count, last_work)
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (chat_id, user_id)
       DO UPDATE SET work_count = chat_activity.work_count + 1, last_work = $3`,
      [chatId, uid, now]
    );
  }

  const lvlIdx = Math.max(0, Math.min((p.pickaxe_lvl || 1) - 1, 4));
  const oreLines = [];
  for (const [oreName, ore] of Object.entries(ORES)) {
    if (ore.chance[lvlIdx] !== undefined && Math.random() < ore.chance[lvlIdx]) {
      let qty = randInt(ore.min, ore.max);
      if (hasDyn) qty *= 2;
      await addItem(uid, oreName, qty);
      oreLines.push(`${ore.emoji} ${oreName}: +${qty} шт.`);
    }
  }

  // Добыча крафт-ресурсов
  const craftLines = [];
  for (const [resKey, res] of Object.entries(CRAFT_RESOURCES)) {
    if (p.pickaxe_lvl >= res.min_lvl && Math.random() < res.chance) {
      let qty = 1;
      if (hasDyn) qty = randInt(1, 2);
      if (p.craft_level > 5 && Math.random() < 0.1) qty += 1;
      await addItem(uid, resKey, qty);
      craftLines.push(`${res.emoji} ${res.name}: +${qty} шт.`);
    }
  }

  let msg = `⛏️ Ты спустился в шахту!\n💰 +${income} монет\n`;
  if (mineBonus > 0) msg += `⛏️ Бонус шахтёра: +20%\n`;
  if (hasDyn) msg += `💥 Динамит сработал — добыча удвоена!\n`;
  if (guildBonus > 0) msg += `👥 Бонус бригады: +${guildBonus}%\n`;
  if (globalEpidemic && p.virus !== 2) msg += `🦠 Эпидемия! Доход снижен на 50%\n`;
  if (oreLines.length > 0) {
    msg += `\n🎒 Добытые руды:\n${oreLines.join('\n')}\n`;
  }
  if (craftLines.length > 0) {
    msg += `\n🔩 Детали:\n${craftLines.join('\n')}\n`;
  }
  if (oreLines.length === 0 && craftLines.length === 0) {
    msg += `\n🎒 Ничего не добыто на этот раз.\n`;
  }
  msg += `\n❤️ Стамина: ${newSt}/${MAX_STAMINA}`;
  if (newSt < STAMINA_PER_WORK) msg += ` — мало! Напиши «Отдых» или «Еда».`;
  msg += `\n⏳ Следующий спуск через 30 минут.`;
  msg += `\n📊 Всего работ: ${p.work_count + 1}`;
  await send(ctx, msg);
}

async function cmdSellOre(ctx, uid, oreName) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  if (oreName === 'всё' || oreName === 'все') {
    let total = 0;
    const parts = [];
    for (const [name, ore] of Object.entries(ORES)) {
      const qty = await getItemQty(uid, name);
      if (qty > 0) {
        const sum = qty * ore.price;
        total += sum;
        await pool.query(
          `UPDATE inventory SET quantity=0 WHERE user_id=$1 AND item=$2`, [uid, name]
        );
        parts.push(`${ore.emoji} ${name} x${qty} = ${sum} монет`);
      }
    }
    const contQty = await getItemQty(uid, 'контрабанда');
    if (contQty > 0) {
      const sum = contQty * CONTRABAND_PRICE;
      total += sum;
      await pool.query(
        `UPDATE inventory SET quantity=0 WHERE user_id=$1 AND item='контрабанда'`, [uid]
      );
      parts.push(`🕵️ контрабанда x${contQty} = ${sum} монет`);
    }
    if (total === 0)
      return send(ctx, '🎒 Нечего продавать.\nДобудь руду командой «Работа».');
    await pool.query(`UPDATE players SET balance=balance+$1 WHERE user_id=$2`, [total, uid]);
    return send(ctx, `💰 Продано всё:\n${parts.join('\n')}\n\n✅ Итого: +${total} монет`);
  }

  if (oreName === 'контрабанда' || oreName === 'контрабанду') {
    const qty = await getItemQty(uid, 'контрабанда');
    if (qty <= 0)
      return send(ctx, `❌ Контрабанды нет в инвентаре.\nДобудь её через «Чёрная работа».`);
    const sum = qty * CONTRABAND_PRICE;
    await pool.query(
      `UPDATE inventory SET quantity=0 WHERE user_id=$1 AND item='контрабанда'`, [uid]
    );
    await pool.query(`UPDATE players SET balance=balance+$1 WHERE user_id=$2`, [sum, uid]);
    return send(ctx,
      `🕵️ Продана контрабанда x${qty} по ${CONTRABAND_PRICE} монет\n✅ +${sum} монет`
    );
  }

  const ore = ORES[oreName];
  if (!ore)
    return send(ctx,
      `❌ Руда «${oreName}» не существует.\n` +
      `Доступные: уголь, железо, алмаз, золото, рубин, платина\n` +
      `Или: «Продать всё»`
    );

  const qty = await getItemQty(uid, oreName);
  if (qty <= 0)
    return send(ctx, `❌ У тебя нет руды «${oreName}».\nДобудь её командой «Работа».`);

  const sum = qty * ore.price;
  await pool.query(
    `UPDATE inventory SET quantity=0 WHERE user_id=$1 AND item=$2`, [uid, oreName]
  );
  await pool.query(`UPDATE players SET balance=balance+$1 WHERE user_id=$2`, [sum, uid]);
  await send(ctx,
    `${ore.emoji} Продано: ${oreName} x${qty} по ${ore.price} монет\n✅ +${sum} монет`
  );
}

async function cmdPickaxe(ctx, uid) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  const cur = PICKAXE.find(l => l.level === p.pickaxe_lvl);

  if (!cur || cur.cost === null)
    return send(ctx,
      '🔨 Твоя кирка уже максимального уровня (5)!\n' +
      '📈 Бонус: +120% к добыче.\n' +
      '💎 Максимальный шанс всех руд!'
    );

  if (p.balance < cur.cost)
    return send(ctx,
      `🔨 Улучшение кирки до ур. ${cur.level + 1}:\n` +
      `💰 Стоимость: ${cur.cost} монет\n` +
      `👛 Твой баланс: ${p.balance} монет\n` +
      `❌ Не хватает: ${cur.cost - p.balance} монет.`
    );

  await pool.query(
    `UPDATE players SET balance=balance-$1, pickaxe_lvl=pickaxe_lvl+1 WHERE user_id=$2`,
    [cur.cost, uid]
  );
  const next = PICKAXE.find(l => l.level === cur.level + 1) || PICKAXE[PICKAXE.length - 1];
  await send(ctx,
    `🔨 Кирка улучшена до уровня ${cur.level + 1}!\n` +
    `📈 Бонус к добыче: +${next.bonus}%\n` +
    `💎 Шанс алмаза: ${Math.round((ORES['алмаз'].chance[cur.level] ?? 0) * 100)}%\n` +
    `🔴 Шанс рубина: ${Math.round((ORES['рубин'].chance[cur.level] ?? 0) * 100)}%\n` +
    `🪙 Шанс платины: ${Math.round((ORES['платина'].chance[cur.level] ?? 0) * 100)}%\n` +
    `💰 Списано: ${cur.cost} монет.`
  );
}

async function cmdBuyDrill(ctx, uid, qty) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  const totalCost = DRILL_COST * qty;
  
  if (p.balance < totalCost)
    return send(ctx,
      `⚙️ Покупка ${qty} бур(ов) — ${totalCost} монет\n` +
      `📈 Пассивный доход: +${DRILL_INCOME} монет/час каждый\n` +
      `👛 Твой баланс: ${p.balance} монет\n` +
      `❌ Не хватает: ${totalCost - p.balance} монет.`
    );

  const now = Date.now();
  let pendingEarned = 0;
  
  if (p.drills > 0) {
    const hours = Math.min((now - p.last_drill) / 3_600_000, PASSIVE_CAP_HOURS);
    pendingEarned = Math.floor(hours * DRILL_INCOME * p.drills);
  }
  
  await pool.query(
    `UPDATE players SET balance=balance-$1+$2, drills=drills+$3, last_drill=$4 WHERE user_id=$5`,
    [totalCost, pendingEarned, qty, now, uid]
  );

  let msg = `⚙️ Ты купил ${qty} бур(ов)! Всего: ${p.drills + qty} шт.\n`;
  if (pendingEarned > 0) msg += `💰 Автоматически собрано ${pendingEarned} монет с буров.\n`;
  msg += `💰 Пассивный доход: ${(p.drills + qty) * DRILL_INCOME} монет/час\n` +
    `📦 Максимум накопления: ${PASSIVE_CAP_HOURS} ч.\n` +
    `Забери доход командой «Доход».`;
  
  await send(ctx, msg);
}

async function cmdBuyOil(ctx, uid, qty) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  const totalCost = OIL_COST * qty;
  
  if (p.balance < totalCost)
    return send(ctx,
      `🛢️ Покупка ${qty} вышки(ек) — ${totalCost} монет\n` +
      `📈 Пассивный доход: +${OIL_INCOME} монет/час каждая\n` +
      `👛 Твой баланс: ${p.balance} монет\n` +
      `❌ Не хватает: ${totalCost - p.balance} монет.`
    );

  const now = Date.now();
  let pendingEarned = 0;
  
  if (p.oil_rigs > 0) {
    const hours = Math.min((now - p.last_oil) / 3_600_000, PASSIVE_CAP_HOURS);
    pendingEarned = Math.floor(hours * OIL_INCOME * p.oil_rigs);
  }
  
  await pool.query(
    `UPDATE players SET balance=balance-$1+$2, oil_rigs=oil_rigs+$3, last_oil=$4 WHERE user_id=$5`,
    [totalCost, pendingEarned, qty, now, uid]
  );

  let msg = `🛢️ Ты купил ${qty} нефтяных вышек! Всего: ${p.oil_rigs + qty} шт.\n`;
  if (pendingEarned > 0) msg += `💰 Автоматически собрано ${pendingEarned} монет с вышек.\n`;
  msg += `💰 Пассивный доход: ${(p.oil_rigs + qty) * OIL_INCOME} монет/час\n` +
    `📦 Максимум накопления: ${PASSIVE_CAP_HOURS} ч.\n` +
    `Забери доход командой «Нефть доход».`;
  
  await send(ctx, msg);
}

async function cmdIncome(ctx, uid) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  updateVirusStatus(p);

  if (p.drills === 0 && p.drills_enhanced === 0 && p.drills_diamond === 0)
    return send(ctx, `⚙️ У тебя нет буров.\nКупи бур командой «Бур [кол-во]» за ${DRILL_COST} монет/шт. или скрафти «Крафт бур обычный»`);

  const now = Date.now();
  const hours = Math.min((now - p.last_drill) / 3_600_000, PASSIVE_CAP_HOURS);
  
  const engineerBonus = getClassBonus(p, 'drill');
  let earned = 0;

  if (p.drills > 0) {
    let inc = DRILL_INCOME;
    if (engineerBonus > 0) inc = Math.floor(inc * (1 + engineerBonus));
    earned += Math.floor(hours * inc * p.drills);
  }
  if (p.drills_enhanced > 0) {
    let inc = 100;
    if (engineerBonus > 0) inc = Math.floor(inc * (1 + engineerBonus));
    earned += Math.floor(hours * inc * p.drills_enhanced);
  }
  if (p.drills_diamond > 0) {
    let inc = 250;
    if (engineerBonus > 0) inc = Math.floor(inc * (1 + engineerBonus));
    earned += Math.floor(hours * inc * p.drills_diamond);
  }

  if (globalEpidemic && p.virus !== 2) {
    earned = Math.floor(earned * (1 - VIRUS_INCOME_PENALTY));
  }

  if (earned <= 0)
    return send(ctx, `⚙️ Буры ещё не успели заработать.\nПодожди хотя бы несколько минут!`);

  await pool.query(
    `UPDATE players SET balance=balance+$1, last_drill=$2 WHERE user_id=$3`,
    [earned, now, uid]
  );
  
  let msg = `⚙️ Доход с буров!\n💰 +${earned} монет (за ${hours.toFixed(1)} ч.)\n`;
  if (p.drills > 0) {
    let inc = DRILL_INCOME;
    if (engineerBonus > 0) inc = Math.floor(inc * (1 + engineerBonus));
    msg += `• Обычные буры: ${p.drills} шт. (+${p.drills * inc}/ч)\n`;
  }
  if (p.drills_enhanced > 0) {
    let inc = 100;
    if (engineerBonus > 0) inc = Math.floor(inc * (1 + engineerBonus));
    msg += `• Усиленные буры: ${p.drills_enhanced} шт. (+${p.drills_enhanced * inc}/ч)\n`;
  }
  if (p.drills_diamond > 0) {
    let inc = 250;
    if (engineerBonus > 0) inc = Math.floor(inc * (1 + engineerBonus));
    msg += `• Алмазные буры: ${p.drills_diamond} шт. (+${p.drills_diamond * inc}/ч)\n`;
  }
  if (engineerBonus > 0) msg += `⚙️ Бонус инженера: +25%\n`;
  if (globalEpidemic && p.virus !== 2) msg += `🦠 Доход снижен из-за эпидемии!\n`;
  
  await send(ctx, msg);
}

async function cmdOilIncome(ctx, uid) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  updateVirusStatus(p);

  if (p.oil_rigs === 0)
    return send(ctx, `🛢️ У тебя нет нефтяных вышек.\nКупи командой «Нефть [кол-во]» за ${OIL_COST} монет/шт. или скрафти «Крафт вышка нефтяная»`);

  const now = Date.now();
  const hours = Math.min((now - p.last_oil) / 3_600_000, PASSIVE_CAP_HOURS);
  let baseIncome = OIL_INCOME;
  
  const oilBonus = getClassBonus(p, 'oil');
  if (oilBonus > 0) {
    baseIncome = Math.floor(baseIncome * (1 + oilBonus));
  }
  
  let earned = Math.floor(hours * baseIncome * p.oil_rigs);

  if (globalEpidemic && p.virus !== 2) {
    earned = Math.floor(earned * (1 - VIRUS_INCOME_PENALTY));
  }

  if (earned <= 0)
    return send(ctx, `🛢️ Вышки ещё не успели заработать.\nПодожди хотя бы несколько минут!`);

  await pool.query(
    `UPDATE players SET balance=balance+$1, last_oil=$2 WHERE user_id=$3`,
    [earned, now, uid]
  );
  
  let msg = `🛢️ Доход с ${p.oil_rigs} вышки(ок)!\n💰 +${earned} монет (за ${hours.toFixed(1)} ч.)\n📈 Доход: ${p.oil_rigs * baseIncome} монет/час`;
  if (oilBonus > 0) msg += `\n🛢️ Бонус нефтяника: +30%`;
  if (globalEpidemic && p.virus !== 2) msg += `\n🦠 Доход снижен из-за эпидемии!`;
  
  await send(ctx, msg);
}

async function cmdRest(ctx, uid) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  const now = Date.now();
  const left = REST_CD - (now - p.last_rest);

  if (left > 0)
    return send(ctx, `😴 Ты уже недавно отдыхал.\nСледующий отдых через ${fmtTime(left)}.`);

  const gained = MAX_STAMINA - p.stamina;
  await pool.query(
    `UPDATE players SET stamina=$1, last_rest=$2 WHERE user_id=$3`,
    [MAX_STAMINA, now, uid]
  );

  if (gained === 0) {
    await send(ctx, `😴 Ты отдохнул.\n❤️ Стамина уже была полная: ${MAX_STAMINA}/${MAX_STAMINA}`);
  } else {
    const workLeft = WORK_CD - (now - p.last_work);
    let workMsg = '';
    if (workLeft > 0) {
      workMsg = `\n⏳ Но работать пока нельзя — кулдаун работы: ${fmtTime(workLeft)}`;
    } else {
      workMsg = `\n✅ Можно работать! Напиши «Работа»`;
    }
    
    await send(ctx,
      `😴 Ты хорошо отдохнул!\n` +
      `❤️ Стамина: ${MAX_STAMINA}/${MAX_STAMINA} (+${gained})${workMsg}`
    );
  }
}

async function cmdProfile(ctx, uid) {
  const p = await getOrCreate(uid);
  updateVirusStatus(p);
  
  const name = await getName(uid);
  const pick = PICKAXE.find(l => l.level === p.pickaxe_lvl) || PICKAXE[0];
  const now = Date.now();

  let guildName = 'Нет';
  if (p.guild_id) {
    const gr = await pool.query('SELECT name FROM guilds WHERE id=$1', [p.guild_id]);
    if (gr.rows[0]) guildName = gr.rows[0].name;
  }

  const oreInfo = [];
  for (const [oreName, ore] of Object.entries(ORES)) {
    const qty = await getItemQty(uid, oreName);
    if (qty > 0) oreInfo.push(`${ore.emoji}${oreName}: ${qty} шт.`);
  }
  const contQty = await getItemQty(uid, 'контрабанда');
  if (contQty > 0) oreInfo.push(`🕵️контрабанда: ${contQty} шт.`);

  const workLeft = WORK_CD - (now - p.last_work);
  let workCdInfo = '';
  if (workLeft > 0) {
    workCdInfo = `\n⏳ Кулдаун работы: ${fmtTime(workLeft)}`;
  } else {
    workCdInfo = `\n✅ Можно работать!`;
  }

  let passiveInfo = '';
  if (p.drills > 0) {
    const drillHours = Math.min((now - p.last_drill) / 3_600_000, PASSIVE_CAP_HOURS);
    let baseDillIncome = DRILL_INCOME;
    if (getClassBonus(p, 'drill') > 0) baseDillIncome = Math.floor(baseDillIncome * 1.25);
    const drillPending = Math.floor(drillHours * baseDillIncome * p.drills);
    passiveInfo += `\n⚙️ Обычные буры: ${p.drills} шт. (+${p.drills * baseDillIncome}/ч, накоп: ${drillPending} монет)`;
  }
  if (p.drills_enhanced > 0) {
    const drillHours = Math.min((now - p.last_drill) / 3_600_000, PASSIVE_CAP_HOURS);
    let inc = 100;
    if (getClassBonus(p, 'drill') > 0) inc = Math.floor(inc * 1.25);
    const pending = Math.floor(drillHours * inc * p.drills_enhanced);
    passiveInfo += `\n🔩 Усиленные буры: ${p.drills_enhanced} шт. (+${p.drills_enhanced * inc}/ч, накоп: ${pending} монет)`;
  }
  if (p.drills_diamond > 0) {
    const drillHours = Math.min((now - p.last_drill) / 3_600_000, PASSIVE_CAP_HOURS);
    let inc = 250;
    if (getClassBonus(p, 'drill') > 0) inc = Math.floor(inc * 1.25);
    const pending = Math.floor(drillHours * inc * p.drills_diamond);
    passiveInfo += `\n💎 Алмазные буры: ${p.drills_diamond} шт. (+${p.drills_diamond * inc}/ч, накоп: ${pending} монет)`;
  }
  if (p.drills === 0 && p.drills_enhanced === 0 && p.drills_diamond === 0) {
    passiveInfo += `\n⚙️ Буры: нет`;
  }
  if (p.oil_rigs > 0) {
    const oilHours = Math.min((now - p.last_oil) / 3_600_000, PASSIVE_CAP_HOURS);
    let baseOilIncome = OIL_INCOME;
    if (getClassBonus(p, 'oil') > 0) baseOilIncome = Math.floor(baseOilIncome * 1.30);
    const oilPending = Math.floor(oilHours * baseOilIncome * p.oil_rigs);
    passiveInfo += `\n🛢️ Вышки: ${p.oil_rigs} шт. (+${p.oil_rigs * baseOilIncome}/ч, накоп: ${oilPending} монет)`;
  } else {
    passiveInfo += `\n🛢️ Вышки: нет`;
  }

  const jailInfo = p.jail_until > now
    ? `\n🚨 В тюрьме ещё ${fmtTime(p.jail_until - now)}`
    : '';

  const roofInfo = p.has_roof ? `\n🛡️ Крыша: активна (−50% шанс поимки)` : '';

  let healthInfo = '';
  if (p.vaccine_end > now) {
    healthInfo = `\n🦠 Здоровье: Защищён 💉 (${fmtTime(p.vaccine_end - now)})`;
  } else if (p.virus === 1 && p.virus_end > now) {
    healthInfo = `\n🦠 Здоровье: Болен 🤒 (выздоровеет через ${fmtTime(p.virus_end - now)})`;
  } else {
    healthInfo = `\n🦠 Здоровье: Здоров ✅`;
  }

  if (globalEpidemic) {
    healthInfo += `\n⚠️ В шахте эпидемия!`;
  }

  let classInfo = '';
  if (p.player_class) {
    const classEmoji = {
      'шахтёр': '⛏️',
      'инженер': '⚙️',
      'нефтяник': '🛢️',
      'врач': '🏥',
      'бригадир': '👑'
    };
    classInfo = `\n👤 Класс: ${classEmoji[p.player_class] || ''} ${p.player_class}`;
  } else {
    classInfo = `\n👤 Класс: не выбран (выбери командой «Класс»)`;
  }

  const adminInfo = p.is_admin ? `\n👑 Администратор` : '';

  const lines = [
    `👤 Профиль: ${name}`,
    `🆔 ID: ${uid}`,
    `💰 Баланс: ${p.balance} монет`,
    `❤️ Стамина: ${p.stamina}/${MAX_STAMINA}`,
    `⛏️ Кирка: ур. ${p.pickaxe_lvl} (+${pick.bonus}% к добыче)`,
    classInfo,
    adminInfo,
    workCdInfo,
    passiveInfo,
    `👥 Бригада: ${guildName}`,
    `⭐ Уровень крафта: ${p.craft_level}`,
    `📊 Всего работ: ${p.work_count}`,
    roofInfo,
    jailInfo,
    healthInfo,
  ];
  if (oreInfo.length > 0) lines.push(`\n🎒 Инвентарь: ${oreInfo.join(' | ')}`);

  await send(ctx, lines.filter(Boolean).join('\n'));
}

async function cmdTop(ctx) {
  const res = await pool.query(
    `SELECT user_id, balance FROM players WHERE hidden = FALSE AND banned = FALSE ORDER BY balance DESC LIMIT 10`
  );
  if (!res.rows.length) return send(ctx, '📊 Рейтинг пока пуст.');
  const lines = ['🏆 Топ-10 богатейших шахтёров:'];
  for (let i = 0; i < res.rows.length; i++) {
    const name = await getName(res.rows[i].user_id);
    lines.push(`${i + 1}. [id${res.rows[i].user_id}|${name}] (@id${res.rows[i].user_id}) — ${Number(res.rows[i].balance)} монет`);
  }
  await send(ctx, lines.join('\n'));
}

// ═══════════════════════════════════════════════════════════
//  ТОП БРИГАД
// ═══════════════════════════════════════════════════════════

async function cmdGuildTop(ctx) {
  const res = await pool.query(`
    SELECT 
      g.id, 
      g.name, 
      g.level, 
      g.treasury, 
      g.xp, 
      g.owner_id,
      COUNT(p.user_id) as members_count,
      COALESCE(SUM(p.balance), 0) as total_wealth,
      COALESCE(SUM(p.drills), 0) as total_drills,
      COALESCE(SUM(p.oil_rigs), 0) as total_rigs,
      COALESCE(AVG(p.pickaxe_lvl), 1) as avg_pickaxe,
      (SELECT user_id FROM players WHERE guild_id = g.id AND banned = FALSE ORDER BY balance DESC LIMIT 1) as richest_member
    FROM guilds g
    LEFT JOIN players p ON p.guild_id = g.id AND p.banned = FALSE
    GROUP BY g.id, g.name, g.level, g.treasury, g.xp, g.owner_id
    ORDER BY g.level DESC, g.xp DESC, total_wealth DESC
    LIMIT 10
  `);
  
  if (!res.rows.length) 
    return send(ctx, '👥 Нет созданных бригад.\nСоздайте первую: «Создать бригаду [имя]»');
  
  const lines = ['👑 Топ-10 бригад:', ''];
  
  for (let i = 0; i < res.rows.length; i++) {
    const g = res.rows[i];
    const ownerName = await getName(Number(g.owner_id));
    const level = Number(g.level);
    const members = Number(g.members_count);
    const treasury = Number(g.treasury);
    const totalWealth = Number(g.total_wealth);
    const totalDrills = Number(g.total_drills);
    const totalRigs = Number(g.total_rigs);
    const avgPickaxe = Number(g.avg_pickaxe).toFixed(1);
    const richestId = g.richest_member ? Number(g.richest_member) : null;
    const richestName = richestId ? await getName(richestId) : 'Нет';
    
    const placeEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}️⃣`;
    
    lines.push(
      `${placeEmoji} ${g.name} [Ур. ${level}]`,
      `   👑 Глава: ${ownerName}`,
      `   👤 Участников: ${members}`,
      `   💰 Общий баланс: ${totalWealth.toLocaleString()} монет`,
      `   🏦 Казна: ${treasury.toLocaleString()} монет`,
      `   ⚙️ Всего буров: ${totalDrills} | 🛢️ Всего вышек: ${totalRigs}`,
      `   ⛏️ Средний уровень кирки: ${avgPickaxe}`,
      `   🏆 Богатейший участник: ${richestName}`,
      `   📊 XP: ${Number(g.xp)}/${level * 5000}`,
      ''
    );
  }
  
  await send(ctx, lines.join('\n'));
}

// ═══════════════════════════════════════════════════════════
//  ТОП ЧАТОВ
// ═══════════════════════════════════════════════════════════

async function cmdChatTop(ctx) {
  const res = await pool.query(`
    SELECT 
      chat_id,
      COUNT(DISTINCT user_id) as unique_workers,
      SUM(work_count) as total_works
    FROM chat_activity
    GROUP BY chat_id
    ORDER BY total_works DESC
    LIMIT 10
  `);
  
  if (!res.rows.length) {
    return send(ctx, '📊 Пока нет данных об активности чатов.\nНачните работать в беседах, чтобы попасть в топ!');
  }
  
  const lines = ['💬 ТОП-10 ЧАТОВ ПО АКТИВНОСТИ:', ''];
  
  for (let i = 0; i < res.rows.length; i++) {
    const chat = res.rows[i];
    let chatName;
    
    try {
      const chatInfo = await vk.api.messages.getConversationsById({
        peer_ids: Number(chat.chat_id) + 2000000000
      });
      if (chatInfo && chatInfo.items && chatInfo.items[0]) {
        chatName = chatInfo.items[0].chat_settings.title;
      } else {
        chatName = `Чат #${chat.chat_id}`;
      }
    } catch {
      chatName = `Чат #${chat.chat_id}`;
    }
    
    const placeEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}️⃣`;
    
    lines.push(
      `${placeEmoji} ${chatName}`,
      `   👤 Рабочих: ${Number(chat.unique_workers)}`,
      `   ⛏️ Всего работ: ${Number(chat.total_works)}`,
      ''
    );
  }
  
  lines.push('💡 Работайте в беседах, чтобы поднять свой чат в рейтинге!');
  
  await send(ctx, lines.join('\n'));
}

async function cmdShop(ctx) {
  const lines = ['🛒 Магазин Generational Miners:', ''];
  lines.push('📦 Расходники и снаряжение:');
  for (const [name, item] of Object.entries(SHOP_ITEMS))
    lines.push(`• ${name} — ${item.cost} монет\n  └ ${item.desc}`);
  lines.push(
    '',
    '🔧 Техника:',
    `• Кирка — улучшение (+30% за ур.) → «Кирка»`,
    `• Бур — ${DRILL_COST} монет/шт., +${DRILL_INCOME} монет/час → «Бур [кол-во]»`,
    `• Нефтяная вышка — ${OIL_COST} монет/шт., +${OIL_INCOME} монет/час → «Нефть [кол-во]»`,
    '',
    '⛏️ Руды (добываются через «Работа»):',
    `• 🪨 Уголь — 50 монет/шт.`,
    `• ⚙️ Железо — 150 монет/шт.`,
    `• 💎 Алмаз — 500 монет/шт.`,
    `• 🥇 Золото — 800 монет/шт.`,
    `• 🔴 Рубин — 1200 монет/шт.`,
    `• 🪙 Платина — 2000 монет/шт.`,
    '',
    '🕵️ Нелегальное:',
    `• Контрабанда — 300 монет/шт. (добывается через «Чёрная работа»)`,
    '',
    '🦠 Медицина:',
    `• Аптечка — ${MEDKIT_COST} монет (лечит вирус + 30 стамины)`,
    `• Вакцина — ${VACCINE_COST} монет (защита от вируса на 24 часа)`,
    `• Антибиотик — ${ANTIBIOTIC_COST} монет (ускоряет выздоровление в 2 раза)`,
    '',
    '🔨 Крафт буров (дешевле покупки!):',
    '• Обычный бур — 10🗿железа + 5🪨угля + 500💰',
    '• Усиленный бур — 5🔩пластин + 3⚙️шестерни + 1🧪смазка + 1000💰',
    '• Алмазный бур — 2💎наконечника + 1🧲магнит + 3000💰',
    '• Нефтяная вышка — 20🗿железа + 10⚙️шестерён + 5🧪смазки + 2500💰',
    '',
    '👤 Классы:',
    '• Шахтёр — +20% к добыче',
    '• Инженер — буры +25%',
    '• Нефтяник — вышки +30%',
    '• Врач — лечить других за 50% стоимости',
    '• Бригадир — +10% к бонусу бригады',
    '',
    'Купить: «Купить [товар] [кол-во]»',
    'Продать руду: «Продать всё» или «Продать [руда]»',
    'Крафтить: «Крафт [предмет]»',
    'Выбрать класс: «Класс [название]»'
  );
  await send(ctx, lines.join('\n'));
}

async function cmdBuyItem(ctx, uid, item, qty) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  const shopItem = SHOP_ITEMS[item];
  if (!shopItem)
    return send(ctx, `❌ Товар «${item}» не найден.\nНапиши «Магазин» для списка.`);

  const p2 = await getOrCreate(uid);
  const totalCost = shopItem.cost * qty;
  
  if (p2.balance < totalCost)
    return send(ctx,
      `❌ Нужно ${totalCost} монет (${shopItem.cost} × ${qty}).\n👛 Твой баланс: ${p2.balance} монет.`
    );

  if (item === 'крыша') {
    if (p2.has_roof)
      return send(ctx, `🛡️ У тебя уже есть крыша!\nОна снижает шанс поимки при чёрной работе.`);
    await pool.query(
      `UPDATE players SET balance=balance-$1, has_roof=TRUE WHERE user_id=$2`,
      [shopItem.cost, uid]
    );
    return send(ctx,
      `🛡️ Ты купил крышу!\n` +
      `Теперь шанс поимки при чёрной работе снижен в 2 раза.\n` +
      `💰 Списано: ${shopItem.cost} монет.`
    );
  }

  if (item === 'вакцина') {
    const now = Date.now();
    const vaccineEnd = now + VACCINE_DURATION;
    await pool.query(
      `UPDATE players SET balance=balance-$1, virus=2, vaccine_end=$2, virus_end=0 WHERE user_id=$3`,
      [shopItem.cost, vaccineEnd, uid]
    );
    return send(ctx,
      `💉 Ты купил вакцину!\n` +
      `🛡️ Защита от вируса на 24 часа.\n` +
      `💰 Списано: ${shopItem.cost} монет.`
    );
  }

  if (item === 'аптечка') {
    const now = Date.now();
    const newStamina = Math.min(MAX_STAMINA, p2.stamina + 30);
    await pool.query(
      `UPDATE players SET balance=balance-$1, virus=0, virus_end=0, stamina=$2 WHERE user_id=$3`,
      [shopItem.cost, newStamina, uid]
    );
    return send(ctx,
      `🏥 Ты использовал аптечку!\n` +
      `✅ Вирус вылечен!\n` +
      `❤️ Стамина: ${newStamina}/${MAX_STAMINA} (+30)\n` +
      `💰 Списано: ${shopItem.cost} монет.`
    );
  }

  if (item === 'антибиотик') {
    if (p2.virus !== 1 || p2.virus_end <= Date.now())
      return send(ctx, `❌ Ты не болен! Антибиотик нужен только при вирусе.`);
    
    const remaining = p2.virus_end - Date.now();
    const newEnd = Date.now() + Math.floor(remaining / 2);
    await pool.query(
      `UPDATE players SET balance=balance-$1, virus_end=$2 WHERE user_id=$3`,
      [shopItem.cost, newEnd, uid]
    );
    return send(ctx,
      `🧪 Ты принял антибиотик!\n` +
      `⏳ Выздоровление ускорено в 2 раза!\n` +
      `🦠 До выздоровления: ${fmtTime(newEnd - Date.now())}\n` +
      `💰 Списано: ${shopItem.cost} монет.`
    );
  }

  await pool.query(
    `UPDATE players SET balance=balance-$1 WHERE user_id=$2`, [totalCost, uid]
  );
  await addItem(uid, item, qty);
  await send(ctx, `✅ Куплено: «${item}» ×${qty} за ${totalCost} монет!`);
}

async function cmdUseItem(ctx, uid, item) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  const qty = await getItemQty(uid, item);
  if (qty <= 0)
    return send(ctx, `❌ У тебя нет «${item}» в инвентаре.\nКупи: «Купить ${item}»`);

  if (item === 'еда') {
    if (p.stamina >= MAX_STAMINA)
      return send(ctx, `❤️ Стамина уже полная! (${MAX_STAMINA}/${MAX_STAMINA})\nНе трать еду зря.`);
    
    const gained = Math.min(50, MAX_STAMINA - p.stamina);
    const newSt = p.stamina + gained;
    
    await pool.query(`UPDATE players SET stamina=$1 WHERE user_id=$2`, [newSt, uid]);
    await pool.query(
      `UPDATE inventory SET quantity=quantity-1 WHERE user_id=$1 AND item='еда' AND quantity>0`, 
      [uid]
    );
    
    let msg = `🍎 Ты съел еду!\n❤️ Стамина: ${newSt}/${MAX_STAMINA} (+${gained})`;
    
    const now = Date.now();
    const workLeft = WORK_CD - (now - p.last_work);
    
    if (newSt >= STAMINA_PER_WORK) {
      if (workLeft <= 0) {
        msg += `\n\n✅ Теперь можно работать! Напиши «Работа»`;
      } else {
        msg += `\n⏳ Но кулдаун работы ещё не прошёл. Подожди ${fmtTime(workLeft)}.`;
      }
    } else {
      msg += `\n😮‍💨 Всё ещё мало для работы (нужно ${STAMINA_PER_WORK}). Купи ещё еды или «Отдых».`;
    }
    
    await send(ctx, msg);
  } else if (item === 'динамит') {
    await send(ctx,
      `💥 Динамит в инвентаре! (${qty} шт.)\n` +
      `Сработает автоматически при «Работа» (удваивает добычу и руды) или при «Чёрная работа» (+100% дохода, −10% к шансу поимки).`
    );
  } else {
    await send(ctx, `ℹ️ Предмет «${item}» не требует активации. Используй его автоматически или купи нужный эффект.`);
  }
}

async function cmdInventory(ctx, uid) {
  const res = await pool.query(
    'SELECT item, quantity FROM inventory WHERE user_id=$1 AND quantity>0 ORDER BY item', [uid]
  );
  if (!res.rows.length)
    return send(ctx, '🎒 Инвентарь пуст.\nДобудь руду — «Работа», или купи предмет — «Магазин»');

  const oreItems = [];
  const craftItems = [];
  const otherItems = [];
  for (const r of res.rows) {
    if (ORES[r.item]) {
      oreItems.push(`• ${ORES[r.item].emoji} ${r.item}: ${r.quantity} шт. (= ${r.quantity * ORES[r.item].price} монет)`);
    } else if (r.item === 'контрабанда') {
      otherItems.push(`• 🕵️ контрабанда: ${r.quantity} шт. (= ${r.quantity * CONTRABAND_PRICE} монет)`);
    } else if (CRAFT_RESOURCES[r.item]) {
      craftItems.push(`• ${CRAFT_RESOURCES[r.item].emoji} ${CRAFT_RESOURCES[r.item].name}: ${r.quantity} шт.`);
    } else {
      otherItems.push(`• ${r.item}: ${r.quantity} шт.`);
    }
  }

  const lines = ['🎒 Твой инвентарь:'];
  if (oreItems.length > 0) {
    lines.push('\n⛏️ Руды:');
    lines.push(...oreItems);
    lines.push('(Продать: «Продать всё»)');
  }
  if (craftItems.length > 0) {
    lines.push('\n🔩 Детали для крафта:');
    lines.push(...craftItems);
  }
  if (otherItems.length > 0) {
    lines.push('\n📦 Предметы:');
    lines.push(...otherItems);
  }
  await send(ctx, lines.join('\n'));
}

// ═══════════════════════════════════════════════════════════
//  КРАФТ
// ═══════════════════════════════════════════════════════════

async function cmdCraft(ctx, uid, craftName) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  if (!craftName) {
    return send(ctx,
      '🔨 Укажи, что скрафтить: «Крафт [предмет]»\n' +
      'Примеры:\n' +
      '• Крафт бур обычный\n' +
      '• Крафт бур усиленный\n' +
      '• Крафт бур алмазный\n' +
      '• Крафт вышка нефтяная\n' +
      '• Крафт шестерня\n' +
      '• Крафт алмазный наконечник\n' +
      '• Крафт магнит\n\n' +
      '📋 Все рецепты: «Рецепты»'
    );
  }

  let recipeKey = null;
  const normalized = craftName.toLowerCase().replace(/\s+/g, '_');
  
  if (normalized.includes('бур_обычный') || normalized === 'обычный_бур') recipeKey = 'бур_обычный';
  else if (normalized.includes('бур_усиленный') || normalized === 'усиленный_бур') recipeKey = 'бур_усиленный';
  else if (normalized.includes('бур_алмазный') || normalized === 'алмазный_бур') recipeKey = 'бур_алмазный';
  else if (normalized.includes('вышка_нефтяная') || normalized === 'нефтяная_вышка') recipeKey = 'вышка_нефтяная';
  else if (normalized === 'шестерня' || normalized === 'крафт_шестерня') recipeKey = 'шестерня_крафт';
  else if (normalized.includes('алмазный_наконечник') || normalized === 'наконечник') recipeKey = 'алмазный_наконечник_крафт';
  else if (normalized === 'магнит' || normalized === 'магнитный_стабилизатор') recipeKey = 'магнит_крафт';

  if (!recipeKey) {
    return send(ctx,
      `❌ Рецепт «${craftName}» не найден.\n` +
      `📋 Доступные рецепты: «Рецепты»`
    );
  }

  const recipe = CRAFT_RECIPES[recipeKey];
  
  const missingIngredients = [];
  for (const [item, qty] of Object.entries(recipe.ingredients)) {
    const playerQty = await getItemQty(uid, item);
    if (playerQty < qty) {
      missingIngredients.push(`${item}: ${playerQty}/${qty}`);
    }
  }

  if (missingIngredients.length > 0) {
    return send(ctx,
      `❌ Не хватает ресурсов для крафта «${recipe.name}»:\n` +
      missingIngredients.map(m => `• ${m}`).join('\n')
    );
  }

  if (p.balance < recipe.coins_cost) {
    return send(ctx,
      `❌ Не хватает монет: ${recipe.coins_cost}💰\n` +
      `👛 Твой баланс: ${p.balance}💰`
    );
  }

  for (const [item, qty] of Object.entries(recipe.ingredients)) {
    await removeItem(uid, item, qty);
  }

  await pool.query(`UPDATE players SET balance=balance-$1 WHERE user_id=$2`, [recipe.coins_cost, uid]);

  const craftBonus = getClassBonus(p, 'craft');
  let resultAmount = recipe.result_amount;
  if (craftBonus > 0 && Math.random() < craftBonus) {
    resultAmount += 1;
  }

  if (recipe.result_type === 'drill') {
    await pool.query(`UPDATE players SET drills=drills+$1 WHERE user_id=$2`, [resultAmount, uid]);
  } else if (recipe.result_type === 'drill_enhanced') {
    await pool.query(`UPDATE players SET drills_enhanced=drills_enhanced+$1 WHERE user_id=$2`, [resultAmount, uid]);
  } else if (recipe.result_type === 'drill_diamond') {
    await pool.query(`UPDATE players SET drills_diamond=drills_diamond+$1 WHERE user_id=$2`, [resultAmount, uid]);
  } else if (recipe.result_type === 'oil_rig') {
    await pool.query(`UPDATE players SET oil_rigs=oil_rigs+$1 WHERE user_id=$2`, [resultAmount, uid]);
  } else if (recipe.result_type === 'craft_resource') {
    await addItem(uid, recipe.result_item, resultAmount);
  }

  const craftXP = Math.floor(recipe.coins_cost / 100);
  const newCraftLevel = Math.floor(p.craft_level + craftXP / 1000);
  await pool.query(
    `UPDATE players SET craft_level=$1 WHERE user_id=$2`,
    [Math.max(p.craft_level, newCraftLevel), uid]
  );

  let msg = `🔨 Ты скрафтил: ${recipe.emoji} ${recipe.name} ×${resultAmount}!\n`;
  msg += `💰 Потрачено: ${recipe.coins_cost} монет\n`;
  
  if (craftBonus > 0 && resultAmount > recipe.result_amount) {
    msg += `⚙️ Бонус инженера: +1 предмет!\n`;
  }
  
  if (recipe.result_type.includes('drill') || recipe.result_type === 'oil_rig') {
    msg += `📈 Доход: ${recipe.desc}\n`;
  }

  msg += `\n⭐ Уровень крафта: ${Math.max(p.craft_level, newCraftLevel)}`;
  
  await send(ctx, msg);
}

async function cmdRecipes(ctx) {
  const lines = ['📋 РЕЦЕПТЫ КРАФТА:', ''];
  
  lines.push('⚙️ БУРЫ:');
  lines.push('• Обычный бур (+50💰/ч): 10🗿железа + 5🪨угля + 500💰');
  lines.push('• Усиленный бур (+100💰/ч): 5🔩пластин + 3⚙️шестерни + 1🧪смазка + 1000💰');
  lines.push('• Алмазный бур (+250💰/ч): 2💎наконечника + 1🧲магнит + 3000💰');
  
  lines.push('');
  lines.push('🛢️ НЕФТЯНЫЕ ВЫШКИ:');
  lines.push('• Нефтяная вышка (+150💰/ч): 20🗿железа + 10⚙️шестерён + 5🧪смазки + 2500💰');
  
  lines.push('');
  lines.push('🔩 ПЕРЕРАБОТКА РЕСУРСОВ:');
  lines.push('• Шестерня: 5🗿железа + 200💰');
  lines.push('• Алмазный наконечник: 3💎алмаза + 2🔩пластины + 500💰');
  lines.push('• Магнитный стабилизатор: 5🥇золота + 2🔴рубина + 1000💰');
  
  lines.push('');
  lines.push('💡 Для крафта используй: «Крафт [предмет]»');
  lines.push('📦 Проверить ресурсы: «Детали»');
  lines.push('⭐ Уровень крафта растёт при создании предметов');
  
  await send(ctx, lines.join('\n'));
}

async function cmdParts(ctx, uid) {
  const parts = [];
  
  for (const [key, res] of Object.entries(CRAFT_RESOURCES)) {
    const qty = await getItemQty(uid, key);
    parts.push(`${res.emoji} ${res.name}: ${qty} шт.`);
  }
  
  const ores = [];
  for (const [key, ore] of Object.entries(ORES)) {
    const qty = await getItemQty(uid, key);
    if (qty > 0) ores.push(`${ore.emoji} ${key}: ${qty} шт.`);
  }
  
  let msg = '🔩 ТВОИ ДЕТАЛИ И РЕСУРСЫ:\n\n';
  msg += 'Детали:\n' + (parts.length > 0 ? parts.join('\n') : 'Нет деталей') + '\n';
  
  if (ores.length > 0) {
    msg += '\nРуды:\n' + ores.join('\n');
  }
  
  msg += '\n\n💡 Крафтить: «Крафт [предмет]»\n📋 Рецепты: «Рецепты»';
  
  await send(ctx, msg);
}

// ═══════════════════════════════════════════════════════════
//  ВОРОВСТВО (У ТОП-5 ПО ID)
// ═══════════════════════════════════════════════════════════

async function cmdSteal(ctx, uid, targetIdStr) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  const now = Date.now();
  
  updateVirusStatus(p);

  if (p.jail_until > now)
    return send(ctx,
      `🚨 Ты в тюрьме! Нельзя воровать.\n` +
      `⏳ Выйдешь через ${fmtTime(p.jail_until - now)}.`
    );

  if (p.virus === 1 && p.virus_end > now)
    return send(ctx,
      `🦠 Ты болен вирусом! Нельзя воровать.\n` +
      `🏥 Вылечись командой «Лечить».`
    );

  const leftCd = STEAL_CD - (now - p.last_steal);
  if (leftCd > 0)
    return send(ctx, `🎭 Нужно переждать — воровство доступно через ${fmtTime(leftCd)}.`);

  let victimId = null;
  let victimBalance = 0;

  // Получаем топ-5 игроков для воровства
  const topRes = await pool.query(
    `SELECT user_id, balance FROM players
     WHERE user_id != $1 AND balance >= $2 AND banned = FALSE AND hidden = FALSE
     ORDER BY balance DESC LIMIT 5`,
    [uid, STEAL_MIN_BALANCE]
  );

  if (!topRes.rows.length)
    return send(ctx,
      `🎭 Нет подходящих жертв.\n` +
      `Для кражи нужен игрок с балансом от ${STEAL_MIN_BALANCE} монет.\n` +
      `Проверь топ: «Топ»`
    );

  // Если указан ID жертвы
  if (targetIdStr) {
    victimId = parseInt(targetIdStr);
    if (!victimId || isNaN(victimId))
      return send(ctx, '❌ Неверный ID игрока.\nФормат: «Своровать [ID]»\nПример: «Своровать 123456789»');

    if (victimId === uid)
      return send(ctx, '❌ Нельзя воровать у самого себя!');

    const isInTop5 = topRes.rows.some(r => Number(r.user_id) === victimId);
    if (!isInTop5)
      return send(ctx,
        `❌ Игрок #${victimId} не входит в топ-5 богатейших игроков!\n` +
        `Воровать можно только у игроков из топ-5 с балансом от ${STEAL_MIN_BALANCE} монет.\n` +
        `Проверь топ: «Топ»`
      );

    const victim = topRes.rows.find(r => Number(r.user_id) === victimId);
    victimBalance = Number(victim.balance);
  } else {
    // Случайная жертва из топ-5
    const victim = topRes.rows[Math.floor(Math.random() * topRes.rows.length)];
    victimId = Number(victim.user_id);
    victimBalance = Number(victim.balance);
  }

  await pool.query(`UPDATE players SET last_steal=$1 WHERE user_id=$2`, [now, uid]);

  const success = Math.random() < STEAL_CHANCE;
  const thiefName = await getName(uid);
  const victimName = await getName(victimId);

  if (!success) {
    const fine = Math.min(500, p.balance);
    await pool.query(`UPDATE players SET balance=balance-$1 WHERE user_id=$2`, [fine, uid]);
    
    try {
      await vk.api.messages.send({
        user_id: victimId,
        message: `🎭 Игрок ${thiefName} (ID: ${uid}) пытался украсть у тебя монеты, но был пойман!\n🛡️ Твои сбережения в безопасности.`,
        random_id: Math.floor(Math.random() * 1e9),
      });
    } catch {}
    
    return send(ctx,
      `🎭 КРАЖУ ЗАМЕТИЛИ!\n\n` +
      `👁️ Игрок ${victimName} (ID: ${victimId}) поймал тебя с поличным!\n` +
      `💸 Штраф: ${fine} монет\n` +
      `⏳ Следующая попытка через 4 часа.`
    );
  }

  const pct = STEAL_MIN_PCT + Math.random() * (STEAL_MAX_PCT - STEAL_MIN_PCT);
  const stolen = Math.max(50, Math.floor(victimBalance * pct));

  await pool.query(`UPDATE players SET balance=balance-$1 WHERE user_id=$2`, [stolen, victimId]);
  await pool.query(`UPDATE players SET balance=balance+$1 WHERE user_id=$2`, [stolen, uid]);

  try {
    await vk.api.messages.send({
      user_id: victimId,
      message: `🎭 У тебя украли ${stolen} монет!\n😈 Вор: ${thiefName} (ID: ${uid})\n💡 Совет: храни деньги в казне бригады или покупай буры/вышки!`,
      random_id: Math.floor(Math.random() * 1e9),
    });
  } catch {}

  await send(ctx,
    `🎭 КРАЖА УДАЛАСЬ!\n\n` +
    `🏆 Жертва: ${victimName} (ID: ${victimId})\n` +
    `💰 Украдено: ${stolen} монет (${(pct * 100).toFixed(1)}% баланса)\n` +
    `⏳ Следующая кража через 4 часа.\n\n` +
    `💡 Чтобы украсть у конкретного игрока: «Своровать [ID]»\n` +
    `💡 Чтобы защититься от краж — держи меньше монет на балансе!`
  );
}

// ═══════════════════════════════════════════════════════════
//  КОМАНДЫ ВИРУСА
// ═══════════════════════════════════════════════════════════

async function cmdHeal(ctx, uid, targetIdStr) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');
  
  let targetId = uid;
  let isHealingOther = false;
  
  if (targetIdStr) {
    targetId = parseInt(targetIdStr);
    if (!targetId || isNaN(targetId)) {
      return send(ctx, '❌ Неверный ID игрока.');
    }
    
    if (p.player_class !== 'врач') {
      return send(ctx, '❌ Только врачи могут лечить других игроков!');
    }
    
    isHealingOther = true;
  }
  
  const target = await getPlayer(targetId);
  if (!target) {
    return send(ctx, `❌ Игрок #${targetId} не найден.`);
  }
  
  updateVirusStatus(target);
  
  if (target.virus !== 1) {
    if (isHealingOther) {
      return send(ctx, `✅ Игрок #${targetId} здоров! Лечение не требуется.`);
    }
    return send(ctx, `✅ Ты здоров! Лечение не требуется.\n💉 Для защиты купи «Вакцина» за ${VACCINE_COST} монет.`);
  }
  
  let healCost = MEDKIT_COST;
  if (isHealingOther) {
    healCost = Math.floor(MEDKIT_COST / 2);
  }
  
  if (p.balance < healCost)
    return send(ctx,
      `🏥 Лечение стоит ${healCost} монет.\n` +
      `👛 Твой баланс: ${p.balance} монет.\n` +
      `❌ Не хватает: ${healCost - p.balance} монет.`
    );
  
  const newStamina = Math.min(MAX_STAMINA, target.stamina + 30);
  await pool.query(
    `UPDATE players SET balance=balance-$1 WHERE user_id=$2`,
    [healCost, uid]
  );
  await pool.query(
    `UPDATE players SET virus=0, virus_end=0, stamina=$1 WHERE user_id=$2`,
    [newStamina, targetId]
  );
  
  if (isHealingOther) {
    const targetName = await getName(targetId);
    await send(ctx,
      `🏥 Ты вылечил игрока ${targetName} (ID: ${targetId})!\n` +
      `💰 Списано: ${healCost} монет (50% скидка врача).`
    );
    
    try {
      await vk.api.messages.send({
        user_id: targetId,
        message: `🏥 Врач вылечил тебя от вируса!\n❤️ Стамина восстановлена до ${newStamina}/${MAX_STAMINA}.`,
        random_id: Math.floor(Math.random() * 1e9),
      });
    } catch {}
  } else {
    await send(ctx,
      `🏥 Ты вылечился от вируса!\n` +
      `✅ Здоровье восстановлено!\n` +
      `❤️ Стамина: ${newStamina}/${MAX_STAMINA} (+30)\n` +
      `💰 Списано: ${healCost} монет.`
    );
  }
}

async function cmdVaccinate(ctx, uid) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');
  
  const now = Date.now();
  
  if (p.vaccine_end > now)
    return send(ctx,
      `💉 У тебя уже активна вакцина!\n` +
      `⏳ Защита действует ещё ${fmtTime(p.vaccine_end - now)}.`
    );
  
  if (p.balance < VACCINE_COST)
    return send(ctx,
      `💉 Вакцина стоит ${VACCINE_COST} монет.\n` +
      `👛 Твой баланс: ${p.balance} монет.\n` +
      `❌ Не хватает: ${VACCINE_COST - p.balance} монет.`
    );
  
  const vaccineEnd = now + VACCINE_DURATION;
  await pool.query(
    `UPDATE players SET balance=balance-$1, virus=2, vaccine_end=$2, virus_end=0 WHERE user_id=$3`,
    [VACCINE_COST, vaccineEnd, uid]
  );
  
  await send(ctx,
    `💉 Ты вакцинирован!\n` +
    `🛡️ Защита от вируса на 24 часа.\n` +
    `💰 Списано: ${VACCINE_COST} монет.`
  );
}

async function cmdVirusStatus(ctx, uid) {
  const p = await getOrCreate(uid);
  updateVirusStatus(p);
  
  const now = Date.now();
  let status = '';
  
  if (p.vaccine_end > now) {
    status = `💉 Защищён вакциной! (ещё ${fmtTime(p.vaccine_end - now)})`;
  } else if (p.virus === 1 && p.virus_end > now) {
    status = `🤒 Болен вирусом! До выздоровления: ${fmtTime(p.virus_end - now)}`;
  } else {
    status = `✅ Здоров`;
  }
  
  let epidemicInfo = '';
  if (globalEpidemic) {
    epidemicInfo = `\n⚠️ В шахте эпидемия! Доход снижен на 50%.\n⏳ До конца: ${fmtTime(epidemicEndTime - now)}`;
  }
  
  let healInfo = '';
  if (p.player_class === 'врач') {
    healInfo = `\n\n🏥 Ты врач! Можешь лечить других за ${Math.floor(MEDKIT_COST / 2)}💰:\n«Лечить [ID]»`;
  }
  
  await send(ctx,
    `🦠 Статус здоровья:\n` +
    `${status}` +
    `${epidemicInfo}\n\n` +
    `🏥 Лечение: «Лечить» (${MEDKIT_COST}💰) или «Купить аптечка»\n` +
    `💉 Вакцина: «Вакцина» или «Купить вакцина» (${VACCINE_COST}💰)\n` +
    `🧪 Антибиотик: «Купить антибиотик» (${ANTIBIOTIC_COST}💰)` +
    `${healInfo}`
  );
}

async function cmdEpidemicInfo(ctx) {
  if (!globalEpidemic)
    return send(ctx, '✅ В шахте сейчас нет эпидемии.\nВсе здоровы и работают в обычном режиме.');
  
  const now = Date.now();
  const remaining = epidemicEndTime - now;
  
  await send(ctx,
    `🦠 ЭПИДЕМИЯ В ШАХТЕ!\n\n` +
    `⚠️ Все игроки теряют 20 стамины при заражении\n` +
    `📉 Пассивный доход снижен на 50%\n` +
    `⏳ До конца эпидемии: ${fmtTime(remaining)}\n\n` +
    `🏥 Лечиться: «Лечить» (${MEDKIT_COST}💰)\n` +
    `💉 Защита: «Вакцина» (${VACCINE_COST}💰)\n` +
    `🧪 Ускорить: «Купить антибиотик» (${ANTIBIOTIC_COST}💰)\n\n` +
    `👨‍⚕️ Врачи могут лечить других за ${Math.floor(MEDKIT_COST / 2)}💰: «Лечить [ID]»`
  );
}

// ═══════════════════════════════════════════════════════════
//  ЭПИДЕМИЯ — СИСТЕМА
// ═══════════════════════════════════════════════════════════

async function startEpidemic() {
  if (globalEpidemic) return;
  
  globalEpidemic = true;
  epidemicEndTime = Date.now() + EPIDEMIC_DURATION;
  
  console.log('🦠 Эпидемия началась!');
  
  const players = await pool.query(
    `SELECT user_id, vaccine_end FROM players WHERE banned = FALSE`
  );
  
  let infectedCount = 0;
  for (const pl of players.rows) {
    if (pl.vaccine_end <= Date.now()) {
      await pool.query(
        `UPDATE players SET virus=1, virus_end=$1, stamina=GREATEST(0, stamina-$2) WHERE user_id=$3 AND vaccine_end <= $4`,
        [epidemicEndTime, VIRUS_STAMINA_LOSS, pl.user_id, Date.now()]
      );
      infectedCount++;
    } else {
      await pool.query(
        `UPDATE players SET virus=2 WHERE user_id=$1`, [pl.user_id]
      );
    }
  }
  
  const allPlayers = await pool.query(
    `SELECT user_id FROM players WHERE banned = FALSE`
  );
  
  for (const pl of allPlayers.rows) {
    try {
      await vk.api.messages.send({
        user_id: pl.user_id,
        message: `🦠 ВНИМАНИЕ! В шахте обнаружен вирус «Чёрная плесень»!\n\n🤒 Все шахтёры теряют 20 стамины и получают -50% к доходу.\n🏥 Лечись командой «Лечить» (300💰) или купи «Вакцина» (1000💰) для защиты.\n👨‍⚕️ Врачи могут лечить других за 150💰: «Лечить [ID]»\n⏳ Эпидемия продлится 3 часа. Береги себя!`,
        random_id: Math.floor(Math.random() * 1e9),
      });
    } catch {}
  }
  
  console.log(`🦠 Заразилось ${infectedCount} игроков`);
  
  setTimeout(() => {
    endEpidemic();
  }, EPIDEMIC_DURATION);
}

async function endEpidemic() {
  globalEpidemic = false;
  epidemicEndTime = 0;
  
  console.log('🦠 Эпидемия закончилась!');
  
  await pool.query(
    `UPDATE players SET virus=0, virus_end=0 WHERE virus=1`
  );
  
  await pool.query(
    `UPDATE players SET virus=0 WHERE virus=2 AND vaccine_end <= $1`,
    [Date.now()]
  );
  
  const allPlayers = await pool.query(
    `SELECT user_id FROM players WHERE banned = FALSE`
  );
  
  for (const pl of allPlayers.rows) {
    try {
      await vk.api.messages.send({
        user_id: pl.user_id,
        message: `✅ Эпидемия в шахте закончилась!\nВсе здоровы и могут работать в обычном режиме.\nДоходы восстановлены.`,
        random_id: Math.floor(Math.random() * 1e9),
      });
    } catch {}
  }
}

function startEpidemicChecker() {
  setInterval(() => {
    if (!globalEpidemic && Math.random() < EPIDEMIC_CHANCE) {
      startEpidemic();
    }
  }, EPIDEMIC_CHECK_INTERVAL);
}

// ═══════════════════════════════════════════════════════════
//  БРИГАДЫ
// ═══════════════════════════════════════════════════════════

async function cmdGuildInfo(ctx, uid) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  if (!p.guild_id)
    return send(ctx,
      '👥 Ты не состоишь в бригаде.\n\n' +
      `Создать: «Создать бригаду [имя]» (${GUILD_COST} монет)\n` +
      'Вступить: попроси главу пригласить тебя.'
    );

  const gr = await pool.query('SELECT * FROM guilds WHERE id=$1', [p.guild_id]);
  if (!gr.rows[0]) {
    await pool.query(`UPDATE players SET guild_id=NULL WHERE user_id=$1`, [uid]);
    return send(ctx, '❌ Твоя бригада не найдена. guild_id сброшен.');
  }
  const g = gr.rows[0];
  const memberR = await pool.query('SELECT COUNT(*) as cnt FROM players WHERE guild_id=$1', [g.id]);
  const ownerName = await getName(Number(g.owner_id));
  const nextCost = Number(g.level) * 5000;

  let brigadirInfo = '';
  const brigadir = await pool.query(
    `SELECT user_id FROM players WHERE guild_id=$1 AND player_class='бригадир' LIMIT 1`,
    [g.id]
  );
  if (brigadir.rows.length > 0) {
    brigadirInfo = `\n👑 Бригадир в составе: +10% к бонусу бригады`;
  }

  await send(ctx, [
    `👥 Бригада: «${g.name}»`,
    `👑 Глава: ${ownerName} (ID: ${g.owner_id})`,
    `📊 Уровень: ${g.level} (+${Number(g.level) * 5}% к добыче)`,
    `👤 Участников: ${memberR.rows[0].cnt}`,
    `💰 Казна: ${Number(g.treasury)} монет`,
    `📈 XP: ${g.xp}/${nextCost} (до ур. ${Number(g.level) + 1})`,
    brigadirInfo,
  ].filter(Boolean).join('\n'));
}

async function cmdCreateGuild(ctx, uid, name) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  if (!name || name.length < 2)
    return send(ctx, '❌ Укажи название: «Создать бригаду [название]»');
  if (name.length > 64)
    return send(ctx, '❌ Название слишком длинное (макс. 64 символа).');

  if (p.guild_id) return send(ctx, '❌ Ты уже в бригаде. Покинь её: «Покинуть бригаду»');
  if (p.balance < GUILD_COST)
    return send(ctx,
      `❌ Создание бригады стоит ${GUILD_COST} монет.\n👛 Твой баланс: ${p.balance} монет.`
    );

  try {
    const res = await pool.query(
      'INSERT INTO guilds(name, owner_id) VALUES($1,$2) RETURNING id', [name, uid]
    );
    const guildId = res.rows[0].id;
    await pool.query(
      `UPDATE players SET balance=balance-$1, guild_id=$2 WHERE user_id=$3`,
      [GUILD_COST, guildId, uid]
    );
    await send(ctx,
      `✅ Бригада «${name}» создана!\nПриглашай игроков: «Пригласить [ID]»`
    );
  } catch (e) {
    if (e.code === '23505')
      return send(ctx, `❌ Бригада «${name}» уже существует. Придумай другое название.`);
    throw e;
  }
}

async function cmdInvite(ctx, uid, targetId) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  if (!targetId || isNaN(targetId)) return send(ctx, '❌ Укажи ID игрока: «Пригласить [ID]»');
  if (targetId === uid) return send(ctx, '❌ Нельзя пригласить самого себя.');

  if (!p.guild_id) return send(ctx, '❌ Ты не в бригаде.');

  const gr = await pool.query('SELECT * FROM guilds WHERE id=$1', [p.guild_id]);
  if (!gr.rows[0]) {
    await pool.query(`UPDATE players SET guild_id=NULL WHERE user_id=$1`, [uid]);
    return send(ctx, '❌ Бригада не найдена. guild_id сброшен.');
  }
  const g = gr.rows[0];
  if (Number(g.owner_id) !== uid)
    return send(ctx, '❌ Только глава бригады может приглашать игроков.');

  const target = await getPlayer(targetId);
  if (target && target.guild_id)
    return send(ctx, `❌ Игрок #${targetId} уже состоит в другой бригаде.`);

  await pool.query(
    `INSERT INTO guild_invites(user_id, guild_id) VALUES($1,$2)
     ON CONFLICT(user_id) DO UPDATE SET guild_id=$2`,
    [targetId, p.guild_id]
  );

  try {
    await vk.api.messages.send({
      user_id: targetId,
      message:
        `👥 Тебя приглашают в бригаду «${g.name}»!\n` +
        `ID главы: ${uid}\n` +
        `Напиши боту: «Принять приглашение»`,
      random_id: Math.floor(Math.random() * 1e9),
    });
    await send(ctx, `✅ Приглашение отправлено игроку #${targetId}.`);
  } catch {
    await send(ctx,
      `✅ Приглашение создано для #${targetId}.\n` +
      `Попроси его написать боту: «Принять приглашение»`
    );
  }
}

async function cmdAcceptInvite(ctx, uid) {
  const invR = await pool.query('SELECT * FROM guild_invites WHERE user_id=$1', [uid]);
  if (!invR.rows[0]) return send(ctx, '❌ У тебя нет активных приглашений.');

  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  if (p.guild_id) return send(ctx, '❌ Ты уже в бригаде. Сначала «Покинуть бригаду».');

  const guildId = invR.rows[0].guild_id;
  const gr = await pool.query('SELECT name FROM guilds WHERE id=$1', [guildId]);
  if (!gr.rows[0]) {
    await pool.query('DELETE FROM guild_invites WHERE user_id=$1', [uid]);
    return send(ctx, '❌ Бригада больше не существует.');
  }

  await pool.query(`UPDATE players SET guild_id=$1 WHERE user_id=$2`, [guildId, uid]);
  await pool.query('DELETE FROM guild_invites WHERE user_id=$1', [uid]);
  await send(ctx, `✅ Ты вступил в бригаду «${gr.rows[0].name}»!\nНапиши «Бригада» для информации.`);
}

async function cmdTreasury(ctx, uid, amountStr) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  const amount = parseInt(amountStr);
  if (!amount || amount <= 0)
    return send(ctx, '❌ Укажи сумму: «В казну [сумма]»\nПример: «В казну 500»');

  if (!p.guild_id) return send(ctx, '❌ Ты не в бригаде.');
  if (p.balance < amount)
    return send(ctx, `❌ Недостаточно монет. Баланс: ${p.balance} монет.`);

  await pool.query(`UPDATE players SET balance=balance-$1 WHERE user_id=$2`, [amount, uid]);
  const xpGain = Math.floor(amount / 100);
  await pool.query(
    `UPDATE guilds SET treasury=treasury+$1, xp=xp+$2 WHERE id=$3`,
    [amount, xpGain, p.guild_id]
  );

  const gr = await pool.query('SELECT * FROM guilds WHERE id=$1', [p.guild_id]);
  const g = gr.rows[0];
  const gLevel = Number(g.level);
  const gXp = Number(g.xp);
  const nextCost = gLevel * 5000;

  if (gXp >= nextCost) {
    await pool.query(
      `UPDATE guilds SET level=level+1, xp=xp-$1 WHERE id=$2`, [nextCost, p.guild_id]
    );
    await send(ctx,
      `💰 +${amount} монет в казну!\n` +
      `🎉 Бригада повысила уровень до ${gLevel + 1}!\n` +
      `📈 Бонус к добыче: +${(gLevel + 1) * 5}%`
    );
  } else {
    await send(ctx,
      `💰 +${amount} монет в казну!\n` +
      `📈 XP: ${gXp}/${nextCost} (до ур. ${gLevel + 1})`
    );
  }
}

async function cmdTakeFromTreasury(ctx, uid, amountStr) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  const amount = parseInt(amountStr);
  if (!amount || amount <= 0)
    return send(ctx, '❌ Укажи сумму: «Из казны [сумма]»\nПример: «Из казны 500»');

  if (!p.guild_id) return send(ctx, '❌ Ты не в бригаде.');

  const gr = await pool.query('SELECT * FROM guilds WHERE id=$1', [p.guild_id]);
  if (!gr.rows[0]) {
    await pool.query(`UPDATE players SET guild_id=NULL WHERE user_id=$1`, [uid]);
    return send(ctx, '❌ Бригада не найдена. guild_id сброшен.');
  }
  const g = gr.rows[0];
  
  if (Number(g.owner_id) !== uid)
    return send(ctx, '❌ Только глава бригады может снимать монеты из казны.');

  const treasuryAmount = Number(g.treasury);
  if (treasuryAmount < amount)
    return send(ctx,
      `❌ В казне недостаточно монет.\n` +
      `💰 В казне: ${treasuryAmount} монет\n` +
      `Запрошено: ${amount} монет`
    );

  await pool.query(
    `UPDATE guilds SET treasury=treasury-$1 WHERE id=$2`,
    [amount, p.guild_id]
  );
  await pool.query(
    `UPDATE players SET balance=balance+$1 WHERE user_id=$2`,
    [amount, uid]
  );

  await send(ctx,
    `💰 Ты снял ${amount} монет из казны бригады!\n` +
    `💰 Осталось в казне: ${treasuryAmount - amount} монет\n` +
    `👛 Твой баланс: ${p.balance + amount} монет`
  );
}

async function cmdLeaveGuild(ctx, uid) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  if (!p.guild_id) return send(ctx, '❌ Ты не состоишь в бригаде.');

  const gr = await pool.query('SELECT * FROM guilds WHERE id=$1', [p.guild_id]);
  if (!gr.rows[0]) {
    await pool.query(`UPDATE players SET guild_id=NULL WHERE user_id=$1`, [uid]);
    return send(ctx, '✅ Бригада не найдена — твой guild_id сброшен.');
  }
  const g = gr.rows[0];
  if (Number(g.owner_id) === uid)
    return send(ctx,
      '❌ Глава не может покинуть бригаду.\n' +
      'Сначала передай права другому или распусти бригаду.'
    );

  await pool.query(`UPDATE players SET guild_id=NULL WHERE user_id=$1`, [uid]);
  await send(ctx, `✅ Ты покинул бригаду «${g.name}».`);
}

async function cmdTransferLeadership(ctx, uid, targetId) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  if (!targetId || isNaN(targetId)) 
    return send(ctx, '❌ Укажи ID игрока: «Передать лидерство [ID]»');
  
  if (targetId === uid) 
    return send(ctx, '❌ Нельзя передать лидерство самому себе.');

  if (!p.guild_id) 
    return send(ctx, '❌ Ты не состоишь в бригаде.');

  const gr = await pool.query('SELECT * FROM guilds WHERE id=$1', [p.guild_id]);
  if (!gr.rows[0]) {
    await pool.query(`UPDATE players SET guild_id=NULL WHERE user_id=$1`, [uid]);
    return send(ctx, '❌ Бригада не найдена. guild_id сброшен.');
  }
  const g = gr.rows[0];
  
  if (Number(g.owner_id) !== uid)
    return send(ctx, '❌ Только глава бригады может передать лидерство.');

  const target = await getPlayer(targetId);
  if (!target)
    return send(ctx, `❌ Игрок #${targetId} не найден.`);

  if (target.guild_id !== p.guild_id)
    return send(ctx, `❌ Игрок #${targetId} не состоит в твоей бригаде.`);

  await pool.query(
    `UPDATE guilds SET owner_id=$1 WHERE id=$2`,
    [targetId, p.guild_id]
  );

  const targetName = await getName(targetId);
  const ownerName = await getName(uid);

  await send(ctx,
    `👑 Лидерство передано!\n` +
    `Новый глава бригады «${g.name}»: ${targetName} (ID: ${targetId})\n` +
    `Предыдущий глава: ${ownerName} (ID: ${uid})`
  );

  try {
    await vk.api.messages.send({
      user_id: targetId,
      message: `👑 Ты стал новым главой бригады «${g.name}»!\nТеперь ты управляешь бригадой и можешь приглашать новых участников.`,
      random_id: Math.floor(Math.random() * 1e9),
    });
  } catch {}
}

async function cmdDisbandGuild(ctx, uid) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  if (!p.guild_id) 
    return send(ctx, '❌ Ты не состоишь в бригаде.');

  const gr = await pool.query('SELECT * FROM guilds WHERE id=$1', [p.guild_id]);
  if (!gr.rows[0]) {
    await pool.query(`UPDATE players SET guild_id=NULL WHERE user_id=$1`, [uid]);
    return send(ctx, '❌ Бригада не найдена. guild_id сброшен.');
  }
  const g = gr.rows[0];
  
  if (Number(g.owner_id) !== uid)
    return send(ctx, '❌ Только глава может распустить бригаду.');

  const memberCount = await pool.query(
    'SELECT COUNT(*) as cnt FROM players WHERE guild_id=$1', [p.guild_id]
  );

  const treasuryAmount = Number(g.treasury);

  await pool.query(
    `UPDATE players SET guild_id=NULL WHERE guild_id=$1`,
    [p.guild_id]
  );
  
  await pool.query(
    'DELETE FROM guild_invites WHERE guild_id=$1',
    [p.guild_id]
  );
  
  await pool.query(
    'DELETE FROM guilds WHERE id=$1',
    [p.guild_id]
  );

  if (treasuryAmount > 0) {
    await pool.query(
      `UPDATE players SET balance=balance+$1 WHERE user_id=$2`,
      [treasuryAmount, uid]
    );
  }

  const ownerName = await getName(uid);
  let msg = `💔 Бригада «${g.name}» распущена!\n` +
    `Бывший глава: ${ownerName} (ID: ${uid})\n` +
    `Количество участников: ${memberCount.rows[0].cnt}\n` +
    `Все участники теперь свободны.`;
  
  if (treasuryAmount > 0) {
    msg += `\n\n💰 Казна бригады (${treasuryAmount} монет) переведена на ваш баланс!`;
  }

  await send(ctx, msg);
}

// ═══════════════════════════════════════════════════════════
//  ЕЖЕДНЕВНЫЙ БОНУС
// ═══════════════════════════════════════════════════════════

async function cmdDailyBonus(ctx, uid) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  if (!p.guild_id)
    return send(ctx,
      '🎁 Ежедневный бонус доступен только членам бригады!\n' +
      `Вступи в бригаду или создай её: «Создать бригаду [имя]» (${GUILD_COST} монет).`
    );

  const dayStart = getMoscowDayStart();
  if (p.last_daily >= dayStart)
    return send(ctx,
      `🎁 Ты уже забрал бонус сегодня!\n` +
      `Возвращайся завтра в 00:00 по МСК.`
    );

  const dow = getMoscowDayOfWeek();
  const bonus = DAILY_BONUS[dow];
  const now = Date.now();

  await pool.query(`UPDATE players SET last_daily=$1 WHERE user_id=$2`, [now, uid]);

  if (bonus.type === 'coins') {
    await pool.query(`UPDATE players SET balance=balance+$1 WHERE user_id=$2`, [bonus.amount, uid]);
    const dayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    await send(ctx,
      `🎁 Ежедневный бонус — ${dayNames[dow]}!\n` +
      `💰 +${bonus.amount} монет\n` +
      `Возвращайся завтра за новым бонусом!`
    );
  } else if (bonus.type === 'drill') {
    if (p.drills === 0) {
      await pool.query(
        `UPDATE players SET drills=drills+1, last_drill=$1 WHERE user_id=$2`, [now, uid]
      );
    } else {
      const hours = Math.min((now - p.last_drill) / 3_600_000, PASSIVE_CAP_HOURS);
      const pendingEarned = Math.floor(hours * DRILL_INCOME * p.drills);
      await pool.query(
        `UPDATE players SET drills=drills+1, last_drill=$1, balance=balance+$2 WHERE user_id=$3`,
        [now, pendingEarned, uid]
      );
    }
    await send(ctx,
      `🎁 Ежедневный бонус — Воскресенье!\n` +
      `⚙️ +1 автоматический бур!\n` +
      `Теперь у тебя ${p.drills + 1} бур(ов).\n` +
      `Возвращайся завтра за новым бонусом!`
    );
  }
}

// ═══════════════════════════════════════════════════════════
//  НЕЛЕГАЛЬНАЯ РАБОТА
// ═══════════════════════════════════════════════════════════

async function cmdBlackWork(ctx, uid) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  const now = Date.now();
  
  updateVirusStatus(p);

  if (p.jail_until > now)
    return send(ctx,
      `🚨 Ты в тюрьме! Нельзя работать.\n` +
      `⏳ Выйдешь через ${fmtTime(p.jail_until - now)}.`
    );

  if (p.virus === 1 && p.virus_end > now)
    return send(ctx,
      `🦠 Ты болен вирусом! Нельзя работать.\n` +
      `🏥 Вылечись командой «Лечить».`
    );

  const leftCd = BLACK_WORK_CD - (now - p.last_black);
  if (leftCd > 0)
    return send(ctx,
      `🕵️ Ещё слишком горячо! Залечь на дно ещё ${fmtTime(leftCd)}.`
    );

  let catchChance = BLACK_CATCH_CHANCE;
  if (p.has_roof) catchChance /= 2;

  const dynQty = await getItemQty(uid, 'динамит');
  const hasDyn = dynQty > 0;
  let income = BLACK_WORK_INCOME;
  if (hasDyn) {
    income *= 2;
    catchChance = Math.max(0.05, catchChance - 0.10);
    await pool.query(
      `UPDATE inventory SET quantity=quantity-1 WHERE user_id=$1 AND item='динамит'`, [uid]
    );
  }

  let guildBonus = 0;
  if (p.guild_id) {
    const gr = await pool.query('SELECT level FROM guilds WHERE id=$1', [p.guild_id]);
    if (gr.rows[0]) {
      guildBonus = Number(gr.rows[0].level) * 3;
      const brigadir = await pool.query(
        `SELECT user_id FROM players WHERE guild_id=$1 AND player_class='бригадир' LIMIT 1`,
        [p.guild_id]
      );
      if (brigadir.rows.length > 0) {
        guildBonus += 10;
      }
      income = Math.floor(income * (1 + guildBonus / 100));
    }
  }

  if (globalEpidemic && p.virus !== 2) {
    income = Math.floor(income * (1 - VIRUS_INCOME_PENALTY));
  }

  await pool.query(`UPDATE players SET last_black=$1 WHERE user_id=$2`, [now, uid]);

  const caught = Math.random() < catchChance;

  if (caught) {
    const fine = Math.min(BLACK_FINE, p.balance);
    const newBalance = p.balance - fine;
    const newStamina = Math.min(p.stamina, 20);
    await pool.query(
      `UPDATE players SET balance=$1, stamina=$2, jail_until=$3 WHERE user_id=$4`,
      [newBalance, newStamina, now + JAIL_DURATION, uid]
    );
    let msg = `🚨 ПОЙМАЛИ!\n\n`;
    msg += `👮 Полиция застукала тебя на месте преступления!\n`;
    if (hasDyn) msg += `💥 Динамит помог, но не спас...\n`;
    msg += `\n💸 Штраф: ${fine} монет\n`;
    msg += `😵 Стамина: ${newStamina}/${MAX_STAMINA} (обнулена до 20)\n`;
    msg += `⛓️ Тюрьма: 1 час (нельзя работать и воровать)\n`;
    msg += `\n💡 Совет: купи «Крышу» (${ROOF_COST} монет), чтобы снизить риск в 2 раза!`;
    return send(ctx, msg);
  }

  const contrabandQty = randInt(1, 2);
  await addItem(uid, 'контрабанда', contrabandQty);
  await pool.query(`UPDATE players SET balance=balance+$1 WHERE user_id=$2`, [income, uid]);

  let msg = `🦹 ЧЁРНАЯ РАБОТА ВЫПОЛНЕНА!\n\n`;
  msg += `💰 +${income} монет\n`;
  msg += `🕵️ +${contrabandQty} контрабанда\n`;
  if (hasDyn) msg += `💥 Динамит: +100% к доходу, −10% к поимке\n`;
  if (guildBonus > 0) msg += `👥 Бонус бригады: +${guildBonus}%\n`;
  if (globalEpidemic && p.virus !== 2) msg += `🦠 Эпидемия: доход снижен на 50%\n`;
  if (p.has_roof) msg += `🛡️ Крыша: шанс поимки снижен в 2 раза\n`;
  msg += `\nПродать контрабанду: «Продать контрабанду» (${CONTRABAND_PRICE} монет/шт.)\n`;
  msg += `⏳ Следующая операция через 2 часа.`;
  await send(ctx, msg);
}

// ═══════════════════════════════════════════════════════════
//  ПЕРЕВОД МОНЕТ
// ═══════════════════════════════════════════════════════════

async function cmdTransfer(ctx, uid, args) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  const parts = args.trim().split(/\s+/);
  if (parts.length < 2)
    return send(ctx, '❌ Формат: «Перевести [ID игрока] [сумма]»\nПример: «Перевести 123456789 500»');

  const targetId = parseInt(parts[0]);
  const amount   = parseInt(parts[1]);

  if (!targetId || isNaN(targetId) || !amount || amount < TRANSFER_MIN)
    return send(ctx,
      `❌ Неверный формат. Минимальный перевод: ${TRANSFER_MIN} монет.\n` +
      `Формат: «Перевести [ID] [сумма]»`
    );

  if (targetId === uid)
    return send(ctx, '❌ Нельзя переводить самому себе.');

  if (!p.guild_id)
    return send(ctx,
      '❌ Переводы доступны только между членами одной бригады.\n' +
      'Вступи в бригаду!'
    );

  const target = await getPlayer(targetId);
  if (!target)
    return send(ctx, `❌ Игрок #${targetId} не найден. Попроси его написать «Старт».`);

  if (target.guild_id !== p.guild_id)
    return send(ctx,
      `❌ Игрок #${targetId} не состоит в твоей бригаде.\n` +
      `Переводы возможны только между членами одной бригады.`
    );

  if (p.balance < amount)
    return send(ctx, `❌ Недостаточно монет.\n👛 Твой баланс: ${p.balance} монет.`);

  await pool.query(`UPDATE players SET balance=balance-$1 WHERE user_id=$2`, [amount, uid]);
  await pool.query(`UPDATE players SET balance=balance+$1 WHERE user_id=$2`, [amount, targetId]);

  const senderName = await getName(uid);
  const targetName = await getName(targetId);

  try {
    await vk.api.messages.send({
      user_id: targetId,
      message: `💸 ${senderName} (ID: ${uid}) перевёл тебе ${amount} монет!`,
      random_id: Math.floor(Math.random() * 1e9),
    });
  } catch {}

  await send(ctx,
    `✅ Перевод выполнен!\n` +
    `💸 ${amount} монет → ${targetName} (ID: ${targetId})\n` +
    `👛 Твой баланс: ${p.balance - amount} монет.`
  );
}

// ═══════════════════════════════════════════════════════════
//  ПРОМОКОДЫ
// ═══════════════════════════════════════════════════════════

async function cmdCreatePromo(ctx, uid, args) {
  const parts = args.trim().split(/\s+/);
  if (parts.length < 3)
    return send(ctx,
      '❌ Формат: !промо [код] [тип] [кол-во] [макс.активаций]\n' +
      'Типы: coins / drill / oil / stamina\n' +
      'Пример: !промо WELCOME coins 1000 50'
    );

  const code    = parts[0].toUpperCase();
  const type    = parts[1].toLowerCase();
  const amount  = parseInt(parts[2]);
  const maxUses = parseInt(parts[3]) || 1;

  const validTypes = ['coins', 'drill', 'oil', 'stamina'];
  if (!validTypes.includes(type))
    return send(ctx, `❌ Неверный тип. Доступные: ${validTypes.join(', ')}`);
  if (!amount || amount <= 0)
    return send(ctx, '❌ Укажи корректное количество.');

  try {
    await pool.query(
      `INSERT INTO promo_codes(code, reward_type, reward_amount, max_uses, created_by)
       VALUES($1,$2,$3,$4,$5)`,
      [code, type, amount, maxUses, uid]
    );
    await send(ctx,
      `✅ Промокод создан!\n` +
      `🎟️ Код: ${code}\n` +
      `🎁 Награда: ${amount} ${type}\n` +
      `👥 Активаций: ${maxUses}`
    );
  } catch (e) {
    if (e.code === '23505')
      return send(ctx, `❌ Промокод «${code}» уже существует.`);
    throw e;
  }
}

async function cmdDeactivatePromo(ctx, code) {
  const r = await pool.query(
    `UPDATE promo_codes SET active=FALSE WHERE code=$1 RETURNING code`, [code.toUpperCase()]
  );
  if (!r.rows.length) return send(ctx, `❌ Промокод «${code}» не найден.`);
  await send(ctx, `✅ Промокод «${code.toUpperCase()}» деактивирован.`);
}

async function cmdListPromos(ctx) {
  const r = await pool.query(
    `SELECT code, reward_type, reward_amount, uses, max_uses, active FROM promo_codes ORDER BY code`
  );
  if (!r.rows.length) return send(ctx, '📋 Промокодов нет.');
  const lines = ['📋 Все промокоды:'];
  for (const row of r.rows) {
    const status = row.active ? '✅' : '❌';
    lines.push(`${status} ${row.code} — ${row.reward_amount} ${row.reward_type} [${row.uses}/${row.max_uses}]`);
  }
  await send(ctx, lines.join('\n'));
}

async function cmdUsePromo(ctx, uid, code) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  if (!code) return send(ctx, '❌ Укажи промокод: «Промокод [код]»');
  const codeUp = code.toUpperCase();

  const r = await pool.query(
    `SELECT * FROM promo_codes WHERE code=$1`, [codeUp]
  );
  if (!r.rows.length)
    return send(ctx, `❌ Промокод «${codeUp}» не найден.`);

  const promo = r.rows[0];

  if (!promo.active)
    return send(ctx, `❌ Промокод «${codeUp}» деактивирован.`);

  if (Number(promo.uses) >= Number(promo.max_uses))
    return send(ctx, `❌ Промокод «${codeUp}» уже исчерпан.`);

  const used = await pool.query(
    `SELECT 1 FROM promo_uses WHERE user_id=$1 AND code=$2`, [uid, codeUp]
  );
  if (used.rows.length)
    return send(ctx, `❌ Ты уже активировал промокод «${codeUp}».`);

  await pool.query(`UPDATE promo_codes SET uses=uses+1 WHERE code=$1`, [codeUp]);
  await pool.query(`INSERT INTO promo_uses(user_id, code) VALUES($1,$2)`, [uid, codeUp]);
  await getOrCreate(uid);

  const type   = promo.reward_type;
  const amount = Number(promo.reward_amount);
  let rewardMsg = '';

  if (type === 'coins') {
    await pool.query(`UPDATE players SET balance=balance+$1 WHERE user_id=$2`, [amount, uid]);
    rewardMsg = `💰 +${amount} монет`;
  } else if (type === 'drill') {
    const now = Date.now();
    if (p.drills === 0) {
      await pool.query(
        `UPDATE players SET drills=drills+$1, last_drill=$2 WHERE user_id=$3`, [amount, now, uid]
      );
    } else {
      const hours = Math.min((now - p.last_drill) / 3_600_000, PASSIVE_CAP_HOURS);
      const pending = Math.floor(hours * DRILL_INCOME * p.drills);
      await pool.query(
        `UPDATE players SET drills=drills+$1, last_drill=$2, balance=balance+$3 WHERE user_id=$4`,
        [amount, now, pending, uid]
      );
    }
    rewardMsg = `⚙️ +${amount} бур(ов)`;
  } else if (type === 'oil') {
    const now = Date.now();
    if (p.oil_rigs === 0) {
      await pool.query(
        `UPDATE players SET oil_rigs=oil_rigs+$1, last_oil=$2 WHERE user_id=$3`, [amount, now, uid]
      );
    } else {
      const hours = Math.min((now - p.last_oil) / 3_600_000, PASSIVE_CAP_HOURS);
      const pending = Math.floor(hours * OIL_INCOME * p.oil_rigs);
      await pool.query(
        `UPDATE players SET oil_rigs=oil_rigs+$1, last_oil=$2, balance=balance+$3 WHERE user_id=$4`,
        [amount, now, pending, uid]
      );
    }
    rewardMsg = `🛢️ +${amount} нефтяных вышки(ок)`;
  } else if (type === 'stamina') {
    const newSt = Math.min(MAX_STAMINA, p.stamina + amount);
    await pool.query(`UPDATE players SET stamina=$1 WHERE user_id=$2`, [newSt, uid]);
    rewardMsg = `❤️ +${amount} стамины (стало ${newSt}/${MAX_STAMINA})`;
  }

  if (Number(promo.uses) + 1 >= Number(promo.max_uses)) {
    await pool.query(`UPDATE promo_codes SET active=FALSE WHERE code=$1`, [codeUp]);
  }

  await send(ctx,
    `🎟️ Промокод «${codeUp}» активирован!\n${rewardMsg}`
  );
}

// ═══════════════════════════════════════════════════════════
//  ПОМОЩЬ
// ═══════════════════════════════════════════════════════════

async function cmdHelp(ctx) {
  await send(ctx,
    `📋 Все команды Generational Miners:\n\n` +
    `⛏️ ИГРА:\n` +
    `• Старт — регистрация и выбор класса\n` +
    `• Класс [название] — выбрать или сменить класс\n` +
    `• Работа — добыча монет и руды (кд 30 мин, тратит 20 стамины)\n` +
    `• Отдых — восстановить стамину (кд 30 мин)\n` +
    `• Еда / Покушать — съесть еду (+50 стамины)\n` +
    `• Профиль — твоя статистика и кулдауны\n` +
    `• Бонус — ежедневный бонус (только для членов клана)\n\n` +
    `💰 ПРОКАЧКА:\n` +
    `• Кирка — улучшить кирку (+30% за ур.)\n` +
    `• Бур [кол-во] — купить авто-буры\n` +
    `• Нефть [кол-во] — купить вышки\n` +
    `• Доход — забрать монеты с буров\n` +
    `• Нефть доход — забрать монеты с вышек\n\n` +
    `🔨 КРАФТ:\n` +
    `• Крафт [предмет] — скрафтить бур или деталь\n` +
    `• Рецепты — список всех рецептов\n` +
    `• Детали — посмотреть ресурсы для крафта\n\n` +
    `👤 КЛАССЫ:\n` +
    `• Шахтёр — +20% к добыче\n` +
    `• Инженер — буры +25%\n` +
    `• Нефтяник — вышки +30%\n` +
    `• Врач — лечить других за полцены\n` +
    `• Бригадир — +10% к бонусу бригады\n\n` +
    `🪨 РУДЫ:\n` +
    `• 🪨 Уголь — 50 | ⚙️ Железо — 150 | 💎 Алмаз — 500\n` +
    `• 🥇 Золото — 800 | 🔴 Рубин — 1200 | 🪙 Платина — 2000\n` +
    `• Продать [руда] / Продать всё\n\n` +
    `🦹 НЕЛЕГАЛЬНОЕ:\n` +
    `• Чёрная работа — нелегальный заработок (кд 2 ч)\n` +
    `• Своровать — украсть монеты у топ-игрока (кд 4 ч)\n` +
    `• Своровать [ID] — украсть у конкретного из топ-5\n\n` +
    `🦠 МЕДИЦИНА:\n` +
    `• Лечить — вылечиться от вируса\n` +
    `• Лечить [ID] — вылечить другого (только врач)\n` +
    `• Вакцина — защита от вируса на 24 ч\n` +
    `• Статус — проверить здоровье\n` +
    `• Эпидемия — информация о вспышке\n\n` +
    `🛒 МАГАЗИН:\n` +
    `• Магазин — список товаров\n` +
    `• Купить [товар] [кол-во] — купить предмет(ы)\n` +
    `• Инвентарь — посмотреть предметы\n\n` +
    `👥 БРИГАДЫ:\n` +
    `• Бригада — информация о бригаде\n` +
    `• Топ кланов — рейтинг бригад\n` +
    `• Создать бригаду [имя] — создать\n` +
    `• Пригласить [ID] — пригласить игрока\n` +
    `• Принять приглашение — вступить\n` +
    `• В казну [сумма] — пополнить казну\n` +
    `• Из казны [сумма] — снять из казны (только глава)\n` +
    `• Перевести [ID] [сумма] — перевод\n` +
    `• Покинуть бригаду — выйти\n` +
    `• Передать лидерство [ID] — передать права главы\n` +
    `• Расформировать клан — распустить бригаду (казна → главе)\n\n` +
    `💬 АКТИВНОСТЬ:\n` +
    `• Топ чатов — рейтинг чатов по работе\n\n` +
    `🎟️ ПРОМОКОДЫ:\n` +
    `• Промокод [код] — активировать промокод\n\n` +
    `🏆 РЕЙТИНГ:\n` +
    `• Топ — топ-10 богатейших игроков\n` +
    `• Топ кланов — топ-10 бригад\n` +
    `• Топ чатов — топ-10 чатов по активности`
  );
}

// ═══════════════════════════════════════════════════════════
//  АДМИН КОМАНДЫ
// ═══════════════════════════════════════════════════════════

async function cmdAdminHelp(ctx) {
  await send(ctx,
    `👑 Админ-команды:\n\n` +
    `💰 ЭКОНОМИКА:\n` +
    `• !дать [ID] [сумма] — выдать монеты игроку\n` +
    `• !забрать [ID] [сумма] — забрать монеты у игрока\n` +
    `• !датьруду [ID] [руда] [кол-во] — выдать руду\n` +
    `• !забратьруду [ID] [руда] [кол-во] — забрать руду\n` +
    `• !датьпредмет [ID] [предмет] [кол-во] — выдать предмет\n` +
    `• !забратьпредмет [ID] [предмет] [кол-во] — забрать предмет\n\n` +
    `👤 ИГРОКИ:\n` +
    `• !игроки — список ВСЕХ игроков\n` +
    `• !профиль [ID] — посмотреть профиль игрока\n` +
    `• !освободить [ID] — освободить игрока из тюрьмы\n` +
    `• !скрыть — скрыть себя из топов\n` +
    `• !показать — показать себя в топах (если был скрыт)\n` +
    `• !бан [ID] — забанить игрока\n` +
    `• !разбан [ID] — разбанить игрока\n` +
    `• !админ [ID] — назначить админа\n` +
    `• !снятьадмин [ID] — снять админа\n\n` +
    `🦠 ВИРУС:\n` +
    `• !вирус старт — запустить эпидемию сейчас\n` +
    `• !вирус стоп — остановить эпидемию\n` +
    `• !вылечить [ID] — вылечить игрока от вируса\n` +
    `• !защитить [ID] — дать вакцину бесплатно\n` +
    `• !заразить [ID] — заразить игрока вирусом\n\n` +
    `🎟️ ПРОМОКОДЫ:\n` +
    `• !промо [код] [тип] [кол-во] [макс.активаций] — создать промокод\n` +
    `  Типы: coins, drill, oil, stamina\n` +
    `• !деактивировать [код] — деактивировать промокод\n` +
    `• !промокоды — список всех промокодов`
  );
}

async function cmdAdminGive(ctx, parts) {
  const targetId = parseInt(parts[1]);
  const amount   = parseInt(parts[2]);
  if (!targetId || !amount || amount <= 0)
    return send(ctx, '❌ Использование: !дать [ID] [сумма]');
  await getOrCreate(targetId);
  await pool.query(`UPDATE players SET balance=balance+$1 WHERE user_id=$2`, [amount, targetId]);
  const name = await getName(targetId);
  await send(ctx, `✅ Игроку ${name} (ID: ${targetId}) выдано ${amount} монет.`);
}

async function cmdAdminTake(ctx, parts) {
  const targetId = parseInt(parts[1]);
  const amount   = parseInt(parts[2]);
  if (!targetId || !amount || amount <= 0)
    return send(ctx, '❌ Использование: !забрать [ID] [сумма]');
  const target = await getPlayer(targetId);
  if (!target)
    return send(ctx, `❌ Игрок #${targetId} не найден.`);
  
  const actualTake = Math.min(amount, target.balance);
  await pool.query(`UPDATE players SET balance=balance-$1 WHERE user_id=$2`, [actualTake, targetId]);
  const name = await getName(targetId);
  await send(ctx, `✅ У игрока ${name} (ID: ${targetId}) изъято ${actualTake} монет.\n💰 Баланс был: ${target.balance} → стал: ${target.balance - actualTake}`);
}

async function cmdAdminGiveOre(ctx, parts) {
  const targetId = parseInt(parts[1]);
  const oreName = parts[2]?.toLowerCase();
  const qty = parseInt(parts[3]) || 1;
  
  if (!targetId || !oreName || !ORES[oreName]) {
    const oreList = Object.keys(ORES).join(', ');
    return send(ctx, `❌ Использование: !датьруду [ID] [руда] [кол-во]\nДоступные руды: ${oreList}`);
  }
  
  await getOrCreate(targetId);
  await addItem(targetId, oreName, qty);
  
  const name = await getName(targetId);
  const ore = ORES[oreName];
  await send(ctx, `${ore.emoji} Игроку ${name} (ID: ${targetId}) выдано: ${oreName} ×${qty}`);
}

async function cmdAdminTakeOre(ctx, parts) {
  const targetId = parseInt(parts[1]);
  const oreName = parts[2]?.toLowerCase();
  const qty = parseInt(parts[3]) || 1;
  
  if (!targetId || !oreName || !ORES[oreName]) {
    const oreList = Object.keys(ORES).join(', ');
    return send(ctx, `❌ Использование: !забратьруду [ID] [руда] [кол-во]\nДоступные руды: ${oreList}`);
  }
  
  const currentQty = await getItemQty(targetId, oreName);
  const actualTake = Math.min(qty, currentQty);
  
  if (actualTake <= 0) {
    return send(ctx, `❌ У игрока #${targetId} нет руды «${oreName}».`);
  }
  
  await removeItem(targetId, oreName, actualTake);
  
  const name = await getName(targetId);
  const ore = ORES[oreName];
  await send(ctx, `${ore.emoji} У игрока ${name} (ID: ${targetId}) изъято: ${oreName} ×${actualTake}`);
}

async function cmdAdminGiveItem(ctx, parts) {
  const targetId = parseInt(parts[1]);
  const itemName = parts[2]?.toLowerCase();
  const qty = parseInt(parts[3]) || 1;
  
  if (!targetId || !itemName || !SHOP_ITEMS[itemName]) {
    const itemList = Object.keys(SHOP_ITEMS).join(', ');
    return send(ctx, `❌ Использование: !датьпредмет [ID] [предмет] [кол-во]\nДоступные предметы: ${itemList}`);
  }
  
  await getOrCreate(targetId);
  await addItem(targetId, itemName, qty);
  
  const name = await getName(targetId);
  await send(ctx, `📦 Игроку ${name} (ID: ${targetId}) выдано: «${itemName}» ×${qty}`);
}

async function cmdAdminTakeItem(ctx, parts) {
  const targetId = parseInt(parts[1]);
  const itemName = parts[2]?.toLowerCase();
  const qty = parseInt(parts[3]) || 1;
  
  if (!targetId || !itemName) {
    return send(ctx, `❌ Использование: !забратьпредмет [ID] [предмет] [кол-во]`);
  }
  
  const currentQty = await getItemQty(targetId, itemName);
  const actualTake = Math.min(qty, currentQty);
  
  if (actualTake <= 0) {
    return send(ctx, `❌ У игрока #${targetId} нет предмета «${itemName}».`);
  }
  
  await removeItem(targetId, itemName, actualTake);
  
  const name = await getName(targetId);
  await send(ctx, `📦 У игрока ${name} (ID: ${targetId}) изъято: «${itemName}» ×${actualTake}`);
}

async function cmdAdminPlayers(ctx) {
  const res = await pool.query(
    'SELECT user_id, balance, banned, player_class, drills, oil_rigs, guild_id FROM players ORDER BY balance DESC'
  );
  if (!res.rows.length) return send(ctx, '📊 Игроков пока нет.');
  
  const totalPlayers = res.rows.length;
  const totalBanned = res.rows.filter(r => r.banned).length;
  const totalWealth = res.rows.reduce((sum, r) => sum + Number(r.balance), 0);
  
  const lines = [
    `👤 ВСЕ ИГРОКИ (${totalPlayers} чел.):`,
    `📊 Всего монет в игре: ${totalWealth.toLocaleString()}`,
    `⛔ Забанено: ${totalBanned}`,
    ''
  ];
  
  for (let i = 0; i < res.rows.length; i++) {
    const r = res.rows[i];
    const name = await getName(r.user_id);
    const banStatus = r.banned ? ' [ЗАБАНЕН]' : '';
    const classInfo = r.player_class ? ` (${r.player_class})` : '';
    const guildInfo = r.guild_id ? ' [Бригада]' : '';
    const drills = Number(r.drills);
    const rigs = Number(r.oil_rigs);
    const techInfo = drills > 0 || rigs > 0 ? ` ⚙️${drills} 🛢️${rigs}` : '';
    
    lines.push(
      `${i + 1}. [id${r.user_id}|${name}] — ${Number(r.balance).toLocaleString()}💰${classInfo}${guildInfo}${techInfo}${banStatus}`
    );
  }
  
  const fullText = lines.join('\n');
  if (fullText.length > 4000) {
    const chunks = [];
    let chunk = lines.slice(0, 3).join('\n') + '\n';
    
    for (let i = 3; i < lines.length; i++) {
      if ((chunk + lines[i] + '\n').length > 4000) {
        chunks.push(chunk);
        chunk = '';
      }
      chunk += lines[i] + '\n';
    }
    if (chunk) chunks.push(chunk);
    
    for (const c of chunks) {
      await send(ctx, c);
    }
  } else {
    await send(ctx, fullText);
  }
}

async function cmdAdminProfile(ctx, targetIdStr) {
  const targetId = parseInt(targetIdStr);
  if (!targetId) return send(ctx, '❌ Укажи ID: !профиль [ID]');
  
  const p = await getPlayer(targetId);
  if (!p) return send(ctx, `❌ Игрок #${targetId} не найден.`);
  
  updateVirusStatus(p);
  
  const name = await getName(targetId);
  const pick = PICKAXE.find(l => l.level === p.pickaxe_lvl) || PICKAXE[0];
  const now = Date.now();

  let guildName = 'Нет';
  if (p.guild_id) {
    const gr = await pool.query('SELECT name FROM guilds WHERE id=$1', [p.guild_id]);
    if (gr.rows[0]) guildName = gr.rows[0].name;
  }

  const workLeft = WORK_CD - (now - p.last_work);
  let workCdInfo = workLeft > 0 ? `\n⏳ Кулдаун работы: ${fmtTime(workLeft)}` : `\n✅ Можно работать!`;

  let passiveInfo = '';
  if (p.drills > 0) passiveInfo += `\n⚙️ Буры: ${p.drills} шт. (+${p.drills * DRILL_INCOME}/ч)`;
  if (p.oil_rigs > 0) passiveInfo += `\n🛢️ Вышки: ${p.oil_rigs} шт. (+${p.oil_rigs * OIL_INCOME}/ч)`;

  const jailInfo = p.jail_until > now ? `\n🚨 В тюрьме ещё ${fmtTime(p.jail_until - now)}` : '';
  const roofInfo = p.has_roof ? `\n🛡️ Крыша: активна` : '';
  const banInfo = p.banned ? `\n⛔ ЗАБАНЕН` : '';
  const adminInfo = p.is_admin ? `\n👑 Администратор` : '';

  let healthInfo = '';
  if (p.vaccine_end > now) {
    healthInfo = `\n🦠 Здоровье: Защищён 💉 (${fmtTime(p.vaccine_end - now)})`;
  } else if (p.virus === 1 && p.virus_end > now) {
    healthInfo = `\n🦠 Здоровье: Болен 🤒 (выздоровеет через ${fmtTime(p.virus_end - now)})`;
  } else {
    healthInfo = `\n🦠 Здоровье: Здоров ✅`;
  }

  let classInfo = p.player_class ? `\n👤 Класс: ${p.player_class}` : `\n👤 Класс: не выбран`;

  const lines = [
    `👤 Профиль игрока: ${name}`,
    `🆔 ID: ${targetId}`,
    `💰 Баланс: ${p.balance} монет`,
    `❤️ Стамина: ${p.stamina}/${MAX_STAMINA}`,
    `⛏️ Кирка: ур. ${p.pickaxe_lvl} (+${pick.bonus}% к добыче)`,
    classInfo,
    adminInfo,
    workCdInfo,
    passiveInfo,
    `👥 Бригада: ${guildName}`,
    roofInfo,
    jailInfo,
    healthInfo,
    banInfo,
  ];

  await send(ctx, lines.filter(Boolean).join('\n'));
}

async function cmdAdminFree(ctx, targetIdStr) {
  const targetId = parseInt(targetIdStr);
  if (!targetId) return send(ctx, '❌ Укажи ID: !освободить [ID]');
  await pool.query(`UPDATE players SET jail_until=0 WHERE user_id=$1`, [targetId]);
  const name = await getName(targetId);
  await send(ctx, `✅ Игрок ${name} (ID: ${targetId}) освобождён из тюрьмы.`);
}

async function cmdAdminHide(ctx, uid) {
  await pool.query(`UPDATE players SET hidden=TRUE WHERE user_id=$1`, [uid]);
  await send(ctx, `👻 Теперь ты скрыт из всех топов! Твой баланс и ID не будут видны в рейтинге.`);
}

async function cmdAdminShow(ctx, uid) {
  await pool.query(`UPDATE players SET hidden=FALSE WHERE user_id=$1`, [uid]);
  await send(ctx, `✅ Ты снова виден в топах!`);
}

async function cmdBan(ctx, parts) {
  const targetId = parseInt(parts[1]);
  if (!targetId)
    return send(ctx, '❌ Использование: !бан [ID]');
  
  const target = await getOrCreate(targetId);
  if (!target)
    return send(ctx, `❌ Игрок #${targetId} не найден.`);

  if (target.banned)
    return send(ctx, `⚠️ Игрок #${targetId} уже забанен.`);

  await pool.query(`UPDATE players SET banned=TRUE WHERE user_id=$1`, [targetId]);
  const name = await getName(targetId);
  await send(ctx, `⛔ Игрок ${name} (ID: ${targetId}) забанен! Все команды для него заблокированы.`);
}

async function cmdUnban(ctx, parts) {
  const targetId = parseInt(parts[1]);
  if (!targetId)
    return send(ctx, '❌ Использование: !разбан [ID]');
  
  const target = await getOrCreate(targetId);
  if (!target)
    return send(ctx, `❌ Игрок #${targetId} не найден.`);

  if (!target.banned)
    return send(ctx, `⚠️ Игрок #${targetId} не забанен.`);

  await pool.query(`UPDATE players SET banned=FALSE WHERE user_id=$1`, [targetId]);
  const name = await getName(targetId);
  await send(ctx, `✅ Игрок ${name} (ID: ${targetId}) разбанен! Все функции восстановлены.`);
}

async function cmdSetAdmin(ctx, uid, targetIdStr) {
  if (uid !== ADMIN_ID) {
    return send(ctx, '❌ Только главный администратор может назначать админов.');
  }
  
  const targetId = parseInt(targetIdStr);
  if (!targetId || isNaN(targetId)) {
    return send(ctx, '❌ Укажи ID игрока: !админ [ID]');
  }
  
  const target = await getOrCreate(targetId);
  if (!target) {
    return send(ctx, `❌ Игрок #${targetId} не найден.`);
  }
  
  if (target.is_admin) {
    return send(ctx, `⚠️ Игрок #${targetId} уже администратор.`);
  }
  
  await pool.query(
    `UPDATE players SET is_admin = TRUE WHERE user_id = $1`,
    [targetId]
  );
  
  const name = await getName(targetId);
  await send(ctx, `✅ Игрок ${name} (ID: ${targetId}) назначен администратором!`);
  
  try {
    await vk.api.messages.send({
      user_id: targetId,
      message: `👑 Ты назначен администратором игры Generational Miners!\nНапиши боту «/admin» для списка админ-команд.`,
      random_id: Math.floor(Math.random() * 1e9),
    });
  } catch {}
}

async function cmdRemoveAdmin(ctx, uid, targetIdStr) {
  if (uid !== ADMIN_ID) {
    return send(ctx, '❌ Только главный администратор может снимать админов.');
  }
  
  const targetId = parseInt(targetIdStr);
  if (!targetId || isNaN(targetId)) {
    return send(ctx, '❌ Укажи ID игрока: !снятьадмин [ID]');
  }
  
  if (targetId === ADMIN_ID) {
    return send(ctx, '❌ Нельзя снять главного администратора.');
  }
  
  const target = await getPlayer(targetId);
  if (!target) {
    return send(ctx, `❌ Игрок #${targetId} не найден.`);
  }
  
  if (!target.is_admin) {
    return send(ctx, `⚠️ Игрок #${targetId} не является администратором.`);
  }
  
  await pool.query(
    `UPDATE players SET is_admin = FALSE WHERE user_id = $1`,
    [targetId]
  );
  
  const name = await getName(targetId);
  await send(ctx, `✅ Игрок ${name} (ID: ${targetId}) снят с должности администратора.`);
  
  try {
    await vk.api.messages.send({
      user_id: targetId,
      message: `❌ Ты снят с должности администратора игры Generational Miners.`,
      random_id: Math.floor(Math.random() * 1e9),
    });
  } catch {}
}

// ═══════════════════════════════════════════════════════════
//  АДМИН КОМАНДЫ ВИРУСА
// ═══════════════════════════════════════════════════════════

async function cmdAdminVirusStart(ctx) {
  if (globalEpidemic)
    return send(ctx, '🦠 Эпидемия уже активна!');
  
  await startEpidemic();
  await send(ctx, '🦠 Эпидемия запущена! Все игроки заражены (кроме вакцинированных).');
}

async function cmdAdminVirusStop(ctx) {
  if (!globalEpidemic)
    return send(ctx, '✅ Эпидемия не активна.');
  
  await endEpidemic();
  await send(ctx, '✅ Эпидемия остановлена! Все игроки вылечены.');
}

async function cmdAdminHeal(ctx, targetIdStr) {
  const targetId = parseInt(targetIdStr);
  if (!targetId) return send(ctx, '❌ Укажи ID: !вылечить [ID]');
  
  await pool.query(
    `UPDATE players SET virus=0, virus_end=0, stamina=LEAST(stamina+30, 100) WHERE user_id=$1`,
    [targetId]
  );
  const name = await getName(targetId);
  await send(ctx, `✅ Игрок ${name} (ID: ${targetId}) вылечен от вируса!`);
}

async function cmdAdminVaccinate(ctx, targetIdStr) {
  const targetId = parseInt(targetIdStr);
  if (!targetId) return send(ctx, '❌ Укажи ID: !защитить [ID]');
  
  const vaccineEnd = Date.now() + VACCINE_DURATION;
  await pool.query(
    `UPDATE players SET virus=2, vaccine_end=$1, virus_end=0 WHERE user_id=$2`,
    [vaccineEnd, targetId]
  );
  const name = await getName(targetId);
  await send(ctx, `✅ Игрок ${name} (ID: ${targetId}) получил бесплатную вакцину на 24 часа!`);
}

async function cmdAdminInfect(ctx, targetIdStr) {
  const targetId = parseInt(targetIdStr);
  if (!targetId) return send(ctx, '❌ Укажи ID: !заразить [ID]');
  
  const virusEnd = Date.now() + EPIDEMIC_DURATION;
  await pool.query(
    `UPDATE players SET virus=1, virus_end=$1, stamina=GREATEST(0, stamina-20) WHERE user_id=$2 AND vaccine_end <= $3`,
    [virusEnd, targetId, Date.now()]
  );
  const name = await getName(targetId);
  await send(ctx, `🦠 Игрок ${name} (ID: ${targetId}) заражён вирусом!`);
}

// ═══════════════════════════════════════════════════════════
//  ОБРАБОТЧИК СООБЩЕНИЙ
// ═══════════════════════════════════════════════════════════

vk.updates.on('message_new', async (ctx) => {
  try {
    if (!ctx.text) return;
    const uid = ctx.senderId;
    if (uid < 0) return;

    const raw  = ctx.text.trim();
    const text = raw.toLowerCase();

    // ── Админ-команды ────────────────────────────────────
    const adminCheck = await isAdmin(uid);
    if (adminCheck) {
      const parts = text.split(/\s+/);
      
      if (parts[0] === '!дать')              return cmdAdminGive(ctx, parts);
      if (parts[0] === '!забрать')           return cmdAdminTake(ctx, parts);
      if (parts[0] === '!датьруду')          return cmdAdminGiveOre(ctx, parts);
      if (parts[0] === '!забратьруду')       return cmdAdminTakeOre(ctx, parts);
      if (parts[0] === '!датьпредмет')       return cmdAdminGiveItem(ctx, parts);
      if (parts[0] === '!забратьпредмет')    return cmdAdminTakeItem(ctx, parts);
      if (text === '!игроки')                return cmdAdminPlayers(ctx);
      if (text.startsWith('!профиль '))      return cmdAdminProfile(ctx, parts[1]);
      if (text.startsWith('!освободить '))   return cmdAdminFree(ctx, parts[1]);
      if (text === '!скрыть')                return cmdAdminHide(ctx, uid);
      if (text === '!показать')              return cmdAdminShow(ctx, uid);
      if (text === '/admin')                 return cmdAdminHelp(ctx);
      if (parts[0] === '!бан')               return cmdBan(ctx, parts);
      if (parts[0] === '!разбан')            return cmdUnban(ctx, parts);
      if (parts[0] === '!админ')             return cmdSetAdmin(ctx, uid, parts[1]);
      if (parts[0] === '!снятьадмин')        return cmdRemoveAdmin(ctx, uid, parts[1]);
      
      if (text.startsWith('!промо '))        return cmdCreatePromo(ctx, uid, raw.slice('!промо '.length));
      if (text.startsWith('!деактивировать ')) return cmdDeactivatePromo(ctx, text.slice('!деактивировать '.length).trim());
      if (text === '!промокоды')             return cmdListPromos(ctx);
      
      if (text === '!вирус старт')           return cmdAdminVirusStart(ctx);
      if (text === '!вирус стоп')            return cmdAdminVirusStop(ctx);
      if (text.startsWith('!вылечить '))     return cmdAdminHeal(ctx, parts[1]);
      if (text.startsWith('!защитить '))     return cmdAdminVaccinate(ctx, parts[1]);
      if (text.startsWith('!заразить '))     return cmdAdminInfect(ctx, parts[1]);
    }

    // ── Команды с параметрами ─────────────────────────────
    if (text.startsWith('класс '))
      return cmdSetClass(ctx, uid, raw.slice('класс '.length).trim());
    
    if (text.startsWith('крафт '))
      return cmdCraft(ctx, uid, raw.slice('крафт '.length).trim());
    
    if (text.startsWith('создать бригаду '))
      return cmdCreateGuild(ctx, uid, raw.slice('создать бригаду '.length).trim());

    if (text.startsWith('пригласить '))
      return cmdInvite(ctx, uid, parseInt(text.slice('пригласить '.length).trim()));

    if (text.startsWith('купить ')) {
      const parts = text.slice('купить '.length).trim().split(/\s+/);
      const item = parts[0];
      const qty = parseInt(parts[1]) || 1;
      return cmdBuyItem(ctx, uid, item, qty);
    }

    if (text.startsWith('использовать '))
      return cmdUseItem(ctx, uid, text.slice('использовать '.length).trim());

    if (text.startsWith('продать '))
      return cmdSellOre(ctx, uid, text.slice('продать '.length).trim());

    if (text.startsWith('в казну '))
      return cmdTreasury(ctx, uid, text.slice('в казну '.length).trim());

    if (text.startsWith('из казны '))
      return cmdTakeFromTreasury(ctx, uid, text.slice('из казны '.length).trim());

    if (text.startsWith('перевести '))
      return cmdTransfer(ctx, uid, text.slice('перевести '.length));

    if (text.startsWith('промокод '))
      return cmdUsePromo(ctx, uid, text.slice('промокод '.length).trim());

    if (text.startsWith('бур ')) {
      const qty = parseInt(text.slice('бур '.length).trim()) || 1;
      return cmdBuyDrill(ctx, uid, qty);
    }
    
    if (text.startsWith('нефть ')) {
      const qty = parseInt(text.slice('нефть '.length).trim()) || 1;
      return cmdBuyOil(ctx, uid, qty);
    }
    
    if (text.startsWith('лечить ')) {
      const targetId = text.slice('лечить '.length).trim();
      return cmdHeal(ctx, uid, targetId);
    }

    if (text.startsWith('передать лидерство '))
      return cmdTransferLeadership(ctx, uid, parseInt(text.slice('передать лидерство '.length).trim()));

    if (text.startsWith('своровать ') || text.startsWith('украсть ')) {
      const targetId = text.split(/\s+/)[1];
      return cmdSteal(ctx, uid, targetId);
    }

    // ── Простые команды ───────────────────────────────────
    switch (text) {
      case 'старт':               return cmdStart(ctx, uid);
      case 'класс':               return cmdSetClass(ctx, uid, null);
      case 'работа':              return cmdWork(ctx, uid);
      case 'кирка':               return cmdPickaxe(ctx, uid);
      case 'бур':                 return cmdBuyDrill(ctx, uid, 1);
      case 'нефть':               return cmdBuyOil(ctx, uid, 1);
      case 'доход':               return cmdIncome(ctx, uid);
      case 'нефть доход':         return cmdOilIncome(ctx, uid);
      case 'отдых':               return cmdRest(ctx, uid);
      case 'профиль':             return cmdProfile(ctx, uid);
      case 'топ':                 return cmdTop(ctx);
      case 'топ кланов':          return cmdGuildTop(ctx);
      case 'топ бригад':          return cmdGuildTop(ctx);
      case 'рейтинг кланов':      return cmdGuildTop(ctx);
      case 'топ чатов':           return cmdChatTop(ctx);
      case 'рейтинг чатов':       return cmdChatTop(ctx);
      case 'чаты топ':            return cmdChatTop(ctx);
      case 'магазин':             return cmdShop(ctx);
      case 'инвентарь':           return cmdInventory(ctx, uid);
      case 'рецепты':             return cmdRecipes(ctx);
      case 'детали':              return cmdParts(ctx, uid);
      case 'бригада':             return cmdGuildInfo(ctx, uid);
      case 'принять приглашение': return cmdAcceptInvite(ctx, uid);
      case 'покинуть бригаду':    return cmdLeaveGuild(ctx, uid);
      case 'помощь':              return cmdHelp(ctx);
      case 'бонус':               return cmdDailyBonus(ctx, uid);
      case 'чёрная работа':       return cmdBlackWork(ctx, uid);
      case 'черная работа':       return cmdBlackWork(ctx, uid);
      case 'своровать':           return cmdSteal(ctx, uid, null);
      case 'украсть':             return cmdSteal(ctx, uid, null);
      
      case 'лечить':              return cmdHeal(ctx, uid, null);
      case 'вакцина':             return cmdVaccinate(ctx, uid);
      case 'статус':              return cmdVirusStatus(ctx, uid);
      case 'эпидемия':            return cmdEpidemicInfo(ctx);
      
      case 'еда':
      case 'кушать':
      case 'покушать':
      case 'съесть':
      case 'жрать':
      case 'хавать':             return cmdUseItem(ctx, uid, 'еда');

      case 'расформировать клан':
      case 'распустить клан':
      case 'распустить бригаду':
      case 'расформировать бригаду': return cmdDisbandGuild(ctx, uid);
    }

  } catch (err) {
    console.error('❌ Ошибка:', err.message, err.stack);
    try { await ctx.send('❌ Произошла ошибка. Попробуй ещё раз.'); } catch {}
  }
});

// ═══════════════════════════════════════════════════════════
//  ЗАПУСК
// ═══════════════════════════════════════════════════════════
(async () => {
  try {
    await initDB();
    startKeepalive();
    startEpidemicChecker();
    await vk.updates.start();
    console.log('🤖 Бот Generational Miners запущен! Все команды активны.');
    console.log('👤 Система классов активна!');
    console.log('🦠 Система вирусов активна!');
    console.log('👑 Система админов активна!');
    console.log('👥 Топ кланов активен!');
    console.log('💬 Топ чатов активен!');
    console.log('🔨 Система крафта активна!');
    console.log('🎭 Воровство у топ-5 по ID активно!');
  } catch (err) {
    console.error('❌ Ошибка запуска:', err);
    process.exit(1);
  }
})();