'use strict';

const express = require('express');
const cors = require('cors');
const { VK } = require('vk-io');
const { Pool } = require('pg');

// ═══════════════════════════════════════════════════════════
//  КОНФИГУРАЦИЯ
// ═══════════════════════════════════════════════════════════
const TOKEN = 'vk1.a.oEh4QG6VgTIGThreYGF25K63gp8D4IQHr95d6pORny5SJMNs8jJCQ6Ql6BlZA1xi9iy9hPnzR-sfV4pRG8WQ9rerkV1hWSX3-kf1Mp2ivisprjLDAo5KVwt87GPaL2TmzznLyWT_YjfvtSfCPRMPxWKrNPAIMKntvlY-vwjxvhXH5s6ibgsS6I-tMpLqPfT82LFT6CTvxnaGhzX8AV119g';
const ADMIN_ID = 788158121;
const DB_URL = 'postgresql://neondb_owner:npg_v0XrEhzawWo5@ep-old-wildflower-aldp2klr-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require';
const PORT = process.env.PORT || 3000;

// ═══════════════════════════════════════════════════════════
//  КОНСТАНТЫ ИГРЫ
// ═══════════════════════════════════════════════════════════
const WORK_CD = 30 * 60 * 1000;
const REST_CD = 30 * 60 * 1000;
const BASE_INCOME = 100;
const STAMINA_PER_WORK = 20;
const MAX_STAMINA = 100;
const DRILL_COST = 2000;
const DRILL_INCOME = 50;
const OIL_COST = 5000;
const OIL_INCOME = 100;
const PASSIVE_CAP_HOURS = 24;
const GUILD_COST = 1000;

const BLACK_WORK_CD = 2 * 60 * 60 * 1000;
const BLACK_WORK_INCOME = 500;
const BLACK_CATCH_CHANCE = 0.30;
const BLACK_FINE = 1000;
const JAIL_DURATION = 60 * 60 * 1000;
const ROOF_COST = 3000;
const CONTRABAND_PRICE = 300;

const STEAL_CD = 4 * 60 * 60 * 1000;
const STEAL_CHANCE = 0.45;
const STEAL_MIN_PCT = 0.03;
const STEAL_MAX_PCT = 0.08;
const STEAL_MIN_BALANCE = 5000;
const STEAL_MAX_AMOUNT = 100000;

const TRANSFER_MIN = 10;

const EPIDEMIC_CHANCE = 0.15;
const EPIDEMIC_CHECK_INTERVAL = 60 * 60 * 1000;
const EPIDEMIC_DURATION = 3 * 60 * 60 * 1000;
const VIRUS_STAMINA_LOSS = 20;
const VIRUS_INCOME_PENALTY = 0.5;
const MEDKIT_COST = 300;
const VACCINE_COST = 1000;
const VACCINE_DURATION = 24 * 60 * 60 * 1000;
const ANTIBIOTIC_COST = 500;

const DUEL_DURATION = 3 * 60 * 1000;
const BLOCK_DURATION = 2 * 60 * 60 * 1000;
const RAID_COST = 10000;
const RAID_DURATION = 60 * 60 * 1000;
const RAID_COOLDOWN = 3 * 24 * 60 * 60 * 1000;
const SABOTAGE_COST = 500;
const SABOTAGE_DAMAGE = 1000;
const TRAP_COST = 300;
const RAID_MAX_STEAL_PCT = 0.15;
const RAID_MAX_STEAL = 50000;
const DESTROY_COST = 1000;
const DESTROY_RATING_REQ = 100;
const DESTROY_REPAIR_TIME = 6 * 60 * 60 * 1000;
const DESTROY_REPAIR_MULT = 1.5;
const WAR_COST = 20000;
const WAR_DURATION = 24 * 60 * 60 * 1000;
const WAR_COOLDOWN = 7 * 24 * 60 * 60 * 1000;
const WAR_BLOCK_DURATION = 3 * 60 * 60 * 1000;
const WAR_WIN_PCT = 0.10;
const WAR_WIN_MAX = 100000;
const WAR_LOSE_PENALTY_PCT = 0.10;
const WAR_LOSE_PENALTY_DUR = 24 * 60 * 60 * 1000;
const NEUTRAL_MINE_BONUS = 0.20;
const NEUTRAL_MINE_DURATION = 3 * 24 * 60 * 60 * 1000;
const MAX_ATTACKS_PER_DAY = 3;
const DESTROY_COOLDOWN = 24 * 60 * 60 * 1000;
const PROTECTION_LEVEL = 5;
const PROTECTION_BALANCE = 10000;
const PEACE_COST = 5000;
const PEACE_DURATION = 12 * 60 * 60 * 1000;

const REFERRAL_REWARD_INVITER = 20000;
const REFERRAL_REWARD_INVITED = 5000;

const CLASSES = {
  'шахтёр': { bonus: 'mine', desc: '+20% к добыче при работе' },
  'инженер': { bonus: 'drill', desc: 'Буры приносят на 25% больше' },
  'нефтяник': { bonus: 'oil', desc: 'Нефтяные вышки дают +30%' },
  'врач': { bonus: 'heal', desc: 'Может лечить других за половину стоимости аптечки' },
  'бригадир': { bonus: 'guild', desc: 'Бонус для всей бригады +10%' },
};

const DAILY_BONUS = {
  1: { type: 'coins', amount: 400, label: '400 монет' },
  2: { type: 'coins', amount: 450, label: '450 монет' },
  3: { type: 'coins', amount: 500, label: '500 монет' },
  4: { type: 'coins', amount: 400, label: '400 монет' },
  5: { type: 'coins', amount: 450, label: '450 монет' },
  6: { type: 'coins', amount: 500, label: '500 монет' },
  0: { type: 'drill', amount: 1, label: '1 бур' },
};

const PICKAXE = [
  { level: 1, bonus: 0, cost: 500 },
  { level: 2, bonus: 30, cost: 1500 },
  { level: 3, bonus: 60, cost: 3000 },
  { level: 4, bonus: 90, cost: 6000 },
  { level: 5, bonus: 120, cost: null },
];

const SHOP_ITEMS = {
  'еда': { cost: 200, desc: 'Восстанавливает 50 стамины' },
  'динамит': { cost: 500, desc: 'Удваивает добычу и руды за один спуск / +100% к чёрной работе' },
  'крыша': { cost: 3000, desc: 'Снижает шанс поимки при чёрной работе в 2 раза (постоянный эффект)' },
  'аптечка': { cost: 300, desc: 'Лечит от вируса и восстанавливает 30 стамины' },
  'вакцина': { cost: 1000, desc: 'Защищает от вируса на 24 часа' },
  'антибиотик': { cost: 500, desc: 'Ускоряет выздоровление от вируса в 2 раза' },
};

const ORES = {
  'уголь': { emoji: '🪨', price: 50, chance: [0.80, 0.80, 0.75, 0.70, 0.65], min: 1, max: 4 },
  'железо': { emoji: '⚙️', price: 150, chance: [0.35, 0.40, 0.50, 0.55, 0.60], min: 1, max: 3 },
  'алмаз': { emoji: '💎', price: 500, chance: [0.05, 0.10, 0.18, 0.28, 0.40], min: 1, max: 2 },
  'золото': { emoji: '🥇', price: 800, chance: [0.03, 0.07, 0.13, 0.22, 0.35], min: 1, max: 2 },
  'рубин': { emoji: '🔴', price: 1200, chance: [0.01, 0.03, 0.07, 0.14, 0.25], min: 1, max: 1 },
  'платина': { emoji: '🪙', price: 2000, chance: [0.00, 0.01, 0.03, 0.07, 0.15], min: 1, max: 1 },
};

const CRAFT_RESOURCES = {
  'железная_пластина': { emoji: '🔩', name: 'Железная пластина', chance: 0.15, min_lvl: 1 },
  'шестерня': { emoji: '⚙️', name: 'Шестерня', chance: 0.10, min_lvl: 2 },
  'алмазный_наконечник': { emoji: '💎', name: 'Алмазный наконечник', chance: 0.05, min_lvl: 3 },
  'магнит': { emoji: '🧲', name: 'Магнитный стабилизатор', chance: 0.02, min_lvl: 4 },
  'смазка': { emoji: '🧪', name: 'Смазка', chance: 0.20, min_lvl: 1 },
};

const CRAFT_RECIPES = {
  'пластина': {
    name: 'Железная пластина', emoji: '🔩', result_type: 'craft_resource',
    result_item: 'железная_пластина', result_amount: 1,
    ingredients: { 'железо': 3, 'уголь': 2 }, coins_cost: 100,
    desc: '3 железной руды + 2 угля → 1 пластина',
  },
  'бур_обычный': {
    name: 'Обычный бур', emoji: '⚙️', result_type: 'drill', result_amount: 1,
    drill_income: 50, ingredients: { 'железо': 10, 'уголь': 5 }, coins_cost: 500,
    desc: '+50💰/час',
  },
  'бур_усиленный': {
    name: 'Усиленный бур', emoji: '🔩', result_type: 'drill_enhanced', result_amount: 1,
    drill_income: 100,
    ingredients: { 'железная_пластина': 5, 'шестерня': 3, 'смазка': 1 },
    coins_cost: 1000, desc: '+100💰/час',
  },
  'бур_алмазный': {
    name: 'Алмазный бур', emoji: '💎', result_type: 'drill_diamond', result_amount: 1,
    drill_income: 250,
    ingredients: { 'алмазный_наконечник': 2, 'магнит': 1 },
    coins_cost: 3000, desc: '+250💰/час',
  },
  'вышка_нефтяная': {
    name: 'Нефтяная вышка', emoji: '🛢️', result_type: 'oil_rig', result_amount: 1,
    oil_income: 150,
    ingredients: { 'железо': 20, 'шестерня': 10, 'смазка': 5 },
    coins_cost: 2500, desc: '+150💰/час',
  },
  'шестерня_крафт': {
    name: 'Шестерня (из железа)', emoji: '⚙️', result_type: 'craft_resource',
    result_item: 'шестерня', result_amount: 1,
    ingredients: { 'железо': 5 }, coins_cost: 200,
    desc: '5 железной руды → 1 шестерня',
  },
  'алмазный_наконечник_крафт': {
    name: 'Алмазный наконечник', emoji: '💎', result_type: 'craft_resource',
    result_item: 'алмазный_наконечник', result_amount: 1,
    ingredients: { 'алмаз': 3, 'железная_пластина': 2 },
    coins_cost: 500, desc: '3 алмаза + 2 пластины → 1 наконечник',
  },
  'магнит_крафт': {
    name: 'Магнитный стабилизатор', emoji: '🧲', result_type: 'craft_resource',
    result_item: 'магнит', result_amount: 1,
    ingredients: { 'золото': 5, 'рубин': 2 },
    coins_cost: 1000, desc: '5 золота + 2 рубина → 1 магнит',
  },
};

// ═══════════════════════════════════════════════════════════
//  ИНИЦИАЛИЗАЦИЯ
// ═══════════════════════════════════════════════════════════
const app = express();
app.use(cors());
app.use(express.json());

const vk = new VK({ token: TOKEN });

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 60_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => console.error('pg pool error:', err.message));

let globalEpidemic = false;
let epidemicEndTime = 0;
const activeDuels = new Map();
const activeRaids = new Map();
const activeWars = new Map();
const attackCounts = new Map();
const peaceMode = new Map();
let neutralMineController = null;
let neutralMineControlEnd = 0;
globalThis.infoAccess = globalThis.infoAccess || new Map();

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
      user_id BIGINT PRIMARY KEY, balance BIGINT DEFAULT 0, stamina INT DEFAULT 100,
      pickaxe_lvl INT DEFAULT 1, drills INT DEFAULT 0, oil_rigs INT DEFAULT 0,
      last_work BIGINT DEFAULT 0, last_rest BIGINT DEFAULT 0,
      last_drill BIGINT DEFAULT 0, last_oil BIGINT DEFAULT 0,
      guild_id INT DEFAULT NULL, last_black BIGINT DEFAULT 0,
      jail_until BIGINT DEFAULT 0, has_roof BOOLEAN DEFAULT FALSE,
      last_steal BIGINT DEFAULT 0, last_daily BIGINT DEFAULT 0,
      hidden BOOLEAN DEFAULT FALSE, banned BOOLEAN DEFAULT FALSE,
      virus INT DEFAULT 0, virus_end BIGINT DEFAULT 0,
      vaccine_end BIGINT DEFAULT 0, player_class VARCHAR(32) DEFAULT NULL,
      is_admin BOOLEAN DEFAULT FALSE, work_count INT DEFAULT 0,
      craft_level INT DEFAULT 1, drills_enhanced INT DEFAULT 0,
      drills_diamond INT DEFAULT 0, battle_rating INT DEFAULT 0,
      referral_code VARCHAR(16) UNIQUE, referred_by BIGINT DEFAULT NULL
    );
    CREATE TABLE IF NOT EXISTS guilds (
      id SERIAL PRIMARY KEY, name VARCHAR(64) UNIQUE NOT NULL,
      owner_id BIGINT NOT NULL, treasury BIGINT DEFAULT 0,
      level INT DEFAULT 1, xp INT DEFAULT 0, war_points INT DEFAULT 0,
      last_raid BIGINT DEFAULT 0, last_war BIGINT DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS guild_invites (
      user_id BIGINT PRIMARY KEY, guild_id INT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS inventory (
      user_id BIGINT, item VARCHAR(32), quantity INT DEFAULT 0,
      PRIMARY KEY (user_id, item)
    );
    CREATE TABLE IF NOT EXISTS promo_codes (
      code VARCHAR(64) PRIMARY KEY, reward_type VARCHAR(16) NOT NULL,
      reward_amount INT NOT NULL, max_uses INT DEFAULT 1,
      uses INT DEFAULT 0, created_by BIGINT NOT NULL, active BOOLEAN DEFAULT TRUE
    );
    CREATE TABLE IF NOT EXISTS promo_uses (
      user_id BIGINT, code VARCHAR(64), PRIMARY KEY (user_id, code)
    );
    CREATE TABLE IF NOT EXISTS chat_activity (
      chat_id BIGINT, user_id BIGINT, work_count INT DEFAULT 0,
      last_work BIGINT DEFAULT 0, PRIMARY KEY (chat_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS market_listings (
      id SERIAL PRIMARY KEY, seller_id BIGINT NOT NULL,
      item_type VARCHAR(32) NOT NULL, item_name VARCHAR(64) NOT NULL,
      quantity INT NOT NULL, price BIGINT NOT NULL,
      listed_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
    );
    CREATE TABLE IF NOT EXISTS destroyed_equipment (
      owner_id BIGINT NOT NULL, equipment_type VARCHAR(32) NOT NULL,
      destroyed_at BIGINT NOT NULL, repair_until BIGINT NOT NULL
    );
  `);

  // Обновление колонок
  const cols = ['stamina', 'pickaxe_lvl', 'drills', 'oil_rigs', 'last_work', 'last_rest',
    'last_drill', 'last_oil', 'guild_id', 'last_black', 'jail_until', 'has_roof',
    'last_steal', 'last_daily', 'hidden', 'banned', 'virus', 'virus_end', 'vaccine_end',
    'player_class', 'is_admin', 'work_count', 'craft_level', 'drills_enhanced',
    'drills_diamond', 'battle_rating', 'referral_code', 'referred_by'];
  
  for (const col of cols) {
    try {
      await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS ${col} ${getColType(col)}`);
    } catch (e) { /* колонка уже существует */ }
  }

  await pool.query(`UPDATE players SET is_admin = TRUE WHERE user_id = $1`, [ADMIN_ID]);
  console.log('✅ База данных готова');
}

function getColType(col) {
  const types = {
    'balance': 'BIGINT DEFAULT 0', 'stamina': 'INT DEFAULT 100',
    'pickaxe_lvl': 'INT DEFAULT 1', 'drills': 'INT DEFAULT 0',
    'oil_rigs': 'INT DEFAULT 0', 'guild_id': 'INT DEFAULT NULL',
    'has_roof': 'BOOLEAN DEFAULT FALSE', 'hidden': 'BOOLEAN DEFAULT FALSE',
    'banned': 'BOOLEAN DEFAULT FALSE', 'virus': 'INT DEFAULT 0',
    'player_class': 'VARCHAR(32) DEFAULT NULL', 'is_admin': 'BOOLEAN DEFAULT FALSE',
    'work_count': 'INT DEFAULT 0', 'craft_level': 'INT DEFAULT 1',
    'drills_enhanced': 'INT DEFAULT 0', 'drills_diamond': 'INT DEFAULT 0',
    'battle_rating': 'INT DEFAULT 0', 'referral_code': 'VARCHAR(16) UNIQUE',
    'referred_by': 'BIGINT DEFAULT NULL',
  };
  return types[col] || 'BIGINT DEFAULT 0';
}

// ═══════════════════════════════════════════════════════════
//  ХЕЛПЕРЫ
// ═══════════════════════════════════════════════════════════
function sanitize(p) {
  p.balance = Number(p.balance ?? 0);
  p.stamina = Number(p.stamina ?? 100);
  p.pickaxe_lvl = Number(p.pickaxe_lvl ?? 1);
  p.drills = Number(p.drills ?? 0);
  p.oil_rigs = Number(p.oil_rigs ?? 0);
  p.last_work = Number(p.last_work ?? 0);
  p.last_rest = Number(p.last_rest ?? 0);
  p.last_drill = Number(p.last_drill ?? 0);
  p.last_oil = Number(p.last_oil ?? 0);
  p.last_black = Number(p.last_black ?? 0);
  p.jail_until = Number(p.jail_until ?? 0);
  p.has_roof = Boolean(p.has_roof ?? false);
  p.last_steal = Number(p.last_steal ?? 0);
  p.last_daily = Number(p.last_daily ?? 0);
  p.guild_id = p.guild_id ? Number(p.guild_id) : null;
  p.hidden = Boolean(p.hidden ?? false);
  p.banned = Boolean(p.banned ?? false);
  p.virus = Number(p.virus ?? 0);
  p.virus_end = Number(p.virus_end ?? 0);
  p.vaccine_end = Number(p.vaccine_end ?? 0);
  p.player_class = p.player_class || null;
  p.is_admin = Boolean(p.is_admin ?? false);
  p.work_count = Number(p.work_count ?? 0);
  p.craft_level = Number(p.craft_level ?? 1);
  p.drills_enhanced = Number(p.drills_enhanced ?? 0);
  p.drills_diamond = Number(p.drills_diamond ?? 0);
  p.battle_rating = Number(p.battle_rating ?? 0);
  p.referred_by = p.referred_by ? Number(p.referred_by) : null;
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
      last_work, last_rest, last_drill, last_oil, last_black, jail_until, has_roof,
      last_steal, last_daily, hidden, banned, virus, virus_end, vaccine_end,
      player_class, is_admin, work_count, craft_level, drills_enhanced,
      drills_diamond, battle_rating, referral_code)
    VALUES ($1,0,100,1,0,0,0,0,0,0,0,0,FALSE,0,0,FALSE,FALSE,0,0,0,NULL,FALSE,0,1,0,0,0,$2)
    ON CONFLICT DO NOTHING
  `, [uid, refCode]);
  return getPlayer(uid);
}

function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

async function getName(uid) {
  try {
    const r = await vk.api.users.get({ user_ids: String(uid) });
    if (r && r[0]) return `${r[0].first_name} ${r[0].last_name}`;
  } catch {}
  return `Игрок #${uid}`;
}

function fmtTime(ms) {
  if (ms <= 0) return '0 сек';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h} ч ${m} мин`;
  if (m > 0) return `${m} мин ${s} сек`;
  return `${s} сек`;
}

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function addItem(uid, item, qty) {
  await pool.query(
    `INSERT INTO inventory(user_id,item,quantity) VALUES($1,$2,$3) ON CONFLICT(user_id,item) DO UPDATE SET quantity=inventory.quantity+$3`,
    [uid, item, qty]
  );
}

async function getItemQty(uid, item) {
  const r = await pool.query('SELECT quantity FROM inventory WHERE user_id=$1 AND item=$2', [uid, item]);
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
    case 'mine': return p.player_class === 'шахтёр' ? 0.20 : 0;
    case 'drill': return p.player_class === 'инженер' ? 0.25 : 0;
    case 'oil': return p.player_class === 'нефтяник' ? 0.30 : 0;
    case 'heal': return p.player_class === 'врач' ? 0.50 : 0;
    case 'guild': return p.player_class === 'бригадир' ? 0.10 : 0;
    case 'craft': return p.player_class === 'инженер' ? 0.15 : 0;
    default: return 0;
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

async function getDestroyedCount(uid, equipType) {
  const now = Date.now();
  const destroyed = await pool.query(
    `SELECT COUNT(*) as cnt FROM destroyed_equipment WHERE owner_id=$1 AND equipment_type=$2 AND repair_until > $3`,
    [uid, equipType, now]
  );
  return Number(destroyed.rows[0]?.cnt || 0);
}

async function getAvailableEquipment(uid) {
  const p = await getPlayer(uid);
  const equipment = [];
  if (p.drills > 0) {
    const dc = await getDestroyedCount(uid, 'drill');
    const av = p.drills - dc;
    if (av > 0) equipment.push({ type: 'drill', name: 'Обычный бур', available: av });
  }
  if (p.drills_enhanced > 0) {
    const dc = await getDestroyedCount(uid, 'drill_enhanced');
    const av = p.drills_enhanced - dc;
    if (av > 0) equipment.push({ type: 'drill_enhanced', name: 'Усиленный бур', available: av });
  }
  if (p.drills_diamond > 0) {
    const dc = await getDestroyedCount(uid, 'drill_diamond');
    const av = p.drills_diamond - dc;
    if (av > 0) equipment.push({ type: 'drill_diamond', name: 'Алмазный бур', available: av });
  }
  if (p.oil_rigs > 0) {
    const dc = await getDestroyedCount(uid, 'oil_rig');
    const av = p.oil_rigs - dc;
    if (av > 0) equipment.push({ type: 'oil_rig', name: 'Нефтяная вышка', available: av });
  }
  return equipment;
}

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
  const drillHours = Math.min((now - p.last_drill) / 3600000, PASSIVE_CAP_HOURS);
  const oilHours = Math.min((now - p.last_oil) / 3600000, PASSIVE_CAP_HOURS);
  let drillPending = 0, oilPending = 0, drillIPH = 0, oilIPH = 0;
  if (activeDrills > 0) {
    let inc = engineerBonus > 0 ? Math.floor(DRILL_INCOME * (1 + engineerBonus)) : DRILL_INCOME;
    drillIPH += inc * activeDrills;
    drillPending += Math.floor(drillHours * inc * activeDrills);
  }
  if (activeEnhanced > 0) {
    let inc = engineerBonus > 0 ? Math.floor(100 * (1 + engineerBonus)) : 100;
    drillIPH += inc * activeEnhanced;
    drillPending += Math.floor(drillHours * inc * activeEnhanced);
  }
  if (activeDiamond > 0) {
    let inc = engineerBonus > 0 ? Math.floor(250 * (1 + engineerBonus)) : 250;
    drillIPH += inc * activeDiamond;
    drillPending += Math.floor(drillHours * inc * activeDiamond);
  }
  if (activeRigs > 0) {
    let inc = oilBonus > 0 ? Math.floor(OIL_INCOME * 1.30) : OIL_INCOME;
    oilIPH = inc * activeRigs;
    oilPending = Math.floor(oilHours * inc * activeRigs);
  }
  if (globalEpidemic && p.virus !== 2) {
    drillPending = Math.floor(drillPending * (1 - VIRUS_INCOME_PENALTY));
    oilPending = Math.floor(oilPending * (1 - VIRUS_INCOME_PENALTY));
  }
  return { activeDrills, activeEnhanced, activeDiamond, activeRigs, drillIncomePerHour: drillIPH, drillPending, oilIncomePerHour: oilIPH, oilPending, totalDrills: p.drills, totalEnhanced: p.drills_enhanced, totalDiamond: p.drills_diamond, totalRigs: p.oil_rigs, engineerBonus, oilBonus };
}

async function hasInfoAccess(uid) {
  const access = globalThis.infoAccess.get(uid);
  if (access && access > Date.now()) return true;
  if (access && access <= Date.now()) {
    globalThis.infoAccess.delete(uid);
    return false;
  }
  return false;
}

async function getGuildHP(guildId) {
  const gr = await pool.query('SELECT level FROM guilds WHERE id=$1', [guildId]);
  if (!gr.rows[0]) return 0;
  const level = Number(gr.rows[0].level);
  const members = await pool.query('SELECT COUNT(*) as cnt FROM players WHERE guild_id=$1', [guildId]);
  const memberCount = Number(members.rows[0]?.cnt || 0);
  return level * 1000 + memberCount * 100;
}

// ═══════════════════════════════════════════════════════════
//  API ДЛЯ MINI APP
// ═══════════════════════════════════════════════════════════

// Получить данные игрока
app.get('/api/player/:uid', async (req, res) => {
  try {
    const uid = parseInt(req.params.uid);
    const p = await getOrCreate(uid);
    updateVirusStatus(p);
    const info = await calcPassiveInfo(uid);
    const oreInfo = {};
    for (const [oreName, ore] of Object.entries(ORES)) {
      oreInfo[oreName] = await getItemQty(uid, oreName);
    }
    res.json({ success: true, player: p, passive: info, ores: oreInfo });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Профиль
app.get('/api/profile/:uid', async (req, res) => {
  try {
    const uid = parseInt(req.params.uid);
    const p = await getOrCreate(uid);
    updateVirusStatus(p);
    const name = await getName(uid);
    const pick = PICKAXE.find(l => l.level === p.pickaxe_lvl) || PICKAXE[0];
    const info = await calcPassiveInfo(uid);
    let guildName = 'Нет';
    if (p.guild_id) {
      const gr = await pool.query('SELECT name FROM guilds WHERE id=$1', [p.guild_id]);
      if (gr.rows[0]) guildName = gr.rows[0].name;
    }
    const now = Date.now();
    const workLeft = WORK_CD - (now - p.last_work);
    const isPeace = await isInPeaceMode(uid);
    res.json({
      success: true,
      name, uid, balance: p.balance, stamina: p.stamina, maxStamina: MAX_STAMINA,
      pickaxeLvl: p.pickaxe_lvl, pickaxeBonus: pick.bonus,
      battleRating: p.battle_rating, playerClass: p.player_class,
      isAdmin: p.is_admin, workCd: workLeft > 0 ? workLeft : 0,
      passive: info, guildName, craftLevel: p.craft_level,
      workCount: p.work_count, hasRoof: p.has_roof,
      jailUntil: p.jail_until, virus: p.virus, virusEnd: p.virus_end,
      vaccineEnd: p.vaccine_end, isPeace, globalEpidemic,
      epidemicEndTime
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Работа
app.post('/api/work', async (req, res) => {
  try {
    const { uid } = req.body;
    const p = await getOrCreate(uid);
    if (p.banned) return res.json({ success: false, error: 'Вы заблокированы' });
    const now = Date.now();
    updateVirusStatus(p);
    if (p.jail_until > now) return res.json({ success: false, error: 'Вы в тюрьме! ' + fmtTime(p.jail_until - now) });
    if (p.virus === 1 && p.virus_end > now) return res.json({ success: false, error: 'Вы больны вирусом!' });
    const left = WORK_CD - (now - p.last_work);
    if (left > 0) return res.json({ success: false, error: 'Устали! Следующий спуск через ' + fmtTime(left) });
    if (p.stamina < STAMINA_PER_WORK) return res.json({ success: false, error: 'Нет сил! Стамина: ' + p.stamina + '/' + MAX_STAMINA });
    const pick = PICKAXE.find(l => l.level === p.pickaxe_lvl) || PICKAXE[0];
    let income = Math.floor(BASE_INCOME * (1 + pick.bonus / 100));
    const mineBonus = getClassBonus(p, 'mine');
    if (mineBonus > 0) income = Math.floor(income * (1 + mineBonus));
    const dynQty = await getItemQty(uid, 'динамит');
    const hasDyn = dynQty > 0;
    if (hasDyn) { income *= 2; await removeItem(uid, 'динамит', 1); }
    let guildBonus = 0;
    if (p.guild_id) {
      const gr = await pool.query('SELECT level FROM guilds WHERE id=$1', [p.guild_id]);
      if (gr.rows[0]) {
        guildBonus = Number(gr.rows[0].level) * 5;
        const brigadir = await pool.query(`SELECT user_id FROM players WHERE guild_id=$1 AND player_class='бригадир' LIMIT 1`, [p.guild_id]);
        if (brigadir.rows.length > 0) guildBonus += 10;
        income = Math.floor(income * (1 + guildBonus / 100));
      }
    }
    if (neutralMineController && neutralMineControlEnd > now && p.guild_id === neutralMineController)
      income = Math.floor(income * (1 + NEUTRAL_MINE_BONUS));
    if (globalEpidemic && p.virus !== 2) income = Math.floor(income * (1 - VIRUS_INCOME_PENALTY));
    const newSt = p.stamina - STAMINA_PER_WORK;
    await pool.query(`UPDATE players SET balance=balance+$1, stamina=$2, last_work=$3, work_count=work_count+1, battle_rating=battle_rating+1 WHERE user_id=$4`, [income, newSt, now, uid]);
    const lvlIdx = Math.max(0, Math.min((p.pickaxe_lvl || 1) - 1, 4));
    const oreLines = [];
    for (const [oreName, ore] of Object.entries(ORES)) {
      if (ore.chance[lvlIdx] !== undefined && Math.random() < ore.chance[lvlIdx]) {
        let qty = randInt(ore.min, ore.max);
        if (hasDyn) qty *= 2;
        await addItem(uid, oreName, qty);
        oreLines.push({ emoji: ore.emoji, name: oreName, qty });
      }
    }
    const craftLines = [];
    for (const [resKey, res] of Object.entries(CRAFT_RESOURCES)) {
      if (p.pickaxe_lvl >= res.min_lvl && Math.random() < res.chance) {
        let qty = 1;
        if (hasDyn) qty = randInt(1, 2);
        await addItem(uid, resKey, qty);
        craftLines.push({ emoji: res.emoji, name: res.name, qty });
      }
    }
    res.json({
      success: true, income, newStamina: newSt, maxStamina: MAX_STAMINA,
      hasDyn, mineBonus: mineBonus > 0, guildBonus, ores: oreLines,
      craftResources: craftLines, workCount: p.work_count + 1,
      battleRating: p.battle_rating + 1
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Отдых
app.post('/api/rest', async (req, res) => {
  try {
    const { uid } = req.body;
    const p = await getOrCreate(uid);
    const now = Date.now();
    const left = REST_CD - (now - p.last_rest);
    if (left > 0) return res.json({ success: false, error: 'Следующий отдых через ' + fmtTime(left) });
    const gained = MAX_STAMINA - p.stamina;
    await pool.query(`UPDATE players SET stamina=$1, last_rest=$2 WHERE user_id=$3`, [MAX_STAMINA, now, uid]);
    res.json({ success: true, gained, stamina: MAX_STAMINA, maxStamina: MAX_STAMINA });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Топ игроков
app.get('/api/top', async (req, res) => {
  try {
    const result = await pool.query(`SELECT user_id, balance FROM players WHERE hidden=FALSE AND banned=FALSE ORDER BY balance DESC LIMIT 10`);
    const top = [];
    for (const r of result.rows) {
      top.push({ uid: Number(r.user_id), name: await getName(r.user_id), balance: Number(r.balance) });
    }
    res.json({ success: true, top });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Топ кланов
app.get('/api/guild-top', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT g.id, g.name, g.level, g.treasury, g.xp, g.owner_id,
        COUNT(p.user_id) as members_count,
        COALESCE(SUM(p.balance), 0) as total_wealth
      FROM guilds g LEFT JOIN players p ON p.guild_id = g.id AND p.banned = FALSE
      GROUP BY g.id ORDER BY g.level DESC, g.xp DESC LIMIT 10
    `);
    const top = [];
    for (const r of result.rows) {
      top.push({
        id: r.id, name: r.name, level: Number(r.level),
        treasury: Number(r.treasury), xp: Number(r.xp),
        ownerName: await getName(Number(r.owner_id)),
        members: Number(r.members_count),
        totalWealth: Number(r.total_wealth),
        hp: await getGuildHP(r.id)
      });
    }
    res.json({ success: true, top });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Инвентарь
app.get('/api/inventory/:uid', async (req, res) => {
  try {
    const uid = parseInt(req.params.uid);
    const result = await pool.query('SELECT item, quantity FROM inventory WHERE user_id=$1 AND quantity>0 ORDER BY item', [uid]);
    res.json({ success: true, items: result.rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Продать руду
app.post('/api/sell', async (req, res) => {
  try {
    const { uid, oreName } = req.body;
    if (oreName === 'всё' || oreName === 'все') {
      let total = 0;
      const parts = [];
      for (const [name, ore] of Object.entries(ORES)) {
        const qty = await getItemQty(uid, name);
        if (qty > 0) {
          total += qty * ore.price;
          await pool.query(`UPDATE inventory SET quantity=0 WHERE user_id=$1 AND item=$2`, [uid, name]);
          parts.push(`${ore.emoji} ${name} x${qty} = ${qty * ore.price}`);
        }
      }
      if (total === 0) return res.json({ success: false, error: 'Нечего продавать' });
      await pool.query(`UPDATE players SET balance=balance+$1 WHERE user_id=$2`, [total, uid]);
      return res.json({ success: true, total, parts });
    }
    const ore = ORES[oreName];
    if (!ore) return res.json({ success: false, error: 'Руда не найдена' });
    const qty = await getItemQty(uid, oreName);
    if (qty <= 0) return res.json({ success: false, error: 'Нет такой руды' });
    const sum = qty * ore.price;
    await pool.query(`UPDATE inventory SET quantity=0 WHERE user_id=$1 AND item=$2`, [uid, oreName]);
    await pool.query(`UPDATE players SET balance=balance+$1 WHERE user_id=$2`, [sum, uid]);
    res.json({ success: true, oreName, qty, price: ore.price, sum, emoji: ore.emoji });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Купить кирку
app.post('/api/pickaxe', async (req, res) => {
  try {
    const { uid } = req.body;
    const p = await getOrCreate(uid);
    const cur = PICKAXE.find(l => l.level === p.pickaxe_lvl);
    if (!cur || cur.cost === null) return res.json({ success: false, error: 'Максимальный уровень!' });
    if (p.balance < cur.cost) return res.json({ success: false, error: 'Не хватает монет. Нужно: ' + cur.cost });
    await pool.query(`UPDATE players SET balance=balance-$1, pickaxe_lvl=pickaxe_lvl+1 WHERE user_id=$2`, [cur.cost, uid]);
    const next = PICKAXE.find(l => l.level === cur.level + 1) || PICKAXE[PICKAXE.length - 1];
    res.json({ success: true, newLevel: cur.level + 1, bonus: next.bonus, cost: cur.cost });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Купить буры
app.post('/api/buy-drill', async (req, res) => {
  try {
    const { uid, qty } = req.body;
    const p = await getOrCreate(uid);
    const totalCost = DRILL_COST * (qty || 1);
    if (p.balance < totalCost) return res.json({ success: false, error: 'Не хватает монет. Нужно: ' + totalCost });
    const now = Date.now();
    let pending = 0;
    if (p.drills > 0) {
      const hours = Math.min((now - p.last_drill) / 3600000, PASSIVE_CAP_HOURS);
      pending = Math.floor(hours * DRILL_INCOME * p.drills);
    }
    await pool.query(`UPDATE players SET balance=balance-$1+$2, drills=drills+$3, last_drill=$4 WHERE user_id=$5`, [totalCost, pending, qty || 1, now, uid]);
    res.json({ success: true, totalDrills: p.drills + (qty || 1), pending, cost: totalCost });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Купить вышки
app.post('/api/buy-oil', async (req, res) => {
  try {
    const { uid, qty } = req.body;
    const p = await getOrCreate(uid);
    const totalCost = OIL_COST * (qty || 1);
    if (p.balance < totalCost) return res.json({ success: false, error: 'Не хватает монет. Нужно: ' + totalCost });
    const now = Date.now();
    let pending = 0;
    if (p.oil_rigs > 0) {
      const hours = Math.min((now - p.last_oil) / 3600000, PASSIVE_CAP_HOURS);
      pending = Math.floor(hours * OIL_INCOME * p.oil_rigs);
    }
    await pool.query(`UPDATE players SET balance=balance-$1+$2, oil_rigs=oil_rigs+$3, last_oil=$4 WHERE user_id=$5`, [totalCost, pending, qty || 1, now, uid]);
    res.json({ success: true, totalRigs: p.oil_rigs + (qty || 1), pending, cost: totalCost });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Собрать доход с буров
app.post('/api/collect-drills', async (req, res) => {
  try {
    const { uid } = req.body;
    const p = await getOrCreate(uid);
    const info = await calcPassiveInfo(uid);
    if (info.drillPending <= 0) return res.json({ success: false, error: 'Пока нечего собирать' });
    await pool.query(`UPDATE players SET balance=balance+$1, last_drill=$2 WHERE user_id=$3`, [info.drillPending, Date.now(), uid]);
    res.json({ success: true, earned: info.drillPending });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Собрать доход с вышек
app.post('/api/collect-oil', async (req, res) => {
  try {
    const { uid } = req.body;
    const p = await getOrCreate(uid);
    const info = await calcPassiveInfo(uid);
    if (info.oilPending <= 0) return res.json({ success: false, error: 'Пока нечего собирать' });
    await pool.query(`UPDATE players SET balance=balance+$1, last_oil=$2 WHERE user_id=$3`, [info.oilPending, Date.now(), uid]);
    res.json({ success: true, earned: info.oilPending });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Магазин - список
app.get('/api/shop', (req, res) => {
  res.json({ success: true, items: SHOP_ITEMS, ores: ORES, pickaxe: PICKAXE, drillCost: DRILL_COST, oilCost: OIL_COST });
});

// Купить предмет
app.post('/api/buy-item', async (req, res) => {
  try {
    const { uid, item, qty } = req.body;
    const p = await getOrCreate(uid);
    const shopItem = SHOP_ITEMS[item];
    if (!shopItem) return res.json({ success: false, error: 'Товар не найден' });
    const totalCost = shopItem.cost * (qty || 1);
    if (p.balance < totalCost) return res.json({ success: false, error: 'Не хватает монет' });
    if (item === 'крыша') {
      if (p.has_roof) return res.json({ success: false, error: 'Уже есть крыша' });
      await pool.query(`UPDATE players SET balance=balance-$1, has_roof=TRUE WHERE user_id=$2`, [shopItem.cost, uid]);
      return res.json({ success: true, item: 'крыша' });
    }
    if (item === 'вакцина') {
      const vaccineEnd = Date.now() + VACCINE_DURATION;
      await pool.query(`UPDATE players SET balance=balance-$1, virus=2, vaccine_end=$2, virus_end=0 WHERE user_id=$3`, [shopItem.cost, vaccineEnd, uid]);
      return res.json({ success: true, item: 'вакцина', vaccineEnd });
    }
    if (item === 'аптечка') {
      const newStamina = Math.min(MAX_STAMINA, p.stamina + 30);
      await pool.query(`UPDATE players SET balance=balance-$1, virus=0, virus_end=0, stamina=$2 WHERE user_id=$3`, [shopItem.cost, newStamina, uid]);
      return res.json({ success: true, item: 'аптечка', stamina: newStamina });
    }
    if (item === 'антибиотик') {
      if (p.virus !== 1 || p.virus_end <= Date.now()) return res.json({ success: false, error: 'Вы не больны' });
      const remaining = p.virus_end - Date.now();
      const newEnd = Date.now() + Math.floor(remaining / 2);
      await pool.query(`UPDATE players SET balance=balance-$1, virus_end=$2 WHERE user_id=$3`, [shopItem.cost, newEnd, uid]);
      return res.json({ success: true, item: 'антибиотик', newEnd });
    }
    await pool.query(`UPDATE players SET balance=balance-$1 WHERE user_id=$2`, [totalCost, uid]);
    await addItem(uid, item, qty || 1);
    res.json({ success: true, item, qty: qty || 1, cost: totalCost });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Использовать предмет
app.post('/api/use-item', async (req, res) => {
  try {
    const { uid, item } = req.body;
    const p = await getOrCreate(uid);
    const qty = await getItemQty(uid, item);
    if (qty <= 0) return res.json({ success: false, error: 'Нет предмета' });
    if (item === 'еда') {
      if (p.stamina >= MAX_STAMINA) return res.json({ success: false, error: 'Стамина полная' });
      const gained = Math.min(50, MAX_STAMINA - p.stamina);
      await pool.query(`UPDATE players SET stamina=$1 WHERE user_id=$2`, [p.stamina + gained, uid]);
      await pool.query(`UPDATE inventory SET quantity=quantity-1 WHERE user_id=$1 AND item='еда' AND quantity>0`, [uid]);
      return res.json({ success: true, gained, stamina: p.stamina + gained });
    }
    res.json({ success: true, message: 'Предмет используется автоматически' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Бригады
app.get('/api/guild/:uid', async (req, res) => {
  try {
    const uid = parseInt(req.params.uid);
    const p = await getOrCreate(uid);
    if (!p.guild_id) return res.json({ success: false, error: 'Не в бригаде' });
    const gr = await pool.query('SELECT * FROM guilds WHERE id=$1', [p.guild_id]);
    if (!gr.rows[0]) return res.json({ success: false, error: 'Бригада не найдена' });
    const g = gr.rows[0];
    const memberR = await pool.query('SELECT COUNT(*) as cnt FROM players WHERE guild_id=$1', [g.id]);
    res.json({
      success: true,
      id: g.id, name: g.name, level: Number(g.level),
      treasury: Number(g.treasury), xp: Number(g.xp),
      ownerName: await getName(Number(g.owner_id)),
      ownerId: Number(g.owner_id),
      members: Number(memberR.rows[0].cnt),
      hp: await getGuildHP(g.id),
      warPoints: Number(g.war_points || 0)
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/create-guild', async (req, res) => {
  try {
    const { uid, name } = req.body;
    const p = await getOrCreate(uid);
    if (p.guild_id) return res.json({ success: false, error: 'Уже в бригаде' });
    if (p.balance < GUILD_COST) return res.json({ success: false, error: 'Не хватает монет. Нужно: ' + GUILD_COST });
    const result = await pool.query('INSERT INTO guilds(name, owner_id) VALUES($1,$2) RETURNING id', [name, uid]);
    await pool.query(`UPDATE players SET balance=balance-$1, guild_id=$2 WHERE user_id=$3`, [GUILD_COST, result.rows[0].id, uid]);
    res.json({ success: true, guildId: result.rows[0].id, name });
  } catch (e) {
    if (e.code === '23505') return res.json({ success: false, error: 'Название занято' });
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/invite-guild', async (req, res) => {
  try {
    const { uid, targetId } = req.body;
    const p = await getOrCreate(uid);
    if (!p.guild_id) return res.json({ success: false, error: 'Не в бригаде' });
    const gr = await pool.query('SELECT * FROM guilds WHERE id=$1', [p.guild_id]);
    if (Number(gr.rows[0].owner_id) !== uid) return res.json({ success: false, error: 'Только глава может приглашать' });
    await pool.query(`INSERT INTO guild_invites(user_id, guild_id) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET guild_id=$2`, [targetId, p.guild_id]);
    try {
      await vk.api.messages.send({
        user_id: targetId,
        message: `👥 Вас приглашают в бригаду «${gr.rows[0].name}»!\nЗайдите в приложение и примите приглашение.`,
        random_id: Math.floor(Math.random() * 1e9),
      });
    } catch {}
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/accept-invite', async (req, res) => {
  try {
    const { uid } = req.body;
    const inv = await pool.query('SELECT * FROM guild_invites WHERE user_id=$1', [uid]);
    if (!inv.rows[0]) return res.json({ success: false, error: 'Нет приглашений' });
    const p = await getOrCreate(uid);
    if (p.guild_id) return res.json({ success: false, error: 'Уже в бригаде' });
    await pool.query(`UPDATE players SET guild_id=$1 WHERE user_id=$2`, [inv.rows[0].guild_id, uid]);
    await pool.query('DELETE FROM guild_invites WHERE user_id=$1', [uid]);
    const gr = await pool.query('SELECT name FROM guilds WHERE id=$1', [inv.rows[0].guild_id]);
    res.json({ success: true, guildName: gr.rows[0].name });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/treasury-deposit', async (req, res) => {
  try {
    const { uid, amount } = req.body;
    const p = await getOrCreate(uid);
    if (!p.guild_id) return res.json({ success: false, error: 'Не в бригаде' });
    if (p.balance < amount) return res.json({ success: false, error: 'Недостаточно монет' });
    await pool.query(`UPDATE players SET balance=balance-$1 WHERE user_id=$2`, [amount, uid]);
    await pool.query(`UPDATE guilds SET treasury=treasury+$1, xp=xp+$2 WHERE id=$3`, [amount, Math.floor(amount / 100), p.guild_id]);
    res.json({ success: true, amount });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/leave-guild', async (req, res) => {
  try {
    const { uid } = req.body;
    const p = await getOrCreate(uid);
    if (!p.guild_id) return res.json({ success: false, error: 'Не в бригаде' });
    const gr = await pool.query('SELECT * FROM guilds WHERE id=$1', [p.guild_id]);
    if (Number(gr.rows[0].owner_id) === uid) return res.json({ success: false, error: 'Глава не может покинуть бригаду' });
    await pool.query(`UPDATE players SET guild_id=NULL WHERE user_id=$1`, [uid]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Ежедневный бонус
app.post('/api/daily-bonus', async (req, res) => {
  try {
    const { uid } = req.body;
    const p = await getOrCreate(uid);
    if (!p.guild_id) return res.json({ success: false, error: 'Только для членов бригады' });
    const dayStart = getMoscowDayStart();
    if (p.last_daily >= dayStart) return res.json({ success: false, error: 'Уже получили сегодня' });
    const dow = getMoscowDayOfWeek();
    const bonus = DAILY_BONUS[dow];
    await pool.query(`UPDATE players SET last_daily=$1 WHERE user_id=$2`, [Date.now(), uid]);
    if (bonus.type === 'coins') {
      await pool.query(`UPDATE players SET balance=balance+$1 WHERE user_id=$2`, [bonus.amount, uid]);
      return res.json({ success: true, type: 'coins', amount: bonus.amount });
    } else {
      const now = Date.now();
      let pending = 0;
      if (p.drills > 0) {
        const hours = Math.min((now - p.last_drill) / 3600000, PASSIVE_CAP_HOURS);
        pending = Math.floor(hours * DRILL_INCOME * p.drills);
      }
      await pool.query(`UPDATE players SET drills=drills+1, last_drill=$1, balance=balance+$2 WHERE user_id=$3`, [now, pending, uid]);
      return res.json({ success: true, type: 'drill', amount: 1 });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Чёрная работа
app.post('/api/black-work', async (req, res) => {
  try {
    const { uid } = req.body;
    const p = await getOrCreate(uid);
    const now = Date.now();
    updateVirusStatus(p);
    if (p.jail_until > now) return res.json({ success: false, error: 'В тюрьме!' });
    if (p.virus === 1 && p.virus_end > now) return res.json({ success: false, error: 'Больны вирусом!' });
    const leftCd = BLACK_WORK_CD - (now - p.last_black);
    if (leftCd > 0) return res.json({ success: false, error: 'Ещё горячо! Ждите ' + fmtTime(leftCd) });
    let catchChance = BLACK_CATCH_CHANCE;
    if (p.has_roof) catchChance /= 2;
    const dynQty = await getItemQty(uid, 'динамит');
    const hasDyn = dynQty > 0;
    let income = BLACK_WORK_INCOME;
    if (hasDyn) { income *= 2; catchChance = Math.max(0.05, catchChance - 0.10); await removeItem(uid, 'динамит', 1); }
    if (globalEpidemic && p.virus !== 2) income = Math.floor(income * (1 - VIRUS_INCOME_PENALTY));
    await pool.query(`UPDATE players SET last_black=$1 WHERE user_id=$2`, [now, uid]);
    const caught = Math.random() < catchChance;
    if (caught) {
      const fine = Math.min(BLACK_FINE, p.balance);
      await pool.query(`UPDATE players SET balance=balance-$1, stamina=20, jail_until=$2 WHERE user_id=$3`, [fine, now + JAIL_DURATION, uid]);
      return res.json({ success: true, caught: true, fine, jailUntil: now + JAIL_DURATION });
    }
    const contQty = randInt(1, 2);
    await addItem(uid, 'контрабанда', contQty);
    await pool.query(`UPDATE players SET balance=balance+$1 WHERE user_id=$2`, [income, uid]);
    res.json({ success: true, caught: false, income, contraband: contQty, hasDyn });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Воровство
app.post('/api/steal', async (req, res) => {
  try {
    const { uid, targetId } = req.body;
    const p = await getOrCreate(uid);
    const now = Date.now();
    if (p.jail_until > now) return res.json({ success: false, error: 'В тюрьме!' });
    if (p.virus === 1 && p.virus_end > now) return res.json({ success: false, error: 'Больны!' });
    const leftCd = STEAL_CD - (now - p.last_steal);
    if (leftCd > 0) return res.json({ success: false, error: 'Ждите ' + fmtTime(leftCd) });
    await pool.query(`UPDATE players SET last_steal=$1 WHERE user_id=$2`, [now, uid]);
    const success = Math.random() < STEAL_CHANCE;
    if (!success) {
      const fine = Math.min(500, p.balance);
      await pool.query(`UPDATE players SET balance=balance-$1 WHERE user_id=$2`, [fine, uid]);
      return res.json({ success: true, stealSuccess: false, fine });
    }
    const victim = await getPlayer(targetId);
    if (!victim) return res.json({ success: false, error: 'Жертва не найдена' });
    const pct = STEAL_MIN_PCT + Math.random() * (STEAL_MAX_PCT - STEAL_MIN_PCT);
    let stolen = Math.max(50, Math.floor(victim.balance * pct));
    stolen = Math.min(stolen, STEAL_MAX_AMOUNT);
    await pool.query(`UPDATE players SET balance=balance-$1 WHERE user_id=$2`, [stolen, targetId]);
    await pool.query(`UPDATE players SET balance=balance+$1 WHERE user_id=$2`, [stolen, uid]);
    res.json({ success: true, stealSuccess: true, stolen, victimName: await getName(targetId) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Выбор класса
app.post('/api/set-class', async (req, res) => {
  try {
    const { uid, className } = req.body;
    if (!CLASSES[className]) return res.json({ success: false, error: 'Класс не найден' });
    const p = await getOrCreate(uid);
    if (p.player_class === className) return res.json({ success: false, error: 'Уже выбран' });
    await pool.query(`UPDATE players SET player_class=$1 WHERE user_id=$2`, [className, uid]);
    res.json({ success: true, className, desc: CLASSES[className].desc });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Вирус статус
app.get('/api/virus-status/:uid', async (req, res) => {
  try {
    const uid = parseInt(req.params.uid);
    const p = await getOrCreate(uid);
    updateVirusStatus(p);
    res.json({
      success: true,
      virus: p.virus, virusEnd: p.virus_end,
      vaccineEnd: p.vaccine_end, globalEpidemic, epidemicEndTime
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Рынок
app.get('/api/market', async (req, res) => {
  try {
    const listings = await pool.query(`SELECT * FROM market_listings ORDER BY listed_at DESC LIMIT 50`);
    const result = [];
    for (const l of listings.rows) {
      result.push({
        id: l.id, sellerName: await getName(Number(l.seller_id)),
        itemType: l.item_type, itemName: l.item_name,
        quantity: Number(l.quantity), price: Number(l.price),
        total: Number(l.quantity) * Number(l.price)
      });
    }
    res.json({ success: true, listings: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/market-sell', async (req, res) => {
  try {
    const { uid, itemType, itemName, quantity, price } = req.body;
    const p = await getOrCreate(uid);
    if (itemType === 'руда') {
      const qty = await getItemQty(uid, itemName);
      if (qty < quantity) return res.json({ success: false, error: 'Недостаточно' });
      await removeItem(uid, itemName, quantity);
    } else if (itemType === 'бур') {
      if (p.drills < quantity) return res.json({ success: false, error: 'Недостаточно' });
      await pool.query(`UPDATE players SET drills=drills-$1 WHERE user_id=$2`, [quantity, uid]);
    } else if (itemType === 'вышка') {
      if (p.oil_rigs < quantity) return res.json({ success: false, error: 'Недостаточно' });
      await pool.query(`UPDATE players SET oil_rigs=oil_rigs-$1 WHERE user_id=$2`, [quantity, uid]);
    } else {
      const qty = await getItemQty(uid, itemName);
      if (qty < quantity) return res.json({ success: false, error: 'Недостаточно' });
      await removeItem(uid, itemName, quantity);
    }
    await pool.query(`INSERT INTO market_listings (seller_id, item_type, item_name, quantity, price) VALUES ($1,$2,$3,$4,$5)`, [uid, itemType, itemName, quantity, price]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/market-buy', async (req, res) => {
  try {
    const { uid, lotId } = req.body;
    const p = await getOrCreate(uid);
    const lot = await pool.query(`SELECT * FROM market_listings WHERE id=$1`, [lotId]);
    if (!lot.rows.length) return res.json({ success: false, error: 'Лот не найден' });
    const listing = lot.rows[0];
    if (Number(listing.seller_id) === uid) return res.json({ success: false, error: 'Нельзя купить своё' });
    const total = Number(listing.quantity) * Number(listing.price);
    if (p.balance < total) return res.json({ success: false, error: 'Недостаточно монет' });
    await pool.query(`UPDATE players SET balance=balance-$1 WHERE user_id=$2`, [total, uid]);
    await pool.query(`UPDATE players SET balance=balance+$1 WHERE user_id=$2`, [total, Number(listing.seller_id)]);
    if (listing.item_type === 'руда' || listing.item_type === 'предмет') {
      await addItem(uid, listing.item_name, Number(listing.quantity));
    } else if (listing.item_type === 'бур') {
      await pool.query(`UPDATE players SET drills=drills+$1 WHERE user_id=$2`, [Number(listing.quantity), uid]);
    } else if (listing.item_type === 'вышка') {
      await pool.query(`UPDATE players SET oil_rigs=oil_rigs+$1 WHERE user_id=$2`, [Number(listing.quantity), uid]);
    }
    await pool.query(`DELETE FROM market_listings WHERE id=$1`, [lotId]);
    res.json({ success: true, itemName: listing.item_name, quantity: Number(listing.quantity), total });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PvP - дуэль
app.post('/api/duel', async (req, res) => {
  try {
    const { uid, targetId, bet } = req.body;
    const p = await getOrCreate(uid);
    const canAtk = await canAttack(uid, targetId);
    if (!canAtk.allowed) return res.json({ success: false, error: canAtk.reason });
    if (p.balance < bet) return res.json({ success: false, error: 'Недостаточно монет' });
    const target = await getPlayer(targetId);
    if (!target || target.balance < bet) return res.json({ success: false, error: 'У противника недостаточно монет' });
    const duelKey = `${uid}_${targetId}`;
    activeDuels.set(duelKey, { challenger: uid, defender: targetId, bet, startTime: Date.now(), accepted: false });
    setTimeout(() => {
      const d = activeDuels.get(duelKey);
      if (d && !d.accepted) activeDuels.delete(duelKey);
    }, DUEL_DURATION);
    res.json({ success: true, message: 'Дуэль создана! Противник должен принять вызов.' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/accept-duel', async (req, res) => {
  try {
    const { uid } = req.body;
    let found = null, duelKey = null;
    for (const [key, duel] of activeDuels) {
      if (duel.defender === uid && !duel.accepted) { found = duel; duelKey = key; break; }
    }
    if (!found) return res.json({ success: false, error: 'Нет активных вызовов' });
    found.accepted = true;
    const winner = Math.random() < 0.5 ? found.challenger : found.defender;
    const loser = winner === found.challenger ? found.defender : found.challenger;
    await pool.query(`UPDATE players SET balance=balance+$1 WHERE user_id=$2`, [found.bet, winner]);
    await pool.query(`UPDATE players SET balance=balance-$1 WHERE user_id=$2`, [found.bet, loser]);
    await recordAttack(winner, loser);
    activeDuels.delete(duelKey);
    res.json({ success: true, winner, loser, winnerName: await getName(winner), loserName: await getName(loser), bet: found.bet });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Мир
app.post('/api/peace', async (req, res) => {
  try {
    const { uid } = req.body;
    const p = await getOrCreate(uid);
    if (await isInPeaceMode(uid)) return res.json({ success: false, error: 'Уже в режиме мира' });
    if (p.balance < PEACE_COST) return res.json({ success: false, error: 'Недостаточно монет' });
    await pool.query(`UPDATE players SET balance=balance-$1 WHERE user_id=$2`, [PEACE_COST, uid]);
    peaceMode.set(uid, Date.now() + PEACE_DURATION);
    res.json({ success: true, until: Date.now() + PEACE_DURATION });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════
//  БОТ СООБЩЕСТВА (только админ-команды и Инфа)
// ═══════════════════════════════════════════════════════════

vk.updates.on('message_new', async (ctx) => {
  try {
    if (!ctx.text) return;
    const uid = ctx.senderId;
    if (uid < 0) return;
    const text = ctx.text.trim().toLowerCase();
    const raw = ctx.text.trim();
    const adminCheck = await isAdmin(uid);

    // Инфа для обладателей доступа
    if (text.startsWith('инфа ') && !text.startsWith('инфа клан')) {
      if (!await hasInfoAccess(uid)) return;
      let targetIdStr = text.slice('инфа '.length).trim();
      const mentionMatch = targetIdStr.match(/\[id(\d+)\|/);
      if (mentionMatch) targetIdStr = mentionMatch[1];
      const targetId = parseInt(targetIdStr);
      if (!targetId) return ctx.send('❌ Укажи ID игрока');
      const p = await getPlayer(targetId);
      if (!p) return ctx.send('❌ Игрок не найден');
      const name = await getName(targetId);
      const pick = PICKAXE.find(l => l.level === p.pickaxe_lvl) || PICKAXE[0];
      let guildName = 'Нет';
      if (p.guild_id) {
        const gr = await pool.query('SELECT name FROM guilds WHERE id=$1', [p.guild_id]);
        if (gr.rows[0]) guildName = gr.rows[0].name;
      }
      const info = await calcPassiveInfo(targetId);
      const isPeace = await isInPeaceMode(targetId);
      const lines = [
        `🔍 ПРОФИЛЬ: ${name}`,
        `🆔 ID: ${targetId}`,
        `💰 Баланс: ${Number(p.balance).toLocaleString()} монет`,
        `❤️ Стамина: ${p.stamina}/${MAX_STAMINA}`,
        `⛏️ Кирка: ур. ${p.pickaxe_lvl} (+${pick.bonus}%)`,
        `⚔️ Рейтинг: ${p.battle_rating}`,
        `👤 Класс: ${p.player_class || 'не выбран'}`,
        `👥 Бригада: ${guildName}`,
        `⭐ Крафт: ${p.craft_level}`,
        `📊 Работ: ${p.work_count}`,
        `🛡️ Крыша: ${p.has_roof ? 'Да' : 'Нет'}`,
        `🕊️ Мир: ${isPeace ? 'Да' : 'Нет'}`,
        `🦠 Вирус: ${p.virus === 1 ? 'Болен' : p.vaccine_end > Date.now() ? 'Защищён' : 'Здоров'}`,
      ];
      if (info.totalDrills > 0) lines.push(`⚙️ Буры: ${info.activeDrills}/${info.totalDrills}`);
      if (info.totalRigs > 0) lines.push(`🛢️ Вышки: ${info.activeRigs}/${info.totalRigs}`);
      return ctx.send(lines.join('\n'));
    }

    if ((text.startsWith('инфа клан ') || text.startsWith('инфаклан ')) && await hasInfoAccess(uid)) {
      const guildName = raw.slice(raw.indexOf(' ') + 1).trim().replace(/^клан\s+/i, '');
      const gr = await pool.query('SELECT * FROM guilds WHERE name=$1', [guildName]);
      if (!gr.rows[0]) return ctx.send('❌ Бригада не найдена');
      const g = gr.rows[0];
      const members = await pool.query('SELECT COUNT(*) as cnt FROM players WHERE guild_id=$1', [g.id]);
      const topMembers = await pool.query('SELECT user_id, balance FROM players WHERE guild_id=$1 AND banned=FALSE ORDER BY balance DESC LIMIT 5', [g.id]);
      const totalWealth = await pool.query('SELECT COALESCE(SUM(balance), 0) as total FROM players WHERE guild_id=$1', [g.id]);
      const lines = [
        `🔍 БРИГАДА «${g.name}»`,
        `👑 Глава: ${await getName(Number(g.owner_id))}`,
        `📊 Уровень: ${g.level}`,
        `❤️ HP: ${await getGuildHP(g.id)}`,
        `💰 Казна: ${Number(g.treasury).toLocaleString()}`,
        `💰 Общий баланс: ${Number(totalWealth.rows[0].total).toLocaleString()}`,
        `👤 Участников: ${members.rows[0].cnt}`,
        `⚔️ Очки войны: ${g.war_points || 0}`,
        `\n🏆 ТОП-5:`,
      ];
      for (let i = 0; i < topMembers.rows.length; i++) {
        lines.push(`${i + 1}. ${await getName(Number(topMembers.rows[i].user_id))} — ${Number(topMembers.rows[i].balance).toLocaleString()}💰`);
      }
      return ctx.send(lines.join('\n'));
    }

    // Админ-команды
    if (!adminCheck) return;
    
    const parts = text.split(/\s+/);

    if (parts[0] === '!дать') {
      const targetId = parseInt(parts[1]), amount = parseInt(parts[2]);
      if (!targetId || !amount) return ctx.send('❌ !дать [ID] [сумма]');
      await getOrCreate(targetId);
      await pool.query(`UPDATE players SET balance=balance+$1 WHERE user_id=$2`, [amount, targetId]);
      return ctx.send(`✅ Выдано ${amount} монет игроку #${targetId}`);
    }

    if (parts[0] === '!забрать') {
      const targetId = parseInt(parts[1]), amount = parseInt(parts[2]);
      if (!targetId || !amount) return ctx.send('❌ !забрать [ID] [сумма]');
      const t = await getPlayer(targetId);
      if (!t) return ctx.send('❌ Игрок не найден');
      const actual = Math.min(amount, t.balance);
      await pool.query(`UPDATE players SET balance=balance-$1 WHERE user_id=$2`, [actual, targetId]);
      return ctx.send(`✅ Изъято ${actual} монет у #${targetId}`);
    }

    if (parts[0] === '!датьруду') {
      const targetId = parseInt(parts[1]), oreName = parts[2]?.toLowerCase(), qty = parseInt(parts[3]) || 1;
      if (!targetId || !oreName || !ORES[oreName]) return ctx.send('❌ !датьруду [ID] [руда] [кол-во]');
      await addItem(targetId, oreName, qty);
      return ctx.send(`✅ ${ORES[oreName].emoji} ${oreName} x${qty} → #${targetId}`);
    }

    if (parts[0] === '!забратьруду') {
      const targetId = parseInt(parts[1]), oreName = parts[2]?.toLowerCase(), qty = parseInt(parts[3]) || 1;
      if (!targetId || !oreName || !ORES[oreName]) return ctx.send('❌ !забратьруду [ID] [руда] [кол-во]');
      const cur = await getItemQty(targetId, oreName);
      const actual = Math.min(qty, cur);
      if (actual <= 0) return ctx.send('❌ Нет такой руды');
      await removeItem(targetId, oreName, actual);
      return ctx.send(`✅ Изъято ${oreName} x${actual} у #${targetId}`);
    }

    if (parts[0] === '!датьпредмет') {
      const targetId = parseInt(parts[1]), item = parts[2]?.toLowerCase(), qty = parseInt(parts[3]) || 1;
      if (!targetId || !item) return ctx.send('❌ !датьпредмет [ID] [предмет] [кол-во]');
      await addItem(targetId, item, qty);
      return ctx.send(`✅ ${item} x${qty} → #${targetId}`);
    }

    if (parts[0] === '!забратьпредмет') {
      const targetId = parseInt(parts[1]), item = parts[2]?.toLowerCase(), qty = parseInt(parts[3]) || 1;
      if (!targetId || !item) return ctx.send('❌ !забратьпредмет [ID] [предмет] [кол-во]');
      const cur = await getItemQty(targetId, item);
      const actual = Math.min(qty, cur);
      if (actual <= 0) return ctx.send('❌ Нет предмета');
      await removeItem(targetId, item, actual);
      return ctx.send(`✅ Изъято ${item} x${actual} у #${targetId}`);
    }

    if (text === '!игроки') {
      const res = await pool.query('SELECT user_id, balance, banned, player_class FROM players ORDER BY balance DESC');
      const lines = [`👤 ИГРОКИ (${res.rows.length}):`];
      for (let i = 0; i < res.rows.length; i++) {
        const r = res.rows[i];
        lines.push(`${i + 1}. ${await getName(r.user_id)} — ${Number(r.balance).toLocaleString()}💰 ${r.banned ? '[ЗАБАНЕН]' : ''}`);
      }
      return ctx.send(lines.join('\n').slice(0, 4000));
    }

    if (text.startsWith('!профиль ')) {
      const targetId = parseInt(parts[1]);
      if (!targetId) return ctx.send('❌ !профиль [ID]');
      const p = await getPlayer(targetId);
      if (!p) return ctx.send('❌ Игрок не найден');
      return ctx.send(`👤 ${await getName(targetId)} | 💰${p.balance} | ⛏️ур.${p.pickaxe_lvl} | 🏥${p.stamina}/100 | ⚔️${p.battle_rating} | 👥${p.player_class || 'нет класса'}`);
    }

    if (text.startsWith('!освободить ')) {
      const targetId = parseInt(parts[1]);
      if (!targetId) return ctx.send('❌ !освободить [ID]');
      await pool.query(`UPDATE players SET jail_until=0 WHERE user_id=$1`, [targetId]);
      return ctx.send(`✅ #${targetId} освобождён`);
    }

    if (text === '!скрыть') { await pool.query(`UPDATE players SET hidden=TRUE WHERE user_id=$1`, [uid]); return ctx.send('✅ Скрыт'); }
    if (text === '!показать') { await pool.query(`UPDATE players SET hidden=FALSE WHERE user_id=$1`, [uid]); return ctx.send('✅ Виден'); }

    if (parts[0] === '!бан') {
      const targetId = parseInt(parts[1]);
      if (!targetId) return ctx.send('❌ !бан [ID]');
      await pool.query(`UPDATE players SET banned=TRUE WHERE user_id=$1`, [targetId]);
      return ctx.send(`⛔ #${targetId} забанен`);
    }

    if (parts[0] === '!разбан') {
      const targetId = parseInt(parts[1]);
      if (!targetId) return ctx.send('❌ !разбан [ID]');
      await pool.query(`UPDATE players SET banned=FALSE WHERE user_id=$1`, [targetId]);
      return ctx.send(`✅ #${targetId} разбанен`);
    }

    if (parts[0] === '!админ') {
      if (uid !== ADMIN_ID) return ctx.send('❌ Только главный админ');
      const targetId = parseInt(parts[1]);
      if (!targetId) return ctx.send('❌ !админ [ID]');
      await pool.query(`UPDATE players SET is_admin=TRUE WHERE user_id=$1`, [targetId]);
      return ctx.send(`✅ #${targetId} назначен админом`);
    }

    if (parts[0] === '!снятьадмин') {
      if (uid !== ADMIN_ID) return ctx.send('❌ Только главный админ');
      const targetId = parseInt(parts[1]);
      if (targetId === ADMIN_ID) return ctx.send('❌ Нельзя снять главного');
      await pool.query(`UPDATE players SET is_admin=FALSE WHERE user_id=$1`, [targetId]);
      return ctx.send(`✅ #${targetId} снят`);
    }

    if (text === '!обнулитьвсех') {
      globalThis.pendingResets = globalThis.pendingResets || new Set();
      globalThis.pendingResets.add(uid);
      return ctx.send('⚠️ Для подтверждения: !обнулитьвсех подтвердить');
    }

    if (text === '!обнулитьвсех подтвердить') {
      if (!globalThis.pendingResets?.has(uid)) return ctx.send('❌ Сначала !обнулитьвсех');
      globalThis.pendingResets.delete(uid);
      await pool.query(`UPDATE players SET balance=0,stamina=100,pickaxe_lvl=1,drills=0,oil_rigs=0,drills_enhanced=0,drills_diamond=0,work_count=0,craft_level=1,battle_rating=0,last_work=0,last_rest=0,last_drill=0,last_oil=0,last_black=0,jail_until=0,has_roof=FALSE,last_steal=0,last_daily=0,virus=0,virus_end=0,vaccine_end=0`);
      await pool.query(`DELETE FROM inventory`);
      await pool.query(`DELETE FROM market_listings`);
      await pool.query(`DELETE FROM destroyed_equipment`);
      await pool.query(`UPDATE guilds SET treasury=0, xp=0, level=1, war_points=0`);
      await pool.query(`UPDATE players SET is_admin=TRUE WHERE user_id=$1`, [ADMIN_ID]);
      activeDuels.clear(); activeRaids.clear(); activeWars.clear();
      attackCounts.clear(); peaceMode.clear();
      neutralMineController = null; neutralMineControlEnd = 0;
      globalEpidemic = false; epidemicEndTime = 0;
      return ctx.send('✅ Всё обнулено!');
    }

    if (parts[0] === '!датьинфу') {
      const targetId = parseInt(parts[1]), days = parseInt(parts[2]);
      if (!targetId || ![1, 7, 30].includes(days)) return ctx.send('❌ !датьинфу [ID] [1/7/30]');
      globalThis.infoAccess.set(targetId, Date.now() + days * 86400000);
      return ctx.send(`✅ Доступ к Инфа выдан #${targetId} на ${days} дн.`);
    }

    if (parts[0] === '!инфадоступ') {
      const targetId = parseInt(parts[1]);
      const access = globalThis.infoAccess.get(targetId);
      if (!access || access <= Date.now()) return ctx.send(`❌ У #${targetId} нет доступа`);
      return ctx.send(`✅ Доступ до: ${new Date(access).toLocaleString('ru-RU')}`);
    }

    if (text.startsWith('!промо ')) {
      const args = raw.slice('!промо '.length).split(/\s+/);
      if (args.length < 3) return ctx.send('❌ !промо [код] [тип] [кол-во] [макс.активаций]');
      const code = args[0].toUpperCase(), type = args[1], amount = parseInt(args[2]), maxUses = parseInt(args[3]) || 1;
      if (!['coins', 'drill', 'oil', 'stamina'].includes(type)) return ctx.send('❌ Тип: coins/drill/oil/stamina');
      try {
        await pool.query(`INSERT INTO promo_codes(code, reward_type, reward_amount, max_uses, created_by) VALUES($1,$2,$3,$4,$5)`, [code, type, amount, maxUses, uid]);
        return ctx.send(`✅ Промокод ${code} создан`);
      } catch (e) {
        if (e.code === '23505') return ctx.send('❌ Код уже существует');
        throw e;
      }
    }

    if (text.startsWith('!деактивировать ')) {
      const code = text.slice('!деактивировать '.length).trim().toUpperCase();
      await pool.query(`UPDATE promo_codes SET active=FALSE WHERE code=$1`, [code]);
      return ctx.send(`✅ ${code} деактивирован`);
    }

    if (text === '!промокоды') {
      const r = await pool.query(`SELECT code, reward_type, reward_amount, uses, max_uses, active FROM promo_codes ORDER BY code`);
      if (!r.rows.length) return ctx.send('📋 Промокодов нет');
      const lines = ['📋 Промокоды:'];
      for (const row of r.rows) lines.push(`${row.active ? '✅' : '❌'} ${row.code} — ${row.reward_amount} ${row.reward_type} [${row.uses}/${row.max_uses}]`);
      return ctx.send(lines.join('\n'));
    }

    if (text === '!вирус старт') { await startEpidemic(); return ctx.send('🦠 Эпидемия запущена!'); }
    if (text === '!вирус стоп') { await endEpidemic(); return ctx.send('✅ Эпидемия остановлена'); }

    if (text.startsWith('!вылечить ')) {
      const targetId = parseInt(parts[1]);
      if (!targetId) return ctx.send('❌ !вылечить [ID]');
      await pool.query(`UPDATE players SET virus=0, virus_end=0, stamina=LEAST(stamina+30,100) WHERE user_id=$1`, [targetId]);
      return ctx.send(`✅ #${targetId} вылечен`);
    }

    if (text.startsWith('!защитить ')) {
      const targetId = parseInt(parts[1]);
      if (!targetId) return ctx.send('❌ !защитить [ID]');
      await pool.query(`UPDATE players SET virus=2, vaccine_end=$1, virus_end=0 WHERE user_id=$2`, [Date.now() + VACCINE_DURATION, targetId]);
      return ctx.send(`✅ #${targetId} защищён`);
    }

    if (text.startsWith('!заразить ')) {
      const targetId = parseInt(parts[1]);
      if (!targetId) return ctx.send('❌ !заразить [ID]');
      await pool.query(`UPDATE players SET virus=1, virus_end=$1, stamina=GREATEST(0,stamina-20) WHERE user_id=$2 AND vaccine_end<=$3`, [Date.now() + EPIDEMIC_DURATION, targetId, Date.now()]);
      return ctx.send(`🦠 #${targetId} заражён`);
    }

  } catch (err) {
    console.error('❌ Ошибка:', err.message);
    try { await ctx.send('❌ Ошибка'); } catch {}
  }
});

// ═══════════════════════════════════════════════════════════
//  ЭПИДЕМИЯ
// ═══════════════════════════════════════════════════════════
async function startEpidemic() {
  if (globalEpidemic) return;
  globalEpidemic = true;
  epidemicEndTime = Date.now() + EPIDEMIC_DURATION;
  const players = await pool.query(`SELECT user_id, vaccine_end FROM players WHERE banned=FALSE`);
  for (const pl of players.rows) {
    if (pl.vaccine_end <= Date.now()) {
      await pool.query(`UPDATE players SET virus=1, virus_end=$1, stamina=GREATEST(0,stamina-20) WHERE user_id=$2 AND vaccine_end<=$3`, [epidemicEndTime, pl.user_id, Date.now()]);
    }
  }
  setTimeout(() => endEpidemic(), EPIDEMIC_DURATION);
}

async function endEpidemic() {
  globalEpidemic = false;
  epidemicEndTime = 0;
  await pool.query(`UPDATE players SET virus=0, virus_end=0 WHERE virus=1`);
}

function startEpidemicChecker() {
  setInterval(() => {
    if (!globalEpidemic && Math.random() < EPIDEMIC_CHANCE) startEpidemic();
  }, EPIDEMIC_CHECK_INTERVAL);
}

// ═══════════════════════════════════════════════════════════
//  СТАТИЧЕСКИЙ HTML ДЛЯ MINI APP
// ═══════════════════════════════════════════════════════════
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Если index.html нет — отдаём встроенный
app.get('/app', (req, res) => {
  res.send(getMiniAppHTML());
});

function getMiniAppHTML() {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Generational Miners</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #fff;
      min-height: 100vh;
      overflow-x: hidden;
    }
    .app { max-width: 500px; margin: 0 auto; padding: 10px; }
    
    /* Header */
    .header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 12px;
      text-align: center;
      border: 1px solid #2a2a4a;
    }
    .header h1 { font-size: 22px; background: linear-gradient(90deg, #f7971e, #ffd200); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .balance-card {
      background: linear-gradient(135deg, #1e3a5f, #1a1a2e);
      border-radius: 14px;
      padding: 15px;
      margin: 10px 0;
      border: 1px solid #f7971e44;
    }
    .balance { font-size: 32px; font-weight: bold; color: #ffd200; }
    .stamina-bar {
      background: #2a2a3a;
      border-radius: 10px;
      height: 20px;
      margin-top: 8px;
      overflow: hidden;
    }
    .stamina-fill {
      height: 100%;
      background: linear-gradient(90deg, #ff416c, #ff4b2b);
      border-radius: 10px;
      transition: width 0.3s;
    }
    
    /* Navigation */
    .nav {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .nav-btn {
      flex: 1;
      min-width: 60px;
      padding: 12px 8px;
      border: none;
      border-radius: 12px;
      background: #1a1a2e;
      color: #aaa;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid #2a2a4a;
    }
    .nav-btn.active {
      background: linear-gradient(135deg, #f7971e, #ffd200);
      color: #000;
      font-weight: bold;
      border-color: transparent;
    }
    
    /* Cards */
    .card {
      background: #1a1a2e;
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 12px;
      border: 1px solid #2a2a4a;
    }
    .card h3 { font-size: 16px; margin-bottom: 12px; color: #ffd200; }
    
    /* Buttons */
    .btn {
      width: 100%;
      padding: 14px;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: 8px;
    }
    .btn-primary {
      background: linear-gradient(135deg, #f7971e, #ffd200);
      color: #000;
    }
    .btn-secondary {
      background: #2a2a4a;
      color: #ffd200;
      border: 1px solid #ffd20044;
    }
    .btn-danger {
      background: #ff416c;
      color: #fff;
    }
    .btn:active { transform: scale(0.97); opacity: 0.9; }
    .btn:disabled { opacity: 0.5; }
    
    /* Stats */
    .stats-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .stat {
      flex: 1;
      min-width: 70px;
      background: #16213e;
      border-radius: 10px;
      padding: 10px;
      text-align: center;
      font-size: 12px;
      color: #aaa;
    }
    .stat-value { font-size: 18px; font-weight: bold; color: #ffd200; }
    
    /* List */
    .list-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: #16213e;
      border-radius: 10px;
      margin-bottom: 6px;
    }
    .list-item span { font-size: 14px; }
    
    /* Grid */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    
    /* Modal */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.8);
      z-index: 100;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .modal-overlay.show { display: flex; }
    .modal {
      background: #1a1a2e;
      border-radius: 16px;
      padding: 20px;
      width: 100%;
      max-width: 400px;
      max-height: 80vh;
      overflow-y: auto;
      border: 1px solid #2a2a4a;
    }
    .modal h3 { color: #ffd200; margin-bottom: 12px; }
    
    /* Input */
    input, select {
      width: 100%;
      padding: 12px;
      border-radius: 10px;
      border: 1px solid #2a2a4a;
      background: #0a0a0a;
      color: #fff;
      font-size: 14px;
      margin-bottom: 8px;
    }
    
    /* Toast */
    .toast {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #333;
      color: #fff;
      padding: 12px 24px;
      border-radius: 20px;
      z-index: 200;
      animation: fadeIn 0.3s;
    }
    .toast.error { background: #ff416c; }
    .toast.success { background: #00c853; }
    @keyframes fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(-20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
    
    /* Loading */
    .loading { text-align: center; padding: 40px; }
    .spinner { width: 40px; height: 40px; border: 3px solid #2a2a4a; border-top-color: #ffd200; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
    
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <div class="app" id="app">
    <div class="loading"><div class="spinner"></div><p>Загрузка...</p></div>
  </div>

  <script>
    const API = '/api';
    let playerData = null;
    let currentTab = 'main';

    // Получить параметры запуска VK
    const urlParams = new URLSearchParams(window.location.search);
    let userId = parseInt(urlParams.get('vk_user_id') || urlParams.get('viewer_id') || '0');
    
    // Для теста в браузере
    if (!userId) userId = 788158121;

    function getAvatarUrl(uid) {
      return \`https://vk.com/images/camera_100.png\`;
    }

    async function apiCall(method, url, body = null) {
      try {
        const options = {
          method,
          headers: { 'Content-Type': 'application/json' }
        };
        if (body) options.body = JSON.stringify(body);
        const res = await fetch(API + url, options);
        return await res.json();
      } catch (e) {
        return { success: false, error: 'Ошибка соединения' };
      }
    }

    function showToast(msg, type = 'info') {
      const toast = document.createElement('div');
      toast.className = 'toast ' + type;
      toast.textContent = msg;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }

    function fmtTime(ms) {
      if (ms <= 0) return '0 сек';
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      if (h > 0) return h + ' ч ' + m + ' мин';
      if (m > 0) return m + ' мин ' + s + ' сек';
      return s + ' сек';
    }

    function formatNum(n) {
      return Number(n).toLocaleString('ru-RU');
    }

    async function loadProfile() {
      const data = await apiCall('GET', '/profile/' + userId);
      if (data.success) {
        playerData = data;
        renderApp();
      } else {
        document.getElementById('app').innerHTML = '<div class="card"><h3>Ошибка загрузки</h3><p>' + (data.error || 'Неизвестная ошибка') + '</p></div>';
      }
    }

    function renderApp() {
      const p = playerData;
      document.getElementById('app').innerHTML = \`
        <div class="header">
          <h1>⛏️ Generational Miners</h1>
          <div class="balance-card">
            <div style="font-size:12px;color:#aaa">Баланс</div>
            <div class="balance">💰 \${formatNum(p.balance)}</div>
            <div style="font-size:12px;color:#aaa;margin-top:8px">Стамина \${p.stamina}/\${p.maxStamina}</div>
            <div class="stamina-bar">
              <div class="stamina-fill" style="width:\${(p.stamina/p.maxStamina*100)}%"></div>
            </div>
          </div>
          <div class="stats-row">
            <div class="stat"><div class="stat-value">\${p.pickaxeLvl}</div>Кирка</div>
            <div class="stat"><div class="stat-value">\${p.battleRating}</div>Рейтинг</div>
            <div class="stat"><div class="stat-value">\${p.workCount}</div>Работ</div>
            <div class="stat"><div class="stat-value">\${p.passive?.totalDrills + p.passive?.totalEnhanced + p.passive?.totalDiamond || 0}</div>Буров</div>
          </div>
        </div>
        <div class="nav">
          <button class="nav-btn \${currentTab==='main'?'active':''}" onclick="switchTab('main')">⛏️</button>
          <button class="nav-btn \${currentTab==='shop'?'active':''}" onclick="switchTab('shop')">🛒</button>
          <button class="nav-btn \${currentTab==='craft'?'active':''}" onclick="switchTab('craft')">🔨</button>
          <button class="nav-btn \${currentTab==='guild'?'active':''}" onclick="switchTab('guild')">👥</button>
          <button class="nav-btn \${currentTab==='pvp'?'active':''}" onclick="switchTab('pvp')">⚔️</button>
          <button class="nav-btn \${currentTab==='market'?'active':''}" onclick="switchTab('market')">📦</button>
          <button class="nav-btn \${currentTab==='profile'?'active':''}" onclick="switchTab('profile')">👤</button>
        </div>
        <div id="tab-content"></div>
      \`;
      renderTab();
    }

    function switchTab(tab) {
      currentTab = tab;
      renderApp();
    }

    async function renderTab() {
      const content = document.getElementById('tab-content');
      const p = playerData;
      
      switch(currentTab) {
        case 'main':
          content.innerHTML = \`
            <div class="card">
              <h3>⛏️ Работа в шахте</h3>
              <p style="color:#aaa;margin-bottom:10px">Добывай руду и монеты!</p>
              <button class="btn btn-primary" onclick="doWork()">⛏️ Работать (30 мин)</button>
              <button class="btn btn-secondary" onclick="doRest()">😴 Отдых (30 мин)</button>
              <div class="grid-2" style="margin-top:8px">
                <button class="btn btn-secondary" onclick="doBlackWork()">🦹 Чёрная работа</button>
                <button class="btn btn-secondary" onclick="doSteal()">🎭 Своровать</button>
              </div>
            </div>
            <div class="card">
              <h3>⚙️ Пассивный доход</h3>
              <p style="color:#aaa">Буры: \${p.passive?.totalDrills + p.passive?.totalEnhanced + p.passive?.totalDiamond || 0} шт.</p>
              <p style="color:#aaa">Вышки: \${p.passive?.totalRigs || 0} шт.</p>
              <div class="grid-2">
                <button class="btn btn-primary" onclick="collectDrills()">💰 Собрать буры</button>
                <button class="btn btn-primary" onclick="collectOil()">🛢️ Собрать вышки</button>
              </div>
            </div>
            <div class="card">
              <h3>🎁 Ежедневный бонус</h3>
              <button class="btn btn-primary" onclick="getDailyBonus()">🎁 Получить бонус</button>
            </div>
            \${p.globalEpidemic ? '<div class="card" style="border-color:#ff416c"><h3>🦠 ЭПИДЕМИЯ!</h3><p>Доход снижен на 50%</p></div>' : ''}
            \${p.jailUntil > Date.now() ? '<div class="card" style="border-color:#ff416c"><h3>🚨 В ТЮРЬМЕ!</h3><p>Ещё ' + fmtTime(p.jailUntil - Date.now()) + '</p></div>' : ''}
          \`;
          break;
          
        case 'shop':
          content.innerHTML = \`
            <div class="card">
              <h3>🛒 Магазин</h3>
              <div class="grid-2">
                <button class="btn btn-secondary" onclick="buyItem('еда',1)">🍎 Еда (200💰)</button>
                <button class="btn btn-secondary" onclick="buyItem('динамит',1)">💥 Динамит (500💰)</button>
                <button class="btn btn-secondary" onclick="buyItem('крыша',1)">🛡️ Крыша (3000💰)</button>
                <button class="btn btn-secondary" onclick="buyItem('аптечка',1)">🏥 Аптечка (300💰)</button>
                <button class="btn btn-secondary" onclick="buyItem('вакцина',1)">💉 Вакцина (1000💰)</button>
                <button class="btn btn-secondary" onclick="buyItem('антибиотик',1)">🧪 Антибиотик (500💰)</button>
              </div>
            </div>
            <div class="card">
              <h3>🔧 Техника</h3>
              <button class="btn btn-primary" onclick="upgradePickaxe()">⛏️ Улучшить кирку</button>
              <button class="btn btn-primary" onclick="buyDrill()">⚙️ Купить бур (2000💰)</button>
              <button class="btn btn-primary" onclick="buyOil()">🛢️ Купить вышку (5000💰)</button>
            </div>
            <div class="card">
              <h3>📦 Инвентарь</h3>
              <button class="btn btn-secondary" onclick="loadInventory()">🎒 Открыть</button>
            </div>
          \`;
          break;
          
        case 'craft':
          content.innerHTML = \`
            <div class="card">
              <h3>🔨 Крафт</h3>
              <button class="btn btn-primary" onclick="craftItem('пластина')">🔩 Железная пластина</button>
              <button class="btn btn-primary" onclick="craftItem('бур_обычный')">⚙️ Обычный бур</button>
              <button class="btn btn-primary" onclick="craftItem('бур_усиленный')">🔩 Усиленный бур</button>
              <button class="btn btn-primary" onclick="craftItem('бур_алмазный')">💎 Алмазный бур</button>
              <button class="btn btn-primary" onclick="craftItem('вышка_нефтяная')">🛢️ Нефтяная вышка</button>
            </div>
          \`;
          break;
          
        case 'guild':
          const gData = await apiCall('GET', '/guild/' + userId);
          if (gData.success) {
            content.innerHTML = \`
              <div class="card">
                <h3>👥 \${gData.name} [Ур. \${gData.level}]</h3>
                <p>❤️ HP: \${gData.hp}</p>
                <p>💰 Казна: \${formatNum(gData.treasury)}</p>
                <p>👤 Участников: \${gData.members}</p>
                <p>👑 Глава: \${gData.ownerName}</p>
                <button class="btn btn-primary" onclick="depositTreasury()">💰 В казну</button>
                <button class="btn btn-secondary" onclick="inviteToGuild()">📨 Пригласить</button>
                <button class="btn btn-danger" onclick="leaveGuild()">🚪 Покинуть</button>
              </div>
            \`;
          } else {
            content.innerHTML = \`
              <div class="card">
                <h3>👥 Бригады</h3>
                <p style="color:#aaa">Вы не в бригаде</p>
                <button class="btn btn-primary" onclick="createGuild()">Создать бригаду</button>
                <button class="btn btn-secondary" onclick="acceptInvite()">Принять приглашение</button>
              </div>
            \`;
          }
          break;
          
        case 'pvp':
          content.innerHTML = \`
            <div class="card">
              <h3>⚔️ PvP</h3>
              <button class="btn btn-primary" onclick="startDuel()">⚔️ Дуэль</button>
              <button class="btn btn-secondary" onclick="activatePeace()">🕊️ Перемирие (5000💰)</button>
            </div>
          \`;
          break;
          
        case 'market':
          const mData = await apiCall('GET', '/market');
          let marketHTML = '<div class="card"><h3>📦 Рынок</h3>';
          if (mData.success && mData.listings.length > 0) {
            mData.listings.forEach(l => {
              marketHTML += \`<div class="list-item">
                <span>\${l.itemName} ×\${l.quantity} — \${formatNum(l.price)}💰/шт</span>
                <button class="btn btn-primary" style="width:auto;padding:8px 16px;font-size:12px" onclick="buyMarket(\${l.id})">Купить</button>
              </div>\`;
            });
          } else {
            marketHTML += '<p style="color:#aaa">Нет товаров</p>';
          }
          marketHTML += '</div>';
          content.innerHTML = marketHTML;
          break;
          
        case 'profile':
          content.innerHTML = \`
            <div class="card">
              <h3>👤 Профиль</h3>
              <p>💰 Баланс: \${formatNum(p.balance)}</p>
              <p>❤️ Стамина: \${p.stamina}/\${p.maxStamina}</p>
              <p>⛏️ Кирка: ур. \${p.pickaxeLvl}</p>
              <p>⚔️ Рейтинг: \${p.battleRating}</p>
              <p>👤 Класс: \${p.playerClass || 'не выбран'}</p>
              <p>👥 Бригада: \${p.guildName}</p>
              <p>⭐ Крафт: \${p.craftLevel}</p>
              <p>📊 Работ: \${p.workCount}</p>
              <p>🦠 Статус: \${p.virus === 1 ? 'Болен' : p.vaccineEnd > Date.now() ? 'Защищён' : 'Здоров'}</p>
              <button class="btn btn-primary" onclick="setClass()">👤 Выбрать класс</button>
            </div>
          \`;
          break;
      }
    }

    // Действия
    async function doWork() {
      const res = await apiCall('POST', '/work', { uid: userId });
      if (res.success) {
        let msg = \`⛏️ + \${formatNum(res.income)} монет! Стамина: \${res.newStamina}/\${res.maxStamina}\`;
        if (res.ores.length > 0) msg += ' | Руда: ' + res.ores.map(o => o.emoji + o.name + 'x' + o.qty).join(', ');
        showToast(msg, 'success');
        loadProfile();
      } else {
        showToast(res.error, 'error');
      }
    }

    async function doRest() {
      const res = await apiCall('POST', '/rest', { uid: userId });
      if (res.success) showToast(\`😴 Стамина восстановлена!\`, 'success');
      else showToast(res.error, 'error');
      loadProfile();
    }

    async function doBlackWork() {
      const res = await apiCall('POST', '/black-work', { uid: userId });
      if (res.success) {
        if (res.caught) showToast('🚨 Поймали! Вы в тюрьме!', 'error');
        else showToast(\`🦹 + \${formatNum(res.income)} монет! Контрабанда: \${res.contraband}\`, 'success');
        loadProfile();
      } else showToast(res.error, 'error');
    }

    async function doSteal() {
      const targetId = prompt('ID жертвы (или оставьте пустым для случайной):');
      const res = await apiCall('POST', '/steal', { uid: userId, targetId: targetId ? parseInt(targetId) : null });
      if (res.success) {
        if (res.stealSuccess) showToast(\`🎭 Украдено \${formatNum(res.stolen)} монет!\`, 'success');
        else showToast(\`Поймали! Штраф \${formatNum(res.fine)} монет\`, 'error');
        loadProfile();
      } else showToast(res.error, 'error');
    }

    async function collectDrills() {
      const res = await apiCall('POST', '/collect-drills', { uid: userId });
      if (res.success) { showToast(\`💰 Собрано \${formatNum(res.earned)} монет!\`, 'success'); loadProfile(); }
      else showToast(res.error, 'error');
    }

    async function collectOil() {
      const res = await apiCall('POST', '/collect-oil', { uid: userId });
      if (res.success) { showToast(\`🛢️ Собрано \${formatNum(res.earned)} монет!\`, 'success'); loadProfile(); }
      else showToast(res.error, 'error');
    }

    async function getDailyBonus() {
      const res = await apiCall('POST', '/daily-bonus', { uid: userId });
      if (res.success) { showToast(\`🎁 Бонус получен!\`, 'success'); loadProfile(); }
      else showToast(res.error, 'error');
    }

    async function buyItem(item, qty) {
      const res = await apiCall('POST', '/buy-item', { uid: userId, item, qty });
      if (res.success) { showToast(\`✅ Куплено: \${item}\`, 'success'); loadProfile(); }
      else showToast(res.error, 'error');
    }

    async function upgradePickaxe() {
      const res = await apiCall('POST', '/pickaxe', { uid: userId });
      if (res.success) { showToast(\`⛏️ Кирка улучшена до ур. \${res.newLevel}!\`, 'success'); loadProfile(); }
      else showToast(res.error, 'error');
    }

    async function buyDrill() {
      const res = await apiCall('POST', '/buy-drill', { uid: userId, qty: 1 });
      if (res.success) { showToast('⚙️ Бур куплен!', 'success'); loadProfile(); }
      else showToast(res.error, 'error');
    }

    async function buyOil() {
      const res = await apiCall('POST', '/buy-oil', { uid: userId, qty: 1 });
      if (res.success) { showToast('🛢️ Вышка куплена!', 'success'); loadProfile(); }
      else showToast(res.error, 'error');
    }

    async function craftItem(item) {
      const res = await apiCall('POST', '/craft', { uid: userId, item });
      if (res.success) { showToast(\`🔨 Скрафчено: \${item}\`, 'success'); loadProfile(); }
      else showToast(res.error || 'Ошибка крафта', 'error');
    }

    async function createGuild() {
      const name = prompt('Название бригады:');
      if (!name) return;
      const res = await apiCall('POST', '/create-guild', { uid: userId, name });
      if (res.success) { showToast('✅ Бригада создана!', 'success'); loadProfile(); }
      else showToast(res.error, 'error');
    }

    async function inviteToGuild() {
      const targetId = prompt('ID игрока:');
      if (!targetId) return;
      const res = await apiCall('POST', '/invite-guild', { uid: userId, targetId: parseInt(targetId) });
      if (res.success) showToast('✅ Приглашение отправлено!', 'success');
      else showToast(res.error, 'error');
    }

    async function acceptInvite() {
      const res = await apiCall('POST', '/accept-invite', { uid: userId });
      if (res.success) { showToast('✅ Вступили в бригаду!', 'success'); loadProfile(); }
      else showToast(res.error, 'error');
    }

    async function depositTreasury() {
      const amount = parseInt(prompt('Сумма:'));
      if (!amount || amount <= 0) return;
      const res = await apiCall('POST', '/treasury-deposit', { uid: userId, amount });
      if (res.success) { showToast('💰 Внесено в казну!', 'success'); loadProfile(); }
      else showToast(res.error, 'error');
    }

    async function leaveGuild() {
      if (!confirm('Покинуть бригаду?')) return;
      const res = await apiCall('POST', '/leave-guild', { uid: userId });
      if (res.success) { showToast('Вы покинули бригаду', 'success'); loadProfile(); }
      else showToast(res.error, 'error');
    }

    async function startDuel() {
      const targetId = parseInt(prompt('ID противника:'));
      const bet = parseInt(prompt('Ставка:'));
      if (!targetId || !bet || bet <= 0) return;
      const res = await apiCall('POST', '/duel', { uid: userId, targetId, bet });
      if (res.success) showToast('⚔️ Вызов отправлен!', 'success');
      else showToast(res.error, 'error');
    }

    async function activatePeace() {
      const res = await apiCall('POST', '/peace', { uid: userId });
      if (res.success) { showToast('🕊️ Режим мира активирован!', 'success'); loadProfile(); }
      else showToast(res.error, 'error');
    }

    async function buyMarket(lotId) {
      const res = await apiCall('POST', '/market-buy', { uid: userId, lotId });
      if (res.success) { showToast(\`✅ Куплено: \${res.itemName} ×\${res.quantity}\`, 'success'); loadProfile(); }
      else showToast(res.error, 'error');
    }

    async function setClass() {
      const className = prompt('Класс (шахтёр, инженер, нефтяник, врач, бригадир):');
      if (!className) return;
      const res = await apiCall('POST', '/set-class', { uid: userId, className: className.toLowerCase() });
      if (res.success) { showToast('👤 Класс выбран!', 'success'); loadProfile(); }
      else showToast(res.error, 'error');
    }

    async function loadInventory() {
      const res = await apiCall('GET', '/inventory/' + userId);
      if (res.success) {
        const items = res.items.map(i => \`\${i.item}: \${i.quantity} шт.\`).join('\\n');
        alert('🎒 Инвентарь:\\n' + (items || 'Пусто'));
      }
    }

    // Запуск
    loadProfile();
  </script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════
//  ЗАПУСК СЕРВЕРА
// ═══════════════════════════════════════════════════════════
(async () => {
  try {
    await initDB();
    startKeepalive();
    startEpidemicChecker();
    
    // Запуск бота сообщества
    await vk.updates.start();
    console.log('🤖 Бот сообщества запущен (админ-команды + Инфа)');

    // Запуск Express
    app.listen(PORT, () => {
      console.log(`🌐 Сервер запущен на порту ${PORT}`);
      console.log(`📱 Mini App: http://localhost:${PORT}/app`);
    });
  } catch (err) {
    console.error('❌ Ошибка запуска:', err);
    process.exit(1);
  }
})();