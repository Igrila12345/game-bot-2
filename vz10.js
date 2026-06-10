const { Client } = require('pg')
const fetch = require('node-fetch')

const TOKEN = 'vk1.a.p1vRoFykNgZdzwaLH4RBQ2LW738ceHU06__yOVmYhRjdrKW9hQAeNYyixVyCyyXF_sKzBmSipxwfMteWRI6K0ZSAr_4_db48eNJA6b22Cg6GxMp4_MxN79VmDS3b6NPI7wOp2b5-KrZJlvIVZd5IjDJR1RaNUD4NOB_7mWBw1j8Xek2HrCb-ja8aeWB-5ZM-EfZNwz4PdQ71Su_XQ1tiDA'
const API_VERSION = '5.199'
const ADMIN_ID = 660964860

const pg = new Client({
  connectionString: 'postgresql://neondb_owner:npg_kxLBQ8UdF7Dj@ep-delicate-bread-as4312fq-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require'
})

// ----- КОНСТАНТЫ -----
const quotes = [
  'Жизнь — то, что происходит, пока ты строишь планы. — Джон Леннон',
  'Будь тем изменением, которое хочешь видеть в мире. — Махатма Ганди',
  'Лучшее время посадить дерево было 20 лет назад. Второе лучшее — сегодня.',
  'Не важно, как медленно ты идёшь, главное — не останавливайся. — Конфуций',
  'Ты никогда не пересечёшь океан, если боишься потерять берег. — Колумб',
  'Успех — умение идти от неудачи к неудаче, не теряя энтузиазма. — Черчилль',
  'Всё, что ты можешь вообразить — реально. — Пабло Пикассо'
]

const ballAnswers = [
  '✅ Бесспорно', '✅ Предрешено', '✅ Никаких сомнений', '✅ Определённо да',
  '✅ Можешь быть уверен', '🤔 Мне кажется — да', '🤔 Вероятнее всего',
  '🤔 Хорошие перспективы', '🤔 Знаки говорят — да', '🤔 Да',
  '❓ Пока не ясно', '❓ Спроси позже', '❓ Лучше не рассказывать',
  '❓ Сейчас нельзя предсказать', '❓ Сконцентрируйся и спроси опять',
  '❌ Даже не думай', '❌ Мой ответ — нет', '❌ По моим данным — нет',
  '❌ Перспективы не очень', '❌ Весьма сомнительно'
]

const shopItems = {
  'цветок': { price: 50, emoji: '💐' },
  'кристалл': { price: 200, emoji: '💎' },
  'лотерея': { price: 100, emoji: '🎫' },
  'защита': { price: 500, emoji: '🛡️' },
  'подарок': { price: 300, emoji: '🎁' }
}

const availablePermissions = ['warn', 'mute', 'kick', 'ban', 'invite', 'manage']

const relationLevels = [
  { name: 'Незнакомцы', emoji: '💔', minHp: 0 },
  { name: 'Знакомые', emoji: '👋', minHp: 10 },
  { name: 'Приятели', emoji: '🤝', minHp: 30 },
  { name: 'Друзья', emoji: '💛', minHp: 50 },
  { name: 'Хорошие друзья', emoji: '💚', minHp: 80 },
  { name: 'Лучшие друзья', emoji: '💖', minHp: 110 },
  { name: 'Родственные души', emoji: '💕', minHp: 150 },
  { name: 'Любовь', emoji: '💘', minHp: 200 },
  { name: 'Страстная любовь', emoji: '💝', minHp: 300 },
  { name: 'Вечная любовь', emoji: '💟', minHp: 500 },
  { name: 'Бесконечность', emoji: '♾️', minHp: 1000 }
]

const relationActions = {
  'обнять': { hp: 2, emoji: '🤗', text: '{user} обнимает {target}', cooldown: 0 },
  'поцеловать': { hp: 3, emoji: '💋', text: '{user} целует {target}', cooldown: 0 },
  'поговорить': { hp: 1, emoji: '💬', text: '{user} болтает с {target}', cooldown: 0 },
  'поддержать': { hp: 2, emoji: '💪', text: '{user} поддерживает {target}', cooldown: 0 },
  'погулять': { hp: 3, emoji: '🚶', text: '{user} идёт гулять с {target}', cooldown: 3600 },
  'по душам': { hp: 5, emoji: '💗', text: '{user} говорит по душам с {target}', cooldown: 7200 },
  'подарить цветы': { hp: 4, emoji: '💐', text: '{user} дарит цветы {target}', cooldown: 3600 },
  'приготовить ужин': { hp: 6, emoji: '🍽️', text: '{user} готовит ужин для {target}', cooldown: 7200 },
  'сходить в кино': { hp: 5, emoji: '🎬', text: '{user} идёт в кино с {target}', cooldown: 7200 },
  'сделать сюрприз': { hp: 8, emoji: '🎉', text: '{user} делает сюрприз {target}', cooldown: 14400 },
  'признаться в любви': { hp: 10, emoji: '💌', text: '{user} признаётся в любви {target}', cooldown: 86400 },
  'подарить кольцо': { hp: 15, emoji: '💍', text: '{user} дарит кольцо {target}', cooldown: 86400 }
}

// ----- СОСТОЯНИЕ -----
let lastMsgId = 0
let longPollServer = null, longPollKey = null, longPollTs = null
const processedIds = new Set()
const marryRequests = new Map()
const relationRequests = new Map()
const lastActionTime = new Map()

// ========== БАЗА ДАННЫХ ==========
async function initDB() {
  await pg.connect()
  
  await pg.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id BIGINT PRIMARY KEY,
      balance INT DEFAULT 100,
      level INT DEFAULT 1,
      exp INT DEFAULT 0,
      last_daily TEXT,
      last_work TEXT,
      total_msgs INT DEFAULT 0,
      rep INT DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS mutes (
      peer_id BIGINT, user_id BIGINT,
      until DOUBLE PRECISION,
      PRIMARY KEY (peer_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS blacklist (
      user_id BIGINT PRIMARY KEY, reason TEXT
    );
    CREATE TABLE IF NOT EXISTS warns (
      peer_id BIGINT, user_id BIGINT,
      count INT DEFAULT 0,
      PRIMARY KEY (peer_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS marriages (
      user1 BIGINT, user2 BIGINT, date TEXT, love INT DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS inventory (
      user_id BIGINT, item TEXT, quantity INT DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS ranks (
      id SERIAL PRIMARY KEY,
      peer_id BIGINT,
      name TEXT,
      emoji TEXT DEFAULT '🎖️',
      can_warn INT DEFAULT 0,
      can_mute INT DEFAULT 0,
      can_kick INT DEFAULT 0,
      can_ban INT DEFAULT 0,
      can_invite INT DEFAULT 0,
      can_manage INT DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS user_ranks (
      peer_id BIGINT, user_id BIGINT, rank_id INT,
      PRIMARY KEY (peer_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS rank_logs (
      id SERIAL PRIMARY KEY,
      peer_id BIGINT,
      admin_id BIGINT,
      user_id BIGINT,
      action TEXT,
      rank_name TEXT,
      timestamp TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS clans (
      id SERIAL PRIMARY KEY, name TEXT, owner_id BIGINT, balance INT DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS clan_members (
      clan_id INT, user_id BIGINT, role TEXT DEFAULT 'member',
      PRIMARY KEY (clan_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS reminders (
      id SERIAL PRIMARY KEY, user_id BIGINT, peer_id BIGINT,
      remind_time BIGINT, text TEXT, done INT DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS teams (
      id SERIAL PRIMARY KEY,
      peer_id BIGINT,
      name TEXT,
      owner_id BIGINT,
      created_at TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS team_members (
      team_id INT, user_id BIGINT, role TEXT DEFAULT 'member',
      PRIMARY KEY (team_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS rp_commands (
      id SERIAL PRIMARY KEY,
      peer_id BIGINT,
      name TEXT,
      action TEXT,
      emoji TEXT DEFAULT '🩸',
      created_by BIGINT DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS relations (
      user1 BIGINT, user2 BIGINT,
      hp INT DEFAULT 0,
      created_at TEXT DEFAULT '',
      PRIMARY KEY (user1, user2)
    );
    CREATE TABLE IF NOT EXISTS relation_logs (
      id SERIAL PRIMARY KEY,
      user1 BIGINT, user2 BIGINT,
      actor BIGINT,
      action TEXT,
      hp_change INT DEFAULT 0,
      timestamp TEXT DEFAULT ''
    );
  `)

  const columns = [
    { table: 'users', column: 'exp', type: 'INT DEFAULT 0' },
    { table: 'users', column: 'total_msgs', type: 'INT DEFAULT 0' },
    { table: 'users', column: 'rep', type: 'INT DEFAULT 0' },
    { table: 'users', column: 'last_daily', type: 'TEXT' },
    { table: 'users', column: 'last_work', type: 'TEXT' }
  ]
  for (const col of columns) {
    try { await pg.query(`ALTER TABLE ${col.table} ADD COLUMN IF NOT EXISTS ${col.column} ${col.type}`) } catch (e) {}
  }

  console.log('✅ База готова')
}

// ========== API ==========
function api(method, params = {}) {
  params.access_token = TOKEN
  params.v = API_VERSION
  const q = Object.entries(params).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&')
  return fetch(`https://api.vk.com/method/${method}?${q}`)
    .then(r => r.json())
    .catch(e => {
      console.error(`API ${method} error:`, e.message)
      return { error: { error_msg: e.message } }
    })
}

async function sendMsg(peerId, msg) {
  const maxLen = 3500
  if (msg.length <= maxLen) {
    return api('messages.send', { peer_id: peerId, message: msg, random_id: Math.floor(Math.random()*1e9) }).catch(()=>{})
  }
  const parts = []
  let remaining = msg
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) { parts.push(remaining); break }
    let cut = remaining.lastIndexOf('\n', maxLen)
    if (cut === -1 || cut < maxLen/2) cut = maxLen
    parts.push(remaining.slice(0, cut))
    remaining = remaining.slice(cut)
  }
  for (const part of parts) {
    await api('messages.send', { peer_id: peerId, message: part, random_id: Math.floor(Math.random()*1e9) }).catch(()=>{})
    await new Promise(r => setTimeout(r, 200))
  }
}

async function getUserName(userId) {
  try {
    const r = await api('users.get', { user_ids: userId })
    if (!r.error && r.response?.length) return `${r.response[0].first_name} ${r.response[0].last_name}`
  } catch {}
  return `id${userId}`
}

// ========== ХЕЛПЕРЫ ==========
async function ensureUser(id) {
  const r = await pg.query('SELECT 1 FROM users WHERE user_id=$1', [id])
  if (!r.rows.length) { await pg.query('INSERT INTO users (user_id) VALUES ($1)', [id]); return true }
  return false
}

async function getBal(id) {
  const r = await pg.query('SELECT balance FROM users WHERE user_id=$1', [id])
  return r.rows[0]?.balance || 0
}

async function addBal(id, amt) {
  await pg.query('UPDATE users SET balance = balance + $1 WHERE user_id = $2', [amt, id])
}

async function addExp(id, exp) {
  try {
    await pg.query('UPDATE users SET exp = exp + $1, total_msgs = total_msgs + 1 WHERE user_id = $2', [exp, id])
    const u = await pg.query('SELECT level, exp FROM users WHERE user_id=$1', [id])
    if (!u.rows.length) return false
    const needed = u.rows[0].level * 100
    if (u.rows[0].exp >= needed) {
      await pg.query('UPDATE users SET level = level + 1, exp = exp - $1 WHERE user_id = $2', [needed, id])
      return true
    }
    return false
  } catch (err) { return false }
}

async function isMuted(peer, uid) {
  const r = await pg.query('SELECT until FROM mutes WHERE peer_id=$1 AND user_id=$2', [peer, uid])
  if (r.rows.length && r.rows[0].until > Date.now()/1000) return true
  if (r.rows.length) await pg.query('DELETE FROM mutes WHERE peer_id=$1 AND user_id=$2', [peer, uid])
  return false
}

async function isChatOwner(peer, uid) {
  if (peer < 2e9) return false
  try {
    const conv = await api('messages.getConversationsById', { peer_ids: peer })
    if (!conv.error && conv.response?.items?.length) return conv.response.items[0]?.chat_settings?.owner_id === uid
  } catch {}
  return false
}

async function isVkAdmin(peer, uid) {
  if (peer < 2e9) return false
  try {
    const r = await api('messages.getConversationMembers', { peer_id: peer })
    if (!r.error && r.response?.items) return r.response.items.some(m => m.member_id === uid && (m.is_admin || m.is_owner))
  } catch {}
  return false
}

async function hasPerm(peer, uid, perm) {
  if (uid === ADMIN_ID) return true
  if (await isChatOwner(peer, uid)) return true
  if (await isVkAdmin(peer, uid)) return true
  const rk = await getRank(peer, uid)
  return rk ? !!rk[perm] : false
}

async function getRank(peer, uid) {
  const r = await pg.query('SELECT r.* FROM user_ranks ur JOIN ranks r ON ur.rank_id=r.id WHERE ur.peer_id=$1 AND ur.user_id=$2', [peer, uid])
  return r.rows[0] || null
}

async function getMarry(id) {
  const r = await pg.query('SELECT * FROM marriages WHERE user1=$1 OR user2=$1', [id])
  if (!r.rows.length) return null
  const m = r.rows[0]
  return m.user1 == id ? { partner: m.user2, date: m.date } : { partner: m.user1, date: m.date }
}

async function getClan(id) {
  const r = await pg.query('SELECT c.*, cm.role FROM clans c JOIN clan_members cm ON c.id=cm.clan_id WHERE cm.user_id=$1', [id])
  return r.rows[0] || null
}

async function getTeam(id) {
  const r = await pg.query('SELECT t.*, tm.role FROM teams t JOIN team_members tm ON t.id=tm.team_id WHERE tm.user_id=$1', [id])
  return r.rows[0] || null
}

async function getRelation(user1, user2) {
  const a = Math.min(user1, user2), b = Math.max(user1, user2)
  const r = await pg.query('SELECT * FROM relations WHERE user1=$1 AND user2=$2', [a, b])
  return r.rows[0] || null
}

function getRelationLevel(hp) {
  let level = relationLevels[0]
  for (const l of relationLevels) { if (hp >= l.minHp) level = l }
  return level
}

async function addRelationHp(user1, user2, hp, actor, action) {
  const a = Math.min(user1, user2), b = Math.max(user1, user2)
  const existing = await getRelation(user1, user2)
  if (!existing) {
    await pg.query('INSERT INTO relations (user1, user2, hp, created_at) VALUES ($1,$2,$3,$4)', [a, b, Math.max(0, hp), new Date().toISOString()])
  } else {
    await pg.query('UPDATE relations SET hp = GREATEST(0, hp + $1) WHERE user1=$2 AND user2=$3', [hp, a, b])
  }
  await pg.query('INSERT INTO relation_logs (user1, user2, actor, action, hp_change, timestamp) VALUES ($1,$2,$3,$4,$5,$6)',
    [a, b, actor, action, hp, new Date().toISOString()])
  return await getRelation(user1, user2)
}

function getLovePercent(a, b) {
  const s = (a + b).toString()
  let hash = 0
  for (let i = 0; i < s.length; i++) { hash = ((hash << 5) - hash) + s.charCodeAt(i); hash |= 0 }
  return Math.abs(hash % 101)
}

function flipText(text) {
  const map = {
    'а':'ɐ','б':'ƍ','в':'ʚ','г':'ɹ','д':'ɓ','е':'ǝ','ё':'ǝ̤','ж':'ж','з':'ε','и':'и','й':'й',
    'к':'ʞ','л':'v','м':'w','н':'н','о':'о','п':'u','р':'d','с':'ɔ','т':'ɯ','у':'ʎ','ф':'ȸ',
    'х':'х','ц':'ǹ','ч':'Һ','ш':'m','щ':'m','ъ':'ъ','ы':'ы','ь':'ь','э':'є','ю':'ю','я':'ʁ',
    'a':'ɐ','b':'q','c':'ɔ','d':'p','e':'ǝ','f':'ɟ','g':'ƃ','h':'ɥ','i':'ı','j':'ɾ','k':'ʞ',
    'l':'l','m':'ɯ','n':'u','o':'o','p':'d','q':'b','r':'ɹ','s':'s','t':'ʇ','u':'n','v':'ʌ',
    'w':'ʍ','x':'x','y':'ʎ','z':'z','?':'⸮','!':'¡','.':'˙',',':"'"
  }
  return text.split('').reverse().map(c => map[c.toLowerCase()] || c).join('')
}

async function logRankAction(peer, adminId, userId, action, rankName) {
  await pg.query('INSERT INTO rank_logs (peer_id, admin_id, user_id, action, rank_name, timestamp) VALUES ($1,$2,$3,$4,$5,$6)',
    [peer, adminId, userId, action, rankName, new Date().toISOString()])
}

// ========== ОСНОВНОЙ ОБРАБОТЧИК ==========
async function handleCommand(msg) {
  const peer = msg.peer_id
  const uid = msg.from_id
  const txt = (msg.text || '').trim()

  await ensureUser(uid)
  
  try {
    const leveled = await addExp(uid, Math.floor(Math.random() * 3) + 1)
    if (leveled) {
      const u = await pg.query('SELECT level FROM users WHERE user_id=$1', [uid])
      if (u.rows.length) sendMsg(peer, `🎉 @id${uid} получил ${u.rows[0].level} уровень!`)
    }
  } catch (err) {}

  if (!txt) return

  const args = txt.split(/\s+/)
  const firstWord = args[0] || ''

  // ===== РП КОМАНДЫ И ДЕЙСТВИЯ ОТНОШЕНИЙ =====
  const rpPrefixes = ['-', '/']
  let rpTrigger = null
  
  for (const prefix of rpPrefixes) {
    if (firstWord.startsWith(prefix) && firstWord.length > 1) {
      rpTrigger = firstWord.slice(prefix.length).toLowerCase()
      break
    }
  }

  if (rpTrigger) {
    // Проверяем действия отношений
    if (relationActions[rpTrigger]) {
      const rep = msg.reply_message
      if (!rep || rep.from_id === uid) return sendMsg(peer, '❌ Ответьте на сообщение партнёра')
      
      const action = relationActions[rpTrigger]
      const coolKey = `${uid}_${rep.from_id}_${rpTrigger}`
      const lastTime = lastActionTime.get(coolKey) || 0
      
      if (action.cooldown > 0 && Date.now() - lastTime < action.cooldown * 1000) {
        const left = Math.ceil((action.cooldown * 1000 - (Date.now() - lastTime)) / 60000)
        return sendMsg(peer, `🕔 Действие недоступно. Ждите ${left} мин`)
      }
      
      let rel = await getRelation(uid, rep.from_id)
      if (!rel) {
        rel = await addRelationHp(uid, rep.from_id, 1, uid, 'начало отношений')
      }
      
      const newRel = await addRelationHp(uid, rep.from_id, action.hp, uid, rpTrigger)
      const level = getRelationLevel(newRel.hp)
      
      if (action.cooldown > 0) {
        lastActionTime.set(coolKey, Date.now())
      }
      
      let actionText = action.text.replace('{user}', `@id${uid}`).replace('{target}', `@id${rep.from_id}`)
      return sendMsg(peer, `${action.emoji} | ${actionText}\n💗 +${action.hp} HP | ${level.emoji} ${level.name} (${newRel.hp} HP)`)
    }
    
    // Обычные РП-команды
    const rpCmd = await pg.query('SELECT * FROM rp_commands WHERE peer_id=$1 AND name=$2', [peer, rpTrigger])
    if (rpCmd.rows.length) {
      const cmd_data = rpCmd.rows[0]
      const rep = msg.reply_message
      const targetText = args.slice(1).join(' ')
      let actionText = cmd_data.action
      
      actionText = actionText.replace(/{user}/g, `@id${uid}`)
      
      if (rep && rep.from_id !== uid) {
        actionText = actionText.replace(/{target}/g, `@id${rep.from_id}`)
      } else {
        actionText = actionText.replace(/{target}/g, targetText || 'воздух')
      }
      
      if (actionText.includes('{random}')) {
        try {
          const r = await api('messages.getConversationMembers', { peer_id: peer })
          if (!r.error && r.response?.items) {
            const members = r.response.items.filter(m => m.member_id > 0 && m.member_id !== uid)
            if (members.length) {
              const random = members[Math.floor(Math.random() * members.length)]
              actionText = actionText.replace(/{random}/g, `@id${random.member_id}`)
            } else {
              actionText = actionText.replace(/{random}/g, 'никого')
            }
          }
        } catch {}
      }
      
      return sendMsg(peer, `${cmd_data.emoji} | ${actionText}`)
    }
  }

  if (await isMuted(peer, uid)) return
  
  const bl = await pg.query('SELECT 1 FROM blacklist WHERE user_id=$1', [uid])
  if (bl.rows.length) return

  const cmd = firstWord.toLowerCase()

  // ===== ПОМОЩЬ =====
  if (cmd === '!помощь' || cmd === '!хелп' || cmd === '!help' || cmd === '!команды') {
    const isOwner = await isChatOwner(peer, uid)
    const hasModPerms = await hasPerm(peer, uid, 'can_manage')
    
    let help = `📋 Список команд:

💕 Отношения:
+отн — предложить отношения (ответом)
-отн — разорвать отношения (ответом)
!отн статус — статус отношений
!мои отношения — список ваших отношений
!отн действия — список действий для развития
!отн история — история действий (ответом)

Действия для развития отношений:
-обнять (+2 HP), -поцеловать (+3 HP)
-поговорить (+1 HP), -поддержать (+2 HP)
-погулять (+3 HP, кулдаун 1 час)
-по душам (+5 HP, кулдаун 2 часа)
-подарить цветы (+4 HP, кулдаун 1 час)
-приготовить ужин (+6 HP, кулдаун 2 часа)
-сходить в кино (+5 HP, кулдаун 2 часа)
-сделать сюрприз (+8 HP, кулдаун 4 часа)
-признаться в любви (+10 HP, кулдаун 24 часа)
-подарить кольцо (+15 HP, кулдаун 24 часа)

💬 РП-команды:
-обнять, -поцеловать, -ударить, -убить и др.
!рпсписок — все РП-команды чата
!рпсоздать Название | эмодзи | действие — создать свою (100💰)
!рпудалить [название] — удалить свою РП-команду
!кто — случайный участник чата
!айди — ID пользователя

💰 Экономика:
!бонус — ежедневный бонус +50💰
!работа — заработать (раз в час)
!топ — топ-10 богачей
!рейтинг — топ по уровню
!передать [сумма] — перевод денег (ответом)
!казино [сумма] — игра 50/50
!магазин — список товаров
!купить [предмет] — купить предмет
!инвентарь — ваш инвентарь
!подарить [предмет] — подарить предмет (ответом)

🎮 Развлечения:
!кубик — бросить кубик 🎲
!монета — орёл или решка 🪙
!8шар [вопрос] — магический шар 🔮
!цитата — случайная цитата 📜
!перевернуть [текст] — перевернуть текст
!сколько [вопрос] — случайный процент
!любовь — совместимость (ответом) 💖

👤 Профиль:
!анкета — полная информация
!уровень — текущий уровень
!айди — ID пользователя

💑 Брак:
!брак — предложить брак (ответом)
!брак да — согласиться на брак
!развод — развестись
!браки — список всех браков

⏰ Прочее:
!напомни [мин] [текст] — установить напоминание

🏰 Кланы:
!клансоздать [название] — создать клан (500💰)
!клан — информация о клане
!кланпринять — принять в клан (ответом)
!кланвыйти — покинуть клан

👥 Команды:
!создатькоманду [название] — создать команду (1000💰)
!моякоманда — информация о команде
!принятьвкоманду — принять участника (ответом)
!выйтиизкоманды — покинуть команду
!распуститькоманду — удалить команду`

    if (isOwner || hasModPerms) {
      help += `

🔨 Модерация:

🎖️ Ранги:
!создатьранг Название | эмодзи | права
  Права: warn, mute, kick, ban, invite, manage
!ранги — список рангов с участниками
!выдатьранг [название] — выдать ранг (ответом)
!снятьранг — снять ранг (ответом)
!удалитьранг [название] — удалить ранг
!права [право] [0/1] — изменить право ранга

📊 Просмотр модерации:
!админы — список модераторов
  (!staff, !управляющие)
  🟢 онлайн ⚪ оффлайн ➖ не в чате
!ктоназначил — кто выдал ранг (ответом)
!модерлог — журнал изменений рангов
!моймодерлог — мои изменения ранга

⚡ Наказания:
!бан — забанить (ответом)
!кик — исключить (ответом)
!мут [минуты] — замутить (по умолчанию 10 мин)
!размут — снять мут (ответом)
!варн — предупреждение (3 варна = кик)
!стата — количество участников

💡 Важно:
• Создатель беседы всегда имеет все права
• Самостоятельно вернуть права нельзя
• Ранги настраиваются для каждого чата отдельно`
    }

    help += '\n\n🔧 !пинг — проверка работы бота'
    return sendMsg(peer, help)
  }

  if (cmd === '!пинг' || cmd === '!кинг') return sendMsg(peer, '🏓 Понг! Бот работает!')

  // ===== ОТНОШЕНИЯ =====
  if (cmd === '+отн' || cmd === '!+отн') {
    const rep = msg.reply_message
    if (!rep || rep.from_id === uid) return sendMsg(peer, '❌ Ответьте на сообщение пользователя')
    
    const existing = await getRelation(uid, rep.from_id)
    if (existing) return sendMsg(peer, '❌ У вас уже есть отношения с этим пользователем\nИспользуйте -отн чтобы разорвать')
    
    // Проверяем встречную заявку
    const reqKey = `${rep.from_id}_${uid}`
    if (relationRequests.has(reqKey)) {
      const req = relationRequests.get(reqKey)
      if (Date.now() - req.time < 300_000) {
        await addRelationHp(uid, rep.from_id, 1, uid, 'принятие заявки')
        relationRequests.delete(reqKey)
        return sendMsg(peer, `💕 @id${uid} и @id${rep.from_id} теперь в отношениях!\n👋 Уровень: Знакомые (1 HP)`)
      }
      relationRequests.delete(reqKey)
    }
    
    // Создаём заявку
    const key = `${uid}_${rep.from_id}`
    relationRequests.set(key, { from: uid, to: rep.from_id, time: Date.now() })
    return sendMsg(peer, `💌 @id${uid} предлагает отношения @id${rep.from_id}!\nВведите +отн (ответом) чтобы принять`)
  }

  if (cmd === '-отн' || cmd === '!-отн' || cmd === '!отн разорвать' || cmd === '!отн расстаться') {
    const rep = msg.reply_message
    let targetId = rep ? rep.from_id : null
    
    if (!targetId && args[1]) {
      const match = args[1].match(/id(\d+)/)
      if (match) targetId = parseInt(match[1])
    }
    
    if (!targetId) return sendMsg(peer, '❌ Укажите пользователя (ответом или ссылкой)')
    
    const rel = await getRelation(uid, targetId)
    if (!rel) return sendMsg(peer, '❌ У вас нет отношений с этим пользователем')
    
    const a = Math.min(uid, targetId), b = Math.max(uid, targetId)
    await pg.query('DELETE FROM relations WHERE user1=$1 AND user2=$2', [a, b])
    return sendMsg(peer, `💔 Отношения с @id${targetId} разорваны`)
  }

  if (cmd === '!отн' && (args[1] === 'статус' || args[1] === 'стата')) {
    const rep = msg.reply_message
    let targetId = rep ? rep.from_id : null
    
    if (!targetId && args[2]) {
      const match = args[2].match(/id(\d+)/)
      if (match) targetId = parseInt(match[1])
    }
    
    if (!targetId) return sendMsg(peer, '❌ Укажите пользователя')
    
    const rel = await getRelation(uid, targetId)
    if (!rel) return sendMsg(peer, '💔 У вас нет отношений с этим пользователем')
    
    const level = getRelationLevel(rel.hp)
    const nextLevel = relationLevels.find(l => l.minHp > rel.hp)
    const need = nextLevel ? nextLevel.minHp - rel.hp : 0
    
    return sendMsg(peer, 
      `💕 Отношения @id${uid} и @id${targetId}:\n\n` +
      `${level.emoji} Уровень: ${level.name}\n` +
      `❤️ HP: ${rel.hp}\n` +
      `📅 Начало: ${rel.created_at?.slice(0, 10) || 'неизвестно'}\n` +
      (need > 0 ? `⬆ До следующего уровня: ${need} HP\n🔓 Следующий: ${nextLevel.emoji} ${nextLevel.name}` : '🏆 Максимальный уровень!')
    )
  }

  if ((cmd === '!мои' && args[1] === 'отношения') || cmd === '!отношения' || cmd === '!отны') {
    const rels = await pg.query('SELECT * FROM relations WHERE user1=$1 OR user2=$1 ORDER BY hp DESC', [uid])
    
    if (!rels.rows.length) return sendMsg(peer, '💔 У вас пока нет отношений\n\nИспользуйте +отн (ответом) чтобы начать')
    
    let result = '💕 Ваши отношения:\n\n'
    for (const r of rels.rows) {
      const partner = r.user1 == uid ? r.user2 : r.user1
      const level = getRelationLevel(r.hp)
      const name = await getUserName(partner)
      result += `${level.emoji} @id${partner} (${name})\n   ${level.name} — ${r.hp} HP\n\n`
    }
    return sendMsg(peer, result)
  }

  if (cmd === '!отн' && args[1] === 'действия') {
    let result = '🎭 Действия для развития отношений:\n\n'
    for (const [name, action] of Object.entries(relationActions)) {
      result += `${action.emoji} -${name} — +${action.hp} HP`
      if (action.cooldown > 0) {
        const mins = Math.floor(action.cooldown / 60)
        const hours = Math.floor(mins / 60)
        result += hours > 0 ? ` (кулдаун: ${hours} ч)` : ` (кулдаун: ${mins} мин)`
      }
      result += '\n'
    }
    result += '\n💡 Используйте действия через ответ на сообщение партнёра'
    return sendMsg(peer, result)
  }

  if (cmd === '!отн' && args[1] === 'история') {
    const rep = msg.reply_message
    let targetId = rep ? rep.from_id : null
    
    if (!targetId) return sendMsg(peer, '❌ Ответьте на сообщение пользователя')
    
    const a = Math.min(uid, targetId), b = Math.max(uid, targetId)
    const logs = await pg.query('SELECT * FROM relation_logs WHERE user1=$1 AND user2=$2 ORDER BY timestamp DESC LIMIT 10', [a, b])
    
    if (!logs.rows.length) return sendMsg(peer, '📋 История действий пуста')
    
    let result = `📋 История отношений с @id${targetId}:\n\n`
    for (const l of logs.rows) {
      const date = new Date(l.timestamp).toLocaleString('ru')
      const actor = l.actor === uid ? 'Вы' : 'Партнёр'
      result += `${l.hp_change > 0 ? '💚' : '💔'} ${actor}: ${l.action} (${l.hp_change > 0 ? '+' : ''}${l.hp_change} HP)\n   📅 ${date}\n\n`
    }
    return sendMsg(peer, result)
  }

  // ===== АДМИНЫ =====
  if (cmd === '!админы' || cmd === '!staff' || cmd === '!управляющие' || cmd === '!admins' || cmd === '!ктоадмин') {
    let result = '📊 Модераторы чата:\n\n'
    
    if (peer > 2e9) {
      try {
        const conv = await api('messages.getConversationsById', { peer_ids: peer })
        if (!conv.error && conv.response?.items?.length) {
          const ownerId = conv.response.items[0]?.chat_settings?.owner_id
          if (ownerId) {
            const name = await getUserName(ownerId)
            result += `👑 Создатель: @id${ownerId} (${name}) 🟢\n\n`
          }
        }
      } catch {}
    }
    
    const ranks = await pg.query('SELECT * FROM ranks WHERE peer_id=$1 ORDER BY id', [peer])
    
    if (ranks.rows.length) {
      for (const rank of ranks.rows) {
        const members = await pg.query('SELECT ur.user_id FROM user_ranks ur WHERE ur.peer_id=$1 AND ur.rank_id=$2', [peer, rank.id])
        
        result += `${rank.emoji} ${rank.name}:\n`
        
        if (members.rows.length) {
          for (const m of members.rows) {
            const name = await getUserName(m.user_id)
            result += `  🟢 @id${m.user_id} (${name})\n`
          }
        } else {
          result += '  Нет участников\n'
        }
        result += '\n'
      }
    } else {
      result += '🎖️ Ранги не настроены\n!создатьранг — создать'
    }
    
    return sendMsg(peer, result)
  }

  // ===== ИГРЫ =====
  if (cmd === '!кубик') { const n = Math.floor(Math.random()*6)+1; return sendMsg(peer, `🎲 Выпало: ${n} ${['','⚀','⚁','⚂','⚃','⚄','⚅'][n]}`) }
  if (cmd === '!монета') { return sendMsg(peer, `🪙 ${Math.random()<0.5?'Орёл 🦅':'Решка 💰'}`) }
  if (cmd === '!8шар') { const q = args.slice(1).join(' '); if (!q) return sendMsg(peer, '❓ Используйте: !8шар [вопрос]'); return sendMsg(peer, `🔮 ${q}\n🎱 ${ballAnswers[Math.floor(Math.random()*ballAnswers.length)]}`) }
  if (cmd === '!цитата') { return sendMsg(peer, `📜 ${quotes[Math.floor(Math.random()*quotes.length)]}`) }
  if (cmd === '!перевернуть') { const t = args.slice(1).join(' '); if (!t) return sendMsg(peer, '❌ !перевернуть [текст]'); return sendMsg(peer, `🔄 ${flipText(t)}`) }
  if (cmd === '!сколько') { const q = args.slice(1).join(' '); if (!q) return sendMsg(peer, '❌ !сколько [вопрос]'); return sendMsg(peer, `📊 ${q}\nОтвет: ${Math.floor(Math.random()*101)}%`) }
  if (cmd === '!любовь') { const rep = msg.reply_message; if (!rep||rep.from_id===uid) return sendMsg(peer, '❌ Ответьте на сообщение'); const p = getLovePercent(uid, rep.from_id); const e = p>80?'💖':p>50?'💗':p>30?'💛':'💔'; return sendMsg(peer, `${e} Совместимость @id${uid} и @id${rep.from_id}: ${p}%`) }

  // ===== ПРОФИЛЬ =====
  if (cmd === '!анкета' || cmd === '!профиль' || cmd === '!я') {
    try {
      const u = await pg.query('SELECT * FROM users WHERE user_id=$1', [uid])
      if (!u.rows.length) return sendMsg(peer, '❌ Напишите !старт')
      const d = u.rows[0]
      const needed = (d.level || 1) * 100
      const pct = Math.min(100, Math.floor(((d.exp || 0) / needed) * 100))
      const bar = '█'.repeat(Math.floor(pct/10)) + '░'.repeat(10-Math.floor(pct/10))
      const marry = await getMarry(uid)
      const clan = await getClan(uid)
      const team = await getTeam(uid)
      const rk = await getRank(peer, uid)
      const userName = await getUserName(uid)
      return sendMsg(peer,
        `👤 ${userName}\n\n` +
        `💰 Баланс: ${d.balance || 0}\n` +
        `⭐ Уровень: ${d.level || 1} | ${bar} ${pct}%\n` +
        `💬 Сообщений: ${d.total_msgs || 0} | 👍 Репа: ${d.rep || 0}\n` +
        `${rk ? `🎖️ Ранг: ${rk.emoji} ${rk.name}` : '🎖️ Нет ранга'}\n` +
        `${marry ? `💑 Брак: @id${marry.partner} (${marry.date})` : '💔 Не в браке'}\n` +
        `${clan ? `🏰 Клан: ${clan.name}` : '🏰 Нет клана'}\n` +
        `${team ? `👥 Команда: ${team.name}` : '👥 Нет команды'}`
      )
    } catch { return sendMsg(peer, '❌ Ошибка загрузки') }
  }

  if (cmd === '!уровень' || cmd === '!лвл') {
    try {
      const u = await pg.query('SELECT level, exp FROM users WHERE user_id=$1', [uid])
      if (!u.rows.length) return sendMsg(peer, '❌ Напишите !старт')
      const needed = (u.rows[0].level || 1) * 100
      const pct = Math.min(100, Math.floor(((u.rows[0].exp || 0) / needed) * 100))
      const bar = '█'.repeat(Math.floor(pct/10)) + '░'.repeat(10-Math.floor(pct/10))
      return sendMsg(peer, `⭐ Уровень: ${u.rows[0].level || 1}\n📊 ${bar} ${pct}%\n💡 ${u.rows[0].exp || 0}/${needed} XP`)
    } catch { return sendMsg(peer, '❌ Ошибка') }
  }

  if (cmd === '!айди' || cmd === '!ид') {
    const rep = msg.reply_message
    if (rep) { const name = await getUserName(rep.from_id); return sendMsg(peer, `🆔 ${name}\nID: ${rep.from_id}`) }
    return sendMsg(peer, `🆔 Ваш ID: ${uid}`)
  }

  if (cmd === '!кто' || cmd === '!рандом') {
    try {
      const r = await api('messages.getConversationMembers', { peer_id: peer })
      if (r.error) return sendMsg(peer, '❌ Ошибка')
      const members = r.response.items.filter(m => m.member_id > 0)
      if (!members.length) return sendMsg(peer, '❌ Пусто')
      const random = members[Math.floor(Math.random()*members.length)]
      return sendMsg(peer, `🎯 @id${random.member_id}`)
    } catch { return sendMsg(peer, '❌ Ошибка') }
  }

  // ===== ЭКОНОМИКА =====
  if (cmd === '!старт' || cmd === '!начать') return sendMsg(peer, '👋 Вы в системе!\n💰 100 монет\n🔰 1 уровень\n!помощь — список команд')

  if (cmd === '!бонус' || cmd === '!дейли') {
    const today = new Date().toDateString()
    const u = await pg.query('SELECT last_daily FROM users WHERE user_id=$1', [uid])
    if (u.rows[0]?.last_daily === today) return sendMsg(peer, '❌ Вы уже получили бонус сегодня')
    await addBal(uid, 50)
    await pg.query('UPDATE users SET last_daily=$1 WHERE user_id=$2', [today, uid])
    return sendMsg(peer, '🎁 +50💰')
  }

  if (cmd === '!работа' || cmd === '!ворк') {
    const u = await pg.query('SELECT last_work FROM users WHERE user_id=$1', [uid])
    const now = Date.now()
    if (u.rows[0]?.last_work && now - new Date(u.rows[0].last_work).getTime() < 3_600_000) {
      const left = Math.ceil((3_600_000 - (now - new Date(u.rows[0].last_work).getTime())) / 60_000)
      return sendMsg(peer, `⏳ Подождите ${left} мин`)
    }
    const earned = Math.floor(Math.random()*41)+20
    await addBal(uid, earned)
    await pg.query('UPDATE users SET last_work=$1 WHERE user_id=$2', [new Date().toISOString(), uid])
    return sendMsg(peer, `💼 +${earned}💰`)
  }

  if (cmd === '!топ') {
    const r = await pg.query('SELECT user_id, balance FROM users ORDER BY balance DESC LIMIT 10')
    if (!r.rows.length) return sendMsg(peer, 'Пусто')
    let result = '🏆 Топ-10:\n'
    for (let i = 0; i < r.rows.length; i++) {
      const name = await getUserName(r.rows[i].user_id)
      result += `${i+1}. ${name} — ${r.rows[i].balance}💰\n`
    }
    return sendMsg(peer, result)
  }

  if (cmd === '!рейтинг' || cmd === '!топлевел') {
    const r = await pg.query('SELECT user_id, level FROM users ORDER BY level DESC LIMIT 10')
    if (!r.rows.length) return sendMsg(peer, 'Пусто')
    let result = '📊 Топ по уровню:\n'
    for (let i = 0; i < r.rows.length; i++) result += `${i+1}. @id${r.rows[i].user_id} — ${r.rows[i].level}⭐\n`
    return sendMsg(peer, result)
  }

  if (cmd === '!передать' || cmd === '!перевод') {
    const rep = msg.reply_message
    if (!rep || rep.from_id === uid) return sendMsg(peer, '❌ Ответьте на сообщение получателя')
    const amt = parseInt(args[1])
    if (!amt || amt < 1) return sendMsg(peer, '❌ !передать [сумма]')
    if (await getBal(uid) < amt) return sendMsg(peer, `❌ Недостаточно средств. Баланс: ${await getBal(uid)}💰`)
    await addBal(uid, -amt)
    await addBal(rep.from_id, amt)
    return sendMsg(peer, `💸 @id${uid} → @id${rep.from_id}: ${amt}💰`)
  }

  if (cmd === '!казино' || cmd === '!каз') {
    const bet = parseInt(args[1])
    if (!bet || bet < 1) return sendMsg(peer, '❌ !казино [сумма]')
    if (await getBal(uid) < bet) return sendMsg(peer, `❌ Недостаточно средств. Баланс: ${await getBal(uid)}💰`)
    if (Math.random() < 0.5) { await addBal(uid, bet); return sendMsg(peer, `🎰 Выигрыш! +${bet}💰`) }
    else { await addBal(uid, -bet); return sendMsg(peer, `🎰 Проигрыш! -${bet}💰`) }
  }

  if (cmd === '!магазин' || cmd === '!шоп') {
    let result = '🏪 Магазин:\n'
    for (const [name, item] of Object.entries(shopItems)) result += `${item.emoji} ${name} — ${item.price}💰\n`
    result += '\n!купить [название]'
    return sendMsg(peer, result)
  }

  if (cmd === '!купить' || cmd === '!бай') {
    const item = args.slice(1).join(' ').toLowerCase()
    const entry = shopItems[item]
    if (!entry) return sendMsg(peer, '❌ Товар не найден')
    if (await getBal(uid) < entry.price) return sendMsg(peer, `❌ Нужно ${entry.price}💰`)
    await addBal(uid, -entry.price)
    const ex = await pg.query('SELECT quantity FROM inventory WHERE user_id=$1 AND item=$2', [uid, item])
    if (ex.rows.length) await pg.query('UPDATE inventory SET quantity=quantity+1 WHERE user_id=$1 AND item=$2', [uid, item])
    else await pg.query('INSERT INTO inventory VALUES ($1,$2,1)', [uid, item])
    return sendMsg(peer, `✅ ${entry.emoji} ${item} за ${entry.price}💰`)
  }

  if (cmd === '!инвентарь' || cmd === '!инв') {
    const r = await pg.query('SELECT item, quantity FROM inventory WHERE user_id=$1', [uid])
    if (!r.rows.length) return sendMsg(peer, '🎒 Инвентарь пуст')
    let result = '🎒 Инвентарь:\n'
    for (const x of r.rows) result += `• ${x.item} x${x.quantity}\n`
    return sendMsg(peer, result)
  }

  if (cmd === '!подарить' || cmd === '!гифт') {
    const rep = msg.reply_message
    if (!rep || rep.from_id === uid) return sendMsg(peer, '❌ Ответьте на сообщение')
    const item = args.slice(1).join(' ').toLowerCase()
    const inv = await pg.query('SELECT quantity FROM inventory WHERE user_id=$1 AND item=$2', [uid, item])
    if (!inv.rows.length || inv.rows[0].quantity < 1) return sendMsg(peer, `❌ У вас нет "${item}"`)
    await pg.query('UPDATE inventory SET quantity=quantity-1 WHERE user_id=$1 AND item=$2', [uid, item])
    const ex = await pg.query('SELECT quantity FROM inventory WHERE user_id=$1 AND item=$2', [rep.from_id, item])
    if (ex.rows.length) await pg.query('UPDATE inventory SET quantity=quantity+1 WHERE user_id=$1 AND item=$2', [rep.from_id, item])
    else await pg.query('INSERT INTO inventory VALUES ($1,$2,1)', [rep.from_id, item])
    return sendMsg(peer, `🎁 @id${uid} подарил @id${rep.from_id} "${item}"`)
  }

  // ===== БРАК =====
  if (cmd === '!брак' || cmd === '!марри') {
    if ((args[1]==='да'||args[1]==='согласен'||args[1]==='согласна') && marryRequests.has(uid)) {
      const req = marryRequests.get(uid)
      if (Date.now()-req.time > 300000) { marryRequests.delete(uid); return sendMsg(peer, '❌ Предложение истекло') }
      await pg.query('INSERT INTO marriages VALUES ($1,$2,$3,0)', [req.from, uid, new Date().toLocaleDateString('ru')])
      marryRequests.delete(uid)
      return sendMsg(peer, `💒 @id${req.from} и @id${uid} теперь в браке!`)
    }
    const rep = msg.reply_message
    if (!rep || rep.from_id === uid) return sendMsg(peer, '❌ Ответьте на сообщение')
    if (await getMarry(uid)) return sendMsg(peer, '❌ Вы уже в браке')
    if (await getMarry(rep.from_id)) return sendMsg(peer, '❌ Партнёр уже в браке')
    marryRequests.set(rep.from_id, { from: uid, time: Date.now() })
    return sendMsg(peer, `💍 @id${uid} предлагает брак @id${rep.from_id}!\nВведите !брак да`)
  }

  if (cmd === '!развод' || cmd === '!диворс') {
    const m = await getMarry(uid)
    if (!m) return sendMsg(peer, '❌ Вы не в браке')
    await pg.query('DELETE FROM marriages WHERE (user1=$1 AND user2=$2) OR (user1=$2 AND user2=$1)', [uid, m.partner])
    return sendMsg(peer, `💔 Вы развелись с @id${m.partner}`)
  }

  if (cmd === '!браки' || cmd === '!марриес') {
    const r = await pg.query('SELECT * FROM marriages')
    if (!r.rows.length) return sendMsg(peer, '💔 Нет браков')
    let result = '💑 Браки:\n'
    for (const x of r.rows) result += `• @id${x.user1} ❤️ @id${x.user2} (${x.date})\n`
    return sendMsg(peer, result)
  }

  // ===== НАПОМИНАНИЯ =====
  if (cmd === '!напомни' || cmd === '!рем') {
    const min = parseInt(args[1])
    const text = args.slice(2).join(' ')
    if (!min || min < 1 || min > 1440) return sendMsg(peer, '❌ !напомни [мин] [текст] (1-1440)')
    if (!text) return sendMsg(peer, '❌ Укажите текст')
    await pg.query('INSERT INTO reminders (user_id, peer_id, remind_time, text) VALUES ($1,$2,$3,$4)',
      [uid, peer, Date.now()+min*60000, text])
    return sendMsg(peer, `⏰ Напомню через ${min} мин: "${text}"`)
  }

  // ===== КОМАНДЫ =====
  if (cmd === '!создатькоманду' || cmd === '!командасоздать') {
    const name = args.slice(1).join(' ')
    if (!name) return sendMsg(peer, '❌ !создатькоманду [название]')
    if (await getTeam(uid)) return sendMsg(peer, '❌ Вы уже в команде')
    if (await getBal(uid) < 1000) return sendMsg(peer, `❌ Нужно 1000💰`)
    await addBal(uid, -1000)
    const res = await pg.query('INSERT INTO teams (peer_id, name, owner_id, created_at) VALUES ($1,$2,$3,$4) RETURNING id', [peer, name, uid, new Date().toISOString()])
    await pg.query('INSERT INTO team_members VALUES ($1,$2,$3)', [res.rows[0].id, uid, 'owner'])
    return sendMsg(peer, `👥 Команда "${name}" создана!`)
  }

  if (cmd === '!моякоманда' || cmd === '!команда') {
    const team = await getTeam(uid)
    if (!team) return sendMsg(peer, '❌ Вы не в команде')
    const members = await pg.query('SELECT user_id, role FROM team_members WHERE team_id=$1', [team.id])
    let result = `👥 ${team.name}\n👑 Владелец: @id${team.owner_id}\n\nУчастники:\n`
    for (const m of members.rows) result += `• @id${m.user_id} (${m.role})\n`
    return sendMsg(peer, result)
  }

  if (cmd === '!принятьвкоманду' || cmd === '!командапринять') {
    const team = await getTeam(uid)
    if (!team || team.role !== 'owner') return sendMsg(peer, '❌ Только владелец')
    const rep = msg.reply_message
    if (!rep || rep.from_id === uid) return sendMsg(peer, '❌ Ответьте на сообщение')
    if (await getTeam(rep.from_id)) return sendMsg(peer, '❌ Уже в другой команде')
    await pg.query('INSERT INTO team_members VALUES ($1,$2,$3)', [team.id, rep.from_id, 'member'])
    return sendMsg(peer, `✅ @id${rep.from_id} принят в команду`)
  }

  if (cmd === '!выйтиизкоманды' || cmd === '!командавыйти') {
    const team = await getTeam(uid)
    if (!team) return sendMsg(peer, '❌ Вы не в команде')
    if (team.role === 'owner') {
      await pg.query('DELETE FROM team_members WHERE team_id=$1', [team.id])
      await pg.query('DELETE FROM teams WHERE id=$1', [team.id])
      return sendMsg(peer, '👥 Команда распущена')
    }
    await pg.query('DELETE FROM team_members WHERE team_id=$1 AND user_id=$2', [team.id, uid])
    return sendMsg(peer, '👋 Вы вышли из команды')
  }

  if (cmd === '!распуститькоманду' || cmd === '!командараспустить') {
    const team = await getTeam(uid)
    if (!team || team.role !== 'owner') return sendMsg(peer, '❌ Только владелец')
    await pg.query('DELETE FROM team_members WHERE team_id=$1', [team.id])
    await pg.query('DELETE FROM teams WHERE id=$1', [team.id])
    return sendMsg(peer, '👥 Команда распущена')
  }

  // ===== РП-КОМАНДЫ =====
  if (cmd === '!рпсоздать' || cmd === '!создатьрп') {
    const parts = txt.split('|').map(p => p.trim())
    if (parts.length < 2) {
      return sendMsg(peer, '❌ !рпсоздать Название | эмодзи | действие\n{user} — отправитель, {target} — цель, {random} — случайный\nСтоимость: 100💰')
    }
    const name = parts[0].split(' ').slice(1).join(' ').toLowerCase().trim()
    if (!name) return sendMsg(peer, '❌ Укажите название')
    if (await getBal(uid) < 100) return sendMsg(peer, `❌ Нужно 100💰`)
    await addBal(uid, -100)
    const emoji = parts[1]?.trim() || '🩸'
    const action = parts[2]?.trim() || '{user} делает что-то с {target}'
    const exists = await pg.query('SELECT id FROM rp_commands WHERE peer_id=$1 AND name=$2', [peer, name])
    if (exists.rows.length) await pg.query('UPDATE rp_commands SET emoji=$1, action=$2 WHERE id=$3', [emoji, action, exists.rows[0].id])
    else await pg.query('INSERT INTO rp_commands (peer_id, name, action, emoji, created_by) VALUES ($1,$2,$3,$4,$5)', [peer, name, action, emoji, uid])
    return sendMsg(peer, `✅ РП-команда "${emoji} ${name}" создана!\nИспользование: -${name}`)
  }

  if (cmd === '!рпсписок' || cmd === '!рп') {
    const cmds = await pg.query('SELECT * FROM rp_commands WHERE peer_id=$1 ORDER BY name', [peer])
    if (!cmds.rows.length) return sendMsg(peer, '🎭 Нет кастомных РП-команд\n\nСтандартные доступны через -\n!рпсоздать — создать свою (100💰)')
    let result = '🎭 РП-команды чата:\n\n'
    for (const c of cmds.rows) result += `• -${c.name} ${c.emoji}\n`
    return sendMsg(peer, result)
  }

  if (cmd === '!рпудалить' || cmd === '!удалитьрп') {
    const name = args.slice(1).join(' ').toLowerCase()
    if (!name) return sendMsg(peer, '❌ !рпудалить [название]')
    const c = await pg.query('SELECT created_by FROM rp_commands WHERE peer_id=$1 AND name=$2', [peer, name])
    if (!c.rows.length) return sendMsg(peer, '❌ Не найдена')
    if (c.rows[0].created_by !== uid && !await hasPerm(peer, uid, 'can_manage')) return sendMsg(peer, '❌ Это не ваша команда')
    await pg.query('DELETE FROM rp_commands WHERE peer_id=$1 AND name=$2', [peer, name])
    return sendMsg(peer, `✅ РП-команда "-${name}" удалена`)
  }

  // ===== РАНГИ =====
  if (cmd === '!создатьранг' || cmd === '!добавитьранг') {
    if (!await hasPerm(peer, uid, 'can_manage')) return sendMsg(peer, '⛔ Нет прав')
    const parts = txt.split('|').map(p => p.trim())
    if (parts.length < 2) return sendMsg(peer, '❌ !создатьранг Название | эмодзи | права\nПрава: warn, mute, kick, ban, invite, manage')
    const name = parts[0].split(' ').slice(1).join(' ').trim()
    if (!name) return sendMsg(peer, '❌ Укажите название')
    const exists = await pg.query('SELECT id FROM ranks WHERE peer_id=$1 AND name=$2', [peer, name])
    if (exists.rows.length) return sendMsg(peer, '❌ Уже существует')
    const emoji = parts[1]?.trim() || '🎖️'
    const perms = (parts[2]||'').split(',').map(p => p.trim().toLowerCase()).filter(p => availablePermissions.includes(p))
    const obj = {}
    availablePermissions.forEach(p => { obj[p] = perms.includes(p) ? 1 : 0 })
    await pg.query('INSERT INTO ranks (peer_id, name, emoji, can_warn, can_mute, can_kick, can_ban, can_invite, can_manage) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [peer, name, emoji, obj.warn, obj.mute, obj.kick, obj.ban, obj.invite, obj.manage])
    return sendMsg(peer, `✅ Ранг "${emoji} ${name}" создан!`)
  }

  if (cmd === '!ранги' || cmd === '!роли') {
    const ranks = await pg.query('SELECT * FROM ranks WHERE peer_id=$1 ORDER BY id', [peer])
    if (!ranks.rows.length) return sendMsg(peer, '🎖️ Нет рангов\n!создатьранг — создать')
    let result = '📊 Ранги чата:\n\n'
    for (const rank of ranks.rows) {
      const members = await pg.query('SELECT user_id FROM user_ranks WHERE peer_id=$1 AND rank_id=$2', [peer, rank.id])
      result += `${rank.emoji} ${rank.name}\n`
      if (members.rows.length) { for (const m of members.rows) result += `  🏐 @id${m.user_id}\n` }
      else result += '  Пусто\n'
      result += '\n'
    }
    return sendMsg(peer, result)
  }

  if (cmd === '!выдатьранг' || cmd === '!датьранг') {
    if (!await hasPerm(peer, uid, 'can_manage')) return sendMsg(peer, '⛔ Нет прав')
    const rep = msg.reply_message
    if (!rep) return sendMsg(peer, '❌ Ответьте на сообщение')
    const rankName = args.slice(1).join(' ')
    if (!rankName) return sendMsg(peer, '❌ !выдатьранг [название]')
    const rank = await pg.query('SELECT id FROM ranks WHERE peer_id=$1 AND name=$2', [peer, rankName])
    if (!rank.rows.length) return sendMsg(peer, '❌ Ранг не найден')
    await pg.query('INSERT INTO user_ranks VALUES ($1,$2,$3) ON CONFLICT (peer_id,user_id) DO UPDATE SET rank_id=$3', [peer, rep.from_id, rank.rows[0].id])
    await logRankAction(peer, uid, rep.from_id, 'выдача', rankName)
    return sendMsg(peer, `🎖️ @id${rep.from_id} получил ранг "${rankName}"`)
  }

  if (cmd === '!снятьранг' || cmd === '!убратьранг') {
    if (!await hasPerm(peer, uid, 'can_manage')) return sendMsg(peer, '⛔ Нет прав')
    const rep = msg.reply_message
    if (!rep) return sendMsg(peer, '❌ Ответьте на сообщение')
    const currentRank = await getRank(peer, rep.from_id)
    if (!currentRank) return sendMsg(peer, '❌ У пользователя нет ранга')
    await pg.query('DELETE FROM user_ranks WHERE peer_id=$1 AND user_id=$2', [peer, rep.from_id])
    await logRankAction(peer, uid, rep.from_id, 'снятие', currentRank.name)
    return sendMsg(peer, `❌ @id${rep.from_id} лишён ранга "${currentRank.name}"`)
  }

  if (cmd === '!удалитьранг') {
    if (!await hasPerm(peer, uid, 'can_manage')) return sendMsg(peer, '⛔ Нет прав')
    const rankName = args.slice(1).join(' ')
    if (!rankName) return sendMsg(peer, '❌ !удалитьранг [название]')
    const rank = await pg.query('SELECT id FROM ranks WHERE peer_id=$1 AND name=$2', [peer, rankName])
    if (!rank.rows.length) return sendMsg(peer, '❌ Ранг не найден')
    await pg.query('DELETE FROM user_ranks WHERE peer_id=$1 AND rank_id=$2', [peer, rank.rows[0].id])
    await pg.query('DELETE FROM ranks WHERE id=$1', [rank.rows[0].id])
    return sendMsg(peer, `❌ Ранг "${rankName}" удалён`)
  }

  if (cmd === '!права') {
    if (!await hasPerm(peer, uid, 'can_manage')) return sendMsg(peer, '⛔ Нет прав')
    const rep = msg.reply_message
    if (!rep) return sendMsg(peer, '❌ Ответьте на сообщение пользователя с рангом')
    const rk = await getRank(peer, rep.from_id)
    if (!rk) return sendMsg(peer, '❌ У пользователя нет ранга')
    const perm = args[1]?.toLowerCase()
    const value = parseInt(args[2])
    if (!perm || !availablePermissions.includes(perm)) return sendMsg(peer, `❌ Права: ${availablePermissions.join(', ')}`)
    if (value !== 0 && value !== 1) return sendMsg(peer, '❌ 0 (выкл) или 1 (вкл)')
    await pg.query(`UPDATE ranks SET can_${perm}=$1 WHERE id=$2`, [value, rk.id])
    return sendMsg(peer, `✅ Право "${perm}" для ранга "${rk.name}" ${value ? 'включено' : 'выключено'}`)
  }

  if (cmd === '!ктоназначил' || cmd === '!ктовыдал') {
    const rep = msg.reply_message
    let targetId = rep ? rep.from_id : null
    if (!targetId && args[1]) { const m = args[1].match(/id(\d+)/); if (m) targetId = parseInt(m[1]) }
    if (!targetId) return sendMsg(peer, '❌ Укажите пользователя')
    const logs = await pg.query('SELECT * FROM rank_logs WHERE peer_id=$1 AND user_id=$2 AND action=$3 ORDER BY timestamp DESC LIMIT 5', [peer, targetId, 'выдача'])
    if (!logs.rows.length) return sendMsg(peer, '📋 Нет записей')
    let result = `📋 Кто назначил @id${targetId}:\n\n`
    for (const l of logs.rows) result += `• @id${l.admin_id} → "${l.rank_name}" (${new Date(l.timestamp).toLocaleString('ru')})\n`
    return sendMsg(peer, result)
  }

  if (cmd === '!модерлог' || cmd === '!модлог') {
    if (!await hasPerm(peer, uid, 'can_manage')) return sendMsg(peer, '⛔ Нет прав')
    const logs = await pg.query('SELECT * FROM rank_logs WHERE peer_id=$1 ORDER BY timestamp DESC LIMIT 15', [peer])
    if (!logs.rows.length) return sendMsg(peer, '📋 Нет записей')
    let result = '📋 Журнал изменений:\n\n'
    for (const l of logs.rows) result += `${l.action} "${l.rank_name}" → @id${l.user_id} (${new Date(l.timestamp).toLocaleString('ru')})\n`
    return sendMsg(peer, result)
  }

  if (cmd === '!моймодерлог' || cmd === '!моимодерлог') {
    const logs = await pg.query('SELECT * FROM rank_logs WHERE peer_id=$1 AND user_id=$2 ORDER BY timestamp DESC LIMIT 10', [peer, uid])
    if (!logs.rows.length) return sendMsg(peer, '📋 Нет изменений')
    let result = '📋 Мои изменения:\n\n'
    for (const l of logs.rows) result += `${l.action} "${l.rank_name}" (${new Date(l.timestamp).toLocaleString('ru')})\n`
    return sendMsg(peer, result)
  }

  // ===== АДМИН =====
  if (cmd === '!бан') { if (!await hasPerm(peer,uid,'can_ban')) return sendMsg(peer,'⛔'); const rep=msg.reply_message; if(!rep) return sendMsg(peer,'❌'); await pg.query('INSERT INTO blacklist VALUES ($1,$2) ON CONFLICT DO NOTHING',[rep.from_id,'Бан']); if(peer>2e9) try{await api('messages.removeChatUser',{chat_id:peer-2e9,user_id:rep.from_id})}catch{}; return sendMsg(peer,`🔨 @id${rep.from_id} забанен`) }
  if (cmd === '!кик') { if (!await hasPerm(peer,uid,'can_kick')) return sendMsg(peer,'⛔'); const rep=msg.reply_message; if(!rep) return sendMsg(peer,'❌'); if(peer>2e9) try{await api('messages.removeChatUser',{chat_id:peer-2e9,user_id:rep.from_id})}catch{}; return sendMsg(peer,`👢 @id${rep.from_id} кикнут`) }
  if (cmd === '!мут') { if (!await hasPerm(peer,uid,'can_mute')) return sendMsg(peer,'⛔'); const rep=msg.reply_message; if(!rep) return sendMsg(peer,'❌'); const min=parseInt(args[1])||10; await pg.query('INSERT INTO mutes VALUES ($1,$2,$3) ON CONFLICT (peer_id,user_id) DO UPDATE SET until=$3',[peer,rep.from_id,Date.now()/1000+min*60]); return sendMsg(peer,`🤐 @id${rep.from_id} мут ${min} мин`) }
  if (cmd === '!размут' || cmd === '!анмут') { if (!await hasPerm(peer,uid,'can_mute')) return sendMsg(peer,'⛔'); const rep=msg.reply_message; if(!rep) return sendMsg(peer,'❌'); await pg.query('DELETE FROM mutes WHERE peer_id=$1 AND user_id=$2',[peer,rep.from_id]); return sendMsg(peer,`🔊 @id${rep.from_id} размучен`) }
  if (cmd === '!варн' || cmd === '!пред') { if (!await hasPerm(peer,uid,'can_warn')) return sendMsg(peer,'⛔'); const rep=msg.reply_message; if(!rep) return sendMsg(peer,'❌'); const w=await pg.query('SELECT count FROM warns WHERE peer_id=$1 AND user_id=$2',[peer,rep.from_id]); const c=(w.rows[0]?.count||0)+1; await pg.query('INSERT INTO warns VALUES ($1,$2,$3) ON CONFLICT (peer_id,user_id) DO UPDATE SET count=$3',[peer,rep.from_id,c]); if(c>=3&&peer>2e9){try{await api('messages.removeChatUser',{chat_id:peer-2e9,user_id:rep.from_id})}catch{}; await pg.query('DELETE FROM warns WHERE peer_id=$1 AND user_id=$2',[peer,rep.from_id]); return sendMsg(peer,`🔨 @id${rep.from_id} кикнут (3/3)`)}; return sendMsg(peer,`⚠️ @id${rep.from_id} ${c}/3`) }
  if (cmd === '!стата' || cmd === '!статистика') { try{const r=await api('messages.getConversationMembers',{peer_id:peer}); return sendMsg(peer,`📊 Участников: ${r.response?.count||0}`)}catch{return sendMsg(peer,'❌')} }

  // ===== КЛАНЫ =====
  if (cmd === '!клансоздать' || cmd === '!кланкрейт') { const nm=args.slice(1).join(' '); if(!nm) return sendMsg(peer,'❌ !клансоздать [название]'); if(await getClan(uid)) return sendMsg(peer,'❌ Уже в клане'); if(await getBal(uid)<500) return sendMsg(peer,'❌ Нужно 500💰'); await addBal(uid,-500); const res=await pg.query('INSERT INTO clans (name, owner_id) VALUES ($1,$2) RETURNING id',[nm,uid]); await pg.query('INSERT INTO clan_members VALUES ($1,$2,$3)',[res.rows[0].id,uid,'owner']); return sendMsg(peer,`🏰 Клан "${nm}" создан!`) }
  if (cmd === '!клан' || cmd === '!мойклан') { const cl=await getClan(uid); if(!cl) return sendMsg(peer,'❌ Не в клане'); const ms=await pg.query('SELECT user_id, role FROM clan_members WHERE clan_id=$1',[cl.id]); return sendMsg(peer,`🏰 ${cl.name}\n💰 ${cl.balance}\n\nУчастники:\n${ms.rows.map(m=>`@id${m.user_id} (${m.role})`).join('\n')}`) }
  if (cmd === '!кланпринять' || cmd === '!кланэдд') { const cl=await getClan(uid); if(!cl||cl.role!=='owner') return sendMsg(peer,'❌ Только владелец'); const rep=msg.reply_message; if(!rep||await getClan(rep.from_id)) return sendMsg(peer,'❌'); await pg.query('INSERT INTO clan_members VALUES ($1,$2,$3)',[cl.id,rep.from_id,'member']); return sendMsg(peer,`✅ @id${rep.from_id} принят в клан`) }
  if (cmd === '!кланвыйти' || cmd === '!кланлив') { const cl=await getClan(uid); if(!cl||cl.role==='owner') return sendMsg(peer,'❌ Владелец не может выйти'); await pg.query('DELETE FROM clan_members WHERE clan_id=$1 AND user_id=$2',[cl.id,uid]); return sendMsg(peer,'👋 Вы вышли из клана') }
}

// ========== LONG POLL ==========
async function initLongPoll() {
  try {
    const res = await api('messages.getLongPollServer', { need_pts: 0, lp_version: 3 })
    if (res.error) { console.error('LP error:', res.error.error_msg); return false }
    longPollServer = res.response.server; longPollKey = res.response.key; longPollTs = res.response.ts
    console.log('✅ Long Poll готов'); return true
  } catch (err) { console.error('LP error:', err); return false }
}

async function longPoll() {
  if (!longPollServer) return
  try {
    const url = `https://${longPollServer}?act=a_check&key=${longPollKey}&ts=${longPollTs}&wait=25&mode=2&version=3`
    const res = await fetch(url).then(r => r.json())
    if (res.failed) { console.log('LP failed'); await initLongPoll(); return }
    longPollTs = res.ts
    for (const update of res.updates || []) {
      if (update[0] === 4) {
        const msg = {
          id: update[1], peer_id: update[3],
          from_id: update[3] < 2000000000 ? update[3] : (update[6]?.from || update[3]),
          text: update[5], reply_message: update[6]?.reply_message || null,
          out: (update[2] & 2) !== 0
        }
        if (!msg.out && !processedIds.has(msg.id) && msg.id > lastMsgId) {
          processedIds.add(msg.id); lastMsgId = Math.max(lastMsgId, msg.id)
          handleCommand(msg).catch(err => console.error('Err:', err))
        }
      }
    }
    if (processedIds.size > 200) {
      const arr = Array.from(processedIds).sort((a,b)=>a-b)
      for (let i=0; i<arr.length-100; i++) processedIds.delete(arr[i])
    }
  } catch (err) { console.error('LP error:', err) }
}

async function checkReminders() {
  try {
    const now = Date.now()
    const reminders = await pg.query('SELECT * FROM reminders WHERE remind_time <= $1 AND done = 0', [now])
    for (const rem of reminders.rows) {
      await sendMsg(rem.peer_id, `⏰ @id${rem.user_id}!\n"${rem.text}"`)
      await pg.query('UPDATE reminders SET done = 1 WHERE id = $1', [rem.id])
    }
  } catch (err) { console.error('Rem error:', err) }
}

// ========== СТАРТ ==========
async function init() {
  await initDB()
  try {
    const res = await api('messages.getConversations', { count: 20, filter: 'all' })
    if (!res.error) for (const item of res.response?.items || []) {
      if (item.last_message?.id > lastMsgId) lastMsgId = item.last_message.id
    }
  } catch {}
  await initLongPoll()
  console.log('✅ Бот запущен')
  setInterval(longPoll, 1000)
  setInterval(checkReminders, 30000)
}

init().catch(err => { console.error('Fatal:', err); process.exit(1) })
process.on('SIGINT', async () => { await pg.end(); process.exit(0) })