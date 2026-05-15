const { VK } = require('vk-io');
const { Pool } = require('pg');

// ==================== НАСТРОЙКИ ====================
const VK_TOKEN = 'vk1.a.9Cz33HlOTGgmW-SqIqlfuqcU8OLcF7gWWN3EA-vHRqwNd3dfcsYbl7H-0URxB5NZ7TS4wJtO5hfRQysuUqYcUJ9IYS2eUrPeTVo4g1qdq88c1i4N8TX9rmYlKCdN1tb_kVG9EGla9hF2A4B1E7o849lkplCRO5dP8pnpPyVjjy9LrgElisIwqCRVF89hhoD_d1ufHmK_t89l3bhavvRYcw';
const GROUP_ID = 231991465;
const ADMIN_ID = 660964860;
const MAX_LEVEL = 1500;

// ==================== БАЗА ДАННЫХ ====================
let pool;
let isDbConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 50;
const RECONNECT_DELAY = 5000;

async function createPool() {
    pool = new Pool({
        user: 'neondb_owner',
        password: 'npg_GTCkzIdrgN63',
        host: 'ep-lively-lake-aljgwbr0.c-3.eu-central-1.aws.neon.tech',
        port: 5432,
        database: 'neondb',
        ssl: { rejectUnauthorized: false },
        max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000,
    });
    pool.on('error', (err) => { console.error('❌ Пул:', err.message); isDbConnected = false; if (['57P01','57P02','57P03','08006','08001'].includes(err.code)) reconnectToDb(); });
    await testConnection();
}

async function testConnection() {
    try { const c = await pool.connect(); await c.query('SELECT 1'); c.release(); isDbConnected = true; reconnectAttempts = 0; console.log('✅ PostgreSQL'); } catch (e) { console.error('❌:', e.message); isDbConnected = false; reconnectToDb(); }
}

async function reconnectToDb() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
    reconnectAttempts++;
    console.log(`🔄 ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...`);
    await new Promise(r => setTimeout(r, RECONNECT_DELAY));
    try { if (pool) await pool.end().catch(() => {}); } catch (e) {}
    await createPool();
}

async function executeQuery(query, params = []) {
    for (let a = 0; a < 3; a++) {
        if (!isDbConnected) { await reconnectToDb(); if (!isDbConnected) throw new Error('БД недоступна'); }
        try { return await pool.query(query, params); } catch (e) {
            console.error(`❌ Запрос (${a+1}):`, e.message);
            if (['57P01','57P02','57P03','08006','08001','ECONNREFUSED','ETIMEDOUT'].includes(e.code)) { isDbConnected = false; await reconnectToDb(); if (!isDbConnected && a === 2) throw e; continue; }
            throw e;
        }
    }
}

// ==================== ТАБЛИЦЫ ====================
async function createTables() {
    const qs = [
        `CREATE TABLE IF NOT EXISTS users (vk_id BIGINT PRIMARY KEY, name TEXT DEFAULT '', balance_dollar DECIMAL DEFAULT 0, balance_coin INTEGER DEFAULT 0, level INTEGER DEFAULT 1, xp INTEGER DEFAULT 0, total_views BIGINT DEFAULT 0, total_likes BIGINT DEFAULT 0, referrals INTEGER DEFAULT 0, referrer BIGINT, fake_subs INTEGER DEFAULT 0, last_daily BIGINT DEFAULT 0, last_collect BIGINT DEFAULT 0, created_at BIGINT DEFAULT 0, is_banned BOOLEAN DEFAULT FALSE, role TEXT DEFAULT 'blogger', collab_until BIGINT DEFAULT 0, viral_until BIGINT DEFAULT 0, extra_slot BOOLEAN DEFAULT FALSE, last_name_update BIGINT DEFAULT 0, vip_level INTEGER DEFAULT 0, vip_until BIGINT DEFAULT 0, subscribers INTEGER DEFAULT 0, clan_id BIGINT, clan_role TEXT DEFAULT 'member')`,
        `CREATE TABLE IF NOT EXISTS clans (id SERIAL PRIMARY KEY, name TEXT, leader BIGINT, level INTEGER DEFAULT 1, xp INTEGER DEFAULT 0, total_xp INTEGER DEFAULT 0, emoji TEXT DEFAULT '', color TEXT DEFAULT '', frame TEXT DEFAULT '', prefix BOOLEAN DEFAULT FALSE, created_at BIGINT DEFAULT 0)`,
        `CREATE TABLE IF NOT EXISTS videos (id SERIAL PRIMARY KEY, owner BIGINT, title TEXT, views INTEGER DEFAULT 0, likes INTEGER DEFAULT 0, is_collected BOOLEAN DEFAULT FALSE, is_frozen BOOLEAN DEFAULT FALSE, created_at BIGINT DEFAULT 0, likes_today INTEGER DEFAULT 0, last_likes_reset BIGINT DEFAULT 0, ad_until BIGINT DEFAULT 0)`,
        `CREATE TABLE IF NOT EXISTS daily_quests (user_id BIGINT PRIMARY KEY, quest1_done BOOLEAN DEFAULT FALSE, quest2_count INTEGER DEFAULT 0, quest2_done BOOLEAN DEFAULT FALSE, quest3_done BOOLEAN DEFAULT FALSE, date BIGINT DEFAULT 0)`,
        `CREATE TABLE IF NOT EXISTS achievements (user_id BIGINT, achievement_id TEXT, PRIMARY KEY (user_id, achievement_id))`,
        `CREATE TABLE IF NOT EXISTS promocodes (code TEXT PRIMARY KEY, reward_type TEXT, reward_amount INTEGER, max_uses INTEGER, uses INTEGER DEFAULT 0, created_by BIGINT, expires_at BIGINT DEFAULT 0)`,
        `CREATE TABLE IF NOT EXISTS used_promos (user_id BIGINT, promo_code TEXT, PRIMARY KEY (user_id, promo_code))`,
        `CREATE TABLE IF NOT EXISTS transactions (id SERIAL PRIMARY KEY, user_id BIGINT, amount_dollar DECIMAL DEFAULT 0, amount_coin INTEGER DEFAULT 0, type TEXT, created_at BIGINT DEFAULT 0)`
    ];
    for (const q of qs) { 
        try { 
            await executeQuery(q); 
        } catch(e) {
            console.error('❌ Ошибка создания таблицы:', e.message);
        }
    }
    console.log('✅ Таблицы проверены');
    
    // Добавляем колонки если их нет
    try { await executeQuery("ALTER TABLE users ADD COLUMN IF NOT EXISTS hide_from_top BOOLEAN DEFAULT FALSE"); } catch(e) {}
    try { await executeQuery("ALTER TABLE users ADD COLUMN IF NOT EXISTS vip_level INTEGER DEFAULT 0"); } catch(e) {}
    try { await executeQuery("ALTER TABLE users ADD COLUMN IF NOT EXISTS vip_until BIGINT DEFAULT 0"); } catch(e) {}
    try { await executeQuery("ALTER TABLE users ADD COLUMN IF NOT EXISTS subscribers INTEGER DEFAULT 0"); } catch(e) {}
    try { await executeQuery("ALTER TABLE users ADD COLUMN IF NOT EXISTS clan_id BIGINT"); } catch(e) {}
    try { await executeQuery("ALTER TABLE users ADD COLUMN IF NOT EXISTS clan_role TEXT DEFAULT 'member'"); } catch(e) {}
    try { await executeQuery("ALTER TABLE videos ADD COLUMN IF NOT EXISTS likes_today INTEGER DEFAULT 0"); } catch(e) {}
    try { await executeQuery("ALTER TABLE videos ADD COLUMN IF NOT EXISTS last_likes_reset BIGINT DEFAULT 0"); } catch(e) {}
    try { await executeQuery("ALTER TABLE videos ADD COLUMN IF NOT EXISTS ad_until BIGINT DEFAULT 0"); } catch(e) {}
}

// ==================== VK БОТ ====================
const vk = new VK({ token: VK_TOKEN });

// ==================== КОНСТАНТЫ ====================
const videoTitles = ["Мой первый ролик! 🔥","Топ лайфхак дня 🎯","Смешной момент 🤣","Обзор трендов 📈","Как стать блогером? 🎬","Челлендж принят! 🏆"];
const roles = ['musician 🎤','humorist 🤣','streamer 🎮','journalist 📰','hater 👿','standoffer 🔫','blogger 📱','memer 🐸','reviewer 🎬','podcaster 🎙','gamer 🎮','asmr 🎧'];
const clanColors = { red: '🔴', blue: '🔵', green: '🟢', gold: '🟡', purple: '🟣', orange: '🟠', pink: '🌸', cyan: '🩵' };
const clanFrames = { gold: '✨', silver: '🔲', bronze: '🔸', diamond: '💠', star: '⭐', crown: '👑', fire: '🔥' };
const VIP_PRICES = { 1: 500, 2: 1500, 3: 5000 };
const VIP_MULTIPLIERS = { 1: 1.5, 2: 2, 3: 3 };

// Формула подписчиков: 1 подписчик на каждые 5 просмотров
const SUBSCRIBERS_PER_VIEWS = 5;

// ==================== ВРЕМЯ МСК ====================
function getMskDate() { return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' })); }
function getMskHour() { return getMskDate().getHours(); }
function getMskTimestamp() { return Math.floor(getMskDate().getTime() / 1000); }
function getMskTodayStart() { const d = getMskDate(); d.setHours(0,0,0,0); return Math.floor(d.getTime()/1000); }
function getMskWeekStart() { const d = getMskDate(); d.setHours(0,0,0,0); d.setDate(d.getDate()-d.getDay()); return Math.floor(d.getTime()/1000); }
function getMskMonthStart() { const d = getMskDate(); d.setHours(0,0,0,0); d.setDate(1); return Math.floor(d.getTime()/1000); }
function getMskYearStart() { const d = getMskDate(); d.setHours(0,0,0,0); d.setMonth(0,1); return Math.floor(d.getTime()/1000); }

function getTimeMultiplier() {
    const h = getMskHour();
    if (h < 7) return 0.4; if (h < 10) return 0.7; if (h < 14) return 1.0;
    if (h < 18) return 1.2; if (h < 21) return 1.5; if (h < 23) return 1.8; return 1.3;
}

function getXpForLevel(l) { return l >= MAX_LEVEL ? Infinity : l * 100; }
function getClanXpForLevel(l) { return l >= MAX_LEVEL ? Infinity : Math.floor(100 * l * (1 + l / 100)); }
function getRandomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function extractId(msg) {
    const m1 = msg.match(/\[id(\d+)\|/);
    if (m1) return parseInt(m1[1]);
    const m2 = msg.match(/@id(\d+)/);
    if (m2) return parseInt(m2[1]);
    const parts = msg.split(' ');
    for (const p of parts) {
        const n = parseInt(p);
        if (!isNaN(n) && n > 0 && n.toString().length > 5) return n;
    }
    return null;
}

async function addTransaction(userId, d, c, type) {
    await executeQuery('INSERT INTO transactions (user_id, amount_dollar, amount_coin, type, created_at) VALUES ($1,$2,$3,$4,$5)', [userId, d, c, type, getMskTimestamp()]);
}

// Функция для добавления подписчиков на основе просмотров
function calculateSubscribers(views) {
    return Math.floor(views / SUBSCRIBERS_PER_VIEWS);
}

function calculateLikes(views, collabUntil = 0) {
    const cm = (collabUntil > getMskTimestamp()) ? 1.2 : 1;
    const l = Math.floor((views * getRandomInt(2,4) / 100) * cm);
    return Math.max(l, views >= 100 ? Math.floor(views/50) : (views >= 25 ? 1 : 0));
}

async function getClanBonus(clanId) {
    if (!clanId) return { views: 0, likes: 0, subs: 0, viral: 0, income: 0 };
    const clan = (await executeQuery('SELECT level FROM clans WHERE id = $1', [clanId])).rows[0];
    if (!clan) return { views: 0, likes: 0, subs: 0, viral: 0, income: 0 };
    const lvl = clan.level;
    return { views: lvl * 0.05, likes: lvl * 0.03, subs: lvl * 0.02, viral: Math.min(lvl * 0.002, 3), income: lvl * 0.04 };
}

async function addClanXp(clanId, amount) {
    if (!clanId) return;
    let clan = (await executeQuery('SELECT * FROM clans WHERE id = $1', [clanId])).rows[0];
    if (!clan) return;
    let nx = clan.xp + amount;
    let nt = (clan.total_xp || 0) + amount;
    let nl = clan.level;
    while (nx >= getClanXpForLevel(nl) && nl < MAX_LEVEL) { 
        nx -= getClanXpForLevel(nl); 
        nl++; 
    }
    await executeQuery('UPDATE clans SET xp = $1, level = $2, total_xp = $3 WHERE id = $4', [nx, nl, nt, clanId]);
}

async function getVipMultiplier(userId) {
    const u = await executeQuery('SELECT vip_level, vip_until FROM users WHERE vk_id = $1', [userId]);
    if (!u.rows[0] || u.rows[0].vip_level === 0) return 1;
    if (u.rows[0].vip_until < getMskTimestamp()) {
        await executeQuery('UPDATE users SET vip_level = 0, vip_until = 0 WHERE vk_id = $1', [userId]);
        return 1;
    }
    return VIP_MULTIPLIERS[u.rows[0].vip_level] || 1;
}

// ==================== ПОЛЬЗОВАТЕЛЬ ====================
async function getUser(vkId, forceUpdate = false) {
    const r = await executeQuery('SELECT * FROM users WHERE vk_id = $1', [vkId]);
    if (r.rows.length === 0) {
        const role = roles[Math.floor(Math.random()*roles.length)];
        const now = getMskTimestamp();
        let name = '';
        try { const [d] = await vk.api.users.get({user_ids:[vkId]}); name = d.first_name+' '+d.last_name; } catch(e) { name = 'id'+vkId; }
        await executeQuery('INSERT INTO users (vk_id, name, role, created_at, last_name_update) VALUES ($1,$2,$3,$4,$5)', [vkId, name, role, now, now]);
        return (await executeQuery('SELECT * FROM users WHERE vk_id = $1', [vkId])).rows[0];
    }
    const u = r.rows[0];
    const now = getMskTimestamp();
    if (forceUpdate || !u.name || (now - (u.last_name_update||0)) > 3600) {
        try {
            const [d] = await vk.api.users.get({user_ids:[vkId]});
            const nm = d.first_name+' '+d.last_name;
            if (nm !== u.name) { 
                await executeQuery('UPDATE users SET name=$1, last_name_update=$2 WHERE vk_id=$3', [nm, now, vkId]); 
                u.name = nm; 
            }
        } catch(e) { 
            if (!u.name) u.name = 'id'+vkId; 
        }
    }
    if (u.vip_level > 0 && u.vip_until < now) {
        await executeQuery('UPDATE users SET vip_level=0, vip_until=0 WHERE vk_id=$1', [vkId]);
        u.vip_level = 0; 
        u.vip_until = 0;
    }
    return u;
}

async function addViewsAndLikes(videoId, views, userId, collabUntil = 0) {
    const vip = await getVipMultiplier(userId);
    const cb = await getClanBonus((await getUser(userId)).clan_id);
    const tv = Math.floor(views * vip * (1 + cb.views/100));
    const likes = calculateLikes(tv, collabUntil);
    const newSubs = calculateSubscribers(tv);
    
    await executeQuery('UPDATE videos SET views=views+$1, likes=likes+$2, likes_today=likes_today+$2 WHERE id=$3', [tv, likes, videoId]);
    await executeQuery('UPDATE users SET total_views=total_views+$1, total_likes=total_likes+$2, subscribers=COALESCE(subscribers,0)+$3 WHERE vk_id=$4', [tv, likes, newSubs, userId]);
    if (likes > 0) await addXp(userId, likes);
    const ts = getMskTodayStart();
    const v = (await executeQuery('SELECT last_likes_reset FROM videos WHERE id=$1', [videoId])).rows[0];
    if (!v || !v.last_likes_reset || v.last_likes_reset < ts)
        await executeQuery('UPDATE videos SET likes_today=$1, last_likes_reset=$2 WHERE id=$3', [likes, getMskTimestamp(), videoId]);
    await checkLikesQuest(userId);
    return { likes, newSubs };
}

async function addXp(vkId, amount) {
    const u = await getUser(vkId);
    if (u.level >= MAX_LEVEL) return { newLevel: u.level, levelUp: false };
    let nx = u.xp + amount;
    let nl = u.level;
    while (nx >= getXpForLevel(nl) && nl < MAX_LEVEL) { 
        nx -= getXpForLevel(nl); 
        nl++; 
    }
    if (nl > u.level) {
        const rewards = {
            2: [5, 0], 5: [20, 0], 10: [50, 0], 20: [100, 100], 
            50: [500, 0], 100: [1000, 200], 500: [5000, 500], 
            1000: [10000, 1000], 1500: [50000, 10000]
        };
        for (let l = u.level + 1; l <= nl; l++) {
            if (rewards[l]) {
                await executeQuery('UPDATE users SET balance_dollar=balance_dollar+$1, balance_coin=balance_coin+$2 WHERE vk_id=$3', [rewards[l][0], rewards[l][1], vkId]);
                await addTransaction(vkId, rewards[l][0], rewards[l][1], 'level_up');
            }
            if (l === 5) await executeQuery('UPDATE users SET fake_subs=fake_subs+1 WHERE vk_id=$1', [vkId]);
        }
    }
    await executeQuery('UPDATE users SET xp=$1, level=$2 WHERE vk_id=$3', [nx, nl, vkId]);
    const cu = await getUser(vkId);
    if (cu.clan_id) await addClanXp(cu.clan_id, Math.floor(amount * 0.5));
    return { newLevel: nl, levelUp: nl > u.level };
}

async function checkLikesQuest(userId) {
    const ts = getMskTodayStart();
    const q = await executeQuery('SELECT * FROM daily_quests WHERE user_id=$1 AND date=$2', [userId, ts]);
    if (q.rows.length === 0 || q.rows[0].quest3_done) return;
    const tl = (await executeQuery("SELECT COALESCE(SUM(likes_today),0) as t FROM videos WHERE owner=$1", [userId])).rows[0].t || 0;
    if (tl >= 100) await checkDailyQuest(userId, 3);
}

async function checkDailyQuest(userId, qNum) {
    const ts = getMskTodayStart();
    let q = await executeQuery('SELECT * FROM daily_quests WHERE user_id=$1 AND date=$2', [userId, ts]);
    if (q.rows.length === 0) { 
        await executeQuery('INSERT INTO daily_quests (user_id,date) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, ts]); 
        q = await executeQuery('SELECT * FROM daily_quests WHERE user_id=$1 AND date=$2', [userId, ts]); 
    }
    const d = q.rows[0];
    let reward = 0;
    if (qNum === 1 && !d.quest1_done) { 
        await executeQuery('UPDATE daily_quests SET quest1_done=TRUE WHERE user_id=$1 AND date=$2', [userId, ts]); 
        reward = 1; 
    } else if (qNum === 2) {
        const nc = (d.quest2_count || 0) + 1;
        if (nc >= 2 && !d.quest2_done) { 
            await executeQuery('UPDATE daily_quests SET quest2_count=$1, quest2_done=TRUE WHERE user_id=$2 AND date=$3', [nc, userId, ts]); 
            reward = 2; 
        } else if (!d.quest2_done) { 
            await executeQuery('UPDATE daily_quests SET quest2_count=$1 WHERE user_id=$2 AND date=$3', [nc, userId, ts]); 
        }
    } else if (qNum === 3 && !d.quest3_done) { 
        await executeQuery('UPDATE daily_quests SET quest3_done=TRUE WHERE user_id=$1 AND date=$2', [userId, ts]); 
        reward = 3; 
    }
    if (reward > 0) {
        await executeQuery('UPDATE users SET balance_dollar=balance_dollar+$1 WHERE vk_id=$2', [reward, userId]);
        await addTransaction(userId, reward, 0, 'daily_quest');
        await addXp(userId, 15);
        const u = await getUser(userId);
        if (u.clan_id) await addClanXp(u.clan_id, 3);
    }
    return reward;
}

async function checkAchievements(vkId) {
    const u = await getUser(vkId);
    const existing = (await executeQuery('SELECT achievement_id FROM achievements WHERE user_id=$1', [vkId])).rows.map(r => r.achievement_id);
    const list = [
        {id: 'first_video', n: 'Первое видео', c: 'Записать 1 видео', rd: 1, rc: 0},
        {id: 'popularity', n: 'Популярность', c: '10 000 просмотров', rd: 10, rc: 0},
        {id: 'like_master', n: 'Лайк-мастер', c: '1 000 лайков', rd: 20, rc: 0},
        {id: 'millionaire', n: 'Миллионер', c: '1 000 000 просмотров', rd: 500, rc: 100},
        {id: 'ref_killer', n: 'Реферальный король', c: '10 рефералов', rd: 100, rc: 0},
        {id: 'top_blogger', n: 'Топ-блогер', c: 'Попасть в топ-3', rd: 0, rc: 50},
        {id: 'level_10', n: 'Бывалый', c: '10 уровень', rd: 25, rc: 0},
        {id: 'level_50', n: 'Профи', c: '50 уровень', rd: 100, rc: 50},
        {id: 'level_100', n: 'Легенда', c: '100 уровень', rd: 250, rc: 100},
        {id: 'level_500', n: 'Босс', c: '500 уровень', rd: 1000, rc: 500},
        {id: 'level_1000', n: 'Император', c: '1000 уровень', rd: 5000, rc: 1000},
        {id: 'level_1500', n: 'Бог Тиктока', c: '1500 уровень', rd: 10000, rc: 5000},
    ];
    for (const a of list) {
        if (existing.includes(a.id)) continue;
        let earned = false;
        if (a.id === 'first_video') { 
            const c = (await executeQuery('SELECT COUNT(*) as cnt FROM videos WHERE owner=$1', [vkId])).rows[0].cnt; 
            if (c >= 1) earned = true; 
        } else if (a.id === 'popularity' && u.total_views >= 10000) earned = true;
        else if (a.id === 'like_master' && u.total_likes >= 1000) earned = true;
        else if (a.id === 'millionaire' && u.total_views >= 1000000) earned = true;
        else if (a.id === 'ref_killer' && u.referrals >= 10) earned = true;
        else if (a.id.startsWith('level_')) { 
            const lv = parseInt(a.id.split('_')[1]); 
            if (u.level >= lv) earned = true; 
        }
        if (earned) {
            await executeQuery('INSERT INTO achievements (user_id,achievement_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [vkId, a.id]);
            if (a.rd > 0) { 
                await executeQuery('UPDATE users SET balance_dollar=balance_dollar+$1 WHERE vk_id=$2', [a.rd, vkId]); 
                await addTransaction(vkId, a.rd, 0, 'achievement'); 
            }
            if (a.rc > 0) { 
                await executeQuery('UPDATE users SET balance_coin=balance_coin+$1 WHERE vk_id=$2', [a.rc, vkId]); 
                await addTransaction(vkId, 0, a.rc, 'achievement'); 
            }
        }
    }
}

async function checkTopBlogger(vkId) {
    const tb = await executeQuery('SELECT vk_id FROM users WHERE is_banned=FALSE AND hide_from_top=FALSE ORDER BY balance_dollar DESC LIMIT 3');
    const tv = await executeQuery('SELECT vk_id FROM users WHERE is_banned=FALSE AND hide_from_top=FALSE ORDER BY total_views DESC LIMIT 3');
    const tc = await executeQuery('SELECT vk_id FROM users WHERE is_banned=FALSE AND hide_from_top=FALSE ORDER BY balance_coin DESC LIMIT 3');
    const ids = new Set([...tb.rows, ...tv.rows, ...tc.rows].map(r => parseInt(r.vk_id)));
    if (ids.has(vkId)) {
        const ex = await executeQuery('SELECT * FROM achievements WHERE user_id=$1 AND achievement_id=$2', [vkId, 'top_blogger']);
        if (ex.rows.length === 0) {
            await executeQuery('INSERT INTO achievements (user_id,achievement_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [vkId, 'top_blogger']);
            await executeQuery('UPDATE users SET balance_coin=balance_coin+50 WHERE vk_id=$1', [vkId]);
            await addTransaction(vkId, 0, 50, 'achievement');
        }
    }
}

// ==================== АВТОЦИКЛ ====================
async function autoViewsLoop() {
    setInterval(async () => {
        if (!isDbConnected) return;
        try {
            const videos = await executeQuery(
                `SELECT v.*, u.fake_subs, u.viral_until, u.collab_until, u.clan_id, u.vip_level, u.vip_until, u.subscribers
                 FROM videos v JOIN users u ON v.owner=u.vk_id WHERE v.is_collected=FALSE AND v.is_frozen=FALSE`);
            for (const v of videos.rows) {
                const tm = getTimeMultiplier();
                let bv = getRandomInt(1,5);
                bv += Math.floor(v.fake_subs * 0.42);
                bv += Math.floor((v.subscribers||0) * 0.00083);
                const vc = (v.viral_until > getMskTimestamp()) ? 0.05 : 0.01;
                let vir = 0;
                if (Math.random() < vc) vir = getRandomInt(100,600);
                let tv = Math.floor((bv + vir) * tm);
                if (tv < 1) tv = 1;
                if (v.ad_until > getMskTimestamp()) tv += Math.floor(5000/2880);
                let vip = 1;
                if (v.vip_level > 0 && v.vip_until > getMskTimestamp()) vip = VIP_MULTIPLIERS[v.vip_level]||1;
                tv = Math.floor(tv * vip);
                const cb = await getClanBonus(v.clan_id);
                tv = Math.floor(tv * (1 + cb.views/100));
                const likes = calculateLikes(tv, v.collab_until);
                const newSubs = calculateSubscribers(tv);
                
                await executeQuery('UPDATE videos SET views=views+$1, likes=likes+$2, likes_today=likes_today+$2 WHERE id=$3',[tv,likes,v.id]);
                await executeQuery('UPDATE users SET total_views=total_views+$1, total_likes=total_likes+$2, subscribers=COALESCE(subscribers,0)+$3 WHERE vk_id=$4',[tv,likes,newSubs,v.owner]);
                if (likes>0) await addXp(v.owner, likes);
                const ts = getMskTodayStart();
                if (!v.last_likes_reset || v.last_likes_reset < ts)
                    await executeQuery('UPDATE videos SET likes_today=$1, last_likes_reset=$2 WHERE id=$3',[likes,getMskTimestamp(),v.id]);
                await checkLikesQuest(v.owner);
            }
        } catch(e) { console.error('❌ Автоцикл:', e.message); }
    }, 30000);
}

async function dailyQuestReset() {
    const now = Date.now();
    const mskNow = getMskDate();
    const next = new Date(mskNow);
    next.setHours(24,0,0,0);
    const ms = next.getTime() - mskNow.getTime();
    setTimeout(async () => {
        try { 
            if (isDbConnected) { 
                await executeQuery('DELETE FROM daily_quests WHERE date < $1', [getMskTodayStart()]); 
                await executeQuery("UPDATE videos SET likes_today=0, last_likes_reset=$1 WHERE last_likes_reset < $2", [getMskTimestamp(), getMskTodayStart()]); 
                console.log('🔄 Сброс заданий'); 
            } 
        } catch(e) {}
        dailyQuestReset();
    }, ms + 1000);
}

// ==================== РАССЫЛКА ====================
let isBroadcasting = false;
async function broadcastMessage(message) {
    if (isBroadcasting) return {success:false, error:'Уже идёт'};
    isBroadcasting = true;
    let ok=0, fail=0, offset=0;
    try {
        while(true) {
            const users = await executeQuery('SELECT vk_id FROM users WHERE is_banned=FALSE ORDER BY vk_id LIMIT 100 OFFSET $1', [offset]);
            if (users.rows.length===0) break;
            for (const r of users.rows) {
                try { 
                    await vk.api.messages.send({user_id:r.vk_id, message, random_id:Math.floor(Math.random()*1000000)}); 
                    ok++; 
                    await new Promise(r=>setTimeout(r,100)); 
                } catch(e) { fail++; }
            }
            offset += 100;
        }
    } catch(e) { console.error('Рассылка:', e.message); }
    isBroadcasting = false;
    return {success:true, successCount:ok, failCount:fail};
}

// ==================== ОБРАБОТКА КОМАНД ====================
vk.updates.on('message_new', async (ctx) => {
    const msg = ctx.text?.trim() || '';
    const userId = ctx.senderId;
    const lower = msg.toLowerCase();
    
    let user;
    try { user = await getUser(userId, true); } catch(e) { return ctx.send('❌ Ошибка БД'); }
    if (user.is_banned) return ctx.send('⛔ Вы забанены. Нарушители не могут играть.');
    
    const vkName = user.name || ('id'+userId);
    
    // Payload реферала
    if (ctx.messagePayload) {
        try {
            const p = JSON.parse(ctx.messagePayload);
            if (p.ref && parseInt(p.ref) !== userId && !user.referrer) {
                const ref = await getUser(parseInt(p.ref));
                if (ref && !ref.is_banned) {
                    await executeQuery('UPDATE users SET referrer=$1 WHERE vk_id=$2', [parseInt(p.ref), userId]);
                    await executeQuery('UPDATE users SET referrals=referrals+1, balance_dollar=balance_dollar+5, balance_coin=balance_coin+5 WHERE vk_id=$1', [parseInt(p.ref)]);
                    await addTransaction(parseInt(p.ref), 5, 5, 'referral');
                    await executeQuery('UPDATE users SET balance_dollar=balance_dollar+5 WHERE vk_id=$1', [userId]);
                    await addTransaction(userId, 5, 0, 'referral_bonus');
                    await addXp(parseInt(p.ref), 50);
                    const ru = await getUser(parseInt(p.ref));
                    if (ru.clan_id) await addClanXp(ru.clan_id, 10);
                    await checkAchievements(parseInt(p.ref));
                    await ctx.send('🎉 Вы перешли по реферальной ссылке! +$5 вам и другу!');
                }
            }
        } catch(e) {}
    }
    
    try {
        // ==================== СУТЬ ====================
        if (lower === 'суть' || lower === 'суть игры' || lower === 'гайд') {
            await ctx.send(`📖 **СУТЬ ИГРЫ "ТИКТОК ВСЕЛЕННАЯ"**

🎬 Ты — блогер. Записывай видео, набирай просмотры и лайки, зарабатывай доллары ($) и монеты (🪙).

💰 ЭКОНОМИКА:
• 1000 просмотров = ~$1 (+ бонус от лайков до x3)
• Лайки дают XP и увеличивают доход при сборе

📈 XP (опыт):
• Запись видео: +10 XP
• Сбор видео: +5 XP
• Каждый лайк: +1 XP
• Реферал: +50 XP
• Промокод: +20 XP
• Квест: +15 XP

👥 ПОДПИСЧИКИ:
• +1 подписчик за каждые 5 просмотров
• Подписчики увеличивают базовые просмотры
• Отображаются в профиле

🏪 МАГАЗИН (покупка за $):
• fake_subs — +50 просмотров/час навсегда ($3)
• реклама — +2000 просмотров к текущему видео ($5)
• коллаб — +20% к лайкам на 24 часа ($8)

🪙 ДОНАТ-МАГАЗИН (покупка за 🪙):
• просмотры — +1000 просмотров (50🪙)
• лайки — +100 лайков (30🪙)
• подписчики — +1 fake_sub (100🪙)
• реклама — +5000 просмотров за 24ч (200🪙)
• топ — виральный шанс 5% на 24ч (500🪙)
• слот — второй слот для видео (1000🪙)

👑 VIP-СТАТУС (множитель просмотров):
• VIP 1: x1.5 на 30 дней (500🪙)
• VIP 2: x2 на 30 дней (1500🪙)
• VIP 3: x3 на 30 дней (5000🪙)

👥 КЛАНЫ:
• Создать клан: 300🪙
• Бонусы за уровень клана к просмотрам, лайкам, подписчикам
• Эмодзи (100🪙), цвет (200🪙), рамка (300🪙), префикс (400🪙)

⏰ МНОЖИТЕЛИ ВРЕМЕНИ (по МСК):
• 00:00-07:00: x0.4 (ночь, мало зрителей)
• 07:00-10:00: x0.7 (утро)
• 10:00-14:00: x1.0 (день)
• 14:00-18:00: x1.2 (после обеда)
• 18:00-21:00: x1.5 (вечер, пик)
• 21:00-23:00: x1.8 (прайм-тайм)
• 23:00-00:00: x1.3 (поздний вечер)

📋 Полный список команд: помощь`);
            return;
        }
        
        // ==================== СТАРТ ====================
        if (lower === 'старт' || lower === 'начать') {
            await ctx.send({message:`🎬 Добро пожаловать в "ТикТок Вселенная", @id${userId}!

Стань топ-блогером! Записывай видео, набирай просмотры, зарабатывай деньги и монеты, вступай в кланы и соревнуйся с другими игроками!

📝 Основные команды:
• записать — создать новое видео
• статус — посмотреть прогресс текущего видео
• собрать — получить доход с видео (доступно через 1 час)
• магазин — магазин покупок за доллары ($)
• донат — VIP-магазин покупок за монеты (🪙)
• профиль — твоя статистика
• суть — подробный гайд по игре

📋 Все команды: помощь`,attachment:'photo-231991465_457239070'});
            return;
        }
        
        // ==================== ПОМОЩЬ ====================
        if (lower === 'помощь') {
            let t = `📋 **ВСЕ КОМАНДЫ И ПОЯСНЕНИЯ**

🎬 ВИДЕО:
• записать — создать новое видео (+XP, +подписчики)
• статус — посмотреть просмотры и лайки текущего видео
• собрать — получить доход с видео (можно через 1 час после записи)

👤 ПРОФИЛЬ:
• профиль — вся статистика: деньги, уровень, подписчики, клан, VIP
• уровень — прогресс уровня (шкала XP)
• достижения — список полученных достижений
• подписчики — количество подписчиков и их влияние на просмотры

🏪 МАГАЗИН (покупка за $):
• магазин — показать все товары
• купить fake_subs — +50 просмотров/час ($3)
• купить реклама — +2000 просмотров к текущему видео ($5)
• купить коллаб — +20% к лайкам на 24 часа ($8)

🪙 ДОНАТ-МАГАЗИН (покупка за 🪙):
• донат — показать все VIP-товары
• донат просмотры — +1000 просмотров (50🪙)
• донат лайки — +100 лайков (30🪙)
• донат подписчики — +1 fake_sub (100🪙)
• донат реклама — +5000 просмотров за 24ч (200🪙)
• донат топ — виральный шанс 5% на 24ч (500🪙)
• донат слот — второй слот для видео (1000🪙)

👑 VIP-СТАТУС:
• вип купить 1 — VIP 1: x1.5 просмотров на 30 дней (500🪙)
• вип купить 2 — VIP 2: x2 просмотров на 30 дней (1500🪙)
• вип купить 3 — VIP 3: x3 просмотров на 30 дней (5000🪙)
• вип статус — проверить текущий VIP-статус

👥 КЛАНЫ:
• клан создать НАЗВАНИЕ — создать клан (300🪙)
• клан войти ID — вступить в клан по ID
• клан выйти — покинуть клан
• клан инфо — информация о вашем клане и бонусах
• клан опыт — прогресс уровня клана
• клан список — список всех участников клана
• клан пригласить @user — пригласить игрока в клан
• клан повысить @user зам/старший — повысить участника
• клан понизить @user — понизить до обычного участника
• клан изгнать @user — исключить из клана

🎨 ОФОРМЛЕНИЕ КЛАНА:
• клан эмодзи ЭМОДЗИ — установить эмодзи клана (100🪙)
• клан цвет ЦВЕТ — установить цвет клана (200🪙)
• клан рамка РАМКА — установить рамку клана (300🪙)
• клан префикс — включить/отключить префикс [Клан] (400🪙)

📊 ТОПЫ:
• топ — топ-10 игроков по долларам ($)
• топподписчики — топ-10 по подписчикам
• топвидео день — топ видео за сегодня
• топвидео неделя — топ видео за неделю
• топвидео месяц — топ видео за месяц
• топвидео — топ видео за всё время
• топдонат — топ-10 игроков по монетам (🪙)
• топлевел — топ-10 игроков по уровню
• топкланов — топ-10 кланов по уровню
• топкланов участники — топ-10 кланов по количеству участников

🎁 БОНУСЫ:
• бонус — ежедневный бонус ($2-5, иногда +🪙)
• ежедневные — список ежедневных заданий (3 задания)
• рефка — получить реферальную ссылку (+$5 вам и другу)
• промокод КОД — активировать промокод

📖 ГАЙД:
• суть — подробный гайд по всей игре`;

            await ctx.send({message:t, attachment:'photo-231991465_457239085'});
            return;
        }
        
        // ==================== ПРОФИЛЬ (без просмотров и лайков) ====================
        if (lower === 'профиль') {
            const xpN = user.level >= MAX_LEVEL ? 'MAX' : getXpForLevel(user.level);
            const xpD = user.level >= MAX_LEVEL ? 'MAX' : `${user.xp}/${xpN}`;
            let clanInfo = 'Нет';
            if (user.clan_id) {
                const c = (await executeQuery('SELECT name, level, emoji, color, frame, prefix FROM clans WHERE id=$1', [user.clan_id])).rows[0];
                if (c) {
                    const ce = clanColors[c.color] || '';
                    const fe = clanFrames[c.frame] || '';
                    const prefix = c.prefix ? `[${c.name}] ` : '';
                    clanInfo = `${fe}${ce}${c.emoji||''} ${prefix}${c.name} (ур.${c.level})`;
                }
            }
            let vipInfo = user.vip_level > 0 ? `👑 VIP ${user.vip_level} (до ${new Date(user.vip_until*1000).toLocaleDateString('ru-RU')})` : 'Нет';
            let hiddenInfo = user.hide_from_top ? '\n🔒 Скрыт из топов' : '';
            await ctx.send({message:`👤 Профиль игрока

📛 @id${userId} (${vkName})
🎭 Роль: ${user.role}
💰 Доллары: $${parseFloat(user.balance_dollar).toFixed(2)}
🪙 Монеты: ${user.balance_coin}
📊 Уровень: ${user.level} (${xpD} XP)
👥 Подписчики: ${(user.subscribers||0).toLocaleString()}
👥 Рефералы: ${user.referrals}
🏰 Клан: ${clanInfo}
👑 VIP: ${vipInfo}${hiddenInfo}`,attachment:'photo-231991465_457239071'});
            return;
        }
        
        // ==================== УРОВЕНЬ ====================
        if (lower === 'уровень') {
            if (user.level >= MAX_LEVEL) return ctx.send(`🏆 Вы достигли максимального ${MAX_LEVEL} уровня! Поздравляем!`);
            const xpN = getXpForLevel(user.level);
            const p = Math.min(Math.floor((user.xp/xpN)*20), 20);
            await ctx.send(`📊 Уровень ${user.level}\nXP: ${user.xp}/${xpN}\n[${'█'.repeat(p)}${'░'.repeat(20-p)}] ${Math.floor((user.xp/xpN)*100)}%\nОсталось до следующего уровня: ${xpN-user.xp} XP`);
            return;
        }
        
        // ==================== ПОДПИСЧИКИ ====================
        if (lower === 'подписчики') {
            const subs = user.subscribers || 0;
            const cb = await getClanBonus(user.clan_id);
            const vip = await getVipMultiplier(userId);
            const vph = Math.floor(subs * 0.1 * vip * (1 + cb.subs/100));
            await ctx.send(`👥 Подписчики: ${subs.toLocaleString()}\n📈 Влияние на просмотры: +${vph} просмотров/час\n📊 Формула: 1 подписчик = 5 просмотров\n🏰 Бонус клана к подписчикам: +${cb.subs.toFixed(1)}%\n👑 VIP-множитель: x${vip}`);
            return;
        }
        
        // ==================== VIP ====================
        if (lower.startsWith('вип ')) {
            const parts = lower.split(' ');
            if (parts[1] === 'статус') {
                if (user.vip_level > 0 && user.vip_until > getMskTimestamp()) {
                    const days = Math.floor((user.vip_until - getMskTimestamp())/86400);
                    return ctx.send(`👑 VIP ${user.vip_level}\nМножитель просмотров: x${VIP_MULTIPLIERS[user.vip_level]}\nОсталось: ${days} дн.\n\nВсе ваши видео получают в ${VIP_MULTIPLIERS[user.vip_level]} раз больше просмотров!`);
                }
                return ctx.send('❌ У вас нет VIP-статуса.\nКупить: вип купить 1/2/3');
            }
            if (parts[1] === 'купить' && parts[2]) {
                const lvl = parseInt(parts[2]);
                if (![1,2,3].includes(lvl)) return ctx.send('❌ Доступны уровни: 1, 2 или 3\nвип купить 1 — x1.5 (500🪙)\nвип купить 2 — x2 (1500🪙)\nвип купить 3 — x3 (5000🪙)');
                const price = VIP_PRICES[lvl];
                if (user.balance_coin < price) return ctx.send(`❌ Недостаточно монет! Нужно ${price}🪙, у вас ${user.balance_coin}🪙`);
                await executeQuery('UPDATE users SET balance_coin=balance_coin-$1, vip_level=$2, vip_until=$3 WHERE vk_id=$4', [price, lvl, getMskTimestamp()+2592000, userId]);
                await addTransaction(userId, 0, -price, 'vip_buy');
                await ctx.send(`✅ Вы купили VIP ${lvl} (x${VIP_MULTIPLIERS[lvl]} просмотров) на 30 дней!\n🪙 Осталось монет: ${(await getUser(userId)).balance_coin}`);
                return;
            }
        }
        
        // ==================== КЛАНЫ ====================
        if (lower.startsWith('клан ')) {
            const parts = lower.split(' ');
            const cmd = parts[1];
            
            // Создать
            if (cmd === 'создать' && parts[2]) {
                if (user.clan_id) return ctx.send('❌ Вы уже в клане! Сначала покиньте его: клан выйти');
                if (user.balance_coin < 300) return ctx.send(`❌ Недостаточно монет! Нужно 300🪙, у вас ${user.balance_coin}🪙`);
                const name = parts.slice(2).join(' ');
                if (name.length > 30) return ctx.send('❌ Название клана не должно превышать 30 символов');
                const existing = await executeQuery('SELECT id FROM clans WHERE name ILIKE $1', [name]);
                if (existing.rows.length > 0) return ctx.send('❌ Клан с таким названием уже существует');
                await executeQuery('UPDATE users SET balance_coin=balance_coin-300 WHERE vk_id=$1', [userId]);
                await addTransaction(userId, 0, -300, 'clan_create');
                const nc = await executeQuery('INSERT INTO clans (name, leader, created_at) VALUES ($1,$2,$3) RETURNING id', [name, userId, getMskTimestamp()]);
                await executeQuery('UPDATE users SET clan_id=$1, clan_role=$2 WHERE vk_id=$3', [nc.rows[0].id, 'leader', userId]);
                await ctx.send(`✅ Клан "${name}" успешно создан!\nПриглашайте друзей: клан пригласить @user`);
                return;
            }
            
            // Войти
            if (cmd === 'войти' && parts[2]) {
                if (user.clan_id) return ctx.send('❌ Вы уже состоите в клане');
                const cid = parseInt(parts[2]);
                if (isNaN(cid)) return ctx.send('❌ Укажите ID клана (число)');
                const c = (await executeQuery('SELECT * FROM clans WHERE id=$1', [cid])).rows[0];
                if (!c) return ctx.send('❌ Клан с таким ID не найден');
                await executeQuery('UPDATE users SET clan_id=$1, clan_role=$2 WHERE vk_id=$3', [cid, 'member', userId]);
                await ctx.send(`✅ Вы вступили в клан "${c.emoji||''} ${c.name}"!`);
                return;
            }
            
            // Выйти
            if (cmd === 'выйти') {
                if (!user.clan_id) return ctx.send('❌ Вы не состоите в клане');
                if (user.clan_role === 'leader') {
                    const m = await executeQuery('SELECT vk_id FROM users WHERE clan_id=$1 AND vk_id!=$2 LIMIT 1', [user.clan_id, userId]);
                    if (m.rows.length > 0) {
                        await executeQuery('UPDATE users SET clan_role=$1 WHERE vk_id=$2', ['leader', m.rows[0].vk_id]);
                        await executeQuery('UPDATE clans SET leader=$1 WHERE id=$2', [m.rows[0].vk_id, user.clan_id]);
                    } else {
                        await executeQuery('DELETE FROM clans WHERE id=$1', [user.clan_id]);
                    }
                }
                await executeQuery('UPDATE users SET clan_id=NULL, clan_role=$1 WHERE vk_id=$2', ['member', userId]);
                await ctx.send('✅ Вы вышли из клана');
                return;
            }
            
            // Инфо
            if (cmd === 'инфо' || cmd === 'информация') {
                if (!user.clan_id) return ctx.send('❌ Вы не состоите в клане');
                const c = (await executeQuery('SELECT * FROM clans WHERE id=$1', [user.clan_id])).rows[0];
                if (!c) return ctx.send('❌ Клан не найден');
                const mc = (await executeQuery('SELECT COUNT(*) as cnt FROM users WHERE clan_id=$1', [user.clan_id])).rows[0].cnt;
                const xpNeed = c.level >= MAX_LEVEL ? 'MAX' : getClanXpForLevel(c.level);
                const cb = await getClanBonus(user.clan_id);
                const ld = (await executeQuery('SELECT name FROM users WHERE vk_id=$1', [c.leader])).rows[0];
                const ce = clanColors[c.color] || '';
                const fe = clanFrames[c.frame] || '';
                const prefix = c.prefix ? `[${c.name}] ` : '';
                await ctx.send(`🏰 ${fe}${ce}${c.emoji||''} ${c.name}\n👑 Лидер: ${ld?.name||'id'+c.leader}\n👥 Участников: ${mc}\n📊 Уровень клана: ${c.level} (${c.xp}/${xpNeed} XP)\n${prefix ? '📛 Префикс в чате: '+prefix+'\n' : ''}\n📈 Бонусы клана:\n👁️ +${cb.views.toFixed(1)}% к просмотрам\n💚 +${cb.likes.toFixed(1)}% к лайкам\n👥 +${cb.subs.toFixed(1)}% к подписчикам\n💰 +${cb.income.toFixed(1)}% к доходу`);
                return;
            }
            
            // Опыт
            if (cmd === 'опыт') {
                if (!user.clan_id) return ctx.send('❌ Вы не состоите в клане');
                const c = (await executeQuery('SELECT * FROM clans WHERE id=$1', [user.clan_id])).rows[0];
                if (c.level >= MAX_LEVEL) return ctx.send(`🏆 Ваш клан достиг максимального ${MAX_LEVEL} уровня!`);
                const xpNeed = getClanXpForLevel(c.level);
                const p = Math.min(Math.floor((c.xp/xpNeed)*20), 20);
                await ctx.send(`📊 ${c.emoji||''} ${c.name}\nУровень клана: ${c.level} | XP: ${c.xp}/${xpNeed}\n[${'█'.repeat(p)}${'░'.repeat(20-p)}]\nОсталось: ${xpNeed-c.xp} XP`);
                return;
            }
            
            // Список
            if (cmd === 'список') {
                if (!user.clan_id) return ctx.send('❌ Вы не состоите в клане');
                const m = await executeQuery('SELECT vk_id, name, clan_role, level FROM users WHERE clan_id=$1 ORDER BY CASE clan_role WHEN $2 THEN 0 WHEN $3 THEN 1 WHEN $4 THEN 2 ELSE 3 END, level DESC', [user.clan_id, 'leader', 'deputy', 'senior']);
                let t = `👥 Участники клана:\n\n`;
                m.rows.forEach((r, i) => {
                    const role = r.clan_role === 'leader' ? '👑' : r.clan_role === 'deputy' ? '⚙️' : r.clan_role === 'senior' ? '🛡️' : '👤';
                    t += `${i+1}. ${role} @id${r.vk_id} (ур.${r.level})\n`;
                });
                await ctx.send(t);
                return;
            }
            
            // Пригласить
            if (cmd === 'пригласить') {
                if (!user.clan_id) return ctx.send('❌ Вы не состоите в клане');
                if (!['leader', 'deputy'].includes(user.clan_role)) return ctx.send('❌ Только лидер и заместитель могут приглашать');
                const tid = extractId(msg);
                if (!tid) return ctx.send('❌ Укажите пользователя: @user или упоминание');
                const tu = await getUser(tid);
                if (tu.clan_id) return ctx.send('❌ Игрок уже состоит в клане');
                if (tu.is_banned) return ctx.send('❌ Игрок забанен');
                const c = (await executeQuery('SELECT name FROM clans WHERE id=$1', [user.clan_id])).rows[0];
                await vk.api.messages.send({user_id: tid, message: `📨 Приглашение в клан "${c.name}"!\nВступить: клан войти ${user.clan_id}`, random_id: Math.floor(Math.random()*1000000)});
                await ctx.send('✅ Приглашение отправлено!');
                return;
            }
            
            // Повысить
            if (cmd === 'повысить') {
                const tid = extractId(msg);
                if (!tid) return ctx.send('❌ Укажите @user');
                if (user.clan_role !== 'leader') return ctx.send('❌ Только лидер может повышать');
                const tu = await executeQuery('SELECT * FROM users WHERE vk_id=$1 AND clan_id=$2', [tid, user.clan_id]);
                if (tu.rows.length === 0) return ctx.send('❌ Игрок не в вашем клане');
                if (tu.rows[0].clan_role === 'leader') return ctx.send('❌ Это лидер клана');
                const role = parts[parts.length-1];
                const roles = { 'зам': 'deputy', 'старший': 'senior' };
                if (!roles[role]) return ctx.send('❌ Доступные роли: зам, старший');
                await executeQuery('UPDATE users SET clan_role=$1 WHERE vk_id=$2', [roles[role], tid]);
                await ctx.send(`✅ @id${tid} повышен до ${role==='зам'?'⚙️ зама':'🛡️ старшего'}`);
                return;
            }
            
            // Понизить
            if (cmd === 'понизить') {
                const tid = extractId(msg);
                if (!tid) return ctx.send('❌ Укажите @user');
                if (user.clan_role !== 'leader') return ctx.send('❌ Только лидер может понижать');
                const tu = await executeQuery('SELECT clan_role FROM users WHERE vk_id=$1 AND clan_id=$2', [tid, user.clan_id]);
                if (tu.rows.length === 0) return ctx.send('❌ Игрок не в вашем клане');
                if (tu.rows[0].clan_role === 'leader') return ctx.send('❌ Нельзя понизить лидера');
                await executeQuery('UPDATE users SET clan_role=$1 WHERE vk_id=$2 AND clan_id=$3', ['member', tid, user.clan_id]);
                await ctx.send(`✅ @id${tid} понижен до 👤 участника`);
                return;
            }
            
            // Изгнать
            if (cmd === 'изгнать') {
                const tid = extractId(msg);
                if (!tid) return ctx.send('❌ Укажите @user');
                if (!['leader', 'deputy'].includes(user.clan_role)) return ctx.send('❌ Только лидер и зам могут изгонять');
                const tu = await executeQuery('SELECT clan_role FROM users WHERE vk_id=$1 AND clan_id=$2', [tid, user.clan_id]);
                if (tu.rows.length === 0) return ctx.send('❌ Игрок не в вашем клане');
                if (tu.rows[0].clan_role === 'leader') return ctx.send('❌ Нельзя изгнать лидера');
                await executeQuery('UPDATE users SET clan_id=NULL, clan_role=$1 WHERE vk_id=$2', ['member', tid]);
                await ctx.send(`🚫 @id${tid} изгнан из клана`);
                return;
            }
            
            // Эмодзи
            if (cmd === 'эмодзи' && parts[2]) {
                if (!user.clan_id || user.clan_role !== 'leader') return ctx.send('❌ Только лидер клана может менять эмодзи');
                if (user.balance_coin < 100) return ctx.send('❌ Нужно 100🪙');
                const emoji = parts[2].substring(0, 2);
                await executeQuery('UPDATE users SET balance_coin=balance_coin-100 WHERE vk_id=$1', [userId]);
                await executeQuery('UPDATE clans SET emoji=$1 WHERE id=$2', [emoji, user.clan_id]);
                await addTransaction(userId, 0, -100, 'clan_emoji');
                await ctx.send(`✅ Эмодзи клана изменён на: ${emoji}`);
                return;
            }
            
            // Цвет
            if (cmd === 'цвет' && parts[2]) {
                if (!user.clan_id || user.clan_role !== 'leader') return ctx.send('❌ Только лидер клана может менять цвет');
                if (user.balance_coin < 200) return ctx.send('❌ Нужно 200🪙');
                const color = parts[2];
                if (!clanColors[color]) return ctx.send(`❌ Доступные цвета: ${Object.keys(clanColors).join(', ')}`);
                await executeQuery('UPDATE users SET balance_coin=balance_coin-200 WHERE vk_id=$1', [userId]);
                await executeQuery('UPDATE clans SET color=$1 WHERE id=$2', [color, user.clan_id]);
                await addTransaction(userId, 0, -200, 'clan_color');
                await ctx.send(`✅ Цвет клана изменён на: ${clanColors[color]}`);
                return;
            }
            
            // Рамка
            if (cmd === 'рамка' && parts[2]) {
                if (!user.clan_id || user.clan_role !== 'leader') return ctx.send('❌ Только лидер клана может менять рамку');
                if (user.balance_coin < 300) return ctx.send('❌ Нужно 300🪙');
                const frame = parts[2];
                if (!clanFrames[frame]) return ctx.send(`❌ Доступные рамки: ${Object.keys(clanFrames).join(', ')}`);
                await executeQuery('UPDATE users SET balance_coin=balance_coin-300 WHERE vk_id=$1', [userId]);
                await executeQuery('UPDATE clans SET frame=$1 WHERE id=$2', [frame, user.clan_id]);
                await addTransaction(userId, 0, -300, 'clan_frame');
                await ctx.send(`✅ Рамка клана изменена на: ${clanFrames[frame]}`);
                return;
            }
            
            // Префикс
            if (cmd === 'префикс') {
                if (!user.clan_id || user.clan_role !== 'leader') return ctx.send('❌ Только лидер клана может менять префикс');
                if (user.balance_coin < 400) return ctx.send('❌ Нужно 400🪙');
                await executeQuery('UPDATE users SET balance_coin=balance_coin-400 WHERE vk_id=$1', [userId]);
                const c = (await executeQuery('SELECT prefix FROM clans WHERE id=$1', [user.clan_id])).rows[0];
                await executeQuery('UPDATE clans SET prefix=NOT prefix WHERE id=$1', [user.clan_id]);
                await addTransaction(userId, 0, -400, 'clan_prefix');
                await ctx.send(`✅ Префикс клана ${!c.prefix?'включён':'отключён'}!`);
                return;
            }
            
            return ctx.send('❌ Неизвестная команда клана.\nДоступно: создать, войти, выйти, инфо, опыт, список, пригласить, повысить, понизить, изгнать, эмодзи, цвет, рамка, префикс');
        }
        
        // ==================== ТОП КЛАНОВ ====================
        if (lower === 'топкланов') {
            const top = await executeQuery('SELECT c.*, (SELECT COUNT(*) FROM users WHERE clan_id=c.id) as members FROM clans c ORDER BY c.level DESC, c.total_xp DESC LIMIT 10');
            if (top.rows.length === 0) return ctx.send('📊 Нет созданных кланов.');
            let t = `🏆 Топ-10 кланов по уровню\n\n`;
            top.rows.forEach((r, i) => t += `${i+1}. ${clanFrames[r.frame]||''}${clanColors[r.color]||''}${r.emoji||''} ${r.name} (ур.${r.level})\n   XP: ${(r.total_xp||0).toLocaleString()} | 👥 ${r.members} участников\n\n`);
            await ctx.send(t);
            return;
        }
        
        if (lower === 'топкланов участники') {
            const top = await executeQuery('SELECT c.*, (SELECT COUNT(*) FROM users WHERE clan_id=c.id) as members FROM clans c ORDER BY members DESC LIMIT 10');
            if (top.rows.length === 0) return ctx.send('📊 Нет созданных кланов.');
            let t = `🏆 Топ-10 кланов по участникам\n\n`;
            top.rows.forEach((r, i) => t += `${i+1}. ${r.emoji||''} ${r.name} — ${r.members} чел. (ур.${r.level})\n\n`);
            await ctx.send(t);
            return;
        }
        
        // ==================== ЗАПИСАТЬ ====================
        if (lower === 'записать') {
            const av = await executeQuery('SELECT * FROM videos WHERE owner=$1 AND is_collected=FALSE', [userId]);
            const maxSlots = user.extra_slot ? 2 : 1;
            if (av.rows.length >= maxSlots) return ctx.send('❌ У вас уже есть активное видео! Сначала соберите его: собрать');
            const title = videoTitles[Math.floor(Math.random()*videoTitles.length)];
            const now = getMskTimestamp();
            await executeQuery('INSERT INTO videos (owner,title,created_at,last_likes_reset) VALUES ($1,$2,$3,$4)', [userId, title, now, now]);
            
            // При записи даём базовых подписчиков
            const baseSubs = getRandomInt(1, 3);
            await executeQuery('UPDATE users SET subscribers = COALESCE(subscribers,0) + $1 WHERE vk_id=$2', [baseSubs, userId]);
            
            await addXp(userId, 10);
            await checkDailyQuest(userId, 1);
            const u = await getUser(userId);
            if (u.clan_id) await addClanXp(u.clan_id, 1);
            await ctx.send({message:`🎬 Видео записано!\n📹 "${title}"\n👥 +${baseSubs} подписчиков\n⏳ Просмотры начисляются каждые 30 секунд\n\nПроверить прогресс: статус\nСобрать доход: собрать (через 1 час)`, attachment:'photo-231991465_457239069'});
            await checkAchievements(userId);
            return;
        }
        
        // ==================== СТАТУС ====================
        if (lower === 'статус') {
            const av = await executeQuery('SELECT * FROM videos WHERE owner=$1 AND is_collected=FALSE LIMIT 1', [userId]);
            if (av.rows.length === 0) return ctx.send('❌ У вас нет активного видео. Запишите новое: записать');
            const v = av.rows[0];
            const age = getMskTimestamp() - v.created_at;
            const h = Math.floor(age/3600), m = Math.floor((age%3600)/60);
            const vfc = Math.max(v.views, 1), lr = v.likes/vfc, lb = Math.min(lr*10, 3);
            const income = (v.views/1000)*(1+lb);
            await ctx.send({message:`📹 "${v.title}"\n👁️ Просмотры: ${v.views.toLocaleString()}\n💚 Лайки: ${v.likes.toLocaleString()}\n📈 Бонус к доходу: x${(1+lb).toFixed(2)}\n⏱ Прошло: ${h}ч ${m}мин\n💰 Доход: ~$${income.toFixed(2)}\n${age>=3600?'✅ Можно собрать!':'❌ Ждать ещё ~'+Math.floor((3600-age)/60)+' мин'}${v.is_frozen?'\n❄️ Видео заморожено (не набирает просмотры)':''}`, attachment:'photo-231991465_457239072'});
            return;
        }
        
        // ==================== СОБРАТЬ ====================
        if (lower === 'собрать') {
            const av = await executeQuery('SELECT * FROM videos WHERE owner=$1 AND is_collected=FALSE LIMIT 1', [userId]);
            if (av.rows.length === 0) return ctx.send('❌ У вас нет активного видео. Запишите новое: записать');
            const v = av.rows[0];
            const age = getMskTimestamp() - v.created_at;
            if (age < 3600) { const rm = 3600 - age; return ctx.send(`❌ Рано собирать! Подождите ещё ${Math.floor(rm/60)} мин`); }
            const vfc = Math.max(v.views, 1), lr = v.likes/vfc, lb = Math.min(lr*10, 3);
            const cb = await getClanBonus(user.clan_id);
            let income = (v.views/1000)*(1+lb) * (1 + cb.income/100);
            await executeQuery('UPDATE videos SET is_collected=TRUE WHERE id=$1', [v.id]);
            await executeQuery('UPDATE users SET balance_dollar=balance_dollar+$1, last_collect=$2 WHERE vk_id=$3', [income, getMskTimestamp(), userId]);
            await addTransaction(userId, income, 0, 'video_income');
            await addXp(userId, 5);
            await checkDailyQuest(userId, 2);
            const u = await getUser(userId);
            if (u.clan_id) await addClanXp(u.clan_id, 2);
            await ctx.send({message:`💰 Доход собран!\n📹 "${v.title}"\n👁️ ${v.views.toLocaleString()} просмотров\n💚 ${v.likes.toLocaleString()} лайков\n📈 Множитель: x${(1+lb).toFixed(2)}\n🏰 Бонус клана: +${cb.income.toFixed(1)}%\n💵 Доход: $${income.toFixed(2)}\n💰 Баланс: $${parseFloat((await getUser(userId)).balance_dollar).toFixed(2)}`, attachment:'photo-231991465_457239073'});
            await checkAchievements(userId);
            await checkTopBlogger(userId);
            return;
        }
        
        // ==================== МАГАЗИНЫ ====================
        if (lower === 'магазин') {
            await ctx.send({message:`🏪 **МАГАЗИН ПОКУПОК ЗА ДОЛЛАРЫ ($)**

💰 Ваш баланс: $${parseFloat(user.balance_dollar).toFixed(2)}

1. купить fake_subs — $3
   +1 фейковый подписчик (+50 просмотров/час навсегда)

2. купить реклама — $5
   +2000 просмотров к текущему видео (+400 подписчиков)

3. купить коллаб — $8
   +20% к лайкам на 24 часа

Для покупки напишите: купить НАЗВАНИЕ`, attachment:'photo-231991465_457239076'});
            return;
        }
        
        if (lower === 'донат') {
            await ctx.send(`🪙 **VIP-МАГАЗИН (ДОНАТ) — ПОКУПКИ ЗА МОНЕТЫ (🪙)**

🪙 Ваш баланс: ${user.balance_coin} монет

1. донат просмотры — 50🪙
   +1000 просмотров (+200 подписчиков)

2. донат лайки — 30🪙
   +100 лайков к текущему видео (+XP)

3. донат подписчики — 100🪙
   +1 фейковый подписчик (+50 просмотров/час навсегда)

4. донат реклама — 200🪙
   +5000 просмотров за 24 часа (+1000 подписчиков)

5. донат топ — 500🪙
   Виральный шанс 5% на 24 часа

6. донат слот — 1000🪙
   Второй слот для видео

👑 VIP-СТАТУС (множитель просмотров на 30 дней):
• вип купить 1 — x1.5 (500🪙)
• вип купить 2 — x2 (1500🪙)
• вип купить 3 — x3 (5000🪙)

💡 Как получить 🪙?
• Достижения
• Ежедневный бонус (шанс)
• Промокоды`);
            return;
        }
        
        // ==================== КУПИТЬ ====================
        if (lower.startsWith('купить ')) {
            const item = lower.replace('купить ','');
            if (item === 'fake_subs') {
                if (user.balance_dollar < 3) return ctx.send(`❌ Недостаточно долларов! Нужно $3, у вас $${parseFloat(user.balance_dollar).toFixed(2)}`);
                await executeQuery('UPDATE users SET balance_dollar=balance_dollar-3, fake_subs=fake_subs+1 WHERE vk_id=$1', [userId]);
                await addTransaction(userId, -3, 0, 'buy');
                const u = await getUser(userId);
                if (u.clan_id) await addClanXp(u.clan_id, 5);
                await ctx.send({message:`✅ Куплен fake_sub!\n+50 просмотров/час навсегда\n💰 Остаток: $${parseFloat(u.balance_dollar).toFixed(2)}`, attachment:'photo-231991465_457239077'});
            } else if (item === 'реклама') {
                if (user.balance_dollar < 5) return ctx.send(`❌ Недостаточно долларов! Нужно $5, у вас $${parseFloat(user.balance_dollar).toFixed(2)}`);
                const av = await executeQuery('SELECT id FROM videos WHERE owner=$1 AND is_collected=FALSE LIMIT 1', [userId]);
                if (av.rows.length === 0) return ctx.send('❌ Нет активного видео! Запишите: записать');
                const result = await addViewsAndLikes(av.rows[0].id, 2000, userId, user.collab_until);
                await executeQuery('UPDATE users SET balance_dollar=balance_dollar-5 WHERE vk_id=$1', [userId]);
                await addTransaction(userId, -5, 0, 'buy');
                await ctx.send({message:`✅ Куплена реклама!\n+2000 просмотров (+${result.likes} лайков, +${result.newSubs} подписчиков)\n💰 Остаток: $${parseFloat((await getUser(userId)).balance_dollar).toFixed(2)}`, attachment:'photo-231991465_457239077'});
            } else if (item === 'коллаб') {
                if (user.balance_dollar < 8) return ctx.send(`❌ Недостаточно долларов! Нужно $8, у вас $${parseFloat(user.balance_dollar).toFixed(2)}`);
                await executeQuery('UPDATE users SET balance_dollar=balance_dollar-8, collab_until=$1 WHERE vk_id=$2', [getMskTimestamp()+86400, userId]);
                await addTransaction(userId, -8, 0, 'buy');
                await ctx.send({message:`✅ Куплен коллаб!\n+20% к лайкам на 24 часа\n💰 Остаток: $${parseFloat((await getUser(userId)).balance_dollar).toFixed(2)}`, attachment:'photo-231991465_457239077'});
            } else return ctx.send('❌ Неизвестный товар.\nДоступно: fake_subs, реклама, коллаб');
            return;
        }
        
        // ==================== ДОНАТ ====================
        if (lower.startsWith('донат ')) {
            const s = lower.replace('донат ','');
            if (s === 'просмотры') {
                if (user.balance_coin < 50) return ctx.send(`❌ Недостаточно монет! Нужно 50🪙, у вас ${user.balance_coin}🪙`);
                const av = await executeQuery('SELECT id FROM videos WHERE owner=$1 AND is_collected=FALSE LIMIT 1', [userId]);
                if (av.rows.length === 0) return ctx.send('❌ Нет активного видео! Запишите: записать');
                const result = await addViewsAndLikes(av.rows[0].id, 1000, userId, user.collab_until);
                await executeQuery('UPDATE users SET balance_coin=balance_coin-50 WHERE vk_id=$1', [userId]);
                await addTransaction(userId, 0, -50, 'donat');
                const u = await getUser(userId);
                if (u.clan_id) await addClanXp(u.clan_id, 10);
                await ctx.send(`✅ +1000 просмотров (+${result.likes} лайков, +${result.newSubs} подписчиков)!`);
            } else if (s === 'лайки') {
                if (user.balance_coin < 30) return ctx.send(`❌ Недостаточно монет! Нужно 30🪙, у вас ${user.balance_coin}🪙`);
                const av = await executeQuery('SELECT id FROM videos WHERE owner=$1 AND is_collected=FALSE LIMIT 1', [userId]);
                if (av.rows.length === 0) return ctx.send('❌ Нет активного видео! Запишите: записать');
                await executeQuery('UPDATE videos SET likes=likes+100, likes_today=likes_today+100 WHERE id=$1', [av.rows[0].id]);
                await executeQuery('UPDATE users SET balance_coin=balance_coin-30, total_likes=total_likes+100 WHERE vk_id=$1', [userId]);
                await addXp(userId, 100);
                await addTransaction(userId, 0, -30, 'donat');
                const u = await getUser(userId);
                if (u.clan_id) await addClanXp(u.clan_id, 6);
                await checkLikesQuest(userId);
                await ctx.send(`✅ +100 лайков к видео!`);
            } else if (s === 'подписчики') {
                if (user.balance_coin < 100) return ctx.send(`❌ Недостаточно монет! Нужно 100🪙, у вас ${user.balance_coin}🪙`);
                await executeQuery('UPDATE users SET balance_coin=balance_coin-100, fake_subs=fake_subs+1 WHERE vk_id=$1', [userId]);
                await addTransaction(userId, 0, -100, 'donat');
                const u = await getUser(userId);
                if (u.clan_id) await addClanXp(u.clan_id, 20);
                await ctx.send(`✅ +1 fake_sub! Всего: ${u.fake_subs}`);
            } else if (s === 'реклама') {
                if (user.balance_coin < 200) return ctx.send(`❌ Недостаточно монет! Нужно 200🪙, у вас ${user.balance_coin}🪙`);
                const av = await executeQuery('SELECT id FROM videos WHERE owner=$1 AND is_collected=FALSE LIMIT 1', [userId]);
                if (av.rows.length === 0) return ctx.send('❌ Нет активного видео! Запишите: записать');
                await executeQuery('UPDATE videos SET ad_until=$1 WHERE id=$2', [getMskTimestamp()+86400, av.rows[0].id]);
                await executeQuery('UPDATE users SET balance_coin=balance_coin-200 WHERE vk_id=$1', [userId]);
                await addTransaction(userId, 0, -200, 'donat');
                const u = await getUser(userId);
                if (u.clan_id) await addClanXp(u.clan_id, 40);
                await ctx.send('✅ Реклама активирована! +5000 просмотров за 24 часа (+1000 подписчиков)');
            } else if (s === 'топ') {
                if (user.balance_coin < 500) return ctx.send(`❌ Недостаточно монет! Нужно 500🪙, у вас ${user.balance_coin}🪙`);
                await executeQuery('UPDATE users SET balance_coin=balance_coin-500, viral_until=$1 WHERE vk_id=$2', [getMskTimestamp()+86400, userId]);
                await addTransaction(userId, 0, -500, 'donat');
                const u = await getUser(userId);
                if (u.clan_id) await addClanXp(u.clan_id, 100);
                await ctx.send('✅ Виральный шанс 5% активирован на 24 часа!');
            } else if (s === 'слот') {
                if (user.balance_coin < 1000) return ctx.send(`❌ Недостаточно монет! Нужно 1000🪙, у вас ${user.balance_coin}🪙`);
                if (user.extra_slot) return ctx.send('❌ У вас уже есть второй слот');
                await executeQuery('UPDATE users SET balance_coin=balance_coin-1000, extra_slot=TRUE WHERE vk_id=$1', [userId]);
                await addTransaction(userId, 0, -1000, 'donat');
                const u = await getUser(userId);
                if (u.clan_id) await addClanXp(u.clan_id, 200);
                await ctx.send('✅ Второй слот для видео открыт! Теперь можно записывать 2 видео одновременно');
            } else return ctx.send('❌ Неизвестный товар.\nДоступно: просмотры, лайки, подписчики, реклама, топ, слот');
            return;
        }
        
        // ==================== ТОПЫ ====================
        if (lower === 'топ') {
            const t = await executeQuery('SELECT vk_id, balance_dollar FROM users WHERE is_banned=FALSE AND hide_from_top=FALSE ORDER BY balance_dollar DESC LIMIT 10');
            let txt = '💰 Топ-10 богачей ($)\n\n';
            t.rows.forEach((r, i) => txt += `${i+1}. @id${r.vk_id} — $${parseFloat(r.balance_dollar).toFixed(2)}\n`);
            await ctx.send({message:txt, attachment:'photo-231991465_457239078'});
            for (const r of t.rows) await checkTopBlogger(parseInt(r.vk_id));
            return;
        }
        
        // Топ по подписчикам
        if (lower === 'топподписчики' || lower === 'топ подписчики') {
            const t = await executeQuery('SELECT vk_id, subscribers FROM users WHERE is_banned=FALSE AND hide_from_top=FALSE ORDER BY subscribers DESC LIMIT 10');
            let txt = '👥 Топ-10 по подписчикам\n\n';
            t.rows.forEach((r, i) => txt += `${i+1}. @id${r.vk_id} — ${(r.subscribers||0).toLocaleString()} подписчиков\n`);
            await ctx.send(txt);
            return;
        }
        
        if (lower.startsWith('топвидео')) {
            const p = lower.split(' ')[1] || 'день';
            let dc = '', pl = 'всё время';
            if (p === 'день' || p === 'today') { dc = `AND v.created_at>=${getMskTodayStart()}`; pl = 'день'; }
            else if (p === 'неделя' || p === 'week') { dc = `AND v.created_at>=${getMskWeekStart()}`; pl = 'неделя'; }
            else if (p === 'месяц' || p === 'month') { dc = `AND v.created_at>=${getMskMonthStart()}`; pl = 'месяц'; }
            const t = await executeQuery(`SELECT v.title,v.views,v.likes,u.vk_id FROM videos v JOIN users u ON v.owner=u.vk_id WHERE u.is_banned=FALSE AND u.hide_from_top=FALSE ${dc} ORDER BY v.views DESC LIMIT 10`);
            if (t.rows.length === 0) return ctx.send({message:`📹 Нет видео за ${pl}`, attachment:'photo-231991465_457239079'});
            let txt = `📹 Топ-10 видео (${pl})\n\n`;
            t.rows.forEach((r, i) => txt += `${i+1}. @id${r.vk_id} — "${r.title}"\n   👁️ ${r.views.toLocaleString()} | 💚 ${r.likes.toLocaleString()}\n\n`);
            await ctx.send({message:txt, attachment:'photo-231991465_457239079'});
            return;
        }
        
        if (lower === 'топдонат') {
            const t = await executeQuery('SELECT vk_id, balance_coin FROM users WHERE is_banned=FALSE AND hide_from_top=FALSE ORDER BY balance_coin DESC LIMIT 10');
            let txt = '🪙 Топ-10 по монетам\n\n';
            t.rows.forEach((r, i) => txt += `${i+1}. @id${r.vk_id} — ${r.balance_coin}🪙\n`);
            await ctx.send(txt);
            for (const r of t.rows) await checkTopBlogger(parseInt(r.vk_id));
            return;
        }
        
        if (lower === 'топлевел') {
            const t = await executeQuery('SELECT vk_id, level, xp FROM users WHERE is_banned=FALSE AND hide_from_top=FALSE ORDER BY level DESC, xp DESC LIMIT 10');
            let txt = '🏆 Топ-10 по уровню\n\n';
            t.rows.forEach((r, i) => txt += `${i+1}. @id${r.vk_id} — ${r.level >= MAX_LEVEL ? 'MAX' : r.level} ур.\n`);
            await ctx.send(txt);
            return;
        }
        
        // ==================== БОНУС/ЕЖЕДНЕВНЫЕ/ДОСТИЖЕНИЯ/РЕФКА/ПРОМОКОД ====================
        if (lower === 'бонус') {
            const n = getMskTimestamp();
            if (n - user.last_daily < 86400) {
                const rm = 86400 - (n - user.last_daily);
                return ctx.send(`❌ Вы уже получали бонус! Ждать ещё ${Math.floor(rm/3600)}ч ${Math.floor((rm%3600)/60)}мин`);
            }
            const d = getRandomInt(2, 5), c = Math.random() < 0.2 ? getRandomInt(1, 5) : 0;
            await executeQuery('UPDATE users SET balance_dollar=balance_dollar+$1, balance_coin=balance_coin+$2, last_daily=$3 WHERE vk_id=$4', [d, c, n, userId]);
            await addTransaction(userId, d, c, 'bonus');
            await ctx.send(`🎁 Ежедневный бонус!\n+$${d}${c > 0 ? `\n🪙 +${c} монет` : ''}`);
            return;
        }
        
        if (lower === 'ежедневные') {
            const ts = getMskTodayStart();
            let q = await executeQuery('SELECT * FROM daily_quests WHERE user_id=$1 AND date=$2', [userId, ts]);
            if (q.rows.length === 0) {
                await executeQuery('INSERT INTO daily_quests (user_id,date) VALUES ($1,$2) ON CONFLICT DO NOTHING', [userId, ts]);
                q = await executeQuery('SELECT * FROM daily_quests WHERE user_id=$1 AND date=$2', [userId, ts]);
            }
            const d = q.rows[0];
            await ctx.send(`📋 Ежедневные задания (награда: $1-3 + 15 XP)\n\n1. Записать видео — ${d.quest1_done ? '✅ Выполнено!' : '❌ Не выполнено'}\n2. Собрать 2 видео — ${d.quest2_done ? '✅ Выполнено!' : `${d.quest2_count||0}/2 собрано`}\n3. 100 лайков за день — ${d.quest3_done ? '✅ Выполнено!' : '❌ Не выполнено'}\n\nЗадания сбрасываются каждый день в 00:00 МСК`);
            return;
        }
        
        if (lower === 'достижения') {
            const ea = (await executeQuery('SELECT achievement_id FROM achievements WHERE user_id=$1', [userId])).rows.map(r => r.achievement_id);
            let t = '🏆 Достижения\n\n';
            const achievements = [
                {id: 'first_video', n: 'Первое видео', c: 'Записать 1 видео', r: '$1'},
                {id: 'popularity', n: 'Популярность', c: '10 000 просмотров', r: '$10'},
                {id: 'like_master', n: 'Лайк-мастер', c: '1 000 лайков', r: '$20'},
                {id: 'millionaire', n: 'Миллионер', c: '1 000 000 просмотров', r: '$500 + 100🪙'},
                {id: 'ref_killer', n: 'Реф.король', c: '10 рефералов', r: '$100'},
                {id: 'top_blogger', n: 'Топ-блогер', c: 'Попасть в топ-3', r: '50🪙'},
                {id: 'level_10', n: 'Бывалый', c: '10 уровень', r: '$25'},
                {id: 'level_50', n: 'Профи', c: '50 уровень', r: '$100 + 50🪙'},
                {id: 'level_100', n: 'Легенда', c: '100 уровень', r: '$250 + 100🪙'},
                {id: 'level_500', n: 'Босс', c: '500 уровень', r: '$1000 + 500🪙'},
                {id: 'level_1000', n: 'Император', c: '1000 уровень', r: '$5000 + 1000🪙'},
                {id: 'level_1500', n: 'Бог Тиктока', c: '1500 уровень', r: '$10000 + 5000🪙'}
            ];
            achievements.forEach(a => t += `${ea.includes(a.id) ? '✅' : '🔒'} ${a.n} — ${a.c} (${a.r})\n`);
            await ctx.send(t);
            return;
        }
        
        if (lower === 'рефка') {
            await ctx.send(`🔗 Ваша реферальная ссылка:\nhttps://vk.com/club${GROUP_ID}?ref=${userId}\n\nПри переходе друга по ссылке вы оба получите +$5!`);
            return;
        }
        
        if (lower.startsWith('промокод ')) {
            const code = lower.replace('промокод ', '').trim().toUpperCase();
            const p = await executeQuery('SELECT * FROM promocodes WHERE code=$1', [code]);
            if (p.rows.length === 0) return ctx.send('❌ Промокод не найден');
            const pr = p.rows[0];
            if (pr.expires_at > 0 && pr.expires_at < getMskTimestamp()) return ctx.send('❌ Срок действия промокода истёк');
            if (pr.uses >= pr.max_uses) return ctx.send('❌ Промокод закончился (все использования израсходованы)');
            const uu = await executeQuery('SELECT * FROM used_promos WHERE user_id=$1 AND promo_code=$2', [userId, code]);
            if (uu.rows.length > 0) return ctx.send('❌ Вы уже использовали этот промокод');
            await executeQuery('INSERT INTO used_promos (user_id,promo_code) VALUES ($1,$2)', [userId, code]);
            await executeQuery('UPDATE promocodes SET uses=uses+1 WHERE code=$1', [code]);
            if (pr.reward_type === '$') {
                await executeQuery('UPDATE users SET balance_dollar=balance_dollar+$1 WHERE vk_id=$2', [pr.reward_amount, userId]);
                await addTransaction(userId, pr.reward_amount, 0, 'promo');
                await ctx.send(`✅ Промокод активирован! +$${pr.reward_amount}`);
            } else {
                await executeQuery('UPDATE users SET balance_coin=balance_coin+$1 WHERE vk_id=$2', [pr.reward_amount, userId]);
                await addTransaction(userId, 0, pr.reward_amount, 'promo');
                await ctx.send(`✅ Промокод активирован! +${pr.reward_amount}🪙`);
            }
            await addXp(userId, 20);
            const u = await getUser(userId);
            if (u.clan_id) await addClanXp(u.clan_id, 5);
            return;
        }
        
        // ==================== АДМИН-КОМАНДЫ (ТОЛЬКО ДЛЯ ADMIN_ID) ====================
        if (userId === ADMIN_ID) {
            // Скрыть из топа
            if (lower.startsWith('скрыть из топа ') || lower.startsWith('скрыть из топ ')) {
                const tid = extractId(msg);
                if (!tid) return ctx.send('❌ Укажите @user');
                await executeQuery('UPDATE users SET hide_from_top=TRUE WHERE vk_id=$1', [tid]);
                await ctx.send(`🔒 @id${tid} скрыт из всех топов`);
                return;
            }
            
            // Показать в топе
            if (lower.startsWith('показать в топе ') || lower.startsWith('показать в топ ')) {
                const tid = extractId(msg);
                if (!tid) return ctx.send('❌ Укажите @user');
                await executeQuery('UPDATE users SET hide_from_top=FALSE WHERE vk_id=$1', [tid]);
                await ctx.send(`🔓 @id${tid} возвращён в топы`);
                return;
            }
            
            // Бан
            if (lower.startsWith('бан ')) {
                const tid = extractId(msg);
                if (!tid) return ctx.send('❌ @user');
                await executeQuery('UPDATE users SET is_banned=TRUE WHERE vk_id=$1', [tid]);
                await ctx.send(`⛔ @id${tid} забанен`);
                return;
            }
            
            // Разбан
            if (lower.startsWith('разбан ')) {
                const tid = extractId(msg);
                if (!tid) return ctx.send('❌ @user');
                await executeQuery('UPDATE users SET is_banned=FALSE WHERE vk_id=$1', [tid]);
                await ctx.send(`✅ @id${tid} разбанен`);
                return;
            }
            
            // Дать ресурсы
            if (lower.startsWith('дать ')) {
                const p = msg.split(' ');
                if (p.length < 4) return ctx.send('❌ Формат: дать $ @user 100');
                const cur = p[1], tid = extractId(msg), am = parseFloat(p[p.length-1]);
                if (!tid || isNaN(am)) return ctx.send('❌ Формат: дать $ @user 100');
                if (am <= 0) return ctx.send('❌ Сумма >0');
                const tu = await getUser(tid);
                if (tu.is_banned) return ctx.send('❌ Игрок забанен');
                
                if (cur === '$') {
                    await executeQuery('UPDATE users SET balance_dollar=balance_dollar+$1 WHERE vk_id=$2', [am, tid]);
                    await addTransaction(tid, am, 0, 'admin');
                    await ctx.send(`✅ $${am} → @id${tid}`);
                } else if (cur === '🪙') {
                    await executeQuery('UPDATE users SET balance_coin=balance_coin+$1 WHERE vk_id=$2', [Math.floor(am), tid]);
                    await addTransaction(tid, 0, Math.floor(am), 'admin');
                    await ctx.send(`✅ ${Math.floor(am)}🪙 → @id${tid}`);
                } else if (cur === 'просмотры') {
                    const av = await executeQuery('SELECT id FROM videos WHERE owner=$1 AND is_collected=FALSE LIMIT 1', [tid]);
                    if (av.rows.length > 0) {
                        const result = await addViewsAndLikes(av.rows[0].id, Math.floor(am), tid, tu.collab_until);
                        await ctx.send(`✅ ${Math.floor(am)} просмотров (+${result.likes} лайков, +${result.newSubs} подписчиков) → @id${tid}`);
                    } else {
                        await executeQuery('UPDATE users SET total_views=total_views+$1 WHERE vk_id=$2', [Math.floor(am), tid]);
                        await ctx.send(`✅ ${Math.floor(am)} просмотров → @id${tid}`);
                    }
                } else if (cur === 'лайки') {
                    const av = await executeQuery('SELECT id FROM videos WHERE owner=$1 AND is_collected=FALSE LIMIT 1', [tid]);
                    if (av.rows.length > 0) {
                        await executeQuery('UPDATE videos SET likes=likes+$1, likes_today=likes_today+$1 WHERE id=$2', [Math.floor(am), av.rows[0].id]);
                        await executeQuery('UPDATE users SET total_likes=total_likes+$1 WHERE vk_id=$2', [Math.floor(am), tid]);
                        await addXp(tid, Math.floor(am));
                        await checkLikesQuest(tid);
                    }
                    await ctx.send(`✅ ${Math.floor(am)} лайков → @id${tid}`);
                } else if (cur === 'опыт') {
                    await addXp(tid, Math.floor(am));
                    await ctx.send(`✅ ${Math.floor(am)} XP → @id${tid}`);
                }
                return;
            }
            
            // Удалить видео
            if (lower.startsWith('удалить видео')) {
                const tid = extractId(msg);
                if (!tid) return ctx.send('❌ @user');
                await executeQuery('DELETE FROM videos WHERE owner=$1 AND is_collected=FALSE', [tid]);
                await ctx.send(`✅ Видео @id${tid} удалено`);
                return;
            }
            
            // Заморозить видео
            if (lower.startsWith('заморозить видео')) {
                const tid = extractId(msg);
                if (!tid) return ctx.send('❌ @user');
                await executeQuery('UPDATE videos SET is_frozen=TRUE WHERE owner=$1 AND is_collected=FALSE', [tid]);
                await ctx.send(`❄️ Видео @id${tid} заморожено`);
                return;
            }
            
            // Разморозить видео
            if (lower.startsWith('разморозить видео')) {
                const tid = extractId(msg);
                if (!tid) return ctx.send('❌ @user');
                await executeQuery('UPDATE videos SET is_frozen=FALSE WHERE owner=$1', [tid]);
                await ctx.send(`✅ Видео @id${tid} разморожено`);
                return;
            }
            
            // Сделать вирал
            if (lower.startsWith('сделать вирал')) {
                const tid = extractId(msg);
                if (!tid) return ctx.send('❌ @user');
                await executeQuery('UPDATE users SET viral_until=$1 WHERE vk_id=$2', [getMskTimestamp()+86400, tid]);
                await ctx.send(`🎯 Виральный шанс 5% на 24ч → @id${tid}`);
                return;
            }
            
            // Создать промокод
            if (lower.startsWith('промосоздать ')) {
                const p = msg.split(' ');
                if (p.length < 5) return ctx.send('❌ Формат: промосоздать КОД $ 500 10 [секунд]');
                const code = p[1].toUpperCase(), type = p[2], am = parseInt(p[3]), mu = parseInt(p[4]), exp = p[5] ? parseInt(p[5]) : 0;
                if (isNaN(am) || isNaN(mu)) return ctx.send('❌ Числа');
                const ea = exp > 0 ? getMskTimestamp() + exp : 0;
                await executeQuery('INSERT INTO promocodes (code,reward_type,reward_amount,max_uses,created_by,expires_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING', [code, type, am, mu, userId, ea]);
                await ctx.send(`✅ ${code}: ${type}${am} x${mu}${ea > 0 ? ' до ' + new Date(ea*1000).toLocaleDateString('ru-RU') : ' бессрочно'}`);
                return;
            }
            
            // Список промокодов
            if (lower === 'промолист') {
                const pp = await executeQuery('SELECT * FROM promocodes ORDER BY code');
                if (pp.rows.length === 0) return ctx.send('📋 Пусто');
                let t = '📋 Промокоды\n\n';
                pp.rows.forEach(p => {
                    t += `${p.code} — ${p.reward_type}${p.reward_amount} (${p.uses}/${p.max_uses})${p.expires_at > 0 ? ' до ' + new Date(p.expires_at*1000).toLocaleDateString('ru-RU') : ''}\n`;
                });
                await ctx.send(t);
                return;
            }
            
            // Удалить промокод
            if (lower.startsWith('промоудалить ')) {
                const c = lower.replace('промоудалить ', '').toUpperCase();
                await executeQuery('DELETE FROM promocodes WHERE code=$1', [c]);
                await ctx.send(`✅ ${c} удалён`);
                return;
            }
            
            // Статистика
            if (lower === 'стат' || lower.startsWith('стат ')) {
                const p = lower.split(' ')[1] || 'все';
                let sc = '', lb = 'Всё время';
                if (p === 'день') { sc = `WHERE created_at>=${getMskTodayStart()}`; lb = 'День'; }
                else if (p === 'неделя') { sc = `WHERE created_at>=${getMskWeekStart()}`; lb = 'Неделя'; }
                else if (p === 'месяц') { sc = `WHERE created_at>=${getMskMonthStart()}`; lb = 'Месяц'; }
                else if (p === 'год') { sc = `WHERE created_at>=${getMskYearStart()}`; lb = 'Год'; }
                
                const tu = (await executeQuery(`SELECT COUNT(*) as c FROM users ${sc}`)).rows[0].c;
                const au = (await executeQuery(`SELECT COUNT(DISTINCT owner) as c FROM videos ${sc}`)).rows[0].c;
                const nv = (await executeQuery(`SELECT COUNT(*) as c FROM videos ${sc}`)).rows[0].c;
                const tv = (await executeQuery('SELECT SUM(total_views) as t FROM users')).rows[0].t || 0;
                const tl = (await executeQuery('SELECT SUM(total_likes) as t FROM users')).rows[0].t || 0;
                const td = (await executeQuery('SELECT SUM(balance_dollar) as t FROM users')).rows[0].t || 0;
                const tc = (await executeQuery('SELECT SUM(balance_coin) as t FROM users')).rows[0].t || 0;
                const bn = (await executeQuery('SELECT COUNT(*) as c FROM users WHERE is_banned=TRUE')).rows[0].c;
                const ts = (await executeQuery('SELECT SUM(subscribers) as t FROM users')).rows[0].t || 0;
                const hid = (await executeQuery('SELECT COUNT(*) as c FROM users WHERE hide_from_top=TRUE')).rows[0].c;
                
                await ctx.send(`📊 Статистика: ${lb}\n👥 Игроков: ${tu}\n🎬 Авторов: ${au}\n📹 Видео: ${nv}\n👁️ Всего просмотров: ${tv.toLocaleString()}\n💚 Всего лайков: ${tl.toLocaleString()}\n👥 Всего подписчиков: ${ts.toLocaleString()}\n💰 Всего $: $${parseFloat(td).toFixed(2)}\n🪙 Всего монет: ${tc}\n🔒 Скрыто из топов: ${hid}\n🚫 Забанено: ${bn}`);
                return;
            }
            
            // Рассылка
            if (lower.startsWith('рассылка ')) {
                const bm = msg.replace(/^рассылка\s+/i, '');
                if (!bm) return ctx.send('❌ Текст');
                await ctx.send('📨 Рассылка...');
                const r = await broadcastMessage(bm);
                if (r.success) await ctx.send(`✅ Отправлено: ${r.successCount} | ❌ Ошибок: ${r.failCount}`);
                else await ctx.send(`❌ ${r.error}`);
                return;
            }
        }
        
    } catch(e) {
        console.error('❌', e.message);
        await ctx.send('❌ Ошибка');
    }
});

// ==================== ЗАПУСК ====================
async function main() {
    console.log('🚀 Старт...');
    await createPool();
    await createTables();
    await dailyQuestReset();
    await autoViewsLoop();
    vk.updates.start().then(() => console.log('✅ Готов')).catch(e => console.error('❌', e.message));
}
main().catch(console.error);