const axios = require('axios');

// ========== НАСТРОЙКИ ==========
const TOKEN = 'vk1.a.i6UX9gZIVlqb4CjN_SWB0Y9NnmWT0Hboi1RT1Wf0jxFic52ZXOyV6R_-Lkm-s25IQ8eDHvSf8QOP0TUkgaTOHeNJdXROGTDXw912F4r1SpRP6mVBITEUzZ0ZZ3EC1gAwTuI4iNDItgPWmndwdaP0tNlIaoGoNwg9k_KddLK6hLSLr8G7R09cSWo8ovGqFnlop23CCRfmcK-4VJPzVEkOAA';

const PEER_ID = 2000000114;  

const API_VERSION = '5.199';


const WORDS = ['!работать'];


async function sendMessage() {
    try {
        
        const randomWord = WORDS[Math.floor(Math.random() * WORDS.length)];
        
        
        const response = await axios.get('https://api.vk.com/method/messages.send', {
            params: {
                access_token: TOKEN,
                v: API_VERSION,
                peer_id: PEER_ID,
                message: randomWord,
                random_id: Math.floor(Math.random() * 1000000000) // уникальный ID сообщения
            }
        });
        
        // Проверка на ошибки
        if (response.data.error) {
            console.error('❌ Ошибка API:', response.data.error.error_msg);
            if (response.data.error.error_code === 5) {
                console.error('⚠️ Токен недействителен или истёк!');
            }
            return false;
        }
        
        console.log(`✅ [${new Date().toLocaleString()}] Отправлено: "${randomWord}"`);
        return true;
        
    } catch (error) {
        console.error('❌ Ошибка при отправке:', error.message);
        return false;
    }
}

// ========== ЗАПУСК БОТА ==========
console.log('🚀 Бот запущен!');
console.log(`📝 Беседа: VAZNA GROUP (Peer ID: ${PEER_ID})`);
console.log(`⏰ Отправка каждые 4 часа (${4 * 60 * 60 * 1000} мс)`);
console.log(`📦 Слова: ${WORDS.join(', ')}`);
console.log('━'.repeat(50));

// Отправляем первое сообщение через 5 секунд после запуска
setTimeout(() => {
    sendMessage();
}, 5000);

// Устанавливаем интервал отправки каждые 4 часа
// 4 часа = 4 * 60 * 60 * 1000 = 14400000 миллисекунд
const intervalMs = 4 * 60 * 60 * 1000;
setInterval(sendMessage, intervalMs);

// Обработка остановки бота (Ctrl+C)
process.on('SIGINT', () => {
    console.log('\n🛑 Бот остановлен');
    process.exit();
});