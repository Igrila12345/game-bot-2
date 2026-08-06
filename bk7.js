const { VK, Keyboard } = require('vk-io');
const axios = require('axios');
const { URLSearchParams } = require('url');

const VK_TOKEN = 'vk1.a.4IlhuFVi18emk6Ihsh6C_OFlrmXNSbOIlpkUZHpsycnLoVv5sZ8YMb2nOUzyQIMgc4fVgr9T8zuYDdilWF7XKvTMCNR2PvpuobtNClSjIg5VBQ7Z18sfAd4LZGhj3ssNRX69VYWZwFYdcqAQrNdqaJSjGCR_Q4Jdl4CNQ3lwiKRMEgYlKewqpvX06GnQkBqlrg1vmHUF6PLtpViT4TaQ8g';
const GROUP_ID = '238935844';

const GAME_BASE_URL = 'https://www.slaves-vk.ru';

const userStorage = new Map();
const userStates = new Map();

class GameClient {
    constructor(vkSign, vkUserId) {
        this.vkSign = vkSign;
        this.userId = vkUserId;
        this.baseUrl = GAME_BASE_URL;
        this.sessionToken = null;
    }

    async authenticate() {
        try {
            const response = await axios.post(
                `${this.baseUrl}/api/profile`,
                { name: "", avatar_url: "", ref_id: null },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-vk-user-id': this.userId,
                        'x-vk-sign': this.vkSign
                    }
                }
            );

            if (!response.data.session_token) {
                throw new Error('Не удалось получить session_token');
            }

            this.sessionToken = response.data.session_token;
            return this.sessionToken;
        } catch (error) {
            throw new Error(`Ошибка авторизации: ${error.message}`);
        }
    }

    async throwStone(targetVkId, kind = 'big') {
        if (!this.sessionToken) {
            await this.authenticate();
        }

        try {
            const response = await axios.post(
                `${this.baseUrl}/api/stones/throw`,
                { targetVkId, kind },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-vk-user-id': this.userId,
                        'x-session': this.sessionToken,
                        'x-vk-sign': this.vkSign
                    }
                }
            );

            return response.data;
        } catch (error) {
            if (error.response) {
                throw new Error(`Сервер вернул ${error.response.status}: ${JSON.stringify(error.response.data)}`);
            }
            throw new Error(`Ошибка запроса: ${error.message}`);
        }
    }
}

function extractUserIdFromSign(sign) {
    const params = new URLSearchParams(sign);
    return params.get('vk_user_id');
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
                label: '💎 Выбрать камень',
                payload: { command: 'choose_stone' },
                color: Keyboard.SECONDARY_COLOR
            }),
            Keyboard.textButton({
                label: '🎯 Выбрать жертву',
                payload: { command: 'choose_target' },
                color: Keyboard.SECONDARY_COLOR
            })
        ],
        [
            Keyboard.textButton({
                label: '🗿 Кинуть камень',
                payload: { command: 'throw' },
                color: Keyboard.NEGATIVE_COLOR
            }),
            Keyboard.textButton({
                label: '🗑️ Удалить аккаунт',
                payload: { command: 'delete_account' },
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
                        `🎯 Жертва: ${userData.targetId || 'не установлена'}`;
                    await context.send(info, {
                        keyboard: getMainKeyboard()
                    });
                    break;
                }

                case 'choose_stone': {
                    await context.send('💎 Выберите тип камня:', {
                        keyboard: getStoneKeyboard()
                    });
                    break;
                }

                case 'stone_big': {
                    userData.stoneKind = 'big';
                    await context.send('✅ Тип камня установлен: big', {
                        keyboard: getMainKeyboard()
                    });
                    break;
                }

                case 'stone_normal': {
                    userData.stoneKind = 'normal';
                    await context.send('✅ Тип камня установлен: normal', {
                        keyboard: getMainKeyboard()
                    });
                    break;
                }

                case 'choose_target': {
                    state.action = 'waiting_target';
                    await context.send('🎯 Введите ID жертвы:', {
                        keyboard: getCancelKeyboard()
                    });
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

                    const client = new GameClient(userData.sign, userData.userId);
                    try {
                        const result = await client.throwStone(userData.targetId, userData.stoneKind || 'big');
                        await context.send(`✅ Камень брошен!\nОтвет сервера: ${JSON.stringify(result)}`, {
                            keyboard: getMainKeyboard()
                        });
                    } catch (err) {
                        await context.send(`❌ Ошибка: ${err.message}`, {
                            keyboard: getMainKeyboard()
                        });
                    }
                    break;
                }

                case 'delete_account': {
                    if (!userData.sign) {
                        await context.send('❌ Аккаунт не добавлен.', {
                            keyboard: getMainKeyboard()
                        });
                        break;
                    }
                    delete userData.sign;
                    delete userData.userId;
                    delete userData.client;
                    await context.send('✅ Аккаунт удалён.', {
                        keyboard: getMainKeyboard()
                    });
                    break;
                }

                case 'cancel': {
                    state.action = null;
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
                await context.send('❌ Не удалось извлечь vk_user_id. Проверьте правильность строки.', {
                    keyboard: getCancelKeyboard()
                });
                return;
            }

            const client = new GameClient(sign, parsedUserId);
            try {
                await client.authenticate();
            } catch (err) {
                await context.send(`❌ Ошибка: ${err.message}`, {
                    keyboard: getCancelKeyboard()
                });
                return;
            }

            userData.sign = sign;
            userData.userId = parsedUserId;
            userData.client = client;
            if (!userData.stoneKind) userData.stoneKind = 'big';
            if (!userData.targetId) userData.targetId = '';

            state.action = null;
            await context.send(`✅ Аккаунт для пользователя ${parsedUserId} успешно добавлен.`, {
                keyboard: getMainKeyboard()
            });
            return;
        }

        if (state.action === 'waiting_target') {
            const targetId = text;
            if (!/^\d+$/.test(targetId)) {
                await context.send('❌ ID жертвы должен быть числом.', {
                    keyboard: getCancelKeyboard()
                });
                return;
            }
            userData.targetId = targetId;
            state.action = null;
            await context.send(`✅ Жертва установлена: ${targetId}.`, {
                keyboard: getMainKeyboard()
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
                await context.send('❓ Неизвестная команда. Нажмите "Меню" для начала.', {
                    keyboard: getMainKeyboard()
                });
                break;
            }
        }
    } catch (error) {
        console.error('Ошибка:', error);
        await context.send(`⚠️ Произошла ошибка: ${error.message}`, {
            keyboard: getMainKeyboard()
        });
    }
});

vk.updates.start().then(() => {
    console.log('✅ Бот запущен');
}).catch((err) => {
    console.error('❌ Ошибка:', err);
});