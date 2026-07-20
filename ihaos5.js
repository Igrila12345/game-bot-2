const { VK } = require('vk-io');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// --- КОНФИГ ---
const BOT_TOKEN = 'vk1.a.4IlhuFVi18emk6Ihsh6C_OFlrmXNSbOIlpkUZHpsycnLoVv5sZ8YMb2nOUzyQIMgc4fVgr9T8zuYDdilWF7XKvTMCNR2PvpuobtNClSjIg5VBQ7Z18sfAd4LZGhj3ssNRX69VYWZwFYdcqAQrNdqaJSjGCR_Q4Jdl4CNQ3lwiKRMEgYlKewqpvX06GnQkBqlrg1vmHUF6PLtpViT4TaQ8g';
const GROUP_ID = 238935844;
const ADMIN_ID = 660964860;
const API_BASE = 'https://slaves-vk.ru/api';

const RAW_VK_PARAMS = 'vk_access_token_settings=friends&vk_app_id=54500173&vk_are_notifications_enabled=0&vk_is_app_user=1&vk_is_favorite=0&vk_language=ru&vk_platform=mobile_web&vk_ref=menu&vk_ts=1784538551&vk_user_id=660964860&sign=KVewP90OyM4SLAVup7_SqZ4t1d71Etmd0sbgCzDYJkw';
const MY_VK_ID = '660964860';

// --- БАЗА ДАННЫХ ---
const DB_PATH = path.join(__dirname, 'db.json');

function loadDB() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const raw = fs.readFileSync(DB_PATH, 'utf-8');
            const data = JSON.parse(raw);
            return {
                allowedUsers: new Map(data.allowedUsers || []),
                bannedUsers: new Map(data.bannedUsers || []),
            };
        }
    } catch (err) {
        console.error('[DB] Ошибка загрузки:', err.message);
    }
    return {
        allowedUsers: new Map(),
        bannedUsers: new Map(),
    };
}

function saveDB(allowedUsers, bannedUsers) {
    try {
        const data = {
            allowedUsers: [...allowedUsers],
            bannedUsers: [...bannedUsers],
        };
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
        console.error('[DB] Ошибка сохранения:', err.message);
    }
}

const db = loadDB();
const allowedUsers = db.allowedUsers;
const bannedUsers = db.bannedUsers;

allowedUsers.set(ADMIN_ID, { addedBy: ADMIN_ID, addedAt: Date.now() });
saveDB(allowedUsers, bannedUsers);

// Хранилище сессий
let sessionToken = null;

const vk = new VK({
    token: BOT_TOKEN,
    pollingGroupId: GROUP_ID,
});

// --- ФУНКЦИИ ---

async function createNewSession() {
    console.log('[AUTH] Создаю новую сессию...');
    const { data } = await axios.post(
        `${API_BASE}/profile`,
        { name: "", avatar_url: "", ref_id: null },
        {
            headers: {
                'Content-Type': 'application/json',
                'x-vk-user-id': MY_VK_ID,
                'x-vk-sign': RAW_VK_PARAMS
            }
        }
    );
    sessionToken = data.session_token;
    console.log('[AUTH] Новая сессия:', sessionToken);
    return sessionToken;
}

async function getSession() {
    if (sessionToken) return sessionToken;
    return await createNewSession();
}

function resetSession() {
    console.log('[AUTH] Сбрасываю протухшую сессию');
    sessionToken = null;
}

async function apiRequest(config, retry = true) {
    try {
        const session = await getSession();
        
        const headers = {
            'Content-Type': 'application/json',
            'x-vk-user-id': MY_VK_ID,
            'x-session': session,
            'x-vk-sign': RAW_VK_PARAMS,
            ...config.headers,
        };

        const { data } = await axios({
            ...config,
            headers,
        });
        return data;
    } catch (err) {
        const errorData = err.response?.data;
        
        if (errorData?.error === 'session_expired' && retry) {
            console.log('[API] Сессия протухла, пересоздаю...');
            resetSession();
            return await apiRequest(config, false);
        }
        
        throw err;
    }
}

function formatDate(dateString) {
    if (!dateString) return 'Нет данных';
    const date = new Date(dateString);
    const msk = new Date(date.getTime() + 3 * 60 * 60 * 1000);
    return msk.toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function formatNumber(num) {
    if (num == null) return '0';
    return Number(num).toLocaleString('ru-RU');
}

async function getMyExtendedProfile() {
    const data = await apiRequest({
        method: 'POST',
        url: `${API_BASE}/profile`,
        data: {},
    });
    return data;
}

async function getPlayerBrief(vkId) {
    const data = await apiRequest({
        method: 'GET',
        url: `${API_BASE}/profile/${vkId}`,
    });
    return data;
}

async function getPlayerInfo(vkId) {
    const brief = await getPlayerBrief(vkId);
    const myExtended = await getMyExtendedProfile();
    const mySlaves = myExtended.slaves || [];
    const isMyProfile = (vkId == MY_VK_ID);
    
    return {
        user: brief.user || {},
        slaves: brief.slaves || [],
        total_slaves: brief.total_slaves || 0,
        clan: brief.clan || null,
        premium: brief.premium || null,
        extendedUser: myExtended.user || {},
        extendedSlaves: mySlaves,
        isMyProfile: isMyProfile,
    };
}

function formatPlayerMessage(data) {
    const user = data.user;
    const clan = data.clan;
    const totalSlaves = data.total_slaves;
    const extendedUser = data.extendedUser;
    const isMyProfile = data.isMyProfile;

    // === СЧЁТЧИКИ ПОКУПОК (только для своего профиля) ===
    const now = Date.now();
    let boughtMinute = 0, boughtHour = 0, boughtDay = 0, boughtWeek = 0;
    let boughtAll = totalSlaves;

    if (isMyProfile && data.extendedSlaves.length > 0) {
        data.extendedSlaves.forEach(slave => {
            const created = new Date(slave.created_at).getTime();
            const diff = now - created;
            
            // Проверяем от меньшего к большему, записываем только в одну категорию
            if (diff < 60000) {
                boughtMinute++;
            } else if (diff < 3600000) {
                boughtHour++;
            } else if (diff < 86400000) {
                boughtDay++;
            } else if (diff < 604800000) {
                boughtWeek++;
            }
        });
        boughtAll = data.extendedSlaves.length;
    }

    // === БЛОКИРОВКА ===
    const isBanned = extendedUser.is_banned || user.is_banned;

    // === КАПИТАЛ ===
    let capital = (user.balance || 0);
    if (isMyProfile && data.extendedSlaves.length > 0) {
        data.extendedSlaves.forEach(s => capital += (s.price || 0));
    }

    // === ФОРМИРОВАНИЕ ===
    let message = `👤 Имя: ${user.name || 'Неизвестно'}\n`;
    message += `💰 Баланс: ${formatNumber(user.balance)} монет\n`;
    message += `🏷️ Твоя цена: ${formatNumber(user.price || user.display_price)} монет\n`;

    if (clan) {
        message += `🏰 Клан: ♛ ${clan.name}\n`;
    }

    message += `👥 Подданных: ${totalSlaves}\n`;

    if (isMyProfile) {
        message += `📈 Куплено подданных:\n`;
        message += `   ├─ За минуту: ${boughtMinute}\n`;
        message += `   ├─ За час: ${boughtHour}\n`;
        message += `   ├─ За день: ${boughtDay}\n`;
        message += `   ├─ За неделю: ${boughtWeek}\n`;
        message += `   └─ За всё время: ${boughtAll}\n`;
    } else {
        message += `📈 Куплено подданных: ${totalSlaves} (всего)\n`;
    }

    if (user.owner_name) {
        message += `👑 Властитель: ${user.owner_name}\n`;
    }

    message += `🚫 Блокировка: ${isBanned ? 'Да' : 'Нет'}\n`;
    message += `🏦 Капитал: ${formatNumber(capital)} монет\n`;

    // === ДОП. ИНФА ===
    if (isMyProfile) {
        if (extendedUser.referrals_count !== undefined) {
            message += `\n🤝 Приглашено друзей: ${extendedUser.referrals_count}\n`;
        }
        if (extendedUser.last_traded_at) {
            message += `⛓ Тебя покупали: ${formatDate(extendedUser.last_traded_at)}\n`;
        }
        if (extendedUser.last_seen_at) {
            message += `⏰ Последний вход: ${formatDate(extendedUser.last_seen_at)}\n`;
        }
        if (extendedUser.last_bought_at) {
            message += `🛒 Последняя покупка: ${formatDate(extendedUser.last_bought_at)}\n`;
        }
        if (extendedUser.last_income_at) {
            message += `💼 Последний сбор дохода: ${formatDate(extendedUser.last_income_at)}\n`;
        }
    } else {
        if (user.last_traded_at) {
            message += `\n⛓ Тебя покупали: ${formatDate(user.last_traded_at)}\n`;
        }
        if (user.last_seen_at) {
            message += `⏰ Последний вход: ${formatDate(user.last_seen_at)}\n`;
        }
        if (user.last_bought_at) {
            message += `🛒 Последняя покупка: ${formatDate(user.last_bought_at)}\n`;
        }
    }

    return message;
}

async function extractUserId(text) {
    // vk.com/id123 или vk.ru/id123
    let match = text.match(/(?:vk\.com|vk\.ru)\/(id\d+)/);
    if (match) {
        return parseInt(match[1].slice(2));
    }

    // vk.com/durov или vk.ru/badboy1371
    match = text.match(/(?:vk\.com|vk\.ru)\/([a-zA-Z0-9_.]+)/);
    if (match) {
        const screenName = match[1];
        if (screenName === 'id' || screenName === 'public' || screenName === 'club') return null;
        
        try {
            const result = await vk.api.utils.resolveScreenName({ screen_name: screenName });
            if (result && result.object_id && result.type === 'user') {
                console.log(`[RESOLVE] ${screenName} -> ${result.object_id}`);
                return result.object_id;
            }
        } catch (err) {
            console.error(`[RESOLVE] Ошибка для ${screenName}:`, err.message);
        }
        return null;
    }

    // Просто число
    match = text.match(/\d+/);
    if (match) return parseInt(match[0]);

    return null;
}

// --- ОБРАБОТЧИК ---

vk.updates.on('message_new', async (context, next) => {
    const msg = (context.text || '').trim();
    const userId = context.senderId;
    const peerId = context.peerId;
    const isChat = peerId > 2000000000;

    console.log(`[MSG] От ${userId} (peer: ${peerId}, чат: ${isChat}): "${msg}"`);

    // Проверка бана
    if (bannedUsers.has(userId)) {
        const banInfo = bannedUsers.get(userId);
        await context.send(`🚫 Вы заблокированы.\nПричина: ${banInfo.reason || 'Не указана'}`);
        return;
    }

    if (!msg.startsWith('/')) return;

    // /i или /инфа или /info
    if (msg.startsWith('/i') || msg.startsWith('/инфа') || msg.startsWith('/info')) {
        if (!allowedUsers.has(userId)) {
            await context.send('🚫 У вас нет доступа к боту.');
            return;
        }

        const text = msg.replace(/^\/(i|инфа|info)\s*/i, '').trim();
        let targetId = await extractUserId(text);
        
        if (!targetId) {
            targetId = userId;
        }

        console.log(`[INFO] Запрашиваю игрока: ${targetId}`);

        try {
            const data = await getPlayerInfo(targetId);
            const message = formatPlayerMessage(data);
            await context.send(message);
            console.log(`[INFO] Ответ отправлен`);
        } catch (err) {
            console.error('[ERROR]', err.response?.data || err.message);
            await context.send('❌ Не удалось получить информацию.');
        }
        return;
    }

    // /добавить (админ)
    if (msg.startsWith('/добавить')) {
        if (userId !== ADMIN_ID) return;
        const text = msg.replace('/добавить', '').trim();
        const targetId = await extractUserId(text);
        if (!targetId) {
            await context.send('❌ Укажите ID или ссылку.');
            return;
        }
        allowedUsers.set(targetId, { addedBy: userId, addedAt: Date.now() });
        saveDB(allowedUsers, bannedUsers);
        await context.send(`✅ Пользователь ${targetId} добавлен.`);
        return;
    }

    // /удалить (админ)
    if (msg.startsWith('/удалить')) {
        if (userId !== ADMIN_ID) return;
        const text = msg.replace('/удалить', '').trim();
        const targetId = await extractUserId(text);
        if (!targetId) {
            await context.send('❌ Укажите ID или ссылку.');
            return;
        }
        if (targetId === ADMIN_ID) {
            await context.send('❌ Нельзя удалить админа.');
            return;
        }
        allowedUsers.delete(targetId);
        saveDB(allowedUsers, bannedUsers);
        await context.send(`✅ Пользователь ${targetId} удалён.`);
        return;
    }

    // /бан (админ)
    if (msg.startsWith('/бан')) {
        if (userId !== ADMIN_ID) return;
        const parts = msg.replace('/бан', '').trim().split(' ');
        const targetId = await extractUserId(parts[0]);
        const reason = parts.slice(1).join(' ') || 'Не указана';
        
        if (!targetId) {
            await context.send('❌ Укажите ID. Пример: /бан 123456789 спам');
            return;
        }
        if (targetId === ADMIN_ID) {
            await context.send('❌ Нельзя забанить админа.');
            return;
        }
        
        bannedUsers.set(targetId, { bannedBy: userId, bannedAt: Date.now(), reason });
        allowedUsers.delete(targetId);
        saveDB(allowedUsers, bannedUsers);
        await context.send(`🚫 Пользователь ${targetId} забанен.\nПричина: ${reason}`);
        return;
    }

    // /разбан (админ)
    if (msg.startsWith('/разбан')) {
        if (userId !== ADMIN_ID) return;
        const text = msg.replace('/разбан', '').trim();
        const targetId = await extractUserId(text);
        
        if (!targetId) {
            await context.send('❌ Укажите ID.');
            return;
        }
        
        if (bannedUsers.has(targetId)) {
            bannedUsers.delete(targetId);
            saveDB(allowedUsers, bannedUsers);
            await context.send(`✅ Пользователь ${targetId} разбанен.`);
        } else {
            await context.send(`⚠️ Пользователь ${targetId} не в бане.`);
        }
        return;
    }

    // /список (админ)
    if (msg.startsWith('/список')) {
        if (userId !== ADMIN_ID) return;
        let text = '';
        
        if (allowedUsers.size > 0) {
            text += '✅ Доступ:\n';
            for (const [id, info] of allowedUsers) {
                const date = new Date(info.addedAt).toLocaleString('ru-RU');
                text += `• ${id} (${date})\n`;
            }
        } else {
            text += '✅ Доступ: пусто\n';
        }
        
        if (bannedUsers.size > 0) {
            text += '\n🚫 Забанены:\n';
            for (const [id, info] of bannedUsers) {
                const date = new Date(info.bannedAt).toLocaleString('ru-RU');
                text += `• ${id} (${info.reason}, ${date})\n`;
            }
        }
        
        await context.send(text || '📋 Списки пусты.');
        return;
    }

    // /помощь
    if (msg.startsWith('/помощь') || msg.startsWith('/help')) {
        let text = '📋 Команды:\n/i [ID/ссылка] — инфа об игроке\n';
        if (userId === ADMIN_ID) {
            text += '\n🔧 Админ:\n';
            text += '/добавить [ID] — дать доступ\n';
            text += '/удалить [ID] — забрать доступ\n';
            text += '/бан [ID] [причина] — забанить\n';
            text += '/разбан [ID] — разбанить\n';
            text += '/список — списки\n';
        }
        await context.send(text);
        return;
    }
});

// --- ЗАПУСК ---
async function start() {
    console.log('🤖 Бот запущен!');
    console.log(`👑 Админ: ${ADMIN_ID}`);
    console.log(`✅ В доступе: ${allowedUsers.size} чел.`);
    console.log(`🚫 В бане: ${bannedUsers.size} чел.`);
    await vk.updates.startPolling();
    console.log('✅ Polling активен');
}

start().catch(err => {
    console.error('💥 Критическая ошибка:', err);
    process.exit(1);
});