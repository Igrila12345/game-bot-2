const express = require('express');
const cors = require('cors');
const { VK } = require('vk-io');
const { HearManager } = require('@vk-io/hear');
const { Pool } = require('pg');

// ==================== КОНФИГУРАЦИЯ ====================
const TOKEN = 'vk1.a.XAhDjxvWUcrO5q6xzs-wiIWObToSVxKXB6QQ5UJzI8gpicZs98VR8eky7F4YmScRkbHxvvfWwTmAl3Iw21QRuTQna1DsmwVJGqhmjGFetmJQwAR-O0iJhTr25YG07uzEOTAOsd3cinK_GWK8SQzXMwS-RnhQjC8drM0Yd8sGBLr1F725agNzLV-hm253ElYiiT59zK5e96sj5ZNEwrpwgQ';
const ADMIN_ID = 660964860;
const GROUP_ID = 231991465;
const API_PORT = 3000;

// ==================== ПОДКЛЮЧЕНИЕ К БД ====================
const pool = new Pool({
    user: 'neondb_owner',
    password: 'npg_GTCkzIdrgN63',
    host: 'ep-lively-lake-aljgwbr0.c-3.eu-central-1.aws.neon.tech',
    port: 5432,
    database: 'neondb',
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

// ==================== ИНИЦИАЛИЗАЦИЯ VK ====================
const vk = new VK({ token: TOKEN, pollingGroupId: GROUP_ID, apiMode: 'sequential' });
const hearManager = new HearManager();

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
async function getPlayer(userId) {
    const res = await pool.query('SELECT * FROM players WHERE user_id = $1', [userId]);
    return res.rows[0] || null;
}

async function getOrCreatePlayer(userId, firstName, lastName) {
    let player = await getPlayer(userId);
    if (!player) {
        const res = await pool.query(
            `INSERT INTO players (user_id, first_name, last_name, balance, slaves) 
             VALUES ($1, $2, $3, 1000, 0) 
             ON CONFLICT (user_id) DO NOTHING 
             RETURNING *`,
            [userId, firstName, lastName]
        );
        player = res.rows[0] || await getPlayer(userId);
    }
    return player;
}

async function logBan(adminId, targetId, action) {
    await pool.query(
        `INSERT INTO ban_logs (admin_id, target_id, action) VALUES ($1, $2, $3)`,
        [adminId, targetId, action]
    );
}

// ==================== СОЗДАНИЕ ТАБЛИЦ ====================
async function initDB() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS players (
            id SERIAL PRIMARY KEY,
            user_id BIGINT UNIQUE NOT NULL,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            balance BIGINT DEFAULT 1000,
            slaves INT DEFAULT 0,
            slaves_data JSONB DEFAULT '[]',
            last_collect TIMESTAMP DEFAULT NOW(),
            is_banned BOOLEAN DEFAULT FALSE,
            clan_id INT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS clans (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) UNIQUE NOT NULL,
            leader_id BIGINT NOT NULL,
            members INT DEFAULT 1,
            capital BIGINT DEFAULT 0,
            level INT DEFAULT 1,
            photo_200 VARCHAR(500),
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS ban_logs (
            id SERIAL PRIMARY KEY,
            admin_id BIGINT NOT NULL,
            target_id BIGINT NOT NULL,
            action VARCHAR(10) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS market_slaves (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100),
            avatar VARCHAR(500),
            price INT DEFAULT 500,
            income INT DEFAULT 50,
            is_available BOOLEAN DEFAULT TRUE
        )
    `);

    console.log('✅ Таблицы проверены/созданы');
}

// ==================== КОМАНДЫ VK БОТА ====================

// /info [ID или @user]
hearManager.hear(/^\/(info|инфо)(?:\s+(.+))?$/i, async (context) => {
    try {
        let targetId = context.senderId;
        
        const args = context.text.match(/^\/(?:info|инфо)\s+(.+)$/i);
        if (args) {
            const mentionMatch = args[1].match(/\[(?:id|club)(\d+)\|/);
            if (mentionMatch) targetId = parseInt(mentionMatch[1]);
            else if (!isNaN(parseInt(args[1]))) targetId = parseInt(args[1]);
        }
        
        let player = await getPlayer(targetId);
        if (!player) {
            const [user] = await vk.api.users.get({ user_ids: targetId });
            if (!user) return context.send('❌ Пользователь не найден');
            player = await getOrCreatePlayer(targetId, user.first_name, user.last_name);
        }
        
        const name = `${player.first_name || ''} ${player.last_name || ''}`.trim() || `Игрок #${targetId}`;
        let clanName = 'Нет';
        if (player.clan_id) {
            const clanRes = await pool.query('SELECT name FROM clans WHERE id = $1', [player.clan_id]);
            if (clanRes.rows[0]) clanName = clanRes.rows[0].name;
        }
        
        let slavesData = [];
        try { slavesData = typeof player.slaves_data === 'string' ? JSON.parse(player.slaves_data) : (player.slaves_data || []); } catch { slavesData = []; }
        const hourlyIncome = slavesData.reduce((sum, s) => sum + (s.income || 0), 0);
        
        await context.send(`
📊 **ИНФОРМАЦИЯ ОБ ИГРОКЕ**

👤 ${name}
🆔 ID: ${targetId}
💰 Баланс: ${player.balance || 0} монет
👥 Рабов: ${player.slaves || 0}
📈 Доход: ${hourlyIncome} монет/час
⚔️ Клан: ${clanName}
${player.is_banned ? '⛔ **ЗАБАНЕН**' : '✅ Активен'}
        `);
    } catch (e) {
        console.error('/info error:', e);
        await context.send('❌ Ошибка');
    }
});

// /ban [ID]
hearManager.hear(/^\/(ban|бан)(?:\s+(\d+))?$/i, async (context) => {
    try {
        if (context.senderId !== ADMIN_ID) return context.send('❌ Доступ запрещён');
        
        const match = context.text.match(/^\/(?:ban|бан)\s+(\d+)/i);
        if (!match) return context.send('❌ Использование: /ban 123456789');
        
        const targetId = parseInt(match[1]);
        const player = await getPlayer(targetId);
        if (!player) return context.send(`❌ Игрок #${targetId} не найден`);
        if (player.is_banned) return context.send(`⚠️ Игрок уже забанен`);
        
        await pool.query('UPDATE players SET is_banned = TRUE WHERE user_id = $1', [targetId]);
        await logBan(ADMIN_ID, targetId, 'ban');
        
        const name = `${player.first_name || ''} ${player.last_name || ''}`.trim() || `Игрок #${targetId}`;
        await context.send(`✅ **${name} (ID: ${targetId}) ЗАБАНЕН**\n⛔ Не может войти в игру.`);
        
        try {
            await vk.api.messages.send({
                user_id: targetId,
                message: '⛔ Вы были забанены администратором. Доступ в игру закрыт.',
                random_id: Date.now()
            });
        } catch {}
        
    } catch (e) {
        console.error('/ban error:', e);
        await context.send('❌ Ошибка');
    }
});

// /unban [ID]
hearManager.hear(/^\/(unban|разбан)(?:\s+(\d+))?$/i, async (context) => {
    try {
        if (context.senderId !== ADMIN_ID) return context.send('❌ Доступ запрещён');
        
        const match = context.text.match(/^\/(?:unban|разбан)\s+(\d+)/i);
        if (!match) return context.send('❌ Использование: /unban 123456789');
        
        const targetId = parseInt(match[1]);
        const player = await getPlayer(targetId);
        if (!player) return context.send(`❌ Игрок #${targetId} не найден`);
        if (!player.is_banned) return context.send(`⚠️ Игрок не забанен`);
        
        await pool.query('UPDATE players SET is_banned = FALSE WHERE user_id = $1', [targetId]);
        await logBan(ADMIN_ID, targetId, 'unban');
        
        const name = `${player.first_name || ''} ${player.last_name || ''}`.trim() || `Игрок #${targetId}`;
        await context.send(`✅ **${name} (ID: ${targetId}) РАЗБАНЕН**`);
        
        try {
            await vk.api.messages.send({
                user_id: targetId,
                message: '✅ Вы были разбанены! Доступ в игру восстановлен.',
                random_id: Date.now()
            });
        } catch {}
        
    } catch (e) {
        console.error('/unban error:', e);
        await context.send('❌ Ошибка');
    }
});

// /addslaves [ID] [количество]
hearManager.hear(/^\/(addslaves|добавитьрабов)(?:\s+(\d+)\s+(\d+))?$/i, async (context) => {
    try {
        if (context.senderId !== ADMIN_ID) return context.send('❌ Доступ запрещён');
        
        const match = context.text.match(/^\/(?:addslaves|добавитьрабов)\s+(\d+)\s+(\d+)/i);
        if (!match) return context.send('❌ Использование: /addslaves 123456789 5');
        
        const targetId = parseInt(match[1]);
        const amount = parseInt(match[2]);
        
        const player = await getPlayer(targetId);
        if (!player) return context.send(`❌ Игрок #${targetId} не найден`);
        
        await pool.query('UPDATE players SET slaves = slaves + $1 WHERE user_id = $2', [amount, targetId]);
        await context.send(`✅ Игроку #${targetId} добавлено ${amount} рабов`);
        
    } catch (e) {
        console.error('/addslaves error:', e);
        await context.send('❌ Ошибка');
    }
});

// ==================== API ДЛЯ МИНИ-АППА ====================
const app = express();
app.use(cors());
app.use(express.json());

// Получить игрока
app.get('/api/getPlayer', async (req, res) => {
    const { userId } = req.query;
    const result = await pool.query('SELECT * FROM players WHERE user_id = $1', [userId]);
    res.json(result.rows[0] || null);
});

// Получить рынок
app.get('/api/market', async (req, res) => {
    const result = await pool.query('SELECT * FROM market_slaves WHERE is_available = TRUE');
    res.json({ slaves: result.rows, isOpen: true });
});

// Получить кланы
app.get('/api/clans', async (req, res) => {
    const result = await pool.query('SELECT * FROM clans ORDER BY members DESC');
    res.json({ clans: result.rows });
});

// Топ игроков
app.get('/api/top/players', async (req, res) => {
    const result = await pool.query('SELECT user_id, first_name, last_name, balance, slaves FROM players WHERE is_banned = FALSE ORDER BY balance DESC LIMIT 50');
    res.json({ players: result.rows });
});

// Топ кланов
app.get('/api/top/clans', async (req, res) => {
    const result = await pool.query('SELECT * FROM clans ORDER BY members DESC LIMIT 20');
    res.json({ clans: result.rows });
});

// Обновить игрока
app.post('/api/updatePlayer', async (req, res) => {
    const { userId, data } = req.body;
    await pool.query(
        `UPDATE players SET balance = $1, slaves = $2, slaves_data = $3, last_collect = $4 WHERE user_id = $5`,
        [data.balance, data.slaves, JSON.stringify(data.slaves_data || []), data.last_collect, userId]
    );
    res.json({ success: true });
});

// Создать игрока
app.post('/api/createPlayer', async (req, res) => {
    const { user_id, first_name, last_name } = req.body;
    const result = await pool.query(
        `INSERT INTO players (user_id, first_name, last_name, balance, slaves) 
         VALUES ($1, $2, $3, 1000, 0) 
         ON CONFLICT (user_id) DO UPDATE SET first_name = $2, last_name = $3
         RETURNING *`,
        [user_id, first_name, last_name]
    );
    res.json({ success: true, player: result.rows[0] });
});

// Купить раба
app.post('/api/buySlave', async (req, res) => {
    const { userId, slaveId } = req.body;
    const slave = await pool.query('SELECT * FROM market_slaves WHERE id = $1 AND is_available = TRUE', [slaveId]);
    if (slave.rows.length === 0) return res.json({ success: false, error: 'Раб не найден' });
    
    const player = await getPlayer(userId);
    if (!player) return res.json({ success: false, error: 'Игрок не найден' });
    
    const price = slave.rows[0].price;
    if (player.balance < price) return res.json({ success: false, error: 'Недостаточно монет' });
    
    let slavesData = [];
    try { slavesData = typeof player.slaves_data === 'string' ? JSON.parse(player.slaves_data) : (player.slaves_data || []); } catch { slavesData = []; }
    
    slavesData.push({
        id: slaveId,
        name: slave.rows[0].name,
        avatar: slave.rows[0].avatar,
        income: slave.rows[0].income,
        price: price
    });
    
    await pool.query(
        `UPDATE players SET balance = balance - $1, slaves = slaves + 1, slaves_data = $2 WHERE user_id = $3`,
        [price, JSON.stringify(slavesData), userId]
    );
    
    res.json({ success: true });
});

// Продать раба
app.post('/api/sellSlave', async (req, res) => {
    const { userId, slaveIndex } = req.body;
    const player = await getPlayer(userId);
    if (!player) return res.json({ success: false, error: 'Игрок не найден' });
    
    let slavesData = [];
    try { slavesData = typeof player.slaves_data === 'string' ? JSON.parse(player.slaves_data) : (player.slaves_data || []); } catch { slavesData = []; }
    
    if (slaveIndex >= slavesData.length) return res.json({ success: false, error: 'Раб не найден' });
    
    const slave = slavesData[slaveIndex];
    const sellPrice = Math.floor(slave.price * 0.7);
    
    slavesData.splice(slaveIndex, 1);
    
    await pool.query(
        `UPDATE players SET balance = balance + $1, slaves = slaves - 1, slaves_data = $2 WHERE user_id = $3`,
        [sellPrice, JSON.stringify(slavesData), userId]
    );
    
    res.json({ success: true, sellPrice });
});

// Вступить в клан
app.post('/api/joinClan', async (req, res) => {
    const { userId, clanId } = req.body;
    await pool.query('UPDATE players SET clan_id = $1 WHERE user_id = $2', [clanId, userId]);
    await pool.query('UPDATE clans SET members = members + 1 WHERE id = $1', [clanId]);
    res.json({ success: true });
});

// Выйти из клана
app.post('/api/leaveClan', async (req, res) => {
    const { userId, clanId } = req.body;
    await pool.query('UPDATE players SET clan_id = NULL WHERE user_id = $1', [userId]);
    await pool.query('UPDATE clans SET members = members - 1 WHERE id = $1', [clanId]);
    res.json({ success: true });
});

// ==================== ЗАПУСК ====================
async function start() {
    try {
        await initDB();
        console.log('✅ База данных готова');
        
        // Запуск API сервера
        app.listen(API_PORT, () => {
            console.log(`✅ API сервер запущен на порту ${API_PORT}`);
        });
        
        // Запуск VK бота
        vk.updates.on('message_new', hearManager.middleware);
        await vk.updates.startPolling();
        console.log('✅ VK бот запущен');
        console.log(`📱 Группа: https://vk.com/club${GROUP_ID}`);
        console.log(`👤 Админ: ${ADMIN_ID}`);
        
    } catch (e) {
        console.error('❌ Ошибка запуска:', e);
        process.exit(1);
    }
}

start();