'use strict';

const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({
  connectionString: config.DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 60_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => console.error('pg pool error:', err.message));

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      user_id BIGINT PRIMARY KEY, balance BIGINT DEFAULT 0, stamina INT DEFAULT 100,
      pickaxe_lvl INT DEFAULT 1, drills INT DEFAULT 0, oil_rigs INT DEFAULT 0,
      last_work BIGINT DEFAULT 0, last_rest BIGINT DEFAULT 0, last_drill BIGINT DEFAULT 0,
      last_oil BIGINT DEFAULT 0, guild_id INT DEFAULT NULL, last_black BIGINT DEFAULT 0,
      jail_until BIGINT DEFAULT 0, has_roof BOOLEAN DEFAULT FALSE, last_steal BIGINT DEFAULT 0,
      last_daily BIGINT DEFAULT 0, hidden BOOLEAN DEFAULT FALSE, banned BOOLEAN DEFAULT FALSE,
      virus INT DEFAULT 0, virus_end BIGINT DEFAULT 0, vaccine_end BIGINT DEFAULT 0,
      player_class VARCHAR(32) DEFAULT NULL, is_admin BOOLEAN DEFAULT FALSE,
      work_count INT DEFAULT 0, craft_level INT DEFAULT 1,
      drills_enhanced INT DEFAULT 0, drills_diamond INT DEFAULT 0,
      battle_rating INT DEFAULT 0, referral_code VARCHAR(16) UNIQUE, referred_by BIGINT DEFAULT NULL
    );
    CREATE TABLE IF NOT EXISTS guilds (
      id SERIAL PRIMARY KEY, name VARCHAR(64) UNIQUE NOT NULL,
      owner_id BIGINT NOT NULL, deputy_id BIGINT DEFAULT NULL,
      treasury BIGINT DEFAULT 0, guild_balance BIGINT DEFAULT 0,
      level INT DEFAULT 1, xp INT DEFAULT 0,
      war_points INT DEFAULT 0, last_raid BIGINT DEFAULT 0, last_war BIGINT DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS guild_invites (user_id BIGINT PRIMARY KEY, guild_id INT NOT NULL);
    CREATE TABLE IF NOT EXISTS inventory (user_id BIGINT, item VARCHAR(32), quantity INT DEFAULT 0, PRIMARY KEY (user_id, item));
    CREATE TABLE IF NOT EXISTS promo_codes (
      code VARCHAR(64) PRIMARY KEY, reward_type VARCHAR(16) NOT NULL,
      reward_amount INT NOT NULL, max_uses INT DEFAULT 1, uses INT DEFAULT 0,
      created_by BIGINT NOT NULL, active BOOLEAN DEFAULT TRUE
    );
    CREATE TABLE IF NOT EXISTS promo_uses (user_id BIGINT, code VARCHAR(64), PRIMARY KEY (user_id, code));
    CREATE TABLE IF NOT EXISTS chat_activity (chat_id BIGINT, user_id BIGINT, work_count INT DEFAULT 0, last_work BIGINT DEFAULT 0, PRIMARY KEY (chat_id, user_id));
    CREATE TABLE IF NOT EXISTS market_listings (
      id SERIAL PRIMARY KEY, seller_id BIGINT NOT NULL, item_type VARCHAR(32) NOT NULL,
      item_name VARCHAR(64) NOT NULL, quantity INT NOT NULL, price BIGINT NOT NULL,
      listed_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
    );
    CREATE TABLE IF NOT EXISTS destroyed_equipment (
      owner_id BIGINT NOT NULL, equipment_type VARCHAR(32) NOT NULL,
      destroyed_at BIGINT NOT NULL, repair_until BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS punishment_history (
      id SERIAL PRIMARY KEY, user_id BIGINT NOT NULL, type VARCHAR(32) NOT NULL,
      until BIGINT NOT NULL, reason TEXT, issued_by BIGINT NOT NULL,
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
    );
  `);

  await pool.query('ALTER TABLE guilds ADD COLUMN IF NOT EXISTS deputy_id BIGINT DEFAULT NULL');
  await pool.query('ALTER TABLE guilds ADD COLUMN IF NOT EXISTS guild_balance BIGINT DEFAULT 0');
  await pool.query('UPDATE players SET is_admin = TRUE WHERE user_id = $1', [config.ADMIN_ID]);
  console.log('✅ БД готова');
}

function sanitize(p) {
  if (!p) return null;
  ['balance','stamina','pickaxe_lvl','drills','oil_rigs','last_work','last_rest','last_drill','last_oil','last_black','jail_until','last_steal','last_daily','virus','virus_end','vaccine_end','work_count','craft_level','drills_enhanced','drills_diamond','battle_rating'].forEach(f => p[f] = Number(p[f] ?? 0));
  p.stamina = p.stamina || 100;
  p.pickaxe_lvl = p.pickaxe_lvl || 1;
  p.craft_level = p.craft_level || 1;
  p.has_roof = Boolean(p.has_roof);
  p.hidden = Boolean(p.hidden);
  p.banned = Boolean(p.banned);
  p.is_admin = Boolean(p.is_admin);
  p.guild_id = p.guild_id ? Number(p.guild_id) : null;
  p.referred_by = p.referred_by ? Number(p.referred_by) : null;
  return p;
}

async function getPlayer(uid) {
  const r = await pool.query('SELECT * FROM players WHERE user_id=$1', [uid]);
  return r.rows[0] ? sanitize(r.rows[0]) : null;
}

async function getOrCreate(uid) {
  const code = generateReferralCode();
  await pool.query('INSERT INTO players (user_id, referral_code) VALUES ($1,$2) ON CONFLICT DO NOTHING', [uid, code]);
  return getPlayer(uid);
}

function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let c = '';
  for (let i = 0; i < 8; i++) c += chars.charAt(Math.floor(Math.random() * chars.length));
  return c;
}

async function addItem(uid, item, qty) {
  await pool.query('INSERT INTO inventory(user_id,item,quantity) VALUES($1,$2,$3) ON CONFLICT(user_id,item) DO UPDATE SET quantity=inventory.quantity+$3', [uid, item, qty]);
}

async function getItemQty(uid, item) {
  const r = await pool.query('SELECT quantity FROM inventory WHERE user_id=$1 AND item=$2', [uid, item]);
  return Number(r.rows[0]?.quantity ?? 0);
}

async function removeItem(uid, item, qty) {
  await pool.query('UPDATE inventory SET quantity=quantity-$1 WHERE user_id=$2 AND item=$3 AND quantity>=$1', [qty, uid, item]);
}

async function getGuildHP(guildId) {
  const gr = await pool.query('SELECT level FROM guilds WHERE id=$1', [guildId]);
  if (!gr.rows[0]) return 0;
  const m = await pool.query('SELECT COUNT(*) as c FROM players WHERE guild_id=$1', [guildId]);
  return Number(gr.rows[0].level) * 1000 + Number(m.rows[0]?.c || 0) * 100;
}

async function isDeputy(uid, guildId) {
  const gr = await pool.query('SELECT deputy_id FROM guilds WHERE id=$1', [guildId]);
  return gr.rows[0] && Number(gr.rows[0].deputy_id) === uid;
}

async function getDestroyedCount(uid, type) {
  const now = Date.now();
  const r = await pool.query('SELECT COUNT(*) as c FROM destroyed_equipment WHERE owner_id=$1 AND equipment_type=$2 AND repair_until>$3', [uid, type, now]);
  return Number(r.rows[0]?.c || 0);
}

async function getAvailableEquipment(uid) {
  const p = await getPlayer(uid);
  if (!p) return [];
  const eq = [];
  const checks = [
    { field: 'drills', type: 'drill', name: 'Обычный бур' },
    { field: 'drills_enhanced', type: 'drill_enhanced', name: 'Усиленный бур' },
    { field: 'drills_diamond', type: 'drill_diamond', name: 'Алмазный бур' },
    { field: 'oil_rigs', type: 'oil_rig', name: 'Нефтяная вышка' },
  ];
  for (const c of checks) {
    if (p[c.field] > 0) {
      const destroyed = await getDestroyedCount(uid, c.type);
      const avail = p[c.field] - destroyed;
      if (avail > 0) eq.push({ type: c.type, name: c.name, available: avail });
    }
  }
  return eq;
}

async function calcPassiveInfo(uid) {
  const p = await getPlayer(uid);
  if (!p) return { activeDrills:0, activeEnhanced:0, activeDiamond:0, activeRigs:0, drillIncomePerHour:0, drillPending:0, oilIncomePerHour:0, oilPending:0, totalDrills:0, totalEnhanced:0, totalDiamond:0, totalRigs:0, engineerBonus:0, oilBonus:0 };
  const now = Date.now();
  const dd = await getDestroyedCount(uid, 'drill');
  const de = await getDestroyedCount(uid, 'drill_enhanced');
  const ddi = await getDestroyedCount(uid, 'drill_diamond');
  const dr = await getDestroyedCount(uid, 'oil_rig');
  const ad = p.drills - dd;
  const ae = p.drills_enhanced - de;
  const adi = p.drills_diamond - ddi;
  const ar = p.oil_rigs - dr;
  const eb = p.player_class === 'инженер' ? 0.25 : 0;
  const ob = p.player_class === 'нефтяник' ? 0.30 : 0;
  const dh = Math.min((now - p.last_drill)/3600000, 24);
  const oh = Math.min((now - p.last_oil)/3600000, 24);
  let dph = 0, dp = 0, oph = 0, op = 0;
  const state = require('./state');
  if (ad > 0) { let inc = 50; if (eb) inc = Math.floor(inc*(1+eb)); dph += inc*ad; dp += Math.floor(dh*inc*ad); }
  if (ae > 0) { let inc = 100; if (eb) inc = Math.floor(inc*(1+eb)); dph += inc*ae; dp += Math.floor(dh*inc*ae); }
  if (adi > 0) { let inc = 250; if (eb) inc = Math.floor(inc*(1+eb)); dph += inc*adi; dp += Math.floor(dh*inc*adi); }
  if (ar > 0) { let inc = 100; if (ob) inc = Math.floor(inc*1.30); oph = inc*ar; op = Math.floor(oh*inc*ar); }
  if (state.globalEpidemic && p.virus !== 2) { dp = Math.floor(dp*0.5); op = Math.floor(op*0.5); }
  return { activeDrills:ad, activeEnhanced:ae, activeDiamond:adi, activeRigs:ar, drillIncomePerHour:dph, drillPending:dp, oilIncomePerHour:oph, oilPending:op, totalDrills:p.drills, totalEnhanced:p.drills_enhanced, totalDiamond:p.drills_diamond, totalRigs:p.oil_rigs, engineerBonus:eb, oilBonus:ob };
}

module.exports = { pool, initDB, sanitize, getPlayer, getOrCreate, generateReferralCode, addItem, getItemQty, removeItem, getGuildHP, isDeputy, getDestroyedCount, getAvailableEquipment, calcPassiveInfo };
