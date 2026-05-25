const axios = require('axios');

// ==================== НАСТРОЙКИ БОТА ====================
const GROUP_TOKEN = 'vk1.a.nb-xMC80eVqc64ncuauRgj-4tpSR2iD_e_ffryiZMSW2L5G_uAkLhHDuAzPT9p3YgY8stbIr2vBttXz4ujhqFKqUyAihH-_wDZ4DMoiGS3V4jYEJhS_SPprEYyAPq-FGcDFkOxRh1HEDGb9oZzP6clXLXg11lfKxKp-HwYQ7e5CIGr_-Xggk0qMpcCOY3Eb__fi2XQPw0AUtLzPVB-62Aw';
const MAIN_ADMIN_ID = 660964860;
const API_VERSION = '5.131';
let LAST_MESSAGE_ID = 0;
// ========================================================

let ACCOUNTS = [];
let VICTIM_VK_ID = 490557254;
let KNOWN_VICTIM_GAME_ID = null;
let ALLOWED_USERS = new Set([MAIN_ADMIN_ID]);

let AUTO_CONTRACT = false;
let AUTO_TRAINING = false;
let AUTO_ATTACK = false;
let contractTimeout = null;
let trainingInterval = null;
let attackInterval = null;
let userState = {};
// userId для уведомлений авто-режимов
let autoNotifyUserId = MAIN_ADMIN_ID;

const gameHeaders = {
    'accept': 'application/json, text/plain, */*',
    'content-type': 'application/json',
    'origin': 'https://kosmo-requiem.ru',
    'referer': 'https://kosmo-requiem.ru/',
    'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36'
};

// --- ОТПРАВКА СООБЩЕНИЯ ---
async function sendMessage(userId, message) {
    try {
        await axios.post('https://api.vk.com/method/messages.send', null, {
            params: {
                access_token: GROUP_TOKEN,
                user_id: userId,
                message: message,
                v: API_VERSION,
                random_id: Math.floor(Math.random() * 100000000)
            }
        });
    } catch (e) {
        console.error('Ошибка отправки:', e.message);
    }
}

// --- ПОЛУЧЕНИЕ СООБЩЕНИЙ ---
async function getMessages() {
    try {
        const res = await axios.get('https://api.vk.com/method/messages.getHistory', {
            params: {
                access_token: GROUP_TOKEN,
                user_id: MAIN_ADMIN_ID,
                count: 20,
                v: API_VERSION
            }
        });
        return res.data.response?.items || [];
    } catch (e) {
        console.error('Ошибка получения сообщений:', e.message);
        return [];
    }
}

// --- АВТОРИЗАЦИЯ В ИГРЕ ---
async function authInGame(account) {
    const data = {
        sign: account.sign,
        user: { id: parseInt(account.vk_user_id), bdate: "17.2", bdate_visibility: 2, timezone: 3 },
        vk_params: {
            vk_access_token_settings: "friends", vk_app_id: "54143871", vk_are_notifications_enabled: "0",
            vk_is_app_user: "1", vk_is_favorite: "0", vk_language: "ru", vk_platform: "mobile_web",
            vk_ref: "catalog_recent", vk_ts: account.vk_ts, vk_user_id: account.vk_user_id, access_token: account.token
        }
    };
    const res = await axios.post('https://api.kosmo-requiem.ru/auth', data, { headers: gameHeaders });
    return res.data.sessionId;
}

// --- ПОИСК ИГРОКА ЧЕРЕЗ РЕЙТИНГ (страницы по 20 игроков) ---
async function findGameIdByRating(vkId, sessionId, notifyUserId) {
    const customHeaders = { ...gameHeaders, 'X-Session-Id': sessionId };
    const limit = 20;
    let page = 1;
    const maxPages = 200; // до 4000 игроков

    while (page <= maxPages) {
        try {
            const res = await axios.get(`https://api.kosmo-requiem.ru/users/rating?page=${page}&limit=${limit}`, { headers: customHeaders });
            const items = res.data?.data || res.data;

            if (!Array.isArray(items) || items.length === 0) break; // конец списка

            const user = items.find(u => String(u.vk_id) === String(vkId));
            if (user) return user.id;

            // Уведомление каждые 10 страниц (каждые 200 игроков)
            if (notifyUserId && page % 10 === 0) {
                await sendMessage(notifyUserId, `🔍 Сканирую рейтинг... стр. ${page} (${page * limit} игроков)`);
            }
        } catch (e) {
            break;
        }
        page++;
    }
    return null;
}

// --- БЫСТРЫЙ ПОИСК ЧЕРЕЗ ATTACKABLE ---
async function findGameId(vkId, sessionId) {
    const customHeaders = { ...gameHeaders, 'X-Session-Id': sessionId };
    for (const filter of ['suitable', 'top']) {
        try {
            const res = await axios.get(`https://api.kosmo-requiem.ru/users/attackable?filter=${filter}`, { headers: customHeaders });
            const items = res.data?.data || res.data;
            if (Array.isArray(items)) {
                const user = items.find(u => String(u.vk_id) === String(vkId));
                if (user) return user.id;
            }
        } catch (e) {}
    }
    return null;
}

// --- ГЛАВНАЯ ФУНКЦИЯ ПОИСКА: attackable → рейтинг ---
async function resolveGameId(vkId, sessionId, notifyUserId) {
    // 1. Быстро через attackable
    const quick = await findGameId(vkId, sessionId);
    if (quick) return quick;

    // 2. Поиск через рейтинг (все игроки)
    if (notifyUserId) await sendMessage(notifyUserId, `🔍 Ищу через рейтинг игроков...`);
    return await findGameIdByRating(vkId, sessionId, notifyUserId);
}

async function findUserByVkId(vkId, sessionId) {
    const customHeaders = { ...gameHeaders, 'X-Session-Id': sessionId };
    for (const filter of ['suitable', 'top']) {
        try {
            const res = await axios.get(`https://api.kosmo-requiem.ru/users/attackable?filter=${filter}`, { headers: customHeaders });
            const items = res.data?.data || res.data;
            if (Array.isArray(items)) {
                const user = items.find(u => String(u.vk_id) === String(vkId));
                if (user) return user;
            }
        } catch (e) {}
    }
    const batchSize = 40;
    for (let currentId = 1; currentId <= 3500; currentId += batchSize) {
        const promises = [];
        for (let i = 0; i < batchSize; i++) {
            const checkId = currentId + i;
            const p = axios.get(`https://api.kosmo-requiem.ru/users/${checkId}`, { headers: customHeaders })
                .then(res => (res.data && Number(res.data.vk_id) === Number(vkId)) ? res.data : null)
                .catch(() => null);
            promises.push(p);
        }
        const results = await Promise.all(promises);
        const found = results.find(r => r !== null);
        if (found) return found;
    }
    return null;
}

// ============================================================
// ВЫПОЛНЕНИЕ ТРЕНИРОВКИ (одна штука для аккаунта)
// type: "assault" | "defensive" | "contract"
// ============================================================
async function doTraining(acc, trainingType) {
    const sess = await authInGame(acc);
    const h = { ...gameHeaders, 'X-Session-Id': sess };

    const before = (await axios.get('https://api.kosmo-requiem.ru/users/me', { headers: h })).data;
    await axios.post('https://api.kosmo-requiem.ru/users/training', { type: trainingType }, { headers: h });
    const after = (await axios.get('https://api.kosmo-requiem.ru/users/me', { headers: h })).data;

    return { before, after };
}

// ============================================================
// АВТО-КОНТРАКТ: start → ждём ends_at → claim → repeat
// ============================================================
async function runContractCycle(notifyUserId) {
    if (!AUTO_CONTRACT) return;
    if (ACCOUNTS.length === 0) return;

    let nextDelay = 30 * 60 * 1000; // дефолт 30 минут

    for (const acc of ACCOUNTS) {
        try {
            const sess = await authInGame(acc);
            const h = { ...gameHeaders, 'X-Session-Id': sess };

            // Получаем текущий контракт — может вернуть пустое тело (нет контракта)
            let contract = null;
            try {
                const cur = await axios.get('https://api.kosmo-requiem.ru/users/contracts/current', { headers: h });
                // Если тело пустое или нет id — контракта нет
                if (cur.data && cur.data.id) {
                    contract = cur.data;
                }
            } catch (e) {
                // 404 или пустой ответ — контракта нет
                contract = null;
            }

            if (contract && contract.can_claim === true) {
                // Собираем контракт
                const profileBefore = await axios.get('https://api.kosmo-requiem.ru/users/me', { headers: h });
                await axios.post('https://api.kosmo-requiem.ru/users/contracts/claim', {}, { headers: h });
                const profileAfter = await axios.get('https://api.kosmo-requiem.ru/users/me', { headers: h });

                const before = profileBefore.data;
                const after = profileAfter.data;
                const moneyGained = (after.money || 0) - (before.money || 0);

                await sendMessage(notifyUserId,
                    `✅ Авто-контракт собран [${acc.vk_user_id}]!\n` +
                    `💰 +${moneyGained}$ | 💰 Баланс: ${after.money}$ | 💪 Сила: ${after.strength}`
                );

                // Запускаем новый контракт
                try {
                    await axios.post('https://api.kosmo-requiem.ru/users/contracts/start', { type: 'balanced' }, { headers: h });
                    await sendMessage(notifyUserId, `🔄 Новый контракт [${acc.vk_user_id}] запущен. Сбор через ~30 мин.`);
                    nextDelay = 30 * 60 * 1000;
                } catch (startErr) {
                    const errMsg = startErr.response?.data?.message || startErr.message;
                    console.log(`[${acc.vk_user_id}] start error:`, errMsg);
                    await sendMessage(notifyUserId, `⚠️ Не удалось запустить контракт [${acc.vk_user_id}]: ${errMsg}`);
                }

            } else if (contract && contract.status === 'in_progress' && contract.ends_at) {
                // Контракт выполняется — ждём до ends_at
                const endsAt = new Date(contract.ends_at).getTime();
                const now = Date.now();
                const waitMs = Math.max(endsAt - now + 5000, 10000); // +5 сек буфер
                const minsLeft = Math.round(waitMs / 60000);
                nextDelay = Math.min(nextDelay, waitMs);
                console.log(`[${acc.vk_user_id}] Контракт выполняется, ждём ${minsLeft} мин.`);
                await sendMessage(notifyUserId, `⏳ Контракт [${acc.vk_user_id}] выполняется. Сбор через ~${minsLeft} мин.`);

            } else {
                // Нет активного контракта — запускаем новый
                try {
                    await axios.post('https://api.kosmo-requiem.ru/users/contracts/start', { type: 'balanced' }, { headers: h });
                    await sendMessage(notifyUserId, `🔄 Контракт [${acc.vk_user_id}] запущен. Сбор через ~30 мин.`);
                    nextDelay = 30 * 60 * 1000;
                } catch (startErr) {
                    const errMsg = startErr.response?.data?.message || startErr.message;
                    console.log(`[${acc.vk_user_id}] start error:`, errMsg);
                    await sendMessage(notifyUserId, `⚠️ Не удалось запустить контракт [${acc.vk_user_id}]: ${errMsg}`);
                }
            }

        } catch (e) {
            console.error(`[${acc.vk_user_id}] contract cycle error:`, e.message);
            await sendMessage(notifyUserId, `❌ Ошибка контракта [${acc.vk_user_id}]: ${e.message}`);
        }
    }

    // Планируем следующую проверку
    if (AUTO_CONTRACT) {
        contractTimeout = setTimeout(() => runContractCycle(notifyUserId), nextDelay);
        console.log(`Следующая проверка контрактов через ${Math.round(nextDelay / 60000)} мин.`);
    }
}

// ============================================================
// АВТО-ТРЕНИРОВКА: каждые 25 минут, тип assault
// ============================================================
async function runTrainingCycle(notifyUserId) {
    if (!AUTO_TRAINING) return;
    if (ACCOUNTS.length === 0) return;

    for (const acc of ACCOUNTS) {
        try {
            const { before, after } = await doTraining(acc, 'assault');
            const strengthGain = (after.strength || 0) - (before.strength || 0);
            await sendMessage(notifyUserId,
                `🏋️ Авто-тренировка [${acc.vk_user_id}]!\n` +
                `✅ Выполнена (тип: assault)\n` +
                `💪 +${strengthGain} силы | ${before.strength} → ${after.strength}\n` +
                `💰 ${after.money}$`
            );
        } catch (e) {
            const errMsg = e.response?.data?.message || e.message;
            console.log(`[${acc.vk_user_id}] training error:`, errMsg);
            await sendMessage(notifyUserId, `❌ Авто-тренировка [${acc.vk_user_id}]: ${errMsg}`);
        }
    }
}

// --- ФОРМАТИРОВАНИЕ ПРОФИЛЯ ---
function formatProfile(profile, fallbackVkId) {
    let info = `👤 ИНФОРМАЦИЯ ОБ ИГРОКЕ:\n`;
    info += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    info += `🎮 Игровой ID: ${profile.id || 'N/A'}\n`;
    info += `📱 VK ID: ${profile.vk_id || fallbackVkId}\n`;
    info += `📛 Имя: ${profile.first_name || profile.name || 'Неизвестно'}\n`;
    if (profile.clan_id) info += `🏰 Клан: ${profile.clan_id}\n`;
    info += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    info += `📊 ПАРАМЕТРЫ:\n`;
    info += `💰 Баланс: ${profile.money}$\n`;
    info += `💪 Сила: ${profile.strength}\n`;
    info += `🛡️ Стражи: ${profile.guards_count}\n`;
    if (profile.attack_energy !== undefined) info += `⚡ Энергия атаки: ${profile.attack_energy}/5\n`;
    info += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    info += `⏱️ ${new Date().toLocaleTimeString('ru-RU')}`;
    return info;
}

// --- ОБРАБОТКА КОМАНД ---
async function handleCommand(userId, msg) {
    if (userId !== MAIN_ADMIN_ID && !ALLOWED_USERS.has(userId)) {
        return sendMessage(userId, '⛔ Отказано в доступе.');
    }

    const parts = msg.split(' ');
    const cmd = parts[0].toLowerCase();
    const text = msg.toLowerCase();

    // Управление доступом
    if (userId === MAIN_ADMIN_ID) {
        if (cmd === '+доступ' && parts[1]) {
            const targetId = parseInt(parts[1]);
            if (targetId) {
                ALLOWED_USERS.add(targetId);
                return sendMessage(userId, `✅ Доступ предоставлен для ID ${targetId}`);
            }
        }
        if (cmd === '-доступ' && parts[1]) {
            const targetId = parseInt(parts[1]);
            if (targetId && targetId !== MAIN_ADMIN_ID) {
                ALLOWED_USERS.delete(targetId);
                return sendMessage(userId, `⛔ Доступ аннулирован для ID ${targetId}`);
            }
        }
    }

    // Отмена
    if (cmd === 'отмена') {
        userState[userId] = null;
        return sendMessage(userId, '❌ Действие отменено.');
    }

    // Ввод аккаунта
    if (userState[userId] === 'awaiting_account') {
        let token, sign, vk_ts, vk_user_id;
        if (msg.includes('access_token=')) {
            const cleanText = msg.includes('#') ? msg.split('#')[1] : msg.split('?')[1];
            const params = new URLSearchParams(cleanText);
            token = params.get('access_token');
            vk_user_id = params.get('user_id');
        }
        if (msg.includes('vk_access_token_settings')) {
            const params = new URLSearchParams(msg);
            token = params.get('access_token') || token;
            sign = params.get('sign');
            vk_ts = params.get('vk_ts');
            vk_user_id = params.get('vk_user_id');
        }
        if (!token) {
            const lines = msg.split(/\s+/);
            token = lines.find(l => l.startsWith('vk1.a.'));
            sign = lines.find(l => l.length === 43 || l.length === 44);
            vk_ts = lines.find(l => /^\d{10}$/.test(l));
            vk_user_id = lines.find(l => /^\d{6,10}$/.test(l) && l !== vk_ts);
        }

        if (!token || !sign || !vk_ts || !vk_user_id) {
            return sendMessage(userId, '❌ Данные не распознаны. Отправьте валидный Payload или "отмена".');
        }

        ACCOUNTS.push({ token, sign, vk_ts, vk_user_id });
        userState[userId] = null;
        return sendMessage(userId, `✅ Аккаунт VK ID ${vk_user_id} добавлен!\nВсего: ${ACCOUNTS.length}`);
    }

    // Ввод жертвы
    if (userState[userId] === 'awaiting_victim') {
        if (/^\d+$/.test(msg)) {
            VICTIM_VK_ID = Number(msg);
            KNOWN_VICTIM_GAME_ID = null;
            userState[userId] = null;
            return sendMessage(userId, `🎯 Цель обновлена: VK ID ${VICTIM_VK_ID}`);
        }
        return sendMessage(userId, '❌ Укажите числовой VK ID.');
    }

    // Главное меню
    if (['/start', 'старт', 'меню', 'начать'].includes(cmd)) {
        return sendMessage(userId, `🎮 KOSMO REQUIEM ФЕРМА

✨ Доступные команды:
➕ добавить - добавить аккаунт
🎯 жертва - установить цель
🔍 найти [VK ID] - найти игровой ID и сохранить
💼 контракт - собрать/запустить контракты
🏋️ тренировка - выполнить тренировку (assault)
⚔️ атака - атаковать цель
👤 /info [VK ID] - инфо об игроке
📊 статус - состояние фермы
📖 помощь - полная справка

🔄 АВТО:
авто-контракт - вкл/выкл (30 мин цикл)
авто-тренировка - вкл/выкл (каждые 25 мин)
авто-атака - вкл/выкл (5 атак / 2 мин)`);
    }

    // Команда найти [VK ID] — поиск через рейтинг
    if (cmd === 'найти' && parts[1]) {
        const targetVkId = parts[1];
        if (!/^\d+$/.test(targetVkId)) return sendMessage(userId, '❌ Укажите числовой VK ID: найти 815223747');
        if (ACCOUNTS.length === 0) return sendMessage(userId, '⚠️ Нет аккаунтов!');

        await sendMessage(userId, `🔍 Ищу VK ID ${targetVkId} через рейтинг игроков...`);
        try {
            const sess = await authInGame(ACCOUNTS[0]);
            const gameId = await resolveGameId(targetVkId, sess, userId);

            if (!gameId) {
                return sendMessage(userId, `❌ Игрок VK ID ${targetVkId} не найден в рейтинге.`);
            }

            if (String(targetVkId) === String(VICTIM_VK_ID)) {
                KNOWN_VICTIM_GAME_ID = gameId;
                return sendMessage(userId, `✅ Найден!\n🎮 Игровой ID: ${gameId}\n📱 VK ID: ${targetVkId}\n💾 Сохранён как ID цели для атак.`);
            }
            return sendMessage(userId, `✅ Найден!\n🎮 Игровой ID: ${gameId}\n📱 VK ID: ${targetVkId}`);
        } catch (e) {
            return sendMessage(userId, `❌ Ошибка поиска: ${e.response?.data?.message || e.message}`);
        }
    }

    // /info
    if (cmd === '/info') {
        const identifier = parts[1];
        if (!identifier) return sendMessage(userId, '❌ Укажите VK ID: /info 374407662');
        let targetVkId = identifier.startsWith('@') ? identifier.substring(1) : identifier;
        if (!/^\d+$/.test(targetVkId)) return sendMessage(userId, '❌ Некорректный формат. Используйте: /info 374407662');
        if (ACCOUNTS.length === 0) return sendMessage(userId, '⚠️ Нет аккаунтов!');

        sendMessage(userId, `⏳ Ищу игрока VK ID ${targetVkId}...`);
        try {
            const ownAcc = ACCOUNTS.find(acc => String(acc.vk_user_id) === String(targetVkId));
            if (ownAcc) {
                const sess = await authInGame(ownAcc);
                const profileRes = await axios.get('https://api.kosmo-requiem.ru/users/me', { headers: { ...gameHeaders, 'X-Session-Id': sess } });
                return sendMessage(userId, formatProfile(profileRes.data, targetVkId));
            }
            const sess = await authInGame(ACCOUNTS[0]);
            const found = await findUserByVkId(targetVkId, sess);
            if (!found) return sendMessage(userId, `❌ Игрок VK ID ${targetVkId} не найден.`);
            return sendMessage(userId, formatProfile(found, targetVkId));
        } catch (e) {
            return sendMessage(userId, `❌ Ошибка поиска: ${e.response?.data?.message || e.message}`);
        }
    }

    // Справка
    if (['/help', 'помощь', 'помог'].includes(cmd)) {
        return sendMessage(userId, `📖 ПОЛНАЯ СПРАВКА:

🔧 УПРАВЛЕНИЕ:
добавить - добавить игровой аккаунт
жертва - установить VK ID цели
/info [VK ID] - инфо о любом игроке
+доступ [ID] / -доступ [ID] - управление доступом

⚔️ ДЕЙСТВИЯ:
контракт - собрать/запустить контракт (balanced)
тренировка - тренировка (assault)
атака - атаковать цель

🔄 АВТОМАТИЗАЦИЯ:
авто-контракт - вкл/выкл (запуск → 30 мин → сбор → повтор)
авто-тренировка - вкл/выкл (каждые 25 мин, тип assault)
авто-атака - вкл/выкл (5 атак каждые 2 мин)

📊 ИНФОРМАЦИЯ:
статус - показать состояние фермы`);
    }

    // Добавить аккаунт
    if (text.includes('добавить')) {
        userState[userId] = 'awaiting_account';
        return sendMessage(userId, '📥 Отправьте Payload из DevTools (access_token, sign, vk_ts, vk_user_id):');
    }

    // Выбрать жертву
    if (text.includes('жертва')) {
        userState[userId] = 'awaiting_victim';
        return sendMessage(userId, `Текущая цель: ${VICTIM_VK_ID}\n\n📥 Введите новый VK ID:`);
    }

    // Статус
    if (text.includes('статус')) {
        return sendMessage(userId, `📊 СОСТОЯНИЕ ФЕРМЫ:
👥 Аккаунтов: ${ACCOUNTS.length}
🎯 Цель (VK ID): ${VICTIM_VK_ID}
💼 Авто-контракты: ${AUTO_CONTRACT ? '🟢 ВКЛ' : '🔴 ВЫКЛ'}
🏋️ Авто-тренировка: ${AUTO_TRAINING ? '🟢 ВКЛ' : '🔴 ВЫКЛ'}
⚔️ Авто-атака: ${AUTO_ATTACK ? '🟢 ВКЛ' : '🔴 ВЫКЛ'}`);
    }

    // Защита от пустого пула
    if (['контракт', 'тренировка', 'атака'].some(w => text.includes(w)) && ACCOUNTS.length === 0) {
        return sendMessage(userId, '⚠️ Нет аккаунтов! Используйте "добавить".');
    }

    // ====================================================
    // КОНТРАКТ (ручной)
    // ====================================================
    if (text.includes('контракт') && !text.includes('авто')) {
        sendMessage(userId, '⏳ Проверка контрактов...');
        for (const acc of ACCOUNTS) {
            try {
                const sess = await authInGame(acc);
                const h = { ...gameHeaders, 'X-Session-Id': sess };

                const profileBefore = await axios.get('https://api.kosmo-requiem.ru/users/me', { headers: h });
                const before = profileBefore.data;

                // Проверяем текущий контракт (может быть пустым)
                let contract = null;
                try {
                    const cur = await axios.get('https://api.kosmo-requiem.ru/users/contracts/current', { headers: h });
                    if (cur.data && cur.data.id) contract = cur.data;
                } catch (e) { contract = null; }

                let result = `📋 КОНТРАКТ [ID ${acc.vk_user_id}]:\n`;
                result += `━━━━━━━━━━━━━━━━━\n`;

                if (contract && contract.can_claim === true) {
                    await axios.post('https://api.kosmo-requiem.ru/users/contracts/claim', {}, { headers: h });
                    const profileAfter = await axios.get('https://api.kosmo-requiem.ru/users/me', { headers: h });
                    const after = profileAfter.data;

                    result += `✅ КОНТРАКТ СОБРАН!\n`;
                    result += `💰 +${after.money - before.money}$\n`;
                    result += `━━━━━━━━━━━━━━━━━\n`;
                    result += `💰 ${before.money}$ → ${after.money}$\n`;
                    result += `💪 ${before.strength} → ${after.strength}\n`;
                    result += `🛡️ ${before.guards_count} → ${after.guards_count}\n`;

                    // Запускаем новый
                    try {
                        await axios.post('https://api.kosmo-requiem.ru/users/contracts/start', { type: 'balanced' }, { headers: h });
                        result += `🔄 Новый контракт (balanced) запущен!\n`;
                    } catch (se) {
                        result += `⚠️ Не удалось запустить новый: ${se.response?.data?.message || se.message}\n`;
                    }

                } else if (contract && contract.status === 'in_progress') {
                    result += `⏳ КОНТРАКТ ВЫПОЛНЯЕТСЯ\n`;
                    if (contract.ends_at) {
                        const endsAt = new Date(contract.ends_at);
                        const minsLeft = Math.max(0, Math.round((endsAt - Date.now()) / 60000));
                        result += `⏱️ Осталось: ~${minsLeft} мин\n`;
                        result += `🕐 Конец: ${endsAt.toLocaleTimeString('ru-RU')}\n`;
                    }
                    result += `━━━━━━━━━━━━━━━━━\n`;
                    result += `💰 ${before.money}$ | 💪 ${before.strength} | 🛡️ ${before.guards_count}\n`;

                } else {
                    // Нет контракта — запускаем
                    try {
                        await axios.post('https://api.kosmo-requiem.ru/users/contracts/start', { type: 'balanced' }, { headers: h });
                        result += `✅ Контракт (balanced) запущен!\n`;
                        result += `⏱️ Сбор через ~30 мин\n`;
                        result += `━━━━━━━━━━━━━━━━━\n`;
                        result += `💰 ${before.money}$ | 💪 ${before.strength}\n`;
                    } catch (se) {
                        result += `❌ Ошибка: ${se.response?.data?.message || se.message}\n`;
                    }
                }

                sendMessage(userId, result);
            } catch (e) {
                sendMessage(userId, `❌ [${acc.vk_user_id}]: ${e.response?.data?.message || e.message}`);
            }
        }
    }

    // ====================================================
    // ТРЕНИРОВКА (ручная) — тип assault
    // ====================================================
    if (text.includes('тренировка') && !text.includes('авто')) {
        sendMessage(userId, '⏳ Выполнение тренировки (assault)...');
        for (const acc of ACCOUNTS) {
            try {
                const { before, after } = await doTraining(acc, 'assault');
                let result = `🏋️ ТРЕНИРОВКА [ID ${acc.vk_user_id}]:\n`;
                result += `━━━━━━━━━━━━━━━━━\n`;
                result += `✅ Выполнена! (тип: assault)\n`;
                result += `💪 +${after.strength - before.strength} силы\n`;
                result += `━━━━━━━━━━━━━━━━━\n`;
                result += `💪 ${before.strength} → ${after.strength}\n`;
                result += `💰 ${before.money}$ → ${after.money}$\n`;
                result += `🛡️ ${before.guards_count} → ${after.guards_count}\n`;
                sendMessage(userId, result);
            } catch (e) {
                const errMsg = e.response?.data?.message || e.message;
                if (errMsg.toLowerCase().includes('cooldown')) {
                    sendMessage(userId, `❌ [${acc.vk_user_id}]: ⏱️ Тренировка на кулдауне.`);
                } else {
                    sendMessage(userId, `❌ [${acc.vk_user_id}]: ${errMsg}`);
                }
            }
        }
    }

    // ====================================================
    // АТАКА (ручная)
    // ====================================================
    if (text.includes('атака') && !text.includes('авто')) {
        sendMessage(userId, '⏳ Поиск и атака цели...');
        for (const acc of ACCOUNTS) {
            try {
                const sess = await authInGame(acc);
                if (!KNOWN_VICTIM_GAME_ID) {
                    const gId = await resolveGameId(VICTIM_VK_ID, sess, userId);
                    if (gId) KNOWN_VICTIM_GAME_ID = gId;
                }
                if (!KNOWN_VICTIM_GAME_ID) {
                    sendMessage(userId, `❌ [${acc.vk_user_id}]: Цель VK ID ${VICTIM_VK_ID} не найдена. Используйте "найти ${VICTIM_VK_ID}" для ручного скана.`);
                    continue;
                }

                const res = await axios.post('https://api.kosmo-requiem.ru/users/attack',
                    { target_user_id: Number(KNOWN_VICTIM_GAME_ID) },
                    { headers: { ...gameHeaders, 'X-Session-Id': sess } }
                );

                let result = `⚔️ БОЙ [ID ${acc.vk_user_id}]:\n`;
                result += `━━━━━━━━━━━━━━━━━\n`;
                result += res.data.is_win ? `✅ ПОБЕДА!\n` : `❌ ПОРАЖЕНИЕ\n`;
                result += `💰 Украдено: +${res.data.stolen_money || 0}$\n`;
                result += `🛡️ Захвачено: +${res.data.captured_guards || 0}\n`;
                if (res.data.user) {
                    result += `━━━━━━━━━━━━━━━━━\n`;
                    result += `💰 ${res.data.user.money}$ | 💪 ${res.data.user.strength} | 🛡️ ${res.data.user.guards_count}\n`;
                }
                if (res.data.attack_energy !== undefined) result += `⚡ Энергия: ${res.data.attack_energy}/5\n`;
                sendMessage(userId, result);
            } catch (e) {
                const errMsg = e.response?.data?.message || e.message;
                if (errMsg.toLowerCase().includes('energy')) {
                    sendMessage(userId, `❌ [${acc.vk_user_id}]: ⚡ Энергия исчерпана.`);
                } else {
                    sendMessage(userId, `❌ [${acc.vk_user_id}]: ${errMsg}`);
                }
            }
        }
    }

    // ====================================================
    // АВТО-КОНТРАКТ
    // ====================================================
    if (text.includes('авто-контракт')) {
        AUTO_CONTRACT = !AUTO_CONTRACT;
        autoNotifyUserId = userId;
        if (AUTO_CONTRACT) {
            if (contractTimeout) clearTimeout(contractTimeout);
            sendMessage(userId, '🟢 Авто-контракты ВКЛЮЧЕНЫ!\nЦикл: запуск (balanced) → 30 мин → сбор → новый запуск');
            runContractCycle(userId);
        } else {
            if (contractTimeout) { clearTimeout(contractTimeout); contractTimeout = null; }
            sendMessage(userId, '🔴 Авто-контракты ВЫКЛЮЧЕНЫ');
        }
    }

    // ====================================================
    // АВТО-ТРЕНИРОВКА — каждые 25 минут
    // ====================================================
    if (text.includes('авто-тренировка')) {
        AUTO_TRAINING = !AUTO_TRAINING;
        autoNotifyUserId = userId;
        if (AUTO_TRAINING) {
            if (trainingInterval) clearInterval(trainingInterval);
            // Сразу первый раз
            runTrainingCycle(userId);
            // Потом каждые 25 минут
            trainingInterval = setInterval(() => runTrainingCycle(userId), 25 * 60 * 1000);
            sendMessage(userId, '🟢 Авто-тренировка ВКЛЮЧЕНА!\n🏋️ Тренировка (assault) сразу + каждые 25 мин.');
        } else {
            if (trainingInterval) { clearInterval(trainingInterval); trainingInterval = null; }
            sendMessage(userId, '🔴 Авто-тренировка ВЫКЛЮЧЕНА');
        }
    }

    // ====================================================
    // АВТО-АТАКА — 5 атак каждые 2 минуты
    // ====================================================
    if (text.includes('авто-атака')) {
        AUTO_ATTACK = !AUTO_ATTACK;
        autoNotifyUserId = userId;
        if (AUTO_ATTACK) {
            if (attackInterval) clearInterval(attackInterval);
            sendMessage(userId, '🟢 Авто-атака ВКЛЮЧЕНА!\n⚔️ 5 атак сразу + каждые 2 минуты.');

            const doAutoAttack = async () => {
                if (!AUTO_ATTACK) return;
                for (const acc of ACCOUNTS) {
                    for (let i = 0; i < 5; i++) {
                        if (!AUTO_ATTACK) break;
                        try {
                            const sess = await authInGame(acc);
                            if (!KNOWN_VICTIM_GAME_ID) {
                                const gId = await resolveGameId(VICTIM_VK_ID, sess, userId);
                                if (gId) KNOWN_VICTIM_GAME_ID = gId;
                            }
                            if (!KNOWN_VICTIM_GAME_ID) {
                                await sendMessage(userId, `❌ [${acc.vk_user_id}]: Цель VK ID ${VICTIM_VK_ID} не найдена. Используйте "найти ${VICTIM_VK_ID}".`);
                                break;
                            }
                            const res = await axios.post('https://api.kosmo-requiem.ru/users/attack',
                                { target_user_id: Number(KNOWN_VICTIM_GAME_ID) },
                                { headers: { ...gameHeaders, 'X-Session-Id': sess } }
                            );
                            const win = res.data.is_win;
                            const stolen = res.data.stolen_money || 0;
                            const energy = res.data.attack_energy !== undefined ? res.data.attack_energy : '?';
                            await sendMessage(userId,
                                `⚔️ Авто-атака [${acc.vk_user_id}] #${i + 1}:\n` +
                                `${win ? '✅ ПОБЕДА' : '❌ ПОРАЖЕНИЕ'} | 💰 +${stolen}$ | ⚡ ${energy}/5`
                            );
                        } catch (e) {
                            const errMsg = e.response?.data?.message || e.message;
                            if (errMsg.toLowerCase().includes('energy')) {
                                await sendMessage(userId, `⚡ [${acc.vk_user_id}]: Энергия исчерпана.`);
                                break;
                            }
                            console.log(`[${acc.vk_user_id}] attack error:`, errMsg);
                        }
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }
            };

            await doAutoAttack();
            attackInterval = setInterval(doAutoAttack, 2 * 60 * 1000);
        } else {
            if (attackInterval) { clearInterval(attackInterval); attackInterval = null; }
            sendMessage(userId, '🔴 Авто-атака ВЫКЛЮЧЕНА');
        }
    }
}

// --- ОСНОВНОЙ ЛУП ---
async function pollMessages() {
    const messages = await getMessages();
    for (const msg of messages) {
        if (msg.id > LAST_MESSAGE_ID) {
            LAST_MESSAGE_ID = msg.id;
            const userId = msg.from_id;
            const text = msg.text || '';
            if (text.trim()) {
                console.log(`[${userId}]: ${text}`);
                await handleCommand(userId, text);
            }
        }
    }
}

console.log('🤖 Бот запущен!');
console.log('📨 Слушаю личные сообщения...\n');

setInterval(pollMessages, 2000);