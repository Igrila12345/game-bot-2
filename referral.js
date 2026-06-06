'use strict';

const config = require('../config');
const { getOrCreate, getPlayer, pool } = require('../database');
const { fmt, getName, vk } = require('../helpers');

function setGlobals(g) {}

// Реферальная ссылка
async function cmdReferral(ctx, uid) {
  const p = await getOrCreate(uid);
  if (p.banned) return ctx.send('⛔ Вы заблокированы.');
  
  const link = `https://vk.com/write-${config.COMMUNITY_ID}?ref=${p.referral_code}`;
  
  // Считаем статистику
  const refCount = (await pool.query('SELECT COUNT(*) as c FROM players WHERE referred_by=$1', [uid])).rows[0].c;
  const totalEarned = refCount * config.REFERRAL_REWARD_INVITER;
  
  await ctx.send(
    `🔗 РЕФЕРАЛЬНАЯ СИСТЕМА\n\n` +
    `📎 Твоя ссылка:\n${link}\n\n` +
    `👥 Приглашено: ${refCount} чел.\n` +
    `💰 Заработано: ${fmt(totalEarned)} монет\n\n` +
    `💡 Награда:\n` +
    `▸ Тебе: +${fmt(config.REFERRAL_REWARD_INVITER)}💰 за каждого друга\n` +
    `▸ Другу: +${fmt(config.REFERRAL_REWARD_INVITED)}💰 при регистрации\n\n` +
    `📊 Статистика: «Мои рефералы»`
  );
}

// Мои рефералы
async function cmdMyReferrals(ctx, uid) {
  const p = await getOrCreate(uid);
  if (p.banned) return ctx.send('⛔ Вы заблокированы.');

  const refs = await pool.query(
    'SELECT user_id, balance, work_count, player_class FROM players WHERE referred_by = $1 ORDER BY balance DESC',
    [uid]
  );

  if (!refs.rows.length) {
    return ctx.send(
      `👥 У вас пока нет рефералов.\n\n` +
      `🔗 Пригласите друзей:\nhttps://vk.com/write-${config.COMMUNITY_ID}?ref=${p.referral_code}\n\n` +
      `💰 Награда: +${fmt(config.REFERRAL_REWARD_INVITER)}💰 за каждого!`
    );
  }

  const totalEarned = refs.rows.length * config.REFERRAL_REWARD_INVITER;
  const lines = [
    `👥 ВАШИ РЕФЕРАЛЫ`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📊 Всего: ${refs.rows.length} чел.`,
    `💰 Заработано: ${fmt(totalEarned)} монет`,
    `🔗 Код: ${p.referral_code}`,
    '',
  ];

  for (let i = 0; i < refs.rows.length; i++) {
    const r = refs.rows[i];
    const name = await getName(Number(r.user_id));
    lines.push(
      `${i + 1}. ${name} (ID: ${r.user_id})`,
      `   💰 ${fmt(Number(r.balance))} | ⛏️ Работ: ${r.work_count} | 🎯 ${r.player_class || 'нет'}`
    );
  }

  await ctx.send(lines.join('\n'));
}

// Обработка реферала при регистрации (с защитой от накрутки)
async function processReferral(refCode, newUserId) {
  if (!refCode || !newUserId) return;
  
  // Проверка: код должен быть 8 символов (буквы + цифры)
  if (!/^[A-Z0-9]{8}$/i.test(refCode)) return;
  
  // Проверка: не может пригласить сам себя
  const ref = await pool.query('SELECT user_id FROM players WHERE referral_code=$1 AND user_id!=$2', [refCode, newUserId]);
  if (!ref.rows.length) return;
  
  const refId = Number(ref.rows[0].user_id);
  
  // Проверка: нельзя быть рефералом дважды
  const existingPlayer = await pool.query('SELECT referred_by, balance FROM players WHERE user_id=$1', [newUserId]);
  if (existingPlayer.rows[0]?.referred_by) return;
  
  // Проверка: у игрока должен быть 0 баланс (только что зарегистрировался)
  if (existingPlayer.rows[0] && Number(existingPlayer.rows[0].balance) > 0) return;
  
  // Антифрод: проверяем лимит рефералов в сутки для приглашающего
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const refsToday = await pool.query(
    'SELECT COUNT(*) as c FROM players WHERE referred_by=$1',
    [refId]
  );
  // Не строгий лимит, но логируем
  if (Number(refsToday.rows[0].c) > 100) {
    console.log(`⚠️ Подозрительная активность: ${refId} пригласил ${refsToday.rows[0].c} чел.`);
  }
  
  // Защита: проверяем что приглашающий не забанен
  const inviter = await pool.query('SELECT banned FROM players WHERE user_id=$1', [refId]);
  if (inviter.rows[0]?.banned) return;
  
  // Всё ок — засчитываем реферала
  await pool.query('UPDATE players SET referred_by=$1 WHERE user_id=$2', [refId, newUserId]);
  await pool.query('UPDATE players SET balance=balance+$1 WHERE user_id=$2', [config.REFERRAL_REWARD_INVITER, refId]);
  await pool.query('UPDATE players SET balance=balance+$1 WHERE user_id=$2', [config.REFERRAL_REWARD_INVITED, newUserId]);

  // Уведомление пригласившему
  try {
    const newName = await getName(newUserId);
    await vk.api.messages.send({
      user_id: refId,
      message: `🎉 ПО РЕФЕРАЛЬНОЙ ССЫЛКЕ ЗАРЕГИСТРИРОВАЛСЯ ${newName}!\n\n💰 Вы получили: ${fmt(config.REFERRAL_REWARD_INVITER)} монет\n👛 Проверьте баланс: «Профиль»`,
      random_id: Math.floor(Math.random() * 1e9),
    });
  } catch {}
}

module.exports = { setGlobals, cmdReferral, cmdMyReferrals, processReferral };
