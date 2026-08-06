const { VK, Keyboard } = require('vk-io');
const axios = require('axios');
const { URLSearchParams } = require('url');

const VK_TOKEN = 'vk1.a.4IlhuFVi18emk6Ihsh6C_OFlrmXNSbOIlpkUZHpsycnLoVv5sZ8YMb2nOUzyQIMgc4fVgr9T8zuYDdilWF7XKvTMCNR2PvpuobtNClSjIg5VBQ7Z18sfAd4LZGhj3ssNRX69VYWZwFYdcqAQrNdqaJSjGCR_Q4Jdl4CNQ3lwiKRMEgYlKewqpvX06GnQkBqlrg1vmHUF6PLtpViT4TaQ8g';
const GROUP_ID = '238935844';

const GAME_BASE_URL = 'https://www.slaves-vk.ru';

const userStorage = new Map();
const userStates = new Map();
const monitoringIntervals = new Map();
const autoThrowIntervals = new Map();

function extractUserIdFromSign(sign) {
    const params = new URLSearchParams(sign);
    return params.get('vk_user_id');
}

async function authenticate(vkSign, vkUserId) {
    try {
        const response = await axios.post(
            `${GAME_BASE_URL}/api/profile`,
            { name: "", avatar_url: "", ref_id: null },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-vk-user-id': vkUserId,
                    'x-vk-sign': vkSign
                }
            }
        );

        if (!response.data.session_token) {
            throw new Error('Не удалось получить session_token');
        }

        return response.data.session_token;
    } catch (error) {
        throw new Error(`Ошибка авторизации: ${error.message}`);
    }
}

async function checkStoneStatus(vkSign, vkUserId, targetVkId) {
    try {
        const token = await authenticate(vkSign, vkUserId);

        const response = await axios.get(
            `${GAME_BASE_URL}/api/profile/${targetVkId}`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-vk-user-id': vkUserId,
                    'x-session': token,
                    'x-vk-sign': vkSign
                }
            }
        );

        const data = response.data;
        const stone = data.active_stone;
        const immunityUntil = data.stone_immunity_until;
        const now = Date.now();

        const isImmune = immunityUntil && new Date(immunityUntil).getTime() > now;

        let status = {
            canThrow: false,
            state: '',
            immunityEnd: null,
            stoneKind: null
        };

        if (isImmune) {
            const endTime = new Date(immunityUntil).getTime();
            const minsLeft = Math.max(1, Math.ceil((endTime - now) / 60000));
            status.state = minsLeft >= 60 ? `Иммунитет · 1 ч` : `Иммунитет · ${minsLeft} мин`;
            status.immunityEnd = endTime;
            status.canThrow = false;
        } else if (stone?.kind === "big") {
            status.state = "Под большим камнем";
            status.stoneKind = 'big';
            status.canThrow = false;
        } else if (stone?.kind === "normal") {
            status.state = "Под обычным камнем";
            status.stoneKind = 'normal';
            status.canThrow = true;
        } else {
            status.state = "Камня нет";
            status.canThrow = true;
        }

        return {
            ...status,
            name: data.user?.name || targetVkId,
            targetId: targetVkId,
            rawData: data
        };
    } catch (error) {
        throw new Error(`Ошибка проверки статуса: ${error.message}`);
    }
}

async function throwStone(vkSign, vkUserId, targetVkId, kind = 'big') {
    try {
        const token = await authenticate(vkSign, vkUserId);

        const response = await axios.post(
            `${GAME_BASE_URL}/api/stones/throw`,
            { targetVkId, kind },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-vk-user-id': vkUserId,
                    'x-session': token,
                    'x-vk-sign': vkSign
                }
            }
        );

        return response.data;
    } catch (error) {
        throw new Error(`Ошибка броска камня: ${error.message}`);
    }
}

function getMainKeyboard() {
    return Keyboard.keyboard([
        [
            Keyboard.textButton({
                label: '👤 Добавить аккаунт',
                payload: { command: 'add_account' },
                color: Keyboard.POSITIVE_COLOR
            }),
            Keyboard.textButton({
                label: '📋 Мой аккаунт',
                payload: { command: 'my_account' },
                color: Keyboard.PRIMARY_COLOR
            })
        ],
        [
            Keyboard.textButton({
                label: '👀 Слежка',
                payload: { command: 'monitoring' },
                color: Keyboard.SECONDARY_COLOR
            }),
            Keyboard.textButton({
                label: '🎯 Автокид',
                payload: { command: 'auto_throw' },
                color: Keyboard.NEGATIVE_COLOR
            })
        ],
        [
            Keyboard.textButton({
                label: '🗿 Кинуть камень',
                payload: { command: 'throw' },
                color: Keyboard.SECONDARY_COLOR
            }),
            Keyboard.textButton({
                label: '⏹️ Остановить всё',
                payload: { command: 'stop_all' },
                color: Keyboard.SECONDARY_COLOR
            })
        ]
    ]);
}

function getCancelKeyboard() {
    return Keyboard.keyboard([
        [
            Keyboard.textButton({
                label: '❌ Отмена',
                payload: { command: 'cancel' },
                color: Keyboard.SECONDARY_COLOR
            })
        ]
    ]);
}

function getMonitoringKeyboard() {
    return Keyboard.keyboard([
        [
            Keyboard.textButton({
                label: '➕ Добавить цели',
                payload: { command: 'add_targets' },
                color: Keyboard.POSITIVE_COLOR
            }),
            Keyboard.textButton({
                label: '📋 Список целей',
                payload: { command: 'list_targets' },
                color: Keyboard.PRIMARY_COLOR
            })
        ],
        [
            Keyboard.textButton({
                label: '🗑️ Очистить цели',
                payload: { command: 'clear_targets' },
                color: Keyboard.NEGATIVE_COLOR
            }),
            Keyboard.textButton({
                label: '▶️ Запустить слежку',
                payload: { command: 'start_monitoring' },
                color: Keyboard.POSITIVE_COLOR
            })
        ],
        [
            Keyboard.textButton({
                label: '⏹️ Остановить слежку',
                payload: { command: 'stop_monitoring' },
                color: Keyboard.SECONDARY_COLOR
            }),
            Keyboard.textButton({
                label: '🔙 Назад',
                payload: { command: 'back' },
                color: Keyboard.SECONDARY_COLOR
            })
        ]
    ]);
}

function getAutoThrowKeyboard() {
    return Keyboard.keyboard([
        [
            Keyboard.textButton({
                label: '🎯 Выбрать цели',
                payload: { command: 'auto_targets' },
                color: Keyboard.PRIMARY_COLOR
            }),
            Keyboard.textButton({
                label: '⏱️ Интервал (мин)',
                payload: { command: 'set_interval' },
                color: Keyboard.SECONDARY_COLOR
            })
        ],
        [
            Keyboard.textButton({
                label: '💎 Тип камня',
                payload: { command: 'auto_stone' },
                color: Keyboard.SECONDARY_COLOR
            }),
            Keyboard.textButton({
                label: '🧠 Умный режим',
                payload: { command: 'smart_mode' },
                color: Keyboard.POSITIVE_COLOR
            })
        ],
        [
            Keyboard.textButton({
                label: '▶️ Запустить автокид',
                payload: { command: 'start_auto' },
                color: Keyboard.POSITIVE_COLOR
            }),
            Keyboard.textButton({
                label: '⏹️ Остановить автокид',
                payload: { command: 'stop_auto' },
                color: Keyboard.NEGATIVE_COLOR
            })
        ],
        [
            Keyboard.textButton({
                label: '🔙 Назад',
                payload: { command: 'back' },
                color: Keyboard.SECONDARY_COLOR
            })
        ]
    ]);
}

function getStoneKeyboard() {
    return Keyboard.keyboard([
        [
            Keyboard.textButton({
                label: '💎 Big',
                payload: { command: 'stone_big' },
                color: Keyboard.POSITIVE_COLOR
            }),
            Keyboard.textButton({
                label: '💎 Normal',
                payload: { command: 'stone_normal' },
                color: Keyboard.PRIMARY_COLOR
            })
        ],
        [
            Keyboard.textButton({
                label: '❌ Отмена',
                payload: { command: 'cancel' },
                color: Keyboard.SECONDARY_COLOR
            })
        ]
    ]);
}

async function startMonitoring(userId, vkSign, vkUserId) {
    const userData = userStorage.get(userId);
    if (!userData || !userData.monitoringTargets || userData.monitoringTargets.length === 0) {
        return '❌ Нет целей для слежки. Добавьте цели.';
    }

    if (monitoringIntervals.has(userId)) {
        clearInterval(monitoringIntervals.get(userId));
    }

    let isFirstRun = true;

    const interval = setInterval(async () => {
        try {
            const targets = userData.monitoringTargets || [];
            let notifications = [];

            for (const targetId of targets) {
                try {
                    const status = await checkStoneStatus(vkSign, vkUserId, targetId);
                    
                    if (status.canThrow && (status.state === "Камня нет" || status.state === "Под обычным камнем")) {
                        notifications.push(`🎯 ${status.name} (${targetId}): ${status.state} - МОЖНО КИНУТЬ!`);
                    } else if (status.state.includes('Иммунитет')) {
                        const minutes = status.state.match(/\d+/);
                        if (minutes && parseInt(minutes[0]) <= 5) {
                            notifications.push(`⚠️ ${status.name} (${targetId}): ${status.state} - Скоро закончится!`);
                        }
                    }
                } catch (error) {
                    console.error(`Ошибка проверки ${targetId}:`, error.message);
                }
            }

            if (notifications.length > 0 && !isFirstRun) {
                const vk = new VK({ token: VK_TOKEN });
                await vk.api.messages.send({
                    peer_id: userId,
                    message: `📊 Отчет слежки:\n\n${notifications.join('\n')}`,
                    random_id: Date.now()
                });
            }

            isFirstRun = false;

        } catch (error) {
            console.error('Ошибка в мониторинге:', error);
        }
    }, 30000);

    monitoringIntervals.set(userId, interval);
    return '✅ Слежка запущена. Проверка каждые 30 секунд.';
}

async function startAutoThrow(userId, vkSign, vkUserId) {
    const userData = userStorage.get(userId);
    
    if (!userData || !userData.autoTargets || userData.autoTargets.length === 0) {
        return '❌ Нет целей для автокида. Выберите цели.';
    }

    if (!userData.autoInterval || userData.autoInterval < 1) {
        return '❌ Установите интервал (минимум 1 минута).';
    }

    if (autoThrowIntervals.has(userId)) {
        clearInterval(autoThrowIntervals.get(userId));
    }

    const intervalMs = userData.autoInterval * 60000;

    const interval = setInterval(async () => {
        try {
            const targets = userData.autoTargets || [];
            const stoneKind = userData.autoStoneKind || 'big';
            const smartMode = userData.smartMode || false;

            for (const targetId of targets) {
                try {
                    let canThrow = true;

                    if (smartMode) {
                        const status = await checkStoneStatus(vkSign, vkUserId, targetId);
                        canThrow = status.canThrow;
                    }

                    if (canThrow) {
                        const result = await throwStone(vkSign, vkUserId, targetId, stoneKind);
                        console.log(`Брошен камень в ${targetId}:`, result);
                        
                        const vk = new VK({ token: VK_TOKEN });
                        await vk.api.messages.send({
                            peer_id: userId,
                            message: `✅ Камень брошен в ${targetId} (${stoneKind})`,
                            random_id: Date.now()
                        });
                    }
                } catch (error) {
                    console.error(`Ошибка автокида для ${targetId}:`, error.message);
                }
            }
        } catch (error) {
            console.error('Ошибка в автокиде:', error);
        }
    }, intervalMs);

    autoThrowIntervals.set(userId, interval);
    return `✅ Автокид запущен. Интервал: ${userData.autoInterval} мин. Целей: ${userData.autoTargets.length}`;
}

const vk = new VK({
    token: VK_TOKEN,
    pollingGroupId: GROUP_ID
});

vk.updates.on('message_new', async (context) => {
    const userId = context.senderId;
    const text = context.text ? context.text.trim() : '';
    const payload = context.messagePayload || {};

    if (!text && !payload.command) return;

    if (!userStorage.has(userId)) {
        userStorage.set(userId, {});
    }
    const userData = userStorage.get(userId);

    if (!userStates.has(userId)) {
        userStates.set(userId, { action: null });
    }
    const state = userStates.get(userId);

    try {
        if (payload.command) {
            switch (payload.command) {
                case 'add_account': {
                    state.action = 'waiting_sign';
                    await context.send('📝 Введите строку подписи (всё, что после ? в launch-параметрах):', {
                        keyboard: getCancelKeyboard()
                    });
                    break;
                }

                case 'my_account': {
                    if (!userData.sign) {
                        await context.send('❌ Аккаунт не добавлен.', {
                            keyboard: getMainKeyboard()
                        });
                        break;
                    }
                    const info = 
                        `👤 ID аккаунта: ${userData.userId}\n` +
                        `💎 Тип камня: ${userData.stoneKind || 'не установлен'}\n` +
                        `🎯 Мониторинг целей: ${userData.monitoringTargets ? userData.monitoringTargets.length : 0}\n` +
                        `🎯 Автокид целей: ${userData.autoTargets ? userData.autoTargets.length : 0}\n` +
                        `⏱️ Интервал: ${userData.autoInterval || 'не установлен'} мин\n` +
                        `🧠 Умный режим: ${userData.smartMode ? 'включен' : 'выключен'}`;
                    await context.send(info, {
                        keyboard: getMainKeyboard()
                    });
                    break;
                }

                case 'monitoring': {
                    await context.send('📊 Управление слежкой:', {
                        keyboard: getMonitoringKeyboard()
                    });
                    break;
                }

                case 'add_targets': {
                    state.action = 'waiting_targets';
                    await context.send('📝 Введите ID целей через запятую или пробел (например: 123456789, 987654321):', {
                        keyboard: getCancelKeyboard()
                    });
                    break;
                }

                case 'list_targets': {
                    if (!userData.monitoringTargets || userData.monitoringTargets.length === 0) {
                        await context.send('❌ Нет целей для слежки.', {
                            keyboard: getMonitoringKeyboard()
                        });
                        break;
                    }
                    const list = userData.monitoringTargets.map((id, index) => `${index+1}. ${id}`).join('\n');
                    await context.send(`📋 Цели слежки:\n${list}`, {
                        keyboard: getMonitoringKeyboard()
                    });
                    break;
                }

                case 'clear_targets': {
                    userData.monitoringTargets = [];
                    await context.send('✅ Цели слежки очищены.', {
                        keyboard: getMonitoringKeyboard()
                    });
                    break;
                }

                case 'start_monitoring': {
                    if (!userData.sign) {
                        await context.send('❌ Сначала добавьте аккаунт.', {
                            keyboard: getMainKeyboard()
                        });
                        break;
                    }
                    const result = await startMonitoring(userId, userData.sign, userData.userId);
                    await context.send(result, {
                        keyboard: getMonitoringKeyboard()
                    });
                    break;
                }

                case 'stop_monitoring': {
                    if (monitoringIntervals.has(userId)) {
                        clearInterval(monitoringIntervals.get(userId));
                        monitoringIntervals.delete(userId);
                        await context.send('⏹️ Слежка остановлена.', {
                            keyboard: getMonitoringKeyboard()
                        });
                    } else {
                        await context.send('❌ Слежка не запущена.', {
                            keyboard: getMonitoringKeyboard()
                        });
                    }
                    break;
                }

                case 'auto_throw': {
                    await context.send('🎯 Управление автокидом:', {
                        keyboard: getAutoThrowKeyboard()
                    });
                    break;
                }

                case 'auto_targets': {
                    state.action = 'waiting_auto_targets';
                    await context.send('📝 Введите ID целей для автокида через запятую или пробел:', {
                        keyboard: getCancelKeyboard()
                    });
                    break;
                }

                case 'set_interval': {
                    state.action = 'waiting_interval';
                    await context.send('⏱️ Введите интервал в минутах (минимум 1):', {
                        keyboard: getCancelKeyboard()
                    });
                    break;
                }

                case 'auto_stone': {
                    await context.send('💎 Выберите тип камня для автокида:', {
                        keyboard: getStoneKeyboard()
                    });
                    break;
                }

                case 'stone_big': {
                    if (state.context === 'auto_stone') {
                        userData.autoStoneKind = 'big';
                        await context.send('✅ Тип камня для автокида установлен: big', {
                            keyboard: getAutoThrowKeyboard()
                        });
                    } else {
                        userData.stoneKind = 'big';
                        await context.send('✅ Тип камня установлен: big', {
                            keyboard: getMainKeyboard()
                        });
                    }
                    state.context = null;
                    break;
                }

                case 'stone_normal': {
                    if (state.context === 'auto_stone') {
                        userData.autoStoneKind = 'normal';
                        await context.send('✅ Тип камня для автокида установлен: normal', {
                            keyboard: getAutoThrowKeyboard()
                        });
                    } else {
                        userData.stoneKind = 'normal';
                        await context.send('✅ Тип камня установлен: normal', {
                            keyboard: getMainKeyboard()
                        });
                    }
                    state.context = null;
                    break;
                }

                case 'smart_mode': {
                    userData.smartMode = !userData.smartMode;
                    await context.send(`🧠 Умный режим ${userData.smartMode ? 'включен' : 'выключен'}`, {
                        keyboard: getAutoThrowKeyboard()
                    });
                    break;
                }

                case 'start_auto': {
                    if (!userData.sign) {
                        await context.send('❌ Сначала добавьте аккаунт.', {
                            keyboard: getMainKeyboard()
                        });
                        break;
                    }
                    const result = await startAutoThrow(userId, userData.sign, userData.userId);
                    await context.send(result, {
                        keyboard: getAutoThrowKeyboard()
                    });
                    break;
                }

                case 'stop_auto': {
                    if (autoThrowIntervals.has(userId)) {
                        clearInterval(autoThrowIntervals.get(userId));
                        autoThrowIntervals.delete(userId);
                        await context.send('⏹️ Автокид остановлен.', {
                            keyboard: getAutoThrowKeyboard()
                        });
                    } else {
                        await context.send('❌ Автокид не запущен.', {
                            keyboard: getAutoThrowKeyboard()
                        });
                    }
                    break;
                }

                case 'throw': {
                    if (!userData.sign) {
                        await context.send('❌ Сначала добавьте аккаунт.', {
                            keyboard: getMainKeyboard()
                        });
                        break;
                    }
                    if (!userData.targetId) {
                        await context.send('❌ Укажите ID жертвы.', {
                            keyboard: getMainKeyboard()
                        });
                        break;
                    }

                    try {
                        const result = await throwStone(userData.sign, userData.userId, userData.targetId, userData.stoneKind || 'big');
                        await context.send(`✅ Камень брошен!\nОтвет: ${JSON.stringify(result)}`, {
                            keyboard: getMainKeyboard()
                        });
                    } catch (err) {
                        await context.send(`❌ Ошибка: ${err.message}`, {
                            keyboard: getMainKeyboard()
                        });
                    }
                    break;
                }

                case 'stop_all': {
                    if (monitoringIntervals.has(userId)) {
                        clearInterval(monitoringIntervals.get(userId));
                        monitoringIntervals.delete(userId);
                    }
                    if (autoThrowIntervals.has(userId)) {
                        clearInterval(autoThrowIntervals.get(userId));
                        autoThrowIntervals.delete(userId);
                    }
                    await context.send('⏹️ Все процессы остановлены.', {
                        keyboard: getMainKeyboard()
                    });
                    break;
                }

                case 'back': {
                    state.action = null;
                    await context.send('🔙 Главное меню:', {
                        keyboard: getMainKeyboard()
                    });
                    break;
                }

                case 'cancel': {
                    state.action = null;
                    state.context = null;
                    await context.send('✅ Действие отменено.', {
                        keyboard: getMainKeyboard()
                    });
                    break;
                }
            }
            return;
        }

        if (state.action === 'waiting_sign') {
            const sign = text;
            const parsedUserId = extractUserIdFromSign(sign);

            if (!parsedUserId) {
                await context.send('❌ Не удалось извлечь vk_user_id.', {
                    keyboard: getCancelKeyboard()
                });
                return;
            }

            try {
                const token = await authenticate(sign, parsedUserId);
                userData.sign = sign;
                userData.userId = parsedUserId;
                userData.sessionToken = token;
                if (!userData.stoneKind) userData.stoneKind = 'big';
                if (!userData.monitoringTargets) userData.monitoringTargets = [];
                if (!userData.autoTargets) userData.autoTargets = [];
                if (!userData.autoInterval) userData.autoInterval = 5;
                if (!userData.autoStoneKind) userData.autoStoneKind = 'big';
                if (userData.smartMode === undefined) userData.smartMode = true;

                state.action = null;
                await context.send(`✅ Аккаунт для пользователя ${parsedUserId} успешно добавлен.`, {
                    keyboard: getMainKeyboard()
                });
            } catch (err) {
                await context.send(`❌ Ошибка: ${err.message}`, {
                    keyboard: getCancelKeyboard()
                });
            }
            return;
        }

        if (state.action === 'waiting_targets') {
            const targets = text.split(/[, ]+/).filter(id => /^\d+$/.test(id));
            if (targets.length === 0) {
                await context.send('❌ Не найдено валидных ID.', {
                    keyboard: getCancelKeyboard()
                });
                return;
            }

            if (!userData.monitoringTargets) userData.monitoringTargets = [];
            userData.monitoringTargets.push(...targets);
            state.action = null;
            await context.send(`✅ Добавлено ${targets.length} целей для слежки. Всего: ${userData.monitoringTargets.length}`, {
                keyboard: getMonitoringKeyboard()
            });
            return;
        }

        if (state.action === 'waiting_auto_targets') {
            const targets = text.split(/[, ]+/).filter(id => /^\d+$/.test(id));
            if (targets.length === 0) {
                await context.send('❌ Не найдено валидных ID.', {
                    keyboard: getCancelKeyboard()
                });
                return;
            }

            userData.autoTargets = targets;
            state.action = null;
            await context.send(`✅ Установлено ${targets.length} целей для автокида.`, {
                keyboard: getAutoThrowKeyboard()
            });
            return;
        }

        if (state.action === 'waiting_interval') {
            const interval = parseInt(text);
            if (isNaN(interval) || interval < 1) {
                await context.send('❌ Введите число больше 0.', {
                    keyboard: getCancelKeyboard()
                });
                return;
            }

            userData.autoInterval = interval;
            state.action = null;
            await context.send(`✅ Интервал установлен: ${interval} минут.`, {
                keyboard: getAutoThrowKeyboard()
            });
            return;
        }

        const command = text.toLowerCase();
        switch (command) {
            case 'начать':
            case 'старт':
            case 'меню': {
                await context.send('👋 Добро пожаловать в бота Slaves!\nВыберите действие:', {
                    keyboard: getMainKeyboard()
                });
                break;
            }

            default: {
                await context.send('❓ Неизвестная команда.', {
                    keyboard: getMainKeyboard()
                });
                break;
            }
        }
    } catch (error) {
        console.error('Ошибка:', error);
        await context.send(`⚠️ Ошибка: ${error.message}`, {
            keyboard: getMainKeyboard()
        });
    }
});

vk.updates.start().then(() => {
    console.log('✅ Бот запущен');
}).catch((err) => {
    console.error('❌ Ошибка:', err);
});