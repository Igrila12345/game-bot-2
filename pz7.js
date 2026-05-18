'use strict';

const { VK } = require('vk-io');
const { Pool } = require('pg');

// ═══════════════════════════════════════════════════════════
// КОНФИГУРАЦИЯ
// ═══════════════════════════════════════════════════════════
const TOKEN = 'vk1.a.HNnmpDmxOIvciJDbjmakqpR_wO2nsayjIlN_x6DRHYTkXN0ZvcwQKo4yw0MGAcgEQxkzlHDHJYyvwxG0pI_zWhDjxIC1pntUfwIQAtwgXkZHgXImuPEynnhMdVM3CmTEAIbtFweu9jYZyvcj9VEgw2NEYuswi0gJ_RUzH2SDcL97d8NLKChAtodkpDtvJ2jVK9vHpaDSoywIAWJ3qRPweQ';
const ADMIN_ID = 660964860;
const GROUP_ID = 238830713;
const MAX_PIZZERIAS = 50000;
const MAX_LEVEL = 1000;

// ═══════════════════════════════════════════════════════════
// БАЗА ДАННЫХ С АВТОПЕРЕЗАПУСКОМ
// ═══════════════════════════════════════════════════════════
let pool;
let isDbConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT = 50;
const RECONNECT_DELAY = 5000;

function createPool() {
    pool = new Pool({
        connectionString: 'postgresql://neondb_owner:npg_GTCkzIdrgN63@ep-lively-lake-aljgwbr0.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require',
        max: 10,
        idleTimeoutMillis: 60000,
        connectionTimeoutMillis: 10000
    });

    pool.on('error', (err) => {
        console.error('❌ Пул ошибка:', err.message);
        isDbConnected = false;
        if (['57P01', '57P02', '57P03', '08006', '08001', 'ECONNREFUSED', 'ETIMEDOUT'].includes(err.code)) {
            reconnectDB();
        }
    });
}

async function testConnection() {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        isDbConnected = true;
        reconnectAttempts = 0;
        console.log('✅ БД подключена');
        return true;
    } catch (e) {
        console.error('❌ БД недоступна:', e.message);
        isDbConnected = false;
        return false;
    }
}

async function reconnectDB() {
    if (reconnectAttempts >= MAX_RECONNECT) {
        console.error('❌ БД недоступна после 50 попыток');
        return;
    }
    reconnectAttempts++;
    console.log(`🔄 Переподключение ${reconnectAttempts}/${MAX_RECONNECT}...`);
    
    await new Promise(r => setTimeout(r, RECONNECT_DELAY));
    
    try { if (pool) await pool.end().catch(() => {}); } catch (e) {}
    
    createPool();
    const ok = await testConnection();
    if (ok) await initTables();
}

async function executeQuery(query, params = []) {
    for (let attempt = 0; attempt < 3; attempt++) {
        if (!isDbConnected) {
            await reconnectDB();
            if (!isDbConnected) throw new Error('БД недоступна');
        }
        try {
            return await pool.query(query, params);
        } catch (e) {
            console.error(`❌ Запрос (${attempt + 1}):`, e.message);
            if (['57P01', '57P02', '57P03', '08006', '08001', 'ECONNREFUSED', 'ETIMEDOUT', '57P05'].includes(e.code)) {
                isDbConnected = false;
                await reconnectDB();
                if (!isDbConnected && attempt === 2) throw e;
                continue;
            }
            throw e;
        }
    }
}

async function initTables() {
    if (!isDbConnected) return;
    
    try {
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS players (
                user_id BIGINT PRIMARY KEY,
                balance BIGINT DEFAULT 25000,
                pizzerias INT DEFAULT 0,
                income INT DEFAULT 0,
                level INT DEFAULT 1,
                xp INT DEFAULT 0,
                oven1 BOOLEAN DEFAULT FALSE,
                oven2 BOOLEAN DEFAULT FALSE,
                oven3 BOOLEAN DEFAULT FALSE,
                last_buy BIGINT DEFAULT 0,
                hourly_bought INT DEFAULT 0,
                last_income BIGINT DEFAULT 0,
                last_dynamite BIGINT DEFAULT 0,
                last_rat BIGINT DEFAULT 0,
                last_command BIGINT DEFAULT 0,
                shield_until BIGINT DEFAULT 0,
                vip_until BIGINT DEFAULT 0,
                no_cd_until BIGINT DEFAULT 0,
                clan_id INT DEFAULT NULL,
                clan_role TEXT DEFAULT 'member',
                banned BOOLEAN DEFAULT FALSE,
                hidden BOOLEAN DEFAULT FALSE,
                total_pizzerias BIGINT DEFAULT 0,
                donate_balance BIGINT DEFAULT 0
            )
        `);
        
        // Добавляем колонки, если их нет
        const newColumns = [
            ['balance', 'BIGINT DEFAULT 25000'],
            ['pizzerias', 'INT DEFAULT 0'],
            ['income', 'INT DEFAULT 0'],
            ['level', 'INT DEFAULT 1'],
            ['xp', 'INT DEFAULT 0'],
            ['oven1', 'BOOLEAN DEFAULT FALSE'],
            ['oven2', 'BOOLEAN DEFAULT FALSE'],
            ['oven3', 'BOOLEAN DEFAULT FALSE'],
            ['last_buy', 'BIGINT DEFAULT 0'],
            ['hourly_bought', 'INT DEFAULT 0'],
            ['last_income', 'BIGINT DEFAULT 0'],
            ['last_dynamite', 'BIGINT DEFAULT 0'],
            ['last_rat', 'BIGINT DEFAULT 0'],
            ['last_command', 'BIGINT DEFAULT 0'],
            ['shield_until', 'BIGINT DEFAULT 0'],
            ['vip_until', 'BIGINT DEFAULT 0'],
            ['no_cd_until', 'BIGINT DEFAULT 0'],
            ['clan_id', 'INT DEFAULT NULL'],
            ['clan_role', "TEXT DEFAULT 'member'"],
            ['banned', 'BOOLEAN DEFAULT FALSE'],
            ['hidden', 'BOOLEAN DEFAULT FALSE'],
            ['total_pizzerias', 'BIGINT DEFAULT 0'],
            ['donate_balance', 'BIGINT DEFAULT 0'],
        ];
        
        for (const [col, def] of newColumns) {
            try { await executeQuery(`ALTER TABLE players ADD COLUMN IF NOT EXISTS ${col} ${def}`); } catch (e) {}
        }
        
        // Создаём таблицу кланов (с owner_id)
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS clans (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                owner_id BIGINT NOT NULL,
                level INT DEFAULT 1,
                total_income INT DEFAULT 0
            )
        `);
        
        // Добавляем колонки для кланов, если их нет
        try { await executeQuery(`ALTER TABLE clans ADD COLUMN IF NOT EXISTS owner_id BIGINT`); } catch (e) {}
        try { await executeQuery(`ALTER TABLE clans ADD COLUMN IF NOT EXISTS level INT DEFAULT 1`); } catch (e) {}
        try { await executeQuery(`ALTER TABLE clans ADD COLUMN IF NOT EXISTS total_income INT DEFAULT 0`); } catch (e) {}
        
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS promos (
                code TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                amount INT NOT NULL,
                max_uses INT NOT NULL,
                uses INT DEFAULT 0,
                is_vip BOOLEAN DEFAULT FALSE,
                created_by BIGINT,
                active BOOLEAN DEFAULT TRUE
            )
        `);
        
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS promo_uses (
                user_id BIGINT,
                code TEXT,
                PRIMARY KEY (user_id, code)
            )
        `);
        
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS lottery (
                id SERIAL PRIMARY KEY,
                price INT NOT NULL,
                prize_type TEXT DEFAULT 'coins',
                prize_amount INT DEFAULT 0,
                slots INT DEFAULT 10,
                bought INT DEFAULT 0,
                active BOOLEAN DEFAULT TRUE,
                created_at BIGINT
            )
        `);
        
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS lottery_players (
                lottery_id INT,
                user_id BIGINT,
                PRIMARY KEY (lottery_id, user_id)
            )
        `);
        
        try { await executeQuery(`ALTER TABLE lottery ADD COLUMN IF NOT EXISTS prize_type TEXT DEFAULT 'coins'`); } catch (e) {}
        try { await executeQuery(`ALTER TABLE lottery ADD COLUMN IF NOT EXISTS prize_amount INT DEFAULT 0`); } catch (e) {}
        
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS donate_shop (
                id SERIAL PRIMARY KEY,
                item_name TEXT NOT NULL,
                item_key TEXT NOT NULL,
                price_rub INT NOT NULL,
                type TEXT NOT NULL,
                amount INT DEFAULT 0,
                duration INT DEFAULT 0
            )
        `);
        
        // Очищаем старые товары и добавляем новые (с VIP за 500)
        await executeQuery('DELETE FROM donate_shop');
        
        const shopItems = [
            ['100K 🍕', 'balance_100k', 100, 'balance', 100000, 0],
            ['500K 🍕', 'balance_500k', 400, 'balance', 500000, 0],
            ['1M 🍕', 'balance_1m', 700, 'balance', 1000000, 0],
            ['+50 пиццерий', 'pizza_50', 200, 'pizza', 50, 0],
            ['+200 пиццерий', 'pizza_200', 700, 'pizza', 200, 0],
            ['+500 пиццерий', 'pizza_500', 1500, 'pizza', 500, 0],
            ['Золотая печь x3', 'oven3', 5000, 'oven3', 0, 0],
            ['Щит 24 часа', 'shield_24h', 200, 'shield', 0, 86400],
            ['Без КД 7 дней', 'nocd_7d', 100, 'nocd', 0, 604800],
            ['VIP 30 дней', 'vip_30d', 500, 'vip', 0, 2592000],
        ];
        
        for (const item of shopItems) {
            await executeQuery(
                `INSERT INTO donate_shop (item_name, item_key, price_rub, type, amount, duration) 
                 VALUES ($1,$2,$3,$4,$5,$6)`,
                item
            );
        }
        
        console.log('✅ Таблицы готовы');
    } catch (e) {
        console.error('❌ Ошибка таблиц:', e.message);
    }
}

// ═══════════════════════════════════════════════════════════
// ХЕЛПЕРЫ
// ═══════════════════════════════════════════════════════════
function getMskTime() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
}

function getMskTimestamp() {
    return Math.floor(getMskTime().getTime() / 1000);
}

function getMskDay() {
    return getMskTime().getDay();
}

function isWeekend() {
    const day = getMskDay();
    return day === 0 || day === 6;
}

function getHourStart() {
    const now = getMskTime();
    now.setMinutes(0, 0, 0);
    return Math.floor(now.getTime() / 1000);
}

function fmtTime(seconds) {
    if (seconds <= 0) return '0 сек';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h} ч ${m} мин`;
    if (m > 0) return `${m} мин ${s} сек`;
    return `${s} сек`;
}

function xpForLevel(level) {
    return level * 100;
}

async function getPlayer(uid) {
    try {
        const r = await executeQuery('SELECT * FROM players WHERE user_id = $1', [uid]);
        return r.rows[0] || null;
    } catch (e) {
        return null;
    }
}

async function getOrCreate(uid) {
    await executeQuery(`INSERT INTO players (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [uid]);
    return getPlayer(uid);
}

function getOvenMultiplier(p) {
    if (p.oven3) return 3;
    if (p.oven2) return 2;
    if (p.oven1) return 1.5;
    return 1;
}

function getBuyLimit(p) {
    if (p.vip_until > getMskTimestamp()) return 50;
    if (isWeekend()) return 15;
    return 10;
}

function getPizzaPrice() {
    return isWeekend() ? 2500 : 5000;
}

function getClanBonus(p) {
    return p.clan_id ? 0.10 : 0;
}

async function updateIncome(uid) {
    const p = await getPlayer(uid);
    if (!p) return;
    const mult = getOvenMultiplier(p);
    const clanBonus = getClanBonus(p);
    const income = Math.floor(p.pizzerias * 200 * mult * (1 + clanBonus));
    await executeQuery('UPDATE players SET income = $1 WHERE user_id = $2', [income, uid]);
}

async function addXp(uid, amount) {
    const p = await getPlayer(uid);
    if (!p || p.level >= MAX_LEVEL) return;
    
    let newXp = p.xp + amount;
    let newLevel = p.level;
    
    while (newXp >= xpForLevel(newLevel) && newLevel < MAX_LEVEL) {
        newXp -= xpForLevel(newLevel);
        newLevel++;
    }
    
    await executeQuery('UPDATE players SET xp = $1, level = $2 WHERE user_id = $3', [newXp, newLevel, uid]);
    
    if (newLevel > p.level) {
        try {
            await vk.api.messages.send({
                user_id: uid,
                message: `🎉 Уровень ${newLevel}! Поздравляем!`,
                random_id: Math.floor(Math.random() * 1e9)
            });
        } catch (e) {}
    }
}

// ═══════════════════════════════════════════════════════════
// КД МЕЖДУ КОМАНДАМИ (3 СЕКУНДЫ)
// ═══════════════════════════════════════════════════════════
const playerCooldowns = new Map();

async function checkCommandCooldown(uid) {
    const now = getMskTimestamp();
    
    const memoryCd = playerCooldowns.get(uid);
    if (memoryCd && now - memoryCd < 3) {
        return false;
    }
    
    const p = await getPlayer(uid);
    if (p && p.no_cd_until > now) {
        playerCooldowns.set(uid, now);
        return true;
    }
    
    playerCooldowns.set(uid, now);
    await executeQuery('UPDATE players SET last_command = $1 WHERE user_id = $2', [now, uid]).catch(() => {});
    
    return true;
}

setInterval(() => {
    const now = getMskTimestamp();
    for (const [uid, time] of playerCooldowns) {
        if (now - time > 60) playerCooldowns.delete(uid);
    }
}, 30000);

// ═══════════════════════════════════════════════════════════
// КОМАНДЫ ИГРОКОВ
// ═══════════════════════════════════════════════════════════

async function cmdBuy(ctx, uid, count) {
    if (!await checkCommandCooldown(uid)) {
        return ctx.send('⏱ Подождите 3 секунды между командами!');
    }
    
    const p = await getOrCreate(uid);
    if (p.banned) return ctx.send('⛔ Вы забанены.');
    
    const now = getMskTimestamp();
    const hourStart = getHourStart();
    const limit = getBuyLimit(p);
    const price = getPizzaPrice();
    
    let bought = p.hourly_bought;
    if (p.last_buy < hourStart) bought = 0;
    
    count = Math.min(count, limit - bought);
    if (count <= 0) return ctx.send(`❌ Лимит исчерпан. Доступно: ${limit - bought}/${limit}`);
    if (p.pizzerias + count > MAX_PIZZERIAS) return ctx.send(`❌ Максимум ${MAX_PIZZERIAS} пиццерий.`);
    
    const cost = count * price;
    if (p.balance < cost) return ctx.send(`❌ Нужно ${cost} 🍕. Баланс: ${p.balance} 🍕`);
    
    const newPizzerias = p.pizzerias + count;
    const mult = getOvenMultiplier(p);
    const clanBonus = getClanBonus(p);
    const income = Math.floor(newPizzerias * 200 * mult * (1 + clanBonus));
    
    await executeQuery(`
        UPDATE players SET balance = balance - $1, pizzerias = $2, income = $3,
        last_buy = $4, hourly_bought = $5, total_pizzerias = total_pizzerias + $6
        WHERE user_id = $7
    `, [cost, newPizzerias, income, now, bought + count, count, uid]);
    
    await addXp(uid, count * 10);
    
    const wMsg = isWeekend() ? '🎉 ВЫХОДНЫЕ! Цена -50%!' : '';
    await ctx.send([
        wMsg,
        `🏠 Куплено ${count} пиццерий за ${cost} 🍕`,
        `📊 Всего: ${newPizzerias} шт`,
        `📈 Доход: ${income} 🍕/час`,
        `⏱ Лимит: ${bought + count}/${limit}`
    ].filter(Boolean).join('\n'));
}

async function cmdProfile(ctx, uid) {
    if (!await checkCommandCooldown(uid)) {
        return ctx.send('⏱ Подождите 3 секунды между командами!');
    }
    
    const p = await getPlayer(uid);
    if (!p) return ctx.send('❌ Напишите "старт" для регистрации.');
    
    const now = getMskTimestamp();
    const limit = getBuyLimit(p);
    const hourStart = getHourStart();
    let bought = p.hourly_bought;
    if (p.last_buy < hourStart) bought = 0;
    
    const xpNeed = xpForLevel(p.level);
    const xpRemain = xpNeed - p.xp;
    
    const shield = p.shield_until > now ? `активен (${fmtTime(p.shield_until - now)})` : 'нет';
    const vip = p.vip_until > now ? `активен (${Math.ceil((p.vip_until - now) / 86400)} дн)` : 'нет';
    const nocd = p.no_cd_until > now ? `активно (${Math.ceil((p.no_cd_until - now) / 86400)} дн)` : 'нет';
    
    let clanName = 'Нет';
    if (p.clan_id) {
        const c = await executeQuery('SELECT name FROM clans WHERE id = $1', [p.clan_id]);
        if (c.rows[0]) clanName = c.rows[0].name;
    }
    
    await ctx.send([
        `👤 Профиль @id${uid}`,
        ``,
        `📊 Уровень: ${p.level} (${xpRemain} XP до ${p.level + 1} ур)`,
        `🍕 Баланс: ${p.balance.toLocaleString()} 🍕`,
        `🏠 Пиццерий: ${p.pizzerias.toLocaleString()} шт`,
        `📈 Доход: ${p.income.toLocaleString()} 🍕/час`,
        `🛡️ Щит: ${shield}`,
        `💎 VIP: ${vip}`,
        `⚡ Без КД: ${nocd}`,
        `🏠 Клан: ${clanName}`,
        `⏱ Лимит: ${bought}/${limit}`
    ].join('\n'));
}

async function cmdInfo(ctx, uid) {
    if (!await checkCommandCooldown(uid)) {
        return ctx.send('⏱ Подождите 3 секунды между командами!');
    }
    await ctx.send(`🔗 Профиль: @id${uid} (vk.com/id${uid})`);
}

async function cmdDynamite(ctx, uid, targetId) {
    if (!await checkCommandCooldown(uid)) {
        return ctx.send('⏱ Подождите 3 секунды между командами!');
    }
    
    const p = await getOrCreate(uid);
    if (p.banned) return ctx.send('⛔ Вы забанены.');
    
    const now = getMskTimestamp();
    const cd = (p.no_cd_until > now) ? 0 : 7200;
    
    if (cd > 0 && now - p.last_dynamite < cd) {
        return ctx.send(`⏱ Динамит через ${fmtTime(cd - (now - p.last_dynamite))}`);
    }
    if (p.balance < 10000) return ctx.send('❌ Нужно 10 000 🍕');
    
    const target = await getPlayer(targetId);
    if (!target) return ctx.send('❌ Игрок не найден.');
    if (target.banned) return ctx.send('❌ Игрок забанен.');
    if (target.pizzerias <= 0) return ctx.send('❌ У игрока нет пиццерий.');
    
    let damage = Math.floor(Math.random() * 21) + 10;
    let reflect = 0;
    
    if (target.shield_until > now) {
        damage = Math.floor(damage / 2);
        reflect = Math.floor(damage * 0.25);
    }
    if (target.clan_id) damage = Math.floor(damage * 0.8);
    if (p.vip_until > now) damage = Math.floor(damage * 1.25);
    
    damage = Math.min(damage, target.pizzerias);
    
    await executeQuery('UPDATE players SET balance = balance - 10000, last_dynamite = $1 WHERE user_id = $2', [now, uid]);
    await executeQuery('UPDATE players SET pizzerias = GREATEST(0, pizzerias - $1) WHERE user_id = $2', [damage, targetId]);
    
    if (reflect > 0) {
        await executeQuery('UPDATE players SET pizzerias = GREATEST(0, pizzerias - $1) WHERE user_id = $2', [reflect, uid]);
    }
    
    await updateIncome(uid);
    await updateIncome(targetId);
    await addXp(uid, 50);
    
    let msg = `🧨 Динамит у @id${targetId}!\n💥 -${damage} пиццерий`;
    if (reflect > 0) msg += `\n🛡️ Отражение: -${reflect} у тебя`;
    msg += `\n🍕 Баланс: ${p.balance - 10000} 🍕`;
    if (cd > 0) msg += `\n⏱ Следующий через 2 часа`;
    
    await ctx.send(msg);
    
    try {
        await vk.api.messages.send({
            user_id: targetId,
            message: `🧨 @id${uid} взорвал динамит!\n💥 -${damage} пиццерий`,
            random_id: Math.floor(Math.random() * 1e9)
        });
    } catch (e) {}
}

async function cmdRat(ctx, uid, targetId) {
    if (!await checkCommandCooldown(uid)) {
        return ctx.send('⏱ Подождите 3 секунды между командами!');
    }
    
    const p = await getOrCreate(uid);
    if (p.banned) return ctx.send('⛔ Вы забанены.');
    
    const now = getMskTimestamp();
    const cd = (p.no_cd_until > now) ? 0 : 10800;
    
    if (cd > 0 && now - p.last_rat < cd) {
        return ctx.send(`⏱ Крыса через ${fmtTime(cd - (now - p.last_rat))}`);
    }
    if (p.balance < 5000) return ctx.send('❌ Нужно 5 000 🍕');
    
    const target = await getPlayer(targetId);
    if (!target) return ctx.send('❌ Игрок не найден.');
    if (target.banned) return ctx.send('❌ Игрок забанен.');
    if (target.balance <= 0) return ctx.send('❌ У игрока пустой баланс.');
    
    if (Math.random() < 0.1) {
        await executeQuery('UPDATE players SET balance = balance - 5000, last_rat = $1 WHERE user_id = $2', [now, uid]);
        return ctx.send('❌ Крыса попалась!\n💸 Штраф: -5 000 🍕');
    }
    
    let percent = Math.floor(Math.random() * 11) + 5;
    let stolen = Math.floor(target.balance * percent / 100);
    
    if (target.shield_until > now) stolen = Math.floor(stolen / 2);
    if (target.clan_id) stolen = Math.floor(stolen * 0.85);
    if (p.vip_until > now) stolen = Math.floor(stolen * 1.2);
    
    stolen = Math.min(stolen, target.balance);
    
    await executeQuery('UPDATE players SET balance = balance - 5000, last_rat = $1 WHERE user_id = $2', [now, uid]);
    await executeQuery('UPDATE players SET balance = balance - $1 WHERE user_id = $2', [stolen, targetId]);
    await executeQuery('UPDATE players SET balance = balance + $1 WHERE user_id = $2', [stolen, uid]);
    
    await addXp(uid, 30);
    
    let msg = `🐀 Крыса у @id${targetId}!\n💰 +${stolen} 🍕 (${percent}%)`;
    msg += `\n🍕 Баланс: ${p.balance - 5000 + stolen} 🍕`;
    if (cd > 0) msg += `\n⏱ Следующая через 3 часа`;
    
    await ctx.send(msg);
    
    try {
        await vk.api.messages.send({
            user_id: targetId,
            message: `🐀 @id${uid} запустил крысу!\n💰 -${stolen} 🍕`,
            random_id: Math.floor(Math.random() * 1e9)
        });
    } catch (e) {}
}

async function cmdShield(ctx, uid) {
    if (!await checkCommandCooldown(uid)) {
        return ctx.send('⏱ Подождите 3 секунды между командами!');
    }
    
    const p = await getOrCreate(uid);
    if (p.banned) return ctx.send('⛔ Вы забанены.');
    if (p.balance < 25000) return ctx.send('❌ Нужно 25 000 🍕');
    
    const now = getMskTimestamp();
    let newShield = now + 3600;
    if (p.shield_until > now) newShield = p.shield_until + 3600;
    
    await executeQuery('UPDATE players SET balance = balance - 25000, shield_until = $1 WHERE user_id = $2', [newShield, uid]);
    
    await ctx.send([
        '🛡️ Щит активирован!',
        `⏱ До: ${new Date(newShield * 1000).toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК`,
        '🛡️ -50% урона от динамита и крыс'
    ].join('\n'));
}

async function cmdOvens(ctx, uid) {
    if (!await checkCommandCooldown(uid)) {
        return ctx.send('⏱ Подождите 3 секунды между командами!');
    }
    
    const p = await getOrCreate(uid);
    const s = (own) => own ? '✅' : '❌';
    
    await ctx.send([
        '👑 ПЕЧИ (множитель дохода)',
        '',
        `⭐ Премиум x1.5 — 200 000 🍕 ${s(p.oven1)}`,
        `🔥 Мега x2 — 500 000 🍕 ${s(p.oven2)}`,
        `👑 Золотая x3 — 5 000 ₿ (донат) ${s(p.oven3)}`,
        '',
        'Купить за 🍕: купить печь 1 / купить печь 2',
        'Купить за ₿: донат купить печь3'
    ].join('\n'));
}

async function cmdBuyOven(ctx, uid, num) {
    if (!await checkCommandCooldown(uid)) {
        return ctx.send('⏱ Подождите 3 секунды между командами!');
    }
    
    const p = await getOrCreate(uid);
    if (p.banned) return ctx.send('⛔ Вы забанены.');
    
    if (num === 1) {
        if (p.oven1) return ctx.send('❌ Уже куплена.');
        if (p.balance < 200000) return ctx.send('❌ Нужно 200 000 🍕');
        await executeQuery('UPDATE players SET balance = balance - 200000, oven1 = TRUE WHERE user_id = $1', [uid]);
        await updateIncome(uid);
        return ctx.send('✅ Премиум-печь x1.5!');
    }
    if (num === 2) {
        if (p.oven2) return ctx.send('❌ Уже куплена.');
        if (p.balance < 500000) return ctx.send('❌ Нужно 500 000 🍕');
        await executeQuery('UPDATE players SET balance = balance - 500000, oven2 = TRUE WHERE user_id = $1', [uid]);
        await updateIncome(uid);
        return ctx.send('✅ Мега-печь x2!');
    }
    return ctx.send('❌ купить печь 1 или купить печь 2');
}

// ═══════════════════════════════════════════════════════════
// КЛАНЫ (БЕСПЛАТНО)
// ═══════════════════════════════════════════════════════════

async function cmdClanCreate(ctx, uid, name) {
    if (!await checkCommandCooldown(uid)) {
        return ctx.send('⏱ Подождите 3 секунды между командами!');
    }
    
    const p = await getOrCreate(uid);
    if (p.banned) return ctx.send('⛔ Вы забанены.');
    if (p.clan_id) return ctx.send('❌ Вы уже в клане. Сначала: клан выйти');
    if (!name || name.length < 2) return ctx.send('❌ Укажите имя: клан создать [имя]');
    
    try {
        // Создаём клан с owner_id
        const r = await executeQuery(
            'INSERT INTO clans (name, owner_id, level, total_income) VALUES ($1, $2, 1, 0) RETURNING id',
            [name, uid]
        );
        await executeQuery('UPDATE players SET clan_id = $1, clan_role = $2 WHERE user_id = $3', [r.rows[0].id, 'leader', uid]);
        await updateIncome(uid);
        await ctx.send(`✅ Клан «${name}» создан!\nПриглашайте: клан вступить ${name}`);
    } catch (e) {
        if (e.code === '23505') return ctx.send('❌ Имя занято.');
        console.error('Ошибка создания клана:', e.message);
        return ctx.send('❌ Ошибка при создании клана.');
    }
}

async function cmdClanJoin(ctx, uid, name) {
    if (!await checkCommandCooldown(uid)) {
        return ctx.send('⏱ Подождите 3 секунды между командами!');
    }
    
    const p = await getOrCreate(uid);
    if (p.banned) return ctx.send('⛔ Вы забанены.');
    if (p.clan_id) return ctx.send('❌ Вы уже в клане. Сначала: клан выйти');
    
    const c = await executeQuery('SELECT id FROM clans WHERE name = $1', [name]);
    if (!c.rows[0]) return ctx.send('❌ Клан не найден.');
    
    await executeQuery('UPDATE players SET clan_id = $1, clan_role = $2 WHERE user_id = $3', [c.rows[0].id, 'member', uid]);
    await updateIncome(uid);
    await ctx.send(`✅ Вы вступили в «${name}»!`);
}

async function cmdClanLeave(ctx, uid) {
    if (!await checkCommandCooldown(uid)) {
        return ctx.send('⏱ Подождите 3 секунды между командами!');
    }
    
    const p = await getPlayer(uid);
    if (!p || !p.clan_id) return ctx.send('❌ Вы не в клане.');
    
    if (p.clan_role === 'leader') {
        const m = await executeQuery('SELECT user_id FROM players WHERE clan_id = $1 AND user_id != $2 LIMIT 1', [p.clan_id, uid]);
        if (m.rows[0]) {
            await executeQuery('UPDATE players SET clan_role = $1 WHERE user_id = $2', ['leader', m.rows[0].user_id]);
            await executeQuery('UPDATE clans SET owner_id = $1 WHERE id = $2', [m.rows[0].user_id, p.clan_id]);
        } else {
            await executeQuery('DELETE FROM clans WHERE id = $1', [p.clan_id]);
        }
    }
    
    await executeQuery('UPDATE players SET clan_id = NULL, clan_role = $1 WHERE user_id = $2', ['member', uid]);
    await updateIncome(uid);
    await ctx.send('✅ Вы вышли из клана.');
}

async function cmdClanInfo(ctx, uid) {
    if (!await checkCommandCooldown(uid)) {
        return ctx.send('⏱ Подождите 3 секунды между командами!');
    }
    
    const p = await getPlayer(uid);
    if (!p || !p.clan_id) return ctx.send('❌ Вы не в клане.');
    
    const c = await executeQuery('SELECT * FROM clans WHERE id = $1', [p.clan_id]);
    if (!c.rows[0]) return ctx.send('❌ Клан не найден.');
    
    const count = await executeQuery('SELECT COUNT(*) as cnt FROM players WHERE clan_id = $1', [p.clan_id]);
    const income = await executeQuery('SELECT SUM(income) as t FROM players WHERE clan_id = $1', [p.clan_id]);
    
    await ctx.send([
        `🏠 Клан «${c.rows[0].name}»`,
        `👑 Лидер: @id${c.rows[0].owner_id}`,
        `👥 Участников: ${count.rows[0].cnt}`,
        `📈 Доход: ${(income.rows[0].t || 0).toLocaleString()} 🍕/час`,
        `⭐ Уровень: ${c.rows[0].level}`
    ].join('\n'));
}

async function cmdClanList(ctx, uid) {
    if (!await checkCommandCooldown(uid)) {
        return ctx.send('⏱ Подождите 3 секунды между командами!');
    }
    
    const p = await getPlayer(uid);
    if (!p || !p.clan_id || p.clan_role !== 'leader') return ctx.send('❌ Только лидер может смотреть список.');
    
    const members = await executeQuery('SELECT user_id, clan_role, level, pizzerias FROM players WHERE clan_id = $1 ORDER BY pizzerias DESC', [p.clan_id]);
    
    const lines = ['👥 Участники:', ''];
    for (const m of members.rows) {
        const role = m.clan_role === 'leader' ? '👑' : '👤';
        lines.push(`${role} @id${m.user_id} — ур.${m.level} | ${m.pizzerias} шт`);
    }
    await ctx.send(lines.join('\n'));
}

async function cmdTop(ctx) {
    const r = await executeQuery('SELECT user_id, pizzerias, income FROM players WHERE banned = FALSE AND hidden = FALSE ORDER BY pizzerias DESC LIMIT 10');
    if (!r.rows.length) return ctx.send('📊 Рейтинг пока пуст.');
    
    const lines = ['🏆 ТОП-10 ПО ПИЦЦЕРИЯМ', ''];
    for (let i = 0; i < r.rows.length; i++) {
        lines.push(`${i + 1}. @id${r.rows[i].user_id} — ${r.rows[i].pizzerias.toLocaleString()} шт (${r.rows[i].income.toLocaleString()} 🍕/час)`);
    }
    await ctx.send(lines.join('\n'));
}

async function cmdTopBalance(ctx) {
    const r = await executeQuery('SELECT user_id, balance FROM players WHERE banned = FALSE AND hidden = FALSE ORDER BY balance DESC LIMIT 10');
    if (!r.rows.length) return ctx.send('📊 Рейтинг пока пуст.');
    
    const lines = ['💰 ТОП-10 ПО БАЛАНСУ', ''];
    for (let i = 0; i < r.rows.length; i++) {
        lines.push(`${i + 1}. @id${r.rows[i].user_id} — ${r.rows[i].balance.toLocaleString()} 🍕`);
    }
    await ctx.send(lines.join('\n'));
}

async function cmdTopClans(ctx) {
    const r = await executeQuery(`
        SELECT c.name, COALESCE(SUM(p.income), 0) as total, COUNT(p.user_id) as cnt
        FROM clans c LEFT JOIN players p ON c.id = p.clan_id
        GROUP BY c.id, c.name ORDER BY total DESC LIMIT 10
    `);
    if (!r.rows.length) return ctx.send('📊 Рейтинг пока пуст.');
    
    const lines = ['🏆 ТОП-10 КЛАНОВ', ''];
    for (let i = 0; i < r.rows.length; i++) {
        lines.push(`${i + 1}. ${r.rows[i].name} — ${r.rows[i].total.toLocaleString()} 🍕/час (${r.rows[i].cnt} чел)`);
    }
    await ctx.send(lines.join('\n'));
}

async function cmdLotteryInfo(ctx) {
    const l = await executeQuery('SELECT * FROM lottery WHERE active = TRUE LIMIT 1');
    if (!l.rows[0]) return ctx.send('🎟️ Нет активной лотереи.');
    
    const prizeText = l.rows[0].prize_type === 'pizza' 
        ? `${l.rows[0].prize_amount || l.rows[0].price * l.rows[0].slots} пиццерий`
        : `${l.rows[0].prize_amount || l.rows[0].price * l.rows[0].slots} 🍕`;
    
    await ctx.send([
        '🎟️ ЛОТЕРЕЯ',
        '',
        `💰 Цена билета: ${l.rows[0].price} 🍕`,
        `👥 Участников: ${l.rows[0].bought}/${l.rows[0].slots}`,
        `🏆 Приз: ${prizeText}`,
        '',
        'Купить билет: лотерея купить'
    ].join('\n'));
}

async function cmdLotteryBuy(ctx, uid) {
    if (!await checkCommandCooldown(uid)) {
        return ctx.send('⏱ Подождите 3 секунды между командами!');
    }
    
    const p = await getOrCreate(uid);
    if (p.banned) return ctx.send('⛔ Вы забанены.');
    
    const l = await executeQuery('SELECT * FROM lottery WHERE active = TRUE LIMIT 1');
    if (!l.rows[0]) return ctx.send('🎟️ Нет активной лотереи.');
    
    if (p.balance < l.rows[0].price) return ctx.send(`❌ Нужно ${l.rows[0].price} 🍕. Баланс: ${p.balance} 🍕`);
    
    const already = await executeQuery('SELECT * FROM lottery_players WHERE lottery_id = $1 AND user_id = $2', [l.rows[0].id, uid]);
    if (already.rows[0]) return ctx.send('❌ Вы уже купили билет.');
    
    await executeQuery('UPDATE players SET balance = balance - $1 WHERE user_id = $2', [l.rows[0].price, uid]);
    await executeQuery('INSERT INTO lottery_players (lottery_id, user_id) VALUES ($1, $2)', [l.rows[0].id, uid]);
    await executeQuery('UPDATE lottery SET bought = bought + 1 WHERE id = $1', [l.rows[0].id]);
    
    const updated = await executeQuery('SELECT * FROM lottery WHERE id = $1', [l.rows[0].id]);
    const lot = updated.rows[0];
    
    if (lot.bought >= lot.slots) {
        await finishLottery(lot, ctx);
    } else {
        await ctx.send(`🎟️ Билет куплен! ${lot.bought}/${lot.slots}`);
    }
}

async function finishLottery(lot, ctx) {
    const players = await executeQuery('SELECT user_id FROM lottery_players WHERE lottery_id = $1', [lot.id]);
    if (!players.rows.length) return;
    
    const winner = players.rows[Math.floor(Math.random() * players.rows.length)].user_id;
    
    let prizeMsg = '';
    if (lot.prize_type === 'pizza') {
        const prize = lot.prize_amount || lot.price * lot.slots;
        await executeQuery('UPDATE players SET pizzerias = LEAST($1, pizzerias + $2) WHERE user_id = $3', [MAX_PIZZERIAS, prize, winner]);
        await updateIncome(winner);
        prizeMsg = `${prize} пиццерий`;
    } else {
        const prize = lot.prize_amount || lot.price * lot.slots;
        await executeQuery('UPDATE players SET balance = balance + $1 WHERE user_id = $2', [prize, winner]);
        prizeMsg = `${prize} 🍕`;
    }
    
    await executeQuery('UPDATE lottery SET active = FALSE WHERE id = $1', [lot.id]);
    
    const msg = [
        '🎉 ЛОТЕРЕЯ ЗАВЕРШЕНА!',
        '',
        `🏆 Победитель: @id${winner}`,
        `💰 Приз: ${prizeMsg}`,
        '',
        'Поздравляем победителя!'
    ].join('\n');
    
    if (ctx) {
        await ctx.send(msg);
    } else {
        for (const p of players.rows) {
            try {
                await vk.api.messages.send({
                    user_id: p.user_id,
                    message: msg,
                    random_id: Math.floor(Math.random() * 1e9)
                });
                await new Promise(r => setTimeout(r, 2000));
            } catch (e) {}
        }
    }
}

async function cmdPromo(ctx, uid, code) {
    if (!await checkCommandCooldown(uid)) {
        return ctx.send('⏱ Подождите 3 секунды между командами!');
    }
    
    const p = await getOrCreate(uid);
    if (p.banned) return ctx.send('⛔ Вы забанены.');
    
    const promo = await executeQuery('SELECT * FROM promos WHERE code = $1 AND active = TRUE', [code]);
    if (!promo.rows[0]) return ctx.send('❌ Промокод не найден или неактивен.');
    
    const pr = promo.rows[0];
    
    if (pr.is_vip && p.vip_until <= getMskTimestamp()) {
        return ctx.send('❌ Этот промокод только для VIP-игроков.');
    }
    
    const used = await executeQuery('SELECT * FROM promo_uses WHERE user_id = $1 AND code = $2', [uid, code]);
    if (used.rows[0]) return ctx.send('❌ Вы уже использовали этот промокод.');
    if (pr.uses >= pr.max_uses) return ctx.send('❌ Промокод закончился.');
    
    await executeQuery('INSERT INTO promo_uses (user_id, code) VALUES ($1, $2)', [uid, code]);
    await executeQuery('UPDATE promos SET uses = uses + 1 WHERE code = $1', [code]);
    
    switch (pr.type) {
        case 'coins':
            await executeQuery('UPDATE players SET balance = balance + $1 WHERE user_id = $2', [pr.amount, uid]);
            await ctx.send(`🎟️ Промокод!\n💰 +${pr.amount} 🍕`);
            break;
        case 'pizza':
            await executeQuery('UPDATE players SET pizzerias = LEAST($1, pizzerias + $2) WHERE user_id = $3', [MAX_PIZZERIAS, pr.amount, uid]);
            await updateIncome(uid);
            await ctx.send(`🎟️ Промокод!\n🏠 +${pr.amount} пиццерий`);
            break;
        case 'shield':
            const now = getMskTimestamp();
            await executeQuery('UPDATE players SET shield_until = $1 WHERE user_id = $2', [now + pr.amount, uid]);
            await ctx.send(`🎟️ Промокод!\n🛡️ Щит на ${fmtTime(pr.amount)}`);
            break;
        case 'vip':
            const vipEnd = getMskTimestamp() + pr.amount;
            await executeQuery('UPDATE players SET vip_until = $1 WHERE user_id = $2', [vipEnd, uid]);
            await ctx.send(`🎟️ Промокод!\n💎 VIP на ${Math.ceil(pr.amount / 86400)} дн`);
            break;
        case 'oven1':
            await executeQuery('UPDATE players SET oven1 = TRUE WHERE user_id = $1', [uid]);
            await updateIncome(uid);
            await ctx.send('🎟️ Промокод!\n⭐ Премиум-печь!');
            break;
        case 'oven2':
            await executeQuery('UPDATE players SET oven2 = TRUE WHERE user_id = $1', [uid]);
            await updateIncome(uid);
            await ctx.send('🎟️ Промокод!\n🔥 Мега-печь!');
            break;
        default:
            await ctx.send('🎟️ Промокод активирован!');
    }
}

async function cmdDonate(ctx) {
    await ctx.send([
        '💎 ДОНАТ-МАГАЗИН',
        '1₿ = 1₽',
        '',
        '💰 БАЛАНС:',
        '• 100K 🍕 — 100 ₿ (донат купить баланс_100к)',
        '• 500K 🍕 — 400 ₿ (донат купить баланс_500к)',
        '• 1M 🍕 — 700 ₿ (донат купить баланс_1м)',
        '',
        '🏠 ПИЦЦЕРИИ:',
        '• +50 шт — 200 ₿ (донат купить пиццерии_50)',
        '• +200 шт — 700 ₿ (донат купить пиццерии_200)',
        '• +500 шт — 1 500 ₿ (донат купить пиццерии_500)',
        '',
        '👑 Золотая печь x3 — 5 000 ₿ (донат купить печь3)',
        '🛡️ Щит 24 часа — 200 ₿ (донат купить щит)',
        '⚡ Без КД 7 дней — 100 ₿ (донат купить nocd)',
        '👑 VIP 30 дней — 500 ₿ (донат купить вип)'
    ].join('\n'));
}

async function cmdDonateBuy(ctx, uid, item) {
    if (!await checkCommandCooldown(uid)) {
        return ctx.send('⏱ Подождите 3 секунды между командами!');
    }
    
    const p = await getOrCreate(uid);
    if (p.banned) return ctx.send('⛔ Вы забанены.');
    
    const shop = await executeQuery('SELECT * FROM donate_shop WHERE item_key = $1', [item]);
    if (!shop.rows[0]) return ctx.send('❌ Товар не найден. Список: донат');
    
    const s = shop.rows[0];
    const now = getMskTimestamp();
    
    switch (s.type) {
        case 'balance':
            await executeQuery('UPDATE players SET balance = balance + $1, donate_balance = donate_balance + $2 WHERE user_id = $3', [s.amount, s.price_rub, uid]);
            await ctx.send(`💎 +${s.amount.toLocaleString()} 🍕`);
            break;
            
        case 'pizza':
            await executeQuery('UPDATE players SET pizzerias = LEAST($1, pizzerias + $2), donate_balance = donate_balance + $3 WHERE user_id = $4', [MAX_PIZZERIAS, s.amount, s.price_rub, uid]);
            await updateIncome(uid);
            await ctx.send(`💎 +${s.amount} пиццерий`);
            break;
            
        case 'oven3':
            if (p.oven3) return ctx.send('❌ Золотая печь уже куплена.');
            await executeQuery('UPDATE players SET oven3 = TRUE, donate_balance = donate_balance + $1 WHERE user_id = $2', [s.price_rub, uid]);
            await updateIncome(uid);
            await ctx.send('💎 Золотая печь x3!');
            break;
            
        case 'shield':
            const shieldEnd = p.shield_until > now ? p.shield_until + s.duration : now + s.duration;
            await executeQuery('UPDATE players SET shield_until = $1, donate_balance = donate_balance + $2 WHERE user_id = $3', [shieldEnd, s.price_rub, uid]);
            await ctx.send('💎 Щит на 24 часа!');
            break;
            
        case 'nocd':
            const nocdEnd = p.no_cd_until > now ? p.no_cd_until + s.duration : now + s.duration;
            await executeQuery('UPDATE players SET no_cd_until = $1, donate_balance = donate_balance + $2 WHERE user_id = $3', [nocdEnd, s.price_rub, uid]);
            playerCooldowns.set(uid, 0);
            await ctx.send('💎 Без КД на 7 дней! Все кулдауны отключены.');
            break;
            
        case 'vip':
            const vipEnd = p.vip_until > now ? p.vip_until + s.duration : now + s.duration;
            await executeQuery('UPDATE players SET vip_until = $1, donate_balance = donate_balance + $2 WHERE user_id = $3', [vipEnd, s.price_rub, uid]);
            await ctx.send('💎 VIP на 30 дней!');
            break;
            
        default:
            return ctx.send('❌ Ошибка типа товара.');
    }
}

// ═══════════════════════════════════════════════════════════
// ПОНЯТНАЯ ПОМОЩЬ
// ═══════════════════════════════════════════════════════════
async function cmdHelp(ctx) {
    await ctx.send([
        '🍕 PIZZA TYCOON — ПОМОЩЬ',
        '',
        '📋 ОСНОВНЫЕ КОМАНДЫ:',
        '• старт — начать игру',
        '• профиль — посмотреть свой профиль',
        '• купить [число] — купить пиццерии (например: купить 10)',
        '• хелп — эта помощь',
        '',
        '⚔️ АТАКИ:',
        '• динамит @игрок — сломать 10-30 пиццерий (цена 10 000🍕)',
        '• крыса @игрок — украсть 5-15% баланса (цена 5 000🍕)',
        '',
        '🛡️ ЗАЩИТА:',
        '• щит — защита от атак на 1 час (цена 25 000🍕)',
        '',
        '👑 ПЕЧИ (увеличивают доход):',
        '• печи — посмотреть список',
        '• купить печь 1 — печь x1.5 (цена 200 000🍕)',
        '• купить печь 2 — печь x2 (цена 500 000🍕)',
        '',
        '🏠 КЛАНЫ:',
        '• клан создать [имя] — создать клан (бесплатно)',
        '• клан вступить [имя] — войти в клан',
        '• клан — информация о вашем клане',
        '• клан выйти — покинуть клан',
        '',
        '📊 РЕЙТИНГИ:',
        '• топ — топ-10 игроков по пиццериям',
        '• топ баланс — топ-10 по балансу',
        '• топ кланов — топ-10 кланов',
        '',
        '🎟️ ЛОТЕРЕЯ:',
        '• лотерея — информация о лотерее',
        '• лотерея купить — купить билет',
        '',
        '🎟️ ПРОМОКОДЫ:',
        '• промокод [код] — активировать код',
        '',
        '💎 ДОНАТ:',
        '• донат — посмотреть магазин',
        '• донат купить [ключ] — купить товар',
        '',
        '⏱ КД между командами: 3 секунды',
        '⚡ "Без КД" убирает все задержки',
        '🎉 Выходные: скидка 50% на пиццерии'
    ].join('\n'));
}

// ═══════════════════════════════════════════════════════════
// АДМИН-КОМАНДЫ
// ═══════════════════════════════════════════════════════════

async function cmdAdmin(ctx, uid, text) {
    const parts = text.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    
    if (cmd === '!admin') {
        return ctx.send([
            '👑 АДМИН-КОМАНДЫ',
            '',
            '👤 ИГРОКИ:',
            '• !бан @user — заблокировать',
            '• !разбан @user — разблокировать',
            '• !скрыть @user — скрыть из топов',
            '• !показать @user — вернуть в топы',
            '• !профиль [ID] — инфо об игроке',
            '',
            '💰 ВЫДАЧА:',
            '• !дать [ID] [сумма] — выдать 🍕',
            '• !датьпиц [ID] [кол-во] — выдать пиццерии',
            '',
            '💎 ДОНАТ (РУЧНОЕ УПРАВЛЕНИЕ):',
            '• !донат дать [ID] [сумма] — начислить донат-баланс',
            '• !донат снять [ID] [сумма] — снять донат-баланс',
            '• !донат инфо [ID] — посмотреть донат-баланс',
            '',
            '🎟️ ЛОТЕРЕЯ:',
            '• !лотерея создать [цена] [участники] [тип] [приз]',
            '  Пример: !лотерея создать 1000 15 coins 50000',
            '  Пример: !лотерея создать 5000 10 pizza 100',
            '  Типы призов: coins (🍕), pizza (пиццерии)',
            '• !лотерея стоп — завершить и выбрать победителя',
            '',
            '🎟️ ПРОМОКОДЫ:',
            '• !промо создать [код] [тип] [кол-во] [макс]',
            '  Типы: coins, pizza, shield, vip, oven1, oven2',
            '• !промо вип [код] [тип] [кол-во] [макс]',
            '• !промо список — все коды',
            '• !промо удалить [код] — удалить',
            '',
            '💎 МАГАЗИН:',
            '• !донат список — список товаров',
            '',
            '📊 ПРОЧЕЕ:',
            '• !стат — статистика',
            '• /рассылка [текст] — всем игрокам'
        ].join('\n'));
    }
    
    if (cmd === '!бан') {
        const tid = extractId(text);
        if (!tid) return ctx.send('❌ !бан @user');
        await executeQuery('UPDATE players SET banned = TRUE WHERE user_id = $1', [tid]);
        return ctx.send(`⛔ @id${tid} забанен.`);
    }
    
    if (cmd === '!разбан') {
        const tid = extractId(text);
        if (!tid) return ctx.send('❌ !разбан @user');
        await executeQuery('UPDATE players SET banned = FALSE WHERE user_id = $1', [tid]);
        return ctx.send(`✅ @id${tid} разбанен.`);
    }
    
    if (cmd === '!скрыть') {
        const tid = extractId(text);
        if (!tid) return ctx.send('❌ !скрыть @user');
        await executeQuery('UPDATE players SET hidden = TRUE WHERE user_id = $1', [tid]);
        return ctx.send(`🔒 @id${tid} скрыт из топов.`);
    }
    
    if (cmd === '!показать') {
        const tid = extractId(text);
        if (!tid) return ctx.send('❌ !показать @user');
        await executeQuery('UPDATE players SET hidden = FALSE WHERE user_id = $1', [tid]);
        return ctx.send(`🔓 @id${tid} виден в топах.`);
    }
    
    if (cmd === '!профиль') {
        const tid = parseInt(parts[1]);
        if (!tid) return ctx.send('❌ !профиль [ID]');
        const p = await getPlayer(tid);
        if (!p) return ctx.send('❌ Игрок не найден.');
        return ctx.send(`👤 @id${tid}\n📊 Ур: ${p.level} | 🍕 ${p.balance.toLocaleString()}\n🏠 ${p.pizzerias} шт | 📈 ${p.income}/час\n💎 Донат: ${p.donate_balance.toLocaleString()} ₿\n🚫 ${p.banned ? 'Бан' : 'Ок'} | 🔒 ${p.hidden ? 'Скрыт' : 'Виден'}`);
    }
    
    if (cmd === '!дать') {
        const tid = parseInt(parts[1]);
        const amt = parseInt(parts[2]);
        if (!tid || !amt) return ctx.send('❌ !дать [ID] [сумма]');
        await executeQuery('UPDATE players SET balance = balance + $1 WHERE user_id = $2', [amt, tid]);
        return ctx.send(`💰 @id${tid} +${amt} 🍕`);
    }
    
    if (cmd === '!датьпиц') {
        const tid = parseInt(parts[1]);
        const amt = parseInt(parts[2]);
        if (!tid || !amt) return ctx.send('❌ !датьпиц [ID] [кол-во]');
        await executeQuery('UPDATE players SET pizzerias = LEAST($1, pizzerias + $2) WHERE user_id = $3', [MAX_PIZZERIAS, amt, tid]);
        await updateIncome(tid);
        return ctx.send(`🏠 @id${tid} +${amt} пиццерий`);
    }
    
    // КОМАНДЫ ДОНАТА
    if (cmd === '!донат' && parts[1] === 'дать') {
        const tid = parseInt(parts[2]);
        const amt = parseInt(parts[3]);
        if (!tid || !amt) return ctx.send('❌ !донат дать [ID] [сумма]');
        await executeQuery('UPDATE players SET donate_balance = donate_balance + $1 WHERE user_id = $2', [amt, tid]);
        return ctx.send(`💎 @id${tid} +${amt} ₿ (донат-баланс: пополнен)`);
    }
    
    if (cmd === '!донат' && parts[1] === 'снять') {
        const tid = parseInt(parts[2]);
        const amt = parseInt(parts[3]);
        if (!tid || !amt) return ctx.send('❌ !донат снять [ID] [сумма]');
        await executeQuery('UPDATE players SET donate_balance = GREATEST(0, donate_balance - $1) WHERE user_id = $2', [amt, tid]);
        return ctx.send(`💎 @id${tid} -${amt} ₿ (донат-баланс: уменьшен)`);
    }
    
    if (cmd === '!донат' && parts[1] === 'инфо') {
        const tid = parseInt(parts[2]);
        if (!tid) return ctx.send('❌ !донат инфо [ID]');
        const p = await getPlayer(tid);
        if (!p) return ctx.send('❌ Игрок не найден.');
        return ctx.send(`💎 Донат-баланс @id${tid}: ${p.donate_balance.toLocaleString()} ₿`);
    }
    
    if (cmd === '!лотерея' && parts[1] === 'создать') {
        const price = parseInt(parts[2]);
        const slots = parseInt(parts[3]) || 10;
        const prizeType = parts[4] || 'coins';
        const prizeAmount = parseInt(parts[5]) || 0;
        
        if (!price) return ctx.send('❌ !лотерея создать [цена] [участники] [тип] [приз]\nПример: !лотерея создать 1000 15 coins 50000');
        if (!['coins', 'pizza'].includes(prizeType)) return ctx.send('❌ Тип приза: coins или pizza');
        
        await executeQuery('UPDATE lottery SET active = FALSE WHERE active = TRUE');
        await executeQuery('INSERT INTO lottery (price, slots, prize_type, prize_amount, created_at) VALUES ($1, $2, $3, $4, $5)', [price, slots, prizeType, prizeAmount, getMskTimestamp()]);
        
        const prizeText = prizeType === 'pizza' ? `${prizeAmount || price * slots} пиццерий` : `${prizeAmount || price * slots} 🍕`;
        return ctx.send(`🎟️ Лотерея создана!\n💰 Билет: ${price} 🍕\n👥 Мест: ${slots}\n🏆 Приз: ${prizeText}\n\nАвто-розыгрыш при заполнении или !лотерея стоп`);
    }
    
    if (cmd === '!лотерея' && parts[1] === 'стоп') {
        const l = await executeQuery('SELECT * FROM lottery WHERE active = TRUE LIMIT 1');
        if (!l.rows[0]) return ctx.send('❌ Нет активной лотереи.');
        
        await finishLottery(l.rows[0], ctx);
        return;
    }
    
    if (cmd === '!промо' && parts[1] === 'создать') {
        const code = parts[2]?.toUpperCase();
        const type = parts[3];
        const amt = parseInt(parts[4]);
        const max = parseInt(parts[5]) || 1;
        if (!code || !type || !amt) return ctx.send('❌ !промо создать [код] [тип] [кол-во] [макс]\nТипы: coins, pizza, shield, vip, oven1, oven2');
        await executeQuery('INSERT INTO promos (code, type, amount, max_uses, created_by) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [code, type, amt, max, uid]);
        return ctx.send(`🎟️ Промокод ${code} создан!`);
    }
    
    if (cmd === '!промо' && parts[1] === 'вип') {
        const code = parts[2]?.toUpperCase();
        const type = parts[3];
        const amt = parseInt(parts[4]);
        const max = parseInt(parts[5]) || 1;
        if (!code || !type || !amt) return ctx.send('❌ !промо вип [код] [тип] [кол-во] [макс]');
        await executeQuery('INSERT INTO promos (code, type, amount, max_uses, is_vip, created_by) VALUES ($1,$2,$3,$4,TRUE,$5) ON CONFLICT DO NOTHING', [code, type, amt, max, uid]);
        return ctx.send(`🎟️ VIP-промокод ${code} создан!`);
    }
    
    if (cmd === '!промо' && parts[1] === 'список') {
        const list = await executeQuery('SELECT * FROM promos ORDER BY code');
        if (!list.rows.length) return ctx.send('📋 Нет созданных промокодов.');
        const lines = ['📋 Промокоды:', ''];
        for (const p of list.rows) {
            lines.push(`${p.active ? '✅' : '❌'} ${p.code} | ${p.type} ${p.amount} | ${p.uses}/${p.max_uses} ${p.is_vip ? 'VIP' : ''}`);
        }
        return ctx.send(lines.join('\n'));
    }
    
    if (cmd === '!промо' && parts[1] === 'удалить') {
        const code = parts[2]?.toUpperCase();
        if (!code) return ctx.send('❌ !промо удалить [код]');
        await executeQuery('DELETE FROM promos WHERE code = $1', [code]);
        return ctx.send(`✅ Промокод ${code} удалён.`);
    }
    
    if (cmd === '!донат' && parts[1] === 'список') {
        const list = await executeQuery('SELECT * FROM donate_shop ORDER BY price_rub');
        const lines = ['💎 ДОНАТ-ТОВАРЫ:', ''];
        for (const d of list.rows) {
            lines.push(`${d.item_name} | ключ: ${d.item_key} | ${d.price_rub}₽`);
        }
        return ctx.send(lines.join('\n'));
    }
    
    if (cmd === '!стат') {
        const u = await executeQuery('SELECT COUNT(*) as c FROM players');
        const tp = await executeQuery('SELECT SUM(pizzerias) as t FROM players');
        const tb = await executeQuery('SELECT SUM(balance) as t FROM players');
        const bn = await executeQuery('SELECT COUNT(*) as c FROM players WHERE banned = TRUE');
        const cl = await executeQuery('SELECT COUNT(*) as c FROM clans');
        const dd = await executeQuery('SELECT SUM(donate_balance) as t FROM players');
        return ctx.send([
            '📊 СТАТИСТИКА БОТА',
            '',
            `👥 Всего игроков: ${u.rows[0].c}`,
            `🏠 Всего пиццерий: ${(tp.rows[0].t || 0).toLocaleString()}`,
            `🍕 Общий баланс: ${(tb.rows[0].t || 0).toLocaleString()}`,
            `💎 Сумма доната: ${(dd.rows[0].t || 0).toLocaleString()} ₿`,
            `🚫 Забанено: ${bn.rows[0].c}`,
            `🏠 Кланов: ${cl.rows[0].c}`
        ].join('\n'));
    }
    
    if (cmd === '/рассылка') {
        const msg = text.slice('/рассылка'.length).trim();
        if (!msg) return ctx.send('❌ /рассылка [текст]');
        
        const users = await executeQuery('SELECT user_id FROM players WHERE banned = FALSE');
        let ok = 0, fail = 0;
        
        for (const u of users.rows) {
            try {
                await vk.api.messages.send({
                    user_id: u.user_id,
                    message: msg,
                    random_id: Math.floor(Math.random() * 1e9)
                });
                ok++;
            } catch (e) { fail++; }
            await new Promise(r => setTimeout(r, 2000));
        }
        return ctx.send(`📨 Рассылка завершена!\n✅ Доставлено: ${ok}\n❌ Ошибок: ${fail}`);
    }
}

function extractId(text) {
    const m = text.match(/\[id(\d+)\|/);
    if (m) return parseInt(m[1]);
    const m2 = text.match(/@id(\d+)/);
    if (m2) return parseInt(m2[1]);
    const parts = text.split(/\s+/);
    for (const p of parts) {
        const n = parseInt(p);
        if (!isNaN(n) && n > 1000) return n;
    }
    return null;
}

// ═══════════════════════════════════════════════════════════
// НАЧИСЛЕНИЕ ДОХОДА
// ═══════════════════════════════════════════════════════════
async function hourlyIncome() {
    if (!isDbConnected) return;
    try {
        const players = await executeQuery('SELECT user_id, income FROM players WHERE pizzerias > 0 AND banned = FALSE');
        for (const p of players.rows) {
            await executeQuery('UPDATE players SET balance = balance + $1 WHERE user_id = $2', [p.income, p.user_id]);
        }
        console.log(`💰 Доход начислен: ${players.rows.length} игроков`);
    } catch (e) {
        console.error('❌ Ошибка дохода:', e.message);
    }
}

// ═══════════════════════════════════════════════════════════
// НАШЕСТВИЕ
// ═══════════════════════════════════════════════════════════
async function hourlyEvent() {
    if (!isDbConnected) return;
    
    try {
        const events = [
            { name: '🐀 Крысиное нашествие', chance: 25, effect: 'balance', percent: 3, msg: 'Крысы атаковали город! Все теряют 3% баланса! (щит защищает)' },
            { name: '🚨 Санинспекция', chance: 20, effect: 'random_player', percent: 5, msg: 'Санинспекция! Случайный игрок потерял 5% пиццерий.' },
            { name: '🎉 День пиццы', chance: 15, effect: 'buff', msg: '🎉 День пиццы! Повышенный спрос — доход увеличен!' },
            { name: '🌟 Звездный час', chance: 10, effect: 'random_buff', msg: '🌟 Случайный игрок получил +500 пиццерий!' },
            { name: '💀 Чёрный день', chance: 5, effect: 'debuff', msg: '💀 Кризис в городе! Доход временно снижен.' }
        ];
        
        const roll = Math.random() * 100;
        let cum = 0;
        let chosen = null;
        
        for (const e of events) {
            cum += e.chance;
            if (roll <= cum) { chosen = e; break; }
        }
        
        if (!chosen) return;
        
        const now = getMskTimestamp();
        
        if (chosen.effect === 'balance') {
            const players = await executeQuery('SELECT user_id, balance FROM players WHERE banned = FALSE AND shield_until < $1', [now]);
            for (const p of players.rows) {
                const loss = Math.floor(p.balance * chosen.percent / 100);
                if (loss > 0) {
                    await executeQuery('UPDATE players SET balance = GREATEST(0, balance - $1) WHERE user_id = $2', [loss, p.user_id]);
                }
            }
        }
        
        if (chosen.effect === 'random_player') {
            const players = await executeQuery('SELECT user_id, pizzerias FROM players WHERE pizzerias > 0 AND banned = FALSE ORDER BY RANDOM() LIMIT 1');
            if (players.rows[0]) {
                const loss = Math.floor(players.rows[0].pizzerias * chosen.percent / 100);
                if (loss > 0) {
                    await executeQuery('UPDATE players SET pizzerias = GREATEST(0, pizzerias - $1) WHERE user_id = $2', [loss, players.rows[0].user_id]);
                    await updateIncome(players.rows[0].user_id);
                }
            }
        }
        
        if (chosen.effect === 'random_buff') {
            const players = await executeQuery('SELECT user_id FROM players WHERE banned = FALSE ORDER BY RANDOM() LIMIT 1');
            if (players.rows[0]) {
                await executeQuery('UPDATE players SET pizzerias = LEAST($1, pizzerias + 500) WHERE user_id = $2', [MAX_PIZZERIAS, players.rows[0].user_id]);
                await updateIncome(players.rows[0].user_id);
                try {
                    await vk.api.messages.send({
                        user_id: players.rows[0].user_id,
                        message: '🌟 Звездный час! Ты получил +500 пиццерий!',
                        random_id: Math.floor(Math.random() * 1e9)
                    });
                } catch (e) {}
            }
        }
        
        const allPlayers = await executeQuery('SELECT user_id FROM players WHERE banned = FALSE');
        for (const p of allPlayers.rows) {
            try {
                await vk.api.messages.send({
                    user_id: p.user_id,
                    message: `📢 ВНИМАНИЕ!\n${chosen.msg}`,
                    random_id: Math.floor(Math.random() * 1e9)
                });
            } catch (e) {}
            await new Promise(r => setTimeout(r, 2000));
        }
        
        console.log(`🐀 Нашествие: ${chosen.name}`);
    } catch (e) {
        console.error('❌ Ошибка ивента:', e.message);
    }
}

// ═══════════════════════════════════════════════════════════
// ОБРАБОТЧИК СООБЩЕНИЙ
// ═══════════════════════════════════════════════════════════
const vk = new VK({ token: TOKEN });

vk.updates.on('message_new', async (ctx) => {
    try {
        if (!isDbConnected) {
            try { await ctx.send('🔄 Бот перезапускается...'); } catch (e) {}
            return;
        }
        
        if (!ctx.text) return;
        const uid = ctx.senderId;
        if (uid < 0) return;
        
        const text = ctx.text.trim();
        const lower = text.toLowerCase();
        
        // Админ-команды (без КД)
        if (uid === ADMIN_ID && (text.startsWith('!') || text.startsWith('/рассылка'))) {
            return cmdAdmin(ctx, uid, text);
        }
        
        if (lower === 'старт') {
            await getOrCreate(uid);
            return ctx.send('🍕 Добро пожаловать в Pizza Tycoon!\n\n🏠 Купить пиццерии: купить 10\n📋 Все команды: хелп');
        }
        
        if (lower === 'хелп' || lower === 'помощь') return cmdHelp(ctx);
        if (lower === 'профиль') return cmdProfile(ctx, uid);
        if (lower === '/info') return cmdInfo(ctx, uid);
        
        if (lower.startsWith('купить печь')) {
            const num = parseInt(lower.replace('купить печь', '').trim());
            return cmdBuyOven(ctx, uid, num);
        }
        
        if (lower.startsWith('донат купить')) {
            const item = lower.replace('донат купить', '').trim();
            return cmdDonateBuy(ctx, uid, item);
        }
        
        if (lower.startsWith('купить')) {
            let count = parseInt(lower.replace('купить', '').trim());
            if (isNaN(count) || count <= 0) count = 10;
            return cmdBuy(ctx, uid, count);
        }
        
        if (lower === 'печи') return cmdOvens(ctx, uid);
        
        if (lower.startsWith('динамит')) {
            const tid = extractId(text);
            if (!tid) return ctx.send('❌ Укажите цель: динамит @user');
            return cmdDynamite(ctx, uid, tid);
        }
        
        if (lower.startsWith('крыса')) {
            const tid = extractId(text);
            if (!tid) return ctx.send('❌ Укажите цель: крыса @user');
            return cmdRat(ctx, uid, tid);
        }
        
        if (lower === 'щит') return cmdShield(ctx, uid);
        
        if (lower.startsWith('клан создать')) {
            const name = text.slice('клан создать'.length).trim();
            return cmdClanCreate(ctx, uid, name);
        }
        if (lower.startsWith('клан вступить')) {
            const name = text.slice('клан вступить'.length).trim();
            return cmdClanJoin(ctx, uid, name);
        }
        if (lower === 'клан выйти') return cmdClanLeave(ctx, uid);
        if (lower === 'клан список') return cmdClanList(ctx, uid);
        if (lower === 'клан') return cmdClanInfo(ctx, uid);
        
        if (lower === 'топ баланс') return cmdTopBalance(ctx);
        if (lower === 'топ кланов') return cmdTopClans(ctx);
        if (lower === 'топ') return cmdTop(ctx);
        
        if (lower === 'лотерея купить') return cmdLotteryBuy(ctx, uid);
        if (lower === 'лотерея') return cmdLotteryInfo(ctx);
        
        if (lower.startsWith('промокод')) {
            const code = text.slice('промокод'.length).trim().toUpperCase();
            return cmdPromo(ctx, uid, code);
        }
        
        if (lower === 'донат') return cmdDonate(ctx);
        
    } catch (e) {
        console.error('❌', e.message);
        try { await ctx.send('❌ Произошла ошибка. Попробуйте позже.'); } catch (ex) {}
    }
});

// ═══════════════════════════════════════════════════════════
// ЗАПУСК
// ═══════════════════════════════════════════════════════════
async function main() {
    createPool();
    
    const ok = await testConnection();
    if (ok) {
        await initTables();
    } else {
        console.log('⏳ Ожидание БД...');
        await reconnectDB();
    }
    
    vk.updates.startPolling().then(() => {
        console.log('🍕 Pizza Tycoon запущен!');
    }).catch(e => {
        console.error('❌ Ошибка поллинга:', e.message);
    });
    
    setInterval(() => {
        if (isDbConnected) hourlyIncome();
    }, 3600000);
    
    setTimeout(() => {
        setInterval(() => {
            if (isDbConnected) hourlyEvent();
        }, 3600000);
        if (isDbConnected) hourlyEvent();
    }, 30000);
    
    setInterval(async () => {
        if (!isDbConnected) return;
        try {
            const hourStart = getHourStart();
            await executeQuery('UPDATE players SET hourly_bought = 0 WHERE last_buy < $1', [hourStart]);
        } catch (e) {}
    }, 3600000);
}

main().catch(console.error);