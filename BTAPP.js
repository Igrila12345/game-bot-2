const express = require('express');
const cors = require('cors');
const path = require('path');
const { VK } = require('vk-io');
const { HearManager } = require('@vk-io/hear');
const { Pool } = require('pg');

// ==================== КОНФИГУРАЦИЯ ====================
const TOKEN = 'vk1.a.XAhDjxvWUcrO5q6xzs-wiIWObToSVxKXB6QQ5UJzI8gpicZs98VR8eky7F4YmScRkbHxvvfWwTmAl3Iw21QRuTQna1DsmwVJGqhmjGFetmJQwAR-O0iJhTr25YG07uzEOTAOsd3cinK_GWK8SQzXMwS-RnhQjC8drM0Yd8sGBLr1F725agNzLV-hm253ElYiiT59zK5e96sj5ZNEwrpwgQ';
const ADMIN_ID = 660964860;
const GROUP_ID = 234390031;
const PORT = 3000;

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
        await pool.query(
            `INSERT INTO players (user_id, first_name, last_name, balance, slaves) 
             VALUES ($1, $2, $3, 1000, 0) 
             ON CONFLICT (user_id) DO NOTHING`,
            [userId, firstName, lastName]
        );
        player = await getPlayer(userId);
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
        CREATE TABLE IF NOT EXISTS market_slaves (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100),
            avatar VARCHAR(500),
            price INT DEFAULT 500,
            income INT DEFAULT 50,
            is_available BOOLEAN DEFAULT TRUE
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS user_robots (
            id SERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            robot_id INT NOT NULL,
            name VARCHAR(100),
            avatar VARCHAR(500),
            price INT DEFAULT 500,
            income INT DEFAULT 50,
            is_for_sale BOOLEAN DEFAULT FALSE,
            sale_price INT DEFAULT NULL,
            purchased_at TIMESTAMP DEFAULT NOW()
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

    // Добавляем тестовых роботов, если таблица пуста
    const count = await pool.query('SELECT COUNT(*) FROM market_slaves');
    if (parseInt(count.rows[0].count) < 100) {
        console.log('🔄 Добавляем тестовых роботов на рынок...');
        for (let i = 1; i <= 100; i++) {
            const robotNames = ['Механизм', 'Робот', 'Дроид', 'Андроид', 'Кибер', 'Автоматон', 'Машина', 'Искусственный'];
            const name = `${robotNames[Math.floor(Math.random() * robotNames.length)]} ${i}`;
            const price = 500 + Math.floor(Math.random() * 2000);
            const income = 30 + Math.floor(Math.random() * 150);
            await pool.query(
                `INSERT INTO market_slaves (name, avatar, price, income, is_available) 
                 VALUES ($1, $2, $3, $4, TRUE)`,
                [name, `https://robohash.org/${i}?set=set3`, price, income]
            );
        }
        console.log('✅ Добавлено 100 тестовых роботов');
    }

    console.log('✅ База данных готова');
}

// ==================== КОМАНДЫ VK БОТА ====================

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
        
        const robots = await pool.query('SELECT * FROM user_robots WHERE user_id = $1', [targetId]);
        const totalIncome = robots.rows.reduce((sum, r) => sum + (r.income || 0), 0);
        
        const name = `${player.first_name || ''} ${player.last_name || ''}`.trim() || `Игрок #${targetId}`;
        
        await context.send(`
📊 **ИНФОРМАЦИЯ ОБ ИГРОКЕ**

👤 ${name}
🆔 ID: ${targetId}
💰 Баланс: ${player.balance || 0} монет
🤖 Роботов: ${robots.rows.length}
📈 Доход: ${totalIncome} монет/час
${player.is_banned ? '⛔ **ЗАБАНЕН**' : '✅ Активен'}
        `);
    } catch (e) {
        console.error('/info error:', e);
        await context.send('❌ Ошибка');
    }
});

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
        
        await context.send(`✅ Игрок #${targetId} ЗАБАНЕН`);
    } catch (e) {
        console.error('/ban error:', e);
        await context.send('❌ Ошибка');
    }
});

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
        
        await context.send(`✅ Игрок #${targetId} РАЗБАНЕН`);
    } catch (e) {
        console.error('/unban error:', e);
        await context.send('❌ Ошибка');
    }
});

// ==================== API ДЛЯ МИНИ-АППА ====================
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Отдаём файлы из папки (index.html)

// Главная страница - отдаём index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API эндпоинты
app.get('/api/getPlayer', async (req, res) => {
    const { userId } = req.query;
    const player = await pool.query('SELECT * FROM players WHERE user_id = $1', [userId]);
    if (!player.rows[0]) return res.json(null);
    const robots = await pool.query('SELECT * FROM user_robots WHERE user_id = $1', [userId]);
    res.json({ ...player.rows[0], robots: robots.rows });
});

app.get('/api/market', async (req, res) => {
    const result = await pool.query('SELECT * FROM market_slaves WHERE is_available = TRUE LIMIT 100');
    res.json({ slaves: result.rows, isOpen: true });
});

app.post('/api/buySlave', async (req, res) => {
    const { userId, robotId } = req.body;
    const robot = await pool.query('SELECT * FROM market_slaves WHERE id = $1 AND is_available = TRUE', [robotId]);
    if (robot.rows.length === 0) return res.json({ success: false, error: 'Робот не найден' });
    
    const player = await getPlayer(userId);
    if (!player) return res.json({ success: false, error: 'Игрок не найден' });
    
    const price = robot.rows[0].price;
    if (player.balance < price) return res.json({ success: false, error: 'Недостаточно монет' });
    
    await pool.query('UPDATE players SET balance = balance - $1 WHERE user_id = $2', [price, userId]);
    await pool.query(`
        INSERT INTO user_robots (user_id, robot_id, name, avatar, price, income) 
        VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, robotId, robot.rows[0].name, robot.rows[0].avatar, price, robot.rows[0].income]);
    await pool.query('UPDATE market_slaves SET is_available = FALSE WHERE id = $1', [robotId]);
    
    res.json({ success: true });
});

app.post('/api/sellSlave', async (req, res) => {
    const { userId, robotId, price } = req.body;
    const robot = await pool.query('SELECT * FROM user_robots WHERE id = $1 AND user_id = $2', [robotId, userId]);
    if (robot.rows.length === 0) return res.json({ success: false, error: 'Робот не найден' });
    
    await pool.query('UPDATE user_robots SET is_for_sale = TRUE, sale_price = $1 WHERE id = $2', [price, robotId]);
    res.json({ success: true });
});

app.post('/api/collectIncome', async (req, res) => {
    const { userId } = req.body;
    const robots = await pool.query('SELECT * FROM user_robots WHERE user_id = $1', [userId]);
    const totalIncome = robots.rows.reduce((sum, r) => sum + (r.income || 0), 0);
    
    await pool.query('UPDATE players SET balance = balance + $1 WHERE user_id = $2', [totalIncome, userId]);
    await pool.query('UPDATE players SET last_collect = NOW() WHERE user_id = $1', [userId]);
    
    res.json({ success: true, collected: totalIncome });
});

app.post('/api/createPlayer', async (req, res) => {
    const { user_id, first_name, last_name } = req.body;
    await pool.query(
        `INSERT INTO players (user_id, first_name, last_name, balance, slaves) 
         VALUES ($1, $2, $3, 1000, 0) 
         ON CONFLICT (user_id) DO UPDATE SET first_name = $2, last_name = $3`,
        [user_id, first_name, last_name]
    );
    const player = await getPlayer(user_id);
    res.json({ success: true, player });
});

app.post('/api/updatePlayer', async (req, res) => {
    const { userId, data } = req.body;
    await pool.query(
        `UPDATE players SET balance = $1, slaves = $2, slaves_data = $3, last_collect = $4 WHERE user_id = $5`,
        [data.balance, data.slaves, JSON.stringify(data.slaves_data || []), data.last_collect, userId]
    );
    res.json({ success: true });
});

app.get('/api/top/players', async (req, res) => {
    const result = await pool.query(`
        SELECT user_id, first_name, last_name, balance, 
               (SELECT COUNT(*) FROM user_robots WHERE user_id = players.user_id) as robots
        FROM players 
        WHERE is_banned = FALSE 
        ORDER BY balance DESC 
        LIMIT 50
    `);
    res.json({ players: result.rows });
});

app.get('/api/clans', async (req, res) => {
    const result = await pool.query('SELECT * FROM clans ORDER BY members DESC');
    res.json({ clans: result.rows });
});

app.post('/api/joinClan', async (req, res) => {
    const { userId, clanId } = req.body;
    await pool.query('UPDATE players SET clan_id = $1 WHERE user_id = $2', [clanId, userId]);
    res.json({ success: true });
});

app.post('/api/leaveClan', async (req, res) => {
    const { userId } = req.body;
    await pool.query('UPDATE players SET clan_id = NULL WHERE user_id = $1', [userId]);
    res.json({ success: true });
});

// ==================== ЗАПУСК ====================
async function start() {
    try {
        await initDB();
        console.log('✅ База данных готова');
        
        app.listen(PORT, () => {
            console.log(`✅ Сервер запущен на порту ${PORT}`);
            console.log(`✅ Мини-апп доступен по адресу: http://localhost:${PORT}`);
            console.log(`✅ VK бот запущен, группа: https://vk.com/club${GROUP_ID}`);
        });
        
        vk.updates.on('message_new', hearManager.middleware);
        await vk.updates.startPolling();
        
    } catch (e) {
        console.error('❌ Ошибка запуска:', e);
        process.exit(1);
    }
}

start();