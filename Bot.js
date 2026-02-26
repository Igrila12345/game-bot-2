// bot.js - ПОЛНЫЙ БОТ С АДМИН-КОМАНДАМИ И /INFO
const { VK } = require('vk-io');
const fetch = require('node-fetch');

const config = {
    token: 'vk1.a.XAhDjxvWUcrO5q6xzs-wiIWObToSVxKXB6QQ5UJzI8gpicZs98VR8eky7F4YmScRkbHxvvfWwTmAl3Iw21QRuTQna1DsmwVJGqhmjGFetmJQwAR-O0iJhTr25YG07uzEOTAOsd3cinK_GWK8SQzXMwS-RnhQjC8drM0Yd8sGBLr1F725agNzLV-hm253ElYiiT59zK5e96sj5ZNEwrpwgQ',
    groupId: 231991465,
    adminId: 660964860, // Только ваш ID
    appUrl: 'https://vk.com/app54367872'
};

const vk = new VK({ token: config.token });

// Хранилище данных (в реальном проекте - БД или VK Storage API)
let marketOpen = true;
let bannedUsers = [];
let clans = [];

// Функция для получения данных игрока из VK Storage
async function getPlayerData(userId) {
    try {
        // Здесь нужно использовать VK Storage API
        // Для теста возвращаем заглушку
        return {
            balance: 1000,
            slaves: 5,
            clan: null
        };
    } catch (e) {
        return null;
    }
}

// Функция для сохранения данных игрока
async function savePlayerData(userId, data) {
    try {
        // Здесь нужно использовать VK Storage API
        console.log(`Сохранение данных для ${userId}:`, data);
        return true;
    } catch (e) {
        return false;
    }
}

// Обработка команд
vk.updates.on('message_new', async (ctx) => {
    const { message, senderId } = ctx;
    const text = message.text?.trim() || '';
    const args = text.split(' ');
    const command = args[0].toLowerCase();

    console.log(`[${senderId}] ${text}`);

    // Проверка на бан
    if (bannedUsers.includes(senderId) && senderId !== config.adminId) {
        return;
    }

    // ===== ОБЩИЕ КОМАНДЫ =====
    
    // /info @user - информация об игроке
    if (command === '/info' || command === '/инфо') {
        try {
            let targetId = senderId;
            
            // Парсим упоминание
            if (args[1]) {
                const mention = args[1].match(/\[(?:id|club)(\d+)\|/);
                if (mention) {
                    targetId = parseInt(mention[1]);
                }
            }
            
            // Получаем информацию о пользователе
            const users = await vk.api.users.get({
                user_ids: targetId,
                fields: 'photo_200'
            });
            
            if (!users || users.length === 0) {
                await ctx.send('❌ Пользователь не найден');
                return;
            }
            
            const user = users[0];
            const playerData = await getPlayerData(targetId);
            
            let clanName = 'Нет';
            if (playerData?.clan) {
                const clan = clans.find(c => c.id === playerData.clan);
                clanName = clan ? clan.name : 'Нет';
            }
            
            await ctx.send(`
👤 Информация об игроке:
📝 ${user.first_name} ${user.last_name}
🆔 ID: ${targetId}

👥 Рабов: ${playerData?.slaves || 0}
💰 Баланс: ${playerData?.balance || 1000}
⚔️ Клан: ${clanName}

🎮 Играть: ${config.appUrl}
            `);
        } catch (e) {
            console.error('Ошибка в /info:', e);
            await ctx.send('❌ Ошибка при получении информации');
        }
    }
    
    // ===== АДМИН-КОМАНДЫ (только для adminId) =====
    else if (senderId === config.adminId) {
        
        // /market open/close - управление рынком
        if (command === '/market') {
            if (args[1] === 'open') {
                marketOpen = true;
                await ctx.send('✅ Рынок открыт');
            } else if (args[1] === 'close') {
                marketOpen = false;
                await ctx.send('🔴 Рынок закрыт');
            } else {
                await ctx.send(`Текущий статус: ${marketOpen ? '🟢 Открыт' : '🔴 Закрыт'}`);
            }
        }
        
        // /addslaves [количество] - добавить рабов на рынок
        else if (command === '/addslaves' || command === '/добавитьрабов') {
            const count = parseInt(args[1]);
            if (isNaN(count) || count < 1) {
                await ctx.send('❌ Укажите количество (например: /addslaves 100)');
                return;
            }
            // Здесь логика добавления рабов
            await ctx.send(`✅ Добавлено ${count} рабов на рынок`);
        }
        
        // /ban @user - забанить игрока
        else if (command === '/ban' || command === '/бан') {
            const mention = args[1]?.match(/\[(?:id|club)(\d+)\|/);
            if (!mention) {
                await ctx.send('❌ Укажите пользователя (например: /ban @durov)');
                return;
            }
            
            const userId = parseInt(mention[1]);
            if (!bannedUsers.includes(userId)) {
                bannedUsers.push(userId);
                await ctx.send(`✅ Пользователь id${userId} забанен`);
            } else {
                await ctx.send('❌ Пользователь уже в бане');
            }
        }
        
        // /unban @user - разбанить игрока
        else if (command === '/unban' || command === '/разбан') {
            const mention = args[1]?.match(/\[(?:id|club)(\d+)\|/);
            if (!mention) {
                await ctx.send('❌ Укажите пользователя');
                return;
            }
            
            const userId = parseInt(mention[1]);
            bannedUsers = bannedUsers.filter(id => id !== userId);
            await ctx.send(`✅ Пользователь id${userId} разбанен`);
        }
        
        // /addbalance @user [сумма] - начислить баланс
        else if (command === '/addbalance' || command === '/добавитьбаланс') {
            const mention = args[1]?.match(/\[(?:id|club)(\d+)\|/);
            if (!mention) {
                await ctx.send('❌ Укажите пользователя');
                return;
            }
            
            const userId = parseInt(mention[1]);
            const amount = parseInt(args[2]);
            
            if (isNaN(amount) || amount < 1) {
                await ctx.send('❌ Укажите сумму');
                return;
            }
            
            const playerData = await getPlayerData(userId) || { balance: 1000 };
            playerData.balance += amount;
            await savePlayerData(userId, playerData);
            
            await ctx.send(`✅ Пользователю id${userId} начислено ${amount} монет`);
        }
        
        // /removebalance @user [сумма] - снять баланс
        else if (command === '/removebalance' || command === '/снятьбаланс') {
            const mention = args[1]?.match(/\[(?:id|club)(\d+)\|/);
            if (!mention) {
                await ctx.send('❌ Укажите пользователя');
                return;
            }
            
            const userId = parseInt(mention[1]);
            const amount = parseInt(args[2]);
            
            if (isNaN(amount) || amount < 1) {
                await ctx.send('❌ Укажите сумму');
                return;
            }
            
            const playerData = await getPlayerData(userId) || { balance: 1000 };
            playerData.balance = Math.max(0, playerData.balance - amount);
            await savePlayerData(userId, playerData);
            
            await ctx.send(`✅ У пользователя id${userId} снято ${amount} монет`);
        }
        
        // /addslavesuser @user [количество] - начислить рабов
        else if (command === '/addslavesuser' || command === '/добавитьрабовпользователю') {
            const mention = args[1]?.match(/\[(?:id|club)(\d+)\|/);
            if (!mention) {
                await ctx.send('❌ Укажите пользователя');
                return;
            }
            
            const userId = parseInt(mention[1]);
            const count = parseInt(args[2]);
            
            if (isNaN(count) || count < 1) {
                await ctx.send('❌ Укажите количество');
                return;
            }
            
            // Здесь логика добавления рабов пользователю
            await ctx.send(`✅ Пользователю id${userId} добавлено ${count} рабов`);
        }
        
        // /removeslaves @user [количество] - снять рабов
        else if (command === '/removeslaves' || command === '/снятьрабов') {
            const mention = args[1]?.match(/\[(?:id|club)(\d+)\|/);
            if (!mention) {
                await ctx.send('❌ Укажите пользователя');
                return;
            }
            
            const userId = parseInt(mention[1]);
            const count = parseInt(args[2]);
            
            if (isNaN(count) || count < 1) {
                await ctx.send('❌ Укажите количество');
                return;
            }
            
            // Здесь логика снятия рабов
            await ctx.send(`✅ У пользователя id${userId} снято ${count} рабов`);
        }
        
        // /createclan [название] - создать клан
        else if (command === '/createclan' || command === '/создатьклан') {
            const clanName = args.slice(1).join(' ');
            if (!clanName) {
                await ctx.send('❌ Укажите название клана');
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
            await ctx.send(`✅ Клан "${clanName}" создан!`);
        }
        
        // /deleteclan [название] - удалить клан
        else if (command === '/deleteclan' || command === '/удалитьклан') {
            const clanName = args.slice(1).join(' ');
            clans = clans.filter(c => c.name.toLowerCase() !== clanName.toLowerCase());
            await ctx.send(`✅ Клан удален`);
        }
        
        // /help админа
        else if (command === '/adminhelp') {
            await ctx.send(`
⚡ АДМИН-КОМАНДЫ:

📊 Рынок:
/market open - открыть
/market close - закрыть
/addslaves 100 - добавить рабов

👤 Управление игроками:
/ban @user - забанить
/unban @user - разбанить
/addbalance @user 1000 - начислить
/removebalance @user 500 - снять
/addslavesuser @user 10 - добавить рабов
/removeslaves @user 5 - снять рабов

⚔️ Кланы:
/createclan Название - создать
/deleteclan Название - удалить
            `);
        }
    }
    
    // Помощь для обычных пользователей
    else if (command === '/help' || command === '/start') {
        await ctx.send(`
🤖 КОМАНДЫ БОТА:

👤 /info @user - информация об игроке
🎮 Играть: ${config.appUrl}

⚔️ Кланы создаются в игре через кнопку "Привязать сообщество"
        `);
    }
});

// Запуск бота
async function start() {
    try {
        await vk.updates.start();
        console.log('✅ Бот успешно запущен!');
        console.log(`👤 Admin ID: ${config.adminId}`);
        console.log(`📱 Группа: https://vk.com/club${config.groupId}`);
    } catch (e) {
        console.error('❌ Ошибка запуска:', e);
    }
}

start();
