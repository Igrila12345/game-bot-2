'use strict';

const { VK } = require('vk-io');
const { Pool } = require('pg');

// ═══════════════════════════════════════════════════════════
// КОНФИГУРАЦИЯ
// ═══════════════════════════════════════════════════════════
const TOKEN = 'vk1.a.O5zMm7ROJG0wMtp16kgWG1eIXPjufaOgwpNLZYJcXsqoQsnR7ArxLYupm-DNUEglSgCkx0OQeABxdaioag3QArykFaYc_ihmicZJ2FRzT8hJ8KHRHeIy-LZYrBPJrP18TqHdiFjsRLReGPLBGezMErsRxE4JPPjNX6gWd32tLFJkEfXa8hGe4srJDfycWQRF2pFzYdmEA2PZPdPhfcTLlQ';
const ADMIN_ID = 660964860;
const MAX_PIZZERIAS = 50000;
const MAX_LEVEL = 1000;

let eventsEnabled = true;

// ═══════════════════════════════════════════════════════════
// БАЗА ДАННЫХ
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
    isDbConnected = false;
    createPool();
    const ok = await testConnection();
    if (ok) {
        await initTables();
    } else if (reconnectAttempts < MAX_RECONNECT) {
        setTimeout(() => reconnectDB(), RECONNECT_DELAY);
    }
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
            console.error(`❌ Запрос (${attempt + 1}):`, e.message, '| SQL:', query.substring(0, 100), '| Params:', params);
            if (['57P01', '57P02', '57P03', '08006', '08001', 'ECONNREFUSED', 'ETIMEDOUT', '57P05'].includes(e.code)) {
                isDbConnected = false;
                await new Promise(r => setTimeout(r, RECONNECT_DELAY));
                if (attempt === 2) throw e;
                continue;
            }
            throw e;
        }
    }
}

async function initTables() {
    if (!isDbConnected) return;
    try {
        // Основная таблица игроков
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
                donate_balance BIGINT DEFAULT 0,
                info_enabled BOOLEAN DEFAULT TRUE,
                active_card_1 INT DEFAULT NULL,
                active_card_2 INT DEFAULT NULL,
                active_card_3 INT DEFAULT NULL,
                card_slots INT DEFAULT 1,
                daily_streak INT DEFAULT 0,
                last_daily_bonus BIGINT DEFAULT 0,
                daily_week_rewarded BOOLEAN DEFAULT FALSE
            )
        `);

        // Добавляем колонки если таблица уже существовала
        const newPlayerColumns = [
            ['active_card_1', 'INT DEFAULT NULL'],
            ['active_card_2', 'INT DEFAULT NULL'],
            ['active_card_3', 'INT DEFAULT NULL'],
            ['card_slots', 'INT DEFAULT 1'],
            ['daily_streak', 'INT DEFAULT 0'],
            ['last_daily_bonus', 'BIGINT DEFAULT 0'],
            ['daily_week_rewarded', 'BOOLEAN DEFAULT FALSE'],
        ];
        for (const [col, def] of newPlayerColumns) {
            try { await executeQuery(`ALTER TABLE players ADD COLUMN IF NOT EXISTS ${col} ${def}`); } catch (e) {}
        }

        // Таблица карточек
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS player_cards (
                user_id BIGINT,
                card_id INT,
                count INT DEFAULT 1,
                shiny BOOLEAN DEFAULT FALSE,
                obtained_at BIGINT DEFAULT 0,
                PRIMARY KEY (user_id, card_id, shiny)
            )
        `);

        // Таблица навыков
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS player_skills (
                user_id BIGINT PRIMARY KEY,
                buy_skill INT DEFAULT 0,
                dynamite_skill INT DEFAULT 0,
                rat_skill INT DEFAULT 0,
                skill_points INT DEFAULT 0,
                card_slot_2 BOOLEAN DEFAULT FALSE,
                card_slot_3 BOOLEAN DEFAULT FALSE,
                buy_limit_boost INT DEFAULT 0,
                dynamite_dmg_boost INT DEFAULT 0,
                rat_steal_boost INT DEFAULT 0
            )
        `);

        // Кланы
        await executeQuery(`
            CREATE TABLE IF NOT EXISTS clans (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                owner_id BIGINT NOT NULL,
                level INT DEFAULT 1,
                total_income INT DEFAULT 0
            )
        `);

        // Промокоды
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

        // Лотерея
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

        // Донат-магазин
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

        const shopCount = await executeQuery('SELECT COUNT(*) as cnt FROM donate_shop');
        if (parseInt(shopCount.rows[0].cnt) === 0) {
            const shopItems = [
                ['100K 🍕', 'balance_100k', 100, 'balance', 100000, 0],
                ['500K 🍕', 'balance_500k', 400, 'balance', 500000, 0],
                ['1M 🍕', 'balance_1m', 700, 'balance', 1000000, 0],
                ['+50 пиццерий', 'pizza_50', 200, 'pizza', 50, 0],
                ['+200 пиццерий', 'pizza_200', 700, 'pizza', 200, 0],
                ['+500 пиццерий', 'pizza_500', 1500, 'pizza', 500, 0],
                ['Золотая печь x3', 'oven3', 5000, 'oven3', 0, 0],
                ['Щит 24 часа', 'shield_24h', 200, 'shield', 0, 86400],
                ['VIP 30 дней', 'vip_30d', 500, 'vip', 0, 2592000],
                ['Отключение КД 7 дней', 'no_cd_7d', 200, 'no_cd', 0, 604800], // ИСПРАВЛЕНО: 7 дней за 200₿
            ];
            for (const item of shopItems) {
                await executeQuery(
                    `INSERT INTO donate_shop (item_name, item_key, price_rub, type, amount, duration) VALUES ($1,$2,$3,$4,$5,$6)`,
                    item
                );
            }
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

function getDayStart() {
    const now = getMskTime();
    now.setHours(0, 0, 0, 0);
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

function getProgressBar(current, max, length = 10) {
    const filled = Math.round((current / max) * length);
    const empty = length - filled;
    return '🟩'.repeat(filled) + '⬜'.repeat(empty) + ` ${current}/${max}`;
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
    await executeQuery(`INSERT INTO player_skills (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [uid]).catch(() => {});
    return getPlayer(uid);
}

function getOvenMultiplier(p) {
    if (p.oven3) return 3;
    if (p.oven2) return 2;
    if (p.oven1) return 1.5;
    return 1;
}

function getBaseBuyLimit(p) {
    let limit = 10;
    if (p.vip_until > getMskTimestamp()) limit = 50;
    if (isWeekend()) limit += 5;
    return limit;
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
        let skillPointsGained = 1;
        if (newLevel % 5 === 0) skillPointsGained += 2;
        if (newLevel % 10 === 0) skillPointsGained += 3;
        if (newLevel % 50 === 0) skillPointsGained += 10;

        await executeQuery(
            `INSERT INTO player_skills (user_id, skill_points) VALUES ($1, $2)
             ON CONFLICT (user_id) DO UPDATE SET skill_points = player_skills.skill_points + $2`,
            [uid, skillPointsGained]
        );

        try {
            await vk.api.messages.send({
                user_id: uid,
                message: `🎉 Уровень ${newLevel}! Поздравляем!\n⭐ +${skillPointsGained} очков навыков! (скилл)`,
                random_id: Math.floor(Math.random() * 1e9)
            });
        } catch (e) {}
    }
}

// ═══════════════════════════════════════════════════════════
// КОНФИГУРАЦИЯ КАРТОЧЕК
// ═══════════════════════════════════════════════════════════
const ALL_CARDS = {
    1:  { name: '🍕 Маргарита',        rarity: 'common',    chance: 7.5,  effect: 'income_cd', value: 1,  desc: 'Сокращает ожидание дохода на 1 минуту' },
    2:  { name: '🧀 Четыре сыра',      rarity: 'common',    chance: 7.5,  effect: 'income_cd', value: 1,  desc: 'Сокращает ожидание дохода на 1 минуту' },
    3:  { name: '🍖 Пепперони',        rarity: 'common',    chance: 7.5,  effect: 'income_cd', value: 1,  desc: 'Сокращает ожидание дохода на 1 минуту' },
    4:  { name: '🍍 Гавайская',        rarity: 'common',    chance: 7.5,  effect: 'income_cd', value: 1,  desc: 'Сокращает ожидание дохода на 1 минуту' },
    5:  { name: '🥩 Мясная',           rarity: 'common',    chance: 7.5,  effect: 'income_cd', value: 1,  desc: 'Сокращает ожидание дохода на 1 минуту' },
    6:  { name: '🍄 Грибная',          rarity: 'common',    chance: 7.5,  effect: 'income_cd', value: 1,  desc: 'Сокращает ожидание дохода на 1 минуту' },
    7:  { name: '🌿 Вегетарианская',   rarity: 'common',    chance: 7.5,  effect: 'income_cd', value: 1,  desc: 'Сокращает ожидание дохода на 1 минуту' },
    8:  { name: '🌶️ Диабло',          rarity: 'common',    chance: 7.5,  effect: 'income_cd', value: 1,  desc: 'Сокращает ожидание дохода на 1 минуту' },
    9:  { name: '🦐 С морепродуктами', rarity: 'rare',      chance: 3.5,  effect: 'income_cd', value: 3,  desc: 'Сокращает ожидание дохода на 3 минуты' },
    10: { name: '🥓 Карбонара',        rarity: 'rare',      chance: 3.5,  effect: 'income_cd', value: 3,  desc: 'Сокращает ожидание дохода на 3 минуты' },
    11: { name: '🍯 Медовая',          rarity: 'rare',      chance: 3.5,  effect: 'income_cd', value: 3,  desc: 'Сокращает ожидание дохода на 3 минуты' },
    12: { name: '🌮 Мексиканская',     rarity: 'rare',      chance: 3.5,  effect: 'income_cd', value: 3,  desc: 'Сокращает ожидание дохода на 3 минуты' },
    13: { name: '🍣 Японская',         rarity: 'rare',      chance: 3.5,  effect: 'income_cd', value: 3,  desc: 'Сокращает ожидание дохода на 3 минуты' },
    14: { name: '🥑 Здоровая',         rarity: 'rare',      chance: 3.5,  effect: 'income_cd', value: 3,  desc: 'Сокращает ожидание дохода на 3 минуты' },
    15: { name: '🍗 Барбекю',          rarity: 'rare',      chance: 3.5,  effect: 'income_cd', value: 3,  desc: 'Сокращает ожидание дохода на 3 минуты' },
    16: { name: '👑 Королевская',      rarity: 'epic',      chance: 2.0,  effect: 'income_cd', value: 5,  desc: 'Сокращает ожидание дохода на 5 минут' },
    17: { name: '💎 Трюфельная',       rarity: 'epic',      chance: 2.0,  effect: 'income_cd', value: 5,  desc: 'Сокращает ожидание дохода на 5 минут' },
    18: { name: '🌌 Космическая',      rarity: 'epic',      chance: 2.0,  effect: 'income_cd', value: 5,  desc: 'Сокращает ожидание дохода на 5 минут' },
    19: { name: '🦄 Единорожья',       rarity: 'epic',      chance: 2.0,  effect: 'income_cd', value: 5,  desc: 'Сокращает ожидание дохода на 5 минут' },
    20: { name: '🐉 Драконья',         rarity: 'epic',      chance: 2.0,  effect: 'income_cd', value: 5,  desc: 'Сокращает ожидание дохода на 5 минут' },
    21: { name: '🌟 Золотая пицца',    rarity: 'legendary', chance: 0.8,  effect: 'income_cd', value: 10, desc: 'Сокращает ожидание дохода на 10 минут' },
    22: { name: '💫 Платиновая',       rarity: 'legendary', chance: 0.8,  effect: 'income_cd', value: 10, desc: 'Сокращает ожидание дохода на 10 минут' },
    23: { name: '🔮 Магическая',       rarity: 'legendary', chance: 0.8,  effect: 'income_cd', value: 10, desc: 'Сокращает ожидание дохода на 10 минут' },
    24: { name: '⚡ Электрическая',    rarity: 'legendary', chance: 0.8,  effect: 'income_cd', value: 10, desc: 'Сокращает ожидание дохода на 10 минут' },
    25: { name: '🌠 Звёздная',         rarity: 'legendary', chance: 0.8,  effect: 'income_cd', value: 10, desc: 'Сокращает ожидание дохода на 10 минут' },
    26: { name: '🏆 Пицца-бог',        rarity: 'mythic',    chance: 0.2,  effect: 'income_cd', value: 20, desc: 'Сокращает ожидание дохода на 20 минут' },
    27: { name: '🌞 Солнечная',        rarity: 'mythic',    chance: 0.2,  effect: 'income_cd', value: 20, desc: 'Сокращает ожидание дохода на 20 минут' },
    28: { name: '🌑 Лунная',           rarity: 'mythic',    chance: 0.2,  effect: 'income_cd', value: 20, desc: 'Сокращает ожидание дохода на 20 минут' },
    29: { name: '🎭 Мистическая',      rarity: 'mythic',    chance: 0.2,  effect: 'income_cd', value: 20, desc: 'Сокращает ожидание дохода на 20 минут' },
    30: { name: '👁️ Всевидящая',       rarity: 'mythic',    chance: 0.2,  effect: 'income_cd', value: 20, desc: 'Сокращает ожидание дохода на 20 минут' },
};

const RARITY_COLORS = {
    'common': '⬜',
    'rare': '🟦',
    'epic': '🟪',
    'legendary': '🟨',
    'mythic': '🟥'
};

const SHINY_CHANCES = {
    'common': 0.02,
    'rare': 0.05,
    'epic': 0.10,
    'legendary': 0.20,
    'mythic': 0.35
};

// ═══════════════════════════════════════════════════════════
// КОНФИГУРАЦИЯ НАВЫКОВ
// ═══════════════════════════════════════════════════════════
const SKILL_TREE = {
    buy: {
        name: '📈 Бизнес-империя',
        desc: 'Увеличивает лимит покупки пиццерий',
        levels: [
            { cost: 1,  bonus: 1,  name: 'Малый склад',        desc: '+1 к лимиту покупки' },
            { cost: 2,  bonus: 2,  name: 'Средний склад',      desc: '+2 к лимиту (всего +3)' },
            { cost: 3,  bonus: 3,  name: 'Большой склад',      desc: '+3 к лимиту (всего +6)' },
            { cost: 5,  bonus: 5,  name: 'Сеть франшиз',       desc: '+5 к лимиту (всего +11)' },
            { cost: 8,  bonus: 8,  name: 'Пицца-корпорация',   desc: '+8 к лимиту (всего +19)' },
        ]
    },
    dynamite: {
        name: '💣 Подрывник',
        desc: 'Увеличивает урон от динамита',
        levels: [
            { cost: 1,  bonus: 5,   name: 'Петарды',           desc: '+5% к урону динамита' },
            { cost: 2,  bonus: 10,  name: 'Фейерверки',        desc: '+10% к урону (всего +15%)' },
            { cost: 3,  bonus: 15,  name: 'Тротил',            desc: '+15% к урону (всего +30%)' },
            { cost: 5,  bonus: 20,  name: 'Динамитные шашки',  desc: '+20% к урону (всего +50%)' },
            { cost: 8,  bonus: 25,  name: 'Ядерная бомба',     desc: '+25% к урону (всего +75%)' },
        ]
    },
    rat: {
        name: '🐀 Крысиный король',
        desc: 'Увеличивает процент кражи крысой',
        levels: [
            { cost: 1,  bonus: 1,   name: 'Мышь',              desc: '+1% к проценту кражи' },
            { cost: 2,  bonus: 2,   name: 'Крыса',             desc: '+2% к краже (всего +3%)' },
            { cost: 3,  bonus: 3,   name: 'Крысиная стая',     desc: '+3% к краже (всего +6%)' },
            { cost: 5,  bonus: 5,   name: 'Крысиный король',   desc: '+5% к краже (всего +11%)' },
            { cost: 8,  bonus: 7,   name: 'Чумная орда',       desc: '+7% к краже (всего +18%)' },
        ]
    },
    special: {
        name: '⭐ Особые',
        desc: 'Уникальные улучшения',
        levels: [
            { cost: 3,  bonus: 'card_slot_2', name: 'Коллекционер',    desc: 'Открывает 2-й слот для карт' },
            { cost: 7,  bonus: 'card_slot_3', name: 'Архивариус',      desc: 'Открывает 3-й слот для карт' },
        ]
    }
};

// ═══════════════════════════════════════════════════════════
// КОНФИГУРАЦИЯ ЕЖЕДНЕВНОГО БОНУСА
// ═══════════════════════════════════════════════════════════
const DAILY_REWARDS = {
    1: { type: 'coins', amount: 500,   msg: '🍕 500 монет' },
    2: { type: 'coins', amount: 1000,  msg: '🍕 1 000 монет' },
    3: { type: 'pizza', amount: 1,     msg: '🏠 1 пиццерия' },
    4: { type: 'coins', amount: 3000,  msg: '🍕 3 000 монет' },
    5: { type: 'shield', amount: 3600, msg: '🛡️ Щит на 1 час' },
    6: { type: 'pizza', amount: 5,     msg: '🏠 5 пиццерий' },
    7: { type: 'vip', amount: 10800,   msg: '💎 VIP на 3 часа! 🎉' },
};

// ═══════════════════════════════════════════════════════════
// КД И ЗАЩИТА ОТ СПАМА (ПОЛНОСТЬЮ ПЕРЕРАБОТАНО)
// ═══════════════════════════════════════════════════════════
const playerCooldowns = new Map();

// Единая функция проверки КД для всех команд
async function checkGlobalCooldown(uid) {
    const now = getMskTimestamp();
    
    // Проверяем в памяти
    const memoryCd = playerCooldowns.get(uid);
    if (memoryCd) {
        const elapsed = now - memoryCd;
        if (elapsed < 3) {
            return { allowed: false, remaining: 3 - elapsed };
        }
    }
    
    // Проверяем в БД (на случай перезапуска бота)
    const p = await getPlayer(uid);
    if (p && p.last_command) {
        const dbElapsed = now - p.last_command;
        if (dbElapsed < 3) {
            playerCooldowns.set(uid, p.last_command);
            return { allowed: false, remaining: 3 - dbElapsed };
        }
    }
    
    // Обновляем время последней команды
    playerCooldowns.set(uid, now);
    await executeQuery('UPDATE players SET last_command = $1 WHERE user_id = $2', [now, uid]).catch(() => {});
    
    return { allowed: true, remaining: 0 };
}

// Проверка отключения КД через донат
async function isCooldownDisabled(uid) {
    const now = getMskTimestamp();
    const p = await getPlayer(uid);
    return p && p.no_cd_until > now;
}

// Очистка устаревших КД из памяти
setInterval(() => {
    const now = getMskTimestamp();
    for (const [uid, time] of playerCooldowns) {
        if (now - time > 60) playerCooldowns.delete(uid);
    }
}, 30000);

// ═══════════════════════════════════════════════════════════
// МОДУЛЬ 1: КАРТОЧКИ (ИСПРАВЛЕНО)
// ═══════════════════════════════════════════════════════════

async function rollCard(uid, buyCount) {
    const cardChance = Math.min(0.15 * Math.floor(buyCount / 10), 0.90);
    if (Math.random() > cardChance) return null;

    const totalChance = Object.values(ALL_CARDS).reduce((sum, c) => sum + c.chance, 0);
    let roll = Math.random() * totalChance;
    let chosenCard = null;

    for (const [id, card] of Object.entries(ALL_CARDS)) {
        roll -= card.chance;
        if (roll <= 0) {
            chosenCard = { id: parseInt(id), ...card };
            break;
        }
    }

    if (!chosenCard) return null;

    const isShiny = Math.random() < SHINY_CHANCES[chosenCard.rarity];

    await executeQuery(
        `INSERT INTO player_cards (user_id, card_id, shiny, obtained_at) 
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, card_id, shiny) 
         DO UPDATE SET count = player_cards.count + 1`,
        [uid, chosenCard.id, isShiny, getMskTimestamp()]
    );

    return { ...chosenCard, shiny: isShiny };
}

async function getCardsBonus(uid) {
    const p = await getPlayer(uid);
    if (!p) return 0;

    let totalMinutes = 0;
    const activeSlots = [p.active_card_1, p.active_card_2, p.active_card_3].filter(Boolean);

    for (const cardId of activeSlots) {
        const owned = await executeQuery(
            'SELECT * FROM player_cards WHERE user_id = $1 AND card_id = $2',
            [uid, cardId]
        );

        if (owned.rows[0] && ALL_CARDS[cardId]) {
            let value = ALL_CARDS[cardId].value;
            if (owned.rows[0].shiny) value *= 2;
            totalMinutes += value;
        }
    }

    return totalMinutes;
}

async function cmdCardSet(ctx, uid, slot, cardId) {
    if (![1, 2, 3].includes(slot)) return ctx.send('❌ Слоты: 1, 2, 3');

    const p = await getOrCreate(uid);
    if (slot > p.card_slots) {
        return ctx.send(`❌ У вас только ${p.card_slots} слотов. Новые открываются за очки навыков!`);
    }

    const owned = await executeQuery(
        'SELECT * FROM player_cards WHERE user_id = $1 AND card_id = $2 AND count > 0',
        [uid, cardId]
    );

    if (!owned.rows[0]) return ctx.send('❌ У вас нет этой карты!');

    const slotColumn = `active_card_${slot}`;
    await executeQuery(`UPDATE players SET ${slotColumn} = $1 WHERE user_id = $2`, [cardId, uid]);

    const card = ALL_CARDS[cardId];
    const shiny = owned.rows[0].shiny ? '✨' : '';
    let effect = card.value;
    if (owned.rows[0].shiny) effect *= 2;

    return ctx.send(`✅ Слот ${slot}: ${shiny}${card.name} (сокращение дохода на ${effect} мин)`);
}

// Полностью переработана пагинация и отображение карт
async function cmdCards(ctx, uid, page = 1) {
    const p = await getOrCreate(uid);
    const cards = await executeQuery(
        'SELECT card_id, count, shiny FROM player_cards WHERE user_id = $1 ORDER BY card_id',
        [uid]
    );

    const totalCards = Object.keys(ALL_CARDS).length;
    const ownedCount = cards.rows.length;
    const bonus = await getCardsBonus(uid);

    // Правильный расчет страниц
    const perPage = 10;
    const totalPages = Math.ceil(totalCards / perPage);
    
    // Проверяем валидность страницы
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    let msg = [
        `🎴 КОЛЛЕКЦИЯ КАРТ @id${uid}`,
        `📊 Собрано: ${ownedCount}/${totalCards}`,
        `⚡ Бонус: -${bonus} мин к сбору дохода`,
        `🎰 Слотов: ${p.card_slots}/3`,
        ``,
        `📋 Активные карты:`,
    ];

    for (let i = 1; i <= 3; i++) {
        const slotColumn = `active_card_${i}`;
        const activeCardId = p[slotColumn];
        if (activeCardId && ALL_CARDS[activeCardId]) {
            const card = ALL_CARDS[activeCardId];
            const owned = cards.rows.find(c => c.card_id === activeCardId);
            const shiny = owned?.shiny ? '✨' : '';
            let effect = card.value;
            if (owned?.shiny) effect *= 2;
            msg.push(`  Слот ${i}: ${shiny}${card.name} (-${effect} мин)`);
        } else {
            msg.push(`  Слот ${i}: пусто`);
        }
    }

    msg.push(``);
    msg.push(`📦 Все карты (страница ${page}/${totalPages}):`);

    // Правильная пагинация
    const startIdx = (page - 1) * perPage;
    const endIdx = startIdx + perPage;
    const allCardsArr = Object.entries(ALL_CARDS).slice(startIdx, endIdx);

    for (const [id, card] of allCardsArr) {
        const owned = cards.rows.find(c => c.card_id === parseInt(id));
        const count = owned ? owned.count : 0;
        const shiny = owned?.shiny ? '✨' : '';
        const color = RARITY_COLORS[card.rarity];
        const status = count > 0 ? `✅ x${count}` : '❌';
        msg.push(`${color} #${id} ${shiny}${card.name} — ${card.desc} ${status}`);
    }

    // Правильная навигация по страницам
    if (totalPages > 1) {
        msg.push(``);
        if (page > 1) {
            msg.push(`⬅️ Предыдущая: карты ${page - 1}`);
        }
        if (page < totalPages) {
            msg.push(`➡️ Следующая: карты ${page + 1}`);
        }
    }

    msg.push(``);
    msg.push('💡 карты слот [1-3] [ID] — выбрать карту');
    msg.push('💡 карты шансы — вероятности выпадения');
    msg.push('💡 Как получить карты? Покупайте пиццерии! Шанс 15% за 10 шт');

    return ctx.send(msg.join('\n'));
}

async function cmdCardsChances(ctx) {
    const byRarity = {};
    for (const [id, card] of Object.entries(ALL_CARDS)) {
        if (!byRarity[card.rarity]) byRarity[card.rarity] = [];
        byRarity[card.rarity].push({ id, ...card });
    }

    const lines = ['🎲 ШАНСЫ ВЫПАДЕНИЯ КАРТ', ''];

    const rarityNames = {
        'common': '⬜ Обычные',
        'rare': '🟦 Редкие',
        'epic': '🟪 Эпические',
        'legendary': '🟨 Легендарные',
        'mythic': '🟥 Мифические'
    };

    for (const [rarity, cards] of Object.entries(byRarity)) {
        const totalChance = cards.reduce((s, c) => s + c.chance, 0);
        lines.push(`${rarityNames[rarity]} (суммарный шанс: ${totalChance}%)`);
        for (const card of cards) {
            lines.push(`  ${card.name} — ${card.chance}% (✨ сияющая: ${(SHINY_CHANCES[rarity] * 100).toFixed(0)}%)`);
        }
        lines.push('');
    }

    lines.push('💡 Карта выпадает с шансом 15% за каждые 10 купленных пиццерий');
    lines.push('💡 Сияющая версия даёт x2 к эффекту');

    return ctx.send(lines.join('\n'));
}

// ═══════════════════════════════════════════════════════════
// МОДУЛЬ 2: НАВЫКИ
// ═══════════════════════════════════════════════════════════

async function updatePassiveSkill(uid, skillType) {
    const skills = await executeQuery('SELECT * FROM player_skills WHERE user_id = $1', [uid]);
    const skillColumn = `${skillType}_skill`;
    const currentSkill = skills.rows[0]?.[skillColumn] || 0;
    const newSkill = currentSkill + 1;

    const bonus = Math.floor(newSkill / 10);
    const prevBonus = Math.floor(currentSkill / 10);

    await executeQuery(
        `UPDATE player_skills SET ${skillColumn} = $1 WHERE user_id = $2`,
        [newSkill, uid]
    );

    if (bonus > prevBonus) {
        const bonusDesc = {
            'buy': `+${bonus} к лимиту покупки`,
            'dynamite': `+${bonus * 5}% к урону динамита`,
            'rat': `+${(bonus * 0.5).toFixed(1)}% к проценту крысы`
        };

        try {
            await vk.api.messages.send({
                user_id: uid,
                message: `⭐ Пассивный навык повышен!\n📊 Использований: ${newSkill}\n📈 Бонус: ${bonusDesc[skillType]}\n\n💡 Каждые 10 использований — новый уровень бонуса!`,
                random_id: Math.floor(Math.random() * 1e9)
            });
        } catch (e) {}
    }

    return { skillLevel: newSkill, bonus };
}

async function getSkillBonuses(uid) {
    const skills = await executeQuery('SELECT * FROM player_skills WHERE user_id = $1', [uid]);
    if (!skills.rows[0]) return { buyLimit: 0, dynamiteDmg: 0, ratSteal: 0, cardSlots: 1, skillPoints: 0 };

    const s = skills.rows[0];

    const passiveBuy = Math.floor(s.buy_skill / 10);
    const passiveDynamite = Math.floor(s.dynamite_skill / 10) * 5;
    const passiveRat = Math.floor(s.rat_skill / 10) * 0.5;

    const activeBuy = s.buy_limit_boost || 0;
    const activeDynamite = s.dynamite_dmg_boost || 0;
    const activeRat = s.rat_steal_boost || 0;

    let cardSlots = 1;
    if (s.card_slot_2) cardSlots++;
    if (s.card_slot_3) cardSlots++;

    return {
        buyLimit: passiveBuy + activeBuy,
        dynamiteDmg: passiveDynamite + activeDynamite,
        ratSteal: passiveRat + activeRat,
        cardSlots,
        skillPoints: s.skill_points || 0
    };
}

async function cmdSkillBuy(ctx, uid, skillTree, level) {
    await getOrCreate(uid);
    const skills = await executeQuery('SELECT * FROM player_skills WHERE user_id = $1', [uid]);
    const s = skills.rows[0] || { skill_points: 0 };

    if (!SKILL_TREE[skillTree]) {
        return ctx.send('❌ Ветки: buy, dynamite, rat, special\nПример: скилл купить buy 1');
    }

    const tree = SKILL_TREE[skillTree];
    const levelIdx = level - 1;

    if (levelIdx < 0 || levelIdx >= tree.levels.length) {
        return ctx.send(`❌ Уровни: 1-${tree.levels.length}`);
    }

    const upgrade = tree.levels[levelIdx];

    if (s.skill_points < upgrade.cost) {
        return ctx.send(`❌ Нужно ${upgrade.cost} очков навыков. У вас: ${s.skill_points}`);
    }

    let updateQuery = 'UPDATE player_skills SET skill_points = skill_points - $1';
    const params = [upgrade.cost, uid];

    switch (skillTree) {
        case 'buy':
            updateQuery += ', buy_limit_boost = COALESCE(buy_limit_boost, 0) + $3';
            params.push(upgrade.bonus);
            break;
        case 'dynamite':
            updateQuery += ', dynamite_dmg_boost = COALESCE(dynamite_dmg_boost, 0) + $3';
            params.push(upgrade.bonus);
            break;
        case 'rat':
            updateQuery += ', rat_steal_boost = COALESCE(rat_steal_boost, 0) + $3';
            params.push(upgrade.bonus);
            break;
        case 'special':
            if (upgrade.bonus === 'card_slot_2') {
                updateQuery += ', card_slot_2 = TRUE';
            } else if (upgrade.bonus === 'card_slot_3') {
                updateQuery += ', card_slot_3 = TRUE';
            }
            break;
    }

    updateQuery += ' WHERE user_id = $2';
    await executeQuery(updateQuery, params);

    if (upgrade.bonus === 'card_slot_2') {
        await executeQuery('UPDATE players SET card_slots = 2 WHERE user_id = $1', [uid]);
    } else if (upgrade.bonus === 'card_slot_3') {
        await executeQuery('UPDATE players SET card_slots = 3 WHERE user_id = $1', [uid]);
    }

    return ctx.send(`✅ Куплено: ${upgrade.name}!\n📝 ${upgrade.desc}\n💰 Осталось очков: ${s.skill_points - upgrade.cost}`);
}

async function cmdSkills(ctx, uid) {
    await getOrCreate(uid);
    const skills = await executeQuery('SELECT * FROM player_skills WHERE user_id = $1', [uid]);
    const s = skills.rows[0] || { skill_points: 0, buy_skill: 0, dynamite_skill: 0, rat_skill: 0 };
    const bonuses = await getSkillBonuses(uid);

    let msg = [
        `⭐ НАВЫКИ @id${uid}`,
        `💰 Очков навыков: ${bonuses.skillPoints}`,
        ``,
        `📊 ПАССИВНЫЕ НАВЫКИ (растут от использования):`,
        `📈 Покупки: ${s.buy_skill} раз → +${Math.floor(s.buy_skill / 10)} к лимиту`,
        `💣 Динамит: ${s.dynamite_skill} раз → +${Math.floor(s.dynamite_skill / 10) * 5}% к урону`,
        `🐀 Крыса: ${s.rat_skill} раз → +${(Math.floor(s.rat_skill / 10) * 0.5).toFixed(1)}% к краже`,
        ``,
        `🎯 АКТИВНЫЕ БОНУСЫ:`,
        `📈 Лимит: +${bonuses.buyLimit}`,
        `💣 Урон динамита: +${bonuses.dynamiteDmg}%`,
        `🐀 Кража крысы: +${bonuses.ratSteal}%`,
        `🎴 Слотов карт: ${bonuses.cardSlots}/3`,
        ``,
        `🌳 ДЕРЕВО НАВЫКОВ:`,
        ``,
    ];

    for (const [key, tree] of Object.entries(SKILL_TREE)) {
        msg.push(`${tree.name} — ${tree.desc}`);
        for (let i = 0; i < tree.levels.length; i++) {
            const lvl = tree.levels[i];
            msg.push(`  ⬜ Ур.${i + 1}: ${lvl.name} (${lvl.cost} очков) — ${lvl.desc}`);
        }
        msg.push('');
    }

    msg.push('💡 скилл купить [ветка] [уровень] — изучить навык');
    msg.push('💡 Очки навыков даются за повышение уровня игрока');

    return ctx.send(msg.join('\n'));
}

// ═══════════════════════════════════════════════════════════
// МОДУЛЬ 3: ЕЖЕДНЕВНЫЙ БОНУС (ИСПРАВЛЕНО)
// ═══════════════════════════════════════════════════════════

async function cmdDailyBonus(ctx, uid) {
    const now = getMskTimestamp();
    const todayStart = getDayStart();
    
    // Атомарная проверка и обновление через UPDATE с RETURNING
    const result = await executeQuery(`
        UPDATE players 
        SET last_daily_bonus = CASE 
            WHEN last_daily_bonus < $2 OR last_daily_bonus IS NULL THEN $1 
            ELSE last_daily_bonus 
        END
        WHERE user_id = $3 AND (last_daily_bonus < $2 OR last_daily_bonus IS NULL)
        RETURNING *
    `, [now, todayStart, uid]);
    
    if (!result.rows[0]) {
        const p = await getOrCreate(uid);
        if (p.last_daily_bonus >= todayStart) {
            const nextReset = todayStart + 86400;
            const timeLeft = fmtTime(nextReset - now);
            return ctx.send(`⏱ Вы уже получили бонус сегодня!\n🔄 Следующий через: ${timeLeft}`);
        }
        return ctx.send('❌ Ошибка получения бонуса.');
    }
    
    const p = result.rows[0];
    
    // Расчет стрика
    let streak = p.daily_streak || 0;
    const yesterdayStart = todayStart - 86400;
    
    if (p.last_daily_bonus >= yesterdayStart && p.last_daily_bonus < todayStart) {
        streak = (streak % 7) + 1;
    } else {
        streak = 1;
        await executeQuery('UPDATE players SET daily_week_rewarded = FALSE WHERE user_id = $1', [uid]);
    }
    
    if (streak === 7 && p.daily_week_rewarded) {
        streak = 1;
        await executeQuery('UPDATE players SET daily_week_rewarded = FALSE WHERE user_id = $1', [uid]);
    }
    
    const reward = DAILY_REWARDS[streak];
    
    // Выдаём награду
    switch (reward.type) {
        case 'coins':
            await executeQuery(
                'UPDATE players SET balance = balance + $1, daily_streak = $2 WHERE user_id = $3',
                [reward.amount, streak, uid]
            );
            break;
        case 'pizza':
            await executeQuery(
                'UPDATE players SET pizzerias = LEAST($1, pizzerias + $2), daily_streak = $3 WHERE user_id = $4',
                [MAX_PIZZERIAS, reward.amount, streak, uid]
            );
            await updateIncome(uid);
            break;
        case 'shield': {
            const currentShield = p.shield_until > now ? p.shield_until : now;
            const newShieldEnd = currentShield + reward.amount;
            await executeQuery(
                'UPDATE players SET shield_until = $1, daily_streak = $2 WHERE user_id = $3',
                [newShieldEnd, streak, uid]
            );
            break;
        }
        case 'vip': {
            const currentVip = p.vip_until > now ? p.vip_until : now;
            const newVipEnd = currentVip + reward.amount;
            await executeQuery(
                'UPDATE players SET vip_until = $1, daily_streak = $2, daily_week_rewarded = TRUE WHERE user_id = $3',
                [newVipEnd, streak, uid]
            );
            break;
        }
    }
    
    const progressBar = getProgressBar(streak, 7);
    
    let msg = [
        `🎁 ЕЖЕДНЕВНЫЙ БОНУС — День ${streak}/7`,
        `💰 Награда: ${reward.msg}`,
        ``,
        `📊 Прогресс: ${progressBar}`,
        ``,
        `📅 Следующие награды:`,
    ];
    
    for (let i = streak + 1; i <= 7; i++) {
        const marker = i === 7 ? '👑' : '  ';
        msg.push(`${marker} День ${i}: ${DAILY_REWARDS[i].msg}`);
    }
    
    msg.push('');
    msg.push('💡 Заходи каждый день! Пропуск сбрасывает прогресс.');
    msg.push('💡 На 7-й день: VIP на 3 часа');
    
    await ctx.send(msg.join('\n'));
    
    if (streak === 7) {
        await new Promise(r => setTimeout(r, 1000));
        await ctx.send([
            '🎉🎉🎉 ПОЗДРАВЛЯЕМ! 🎉🎉🎉',
            '',
            '👑 Вы достигли 7-го дня стрика!',
            `💎 Получен VIP на 3 часа!`,
            '',
            '💡 VIP даёт:',
            '• Лимит покупки 50/час',
            '• Просмотр чужих профилей (/info @user)',
            '• +25% к урону динамита',
            '• +20% к краже крысы',
            '',
            '🔥 Новый цикл начнётся завтра!'
        ].join('\n'));
    }
}

// ═══════════════════════════════════════════════════════════
// ОСНОВНЫЕ КОМАНДЫ (УБРАНЫ ЛОКАЛЬНЫЕ ПРОВЕРКИ КД)
// ═══════════════════════════════════════════════════════════

async function cmdBuy(ctx, uid, count) {
    const p = await getOrCreate(uid);
    if (p.banned) return ctx.send('⛔ Вы забанены.');

    const now = getMskTimestamp();
    const hourStart = getHourStart();
    const bonuses = await getSkillBonuses(uid);
    const limit = getBaseBuyLimit(p) + bonuses.buyLimit;
    const price = getPizzaPrice();

    let bought = p.hourly_bought;
    if (p.last_buy < hourStart) bought = 0;

    count = Math.min(count, limit - bought);
    if (count <= 0) return ctx.send(`❌ Лимит исчерпан. Доступно: ${limit - bought}/${limit}`);

    const cost = count * price;

    const result = await executeQuery(`
        UPDATE players 
        SET balance = balance - $1,
            pizzerias = pizzerias + $2,
            last_buy = $3,
            hourly_bought = hourly_bought + $2,
            total_pizzerias = total_pizzerias + $2
        WHERE user_id = $4 
          AND balance >= $1 
          AND pizzerias + $2 <= $5
        RETURNING balance, pizzerias
    `, [cost, count, now, uid, MAX_PIZZERIAS]);

    if (!result.rows[0]) {
        return ctx.send(`❌ Недостаточно средств (нужно ${cost} 🍕) или превышен лимит ${MAX_PIZZERIAS} пиццерий.`);
    }

    const finalBalance = result.rows[0].balance;
    const finalPizzerias = result.rows[0].pizzerias;

    await updateIncome(uid);
    await addXp(uid, count * 10);

    const skillResult = await updatePassiveSkill(uid, 'buy');
    const cardResult = await rollCard(uid, count);

    const mult = getOvenMultiplier(p);
    const clanBonus = getClanBonus(p);
    const income = Math.floor(finalPizzerias * 200 * mult * (1 + clanBonus));

    const wMsg = isWeekend() ? '🎉 ВЫХОДНЫЕ! Цена -50%!' : '';
    let response = [
        wMsg,
        `🏠 Куплено ${count} пиццерий за ${cost} 🍕`,
        `📊 Всего: ${finalPizzerias} шт`,
        `📈 Доход: ${income} 🍕/час`,
        `💰 Баланс: ${finalBalance} 🍕`,
        `⏱ Лимит: ${bought + count}/${limit}`
    ].filter(Boolean);

    if (cardResult) {
        const shiny = cardResult.shiny ? '✨' : '';
        response.push(`🎴 Новая карта: ${shiny}${cardResult.name}!`);
    }

    await ctx.send(response.join('\n'));
}

async function cmdDynamite(ctx, uid, targetId) {
    const p = await getOrCreate(uid);
    if (p.banned) return ctx.send('⛔ Вы забанены.');

    const now = getMskTimestamp();

    if (now - p.last_dynamite < 7200) {
        return ctx.send(`⏱ Динамит через ${fmtTime(7200 - (now - p.last_dynamite))}`);
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

    const bonuses = await getSkillBonuses(uid);
    if (bonuses.dynamiteDmg > 0) {
        damage = Math.floor(damage * (1 + bonuses.dynamiteDmg / 100));
    }

    damage = Math.min(damage, target.pizzerias);

    const attackerResult = await executeQuery(
        'UPDATE players SET balance = balance - 10000, last_dynamite = $1 WHERE user_id = $2 AND balance >= 10000 RETURNING balance',
        [now, uid]
    );

    if (!attackerResult.rows[0]) {
        return ctx.send('❌ Недостаточно средств (баланс изменился).');
    }

    await executeQuery('UPDATE players SET pizzerias = GREATEST(0, pizzerias - $1) WHERE user_id = $2', [damage, targetId]);

    if (reflect > 0) {
        await executeQuery('UPDATE players SET pizzerias = GREATEST(0, pizzerias - $1) WHERE user_id = $2', [reflect, uid]);
    }

    await updateIncome(uid);
    await updateIncome(targetId);
    await addXp(uid, 50);
    await updatePassiveSkill(uid, 'dynamite');

    const attackerBalance = attackerResult.rows[0].balance;

    let msg = `🧨 Динамит у @id${targetId}!\n💥 -${damage} пиццерий`;
    if (reflect > 0) msg += `\n🛡️ Отражение: -${reflect} у тебя`;
    msg += `\n🍕 Баланс: ${attackerBalance} 🍕`;

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
    const p = await getOrCreate(uid);
    if (p.banned) return ctx.send('⛔ Вы забанены.');

    const now = getMskTimestamp();

    if (now - p.last_rat < 10800) {
        return ctx.send(`⏱ Крыса через ${fmtTime(10800 - (now - p.last_rat))}`);
    }
    if (p.balance < 5000) return ctx.send('❌ Нужно 5 000 🍕');

    const target = await getPlayer(targetId);
    if (!target) return ctx.send('❌ Игрок не найден.');
    if (target.banned) return ctx.send('❌ Игрок забанен.');
    if (target.balance <= 0) return ctx.send('❌ У игрока пустой баланс.');

    if (Math.random() < 0.1) {
        const failResult = await executeQuery(
            'UPDATE players SET balance = balance - 5000, last_rat = $1 WHERE user_id = $2 AND balance >= 5000 RETURNING balance',
            [now, uid]
        );
        if (!failResult.rows[0]) return ctx.send('❌ Недостаточно средств (баланс изменился).');
        return ctx.send('❌ Крыса попалась!\n💸 Штраф: -5 000 🍕');
    }

    const attackerResult = await executeQuery(
        'UPDATE players SET balance = balance - 5000, last_rat = $1 WHERE user_id = $2 AND balance >= 5000 RETURNING balance',
        [now, uid]
    );
    if (!attackerResult.rows[0]) return ctx.send('❌ Недостаточно средств (баланс изменился).');

    let percent = Math.floor(Math.random() * 11) + 5;
    const bonuses = await getSkillBonuses(uid);
    if (bonuses.ratSteal > 0) percent += bonuses.ratSteal;

    let stolen = Math.floor(target.balance * percent / 100);
    if (target.shield_until > now) stolen = Math.floor(stolen / 2);
    if (target.clan_id) stolen = Math.floor(stolen * 0.85);
    if (p.vip_until > now) stolen = Math.floor(stolen * 1.2);
    stolen = Math.min(stolen, target.balance);

    if (stolen > 0) {
        await executeQuery('UPDATE players SET balance = balance - $1 WHERE user_id = $2', [stolen, targetId]);
        await executeQuery('UPDATE players SET balance = balance + $1 WHERE user_id = $2', [stolen, uid]);
    }

    await addXp(uid, 30);
    await updatePassiveSkill(uid, 'rat');

    const finalBalance = attackerResult.rows[0].balance + stolen;
    let msg = `🐀 Крыса у @id${targetId}!\n💰 +${stolen} 🍕 (${percent}%)`;
    msg += `\n🍕 Баланс: ${finalBalance} 🍕`;
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
    const p = await getOrCreate(uid);
    if (p.banned) return ctx.send('⛔ Вы забанены.');
    if (p.balance < 25000) return ctx.send('❌ Нужно 25 000 🍕');
    const now = getMskTimestamp();
    const newShield = p.shield_until > now ? p.shield_until + 3600 : now + 3600;
    const result = await executeQuery(
        'UPDATE players SET balance = balance - 25000, shield_until = $1 WHERE user_id = $2 AND balance >= 25000 RETURNING balance',
        [newShield, uid]
    );
    if (!result.rows[0]) return ctx.send('❌ Недостаточно средств.');
    await ctx.send(`🛡️ Щит активирован!\n⏱ До: ${new Date(newShield * 1000).toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow' })} МСК`);
}

async function cmdOvens(ctx, uid) {
    const p = await getOrCreate(uid);
    const s = (own) => own ? '✅' : '❌';
    await ctx.send(`👑 ПЕЧИ\n\n⭐ Премиум x1.5 — 200 000 🍕 ${s(p.oven1)}\n🔥 Мега x2 — 500 000 🍕 ${s(p.oven2)}\n👑 Золотая x3 — 5 000 ₿ ${s(p.oven3)}\n\nКупить: купить печь 1 / купить печь 2\nДонат: донат купить печь3`);
}

async function cmdBuyOven(ctx, uid, num) {
    const p = await getOrCreate(uid);
    if (p.banned) return ctx.send('⛔ Вы забанены.');
    if (num === 1) {
        if (p.oven1) return ctx.send('❌ Уже куплена.');
        if (p.balance < 200000) return ctx.send('❌ Нужно 200 000 🍕');
        const result = await executeQuery('UPDATE players SET balance = balance - 200000, oven1 = TRUE WHERE user_id = $1 AND balance >= 200000 RETURNING user_id', [uid]);
        if (!result.rows[0]) return ctx.send('❌ Недостаточно средств.');
        await updateIncome(uid);
        return ctx.send('✅ Премиум-печь x1.5!');
    }
    if (num === 2) {
        if (p.oven2) return ctx.send('❌ Уже куплена.');
        if (p.balance < 500000) return ctx.send('❌ Нужно 500 000 🍕');
        const result = await executeQuery('UPDATE players SET balance = balance - 500000, oven2 = TRUE WHERE user_id = $1 AND balance >= 500000 RETURNING user_id', [uid]);
        if (!result.rows[0]) return ctx.send('❌ Недостаточно средств.');
        await updateIncome(uid);
        return ctx.send('✅ Мега-печь x2!');
    }
    return ctx.send('❌ купить печь 1 или купить печь 2');
}

async function cmdProfile(ctx, uid) {
    const p = await getPlayer(uid);
    if (!p) return ctx.send('❌ Напишите "старт" для регистрации.');
    const now = getMskTimestamp();
    const bonuses = await getSkillBonuses(uid);
    const limit = getBaseBuyLimit(p) + bonuses.buyLimit;
    const hourStart = getHourStart();
    let bought = p.hourly_bought;
    if (p.last_buy < hourStart) bought = 0;
    const xpNeed = xpForLevel(p.level);
    const xpRemain = xpNeed - p.xp;
    const shield = p.shield_until > now ? `активен (${fmtTime(p.shield_until - now)})` : 'нет';
    const vip = p.vip_until > now ? `активен (${Math.ceil((p.vip_until - now) / 86400)} дн)` : 'нет';
    const noCd = p.no_cd_until > now ? `активен (${fmtTime(p.no_cd_until - now)})` : 'нет';
    const cardsBonus = await getCardsBonus(uid);
    let clanName = 'Нет';
    if (p.clan_id) {
        const c = await executeQuery('SELECT name FROM clans WHERE id = $1', [p.clan_id]);
        if (c.rows[0]) clanName = c.rows[0].name;
    }
    await ctx.send([
        `👤 Профиль @id${uid}`, ``,
        `📊 Уровень: ${p.level} (${xpRemain} XP до ${p.level + 1} ур)`,
        `🍕 Баланс: ${p.balance.toLocaleString()} 🍕`,
        `🏠 Пиццерий: ${p.pizzerias.toLocaleString()} шт`,
        `📈 Доход: ${p.income.toLocaleString()} 🍕/час`,
        `🛡️ Щит: ${shield}`,
        `💎 VIP: ${vip}`,
        `⚡ Отключение КД: ${noCd}`,
        `🎴 Бонус карт: -${cardsBonus} мин`,
        `🏠 Клан: ${clanName}`,
        `⏱ Лимит: ${bought}/${limit}`
    ].join('\n'));
}

async function cmdInfo(ctx, uid, text) {
    const p = await getOrCreate(uid);
    if (p.banned) return ctx.send('⛔ Вы забанены.');
    const parts = text.trim().split(/\s+/);
    const subCmd = parts[1]?.toLowerCase();
    if (subCmd === 'удалить') {
        if (p.info_enabled === false && p.hidden === true) return ctx.send('❌ Доступ уже удалён.');
        await executeQuery('UPDATE players SET info_enabled = FALSE, hidden = TRUE WHERE user_id = $1', [uid]);
        return ctx.send('🔒 Доступ удалён навсегда.');
    }
    if (p.info_enabled === false && p.hidden === true) return ctx.send('🔒 Доступ удалён навсегда.');
    if (subCmd === 'включить' || subCmd === 'показать' || subCmd === 'on') {
        await executeQuery('UPDATE players SET info_enabled = TRUE, hidden = FALSE WHERE user_id = $1', [uid]);
        return ctx.send('🔓 Профиль открыт!');
    }
    if (subCmd === 'отключить' || subCmd === 'выключить' || subCmd === 'скрыть' || subCmd === 'off') {
        await executeQuery('UPDATE players SET info_enabled = FALSE, hidden = TRUE WHERE user_id = $1', [uid]);
        return ctx.send('🔒 Профиль скрыт!');
    }
    const targetId = extractId(text);
    if (targetId) {
        const now = getMskTimestamp();
        if (p.vip_until <= now) return ctx.send('❌ Только для VIP.');
        const target = await getPlayer(targetId);
        if (!target) return ctx.send('❌ Игрок не найден.');
        if (target.banned) return ctx.send('❌ Игрок забанен.');
        if (!target.info_enabled) return ctx.send('🔒 Игрок скрыл профиль.');
        const xpNeed = xpForLevel(target.level);
        const xpRemain = xpNeed - target.xp;
        let clanName = 'Нет';
        if (target.clan_id) {
            const c = await executeQuery('SELECT name FROM clans WHERE id = $1', [target.clan_id]);
            if (c.rows[0]) clanName = c.rows[0].name;
        }
        return ctx.send([
            `👤 Профиль @id${targetId}`, ``,
            `📊 Уровень: ${target.level} (${xpRemain} XP)`,
            `🏠 Пиццерий: ${target.pizzerias.toLocaleString()} шт`,
            `📈 Доход: ${target.income.toLocaleString()} 🍕/час`,
            `🛡️ Щит: ${target.shield_until > now ? 'активен' : 'нет'}`,
            `💎 VIP: ${target.vip_until > now ? 'активен' : 'нет'}`,
            `🏠 Клан: ${clanName}`
        ].join('\n'));
    }
    return ctx.send(`🔗 Профиль: @id${uid} (vk.com/id${uid})\n🔒 Статус: ${p.info_enabled ? 'открыт' : 'скрыт'}\n\n📋 /info включить/отключить/удалить\n📋 /info @user — чужой профиль (VIP)`);
}

// ═══════════════════════════════════════════════════════════
// КЛАНЫ
// ═══════════════════════════════════════════════════════════

async function cmdClanCreate(ctx, uid, name) {
    const p = await getOrCreate(uid);
    if (p.banned) return ctx.send('⛔ Вы забанены.');
    if (p.clan_id) return ctx.send('❌ Вы уже в клане.');
    if (!name || name.length < 2) return ctx.send('❌ клан создать [имя]');
    try {
        const r = await executeQuery('INSERT INTO clans (name, owner_id, level, total_income) VALUES ($1, $2, 1, 0) RETURNING id', [name, uid]);
        await executeQuery('UPDATE players SET clan_id = $1, clan_role = $2 WHERE user_id = $3', [r.rows[0].id, 'leader', uid]);
        await updateIncome(uid);
        await ctx.send(`✅ Клан «${name}» создан!\nПриглашайте: клан вступить ${name}`);
    } catch (e) {
        if (e.code === '23505') return ctx.send('❌ Имя занято.');
        return ctx.send('❌ Ошибка создания клана.');
    }
}

async function cmdClanJoin(ctx, uid, name) {
    const p = await getOrCreate(uid);
    if (p.banned) return ctx.send('⛔ Вы забанены.');
    if (p.clan_id) return ctx.send('❌ Вы уже в клане.');
    const c = await executeQuery('SELECT id, owner_id FROM clans WHERE name = $1', [name]);
    if (!c.rows[0]) return ctx.send('❌ Клан не найден.');
    if (c.rows[0].owner_id === uid) {
        await executeQuery('UPDATE players SET clan_id = $1, clan_role = $2 WHERE user_id = $3', [c.rows[0].id, 'leader', uid]);
        await updateIncome(uid);
        return ctx.send(`✅ Вы вернулись в свой клан «${name}» как лидер!`);
    }
    await executeQuery('UPDATE players SET clan_id = $1, clan_role = $2 WHERE user_id = $3', [c.rows[0].id, 'member', uid]);
    await updateIncome(uid);
    await ctx.send(`✅ Вы вступили в «${name}»!`);
}

async function cmdClanLeave(ctx, uid) {
    const p = await getPlayer(uid);
    if (!p || !p.clan_id) return ctx.send('❌ Вы не в клане.');
    const wasLeader = p.clan_role === 'leader';
    await executeQuery('UPDATE players SET clan_id = NULL, clan_role = $1 WHERE user_id = $2', ['member', uid]);
    await updateIncome(uid);
    if (wasLeader) {
        await ctx.send('✅ Вы вышли из клана.\n⚠️ Клан остался за вами. Чтобы удалить: клан удалить');
    } else {
        await ctx.send('✅ Вы вышли из клана.');
    }
}

async function cmdClanDelete(ctx, uid) {
    const p = await getPlayer(uid);
    if (!p || !p.clan_id) return ctx.send('❌ Вы не в клане.');
    const clan = await executeQuery('SELECT * FROM clans WHERE id = $1', [p.clan_id]);
    if (!clan.rows[0]) {
        await executeQuery('UPDATE players SET clan_id = NULL, clan_role = $1 WHERE user_id = $2', ['member', uid]);
        await updateIncome(uid);
        return ctx.send('❌ Клан не найден.');
    }
    if (clan.rows[0].owner_id !== uid) return ctx.send('❌ Только создатель клана может его удалить.');
    const clanName = clan.rows[0].name;
    await executeQuery('UPDATE players SET clan_id = NULL, clan_role = $1 WHERE clan_id = $2', ['member', p.clan_id]);
    await executeQuery('DELETE FROM clans WHERE id = $1', [p.clan_id]);
    await updateIncome(uid);
    await ctx.send(`🗑️ Клан «${clanName}» удалён.`);
}

async function cmdClanInfo(ctx, uid) {
    const p = await getPlayer(uid);
    if (!p || !p.clan_id) return ctx.send('❌ Вы не в клане.');
    const c = await executeQuery('SELECT * FROM clans WHERE id = $1', [p.clan_id]);
    if (!c.rows[0]) {
        await executeQuery('UPDATE players SET clan_id = NULL, clan_role = $1 WHERE user_id = $2', ['member', uid]);
        await updateIncome(uid);
        return ctx.send('❌ Клан удалён.');
    }
    const count = await executeQuery('SELECT COUNT(*) as cnt FROM players WHERE clan_id = $1', [p.clan_id]);
    const income = await executeQuery('SELECT SUM(income) as t FROM players WHERE clan_id = $1', [p.clan_id]);
    const isOwner = c.rows[0].owner_id === uid;
    await ctx.send([
        `🏠 Клан «${c.rows[0].name}»`,
        `👑 Создатель: @id${c.rows[0].owner_id}${isOwner ? ' (ваш)' : ''}`,
        `👥 Участников: ${count.rows[0].cnt}`,
        `📈 Доход: ${(income.rows[0].t || 0).toLocaleString()} 🍕/час`,
        `⭐ Уровень: ${c.rows[0].level}`,
        '',
        isOwner ? '💡 Команды: клан список, клан выйти, клан удалить' : '💡 Команды: клан, клан выйти'
    ].join('\n'));
}

async function cmdClanList(ctx, uid) {
    const p = await getPlayer(uid);
    if (!p || !p.clan_id) return ctx.send('❌ Вы не в клане.');
    const clan = await executeQuery('SELECT owner_id FROM clans WHERE id = $1', [p.clan_id]);
    if (!clan.rows[0] || clan.rows[0].owner_id !== uid) return ctx.send('❌ Только создатель клана может смотреть список.');
    const members = await executeQuery('SELECT user_id, clan_role, level, pizzerias FROM players WHERE clan_id = $1 ORDER BY pizzerias DESC', [p.clan_id]);
    const lines = ['👥 Участники:', ''];
    for (const m of members.rows) {
        const role = m.user_id === clan.rows[0].owner_id ? '👑' : '👤';
        lines.push(`${role} @id${m.user_id} — ур.${m.level} | ${m.pizzerias} шт`);
    }
    await ctx.send(lines.join('\n'));
}

// ═══════════════════════════════════════════════════════════
// ТОПЫ, ЛОТЕРЕЯ, ПРОМО, ДОНАТ
// ═══════════════════════════════════════════════════════════

async function cmdTop(ctx) {
    const r = await executeQuery('SELECT user_id, pizzerias, income FROM players WHERE banned = FALSE AND info_enabled = TRUE ORDER BY pizzerias DESC LIMIT 10');
    if (!r.rows.length) return ctx.send('📊 Рейтинг пока пуст.');
    const lines = ['🏆 ТОП-10 ПО ПИЦЦЕРИЯМ', ''];
    for (let i = 0; i < r.rows.length; i++) {
        lines.push(`${i + 1}. @id${r.rows[i].user_id} — ${r.rows[i].pizzerias.toLocaleString()} шт (${r.rows[i].income.toLocaleString()} 🍕/час)`);
    }
    await ctx.send(lines.join('\n'));
}

async function cmdTopBalance(ctx) {
    const r = await executeQuery('SELECT user_id, balance FROM players WHERE banned = FALSE AND info_enabled = TRUE ORDER BY balance DESC LIMIT 10');
    if (!r.rows.length) return ctx.send('📊 Рейтинг пока пуст.');
    const lines = ['💰 ТОП-10 ПО БАЛАНСУ', ''];
    for (let i = 0; i < r.rows.length; i++) {
        lines.push(`${i + 1}. @id${r.rows[i].user_id} — ${r.rows[i].balance.toLocaleString()} 🍕`);
    }
    await ctx.send(lines.join('\n'));
}

async function cmdTopClans(ctx) {
    const r = await executeQuery(`SELECT c.name, COALESCE(SUM(p.income), 0) as total, COUNT(p.user_id) as cnt FROM clans c LEFT JOIN players p ON c.id = p.clan_id GROUP BY c.id, c.name ORDER BY total DESC LIMIT 10`);
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
    const prizeText = l.rows[0].prize_type === 'pizza' ? `${l.rows[0].prize_amount || l.rows[0].price * l.rows[0].slots} пиццерий` : `${l.rows[0].prize_amount || l.rows[0].price * l.rows[0].slots} 🍕`;
    await ctx.send(`🎟️ ЛОТЕРЕЯ\n\n💰 Цена билета: ${l.rows[0].price} 🍕\n👥 Участников: ${l.rows[0].bought}/${l.rows[0].slots}\n🏆 Приз: ${prizeText}\n\nКупить билет: лотерея купить`);
}

async function cmdLotteryBuy(ctx, uid) {
    const p = await getOrCreate(uid);
    if (p.banned) return ctx.send('⛔ Вы забанены.');
    const l = await executeQuery('SELECT * FROM lottery WHERE active = TRUE LIMIT 1');
    if (!l.rows[0]) return ctx.send('🎟️ Нет активной лотереи.');
    if (p.balance < l.rows[0].price) return ctx.send(`❌ Нужно ${l.rows[0].price} 🍕`);
    const already = await executeQuery('SELECT * FROM lottery_players WHERE lottery_id = $1 AND user_id = $2', [l.rows[0].id, uid]);
    if (already.rows[0]) return ctx.send('❌ Вы уже купили билет.');
    const payResult = await executeQuery('UPDATE players SET balance = balance - $1 WHERE user_id = $2 AND balance >= $1 RETURNING user_id', [l.rows[0].price, uid]);
    if (!payResult.rows[0]) return ctx.send('❌ Недостаточно средств.');
    await executeQuery('INSERT INTO lottery_players (lottery_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [l.rows[0].id, uid]);
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
    if (!players.rows.length) {
        await executeQuery('UPDATE lottery SET active = FALSE WHERE id = $1', [lot.id]);
        if (ctx) await ctx.send('🎟️ Лотерея завершена. Никто не участвовал.');
        return;
    }
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
    const msg = `🎉 ЛОТЕРЕЯ ЗАВЕРШЕНА!\n\n🏆 Победитель: @id${winner}\n💰 Приз: ${prizeMsg}`;
    if (ctx) await ctx.send(msg);
}

async function cmdPromo(ctx, uid, code) {
    const p = await getOrCreate(uid);
    if (p.banned) return ctx.send('⛔ Вы забанены.');
    const promo = await executeQuery('SELECT * FROM promos WHERE code = $1 AND active = TRUE', [code]);
    if (!promo.rows[0]) return ctx.send('❌ Промокод не найден.');
    const pr = promo.rows[0];
    if (pr.is_vip && p.vip_until <= getMskTimestamp()) return ctx.send('❌ Только для VIP.');
    const used = await executeQuery('SELECT * FROM promo_uses WHERE user_id = $1 AND code = $2', [uid, code]);
    if (used.rows[0]) return ctx.send('❌ Вы уже использовали.');
    if (pr.uses >= pr.max_uses) return ctx.send('❌ Промокод закончился.');
    await executeQuery('INSERT INTO promo_uses (user_id, code) VALUES ($1, $2)', [uid, code]);
    await executeQuery('UPDATE promos SET uses = uses + 1 WHERE code = $1', [code]);
    const now = getMskTimestamp();
    switch (pr.type) {
        case 'coins':
            await executeQuery('UPDATE players SET balance = balance + $1 WHERE user_id = $2', [pr.amount, uid]);
            await ctx.send(`🎟️ +${pr.amount} 🍕`);
            break;
        case 'pizza':
            await executeQuery('UPDATE players SET pizzerias = LEAST($1, pizzerias + $2) WHERE user_id = $3', [MAX_PIZZERIAS, pr.amount, uid]);
            await updateIncome(uid);
            await ctx.send(`🎟️ +${pr.amount} пиццерий`);
            break;
        case 'shield':
            await executeQuery('UPDATE players SET shield_until = $1 WHERE user_id = $2', [now + pr.amount, uid]);
            await ctx.send(`🎟️ Щит на ${fmtTime(pr.amount)}`);
            break;
        case 'vip':
            await executeQuery('UPDATE players SET vip_until = $1 WHERE user_id = $2', [now + pr.amount, uid]);
            await ctx.send(`🎟️ VIP на ${Math.ceil(pr.amount / 86400)} дн`);
            break;
        case 'oven1':
            await executeQuery('UPDATE players SET oven1 = TRUE WHERE user_id = $1', [uid]);
            await updateIncome(uid);
            await ctx.send('🎟️ Премиум-печь!');
            break;
        case 'oven2':
            await executeQuery('UPDATE players SET oven2 = TRUE WHERE user_id = $1', [uid]);
            await updateIncome(uid);
            await ctx.send('🎟️ Мега-печь!');
            break;
        default:
            await ctx.send('🎟️ Промокод активирован!');
    }
}

async function cmdDonate(ctx) {
    await ctx.send([
        '💎 ДОНАТ-МАГАЗИН', '1₿ = 1₽', '',
        '💰 БАЛАНС:',
        '• 100K 🍕 — 100 ₿ (донат купить баланс_100к)',
        '• 500K 🍕 — 400 ₿ (донат купить баланс_500к)',
        '• 1M 🍕 — 700 ₿ (донат купить баланс_1м)', '',
        '🏠 ПИЦЦЕРИИ:',
        '• +50 шт — 200 ₿ (донат купить пиццерии_50)',
        '• +200 шт — 700 ₿ (донат купить пиццерии_200)',
        '• +500 шт — 1 500 ₿ (донат купить пиццерии_500)', '',
        '👑 Золотая печь x3 — 5 000 ₿ (донат купить печь3)',
        '🛡️ Щит 24 часа — 200 ₿ (донат купить щит)',
        '👑 VIP 30 дней — 500 ₿ (донат купить вип)',
        '⚡ Отключение КД на 7 дней — 200 ₿ (донат купить кд)',
    ].join('\n'));
}

async function cmdDonateBuy(ctx, uid, item) {
    const p = await getOrCreate(uid);
    if (p.banned) return ctx.send('⛔ Вы забанены.');
    const keyMap = {
        'баланс_100к': 'balance_100k', 'баланс_500к': 'balance_500k', 'баланс_1м': 'balance_1m',
        'пиццерии_50': 'pizza_50', 'пиццерии_200': 'pizza_200', 'пиццерии_500': 'pizza_500',
        'печь3': 'oven3', 'щит': 'shield_24h', 'вип': 'vip_30d', 'vip': 'vip_30d',
        'кд': 'no_cd_7d', 'cd': 'no_cd_7d', 'no_cd': 'no_cd_7d',
        'balance_100k': 'balance_100k', 'balance_500k': 'balance_500k', 'balance_1m': 'balance_1m',
        'pizza_50': 'pizza_50', 'pizza_200': 'pizza_200', 'pizza_500': 'pizza_500',
        'oven3': 'oven3', 'shield_24h': 'shield_24h', 'vip_30d': 'vip_30d',
        'no_cd_7d': 'no_cd_7d'
    };
    const fullKey = keyMap[item.toLowerCase()] || item;
    const shop = await executeQuery('SELECT * FROM donate_shop WHERE item_key = $1', [fullKey]);
    if (!shop.rows[0]) return ctx.send('❌ Товар не найден.');
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
            if (p.oven3) return ctx.send('❌ Уже куплена.');
            await executeQuery('UPDATE players SET oven3 = TRUE, donate_balance = donate_balance + $1 WHERE user_id = $2', [s.price_rub, uid]);
            await updateIncome(uid);
            await ctx.send('💎 Золотая печь x3!');
            break;
        case 'shield':
            const shieldEnd = p.shield_until > now ? p.shield_until + s.duration : now + s.duration;
            await executeQuery('UPDATE players SET shield_until = $1, donate_balance = donate_balance + $2 WHERE user_id = $3', [shieldEnd, s.price_rub, uid]);
            await ctx.send('💎 Щит на 24 часа!');
            break;
        case 'vip':
            const vipEnd = p.vip_until > now ? p.vip_until + s.duration : now + s.duration;
            await executeQuery('UPDATE players SET vip_until = $1, donate_balance = donate_balance + $2 WHERE user_id = $3', [vipEnd, s.price_rub, uid]);
            await ctx.send('💎 VIP на 30 дней!');
            break;
        case 'no_cd':
            const cdEnd = p.no_cd_until > now ? p.no_cd_until + s.duration : now + s.duration;
            await executeQuery('UPDATE players SET no_cd_until = $1, donate_balance = donate_balance + $2 WHERE user_id = $3', [cdEnd, s.price_rub, uid]);
            await ctx.send(`⚡ Отключение КД на ${Math.ceil(s.duration / 86400)} дней!`);
            break;
        default:
            return ctx.send('❌ Ошибка типа товара.');
    }
}

// ═══════════════════════════════════════════════════════════
// ПОМОЩЬ
// ═══════════════════════════════════════════════════════════
async function cmdHelp(ctx) {
    await ctx.send([
        '🍕 PIZZA TYCOON — ПОМОЩЬ', '',
        '📋 ОСНОВНЫЕ:',
        '• старт — начать игру',
        '• профиль — свой профиль',
        '• купить [число] — купить пиццерии',
        '• хелп — помощь', '',
        '🔍 ПРОФИЛИ:',
        '• /info — управление профилем',
        '• /info @user — чужой профиль (VIP)',
        '• /info отключить/включить/удалить', '',
        '⚔️ АТАКИ:',
        '• динамит @user (10 000🍕)',
        '• крыса @user (5 000🍕)', '',
        '🛡️ ЗАЩИТА:',
        '• щит — 1 час (25 000🍕)', '',
        '👑 ПЕЧИ:',
        '• купить печь 1 — x1.5 (200 000🍕)',
        '• купить печь 2 — x2 (500 000🍕)', '',
        '🏠 КЛАНЫ:',
        '• клан создать [имя]',
        '• клан вступить [имя]',
        '• клан / клан выйти / клан удалить', '',
        '🎴 КАРТЫ:',
        '• карты — коллекция',
        '• карты [номер] — страница коллекции',
        '• карты слот [1-3] [ID] — выбрать',
        '• карты шансы — вероятности',
        '• Карты выпадают при покупке пиццерий!', '',
        '⭐ НАВЫКИ:',
        '• скилл — дерево навыков',
        '• скилл купить [ветка] [ур]', '',
        '🎁 БОНУСЫ:',
        '• бонус — ежедневный (7 день = VIP)', '',
        '📊 ТОПЫ:',
        '• топ / топ баланс / топ кланов', '',
        '🎟️ ЛОТЕРЕЯ:',
        '• лотерея / лотерея купить', '',
        '💎 ДОНАТ:',
        '• донат — магазин',
        '• донат купить [ключ]', '',
        '⏱ КД: 3 секунды на все команды',
        '⚡ Отключение КД: донат купить кд (7 дней за 200₿)',
        '🎉 Выходные: -50% цена пиццерий'
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
            '👑 АДМИН-КОМАНДЫ', '',
            '👤 ИГРОКИ:',
            '• !бан @user / !разбан @user',
            '• !скрыть @user / !показать @user',
            '• !профиль [ID]',
            '• !дать [ID] [сумма]',
            '• !датьпиц [ID] [кол-во]', '',
            '💎 ДОНАТ:',
            '• !донат дать [ID] [сумма]',
            '• !донат снять [ID] [сумма]',
            '• !донат инфо [ID]',
            '• !донат список', '',
            '🎟️ ЛОТЕРЕЯ:',
            '• !лотерея создать [цена] [мест] [coins/pizza] [приз]',
            '• !лотерея стоп',
            '• !лотерея удалить', '',
            '🎟️ ПРОМОКОДЫ:',
            '• !промо создать [код] [тип] [кол-во] [макс]',
            '• !промо вип [код] [тип] [кол-во] [макс]',
            '• !промо список / !промо удалить [код]', '',
            '⚡ ИВЕНТЫ:',
            '• !ивенты вкл / !ивенты выкл', '',
            '📊 ПРОЧЕЕ:',
            '• !стат — статистика',
            '• /рассылка [текст]'
        ].join('\n'));
    }

    if (cmd === '!ивенты' || cmd === '!ивент' || cmd === '!event' || cmd === '!events') {
        const sub = parts[1]?.toLowerCase();
        if (sub === 'вкл' || sub === 'включить' || sub === 'on' || sub === 'enable' || sub === 'start') {
            eventsEnabled = true;
            return ctx.send('✅ Ивенты включены!');
        }
        if (sub === 'выкл' || sub === 'выключить' || sub === 'off' || sub === 'disable' || sub === 'stop') {
            eventsEnabled = false;
            return ctx.send('❌ Ивенты выключены!');
        }
        return ctx.send(`⚡ Ивенты: ${eventsEnabled ? '✅ ВКЛ' : '❌ ВЫКЛ'}\n\nУправление: !ивенты вкл / !ивенты выкл`);
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
        await executeQuery('UPDATE players SET hidden = TRUE, info_enabled = FALSE WHERE user_id = $1', [tid]);
        return ctx.send(`🔒 @id${tid} скрыт.`);
    }
    if (cmd === '!показать') {
        const tid = extractId(text);
        if (!tid) return ctx.send('❌ !показать @user');
        await executeQuery('UPDATE players SET hidden = FALSE, info_enabled = TRUE WHERE user_id = $1', [tid]);
        return ctx.send(`🔓 @id${tid} виден.`);
    }
    if (cmd === '!профиль') {
        const tid = parseInt(parts[1]);
        if (!tid) return ctx.send('❌ !профиль [ID]');
        const p = await getPlayer(tid);
        if (!p) return ctx.send('❌ Не найден.');
        return ctx.send(`👤 @id${tid}\nУр: ${p.level} | 🍕 ${p.balance.toLocaleString()}\n🏠 ${p.pizzerias} | 📈 ${p.income}/ч\n💎 Донат: ${p.donate_balance.toLocaleString()}₿\n🚫 ${p.banned ? 'Бан' : 'Ок'}`);
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

    if (cmd === '!донат') {
        const subCmd = parts[1]?.toLowerCase();
        if (subCmd === 'дать') {
            const tid = parseInt(parts[2]);
            const amt = parseInt(parts[3]);
            if (!tid || !amt) return ctx.send('❌ !донат дать [ID] [сумма]');
            await executeQuery('UPDATE players SET donate_balance = donate_balance + $1 WHERE user_id = $2', [amt, tid]);
            return ctx.send(`💎 @id${tid} +${amt}₿`);
        }
        if (subCmd === 'снять') {
            const tid = parseInt(parts[2]);
            const amt = parseInt(parts[3]);
            if (!tid || !amt) return ctx.send('❌ !донат снять [ID] [сумма]');
            await executeQuery('UPDATE players SET donate_balance = GREATEST(0, donate_balance - $1) WHERE user_id = $2', [amt, tid]);
            return ctx.send(`💎 @id${tid} -${amt}₿`);
        }
        if (subCmd === 'инфо') {
            const tid = parseInt(parts[2]);
            if (!tid) return ctx.send('❌ !донат инфо [ID]');
            const p = await getPlayer(tid);
            if (!p) return ctx.send('❌ Не найден.');
            return ctx.send(`💎 @id${tid}: ${p.donate_balance.toLocaleString()}₿`);
        }
        if (subCmd === 'список') {
            const list = await executeQuery('SELECT * FROM donate_shop ORDER BY price_rub');
            const lines = ['💎 ТОВАРЫ:', ''];
            for (const d of list.rows) {
                lines.push(`${d.item_name} | ${d.item_key} | ${d.price_rub}₿`);
            }
            return ctx.send(lines.join('\n'));
        }
        return ctx.send('❌ !донат дать/снять/инфо/список');
    }

    if (cmd === '!лотерея') {
        const subCmd = parts[1]?.toLowerCase();
        if (subCmd === 'создать') {
            const price = parseInt(parts[2]);
            const slots = parseInt(parts[3]) || 10;
            const prizeType = parts[4] || 'coins';
            const prizeAmount = parseInt(parts[5]) || 0;
            if (!price) return ctx.send('❌ !лотерея создать [цена] [мест] [coins/pizza] [приз]');
            if (!['coins', 'pizza'].includes(prizeType)) return ctx.send('❌ coins или pizza');
            await executeQuery('UPDATE lottery SET active = FALSE WHERE active = TRUE');
            await executeQuery('INSERT INTO lottery (price, slots, prize_type, prize_amount, created_at) VALUES ($1,$2,$3,$4,$5)', [price, slots, prizeType, prizeAmount, getMskTimestamp()]);
            const prizeText = prizeType === 'pizza' ? `${prizeAmount || price * slots} пиццерий` : `${prizeAmount || price * slots} 🍕`;
            return ctx.send(`🎟️ Лотерея создана!\n💰 Цена: ${price} 🍕\n👥 Мест: ${slots}\n🏆 Приз: ${prizeText}`);
        }
        if (subCmd === 'стоп') {
            const l = await executeQuery('SELECT * FROM lottery WHERE active = TRUE LIMIT 1');
            if (!l.rows[0]) return ctx.send('❌ Нет активной лотереи.');
            await finishLottery(l.rows[0], ctx);
            return;
        }
        if (subCmd === 'удалить') {
            const l = await executeQuery('SELECT * FROM lottery WHERE active = TRUE LIMIT 1');
            if (!l.rows[0]) return ctx.send('❌ Нет активной лотереи.');
            const lotId = l.rows[0].id;
            const players = await executeQuery('SELECT user_id FROM lottery_players WHERE lottery_id = $1', [lotId]);
            for (const pl of players.rows) {
                await executeQuery('UPDATE players SET balance = balance + $1 WHERE user_id = $2', [l.rows[0].price, pl.user_id]);
            }
            await executeQuery('DELETE FROM lottery_players WHERE lottery_id = $1', [lotId]);
            await executeQuery('UPDATE lottery SET active = FALSE WHERE id = $1', [lotId]);
            return ctx.send(`🗑️ Лотерея удалена. ${players.rows.length} участникам возвращены деньги.`);
        }
        return ctx.send('❌ !лотерея создать/стоп/удалить');
    }

    if (cmd === '!промо') {
        const subCmd = parts[1]?.toLowerCase();
        if (subCmd === 'создать') {
            const code = parts[2]?.toUpperCase();
            const type = parts[3];
            const amt = parseInt(parts[4]);
            const max = parseInt(parts[5]) || 1;
            if (!code || !type || !amt) return ctx.send('❌ !промо создать [код] [тип] [кол-во] [макс]');
            await executeQuery('INSERT INTO promos (code, type, amount, max_uses, created_by) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [code, type, amt, max, uid]);
            return ctx.send(`🎟️ Промокод ${code}`);
        }
        if (subCmd === 'вип') {
            const code = parts[2]?.toUpperCase();
            const type = parts[3];
            const amt = parseInt(parts[4]);
            const max = parseInt(parts[5]) || 1;
            if (!code || !type || !amt) return ctx.send('❌ !промо вип [код] [тип] [кол-во] [макс]');
            await executeQuery('INSERT INTO promos (code, type, amount, max_uses, is_vip, created_by) VALUES ($1,$2,$3,$4,TRUE,$5) ON CONFLICT DO NOTHING', [code, type, amt, max, uid]);
            return ctx.send(`🎟️ VIP-промокод ${code}`);
        }
        if (subCmd === 'список') {
            const list = await executeQuery('SELECT * FROM promos ORDER BY code');
            if (!list.rows.length) return ctx.send('📋 Нет промокодов.');
            const lines = ['📋 Промокоды:', ''];
            for (const p of list.rows) {
                lines.push(`${p.active ? '✅' : '❌'} ${p.code} | ${p.type} ${p.amount} | ${p.uses}/${p.max_uses} ${p.is_vip ? 'VIP' : ''}`);
            }
            return ctx.send(lines.join('\n'));
        }
        if (subCmd === 'удалить') {
            const code = parts[2]?.toUpperCase();
            if (!code) return ctx.send('❌ !промо удалить [код]');
            await executeQuery('DELETE FROM promos WHERE code = $1', [code]);
            return ctx.send(`✅ ${code} удалён.`);
        }
        return ctx.send('❌ !промо создать/вип/список/удалить');
    }

    if (cmd === '!стат') {
        const u = await executeQuery('SELECT COUNT(*) as c FROM players');
        const tp = await executeQuery('SELECT SUM(pizzerias) as t FROM players');
        const tb = await executeQuery('SELECT SUM(balance) as t FROM players');
        const bn = await executeQuery('SELECT COUNT(*) as c FROM players WHERE banned = TRUE');
        const cl = await executeQuery('SELECT COUNT(*) as c FROM clans');
        const dd = await executeQuery('SELECT SUM(donate_balance) as t FROM players');
        return ctx.send([
            '📊 СТАТИСТИКА', '',
            `👥 Игроков: ${u.rows[0].c}`,
            `🏠 Пиццерий: ${(tp.rows[0].t || 0).toLocaleString()}`,
            `🍕 Баланс: ${(tb.rows[0].t || 0).toLocaleString()}`,
            `💎 Донат: ${(dd.rows[0].t || 0).toLocaleString()}₿`,
            `🚫 Банов: ${bn.rows[0].c}`,
            `🏠 Кланов: ${cl.rows[0].c}`,
            `⚡ Ивенты: ${eventsEnabled ? 'ВКЛ' : 'ВЫКЛ'}`
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
        return ctx.send(`📨 Рассылка: ✅${ok} ❌${fail}`);
    }
}

// ═══════════════════════════════════════════════════════════
// НАЧИСЛЕНИЕ ДОХОДА И ИВЕНТЫ
// ═══════════════════════════════════════════════════════════
async function hourlyIncome() {
    if (!isDbConnected) return;
    try {
        const players = await executeQuery('SELECT user_id, income FROM players WHERE pizzerias > 0 AND banned = FALSE');
        for (const p of players.rows) {
            await executeQuery('UPDATE players SET balance = balance + $1 WHERE user_id = $2', [p.income, p.user_id]);
        }
        console.log(`💰 Доход: ${players.rows.length} игроков`);
    } catch (e) {
        console.error('❌ Доход:', e.message);
    }
}

async function hourlyEvent() {
    if (!isDbConnected || !eventsEnabled) return;
    try {
        const events = [
            { name: '🐀 Крысиное нашествие', chance: 25, effect: 'balance', percent: 3, msg: 'Крысы атаковали! Все теряют 3% баланса! (щит защищает)' },
            { name: '🚨 Санинспекция', chance: 20, effect: 'random_player', percent: 5, msg: 'Санинспекция! Случайный игрок потерял 5% пиццерий.' },
            { name: '🎉 День пиццы', chance: 15, effect: 'buff', msg: '🎉 День пиццы! Доход увеличен!' },
            { name: '🌟 Звездный час', chance: 10, effect: 'random_buff', msg: '🌟 Случайный игрок получил +10 пиццерий!' },
            { name: '💀 Чёрный день', chance: 5, effect: 'debuff', msg: '💀 Кризис! Доход снижен.' }
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
                await executeQuery('UPDATE players SET pizzerias = LEAST($1, pizzerias + 10) WHERE user_id = $2', [MAX_PIZZERIAS, players.rows[0].user_id]);
                await updateIncome(players.rows[0].user_id);
                try {
                    await vk.api.messages.send({
                        user_id: players.rows[0].user_id,
                        message: '🌟 Звездный час! +10 пиццерий!',
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
                    message: `📢 ${chosen.msg}`,
                    random_id: Math.floor(Math.random() * 1e9)
                });
            } catch (e) {}
            await new Promise(r => setTimeout(r, 2000));
        }
        console.log(`🐀 Ивент: ${chosen.name}`);
    } catch (e) {
        console.error('❌ Ивент:', e.message);
    }
}

// ═══════════════════════════════════════════════════════════
// ОБРАБОТЧИК СООБЩЕНИЙ (ПОЛНОСТЬЮ ПЕРЕРАБОТАН)
// ═══════════════════════════════════════════════════════════
const vk = new VK({ token: TOKEN });
const userLocks = new Map();

vk.updates.on('message_new', async (ctx) => {
    let uid;
    try {
        if (!isDbConnected) {
            try { await ctx.send('🔄 Бот перезапускается...'); } catch (e) {}
            return;
        }
        if (!ctx.text) return;
        uid = ctx.senderId;
        if (!uid || uid < 0) return;

        // Единая проверка КД для всех команд
        const isNoCd = await isCooldownDisabled(uid);
        if (!isNoCd) {
            const cdCheck = await checkGlobalCooldown(uid);
            if (!cdCheck.allowed) {
                return ctx.send(`⏱ Подождите ${cdCheck.remaining} сек перед следующей командой!`);
            }
        }

        // Проверка блокировки пользователя
        if (userLocks.get(uid)) {
            return ctx.send('⏱ Подождите, предыдущая команда выполняется...');
        }
        userLocks.set(uid, true);

        try {
            const text = ctx.text.trim();
            const lower = text.toLowerCase();

            // Проверка бана для всех команд
            const p = await getPlayer(uid);
            if (p && p.banned && lower !== 'старт') {
                return ctx.send('⛔ Вы забанены.');
            }

            if (uid === ADMIN_ID && (text.startsWith('!') || text.startsWith('/рассылка'))) {
                return await cmdAdmin(ctx, uid, text);
            }

            if (lower === 'старт') {
                await getOrCreate(uid);
                return await ctx.send('🍕 Добро пожаловать в Pizza Tycoon!\n\nКупить пиццерии: купить 10\nПомощь: хелп');
            }

            if (lower === 'хелп' || lower === 'помощь') return await cmdHelp(ctx);
            if (lower === 'профиль') return await cmdProfile(ctx, uid);
            if (lower.startsWith('/info') || lower.startsWith('инфо')) return await cmdInfo(ctx, uid, text);

            if (lower === 'бонус' || lower === 'daily' || lower === 'ежедневный') return await cmdDailyBonus(ctx, uid);

            // Пагинация карт
            if (lower === 'карты' || lower === 'коллекция') return await cmdCards(ctx, uid, 1);
            if (lower.startsWith('карты ')) {
                const parts = text.trim().split(/\s+/);
                if (parts[1] === 'слот') {
                    const slot = parseInt(parts[2]);
                    const cardId = parseInt(parts[3]);
                    if (!slot || !cardId) return ctx.send('❌ карты слот [1-3] [ID карты]');
                    return await cmdCardSet(ctx, uid, slot, cardId);
                }
                if (parts[1] === 'шансы') return await cmdCardsChances(ctx);
                // Пробуем распарсить как номер страницы
                const page = parseInt(parts[1]);
                if (!isNaN(page) && page > 0) {
                    return await cmdCards(ctx, uid, page);
                }
                return ctx.send('❌ Используйте: карты, карты [номер], карты слот [1-3] [ID], карты шансы');
            }

            if (lower === 'скилл' || lower === 'навыки' || lower === 'скиллы') return await cmdSkills(ctx, uid);
            if (lower.startsWith('скилл купить')) {
                const parts = text.trim().split(/\s+/);
                const tree = parts[2]?.toLowerCase();
                const level = parseInt(parts[3]);
                if (!tree || !level) return ctx.send('❌ скилл купить [buy/dynamite/rat/special] [уровень]');
                return await cmdSkillBuy(ctx, uid, tree, level);
            }

            if (lower.startsWith('купить печь')) {
                const num = parseInt(lower.replace('купить печь', '').trim());
                return await cmdBuyOven(ctx, uid, num);
            }

            if (lower.startsWith('донат купить')) {
                const item = lower.replace('донат купить', '').trim();
                return await cmdDonateBuy(ctx, uid, item);
            }

            if (lower === 'купить билет' || lower === 'лотерея купить') return await cmdLotteryBuy(ctx, uid);

            if (lower.startsWith('купить')) {
                let count = parseInt(lower.replace('купить', '').trim());
                if (isNaN(count) || count <= 0) count = 10;
                return await cmdBuy(ctx, uid, count);
            }

            if (lower === 'печи') return await cmdOvens(ctx, uid);

            if (lower.startsWith('динамит')) {
                const tid = extractId(text);
                if (!tid) return await ctx.send('❌ динамит @user');
                return await cmdDynamite(ctx, uid, tid);
            }

            if (lower.startsWith('крыса')) {
                const tid = extractId(text);
                if (!tid) return await ctx.send('❌ крыса @user');
                return await cmdRat(ctx, uid, tid);
            }

            if (lower === 'щит') return await cmdShield(ctx, uid);

            if (lower.startsWith('клан создать')) {
                const name = text.slice('клан создать'.length).trim();
                return await cmdClanCreate(ctx, uid, name);
            }
            if (lower.startsWith('клан вступить')) {
                const name = text.slice('клан вступить'.length).trim();
                return await cmdClanJoin(ctx, uid, name);
            }
            if (lower === 'клан удалить') return await cmdClanDelete(ctx, uid);
            if (lower === 'клан выйти') return await cmdClanLeave(ctx, uid);
            if (lower === 'клан список') return await cmdClanList(ctx, uid);
            if (lower === 'клан') return await cmdClanInfo(ctx, uid);

            if (lower === 'топ баланс') return await cmdTopBalance(ctx);
            if (lower === 'топ кланов') return await cmdTopClans(ctx);
            if (lower === 'топ') return await cmdTop(ctx);

            if (lower === 'лотерея') return await cmdLotteryInfo(ctx);

            if (lower.startsWith('промокод')) {
                const code = text.slice('промокод'.length).trim().toUpperCase();
                return await cmdPromo(ctx, uid, code);
            }

            if (lower === 'донат') return await cmdDonate(ctx);

        } finally {
            userLocks.delete(uid);
        }

    } catch (e) {
        console.error('❌', e.message);
        try { await ctx.send('❌ Ошибка.'); } catch (ex) {}
        if (uid) userLocks.delete(uid);
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
        console.error('❌ Поллинг:', e.message);
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