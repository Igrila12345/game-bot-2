import axios from 'axios'
import fs from 'fs'

// ═══════════════════════════════════════════
//                  КОНФИГ
// ═══════════════════════════════════════════
const BOT_TOKEN    = 'vk1.a.6zcw8dMQbsOshIvFswwe2Zez9UFSuNJO2bPItPenkXMvRpyOQ4RBLtUEHypC41QO_wPdFBl7SyMQ-tRpOtpwdE52TjqAAQ3MlkgKSM97pO1UPvpheybR4UmbpVi-Rko_QzGy3G8v_QzzL1GDBTpqqct2wf89RYCjeqwo6hushj8ockf0juWy4YLKlgHscuS3_IIoLQAlvnNzgoSkBIvbIQ'
const ADMIN_ID     = 660964860
const STORAGE_FILE = './data.json'
const POLL_MS      = 2000

// ═══════════════════════════════════════════
//                 ХРАНИЛИЩЕ
// ═══════════════════════════════════════════
function loadDB() {
    try {
        if (fs.existsSync(STORAGE_FILE)) {
            const raw = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'))
            if (!Array.isArray(raw.authorized))    raw.authorized    = [ADMIN_ID]
            if (!Array.isArray(raw.accounts))      raw.accounts      = []
            if (!Array.isArray(raw.adminAccounts)) raw.adminAccounts = []
            return raw
        }
    } catch (_) {}
    return { authorized: [ADMIN_ID], accounts: [], adminAccounts: [] }
}
function saveDB() {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(db, null, 2))
}
let db = loadDB()
// Страховка после загрузки
if (!Array.isArray(db.accounts))      db.accounts      = []
if (!Array.isArray(db.authorized))    db.authorized    = [ADMIN_ID]
if (!Array.isArray(db.adminAccounts)) db.adminAccounts = []

// ═══════════════════════════════════════════
//      НАЧАЛЬНЫЕ ФРЕЙМЫ (только для админа)
// ═══════════════════════════════════════════
const INITIAL_FRAMES = [
    'https://rabstvonext.ru/?vk_access_token_settings=&vk_app_id=51556925&vk_are_notifications_enabled=0&vk_is_app_user=0&vk_is_favorite=0&vk_language=ru&vk_platform=web_external&vk_ref=other&vk_ts=1708687847&vk_user_id=52828239&sign=jlY1Ff6FMSg3ka3FXivT1jZS7YUvldOPrN3foDmx-1g',
    'https://rabstvonext.ru/?vk_access_token_settings=&vk_app_id=51556925&vk_are_notifications_enabled=1&vk_is_app_user=1&vk_is_favorite=0&vk_language=ru&vk_platform=&vk_ref=other&vk_ts=1708687331&vk_user_id=454204598&sign=I_3Nz2dcPCeQGRmF-Qtca8FdHhom434h0k5RzAy6oKU',
    'https://rabstvonext.ru/?vk_access_token_settings=&vk_app_id=51556925&vk_are_notifications_enabled=0&vk_is_app_user=0&vk_is_favorite=0&vk_language=ru&vk_platform=web_external&vk_ref=other&vk_ts=1708687825&vk_user_id=52399524&sign=kA_WFKQTg4VSULP8-NwDjA55tGQjZ8m0IDWGxfa0UBY',
    'https://rabstvonext.ru/?vk_access_token_settings=&vk_app_id=51556925&vk_are_notifications_enabled=0&vk_is_app_user=0&vk_is_favorite=0&vk_language=en&vk_platform=web_external&vk_ref=other&vk_ts=1708687473&vk_user_id=808280963&sign=VhzybY7CzMSdxu_Fv6NiYaSv1ESX9gwfSjZnJQ593VE',
    'https://rabstvonext.ru/?vk_access_token_settings=&vk_app_id=51556925&vk_are_notifications_enabled=0&vk_is_app_user=0&vk_is_favorite=0&vk_language=ru&vk_platform=web_external&vk_ref=other&vk_ts=1708687531&vk_user_id=164231029&sign=sGQ4wFDNkhb7kve6f5ipYtHIieoeIS9DX58IS7ocyYg',
    'https://rabstvonext.ru/?vk_access_token_settings=&vk_app_id=51556925&vk_are_notifications_enabled=0&vk_is_app_user=1&vk_is_favorite=0&vk_language=ru&vk_platform=web_external&vk_ref=other&vk_ts=1708687604&vk_user_id=479094212&sign=LtpP9qj18aShzOlX6w4fP1C6HYhsDPAu8o_fWbI93fU',
    'https://rabstvonext.ru/?vk_access_token_settings=&vk_app_id=51556925&vk_are_notifications_enabled=0&vk_is_app_user=1&vk_is_favorite=0&vk_language=ru&vk_platform=&vk_ref=other&vk_ts=1708687792&vk_user_id=618821251&sign=2xPZzzJtjonaklCg-KIQ849-dN2LJ0e9CO83vMgr_eo',
    'https://rabstvonext.ru/?vk_access_token_settings=&vk_app_id=51556925&vk_are_notifications_enabled=0&vk_is_app_user=0&vk_is_favorite=0&vk_language=ru&vk_platform=web_external&vk_ref=other&vk_ts=1708687913&vk_user_id=756671074&sign=LEzqt4qPjJ0J0NMo2Wd35fd4ywP_Us3IjyGyLA1qfuo',
    'https://rabstvonext.ru/?vk_access_token_settings=&vk_app_id=51556925&vk_are_notifications_enabled=0&vk_is_app_user=1&vk_is_favorite=0&vk_language=ru&vk_platform=&vk_ref=other&vk_ts=1708687412&vk_user_id=728784826&sign=0zRKdZlLt76YMoUKHNqaAJRvcovR6bCYB8Oq2DbttxI',                                                                  'https://rabstvonext.ru/?vk_access_token_settings=&vk_app_id=51556925&vk_are_notifications_enabled=0&vk_is_app_user=1&vk_is_favorite=0&vk_language=ru&vk_platform=web_external&vk_ref=other&vk_ts=1708687577&vk_user_id=730177498&sign=1FVCt3eJQXmy3xYuJ8OcvZyrkec_PZKb5SEDYrTp4PY',                                                      'https://rabstvonext.ru/?vk_access_token_settings=&vk_app_id=51556925&vk_are_notifications_enabled=0&vk_is_app_user=0&vk_is_favorite=0&vk_language=ru&vk_platform=web_external&vk_ref=other&vk_ts=1708687666&vk_user_id=320332&sign=OkbALDrV_PrUEhdSLew37vpZ9Z1bkCn4TW_MyPBxbGw',
    'https://rabstvonext.ru/?vk_access_token_settings=&vk_app_id=51556925&vk_are_notifications_enabled=0&vk_is_app_user=1&vk_is_favorite=0&vk_language=ru&vk_platform=web_external&vk_ref=other&vk_ts=1708687695&vk_user_id=399152531&sign=KHDVxrbDZxgCXbFokTCtvXTWUczu3ow-JcrXoWBZtV0',
    'https://rabstvonext.ru/?vk_access_token_settings=&vk_app_id=51556925&vk_are_notifications_enabled=0&vk_is_app_user=1&vk_is_favorite=0&vk_language=ru&vk_platform=web_external&vk_ref=other&vk_ts=1708687723&vk_user_id=572475985&sign=n2t9FwvqC5Xgz7_HuhgpQ2kAV9hR_7kNRFvp2SLa9pU',
    'https://rabstvonext.ru/?vk_access_token_settings=&vk_app_id=51556925&vk_are_notifications_enabled=0&vk_is_app_user=0&vk_is_favorite=0&vk_language=ru&vk_platform=&vk_ref=other&vk_ts=1708687875&vk_user_id=657882135&sign=FGwcopg9a1biy9hg9U-f4CX50NBOxhDi5aFVdkVELRc',
]

function seedFrames() {
    const existing = new Set(db.adminAccounts.map(a => a.frameUrl).filter(Boolean))
    let added = 0
    for (const url of INITIAL_FRAMES) {
        if (!existing.has(url)) {
            db.adminAccounts.push({ frameUrl: url, vkToken: null })
            added++
        }
    }
    if (added > 0) { saveDB(); console.log(`➕ Фреймов для админа: ${added}`) }                                                     }

// Возвращает аккаунты для пользователя:
// админ видит adminAccounts + accounts; остальные — только accounts
function getAccounts(userId) {
    if (userId === ADMIN_ID)
        return [...db.adminAccounts, ...db.accounts]
    return db.accounts
}

// Сессии пользователей (в памяти)
const sessions = {}
function sess(userId) {
    if (!sessions[userId])
        sessions[userId] = { accIdx: 0, victim: null, delay: 700 }
    return sessions[userId]
}
                                                                  // ═══════════════════════════════════════════
//                  VK API
// ═══════════════════════════════════════════
async function vk(method, params = {}) {                              const { data } = await axios.get(`https://api.vk.com/method/${method}`, {
        params: { ...params, access_token: BOT_TOKEN, v: '5.131' }
    })
    if (data.error) throw new Error(data.error.error_msg)
    return data.response
}

async function send(peerId, text) {
    await vk('messages.send', { peer_id: peerId, message: text, random_id: Date.now() })
}

// ═══════════════════════════════════════════
//              ИГРОВОЙ АККАУНТ
// ═══════════════════════════════════════════
class GameAccount {
    constructor({ frameUrl, vkToken }) {
        this.frameUrl = frameUrl || null
        this.vkToken  = vkToken  || null
        this.iframe   = null
        this.loaded   = false
        this.headers  = {
            'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0',                              'Content-Type':    'application/json',
            'X-Requested-With':'XMLHttpRequest',
        }
    }

    async load() {
        if (this.frameUrl) {
            this.iframe = this.frameUrl
        } else {
            const { data: { response: { items: [{ webview_url }] } } } = await axios.get(
                `https://api.vk.com/method/apps.get?app_id=51556925&platform=web&access_token=${this.vkToken}&v=5.131`
            )
            this.iframe = webview_url
        }

        const { data } = await axios.get(this.iframe)
        // Извлекаем X-CSRF-TOKEN из meta-тега
        const csrfMatch = data.match(/<meta name="csrf-token" content="([^"]+)"/)
        this.headers['X-CSRF-TOKEN'] = csrfMatch ? csrfMatch[1] : ''
        // Извлекаем токен из window.__INITIAL_STATE__ или другого места
        const tokenMatch = data.match(/"token":"([^"]+)"/)
        this.headers['token'] = tokenMatch ? tokenMatch[1] : ''
        
        // Устанавливаем Referer
        this.headers['Referer'] = this.iframe
        this.loaded = true
    }

    async call(method, params = {}) {
        if (!this.loaded) await this.load()
        try {
            const { data } = await axios.post(`https://rabstvonext.ru/${method}`, params, { headers: this.headers })
            return data
        } catch (error) {
            console.error(`Ошибка вызова ${method}:`, error.message)
            return { res: false, message: error.message }
        }
    }

    // Новый метод для сбора денег с правильной подписью
    async collectMoney() {
        return this.call('collectmoney', {
            sign_data: {
                sign: "A1nHesGIXg_jxPT6uWNp7lH0DZohJ6z7Q67sSOC4QVE", // В реальности нужно генерировать новую подпись
                ts: Math.floor(Date.now() / 1000)
            }
        })
    }

    getProfile(userId)  { return this.call('getuser',      { user_id: userId }) }
    buyRab(userId)      { return this.call('buyrab',        { user_id: userId, hash: '9661dde8ca55f7b39cbc19dd77138d64' }) }
    
    // Новые методы на основе логов
    async upgradeRab(userId) {
        return this.call('updaterab', {
            user_id: userId,
            sign_data: {
                sign: "diLJpM2oJZjwbmS5dsKvSkdqqvGPP1Zml36PjNzNX9E",
                ts: Math.floor(Date.now() / 1000)
            }
        })
    }
    
    async joinClan(groupId) {
        return this.call('inputclan', { group_id: String(groupId) })
    }
}

function makeAcc(idx, userId) {
    const list = userId !== undefined ? getAccounts(userId) : db.accounts
    return new GameAccount(list[idx])
}
                                                                  // ═══════════════════════════════════════════
//             АКТИВНЫЕ ЗАДАЧИ
// ═══════════════════════════════════════════
const jobs = {} // { userId: { stopped } }

function stopJob(userId) {
    if (jobs[userId]) { jobs[userId].stopped = true; delete jobs[userId] }
}

function sleep(ms) { 
    // Минимальная задержка 1 мс
    return new Promise(r => setTimeout(r, Math.max(1, ms))) 
}

// ═══════════════════════════════════════════
//             РЕЖИМЫ ЗАКУПКИ
// ═══════════════════════════════════════════
async function buyNormal(userId, peerId, accIdx, victimId, delay, minPrice = 0, maxPrice = Infinity) {
    const job = jobs[userId]
    try {
        const ga = makeAcc(accIdx, userId); await ga.load()
        
        // Получаем профиль текущего аккаунта для отображения
        const myProfile = await ga.getProfile(null) // Получаем свой профиль
        const myInfo = myProfile?.item || {}
        
        await send(peerId,
            `🎯 Начинаю закуп на аккаунте: ${myInfo.name || 'Неизвестно'} ${myInfo.last_name || ''} | Баланс: ${(myInfo.money_osn || 0).toLocaleString('ru')} | Рабов: ${myInfo.rabs_count || 0}`
        )
        
        const profile = await ga.getProfile(victimId)
        const owner   = profile?.item
        const slaves  = owner?.rabs || []

        if (!slaves.length) { await send(peerId, '❌ У жертвы нет рабов'); return }
        
        await send(peerId,
            `📊 Жертва: ${owner.name} ${owner.last_name}\n` +
            `👥 Рабов: ${slaves.length}\n` +
            `💰 Фильтр цен: ${minPrice} - ${maxPrice === Infinity ? '∞' : maxPrice} руб.\n` +
            `⏱ Задержка: ${delay}мс\n▶️ Начинаем...`
        )

        let bought = 0, spent = 0

        for (const s of slaves) {
            if (job.stopped) break
            
            // Проверка фильтра цен
            if (s.first_price < minPrice || s.first_price > maxPrice) {
                continue
            }
            
            try {
                const res = await ga.buyRab(s.id_vk)
                if (res?.res) {
                    bought++; spent += s.first_price
                    await send(peerId,
                        `✅ Куплен: ${s.name} ${s.last_name}\n` +
                        `💵 Цена: ${s.first_price.toLocaleString('ru')} руб.\n` +
                        `📈 Доход: +${s.first_zarabotok}/час\n` +
                        `📦 Всего куплено: ${bought}`
                    )
                }
            } catch (_) {}
            await sleep(delay)
        }

        await send(peerId,
            `🏁 Закупка завершена!\n` +
            `✅ Куплено всего: ${bought} из ${slaves.length}\n` +
            `💰 Потрачено: ${spent.toLocaleString('ru')} руб.`
        )
    } catch (e) { await send(peerId, `❌ Ошибка: ${e.message}`) }
    delete jobs[userId]
}

async function buyMulti(userId, peerId, victimId, delay, minPrice = 0, maxPrice = Infinity) {
    const job = jobs[userId]
    try {
        const ga0 = makeAcc(0, userId); await ga0.load()
        const profile = await ga0.getProfile(victimId)
        const owner   = profile?.item
        const slaves  = owner?.rabs || []

        if (!slaves.length) { await send(peerId, '❌ У жертвы нет рабов'); return }
        
        await send(peerId,
            `📊 Жертва: ${owner.name} ${owner.last_name}\n` +
            `👥 Рабов: ${slaves.length} | 🔄 Аккаунтов: ${getAccounts(userId).length}\n` +
            `💰 Фильтр цен: ${minPrice} - ${maxPrice === Infinity ? '∞' : maxPrice} руб.\n▶️ Старт мульти-закупки...`
        )

        const accs = []
        for (let i = 0; i < getAccounts(userId).length; i++) {
            try { const g = makeAcc(i, userId); await g.load(); accs.push(g) } catch (_) {}
        }

        let bought = 0, spent = 0

        for (let i = 0; i < slaves.length; i++) {
            if (job.stopped) break
            const s  = slaves[i]
            
            // Проверка фильтра цен
            if (s.first_price < minPrice || s.first_price > maxPrice) {
                continue
            }
            
            const ga = accs[i % accs.length]
            try {
                const res = await ga.buyRab(s.id_vk)
                if (res?.res) {
                    bought++; spent += s.first_price
                    await send(peerId,
                        `✅ Куплен: ${s.name} ${s.last_name}\n` +
                        `💵 Цена: ${s.first_price.toLocaleString('ru')} руб.\n` +
                        `📈 Доход: +${s.first_zarabotok}/час\n` +
                        `📦 Всего куплено: ${bought}`
                    )
                }
            } catch (_) {}
            await sleep(delay)
        }

        await send(peerId,
            `🏁 Мульти-закупка завершена!\n` +
            `✅ Куплено всего: ${bought} из ${slaves.length}\n` +
            `💰 Потрачено: ${spent.toLocaleString('ru')} руб.`
        )
    } catch (e) { await send(peerId, `❌ Ошибка: ${e.message}`) }
    delete jobs[userId]
}

async function buyPremium(userId, peerId, victimId, delay, limit, minPrice = 0, maxPrice = Infinity) {
    const job = jobs[userId]
    try {
        await send(peerId,
            `💎 ПРЕМИУМ режим\n` +
            `👤 Жертва: ${victimId} | 📦 Лимит/акк: ${limit}\n` +
            `💰 Фильтр цен: ${minPrice} - ${maxPrice === Infinity ? '∞' : maxPrice} руб.\n▶️ Старт...`
        )
        
        let totalBought = 0, totalSpent = 0

        for (let i = 0; i < getAccounts(userId).length; i++) {
            if (job.stopped) break
            const ga = makeAcc(i, userId); await ga.load()
            let accBought = 0
            await send(peerId, `🔄 Акк #${i + 1} начинает (лимит: ${limit})`)

            while (accBought < limit && !job.stopped) {
                const fresh  = await ga.getProfile(victimId)
                const slaves = fresh?.item?.rabs || []
                if (!slaves.length) {
                    await send(peerId, '❌ Рабы закончились'); job.stopped = true; break
                }

                const s = slaves[0]
                
                // Проверка фильтра цен
                if (s.first_price < minPrice || s.first_price > maxPrice) {
                    await send(peerId, `⏭ Пропущен (цена ${s.first_price} вне фильтра)`)
                    break
                }
                
                try {
                    const res = await ga.buyRab(s.id_vk)
                    if (res?.res) {
                        accBought++; totalBought++; totalSpent += s.first_price
                        await send(peerId,
                            `✅ Куплен: ${s.name} ${s.last_name}\n` +
                            `💵 Цена: ${s.first_price.toLocaleString('ru')} руб.\n` +
                            `📈 Доход: +${s.first_zarabotok}/час\n` +
                            `📦 Акк: ${accBought}/${limit} | Всего: ${totalBought}`
                        )
                    } else { await sleep(2000) }
                } catch (_) { await sleep(2000) }
                await sleep(delay)
            }
            await send(peerId, `✅ Акк #${i + 1} завершил: куплено ${accBought}`)
        }

        await send(peerId,
            `🏁 ПРЕМИУМ завершён!\n` +
            `✅ Куплено всего: ${totalBought}\n` +
            `💰 Потрачено: ${totalSpent.toLocaleString('ru')} руб.`
        )
    } catch (e) { await send(peerId, `❌ Ошибка: ${e.message}`) }
    delete jobs[userId]
}

// Новая функция для прокачки рабов
async function upgradeRabs(userId, peerId, accIdx, minPrice = 0, maxPrice = Infinity) {
    const job = jobs[userId]
    try {
        const ga = makeAcc(accIdx, userId); await ga.load()
        
        // Получаем свой профиль
        const myProfile = await ga.getProfile(null)
        const rabs = myProfile?.item?.rabs || []
        
        if (!rabs.length) {
            await send(peerId, '❌ У вас нет рабов для прокачки')
            return
        }
        
        await send(peerId,
            `📈 Начинаю прокачку рабов\n` +
            `👥 Всего рабов: ${rabs.length}\n` +
            `💰 Фильтр цен: ${minPrice} - ${maxPrice === Infinity ? '∞' : maxPrice} руб.\n▶️ Старт...`
        )
        
        let upgraded = 0
        
        for (const rab of rabs) {
            if (job.stopped) break
            
            // Проверяем цену прокачки (если есть такая информация)
            if (rab.upgrade_price && (rab.upgrade_price < minPrice || rab.upgrade_price > maxPrice)) {
                continue
            }
            
            try {
                const res = await ga.upgradeRab(rab.id_vk)
                if (res?.res) {
                    upgraded++
                    await send(peerId,
                        `✅ Прокачан: ${rab.name} ${rab.last_name}\n` +
                        `📈 Всего прокачано: ${upgraded}`
                    )
                }
            } catch (_) {}
            await sleep(1000) // Задержка между прокачками
        }
        
        await send(peerId, `🏁 Прокачка завершена! Прокачано: ${upgraded} рабов`)
    } catch (e) { await send(peerId, `❌ Ошибка: ${e.message}`) }
    delete jobs[userId]
}

// Новая функция для смены клана
async function changeClan(userId, peerId, accIdx, groupId) {
    try {
        const ga = makeAcc(accIdx, userId); await ga.load()
        const res = await ga.joinClan(groupId)
        
        if (res?.res) {
            await send(peerId, `✅ Аккаунт #${accIdx + 1} успешно вступил в клан ${groupId}`)
        } else {
            await send(peerId, `❌ Ошибка вступления в клан: ${res?.message || 'неизвестная ошибка'}`)
        }
    } catch (e) { await send(peerId, `❌ Ошибка: ${e.message}`) }
}

// Новая функция для показа профилей всех аккаунтов
async function showAllProfiles(userId, peerId, specificAccIdx = null) {
    try {
        const accs = getAccounts(userId)
        if (!accs.length) return send(peerId, '❌ Нет аккаунтов')
        
        await send(peerId, '⏳ Загружаю профили аккаунтов...')
        
        const startIdx = specificAccIdx !== null ? specificAccIdx : 0
        const endIdx = specificAccIdx !== null ? specificAccIdx + 1 : accs.length
        
        for (let i = startIdx; i < endIdx; i++) {
            try {
                const ga = makeAcc(i, userId); await ga.load()
                const profile = await ga.getProfile(null) // Получаем свой профиль
                const info = profile?.item || {}
                
                const text = [
                    `👤 Аккаунт #${i + 1}`,
                    `Имя: ${info.name || 'Неизвестно'} ${info.last_name || ''}`,
                    `💰 Баланс: ${(info.money_osn || 0).toLocaleString('ru')} руб.`,
                    `👥 Рабов: ${info.rabs_count || 0}`,
                    `🏰 Клан: ${info.clan?.name || 'нет'}`,
                    `📈 Доход: ${info.zarabotok || 0}/час`,
                    `💲 Цена: ${(info.price || 0).toLocaleString('ru')} руб.`,
                    `📍 Позиция: #${info.position || '—'}`,
                ].join('\n')
                
                await send(peerId, text)
                await sleep(500) // Небольшая задержка между сообщениями
            } catch (e) {
                await send(peerId, `❌ Аккаунт #${i + 1}: ошибка загрузки`)
            }
        }
    } catch (e) { await send(peerId, `❌ Ошибка: ${e.message}`) }
}

// ═══════════════════════════════════════════
//             ОБРАБОТКА КОМАНД
// ═══════════════════════════════════════════
async function handle(userId, peerId, text) {
    const parts = text.trim().split(/\s+/)
    const cmd   = parts[0].toLowerCase()
    const s     = sess(userId)

    const auth = db.authorized.includes(userId) || userId === ADMIN_ID
    if (!auth && cmd !== '/start') {
        await send(peerId, '❌ Нет доступа. Обратитесь к администратору.')
        return
    }

    if (cmd === '/start' || cmd === '/help') {
        await send(peerId, [
            '🤖 RabstvoNext Bot',
            '',
            '📋 Аккаунты:',
            '/addframe [url]   — добавить по фрейму',
            '/addtoken [token] — добавить по токену',
            '/accounts         — список аккаунтов',
            '/use [номер]      — выбрать аккаунт',
            '/profiles         — показать профили всех аккаунтов',
            '/profile [номер]  — показать профиль конкретного аккаунта',
            '',
            '🎯 Настройки:',
            '/victim [id]      — установить жертву',
            '/delay [мс]       — задержка (мин. 100)',
            '',
            '⚔️ Режимы закупки:',
            '/buy [min] [max]              — обычный (1 акк) с фильтром цен',
            '/multibuy [min] [max]         — с нескольких аккаунтов с фильтром цен',
            '/premium [лимит] [min] [max]  — по очереди с фильтром цен',
            '/upgrade [min] [max]          — прокачка рабов с фильтром цен',
            '/stop                         — остановить',
            '',
            '🏰 Клан:',
            '/joinclan [group_id] — вступить в клан на выбранном аккаунте',
            '/joinclanall [group_id] — вступить в клан на всех аккаунтах',
            '',
            '💰 Доход:',
            '/collect          — собрать (активный акк)',
            '/collectall       — собрать со всех',
            '',
            '/info [id/ссылка] — инфо об игроке',
            userId === ADMIN_ID ? '\n👑 Админ:\n/grant [id] — выдать доступ\n/revoke [id] — забрать' : ''
        ].join('\n'))
        return
    }

    // addframe
    if (cmd === '/addframe') {
        const isPrivate = userId === ADMIN_ID && parts[1] === '-p'
        const url = isPrivate ? parts.slice(2).join(' ') : parts.slice(1).join(' ')
        if (!url) return send(peerId, '❌ Укажите URL\n/addframe [-p] url\n  -p = только для вас (приватный)')
        await send(peerId, '⏳ Проверка аккаунта...')
        try {
            const ga = new GameAccount({ frameUrl: url })
            await ga.load()
            const target = (userId === ADMIN_ID && isPrivate) ? db.adminAccounts : db.accounts
            target.push({ frameUrl: url, vkToken: null })
            saveDB()
            await send(peerId, `✅ Аккаунт #${getAccounts(userId).length} добавлен (${isPrivate ? '🔒 приватный' : '👤 общий'})`)
        } catch (e) { await send(peerId, `❌ Ошибка: ${e.message}`) }
        return
    }
    
    // addtoken
    if (cmd === '/addtoken') {
        const isPrivate = userId === ADMIN_ID && parts[1] === '-p'
        const token = isPrivate ? parts[2] : parts[1]
        if (!token) return send(peerId, '❌ Укажите токен\n/addtoken [-p] токен\n  -p = только для вас (приватный)')
        await send(peerId, '⏳ Проверка аккаунта...')
        try {
            const ga = new GameAccount({ vkToken: token })
            await ga.load()
            const target = (userId === ADMIN_ID && isPrivate) ? db.adminAccounts : db.accounts
            target.push({ frameUrl: null, vkToken: token })
            saveDB()
            await send(peerId, `✅ Аккаунт #${getAccounts(userId).length} добавлен (${isPrivate ? '🔒 приватный токен' : '👤 общий токен'})`)
        } catch (e) { await send(peerId, `❌ Ошибка: ${e.message}`) }
        return
    }
    
    // accounts
    if (cmd === '/accounts') {
        if (!getAccounts(userId).length) return send(peerId, '📋 Аккаунтов нет')
        const accList = getAccounts(userId)
        const list = accList.map((a, i) => {
            const isAdmin = userId === ADMIN_ID && i < (db.adminAccounts || []).length
            const tag = isAdmin ? '🔒' : '👤'
            return `${i === s.accIdx ? '▶' : ' '} ${tag}#${i + 1} [${a.frameUrl ? 'фрейм' : 'токен'}]`
        }).join('\n')
        await send(peerId, `📋 Аккаунты:\n${list}\n\n🔒 — только для вас (приват)\n👤 — общие`)
        return
    }

    // use
    if (cmd === '/use') {
        const n = parseInt(parts[1]) - 1
        if (isNaN(n) || n < 0 || n >= getAccounts(userId).length)
            return send(peerId, `❌ Номер от 1 до ${getAccounts(userId).length}`)
        s.accIdx = n
        await send(peerId, `✅ Выбран аккаунт #${n + 1}`)
        return
    }

    // profiles - показать все профили
    if (cmd === '/profiles') {
        if (!getAccounts(userId).length) return send(peerId, '❌ Нет аккаунтов')
        await showAllProfiles(userId, peerId)
        return
    }

    // profile - показать конкретный профиль
    if (cmd === '/profile') {
        const accNum = parseInt(parts[1])
        if (isNaN(accNum) || accNum < 1 || accNum > getAccounts(userId).length) {
            return send(peerId, `❌ Укажите номер аккаунта от 1 до ${getAccounts(userId).length}`)
        }
        await showAllProfiles(userId, peerId, accNum - 1)
        return
    }

    // victim
    if (cmd === '/victim') {
        const raw = parts[1]
        if (!raw) return send(peerId, '❌ Укажите VK ID')
        const id = parseInt(raw.match(/\d+/)?.[0])
        if (!id) return send(peerId, '❌ Неверный ID')
        s.victim = id
        await send(peerId, `✅ Жертва: ${id}`)
        return
    }

    // delay
    if (cmd === '/delay') {
        const ms = parseInt(parts[1])
        if (isNaN(ms) || ms < 100) return send(peerId, '❌ Минимум 100мс')
        s.delay = ms
        await send(peerId, `✅ Задержка: ${ms}мс`)
        return
    }

    // info
    if (cmd === '/info') {
        const raw = parts[1]
        if (!raw) return send(peerId, '❌ Укажите VK ID или ссылку')
        const id = parseInt(raw.match(/\d+/)?.[0])
        if (!id) return send(peerId, '❌ Неверный ID')
        if (!getAccounts(userId).length) return send(peerId, '❌ Нет аккаунтов')
        try {
            const ga = makeAcc(s.accIdx, userId); await ga.load()
            const p  = await ga.getProfile(id)
            const it = p?.item
            if (!it) return send(peerId, '❌ Игрок не найден')
            await send(peerId, [
                `👤 ${it.name} ${it.last_name}`,
                `💰 Баланс: ${(it.money_osn || 0).toLocaleString('ru')} руб.`,
                `📈 Доход: ${it.zarabotok || 0}/час`,
                `💲 Цена: ${(it.price || 0).toLocaleString('ru')} руб.`,
                `👥 Рабов: ${it.rabs_count || 0}`,
                `🏰 Клан: ${it.clan?.name || 'нет'}`,
                `📍 Позиция: #${it.position || '—'}`,
                it.type === 'ban' ? '🔴 Забанен' : '🟢 Активен'
            ].join('\n'))
        } catch (e) { await send(peerId, `❌ Ошибка: ${e.message}`) }
        return
    }

    // collect
    if (cmd === '/collect') {
        if (!getAccounts(userId).length) return send(peerId, '❌ Нет аккаунтов')
        try {
            const ga = makeAcc(s.accIdx, userId); await ga.load()
            const r  = await ga.collectMoney()
            await send(peerId, r?.res
                ? `💰 Собрано: ${r.money || '?'} руб.`
                : `❌ ${r?.message || 'Нечего собирать'}`)
        } catch (e) { await send(peerId, `❌ Ошибка: ${e.message}`) }
        return
    }

    // collectall
    if (cmd === '/collectall') {
        if (!getAccounts(userId).length) return send(peerId, '❌ Нет аккаунтов')
        await send(peerId, `⏳ Сбор со всех аккаунтов...`)
        const results = []
        for (let i = 0; i < getAccounts(userId).length; i++) {
            try {
                const ga = makeAcc(i, userId); await ga.load()
                const r  = await ga.collectMoney()
                results.push(r?.res
                    ? `✅ Акк #${i + 1}: +${r.money || '?'} руб.`
                    : `❌ Акк #${i + 1}: ${r?.message || 'ошибка'}`)
            } catch (e) { results.push(`❌ Акк #${i + 1}: ${e.message}`) }
            await sleep(1000)
        }
        await send(peerId, `💰 Результаты:\n${results.join('\n')}`)
        return
    }

    // joinclan - вступить в клан на выбранном аккаунте
    if (cmd === '/joinclan') {
        const groupId = parts[1]
        if (!groupId) return send(peerId, '❌ Укажите ID группы ВК\nПример: /joinclan 185158427')
        if (!getAccounts(userId).length) return send(peerId, '❌ Нет аккаунтов')
        await changeClan(userId, peerId, s.accIdx, groupId)
        return
    }

    // joinclanall - вступить в клан на всех аккаунтах
    if (cmd === '/joinclanall') {
        const groupId = parts[1]
        if (!groupId) return send(peerId, '❌ Укажите ID группы ВК\nПример: /joinclanall 185158427')
        if (!getAccounts(userId).length) return send(peerId, '❌ Нет аккаунтов')
        
        await send(peerId, `🔄 Вступаем в клан ${groupId} на всех аккаунтах...`)
        
        for (let i = 0; i < getAccounts(userId).length; i++) {
            try {
                const ga = makeAcc(i, userId); await ga.load()
                const res = await ga.joinClan(groupId)
                if (res?.res) {
                    await send(peerId, `✅ Акк #${i + 1}: успешно вступил в клан`)
                } else {
                    await send(peerId, `❌ Акк #${i + 1}: ${res?.message || 'ошибка'}`)
                }
            } catch (e) {
                await send(peerId, `❌ Акк #${i + 1}: ${e.message}`)
            }
            await sleep(1000)
        }
        
        await send(peerId, `✅ Операция завершена`)
        return
    }

    // stop
    if (cmd === '/stop') {
        if (jobs[userId]) { stopJob(userId); await send(peerId, ' ⛔ Остановлено') }
        else await send(peerId, '❌ Нет активных задач')
        return
    }
    
    // buy с фильтром цен
    if (cmd === '/buy') {
        if (!getAccounts(userId).length) return send(peerId, '❌ Нет аккаунтов')
        if (!s.victim) return send(peerId, '❌ Укажите /victim [id]')
        if (jobs[userId]) return send(peerId, '❌ Задача уже запущена. /stop')
        
        const minPrice = parseInt(parts[1]) || 0
        const maxPrice = parseInt(parts[2]) || Infinity
        
        jobs[userId] = { stopped: false }
        buyNormal(userId, peerId, s.accIdx, s.victim, s.delay, minPrice, maxPrice)
        return
    }

    // multibuy с фильтром цен
    if (cmd === '/multibuy') {
        if (!getAccounts(userId).length) return send(peerId, '❌ Нет аккаунтов')
        if (!s.victim) return send(peerId, '❌ Укажите /victim [id]')
        if (jobs[userId]) return send(peerId, '❌ Задача уже запущена. /stop')
        
        const minPrice = parseInt(parts[1]) || 0
        const maxPrice = parseInt(parts[2]) || Infinity
        
        jobs[userId] = { stopped: false }
        buyMulti(userId, peerId, s.victim, s.delay, minPrice, maxPrice)
        return
    }

    // premium с фильтром цен
    if (cmd === '/premium') {
        const limit = parseInt(parts[1]) || 400
        const minPrice = parseInt(parts[2]) || 0
        const maxPrice = parseInt(parts[3]) || Infinity
        
        if (!getAccounts(userId).length) return send(peerId, '❌ Нет аккаунтов')
        if (!s.victim) return send(peerId, '❌ Укажите /victim [id]')
        if (jobs[userId]) return send(peerId, '❌ Задача уже запущена. /stop')
        
        jobs[userId] = { stopped: false }
        buyPremium(userId, peerId, s.victim, s.delay, limit, minPrice, maxPrice)
        return
    }

    // upgrade - прокачка рабов с фильтром цен
    if (cmd === '/upgrade') {
        if (!getAccounts(userId).length) return send(peerId, '❌ Нет аккаунтов')
        if (jobs[userId]) return send(peerId, '❌ Задача уже запущена. /stop')
        
        const minPrice = parseInt(parts[1]) || 0
        const maxPrice = parseInt(parts[2]) || Infinity
        
        jobs[userId] = { stopped: false }
        upgradeRabs(userId, peerId, s.accIdx, minPrice, maxPrice)
        return
    }

    // admin: grant / revoke
    if (cmd === '/grant') {
        if (userId !== ADMIN_ID) return send(peerId, '❌ Только для администратора')
        const id = parseInt(parts[1])
        if (!id) return send(peerId, '❌ Укажите VK ID')
        if (!db.authorized.includes(id)) db.authorized.push(id)
        saveDB()
        await send(peerId, `✅ Доступ выдан: ${id}`)
        return
    }

    if (cmd === '/revoke') {
        if (userId !== ADMIN_ID) return send(peerId, '❌ Только для администратора')
        const id = parseInt(parts[1])
        db.authorized = db.authorized.filter(x => x !== id)
        saveDB()
        await send(peerId, `✅ Доступ отозван: ${id}`)
        return
    }

    await send(peerId, '❓ Неизвестная команда. /help')
}

// ═══════════════════════════════════════════
//                  ПОЛЛИНГ
// ═══════════════════════════════════════════
let lastMsgId = 0
const processing = new Set()

async function poll() {
    try {
        const res = await vk('messages.getConversations', { count: 20, filter: 'all' })
        for (const item of res.items || []) {
            const msg = item.last_message
            if (!msg) continue
            if (msg.out === 1) continue
            if (!msg.text?.startsWith('/')) continue
            if (msg.id <= lastMsgId) continue
            if (processing.has(msg.id)) continue
            processing.add(msg.id)

            const peer = item.conversation.peer.id
            console.log(`📨 id=${msg.id} from=${msg.from_id} peer=${peer} text="${msg.text}"`)
            handle(msg.from_id, peer, msg.text).catch(e => console.error('handle error:', e.message))
        }
    } catch (e) {
        console.error('poll error:', e.message)
    }
}

async function init() {
    console.log('🤖 RabstvoNext Bot запущен')
    console.log(`👑 Админ: ${ADMIN_ID}`)
    seedFrames()
    try {
        const res = await vk('messages.getConversations', { count: 20, filter: 'all' })
        for (const item of res.items || []) {
            if (item.last_message && item.last_message.id > lastMsgId)
                lastMsgId = item.last_message.id
        }
        console.log(`✅ Готов | lastMsgId=${lastMsgId} | Аккаунтов: ${db.adminAccounts.length + db.accounts.length}`)
    } catch (e) { console.error('❌ Ошибка старта:', e.message) }
    
    setInterval(async () => {
        await poll()
        if (processing.size > 0) {
            const maxId = Math.max(...processing)
            if (maxId > lastMsgId) lastMsgId = maxId
        }
    }, POLL_MS)
}

init()