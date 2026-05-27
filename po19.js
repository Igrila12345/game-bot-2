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
const STEAL_MAX_AMOUNT    = 100000;

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

// PvP механики
const DUEL_DURATION          = 3 * 60 * 1000;
const BLOCK_DURATION         = 2 * 60 * 60 * 1000;
const RAID_COST              = 10000;
const RAID_DURATION          = 60 * 60 * 1000;
const RAID_COOLDOWN          = 3 * 24 * 60 * 60 * 1000;
const SABOTAGE_COST          = 500;
const SABOTAGE_DAMAGE        = 1000;
const TRAP_COST              = 300;
const RAID_MAX_STEAL_PCT     = 0.15;
const RAID_MAX_STEAL         = 50000;
const DESTROY_COST           = 1000;
const DESTROY_RATING_REQ     = 100;
const DESTROY_REPAIR_TIME    = 6 * 60 * 60 * 1000;
const DESTROY_REPAIR_MULT    = 1.5;
const WAR_COST               = 20000;
const WAR_DURATION           = 24 * 60 * 60 * 1000;
const WAR_COOLDOWN           = 7 * 24 * 60 * 60 * 1000;
const WAR_BLOCK_DURATION     = 3 * 60 * 60 * 1000;
const WAR_RAID_COST          = 5000;
const WAR_WIN_PCT            = 0.10;
const WAR_WIN_MAX            = 100000;
const WAR_LOSE_PENALTY_PCT   = 0.10;
const WAR_LOSE_PENALTY_DUR   = 24 * 60 * 60 * 1000;
const NEUTRAL_MINE_BONUS     = 0.20;
const NEUTRAL_MINE_DURATION  = 3 * 24 * 60 * 60 * 1000;
const MAX_ATTACKS_PER_DAY    = 3;
const DESTROY_COOLDOWN       = 24 * 60 * 60 * 1000;
const PROTECTION_LEVEL       = 5;
const PROTECTION_BALANCE     = 10000;
const PEACE_COST             = 5000;
const PEACE_DURATION         = 12 * 60 * 60 * 1000;

// Рефералка
const REFERRAL_REWARD_INVITER = 20000;
const REFERRAL_REWARD_INVITED = 5000;

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
  'пластина': {
    name: 'Железная пластина',
    emoji: '🔩',
    result_type: 'craft_resource',
    result_item: 'железная_пластина',
    result_amount: 1,
    ingredients: {
      'железо': 3,
      'уголь': 2,
    },
    coins_cost: 100,
    desc: '3 железной руды + 2 угля → 1 пластина',
  },
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

// PvP состояние
const activeDuels = new Map();
const activeRaids = new Map();
const activeWars = new Map();
const destroyedEquipment = new Map();
const attackCounts = new Map();
const peaceMode = new Map();
let neutralMineController = null;
let neutralMineControlEnd = 0;

// Флаг для подтверждения обнуления (используем globalThis)
globalThis.pendingResets = globalThis.pendingResets || new Set();

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
      drills_diamond  INT  DEFAULT 0,
      battle_rating   INT  DEFAULT 0,
      referral_code   VARCHAR(16) UNIQUE,
      referred_by     BIGINT DEFAULT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS guilds (
      id       SERIAL PRIMARY KEY,
      name     VARCHAR(64) UNIQUE NOT NULL,
      owner_id BIGINT NOT NULL,
      treasury BIGINT DEFAULT 0,
      level    INT    DEFAULT 1,
      xp       INT    DEFAULT 0,
      war_points INT  DEFAULT 0,
      last_raid  BIGINT DEFAULT 0,
      last_war   BIGINT DEFAULT 0
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS market_listings (
      id SERIAL PRIMARY KEY,
      seller_id BIGINT NOT NULL,
      item_type VARCHAR(32) NOT NULL,
      item_name VARCHAR(64) NOT NULL,
      quantity INT NOT NULL,
      price BIGINT NOT NULL,
      listed_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
    );
    CREATE TABLE IF NOT EXISTS destroyed_equipment (
      owner_id BIGINT NOT NULL,
      equipment_type VARCHAR(32) NOT NULL,
      destroyed_at BIGINT NOT NULL,
      repair_until BIGINT NOT NULL
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
    ['battle_rating',   'INT DEFAULT 0'],
    ['referral_code',   'VARCHAR(16) UNIQUE'],
    ['referred_by',     'BIGINT DEFAULT NULL'],
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
      drills_diamond  = COALESCE(drills_diamond, 0),
      battle_rating   = COALESCE(battle_rating, 0)
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
  p.battle_rating  = Number(p.battle_rating ?? 0);
  p.referred_by    = p.referred_by ? Number(p.referred_by) : null;
  return p;
}

async function getPlayer(uid) {
  const r = await pool.query('SELECT * FROM players WHERE user_id=$1', [uid]);
  return r.rows[0] ? sanitize(r.rows[0]) : null;
}

async function getOrCreate(uid) {
  const refCode = generateReferralCode();
  await pool.query(`
    INSERT INTO players (user_id, balance, stamina, pickaxe_lvl, drills, oil_rigs,
                         last_work, last_rest, last_drill, last_oil,
                         last_black, jail_until, has_roof, last_steal, last_daily,
                         hidden, banned, virus, virus_end, vaccine_end, player_class, is_admin,
                         work_count, craft_level, drills_enhanced, drills_diamond, battle_rating, referral_code)
    VALUES ($1, 0, 100, 1, 0, 0, 0, 0, 0, 0, 0, 0, FALSE, 0, 0, FALSE, FALSE, 0, 0, 0, NULL, FALSE, 0, 1, 0, 0, 0, $2)
    ON CONFLICT DO NOTHING
  `, [uid, refCode]);
  return getPlayer(uid);
}

function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
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

function isProtected(p) {
  return p.pickaxe_lvl < PROTECTION_LEVEL || p.balance < PROTECTION_BALANCE;
}

async function getDailyAttackCount(uid) {
  const today = getMoscowDayStart();
  let count = 0;
  for (const [key, value] of attackCounts) {
    if (value.attacker === uid && value.time >= today) count++;
  }
  return count;
}

async function recordAttack(attackerId, targetId) {
  const key = `${attackerId}_${targetId}_${Date.now()}`;
  attackCounts.set(key, { attacker: attackerId, target: targetId, time: Date.now() });
}

async function isInPeaceMode(uid) {
  const endTime = peaceMode.get(uid);
  if (endTime && endTime > Date.now()) return true;
  if (endTime && endTime <= Date.now()) {
    peaceMode.delete(uid);
    return false;
  }
  return false;
}

async function canAttack(attackerId, targetId) {
  const target = await getPlayer(targetId);
  if (!target) return { allowed: false, reason: 'Игрок не найден.' };
  if (isProtected(target)) return { allowed: false, reason: 'Игрок защищён (новичок или низкий баланс).' };
  if (await isInPeaceMode(targetId)) return { allowed: false, reason: 'Игрок в режиме мира.' };
  
  const dailyAttacks = await getDailyAttackCount(attackerId);
  if (dailyAttacks >= MAX_ATTACKS_PER_DAY) return { allowed: false, reason: 'Достигнут лимит атак на сегодня (3).' };
  
  return { allowed: true };
}

// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: получить количество уничтоженного оборудования по типу
async function getDestroyedCount(uid, equipType) {
  const now = Date.now();
  const destroyed = await pool.query(
    `SELECT COUNT(*) as cnt FROM destroyed_equipment WHERE owner_id=$1 AND equipment_type=$2 AND repair_until > $3`,
    [uid, equipType, now]
  );
  return Number(destroyed.rows[0]?.cnt || 0);
}

// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: получить всё доступное оборудование игрока (учитывая уничтоженное)
async function getAvailableEquipment(uid) {
  const p = await getPlayer(uid);
  const now = Date.now();
  const equipment = [];
  
  if (p.drills > 0) {
    const destroyedCount = await getDestroyedCount(uid, 'drill');
    const available = p.drills - destroyedCount;
    if (available > 0) equipment.push({ type: 'drill', name: 'Обычный бур', available });
  }
  if (p.drills_enhanced > 0) {
    const destroyedCount = await getDestroyedCount(uid, 'drill_enhanced');
    const available = p.drills_enhanced - destroyedCount;
    if (available > 0) equipment.push({ type: 'drill_enhanced', name: 'Усиленный бур', available });
  }
  if (p.drills_diamond > 0) {
    const destroyedCount = await getDestroyedCount(uid, 'drill_diamond');
    const available = p.drills_diamond - destroyedCount;
    if (available > 0) equipment.push({ type: 'drill_diamond', name: 'Алмазный бур', available });
  }
  if (p.oil_rigs > 0) {
    const destroyedCount = await getDestroyedCount(uid, 'oil_rig');
    const available = p.oil_rigs - destroyedCount;
    if (available > 0) equipment.push({ type: 'oil_rig', name: 'Нефтяная вышка', available });
  }
  
  return equipment;
}

// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: расчёт активного пассивного дохода и pending
async function calcPassiveInfo(uid) {
  const p = await getPlayer(uid);
  const now = Date.now();
  
  const destroyedDrills = await getDestroyedCount(uid, 'drill');
  const destroyedEnhanced = await getDestroyedCount(uid, 'drill_enhanced');
  const destroyedDiamond = await getDestroyedCount(uid, 'drill_diamond');
  const destroyedRigs = await getDestroyedCount(uid, 'oil_rig');
  
  const activeDrills = p.drills - destroyedDrills;
  const activeEnhanced = p.drills_enhanced - destroyedEnhanced;
  const activeDiamond = p.drills_diamond - destroyedDiamond;
  const activeRigs = p.oil_rigs - destroyedRigs;
  
  const engineerBonus = getClassBonus(p, 'drill');
  const oilBonus = getClassBonus(p, 'oil');
  
  const drillHours = Math.min((now - p.last_drill) / 3_600_000, PASSIVE_CAP_HOURS);
  const oilHours = Math.min((now - p.last_oil) / 3_600_000, PASSIVE_CAP_HOURS);
  
  let drillIncomePerHour = 0;
  let drillPending = 0;
  let oilIncomePerHour = 0;
  let oilPending = 0;
  
  if (activeDrills > 0) {
    let inc = DRILL_INCOME;
    if (engineerBonus > 0) inc = Math.floor(inc * (1 + engineerBonus));
    drillIncomePerHour += inc * activeDrills;
    drillPending += Math.floor(drillHours * inc * activeDrills);
  }
  if (activeEnhanced > 0) {
    let inc = 100;
    if (engineerBonus > 0) inc = Math.floor(inc * (1 + engineerBonus));
    drillIncomePerHour += inc * activeEnhanced;
    drillPending += Math.floor(drillHours * inc * activeEnhanced);
  }
  if (activeDiamond > 0) {
    let inc = 250;
    if (engineerBonus > 0) inc = Math.floor(inc * (1 + engineerBonus));
    drillIncomePerHour += inc * activeDiamond;
    drillPending += Math.floor(drillHours * inc * activeDiamond);
  }
  
  if (activeRigs > 0) {
    let inc = OIL_INCOME;
    if (oilBonus > 0) inc = Math.floor(inc * (1 + oilBonus));
    oilIncomePerHour = inc * activeRigs;
    oilPending = Math.floor(oilHours * inc * activeRigs);
  }
  
  if (globalEpidemic && p.virus !== 2) {
    drillPending = Math.floor(drillPending * (1 - VIRUS_INCOME_PENALTY));
    oilPending = Math.floor(oilPending * (1 - VIRUS_INCOME_PENALTY));
  }
  
  return {
    activeDrills, activeEnhanced, activeDiamond, activeRigs,
    drillIncomePerHour, drillPending,
    oilIncomePerHour, oilPending,
    totalDrills: p.drills, totalEnhanced: p.drills_enhanced,
    totalDiamond: p.drills_diamond, totalRigs: p.oil_rigs,
    engineerBonus, oilBonus
  };
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

  if (neutralMineController && neutralMineControlEnd > now && p.guild_id === neutralMineController) {
    income = Math.floor(income * (1 + NEUTRAL_MINE_BONUS));
  }

  if (globalEpidemic && p.virus !== 2) {
    income = Math.floor(income * (1 - VIRUS_INCOME_PENALTY));
  }

  const newSt = p.stamina - STAMINA_PER_WORK;
  await pool.query(
    `UPDATE players SET balance=balance+$1, stamina=$2, last_work=$3, work_count=work_count+1, battle_rating=battle_rating+1 WHERE user_id=$4`,
    [income, newSt, now, uid]
  );

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
  if (neutralMineController === p.guild_id && neutralMineControlEnd > now) msg += `🏰 Бонус нейтральной шахты: +20%\n`;
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
  msg += `\n⚔️ Боевой рейтинг: ${p.battle_rating + 1}`;
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

  const info = await calcPassiveInfo(uid);
  
  if (info.activeDrills === 0 && info.activeEnhanced === 0 && info.activeDiamond === 0)
    return send(ctx, `⚙️ У тебя нет активных буров.\nКупи бур командой «Бур [кол-во]» за ${DRILL_COST} монет/шт. или скрафти «Крафт бур обычный»`);

  const now = Date.now();
  let earned = info.drillPending;

  if (earned <= 0)
    return send(ctx, `⚙️ Буры ещё не успели заработать.\nПодожди хотя бы несколько минут!`);

  await pool.query(
    `UPDATE players SET balance=balance+$1, last_drill=$2 WHERE user_id=$3`,
    [earned, now, uid]
  );
  
  let msg = `⚙️ Доход с буров!\n💰 +${earned} монет (за ${(Math.min((now - p.last_drill) / 3_600_000, PASSIVE_CAP_HOURS)).toFixed(1)} ч.)\n`;
  if (info.activeDrills > 0) {
    let inc = DRILL_INCOME;
    if (info.engineerBonus > 0) inc = Math.floor(inc * (1 + info.engineerBonus));
    msg += `• Обычные буры: ${info.activeDrills}/${info.totalDrills} активны (+${info.activeDrills * inc}/ч)\n`;
  }
  if (info.activeEnhanced > 0) {
    let inc = 100;
    if (info.engineerBonus > 0) inc = Math.floor(inc * (1 + info.engineerBonus));
    msg += `• Усиленные буры: ${info.activeEnhanced}/${info.totalEnhanced} активны (+${info.activeEnhanced * inc}/ч)\n`;
  }
  if (info.activeDiamond > 0) {
    let inc = 250;
    if (info.engineerBonus > 0) inc = Math.floor(inc * (1 + info.engineerBonus));
    msg += `• Алмазные буры: ${info.activeDiamond}/${info.totalDiamond} активны (+${info.activeDiamond * inc}/ч)\n`;
  }
  if (info.engineerBonus > 0) msg += `⚙️ Бонус инженера: +25%\n`;
  if (globalEpidemic && p.virus !== 2) msg += `🦠 Доход снижен из-за эпидемии!\n`;
  
  await send(ctx, msg);
}

async function cmdOilIncome(ctx, uid) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  updateVirusStatus(p);

  const info = await calcPassiveInfo(uid);
  
  if (info.activeRigs === 0)
    return send(ctx, `🛢️ У тебя нет активных нефтяных вышек.\nКупи командой «Нефть [кол-во]» за ${OIL_COST} монет/шт. или скрафти «Крафт вышка нефтяная»`);

  const now = Date.now();
  let earned = info.oilPending;

  if (earned <= 0)
    return send(ctx, `🛢️ Вышки ещё не успели заработать.\nПодожди хотя бы несколько минут!`);

  await pool.query(
    `UPDATE players SET balance=balance+$1, last_oil=$2 WHERE user_id=$3`,
    [earned, now, uid]
  );
  
  let msg = `🛢️ Доход с ${info.activeRigs}/${info.totalRigs} вышки(ок)!\n💰 +${earned} монет (за ${(Math.min((now - p.last_oil) / 3_600_000, PASSIVE_CAP_HOURS)).toFixed(1)} ч.)\n📈 Доход: ${info.oilIncomePerHour} монет/час`;
  if (info.oilBonus > 0) msg += `\n🛢️ Бонус нефтяника: +30%`;
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
  let workCdInfo = workLeft > 0 ? `\n⏳ Кулдаун работы: ${fmtTime(workLeft)}` : `\n✅ Можно работать!`;

  // ИСПРАВЛЕНИЕ 5: используем calcPassiveInfo
  const info = await calcPassiveInfo(uid);
  let passiveInfo = '';
  
  if (info.totalDrills > 0) {
    passiveInfo += `\n⚙️ Обычные буры: ${info.activeDrills}/${info.totalDrills} активны (+${info.activeDrills * (info.engineerBonus > 0 ? Math.floor(DRILL_INCOME * (1 + info.engineerBonus)) : DRILL_INCOME)}/ч, накоп: ${info.drillPending} монет)`;
  }
  if (info.totalEnhanced > 0) {
    let inc = info.engineerBonus > 0 ? Math.floor(100 * (1 + info.engineerBonus)) : 100;
    passiveInfo += `\n🔩 Усиленные буры: ${info.activeEnhanced}/${info.totalEnhanced} активны (+${info.activeEnhanced * inc}/ч, накоп: ${info.drillPending} монет)`;
  }
  if (info.totalDiamond > 0) {
    let inc = info.engineerBonus > 0 ? Math.floor(250 * (1 + info.engineerBonus)) : 250;
    passiveInfo += `\n💎 Алмазные буры: ${info.activeDiamond}/${info.totalDiamond} активны (+${info.activeDiamond * inc}/ч, накоп: ${info.drillPending} монет)`;
  }
  if (info.totalDrills === 0 && info.totalEnhanced === 0 && info.totalDiamond === 0) {
    passiveInfo += `\n⚙️ Буры: нет`;
  }
  if (info.totalRigs > 0) {
    let inc = info.oilBonus > 0 ? Math.floor(OIL_INCOME * 1.30) : OIL_INCOME;
    passiveInfo += `\n🛢️ Вышки: ${info.activeRigs}/${info.totalRigs} активны (+${info.oilIncomePerHour}/ч, накоп: ${info.oilPending} монет)`;
  } else {
    passiveInfo += `\n🛢️ Вышки: нет`;
  }

  const jailInfo = p.jail_until > now ? `\n🚨 В тюрьме ещё ${fmtTime(p.jail_until - now)}` : '';
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
  const peaceInfo = await isInPeaceMode(uid) ? `\n🕊️ Режим мира активен` : '';

  const lines = [
    `👤 Профиль: ${name}`,
    `🆔 ID: ${uid}`,
    `💰 Баланс: ${p.balance} монет`,
    `❤️ Стамина: ${p.stamina}/${MAX_STAMINA}`,
    `⛏️ Кирка: ур. ${p.pickaxe_lvl} (+${pick.bonus}% к добыче)`,
    `⚔️ Боевой рейтинг: ${p.battle_rating}`,
    classInfo,
    adminInfo,
    peaceInfo,
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
    '⚔️ PvP:',
    `• Динамит для сноса — ${DESTROY_COST}💰 (в магазине)`,
    `• Перемирие — ${PEACE_COST}💰 (защита на 12 часов)`,
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
      '• Крафт пластина\n' +
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
  
  if (normalized.includes('пластина') || normalized === 'железная_пластина') recipeKey = 'пластина';
  else if (normalized.includes('бур_обычный') || normalized === 'обычный_бур') recipeKey = 'бур_обычный';
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
  
  lines.push('🔩 ДЕТАЛИ:');
  lines.push('• Железная пластина: 3🗿железа + 2🪨угля + 100💰');
  
  lines.push('');
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
//  ВОРОВСТВО (С ЛИМИТОМ 100К)
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
  let stolen = Math.max(50, Math.floor(victimBalance * pct));
  stolen = Math.min(stolen, STEAL_MAX_AMOUNT);

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
    `💰 Украдено: ${stolen} монет (${(pct * 100).toFixed(1)}% баланса, лимит 100 000💰)\n` +
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

  let mineInfo = '';
  if (neutralMineController === p.guild_id && neutralMineControlEnd > Date.now()) {
    mineInfo = `\n🏰 Контролирует нейтральную шахту! (+20% к добыче)\n⏳ Ещё ${fmtTime(neutralMineControlEnd - Date.now())}`;
  }

  const warPoints = Number(g.war_points || 0);

  await send(ctx, [
    `👥 Бригада: «${g.name}»`,
    `👑 Глава: ${ownerName} (ID: ${g.owner_id})`,
    `📊 Уровень: ${g.level} (+${Number(g.level) * 5}% к добыче)`,
    `👤 Участников: ${memberR.rows[0].cnt}`,
    `💰 Казна: ${Number(g.treasury)} монет`,
    `📈 XP: ${g.xp}/${nextCost} (до ур. ${Number(g.level) + 1})`,
    `⚔️ Очки войны: ${warPoints}`,
    brigadirInfo,
    mineInfo,
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
//  РЫНОК
// ═══════════════════════════════════════════════════════════

async function cmdMarketSell(ctx, uid, itemType, itemName, quantity, price) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  if (!itemType || !itemName || !quantity || !price) {
    return send(ctx,
      '❌ Формат: «Продать на рынке [тип] [название] [кол-во] [цена за шт.]»\n' +
      'Типы: руда, предмет, бур, усиленный бур, алмазный бур, вышка\n' +
      'Примеры:\n' +
      '• Продать на рынке руда алмаз 5 400\n' +
      '• Продать на рынке бур обычный 1 5000\n' +
      '• Продать на рынке усиленный бур усиленный 1 8000\n' +
      '• Продать на рынке алмазный бур алмазный 1 15000\n' +
      '• Продать на рынке вышка нефтяная 1 20000'
    );
  }

  quantity = parseInt(quantity);
  price = parseInt(price);

  if (quantity <= 0 || price <= 0)
    return send(ctx, '❌ Количество и цена должны быть положительными числами.');

  if (itemType === 'руда') {
    if (!ORES[itemName]) return send(ctx, `❌ Руда «${itemName}» не найдена.`);
    const qty = await getItemQty(uid, itemName);
    if (qty < quantity) return send(ctx, `❌ У тебя только ${qty} шт. руды «${itemName}».`);
    await removeItem(uid, itemName, quantity);
  } else if (itemType === 'предмет') {
    // Проверяем все возможные предметы
    const validItems = { ...SHOP_ITEMS, ...CRAFT_RESOURCES };
    if (!validItems[itemName] && !ORES[itemName] && itemName !== 'контрабанда' && 
        itemName !== 'динамит' && itemName !== 'еда' && itemName !== 'крыша' &&
        itemName !== 'аптечка' && itemName !== 'вакцина' && itemName !== 'антибиотик') {
      // Всё равно разрешаем, но предупреждаем
    }
    const qty = await getItemQty(uid, itemName);
    if (qty < quantity) return send(ctx, `❌ У тебя только ${qty} шт. предмета «${itemName}».`);
    await removeItem(uid, itemName, quantity);
  } else if (itemType === 'бур') {
    if (p.drills < quantity) return send(ctx, `❌ У тебя только ${p.drills} обычных буров.`);
    await pool.query(`UPDATE players SET drills=drills-$1 WHERE user_id=$2`, [quantity, uid]);
    itemName = 'обычный бур';
  } else if (itemType === 'усиленный бур' || itemType === 'усиленный_бур') {
    if (p.drills_enhanced < quantity) return send(ctx, `❌ У тебя только ${p.drills_enhanced} усиленных буров.`);
    await pool.query(`UPDATE players SET drills_enhanced=drills_enhanced-$1 WHERE user_id=$2`, [quantity, uid]);
    itemType = 'усиленный бур';
    itemName = 'усиленный бур';
  } else if (itemType === 'алмазный бур' || itemType === 'алмазный_бур') {
    if (p.drills_diamond < quantity) return send(ctx, `❌ У тебя только ${p.drills_diamond} алмазных буров.`);
    await pool.query(`UPDATE players SET drills_diamond=drills_diamond-$1 WHERE user_id=$2`, [quantity, uid]);
    itemType = 'алмазный бур';
    itemName = 'алмазный бур';
  } else if (itemType === 'вышка') {
    if (p.oil_rigs < quantity) return send(ctx, `❌ У тебя только ${p.oil_rigs} вышек.`);
    await pool.query(`UPDATE players SET oil_rigs=oil_rigs-$1 WHERE user_id=$2`, [quantity, uid]);
    itemName = 'нефтяная вышка';
  } else {
    return send(ctx,
      '❌ Неверный тип. Доступные: руда, предмет, бур, усиленный бур, алмазный бур, вышка\n' +
      'Пример: «Продать на рынке руда алмаз 5 400»'
    );
  }

  await pool.query(
    `INSERT INTO market_listings (seller_id, item_type, item_name, quantity, price) VALUES ($1,$2,$3,$4,$5)`,
    [uid, itemType, itemName, quantity, price]
  );

  await send(ctx,
    `📦 Товар выставлен на рынок!\n` +
    `📋 ${itemName} ×${quantity} по ${price}💰/шт.\n` +
    `💰 Общая стоимость: ${quantity * price}💰`
  );
}

async function cmdMarketList(ctx) {
  const listings = await pool.query(
    `SELECT * FROM market_listings ORDER BY listed_at DESC LIMIT 20`
  );

  if (!listings.rows.length)
    return send(ctx,
      '📦 На рынке пока нет товаров.\n' +
      'Выставить: «Продать на рынке [тип] [название] [кол-во] [цена]»\n' +
      'Типы: руда, предмет, бур, усиленный бур, алмазный бур, вышка\n' +
      'Пример: «Продать на рынке руда алмаз 5 400»'
    );

  const lines = ['📦 РЫНОК (последние 20 лотов):', ''];
  
  for (const lot of listings.rows) {
    const sellerName = await getName(Number(lot.seller_id));
    lines.push(
      `#${lot.id} | ${lot.item_name} ×${lot.quantity} по ${Number(lot.price)}💰/шт.`,
      `   Продавец: ${sellerName} | Тип: ${lot.item_type}`,
      `   Всего: ${Number(lot.quantity) * Number(lot.price)}💰`,
      ''
    );
  }

  lines.push('Купить: «Купить на рынке [ID лота]»');
  
  await send(ctx, lines.join('\n'));
}

async function cmdMarketBuy(ctx, uid, lotId) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  lotId = parseInt(lotId);
  if (!lotId) return send(ctx, '❌ Укажи ID лота: «Купить на рынке [ID]»');

  const lot = await pool.query(`SELECT * FROM market_listings WHERE id=$1`, [lotId]);
  if (!lot.rows.length) return send(ctx, '❌ Лот не найден.');
  
  const listing = lot.rows[0];
  const totalPrice = Number(listing.quantity) * Number(listing.price);

  if (Number(listing.seller_id) === uid)
    return send(ctx, '❌ Нельзя купить свой же товар.');

  if (p.balance < totalPrice)
    return send(ctx,
      `❌ Не хватает монет.\n` +
      `Нужно: ${totalPrice}💰\n` +
      `Баланс: ${p.balance}💰`
    );

  await pool.query(`UPDATE players SET balance=balance-$1 WHERE user_id=$2`, [totalPrice, uid]);
  await pool.query(`UPDATE players SET balance=balance+$1 WHERE user_id=$2`, [totalPrice, Number(listing.seller_id)]);

  // Передаём предмет покупателю
  if (listing.item_type === 'руда' || listing.item_type === 'предмет') {
    await addItem(uid, listing.item_name, Number(listing.quantity));
  } else if (listing.item_type === 'бур') {
    await pool.query(`UPDATE players SET drills=drills+$1 WHERE user_id=$2`, [Number(listing.quantity), uid]);
  } else if (listing.item_type === 'усиленный бур' || listing.item_type === 'усиленный_бур') {
    await pool.query(`UPDATE players SET drills_enhanced=drills_enhanced+$1 WHERE user_id=$2`, [Number(listing.quantity), uid]);
  } else if (listing.item_type === 'алмазный бур' || listing.item_type === 'алмазный_бур') {
    await pool.query(`UPDATE players SET drills_diamond=drills_diamond+$1 WHERE user_id=$2`, [Number(listing.quantity), uid]);
  } else if (listing.item_type === 'вышка') {
    await pool.query(`UPDATE players SET oil_rigs=oil_rigs+$1 WHERE user_id=$2`, [Number(listing.quantity), uid]);
  }

  await pool.query(`DELETE FROM market_listings WHERE id=$1`, [lotId]);

  const sellerName = await getName(Number(listing.seller_id));
  const buyerName = await getName(uid);

  try {
    await vk.api.messages.send({
      user_id: Number(listing.seller_id),
      message: `📦 Твой товар «${listing.item_name}» ×${listing.quantity} продан на рынке!\n💰 Получено: ${totalPrice} монет\n👤 Покупатель: ${buyerName}`,
      random_id: Math.floor(Math.random() * 1e9),
    });
  } catch {}

  await send(ctx,
    `✅ Покупка совершена!\n` +
    `📦 ${listing.item_name} ×${listing.quantity} получено\n` +
    `💰 Потрачено: ${totalPrice} монет\n` +
    `👤 Продавец: ${sellerName}`
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
//  РЕФЕРАЛЬНАЯ СИСТЕМА
// ═══════════════════════════════════════════════════════════

async function cmdReferral(ctx, uid) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  if (!p.referral_code) {
    const refCode = generateReferralCode();
    await pool.query(`UPDATE players SET referral_code=$1 WHERE user_id=$2`, [refCode, uid]);
    p.referral_code = refCode;
  }

  // ИСПРАВЛЕНИЕ 2: используем group_id из контекста или запасной вариант
  const groupId = ctx.$groupId || ctx.groupId || 'club225458430';
  const refLink = `https://vk.com/write-${groupId}?ref=${p.referral_code}`;

  await send(ctx,
    `🔗 Твоя реферальная ссылка:\n${refLink}\n\n` +
    `👥 Приглашай друзей и получай бонусы!\n` +
    `💰 За каждого приглашённого: +${REFERRAL_REWARD_INVITER.toLocaleString()} монет\n` +
    `🎁 Приглашённый получает: +${REFERRAL_REWARD_INVITED.toLocaleString()} монет`
  );
}

async function processReferral(refCode, newUserId) {
  if (!refCode) return;
  
  const referrer = await pool.query(
    `SELECT user_id FROM players WHERE referral_code=$1 AND user_id != $2`,
    [refCode, newUserId]
  );
  
  if (!referrer.rows.length) return;
  
  const referrerId = Number(referrer.rows[0].user_id);
  
  const newPlayer = await getPlayer(newUserId);
  if (newPlayer && newPlayer.referred_by) return;
  
  await pool.query(
    `UPDATE players SET referred_by=$1 WHERE user_id=$2`,
    [referrerId, newUserId]
  );
  await pool.query(
    `UPDATE players SET balance=balance+$1 WHERE user_id=$2`,
    [REFERRAL_REWARD_INVITER, referrerId]
  );
  await pool.query(
    `UPDATE players SET balance=balance+$1 WHERE user_id=$2`,
    [REFERRAL_REWARD_INVITED, newUserId]
  );
  
  try {
    const newPlayerName = await getName(newUserId);
    await vk.api.messages.send({
      user_id: referrerId,
      message: `🎉 По твоей реферальной ссылке зарегистрировался ${newPlayerName}!\n💰 Ты получил ${REFERRAL_REWARD_INVITER.toLocaleString()} монет!`,
      random_id: Math.floor(Math.random() * 1e9),
    });
  } catch {}
}

// ═══════════════════════════════════════════════════════════
//  PvP МЕХАНИКИ
// ═══════════════════════════════════════════════════════════

// 1. Дуэль с уничтожением
async function cmdDuel(ctx, uid, targetIdStr, betStr) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  const targetId = parseInt(targetIdStr);
  const bet = parseInt(betStr);

  if (!targetId || !bet || bet <= 0)
    return send(ctx, '❌ Формат: «Бой @Игрок [ставка]» или «Бой [ID] [ставка]»\nПример: «Бой 123456789 5000»');

  if (targetId === uid)
    return send(ctx, '❌ Нельзя вызвать на дуэль самого себя.');

  const canAtk = await canAttack(uid, targetId);
  if (!canAtk.allowed) return send(ctx, `❌ ${canAtk.reason}`);

  if (p.balance < bet)
    return send(ctx, `❌ У тебя недостаточно монет для ставки.\nБаланс: ${p.balance}💰`);

  const target = await getPlayer(targetId);
  if (!target) return send(ctx, `❌ Игрок #${targetId} не найден.`);
  if (target.balance < bet)
    return send(ctx, `❌ У противника недостаточно монет для ставки.`);

  const duelKey = `${uid}_${targetId}`;
  if (activeDuels.has(duelKey))
    return send(ctx, '❌ У вас уже активная дуэль.');

  activeDuels.set(duelKey, {
    challenger: uid,
    defender: targetId,
    bet: bet,
    startTime: Date.now(),
    accepted: false
  });

  await send(ctx,
    `⚔️ ${await getName(uid)} вызвал на дуэль ${await getName(targetId)}!\n` +
    `💰 Ставка: ${bet} монет\n` +
    `⏳ Ожидание 3 минуты...\n\n` +
    `Противник должен принять вызов: «Принять бой»`
  );

  try {
    await vk.api.messages.send({
      user_id: targetId,
      message: `⚔️ ${await getName(uid)} вызвал тебя на дуэль!\n💰 Ставка: ${bet} монет\n⏳ Прими вызов командой «Принять бой» в течение 3 минут!`,
      random_id: Math.floor(Math.random() * 1e9),
    });
  } catch {}

  setTimeout(async () => {
    const duel = activeDuels.get(duelKey);
    if (duel && !duel.accepted) {
      activeDuels.delete(duelKey);
      try {
        await vk.api.messages.send({
          user_id: uid,
          message: `⏰ Дуэль с ${await getName(targetId)} не состоялась — время вышло.`,
          random_id: Math.floor(Math.random() * 1e9),
        });
      } catch {}
    }
  }, DUEL_DURATION);
}

async function cmdAcceptDuel(ctx, uid) {
  let foundDuel = null;
  let duelKey = null;

  for (const [key, duel] of activeDuels) {
    if (duel.defender === uid && !duel.accepted) {
      foundDuel = duel;
      duelKey = key;
      break;
    }
  }

  if (!foundDuel)
    return send(ctx, '❌ У тебя нет активных вызовов на дуэль.');

  foundDuel.accepted = true;
  
  const winner = Math.random() < 0.5 ? foundDuel.challenger : foundDuel.defender;
  const loser = winner === foundDuel.challenger ? foundDuel.defender : foundDuel.challenger;
  const bet = foundDuel.bet;

  await pool.query(`UPDATE players SET balance=balance+$1 WHERE user_id=$2`, [bet, winner]);
  await pool.query(`UPDATE players SET balance=balance-$1 WHERE user_id=$2`, [bet, loser]);

  const loserEquipment = await getAvailableEquipment(loser);
  let blockedMsg = '';
  
  if (loserEquipment.length > 0) {
    const toBlock = loserEquipment[Math.floor(Math.random() * loserEquipment.length)];
    await pool.query(
      `INSERT INTO destroyed_equipment (owner_id, equipment_type, destroyed_at, repair_until) VALUES ($1,$2,$3,$4)`,
      [loser, toBlock.type, Date.now(), Date.now() + BLOCK_DURATION]
    );
    blockedMsg = `\n💥 Заблокирован: ${toBlock.name} на ${fmtTime(BLOCK_DURATION)}`;
  }

  await recordAttack(winner, loser);
  activeDuels.delete(duelKey);

  const winnerName = await getName(winner);
  const loserName = await getName(loser);

  await send(ctx,
    `⚔️ ДУЭЛЬ ЗАВЕРШЕНА!\n\n` +
    `🏆 Победитель: ${winnerName}\n` +
    `💀 Проигравший: ${loserName}\n` +
    `💰 Ставка ${bet}💰 переходит победителю!${blockedMsg}\n\n` +
    `🔧 Проигравший может восстановить оборудование командой «Ремонт» за ${DESTROY_REPAIR_MULT * 100}% стоимости.`
  );

  try {
    await vk.api.messages.send({
      user_id: loser,
      message: `💀 Ты проиграл дуэль против ${winnerName}!\n💰 Потеряно: ${bet} монет${blockedMsg}\n🔧 Восстанови оборудование: «Ремонт»`,
      random_id: Math.floor(Math.random() * 1e9),
    });
  } catch {}
}

// 2. Рейд на шахту
async function cmdRaid(ctx, uid, targetGuildName) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  if (!p.guild_id) return send(ctx, '❌ Только члены бригады могут участвовать в рейдах.');
  if (!targetGuildName) return send(ctx, '❌ Укажи название бригады: «Рейд [название]»');

  const gr = await pool.query('SELECT * FROM guilds WHERE id=$1', [p.guild_id]);
  if (!gr.rows[0]) return send(ctx, '❌ Твоя бригада не найдена.');
  
  const myGuild = gr.rows[0];
  if (Number(myGuild.owner_id) !== uid)
    return send(ctx, '❌ Только глава бригады может начать рейд.');

  const targetGuild = await pool.query('SELECT * FROM guilds WHERE name=$1', [targetGuildName]);
  if (!targetGuild.rows.length) return send(ctx, `❌ Бригада «${targetGuildName}» не найдена.`);
  
  const target = targetGuild.rows[0];
  if (target.id === p.guild_id) return send(ctx, '❌ Нельзя рейдить свою бригаду.');

  const now = Date.now();
  if (Number(myGuild.last_raid) > now - RAID_COOLDOWN)
    return send(ctx, `❌ Рейд доступен раз в 3 дня. Следующий через ${fmtTime(RAID_COOLDOWN - (now - Number(myGuild.last_raid)))}`);

  if (Number(myGuild.treasury) < RAID_COST)
    return send(ctx, `❌ В казне недостаточно средств. Нужно ${RAID_COST}💰.`);

  await pool.query(`UPDATE guilds SET treasury=treasury-$1 WHERE id=$2`, [RAID_COST, p.guild_id]);

  const raidKey = `${p.guild_id}_${target.id}`;
  activeRaids.set(raidKey, {
    attackerGuild: p.guild_id,
    defenderGuild: target.id,
    startTime: now,
    endTime: now + RAID_DURATION,
    damage: 0,
    traps: 0,
    participants: new Set()
  });

  await pool.query(`UPDATE guilds SET last_raid=$1 WHERE id=$2`, [now, p.guild_id]);

  const allAttackers = await pool.query(`SELECT user_id FROM players WHERE guild_id=$1`, [p.guild_id]);
  const allDefenders = await pool.query(`SELECT user_id FROM players WHERE guild_id=$1`, [target.id]);

  for (const pl of allAttackers.rows) {
    try {
      await vk.api.messages.send({
        user_id: pl.user_id,
        message: `🏴‍☠️ РЕЙД! Твоя бригада атакует «${targetGuildName}»!\n⏳ У тебя 1 час на диверсии: «Диверсия» (500💰)\n💰 Каждая диверсия наносит ${SABOTAGE_DAMAGE} урона.`,
        random_id: Math.floor(Math.random() * 1e9),
      });
    } catch {}
  }

  for (const pl of allDefenders.rows) {
    try {
      await vk.api.messages.send({
        user_id: pl.user_id,
        message: `🛡️ ТРЕВОГА! Бригада «${myGuild.name}» атакует вашу шахту!\n⏳ Защищайтесь: «Ловушка» (${TRAP_COST}💰)`,
        random_id: Math.floor(Math.random() * 1e9),
      });
    } catch {}
  }

  await send(ctx,
    `🏴‍☠️ РЕЙД НАЧАТ!\n` +
    `Цель: бригада «${targetGuildName}»\n` +
    `⏳ Длительность: 1 час\n` +
    `💰 Из казны списано: ${RAID_COST} монет\n\n` +
    `Твоя бригада может выполнять диверсии: «Диверсия»`
  );

  setTimeout(async () => {
    await finishRaid(raidKey);
  }, RAID_DURATION);
}

async function cmdSabotage(ctx, uid) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  if (!p.guild_id) return send(ctx, '❌ Ты не состоишь в бригаде.');
  if (p.balance < SABOTAGE_COST) return send(ctx, `❌ Недостаточно монет. Нужно ${SABOTAGE_COST}💰.`);

  let foundRaid = null;
  let raidKey = null;
  for (const [key, raid] of activeRaids) {
    if (raid.attackerGuild === p.guild_id && Date.now() < raid.endTime) {
      foundRaid = raid;
      raidKey = key;
      break;
    }
  }

  if (!foundRaid) return send(ctx, '❌ Сейчас нет активных рейдов для твоей бригады.');

  // Списываем деньги и сразу добавляем урон
  await pool.query(`UPDATE players SET balance=balance-$1 WHERE user_id=$2`, [SABOTAGE_COST, uid]);
  foundRaid.damage += SABOTAGE_DAMAGE;
  foundRaid.participants.add(uid);

  await send(ctx,
    `💣 Диверсия выполнена!\n` +
    `💰 Потрачено: ${SABOTAGE_COST} монет\n` +
    `⚔️ Урон: +${SABOTAGE_DAMAGE}\n` +
    `📊 Общий урон рейда: ${foundRaid.damage}`
  );
}

async function cmdTrap(ctx, uid) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  if (!p.guild_id) return send(ctx, '❌ Ты не состоишь в бригаде.');
  if (p.balance < TRAP_COST) return send(ctx, `❌ Недостаточно монет. Нужно ${TRAP_COST}💰.`);

  let foundRaid = null;
  let raidKey = null;
  for (const [key, raid] of activeRaids) {
    if (raid.defenderGuild === p.guild_id && Date.now() < raid.endTime) {
      foundRaid = raid;
      raidKey = key;
      break;
    }
  }

  if (!foundRaid) return send(ctx, '❌ Сейчас нет активных рейдов на твою бригаду.');

  await pool.query(`UPDATE players SET balance=balance-$1 WHERE user_id=$2`, [TRAP_COST, uid]);
  foundRaid.traps += SABOTAGE_DAMAGE;
  foundRaid.participants.add(uid);

  await send(ctx,
    `🪤 Ловушка установлена!\n` +
    `💰 Потрачено: ${TRAP_COST} монет\n` +
    `🛡️ Защита: +${SABOTAGE_DAMAGE}\n` +
    `📊 Общая защита: ${foundRaid.traps}`
  );
}

async function finishRaid(raidKey) {
  const raid = activeRaids.get(raidKey);
  if (!raid) return;
  
  const effectiveDamage = Math.max(0, raid.damage - raid.traps);
  
  const defenderGuild = await pool.query('SELECT * FROM guilds WHERE id=$1', [raid.defenderGuild]);
  if (!defenderGuild.rows.length) {
    activeRaids.delete(raidKey);
    return;
  }

  if (effectiveDamage > 0) {
    const stealPct = Math.min(RAID_MAX_STEAL_PCT, effectiveDamage / 10000);
    let stolen = Math.floor(Number(defenderGuild.rows[0].treasury) * stealPct);
    stolen = Math.min(stolen, RAID_MAX_STEAL);
    
    // ИСПРАВЛЕНИЕ 7: защита от отрицательной казны
    stolen = Math.min(stolen, Number(defenderGuild.rows[0].treasury));

    if (stolen > 0) {
      await pool.query(`UPDATE guilds SET treasury=treasury-$1 WHERE id=$2`, [stolen, raid.defenderGuild]);
      await pool.query(`UPDATE guilds SET treasury=treasury+$1 WHERE id=$2`, [stolen, raid.attackerGuild]);
    }

    const attackerGuild = await pool.query('SELECT name FROM guilds WHERE id=$1', [raid.attackerGuild]);

    const allDefenders = await pool.query(`SELECT user_id FROM players WHERE guild_id=$1`, [raid.defenderGuild]);
    for (const pl of allDefenders.rows) {
      try {
        await vk.api.messages.send({
          user_id: pl.user_id,
          message: `💀 Рейд завершён! Бригада «${attackerGuild.rows[0]?.name || 'Неизвестно'}» украла ${stolen}💰 из казны!`,
          random_id: Math.floor(Math.random() * 1e9),
        });
      } catch {}
    }
  } else {
    const compensation = 5000;
    // ИСПРАВЛЕНИЕ 7: защита от отрицательной казны атакующих
    const attackerGuild = await pool.query('SELECT * FROM guilds WHERE id=$1', [raid.attackerGuild]);
    const actualCompensation = Math.min(compensation, Number(attackerGuild.rows[0]?.treasury || 0));
    
    if (actualCompensation > 0) {
      await pool.query(`UPDATE guilds SET treasury=treasury-$1 WHERE id=$2`, [actualCompensation, raid.attackerGuild]);
      await pool.query(`UPDATE guilds SET treasury=treasury+$1 WHERE id=$2`, [actualCompensation, raid.defenderGuild]);
    }

    const allAttackers = await pool.query(`SELECT user_id FROM players WHERE guild_id=$1`, [raid.attackerGuild]);
    for (const pl of allAttackers.rows) {
      try {
        await vk.api.messages.send({
          user_id: pl.user_id,
          message: `❌ Рейд провален! Защитники отбили атаку. Ваша бригада теряет ${actualCompensation}💰 компенсации.`,
          random_id: Math.floor(Math.random() * 1e9),
        });
      } catch {}
    }
  }

  activeRaids.delete(raidKey);
}

// 3. Снос буров и вышек
async function cmdDestroy(ctx, uid, targetIdStr, equipNumStr) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  const targetId = parseInt(targetIdStr);
  if (!targetId) return send(ctx, '❌ Формат: «Взорвать @Игрок [номер]»\nНомер оборудования из списка.');

  if (targetId === uid) return send(ctx, '❌ Нельзя взорвать своё оборудование.');

  const canAtk = await canAttack(uid, targetId);
  if (!canAtk.allowed) return send(ctx, `❌ ${canAtk.reason}`);

  if (p.battle_rating < DESTROY_RATING_REQ)
    return send(ctx, `❌ Нужен боевой рейтинг ${DESTROY_RATING_REQ} (у тебя: ${p.battle_rating}).`);

  const dynamiteQty = await getItemQty(uid, 'динамит');
  if (dynamiteQty <= 0)
    return send(ctx, `❌ Нужен динамит! Купи в магазине за ${DESTROY_COST}💰: «Купить динамит»`);

  const targetEquipment = await getAvailableEquipment(targetId);
  if (targetEquipment.length === 0)
    return send(ctx, `❌ У игрока #${targetId} нет доступного для уничтожения оборудования.`);

  const equipNum = parseInt(equipNumStr) || 1;
  if (equipNum < 1 || equipNum > targetEquipment.length)
    return send(ctx, `❌ Выбери номер от 1 до ${targetEquipment.length}. Список: «Взорвать [ID]»`);

  const toDestroy = targetEquipment[equipNum - 1];

  // ИСПРАВЛЕНИЕ 11: проверяем кулдаун по конкретному типу оборудования
  const lastDestroy = await pool.query(
    `SELECT MAX(destroyed_at) as last FROM destroyed_equipment WHERE owner_id=$1 AND equipment_type=$2`,
    [targetId, toDestroy.type]
  );
  if (lastDestroy.rows[0]?.last > Date.now() - DESTROY_COOLDOWN)
    return send(ctx, `❌ Это оборудование уже атаковали за последние сутки.`);

  await pool.query(`UPDATE inventory SET quantity=quantity-1 WHERE user_id=$1 AND item='динамит'`, [uid]);
  await pool.query(
    `INSERT INTO destroyed_equipment (owner_id, equipment_type, destroyed_at, repair_until) VALUES ($1,$2,$3,$4)`,
    [targetId, toDestroy.type, Date.now(), Date.now() + DESTROY_REPAIR_TIME]
  );

  await recordAttack(uid, targetId);

  const targetName = await getName(targetId);
  const repairCost = toDestroy.type === 'drill' ? Math.floor(DRILL_COST * DESTROY_REPAIR_MULT) :
                     toDestroy.type === 'drill_enhanced' ? Math.floor(1000 * DESTROY_REPAIR_MULT) :
                     toDestroy.type === 'drill_diamond' ? Math.floor(3000 * DESTROY_REPAIR_MULT) :
                     Math.floor(OIL_COST * DESTROY_REPAIR_MULT);

  await send(ctx,
    `💥 УСПЕШНЫЙ ВЗРЫВ!\n` +
    `🎯 Цель: ${targetName} (ID: ${targetId})\n` +
    `🔧 Уничтожено: ${toDestroy.name}\n` +
    `⏳ Время восстановления: 6 часов\n` +
    `💰 Стоимость мгновенного ремонта: ${repairCost} монет`
  );

  try {
    await vk.api.messages.send({
      user_id: targetId,
      message: `💥 Твой ${toDestroy.name} был уничтожен игроком ${await getName(uid)}!\n⏳ Восстановление через 6 часов или «Ремонт» за ${repairCost}💰.`,
      random_id: Math.floor(Math.random() * 1e9),
    });
  } catch {}
}

async function cmdShowEquipment(ctx, uid, targetIdStr) {
  const targetId = parseInt(targetIdStr);
  if (!targetId) return send(ctx, '❌ Укажи ID игрока: «Взорвать [ID]»');

  // ИСПРАВЛЕНИЕ 13: проверяем наличие динамита ДО показа списка
  const dynamiteQty = await getItemQty(uid, 'динамит');
  if (dynamiteQty <= 0)
    return send(ctx, `❌ У тебя нет динамита! Купи в магазине: «Купить динамит» (${DESTROY_COST}💰)`);

  const equipment = await getAvailableEquipment(targetId);
  if (equipment.length === 0)
    return send(ctx, `У игрока #${targetId} нет доступного для уничтожения оборудования.`);

  const lines = [`🔧 Оборудование игрока #${targetId}:`, ''];
  equipment.forEach((eq, i) => {
    lines.push(`${i + 1}. ${eq.name} (доступно: ${eq.available} шт.)`);
  });
  lines.push('', '💥 Чтобы взорвать: «Взорвать [ID] [номер]»');

  await send(ctx, lines.join('\n'));
}

async function cmdRepair(ctx, uid) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  // Проверяем, не в войне ли игрок
  for (const [key, war] of activeWars) {
    const guilds = key.split('_');
    if (p.guild_id && (p.guild_id === parseInt(guilds[0]) || p.guild_id === parseInt(guilds[1]))) {
      if (Date.now() < war.endTime) {
        return send(ctx, '❌ Ремонт недоступен во время войны кланов!');
      }
    }
  }

  const now = Date.now();
  const destroyed = await pool.query(
    `SELECT * FROM destroyed_equipment WHERE owner_id=$1 AND repair_until > $2`,
    [uid, now]
  );

  if (!destroyed.rows.length)
    return send(ctx, '✅ У тебя нет уничтоженного оборудования! Всё в порядке.');

  let totalCost = 0;
  const repairList = [];

  for (const eq of destroyed.rows) {
    let cost = 0;
    switch (eq.equipment_type) {
      case 'drill': cost = Math.floor(DRILL_COST * DESTROY_REPAIR_MULT); break;
      case 'drill_enhanced': cost = Math.floor(1000 * DESTROY_REPAIR_MULT); break;
      case 'drill_diamond': cost = Math.floor(3000 * DESTROY_REPAIR_MULT); break;
      case 'oil_rig': cost = Math.floor(OIL_COST * DESTROY_REPAIR_MULT); break;
    }
    totalCost += cost;
    repairList.push(`${eq.equipment_type}: ${cost}💰 (восстановится через ${fmtTime(eq.repair_until - now)})`);
  }

  if (p.balance < totalCost)
    return send(ctx,
      `🔧 РЕМОНТ ОБОРУДОВАНИЯ:\n\n` +
      repairList.join('\n') +
      `\n\n💰 Общая стоимость: ${totalCost} монет\n` +
      `❌ Не хватает: ${totalCost - p.balance} монет\n\n` +
      `Или дождись бесплатного восстановления.`
    );

  await pool.query(`UPDATE players SET balance=balance-$1 WHERE user_id=$2`, [totalCost, uid]);
  await pool.query(`DELETE FROM destroyed_equipment WHERE owner_id=$1 AND repair_until > $2`, [uid, now]);

  await send(ctx,
    `🔧 ОБОРУДОВАНИЕ ВОССТАНОВЛЕНО!\n\n` +
    repairList.join('\n') +
    `\n\n💰 Списано: ${totalCost} монет\n` +
    `✅ Всё оборудование снова работает!`
  );
}

// 4. Война кланов
async function cmdWar(ctx, uid, targetGuildName) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  if (!p.guild_id) return send(ctx, '❌ Только глава бригады может объявить войну.');
  if (!targetGuildName) return send(ctx, '❌ Укажи название бригады: «Война [название]»');

  const myGuild = await pool.query('SELECT * FROM guilds WHERE id=$1', [p.guild_id]);
  if (!myGuild.rows.length) return send(ctx, '❌ Твоя бригада не найдена.');
  if (Number(myGuild.rows[0].owner_id) !== uid)
    return send(ctx, '❌ Только глава бригады может объявить войну.');

  const now = Date.now();
  if (Number(myGuild.rows[0].last_war) > now - WAR_COOLDOWN)
    return send(ctx, `❌ Война доступна раз в 7 дней. Следующая через ${fmtTime(WAR_COOLDOWN - (now - Number(myGuild.rows[0].last_war)))}`);

  if (Number(myGuild.rows[0].treasury) < WAR_COST)
    return send(ctx, `❌ В казне недостаточно средств. Нужно ${WAR_COST}💰.`);

  const targetGuild = await pool.query('SELECT * FROM guilds WHERE name=$1', [targetGuildName]);
  if (!targetGuild.rows.length) return send(ctx, `❌ Бригада «${targetGuildName}» не найдена.`);
  if (targetGuild.rows[0].id === p.guild_id) return send(ctx, '❌ Нельзя объявить войну своей бригаде.');

  await pool.query(`UPDATE guilds SET treasury=treasury-$1, last_war=$2 WHERE id=$3`, [WAR_COST, now, p.guild_id]);

  const warKey = `${p.guild_id}_${targetGuild.rows[0].id}`;
  activeWars.set(warKey, {
    guild1: p.guild_id,
    guild2: targetGuild.rows[0].id,
    points1: 0,
    points2: 0,
    startTime: now,
    endTime: now + WAR_DURATION
  });

  await pool.query(`UPDATE guilds SET war_points=0 WHERE id IN ($1,$2)`, [p.guild_id, targetGuild.rows[0].id]);

  const allPlayers = await pool.query(
    `SELECT user_id FROM players WHERE guild_id IN ($1,$2) AND banned=FALSE`,
    [p.guild_id, targetGuild.rows[0].id]
  );

  for (const pl of allPlayers.rows) {
    try {
      await vk.api.messages.send({
        user_id: pl.user_id,
        message: `⚔️ ВОЙНА КЛАНОВ!\nБригада «${myGuild.rows[0].name}» объявила войну бригаде «${targetGuildName}»!\n⏳ Длительность: 24 часа\nАтакуйте врагов: «Атаковать [ID]»`,
        random_id: Math.floor(Math.random() * 1e9),
      });
    } catch {}
  }

  await send(ctx,
    `⚔️ ВОЙНА ОБЪЯВЛЕНА!\n` +
    `Цель: бригада «${targetGuildName}»\n` +
    `⏳ Длительность: 24 часа\n` +
    `💰 Из казны списано: ${WAR_COST} монет\n\n` +
    `Атакуйте врагов: «Атаковать [ID]»`
  );

  setTimeout(async () => {
    await finishWar(warKey);
  }, WAR_DURATION);
}

async function cmdAttack(ctx, uid, targetIdStr) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  const targetId = parseInt(targetIdStr);
  if (!targetId) return send(ctx, '❌ Укажи ID врага: «Атаковать [ID]»');
  if (targetId === uid) return send(ctx, '❌ Нельзя атаковать самого себя.');

  if (!p.guild_id) return send(ctx, '❌ Ты не состоишь в бригаде.');

  const target = await getPlayer(targetId);
  if (!target) return send(ctx, `❌ Игрок #${targetId} не найден.`);
  if (!target.guild_id) return send(ctx, `❌ Игрок #${targetId} не состоит в бригаде.`);

  if (target.guild_id === p.guild_id)
    return send(ctx, '❌ Нельзя атаковать союзников!');

  let inWar = false;
  let warKey = null;
  let mySide = null;

  for (const [key, war] of activeWars) {
    const guilds = key.split('_');
    if (Date.now() < war.endTime) {
      if ((war.guild1 === p.guild_id && war.guild2 === target.guild_id) ||
          (war.guild2 === p.guild_id && war.guild1 === target.guild_id)) {
        inWar = true;
        warKey = key;
        mySide = war.guild1 === p.guild_id ? 'guild1' : 'guild2';
        break;
      }
    }
  }

  if (!inWar)
    return send(ctx, '❌ Сейчас нет активной войны с бригадой этого игрока.');

  const canAtk = await canAttack(uid, targetId);
  if (!canAtk.allowed) return send(ctx, `❌ ${canAtk.reason}`);

  const winner = Math.random() < 0.5 ? uid : targetId;
  const loser = winner === uid ? targetId : uid;
  
  const war = activeWars.get(warKey);
  if (mySide === 'guild1') {
    war.points1 += winner === uid ? 1 : 0;
    war.points2 += winner === targetId ? 1 : 0;
  } else {
    war.points2 += winner === uid ? 1 : 0;
    war.points1 += winner === targetId ? 1 : 0;
  }

  await recordAttack(uid, targetId);

  const loserEquipment = await getAvailableEquipment(loser);
  if (loserEquipment.length > 0) {
    const toBlock = loserEquipment[0];
    await pool.query(
      `INSERT INTO destroyed_equipment (owner_id, equipment_type, destroyed_at, repair_until) VALUES ($1,$2,$3,$4)`,
      [loser, toBlock.type, Date.now(), Date.now() + WAR_BLOCK_DURATION]
    );
  }

  await send(ctx,
    `⚔️ АТАКА!\n` +
    `Победитель: ${await getName(winner)}\n` +
    `Проигравший: ${await getName(loser)}\n` +
    `📊 Счёт войны: ${war.points1} - ${war.points2}\n` +
    `💥 Бур проигравшего заблокирован на ${fmtTime(WAR_BLOCK_DURATION)}`
  );
}

async function finishWar(warKey) {
  const war = activeWars.get(warKey);
  if (!war) return;

  const winnerGuildId = war.points1 > war.points2 ? war.guild1 : 
                         war.points2 > war.points1 ? war.guild2 : null;
  
  const guild1 = await pool.query('SELECT * FROM guilds WHERE id=$1', [war.guild1]);
  const guild2 = await pool.query('SELECT * FROM guilds WHERE id=$1', [war.guild2]);

  // ИСПРАВЛЕНИЕ 8: обработка ничьей
  if (!winnerGuildId || war.points1 === war.points2) {
    // Ничья — уведомляем обе стороны
    const allPlayers = await pool.query(
      `SELECT user_id FROM players WHERE guild_id IN ($1,$2) AND banned=FALSE`,
      [war.guild1, war.guild2]
    );
    for (const pl of allPlayers.rows) {
      try {
        await vk.api.messages.send({
          user_id: pl.user_id,
          message: `⚔️ ВОЙНА ЗАВЕРШЕНА ВНИЧЬЮ!\n📊 Счёт: ${war.points1} - ${war.points2}\nОбе бригады сохраняют свои ресурсы.`,
          random_id: Math.floor(Math.random() * 1e9),
        });
      } catch {}
    }
    await pool.query(`UPDATE guilds SET war_points=0 WHERE id IN ($1,$2)`, [war.guild1, war.guild2]);
    activeWars.delete(warKey);
    return;
  }

  const loserGuildId = winnerGuildId === war.guild1 ? war.guild2 : war.guild1;
  const loserGuild = winnerGuildId === war.guild1 ? guild2.rows[0] : guild1.rows[0];
  const winnerGuild = winnerGuildId === war.guild1 ? guild1.rows[0] : guild2.rows[0];
  
  // ИСПРАВЛЕНИЕ 9: защита от отрицательной казны
  const maxSteal = Math.floor(Number(loserGuild.treasury) * WAR_WIN_PCT);
  const stealAmount = Math.min(maxSteal, WAR_WIN_MAX, Number(loserGuild.treasury));

  if (stealAmount > 0) {
    await pool.query(`UPDATE guilds SET treasury=treasury-$1 WHERE id=$2`, [stealAmount, loserGuild.id]);
    await pool.query(`UPDATE guilds SET treasury=treasury+$1 WHERE id=$2`, [stealAmount, winnerGuild.id]);
  }

  neutralMineController = winnerGuild.id;
  neutralMineControlEnd = Date.now() + NEUTRAL_MINE_DURATION;

  const loserPlayers = await pool.query(`SELECT user_id FROM players WHERE guild_id=$1`, [loserGuild.id]);
  for (const pl of loserPlayers.rows) {
    try {
      await vk.api.messages.send({
        user_id: pl.user_id,
        message: `💔 Ваша бригада проиграла войну!\n📉 Штраф -${Math.round(WAR_LOSE_PENALTY_PCT * 100)}% к пассивному доходу на 24 часа.\n💰 Потеряно из казны: ${stealAmount} монет`,
        random_id: Math.floor(Math.random() * 1e9),
      });
    } catch {}
  }

  const winnerPlayers = await pool.query(`SELECT user_id FROM players WHERE guild_id=$1`, [winnerGuild.id]);
  for (const pl of winnerPlayers.rows) {
    try {
      await vk.api.messages.send({
        user_id: pl.user_id,
        message: `🎉 ПОБЕДА В ВОЙНЕ!\n🏰 Ваша бригада контролирует нейтральную шахту 3 дня (+20% к добыче)!\n💰 Захвачено из казны врага: ${stealAmount} монет`,
        random_id: Math.floor(Math.random() * 1e9),
      });
    } catch {}
  }

  await pool.query(`UPDATE guilds SET war_points=0 WHERE id IN ($1,$2)`, [war.guild1, war.guild2]);
  activeWars.delete(warKey);
}

async function cmdMineInfo(ctx) {
  const now = Date.now();
  if (!neutralMineController || neutralMineControlEnd <= now) {
    return send(ctx, '🏰 Нейтральная шахта свободна!\nЗахватите её, выиграв войну кланов.');
  }

  const guild = await pool.query('SELECT name FROM guilds WHERE id=$1', [neutralMineController]);
  const guildName = guild.rows[0]?.name || 'Неизвестно';

  await send(ctx,
    `🏰 НЕЙТРАЛЬНАЯ ШАХТА\n` +
    `👑 Контролирует: бригада «${guildName}»\n` +
    `📈 Бонус: +20% к добыче для всех членов бригады\n` +
    `⏳ Контроль до: ${fmtTime(neutralMineControlEnd - now)}`
  );
}

async function cmdPeace(ctx, uid) {
  const p = await getOrCreate(uid);
  if (p.banned) return send(ctx, '⛔ Вы заблокированы в игре и не можете использовать команды.');

  if (await isInPeaceMode(uid))
    return send(ctx, `🕊️ Ты уже в режиме мира! Защита активна.`);

  if (p.balance < PEACE_COST)
    return send(ctx, `❌ Недостаточно монет. Нужно ${PEACE_COST}💰.`);

  await pool.query(`UPDATE players SET balance=balance-$1 WHERE user_id=$2`, [PEACE_COST, uid]);
  peaceMode.set(uid, Date.now() + PEACE_DURATION);

  await send(ctx,
    `🕊️ РЕЖИМ МИРА АКТИВИРОВАН!\n` +
    `⏳ Защита на ${fmtTime(PEACE_DURATION)}\n` +
    `🛡️ Тебя нельзя атаковать\n` +
    `💰 Списано: ${PEACE_COST} монет`
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
    `• Крафт пластина — создать железную пластину\n` +
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
    `• Своровать — украсть монеты у топ-игрока (кд 4 ч, макс 100к)\n` +
    `• Своровать [ID] — украсть у конкретного из топ-5\n\n` +
    `🦠 МЕДИЦИНА:\n` +
    `• Лечить — вылечиться от вируса\n` +
    `• Лечить [ID] — вылечить другого (только врач)\n` +
    `• Вакцина — защита от вируса на 24 ч\n` +
    `• Статус — проверить здоровье\n` +
    `• Эпидемия — информация о вспышке\n\n` +
    `🛒 МАГАЗИН И РЫНОК:\n` +
    `• Магазин — список товаров\n` +
    `• Купить [товар] [кол-во] — купить предмет(ы)\n` +
    `• Инвентарь — посмотреть предметы\n` +
    `• Рынок — посмотреть лоты\n` +
    `• Продать на рынке [тип] [название] [кол-во] [цена] — выставить лот\n` +
    `  Типы: руда, предмет, бур, усиленный бур, алмазный бур, вышка\n` +
    `• Купить на рынке [ID] — купить лот\n\n` +
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
    `• Расформировать клан — распустить бригаду\n\n` +
    `⚔️ PvP:\n` +
    `• Бой [ID] [ставка] — вызвать на дуэль\n` +
    `• Принять бой — принять дуэль\n` +
    `• Рейд [бригада] — начать рейд (глава)\n` +
    `• Диверсия — диверсия при рейде (500💰)\n` +
    `• Ловушка — защита при рейде (300💰)\n` +
    `• Взорвать [ID] — показать оборудование врага\n` +
    `• Взорвать [ID] [номер] — взорвать оборудование\n` +
    `• Ремонт — починить всё сломанное\n` +
    `• Война [бригада] — объявить войну (глава)\n` +
    `• Атаковать [ID] — атаковать врага в войне\n` +
    `• Шахта — информация о нейтральной шахте\n` +
    `• Перемирие — режим мира на 12 часов (5000💰)\n\n` +
    `🔗 РЕФЕРАЛКА:\n` +
    `• Реферал — получить реферальную ссылку\n` +
    `• Приглашённый получает ${REFERRAL_REWARD_INVITED.toLocaleString()}💰, пригласивший ${REFERRAL_REWARD_INVITER.toLocaleString()}💰\n\n` +
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
    `• !показать — показать себя в топах\n` +
    `• !бан [ID] — забанить игрока\n` +
    `• !разбан [ID] — разбанить игрока\n` +
    `• !админ [ID] — назначить админа\n` +
    `• !снятьадмин [ID] — снять админа\n` +
    `• !обнулитьвсех — ⚠️ ПОЛНОСТЬЮ обнулить прогресс ВСЕХ игроков\n\n` +
    `🦠 ВИРУС:\n` +
    `• !вирус старт — запустить эпидемию\n` +
    `• !вирус стоп — остановить эпидемию\n` +
    `• !вылечить [ID] — вылечить игрока\n` +
    `• !защитить [ID] — дать вакцину\n` +
    `• !заразить [ID] — заразить игрока\n\n` +
    `🎟️ ПРОМОКОДЫ:\n` +
    `• !промо [код] [тип] [кол-во] [макс.активаций] — создать\n` +
    `• !деактивировать [код] — деактивировать\n` +
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
  
  if (!targetId || !itemName) {
    return send(ctx, '❌ Использование: !датьпредмет [ID] [предмет] [кол-во]');
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

  const info = await calcPassiveInfo(targetId);
  let passiveInfo = '';
  if (info.totalDrills > 0) passiveInfo += `\n⚙️ Обычные буры: ${info.activeDrills}/${info.totalDrills} шт.`;
  if (info.totalEnhanced > 0) passiveInfo += `\n🔩 Усиленные буры: ${info.activeEnhanced}/${info.totalEnhanced} шт.`;
  if (info.totalDiamond > 0) passiveInfo += `\n💎 Алмазные буры: ${info.activeDiamond}/${info.totalDiamond} шт.`;
  if (info.totalRigs > 0) passiveInfo += `\n🛢️ Вышки: ${info.activeRigs}/${info.totalRigs} шт.`;

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
    `⚔️ Боевой рейтинг: ${p.battle_rating}`,
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
  await send(ctx, `👻 Теперь ты скрыт из всех топов!`);
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
  await send(ctx, `⛔ Игрок ${name} (ID: ${targetId}) забанен!`);
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
  await send(ctx, `✅ Игрок ${name} (ID: ${targetId}) разбанен!`);
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

// ИСПРАВЛЕНИЕ 3: используем globalThis вместо global
async function cmdResetAll(ctx) {
  await send(ctx, '⚠️ ВНИМАНИЕ! Вы собираетесь полностью обнулить прогресс ВСЕХ игроков!\nЭто действие НЕОБРАТИМО.\n\nДля подтверждения напишите: !обнулитьвсех подтвердить');

  if (!globalThis.pendingResets) globalThis.pendingResets = new Set();
  globalThis.pendingResets.add(ctx.senderId);
}

async function cmdResetAllConfirm(ctx) {
  if (!globalThis.pendingResets || !globalThis.pendingResets.has(ctx.senderId)) {
    return send(ctx, '❌ Сначала используйте команду !обнулитьвсех для предупреждения.');
  }

  globalThis.pendingResets.delete(ctx.senderId);

  try {
    await pool.query(`
      UPDATE players SET
        balance = 0,
        stamina = 100,
        pickaxe_lvl = 1,
        drills = 0,
        oil_rigs = 0,
        drills_enhanced = 0,
        drills_diamond = 0,
        work_count = 0,
        craft_level = 1,
        battle_rating = 0,
        last_work = 0,
        last_rest = 0,
        last_drill = 0,
        last_oil = 0,
        last_black = 0,
        jail_until = 0,
        has_roof = FALSE,
        last_steal = 0,
        last_daily = 0,
        virus = 0,
        virus_end = 0,
        vaccine_end = 0
    `);

    await pool.query(`DELETE FROM inventory`);
    await pool.query(`DELETE FROM destroyed_equipment`);
    await pool.query(`DELETE FROM market_listings`);
    await pool.query(`UPDATE guilds SET treasury = 0, xp = 0, level = 1, war_points = 0`);
    await pool.query(`DELETE FROM chat_activity`);

    activeDuels.clear();
    activeRaids.clear();
    activeWars.clear();
    attackCounts.clear();
    peaceMode.clear();
    neutralMineController = null;
    neutralMineControlEnd = 0;

    globalEpidemic = false;
    epidemicEndTime = 0;

    await pool.query(`UPDATE players SET is_admin = TRUE WHERE user_id = $1`, [ADMIN_ID]);

    await send(ctx, '✅ Прогресс ВСЕХ игроков полностью обнулён!\n\nСброшено:\n💰 Баланс → 0\n⛏️ Кирка → ур. 1\n⚙️ Буры и вышки → 0\n🎒 Инвентарь → пуст\n🏦 Казны бригад → 0\n⚔️ Рейтинг и войны → сброшены\n🦠 Эпидемия → остановлена\n\nИгра началась заново!');

    const allPlayers = await pool.query(`SELECT user_id FROM players WHERE banned = FALSE`);
    for (const pl of allPlayers.rows) {
      try {
        await vk.api.messages.send({
          user_id: pl.user_id,
          message: `⚠️ Администратор полностью обнулил прогресс всех игроков!\nИгра началась заново. Напишите «Старт» для продолжения.`,
          random_id: Math.floor(Math.random() * 1e9),
        });
      } catch {}
    }

  } catch (err) {
    console.error('Ошибка при обнулении:', err);
    await send(ctx, '❌ Произошла ошибка при обнулении.');
  }
}

// ═══════════════════════════════════════════════════════════
//  АДМИН КОМАНДЫ ВИРУСА
// ═══════════════════════════════════════════════════════════

async function cmdAdminVirusStart(ctx) {
  if (globalEpidemic)
    return send(ctx, '🦠 Эпидемия уже активна!');
  
  await startEpidemic();
  await send(ctx, '🦠 Эпидемия запущена!');
}

async function cmdAdminVirusStop(ctx) {
  if (!globalEpidemic)
    return send(ctx, '✅ Эпидемия не активна.');
  
  await endEpidemic();
  await send(ctx, '✅ Эпидемия остановлена!');
}

async function cmdAdminHeal(ctx, targetIdStr) {
  const targetId = parseInt(targetIdStr);
  if (!targetId) return send(ctx, '❌ Укажи ID: !вылечить [ID]');
  
  await pool.query(
    `UPDATE players SET virus=0, virus_end=0, stamina=LEAST(stamina+30, 100) WHERE user_id=$1`,
    [targetId]
  );
  const name = await getName(targetId);
  await send(ctx, `✅ Игрок ${name} (ID: ${targetId}) вылечен!`);
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
  await send(ctx, `✅ Игрок ${name} (ID: ${targetId}) получил вакцину на 24 часа!`);
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

    // Проверяем реферальный код в первом сообщении
    if (ctx.messagePayload) {
      try {
        const payload = JSON.parse(ctx.messagePayload);
        if (payload.ref) {
          await processReferral(payload.ref, uid);
        }
      } catch {}
    }

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
      if (text === '!обнулитьвсех')          return cmdResetAll(ctx);
      if (text === '!обнулитьвсех подтвердить') return cmdResetAllConfirm(ctx);
      
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

    // PvP команды
    if (text.startsWith('бой ') || text.startsWith('дуэль ')) {
      const parts = text.split(/\s+/);
      const targetId = parseInt(parts[1]);
      const bet = parseInt(parts[2]);
      return cmdDuel(ctx, uid, targetId, bet);
    }

    if (text.startsWith('рейд '))
      return cmdRaid(ctx, uid, raw.slice('рейд '.length).trim());

    if (text.startsWith('война '))
      return cmdWar(ctx, uid, raw.slice('война '.length).trim());

    if (text.startsWith('атаковать '))
      return cmdAttack(ctx, uid, parseInt(text.slice('атаковать '.length).trim()));

    if (text.startsWith('взорвать ') && text.split(/\s+/).length === 2) {
      return cmdShowEquipment(ctx, uid, parseInt(text.slice('взорвать '.length).trim()));
    }

    if (text.startsWith('взорвать ') && text.split(/\s+/).length >= 3) {
      const parts = text.split(/\s+/);
      return cmdDestroy(ctx, uid, parseInt(parts[1]), parts[2]);
    }

    // Рынок
    if (text.startsWith('продать на рынке ')) {
      const parts = text.slice('продать на рынке '.length).trim().split(/\s+/);
      // parts может содержать составное название типа ("усиленный бур", "алмазный бур")
      let itemType = parts[0];
      let itemNameIdx = 1;
      
      if ((itemType === 'усиленный' || itemType === 'алмазный') && parts[1] === 'бур') {
        itemType = parts[0] + ' ' + parts[1];
        itemNameIdx = 2;
      }
      
      const itemName = parts[itemNameIdx];
      const quantity = parseInt(parts[itemNameIdx + 1]);
      const price = parseInt(parts[itemNameIdx + 2]);
      
      return cmdMarketSell(ctx, uid, itemType, itemName, quantity, price);
    }

    if (text.startsWith('купить на рынке '))
      return cmdMarketBuy(ctx, uid, parseInt(text.slice('купить на рынке '.length).trim()));

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

      // PvP
      case 'принять бой':         return cmdAcceptDuel(ctx, uid);
      case 'диверсия':            return cmdSabotage(ctx, uid);
      case 'ловушка':             return cmdTrap(ctx, uid);
      case 'ремонт':              return cmdRepair(ctx, uid);
      case 'шахта':               return cmdMineInfo(ctx);
      case 'перемирие':           return cmdPeace(ctx, uid);
      
      // Рефералка
      case 'реферал':
      case 'реферальная ссылка':
      case 'реф':                 return cmdReferral(ctx, uid);

      // Рынок
      case 'рынок':               return cmdMarketList(ctx);
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
    console.log('🤖 Бот Generational Miners запущен!');
    console.log('✅ Все функции активны: классы, крафт, вирусы, PvP, рынок, рефералка');
    console.log('⚔️ PvP механики: дуэли, рейды, снос, война кланов, нейтральная шахта');
    console.log('👑 Админ-команда !обнулитьвсех исправлена');
  } catch (err) {
    console.error('❌ Ошибка запуска:', err);
    process.exit(1);
  }
})();