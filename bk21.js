const { VK, Keyboard } = require('vk-io');
const axios = require('axios');
const { URLSearchParams } = require('url');
const fs = require('fs');
const path = require('path');

const VK_TOKEN = 'vk1.a.4IlhuFVi18emk6Ihsh6C_OFlrmXNSbOIlpkUZHpsycnLoVv5sZ8YMb2nOUzyQIMgc4fVgr9T8zuYDdilWF7XKvTMCNR2PvpuobtNClSjIg5VBQ7Z18sfAd4LZGhj3ssNRX69VYWZwFYdcqAQrNdqaJSjGCR_Q4Jdl4CNQ3lwiKRMEgYlKewqpvX06GnQkBqlrg1vmHUF6PLtpViT4TaQ8g';
const GROUP_ID = '238935844';
const GAME_BASE_URL = 'https://www.slaves-vk.ru';
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const LOGS_DIR = path.join(DATA_DIR, 'logs');
const LOGS_FILE = path.join(LOGS_DIR, 'buying_logs.json');

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    reset: '\x1b[0m'
};

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR);

let usersData = {};
try { if (fs.existsSync(USERS_FILE)) usersData = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch(e) {}

let buyingLogs = {};
try { if (fs.existsSync(LOGS_FILE)) buyingLogs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8')); } catch(e) {}

function saveUsersData() { try { fs.writeFileSync(USERS_FILE, JSON.stringify(usersData, null, 2)); } catch(e) {} }
function saveLogs() { try { fs.writeFileSync(LOGS_FILE, JSON.stringify(buyingLogs, null, 2)); } catch(e) {} }

function addLog(userId, accountId, type, message, data = {}) {
    if (!buyingLogs[userId]) buyingLogs[userId] = {};
    if (!buyingLogs[userId][accountId]) buyingLogs[userId][accountId] = [];
    buyingLogs[userId][accountId].push({ 
        timestamp: new Date().toISOString(), 
        type, 
        message, 
        data 
    });
    if (buyingLogs[userId][accountId].length > 1000) {
        buyingLogs[userId][accountId] = buyingLogs[userId][accountId].slice(-1000);
    }
    saveLogs();
}

const userStates = new Map();
const activeTasks = new Map();

class GameClient {
    constructor(vkSign, vkUserId) {
        this.vkSign = vkSign;
        this.userId = vkUserId;
        this.baseUrl = GAME_BASE_URL;
        this.sessionToken = null;
    }

    async authenticate() {
        try {
            const response = await axios.post(`${this.baseUrl}/api/profile`, 
                { name: "", avatar_url: "", ref_id: null },
                { headers: { 
                    'Content-Type': 'application/json', 
                    'x-vk-user-id': this.userId, 
                    'x-vk-sign': this.vkSign 
                }, timeout: 10000 }
            );
            if (!response.data.session_token) throw new Error('Не удалось получить session_token');
            this.sessionToken = response.data.session_token;
            return this.sessionToken;
        } catch (error) {
            throw new Error(`Ошибка авторизации: ${error.response?.data?.error || error.message}`);
        }
    }

    async getUserInfo(targetId) {
        if (!this.sessionToken) await this.authenticate();
        try {
            const response = await axios.get(`${this.baseUrl}/api/profile/${targetId}`, {
                headers: { 
                    'Content-Type': 'application/json', 
                    'x-vk-user-id': this.userId, 
                    'x-session': this.sessionToken, 
                    'x-vk-sign': this.vkSign 
                }, timeout: 10000
            });
            return response.data;
        } catch (error) {
            throw new Error(`Ошибка получения информации: ${error.response?.data?.error || error.message}`);
        }
    }

    async getVictimSlaves(targetId) {
        if (!this.sessionToken) await this.authenticate();
        try {
            const response = await axios.get(`${this.baseUrl}/api/profile/${targetId}/subjects`, {
                params: { offset: 0, limit: 25 },
                headers: { 
                    'Content-Type': 'application/json', 
                    'x-vk-user-id': this.userId, 
                    'x-session': this.sessionToken, 
                    'x-vk-sign': this.vkSign 
                }, timeout: 10000
            });
            return response.data.subjects || [];
        } catch (error) {
            throw new Error(`Ошибка получения витрины: ${error.response?.data?.error || error.message}`);
        }
    }

    async buySlave(slaveVkId, offerToken) {
        if (!this.sessionToken) await this.authenticate();
        try {
            const response = await axios.post(`${this.baseUrl}/api/market/buy`,
                { slave_vk_id: slaveVkId, offer_token: offerToken },
                { headers: { 
                    'Content-Type': 'application/json', 
                    'x-vk-user-id': this.userId, 
                    'x-session': this.sessionToken, 
                    'x-vk-sign': this.vkSign 
                }, timeout: 10000 }
            );
            return response.data;
        } catch (error) {
            throw new Error(`Ошибка покупки: ${error.response?.data?.error || error.message}`);
        }
    }
}

function extractUserIdFromSign(sign) {
    const params = new URLSearchParams(sign);
    return params.get('vk_user_id');
}

function formatUserInfo(user) {
    if (!user) return 'Информация не найдена';
    let message = `👤 ${user.name || 'Без имени'} (id${user.vk_id || user.id || 'unknown'})\n\n`;
    message += `💰 Баланс: ${(user.balance || 0).toLocaleString()} 🪙\n`;
    message += `🏷 Цена: ${(user.price || 0).toLocaleString()} 🪙\n`;
    if (user.income_per_hour !== undefined) message += `⛓ Доход: ${user.income_per_hour} 🪙/ч\n`;
    message += user.owner_name ? `👑 Властитель: ${user.owner_name}\n` : '👑 Властитель: Свободен\n';
    if (user.clan_name) message += `🏰 Клан: ${user.clan_name}\n`;
    return message;
}

function getMainKeyboard() {
    return Keyboard.keyboard([
        [Keyboard.textButton({ label: '➕ Добавить аккаунт', payload: { command: 'add_account' }, color: Keyboard.POSITIVE_COLOR }),
         Keyboard.textButton({ label: '📋 Мои аккаунты', payload: { command: 'list_accounts' }, color: Keyboard.PRIMARY_COLOR })],
        [Keyboard.textButton({ label: '👤 Инфо по ID', payload: { command: 'get_user_info' }, color: Keyboard.PRIMARY_COLOR })],
        [Keyboard.textButton({ label: '▶️ Запустить все', payload: { command: 'start_all' }, color: Keyboard.POSITIVE_COLOR }),
         Keyboard.textButton({ label: '⏹️ Остановить все', payload: { command: 'stop_all' }, color: Keyboard.NEGATIVE_COLOR })]
    ]);
}

function getCancelKeyboard() {
    return Keyboard.keyboard([[Keyboard.textButton({ label: '❌ Отмена', payload: { command: 'cancel' }, color: Keyboard.SECONDARY_COLOR })]]);
}

function getAccountsKeyboard(userId) {
    const accounts = Object.values(usersData[userId]?.accounts || {});
    if (accounts.length === 0) return getMainKeyboard();
    const buttons = accounts.map(acc => [Keyboard.textButton({ 
        label: `${acc.name} (${acc.status === 'running' ? '🟢' : '🔴'})`, 
        payload: { command: 'select_account', accountId: acc.id }, 
        color: acc.status === 'running' ? Keyboard.POSITIVE_COLOR : Keyboard.SECONDARY_COLOR 
    })]);
    buttons.push([Keyboard.textButton({ label: '🔙 Назад', payload: { command: 'back_to_main' }, color: Keyboard.SECONDARY_COLOR })]);
    return Keyboard.keyboard(buttons);
}

function getAccountManagementKeyboard(accountId, accountStatus) {
    const isRunning = accountStatus === 'running';
    return Keyboard.keyboard([
        [Keyboard.textButton({ 
            label: isRunning ? '⏹️ Остановить' : '▶️ Запустить', 
            payload: { command: isRunning ? 'stop_account' : 'start_account', accountId }, 
            color: isRunning ? Keyboard.NEGATIVE_COLOR : Keyboard.POSITIVE_COLOR 
        })],
        [Keyboard.textButton({ label: '🎯 Установить жертву', payload: { command: 'set_victim' }, color: Keyboard.PRIMARY_COLOR }),
         Keyboard.textButton({ label: '💰 Макс. цена', payload: { command: 'set_max_price' }, color: Keyboard.PRIMARY_COLOR })],
        [Keyboard.textButton({ label: '⏱️ Задержка', payload: { command: 'set_delay' }, color: Keyboard.PRIMARY_COLOR }),
         Keyboard.textButton({ label: '✏️ Переименовать', payload: { command: 'rename_account' }, color: Keyboard.SECONDARY_COLOR })],
        [Keyboard.textButton({ label: '👤 Инфо о жертве', payload: { command: 'get_victim_info' }, color: Keyboard.PRIMARY_COLOR }),
         Keyboard.textButton({ label: '📊 Логи', payload: { command: 'show_account_logs' }, color: Keyboard.SECONDARY_COLOR })],
        [Keyboard.textButton({ label: '🗑️ Удалить', payload: { command: 'delete_selected_account' }, color: Keyboard.NEGATIVE_COLOR }),
         Keyboard.textButton({ label: '🔙 К списку', payload: { command: 'list_accounts' }, color: Keyboard.SECONDARY_COLOR })]
    ]);
}

const vk = new VK({ token: VK_TOKEN, pollingGroupId: GROUP_ID });

async function sendNotification(userId, message) {
    try { 
        await vk.api.messages.send({ user_id: userId, message, random_id: Date.now() }); 
    } catch(e) {
        console.error('Ошибка отправки уведомления:', e);
    }
}

async function startBuyingLoop(userId, accountId) {
    const account = usersData[userId]?.accounts?.[accountId];
    if (!account || account.status === 'running') return;
    
    const client = new GameClient(account.sign, account.vkUserId);
    
    try {
        await client.authenticate();
        console.log(`${colors.green}[${new Date().toLocaleTimeString()}] Авторизация успешна для ${account.name}${colors.reset}`);
        addLog(userId, accountId, 'info', '✅ Авторизация успешна');
    } catch (error) {
        console.log(`${colors.red}[${new Date().toLocaleTimeString()}] Ошибка авторизации: ${error.message}${colors.reset}`);
        account.status = 'stopped';
        account.lastError = error.message;
        saveUsersData();
        addLog(userId, accountId, 'error', `❌ Ошибка авторизации: ${error.message}`);
        await sendNotification(userId, `❌ ${account.name}: ${error.message}`);
        return;
    }
    
    account.status = 'running';
    account.lastError = null;
    saveUsersData();
    
    let totalBought = account.totalBought || 0;
    let iteration = 0;
    
    if (!activeTasks.has(userId)) activeTasks.set(userId, new Map());
    
    const taskData = { 
        shouldStop: false, 
        interval: null,
        isRunning: false 
    };
    activeTasks.get(userId).set(accountId, taskData);
    
    console.log(`${colors.blue}[${new Date().toLocaleTimeString()}] Запущен цикл для ${account.name}${colors.reset}`);
    addLog(userId, accountId, 'info', '▶️ Цикл покупок запущен');

    const buyLoop = async () => {
        const currentTask = activeTasks.get(userId)?.get(accountId);
        
        if (!currentTask || currentTask.shouldStop || account.status !== 'running') {
            console.log(`${colors.yellow}[${new Date().toLocaleTimeString()}] Остановка цикла для ${account.name}${colors.reset}`);
            addLog(userId, accountId, 'info', '⏹️ Цикл покупок остановлен');
            if (currentTask?.interval) clearInterval(currentTask.interval);
            activeTasks.get(userId)?.delete(accountId);
            return false;
        }
        
        if (currentTask.isRunning) return true;
        currentTask.isRunning = true;
        
        iteration++;
        console.log(`${colors.yellow}\n=== ${account.name} - Итерация ${iteration} ===${colors.reset}`);
        addLog(userId, accountId, 'info', `=== Итерация ${iteration} ===`);
        
        try {
            console.log(`${colors.blue}Получение витрины жертвы...${colors.reset}`);
            const slaves = await client.getVictimSlaves(account.victimId);
            console.log(`${colors.blue}Найдено на витрине: ${slaves.length} рабов${colors.reset}`);
            addLog(userId, accountId, 'info', `Найдено на витрине: ${slaves.length} рабов`);
            
            if (slaves.length === 0) {
                console.log(`${colors.yellow}Витрина пуста, ждем ${account.delayBetweenWindows}мс...${colors.reset}`);
                addLog(userId, accountId, 'info', `Витрина пуста, ждем ${account.delayBetweenWindows}мс...`);
                currentTask.isRunning = false;
                return true;
            }
            
            const toBuy = slaves.filter(s => Math.floor(s.price / 2) <= account.maxPrice);
            console.log(`${colors.blue}К покупке: ${toBuy.length} рабов${colors.reset}`);
            addLog(userId, accountId, 'info', `К покупке: ${toBuy.length} рабов (макс. цена: ${account.maxPrice})`);
            
            if (toBuy.length === 0) {
                console.log(`${colors.yellow}Нет рабов дешевле ${account.maxPrice}, ждем...${colors.reset}`);
                addLog(userId, accountId, 'info', `Нет рабов дешевле ${account.maxPrice}, ждем...`);
                currentTask.isRunning = false;
                return true;
            }
            
            for (const slave of toBuy) {
                const stopCheck = activeTasks.get(userId)?.get(accountId);
                if (!stopCheck || stopCheck.shouldStop || account.status !== 'running') {
                    console.log(`${colors.yellow}[${new Date().toLocaleTimeString()}] Остановка выполнения...${colors.reset}`);
                    addLog(userId, accountId, 'info', '⏹️ Остановка выполнения по команде');
                    currentTask.isRunning = false;
                    return false;
                }
                
                try {
                    const result = await client.buySlave(slave.vk_id, slave.offer_token);
                    totalBought++;
                    account.totalBought = totalBought;
                    saveUsersData();
                    
                    const price = Math.floor(slave.price / 2);
                    const income = slave.income_per_hour || 0;
                    
                    const logMsg = `✅ ${slave.name || 'Без имени'} | Цена: ${price} | Доход: ${income}/ч | Всего куплено: ${totalBought} | Баланс: ${result.new_balance}`;
                    
                    console.log(`${colors.green}${logMsg}${colors.reset}`);
                    addLog(userId, accountId, 'success', logMsg, { 
                        slaveName: slave.name || 'Без имени',
                        price,
                        income,
                        totalBought,
                        newBalance: result.new_balance,
                        serverResponse: result 
                    });
                    
                    await sendNotification(userId, `${account.name}: ${logMsg}`);
                    
                } catch (error) {
                    const errorMsg = `❌ ${slave.name || 'Без имени'} | Ошибка: ${error.message}`;
                    console.log(`${colors.red}${errorMsg}${colors.reset}`);
                    addLog(userId, accountId, 'error', errorMsg);
                    await sendNotification(userId, `${account.name}: ${errorMsg}`);
                }
                
                if (account.delayBetweenBuys > 0) {
                    await new Promise(r => setTimeout(r, account.delayBetweenBuys));
                }
            }
            
            const summaryMsg = `Итого куплено за все время: ${totalBought}`;
            console.log(`${colors.yellow}${summaryMsg}${colors.reset}`);
            addLog(userId, accountId, 'info', summaryMsg);
            
            const waitMsg = `Жду ${account.delayBetweenWindows}мс перед обновлением витрины...`;
            console.log(`${colors.yellow}${waitMsg}${colors.reset}`);
            addLog(userId, accountId, 'info', waitMsg);
            
            currentTask.isRunning = false;
            return true;
            
        } catch (error) {
            const errorMsg = `Ошибка в итерации ${iteration}: ${error.message}`;
            console.log(`${colors.red}${errorMsg}${colors.reset}`);
            addLog(userId, accountId, 'error', errorMsg);
            currentTask.isRunning = false;
            return true;
        }
    };

    const interval = setInterval(async () => {
        const shouldContinue = await buyLoop();
        if (!shouldContinue) {
            clearInterval(interval);
        }
    }, account.delayBetweenWindows || 1000);
    
    taskData.interval = interval;
    
    await buyLoop();
}

function stopBuyingLoop(userId, accountId) {
    const account = usersData[userId]?.accounts?.[accountId];
    if (!account) {
        console.log(`${colors.red}Аккаунт не найден${colors.reset}`);
        return;
    }
    
    const task = activeTasks.get(userId)?.get(accountId);
    if (task) {
        console.log(`${colors.yellow}[${new Date().toLocaleTimeString()}] Останавливаем ${account.name}...${colors.reset}`);
        task.shouldStop = true;
        if (task.interval) {
            clearInterval(task.interval);
            task.interval = null;
        }
        activeTasks.get(userId).delete(accountId);
    }
    
    account.status = 'stopped';
    saveUsersData();
    
    console.log(`${colors.yellow}Аккаунт ${account.name} остановлен${colors.reset}`);
    addLog(userId, accountId, 'info', '⏹️ Аккаунт остановлен');
}

vk.updates.on('message_new', async (context) => {
    const userId = context.senderId;
    const text = context.text ? context.text.trim() : '';
    const payload = context.messagePayload || {};
    if (!text && !payload.command) return;
    
    if (!usersData[userId]) usersData[userId] = { accounts: {}, selectedAccountId: null };
    if (!userStates.has(userId)) userStates.set(userId, { action: null, tempData: {} });
    const state = userStates.get(userId);

    try {
        if (payload.command) {
            switch (payload.command) {
                case 'add_account': 
                    state.action = 'waiting_account_name'; 
                    state.tempData = {}; 
                    await context.send('📝 Введите название для аккаунта:', { keyboard: getCancelKeyboard() }); 
                    break;
                    
                case 'get_user_info': 
                    state.action = 'waiting_user_id_for_info'; 
                    await context.send('👤 Введите ID пользователя:', { keyboard: getCancelKeyboard() }); 
                    break;
                    
                case 'get_victim_info': {
                    const account = usersData[userId].accounts[usersData[userId].selectedAccountId];
                    if (!account) { 
                        await context.send('❌ Сначала выберите аккаунт', { keyboard: getAccountsKeyboard(userId) }); 
                        break; 
                    }
                    if (!account.victimId) { 
                        await context.send('❌ Установите жертву', { keyboard: getAccountManagementKeyboard(account.id, account.status) }); 
                        break; 
                    }
                    
                    const client = new GameClient(account.sign, account.vkUserId);
                    try { 
                        const info = await client.getUserInfo(account.victimId); 
                        await context.send(formatUserInfo(info), { keyboard: getAccountManagementKeyboard(account.id, account.status) }); 
                    } catch(e) { 
                        await context.send(`❌ ${e.message}`, { keyboard: getAccountManagementKeyboard(account.id, account.status) }); 
                    }
                    break;
                }
                    
                case 'list_accounts': {
                    const accounts = Object.values(usersData[userId].accounts);
                    if (accounts.length === 0) { 
                        await context.send('❌ У вас нет аккаунтов', { keyboard: getMainKeyboard() }); 
                        break; 
                    }
                    
                    let message = '📋 Ваши аккаунты:\n\n';
                    accounts.forEach((acc, i) => { 
                        message += `${i+1}. ${acc.name} (${acc.status === 'running' ? '🟢' : '🔴'})\n`;
                        message += `   ID: ${acc.vkUserId}\n`;
                        message += `   Жертва: ${acc.victimId || 'нет'}\n`;
                        message += `   Макс. цена: ${acc.maxPrice}\n`;
                        message += `   Куплено: ${acc.totalBought || 0}\n\n`;
                    });
                    
                    await context.send(message, { keyboard: getAccountsKeyboard(userId) });
                    break;
                }
                    
                case 'select_account': {
                    const account = usersData[userId].accounts[payload.accountId];
                    if (!account) { 
                        await context.send('❌ Аккаунт не найден', { keyboard: getMainKeyboard() }); 
                        break; 
                    }
                    
                    usersData[userId].selectedAccountId = payload.accountId;
                    saveUsersData();
                    await context.send(`✅ Выбран: ${account.name}`, { keyboard: getAccountManagementKeyboard(payload.accountId, account.status) });
                    break;
                }
                    
                case 'start_account': {
                    const accountId = payload.accountId || usersData[userId].selectedAccountId;
                    if (!accountId) { 
                        await context.send('❌ Выберите аккаунт', { keyboard: getAccountsKeyboard(userId) }); 
                        break; 
                    }
                    
                    const account = usersData[userId].accounts[accountId];
                    if (!account) {
                        await context.send('❌ Аккаунт не найден', { keyboard: getAccountsKeyboard(userId) });
                        break;
                    }
                    
                    if (!account.victimId) { 
                        await context.send('❌ Установите жертву', { keyboard: getAccountManagementKeyboard(accountId, account.status) }); 
                        break; 
                    }
                    
                    if (account.status === 'running') { 
                        await context.send('❌ Уже запущен', { keyboard: getAccountManagementKeyboard(accountId, account.status) }); 
                        break; 
                    }
                    
                    await context.send(`▶️ Запускаю ${account.name}...`);
                    
                    startBuyingLoop(userId, accountId).catch(error => {
                        console.error('Ошибка в цикле покупок:', error);
                        account.status = 'stopped';
                        account.lastError = error.message;
                        saveUsersData();
                    });
                    
                    setTimeout(async () => { 
                        const acc = usersData[userId].accounts[accountId];
                        if (acc && acc.status === 'running') {
                            await context.send(`✅ ${acc.name} запущен`, { keyboard: getAccountManagementKeyboard(accountId, acc.status) });
                        } else if (acc) {
                            await context.send(`❌ Не удалось запустить ${acc.name}: ${acc.lastError || 'неизвестная ошибка'}`, { keyboard: getAccountManagementKeyboard(accountId, acc.status) });
                        }
                    }, 2000);
                    break;
                }
                    
                case 'stop_account': {
                    const accountId = payload.accountId || usersData[userId].selectedAccountId;
                    if (!accountId) { 
                        await context.send('❌ Выберите аккаунт', { keyboard: getAccountsKeyboard(userId) }); 
                        break; 
                    }
                    
                    const account = usersData[userId].accounts[accountId];
                    if (!account) {
                        await context.send('❌ Аккаунт не найден', { keyboard: getAccountsKeyboard(userId) });
                        break;
                    }
                    
                    stopBuyingLoop(userId, accountId);
                    await context.send(`⏹️ ${account.name} остановлен`, { keyboard: getAccountManagementKeyboard(accountId, 'stopped') });
                    break;
                }
                    
                case 'start_all': {
                    const accounts = Object.values(usersData[userId].accounts);
                    let started = 0;
                    
                    for (const acc of accounts) { 
                        if (acc.victimId && acc.status !== 'running') { 
                            startBuyingLoop(userId, acc.id).catch(error => {
                                console.error('Ошибка запуска:', error);
                            });
                            started++; 
                        } 
                    }
                    
                    await context.send(
                        started === 0 ? '❌ Нет аккаунтов для запуска' : `✅ Запущено: ${started}`, 
                        { keyboard: getMainKeyboard() }
                    );
                    break;
                }
                    
                case 'stop_all': {
                    const accounts = Object.values(usersData[userId].accounts);
                    let stopped = 0;
                    
                    for (const acc of accounts) { 
                        if (acc.status === 'running') { 
                            stopBuyingLoop(userId, acc.id); 
                            stopped++; 
                        } 
                    }
                    
                    await context.send(`⏹️ Остановлено: ${stopped}`, { keyboard: getMainKeyboard() });
                    break;
                }
                    
                case 'set_victim': 
                    if (!usersData[userId].selectedAccountId) { 
                        await context.send('❌ Выберите аккаунт', { keyboard: getAccountsKeyboard(userId) }); 
                        break; 
                    } 
                    state.action = 'waiting_victim'; 
                    await context.send('🎯 Введите ID жертвы:', { keyboard: getCancelKeyboard() }); 
                    break;
                    
                case 'set_max_price': 
                    if (!usersData[userId].selectedAccountId) { 
                        await context.send('❌ Выберите аккаунт', { keyboard: getAccountsKeyboard(userId) }); 
                        break; 
                    } 
                    state.action = 'waiting_max_price'; 
                    await context.send('💰 Введите макс. цену:', { keyboard: getCancelKeyboard() }); 
                    break;
                    
                case 'set_delay': 
                    if (!usersData[userId].selectedAccountId) { 
                        await context.send('❌ Выберите аккаунт', { keyboard: getAccountsKeyboard(userId) }); 
                        break; 
                    } 
                    state.action = 'waiting_delay'; 
                    await context.send('⏱️ Введите задержку (мс):', { keyboard: getCancelKeyboard() }); 
                    break;
                    
                case 'rename_account': 
                    if (!usersData[userId].selectedAccountId) { 
                        await context.send('❌ Выберите аккаунт', { keyboard: getAccountsKeyboard(userId) }); 
                        break; 
                    } 
                    state.action = 'waiting_rename'; 
                    await context.send('✏️ Введите новое имя:', { keyboard: getCancelKeyboard() }); 
                    break;
                    
                case 'delete_selected_account': {
                    const accountId = usersData[userId].selectedAccountId;
                    if (!accountId) { 
                        await context.send('❌ Выберите аккаунт', { keyboard: getAccountsKeyboard(userId) }); 
                        break; 
                    }
                    
                    stopBuyingLoop(userId, accountId);
                    delete usersData[userId].accounts[accountId];
                    usersData[userId].selectedAccountId = null;
                    saveUsersData();
                    
                    await context.send('✅ Аккаунт удален', { keyboard: getMainKeyboard() });
                    break;
                }
                    
                case 'show_account_logs': {
                    const account = usersData[userId].accounts[usersData[userId].selectedAccountId];
                    if (!account) { 
                        await context.send('❌ Выберите аккаунт', { keyboard: getAccountsKeyboard(userId) }); 
                        break; 
                    }
                    
                    const logs = buyingLogs[userId]?.[account.id] || [];
                    let message = `📊 Логи ${account.name}:\n\n`;
                    
                    if (logs.length === 0) {
                        message += 'Нет логов';
                    } else {
                        logs.slice(-30).forEach(log => { 
                            const time = new Date(log.timestamp).toLocaleTimeString();
                            message += `[${time}] ${log.message}\n`; 
                        });
                    }
                    
                    await context.send(message, { keyboard: getAccountManagementKeyboard(account.id, account.status) });
                    break;
                }
                    
                case 'back_to_main': 
                    usersData[userId].selectedAccountId = null; 
                    await context.send('Главное меню:', { keyboard: getMainKeyboard() }); 
                    break;
                    
                case 'cancel': 
                    state.action = null; 
                    state.tempData = {}; 
                    const acc = usersData[userId].accounts[usersData[userId].selectedAccountId]; 
                    await context.send('✅ Отменено', { 
                        keyboard: acc ? getAccountManagementKeyboard(acc.id, acc.status) : getMainKeyboard() 
                    }); 
                    break;
            }
            return;
        }

        if (state.action === 'waiting_account_name') { 
            state.tempData.accountName = text; 
            state.action = 'waiting_account_sign'; 
            await context.send('📝 Введите строку подписи:', { keyboard: getCancelKeyboard() }); 
            return; 
        }
        
        if (state.action === 'waiting_account_sign') {
            const parsedUserId = extractUserIdFromSign(text);
            if (!parsedUserId) { 
                await context.send('❌ Не удалось извлечь vk_user_id', { keyboard: getCancelKeyboard() }); 
                return; 
            }
            
            const client = new GameClient(text, parsedUserId);
            try { 
                await client.authenticate(); 
            } catch(e) { 
                await context.send(`❌ ${e.message}`, { keyboard: getCancelKeyboard() }); 
                return; 
            }
            
            const accountId = Date.now().toString();
            usersData[userId].accounts[accountId] = { 
                id: accountId, 
                name: state.tempData.accountName || `Аккаунт ${Object.keys(usersData[userId].accounts).length + 1}`, 
                sign: text, 
                vkUserId: parsedUserId, 
                victimId: '', 
                maxPrice: 25000, 
                delayBetweenBuys: 50, 
                delayBetweenWindows: 1000, 
                status: 'stopped', 
                totalBought: 0, 
                lastError: null 
            };
            saveUsersData();
            state.action = null; 
            state.tempData = {};
            
            await context.send('✅ Аккаунт добавлен', { keyboard: getMainKeyboard() });
            return;
        }
        
        if (state.action === 'waiting_user_id_for_info') {
            const targetId = text;
            if (!/^\d+$/.test(targetId)) { 
                await context.send('❌ ID должен быть числом', { keyboard: getCancelKeyboard() }); 
                return; 
            }
            
            const account = Object.values(usersData[userId].accounts)[0];
            if (!account) { 
                await context.send('❌ Сначала добавьте аккаунт', { keyboard: getMainKeyboard() }); 
                state.action = null; 
                return; 
            }
            
            const client = new GameClient(account.sign, account.vkUserId);
            try { 
                const info = await client.getUserInfo(targetId); 
                await context.send(formatUserInfo(info), { keyboard: getMainKeyboard() }); 
            } catch(e) { 
                await context.send(`❌ ${e.message}`, { keyboard: getMainKeyboard() }); 
            }
            state.action = null;
            return;
        }
        
        if (state.action === 'waiting_victim') { 
            if (!/^\d+$/.test(text)) { 
                await context.send('❌ ID должен быть числом', { keyboard: getCancelKeyboard() }); 
                return; 
            } 
            const accountId = usersData[userId].selectedAccountId; 
            usersData[userId].accounts[accountId].victimId = text; 
            saveUsersData(); 
            state.action = null; 
            
            await context.send(`✅ Жертва: ${text}`, { 
                keyboard: getAccountManagementKeyboard(accountId, usersData[userId].accounts[accountId].status) 
            }); 
            return; 
        }
        
        if (state.action === 'waiting_max_price') { 
            const price = parseInt(text); 
            if (isNaN(price) || price <= 0) { 
                await context.send('❌ Введите число', { keyboard: getCancelKeyboard() }); 
                return; 
            } 
            const accountId = usersData[userId].selectedAccountId; 
            usersData[userId].accounts[accountId].maxPrice = price; 
            saveUsersData(); 
            state.action = null; 
            
            await context.send(`✅ Макс. цена: ${price}`, { 
                keyboard: getAccountManagementKeyboard(accountId, usersData[userId].accounts[accountId].status) 
            }); 
            return; 
        }
        
        if (state.action === 'waiting_delay') { 
            const delay = parseInt(text); 
            if (isNaN(delay) || delay < 0) { 
                await context.send('❌ Введите число', { keyboard: getCancelKeyboard() }); 
                return; 
            } 
            const accountId = usersData[userId].selectedAccountId; 
            usersData[userId].accounts[accountId].delayBetweenWindows = delay; 
            saveUsersData(); 
            state.action = null; 
            
            await context.send(`✅ Задержка: ${delay}мс`, { 
                keyboard: getAccountManagementKeyboard(accountId, usersData[userId].accounts[accountId].status) 
            }); 
            return; 
        }
        
        if (state.action === 'waiting_rename') { 
            const accountId = usersData[userId].selectedAccountId; 
            usersData[userId].accounts[accountId].name = text; 
            saveUsersData(); 
            state.action = null; 
            
            await context.send(`✅ Переименован: ${text}`, { 
                keyboard: getAccountManagementKeyboard(accountId, usersData[userId].accounts[accountId].status) 
            }); 
            return; 
        }

        const command = text.toLowerCase();
        if (['начать', 'старт', 'меню'].includes(command)) { 
            await context.send('👋 Добро пожаловать!', { keyboard: getMainKeyboard() }); 
        }
    } catch (error) {
        console.error('Ошибка:', error);
        await context.send(`⚠️ Ошибка: ${error.message}`, { keyboard: getMainKeyboard() });
    }
});

function restoreRunningAccounts() {
    for (const userId in usersData) {
        for (const accountId in usersData[userId].accounts) {
            if (usersData[userId].accounts[accountId].status === 'running') {
                startBuyingLoop(userId, accountId);
            }
        }
    }
}

vk.updates.start().then(() => {
    console.log('✅ Бот запущен');
    restoreRunningAccounts();
}).catch((err) => {
    console.error('❌ Ошибка:', err);
});