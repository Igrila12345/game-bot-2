const axios = require('axios');

// ========== НАСТРОЙКИ ==========
const ACCOUNTS = [
    {
        token: 'vk1.a.wzXDZq6PzvYV6zxwCiUgewI6uwguZsy2X9z34o6ySFiv6HOaaEEbpfaRaDUjSRgjShwx4aAhmWm3_ZrVJi3wrR39KijBygmRHgppH6EpDSAU-g3ih91VObrt8jk-8hRSD2ftSw6SSqiakWJF0axVx6VX4dxHQH-4pFB9I0vYzgd5oWMu5Rk2PcKSCkGDrQmxCQq2gjb8O1f_irqb5blgXQ',
        peer_id: 2000000107
    },
    {
        token: 'vk1.a._NsCJq0Dfi9YPML-bKgeTo1IC387hb4cktHoRpC4f1-HUuKDbSWbkADWHHge8b8uJ6Q42U63CMLNDiq89-9n75wxjLJefQGKjpIC5snrHM96Tj4eEPBGJQVCfsfVWwCRoC0Zc40Pa-LzP9zL7zJq2YFKjNk7DP2GROZ8uJ7eox6gjdQ-mxcqSVBrZlyEqEjeLz8-YLA3tIS7OgnnCoriXQ',
        peer_id: 2000000161
    }
];

const API_VERSION = '5.199';
const WORDS = ['работа', 'ферма', 'бизнес'];

// ========== ПРОВЕРКА ДОСТУПА К БЕСЕДЕ ==========
async function checkAccess(token, peer_id, accountNumber) {
    try {
        const response = await axios.get('https://api.vk.com/method/messages.getConversations', {
            params: {
                access_token: token,
                v: API_VERSION,
                count: 200
            }
        });
        
        if (response.data.error) {
            console.error(`❌ [Аккаунт ${accountNumber}] Ошибка доступа:`, response.data.error.error_msg);
            return false;
        }
        
        const items = response.data.response.items || [];
        const hasAccess = items.some(item => item.conversation.peer.id === peer_id);
        
        if (hasAccess) {
            console.log(`✅ [Аккаунт ${accountNumber}] Есть доступ к беседе ${peer_id}`);
            return true;
        } else {
            console.log(`❌ [Аккаунт ${accountNumber}] НЕТ доступа к беседе ${peer_id}!`);
            return false;
        }
        
    } catch (error) {
        console.error(`❌ [Аккаунт ${accountNumber}] Ошибка проверки:`, error.message);
        return false;
    }
}

// ========== ОТПРАВКА ==========
async function sendFromAccount(account, accountNumber) {
    try {
        const randomWord = WORDS[Math.floor(Math.random() * WORDS.length)];
        
        console.log(`📤 [Аккаунт ${accountNumber}] Отправка в ${account.peer_id}: "${randomWord}"...`);
        
        const response = await axios.get('https://api.vk.com/method/messages.send', {
            params: {
                access_token: account.token,
                v: API_VERSION,
                peer_id: account.peer_id,
                message: randomWord,
                random_id: Math.floor(Math.random() * 1000000000)
            }
        });
        
        if (response.data.error) {
            const errorCode = response.data.error.error_code;
            const errorMsg = response.data.error.error_msg;
            
            console.error(`❌ [Аккаунт ${accountNumber}] Ошибка ${errorCode}: ${errorMsg}`);
            
            if (errorCode === 901) {
                console.error(`   ⚠️ Аккаунт ${accountNumber} НЕ добавлен в беседу ${account.peer_id}!`);
            }
            return false;
        }
        
        console.log(`✅ [${new Date().toLocaleString()}] [Аккаунт ${accountNumber}] Отправлено: "${randomWord}" в беседу ${account.peer_id}`);
        return true;
        
    } catch (error) {
        console.error(`❌ [Аккаунт ${accountNumber}] Ошибка:`, error.message);
        return false;
    }
}

// ========== ОДНОВРЕМЕННАЯ ОТПРАВКА ==========
async function sendMessages() {
    console.log(`\n🚀 [${new Date().toLocaleString()}] Отправка с двух аккаунтов...`);
    console.log(`📝 Аккаунт 1 → беседа ${ACCOUNTS[0].peer_id}`);
    console.log(`📝 Аккаунт 2 → беседа ${ACCOUNTS[1].peer_id}`);
    console.log('━'.repeat(50));
    
    // Проверяем доступ
    const accessResults = await Promise.all([
        checkAccess(ACCOUNTS[0].token, ACCOUNTS[0].peer_id, 1),
        checkAccess(ACCOUNTS[1].token, ACCOUNTS[1].peer_id, 2)
    ]);
    
    // Отправляем только те аккаунты, у которых есть доступ
    const sendPromises = [];
    
    if (accessResults[0]) {
        sendPromises.push(sendFromAccount(ACCOUNTS[0], 1));
    } else {
        console.log(`⛔ [Аккаунт 1] Пропуск отправки - нет доступа к беседе ${ACCOUNTS[0].peer_id}`);
    }
    
    if (accessResults[1]) {
        sendPromises.push(sendFromAccount(ACCOUNTS[1], 2));
    } else {
        console.log(`⛔ [Аккаунт 2] Пропуск отправки - нет доступа к беседе ${ACCOUNTS[1].peer_id}`);
    }
    
    if (sendPromises.length === 0) {
        console.log(`❌ Нет аккаунтов с доступом к беседам!`);
        return;
    }
    
    const results = await Promise.all(sendPromises);
    const successCount = results.filter(r => r === true).length;
    console.log(`📊 Результат: ${successCount}/${sendPromises.length} аккаунтов отправили`);
}

// ========== ЗАПУСК ==========
console.log('🚀 Бот запущен!');
console.log(`👥 Аккаунтов: ${ACCOUNTS.length}`);
console.log(`📝 Аккаунт 1 → беседа: ${ACCOUNTS[0].peer_id}`);
console.log(`📝 Аккаунт 2 → беседа: ${ACCOUNTS[1].peer_id}`);
console.log(`⏰ Отправка каждые 4 часа`);
console.log(`📦 Слова: ${WORDS.join(', ')}`);
console.log(`🔒 Режим: отправка ТОЛЬКО если есть доступ`);
console.log('━'.repeat(50));

// Первая отправка через 3 секунды
setTimeout(() => {
    sendMessages();
}, 3000);

// Интервал каждые 4 часа
const intervalMs = 4 * 60 * 60 * 1000;
setInterval(sendMessages, intervalMs);

process.on('SIGINT', () => {
    console.log('\n🛑 Бот остановлен');
    process.exit();
});