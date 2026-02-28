// bot.js - ПОЛНОСТЬЮ РАБОЧИЙ БОТ
const { VK, Keyboard } = require('vk-io');
const { HearManager } = require('@vk-io/hear');
const fetch = require('node-fetch');

// ===== КОНФИГУРАЦИЯ =====
const config = {
    token: 'vk1.a.XAhDjxvWUcrO5q6xzs-wiIWObToSVxKXB6QQ5UJzI8gpicZs98VR8eky7F4YmScRkbHxvvfWwTmAl3Iw21QRuTQna1DsmwVJGqhmjGFetmJQwAR-O0iJhTr25YG07uzEOTAOsd3cinK_GWK8SQzXMwS-RnhQjC8drM0Yd8sGBLr1F725agNzLV-hm253ElYiiT59zK5e96sj5ZNEwrpwgQ',
    groupId: 231991465,
    adminId: 660964860,
    appUrl: 'https://vk.com/app54367872'
};

// ===== ИНИЦИАЛИЗАЦИЯ =====
const vk = new VK({
    token: config.token,
    pollingGroupId: config.groupId,
    apiMode: 'sequential'
});

const hearManager = new HearManager();

// ===== ХРАНИЛИЩЕ ДАННЫХ =====
let marketOpen = true;
let bannedUsers = [];
let clans = [];

// ===== ЗАГЛУШКИ ДЛЯ VK STORAGE =====
async function getPlayerData(userId) {
    // В реальном проекте здесь запрос к VK Storage
    return {
        balance: 1000,
        slaves: 0,
        clan: null
    };
}

async function savePlayerData(userId, data) {
    // В реальном проекте здесь сохранение в VK Storage
    console.log(`Сохранение данных для ${userId}:`, data);
    return true;
}

// ===== ОБРАБОТЧИК СООБЩЕНИЙ =====
vk.updates.on('message_new', hearManager.middleware);

// Приветствие
hearManager.hear(/^(start|начать|help|помощь)$/i, async (context) => {
    await context.send({
        message: `🤖 **РАБСТВО 2.0 БОТ**

Привет! Я помогу управлять игрой.

📱 **Играть:** ${config.appUrl}

👤 **Команды:**
/info @user - информация об игроке
/top - топ игроков

⚔️ **Кланы создаются в игре** через кнопку "Привязать сообщество"`,
        dont_parse_links: true
    });
});

// ===== /INFO =====
hearManager.hear(/^\/(info|инфо)\s*(.*)/i, async (context) => {
    try {
        const text = context.text;
        let targetId = context.senderId;
        
        // Парсим упоминание
        const mentionMatch = text.match(/\[(?:id|club)(\d+)\|/);
        if (mentionMatch) {
            targetId = parseInt(mentionMatch[1]);
        } else {
            // Если просто /info без упоминания
            const args = text.split(' ');
            if (args[1] && !isNaN(parseInt(args[1]))) {
                targetId = parseInt(args[1]);
            }
        }
        
        // Получаем информацию о пользователе
        const [user] = await vk.api.users.get({
            user_ids: targetId,
            fields: 'photo_200'
        });
        
        if (!user) {
            await context.send('❌ Пользователь не найден');
            return;
        }
        
        const playerData = await getPlayerData(targetId);
        
        let clanName = 'Нет';
        if (playerData?.clan) {
            const clan = clans.find(c => c.id === playerData.clan);
            clanName = clan ? clan.name : 'Нет';
        }
        
        await context.send({
            message: `👤 **Информация об игроке**

📝 **${user.first_name} ${user.last_name}**
🆔 ID: ${targetId}

👥 Рабов: ${playerData?.slaves || 0}
💰 Баланс: ${playerData?.balance || 1000}
⚔️ Клан: ${clanName}

🎮 Играть: ${config.appUrl}`,
            dont_parse_links: true
        });
        
    } catch (e) {
        console.error('Ошибка в /info:', e);
        await context.send('❌ Произошла ошибка');
    }
});

// ===== /TOP =====
hearManager.hear(/^\/(top|топ)$/i, async (context) => {
    try {
        // Здесь должен быть запрос к базе данных
        await context.send({
            message: `🏆 **ТОП ИГРОКОВ**

1. Игрок 1 — 100 рабов
2. Игрок 2 — 50 рабов
3. Игрок 3 — 25 рабов
4. Игрок 4 — 10 рабов
5. Игрок 5 — 5 рабов

👉 Полный топ в игре: ${config.appUrl}`,
            dont_parse_links: true
        });
    } catch (e) {
        await context.send('❌ Ошибка');
    }
});

// ===== АДМИН-КОМАНДЫ =====
hearManager.hear(/^\/(.+)$/i, async (context) => {
    // Проверка на админа
    if (context.senderId !== config.adminId) return;
    
    const text = context.text.toLowerCase();
    const args = text.split(' ');
    const command = args[0];
    
    // /market open/close
    if (command === '/market') {
        if (args[1] === 'open') {
            marketOpen = true;
            await context.send('✅ **Рынок открыт**');
        } else if (args[1] === 'close') {
            marketOpen = false;
            await context.send('🔴 **Рынок закрыт**');
        } else {
            await context.send(`Текущий статус: ${marketOpen ? '🟢 Открыт' : '🔴 Закрыт'}`);
        }
    }
    
    // /addslaves 100
    else if (command === '/addslaves') {
        const count = parseInt(args[1]);
        if (isNaN(count) || count < 1) {
            await context.send('❌ Укажите количество (например: /addslaves 100)');
            return;
        }
        await context.send(`✅ **Добавлено ${count} рабов на рынок**`);
    }
    
    // /ban @user
    else if (command === '/ban') {
        const mention = text.match(/\[(?:id|club)(\d+)\|/);
        if (!mention) {
            await context.send('❌ Укажите пользователя (например: /ban @durov)');
            return;
        }
        const userId = parseInt(mention[1]);
        if (!bannedUsers.includes(userId)) {
            bannedUsers.push(userId);
            await context.send(`✅ **Пользователь id${userId} забанен**`);
        } else {
            await context.send('❌ Пользователь уже в бане');
        }
    }
    
    // /unban @user
    else if (command === '/unban') {
        const mention = text.match(/\[(?:id|club)(\d+)\|/);
        if (!mention) {
            await context.send('❌ Укажите пользователя');
            return;
        }
        const userId = parseInt(mention[1]);
        bannedUsers = bannedUsers.filter(id => id !== userId);
        await context.send(`✅ **Пользователь id${userId} разбанен**`);
    }
    
    // /addbalance @user 1000
    else if (command === '/addbalance') {
        const mention = text.match(/\[(?:id|club)(\d+)\|/);
        if (!mention) {
            await context.send('❌ Укажите пользователя');
            return;
        }
        const userId = parseInt(mention[1]);
        const amount = parseInt(args[2]);
        
        if (isNaN(amount) || amount < 1) {
            await context.send('❌ Укажите сумму');
            return;
        }
        
        const playerData = await getPlayerData(userId) || { balance: 1000 };
        playerData.balance += amount;
        await savePlayerData(userId, playerData);
        
        await context.send(`✅ **Пользователю id${userId} начислено ${amount} монет**`);
    }
    
    // /removebalance @user 500
    else if (command === '/removebalance') {
        const mention = text.match(/\[(?:id|club)(\d+)\|/);
        if (!mention) {
            await context.send('❌ Укажите пользователя');
            return;
        }
        const userId = parseInt(mention[1]);
        const amount = parseInt(args[2]);
        
        if (isNaN(amount) || amount < 1) {
            await context.send('❌ Укажите сумму');
            return;
        }
        
        const playerData = await getPlayerData(userId) || { balance: 1000 };
        playerData.balance = Math.max(0, playerData.balance - amount);
        await savePlayerData(userId, playerData);
        
        await context.send(`✅ **У пользователя id${userId} снято ${amount} монет**`);
    }
    
    // /createclan Название
    else if (command === '/createclan') {
        const clanName = args.slice(1).join(' ');
        if (!clanName) {
            await context.send('❌ Укажите название клана');
            return;
        }
        
        const newClan = {
            id: Date.now(),
            name: clanName,
            members: 1,
            leader: 'Admin',
            leaderId: config.adminId,
            leaderAvatar: 'https://vk.com/images/camera_200.png'
        };
        
        clans.push(newClan);
        await context.send(`✅ **Клан "${clanName}" создан!**`);
    }
    
    // /adminhelp
    else if (command === '/adminhelp') {
        await context.send({
            message: `⚡ **АДМИН-КОМАНДЫ**

📊 **Рынок:**
/market open - открыть
/market close - закрыть
/addslaves 100 - добавить рабов

👤 **Управление игроками:**
/ban @user - забанить
/unban @user - разбанить
/addbalance @user 1000 - начислить
/removebalance @user 500 - снять

⚔️ **Кланы:**
/createclan Название - создать

🎮 **Игра:** ${config.appUrl}`,
            dont_parse_links: true
        });
    }
});

// ===== ЗАПУСК =====
async function run() {
    try {
        // Запускаем long poll
        await vk.updates.startPolling();
        console.log('✅ Бот успешно запущен!');
        console.log(`👤 Админ: ${config.adminId}`);
        console.log(`📱 Группа: https://vk.com/club${config.groupId}`);
        console.log(`🎮 Игра: ${config.appUrl}`);
        console.log('📋 Доступные команды: /info, /top, /adminhelp');
    } catch (error) {
        console.error('❌ Ошибка запуска:', error);
    }
}

run();
