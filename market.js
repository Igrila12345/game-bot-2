'use strict';

const { getOrCreate, getItemQty, removeItem, addItem, pool } = require('../database');
const { fmt, getName, vk } = require('../helpers');

function setGlobals(g) {}

async function cmdMarketSell(ctx, uid, fullArgs) {
  const p = await getOrCreate(uid);
  if (p.banned) return ctx.send('⛔ Вы заблокированы.');
  
  const args = fullArgs.trim().split(/\s+/);
  if (args.length < 3) {
    return ctx.send(
      '📦 ПРОДАЖА НА РЫНКЕ\n\n' +
      '📋 Формат: Продать на рынке [предмет] [кол-во] [цена за шт.]\n\n' +
      '📝 Примеры:\n' +
      '▸ Продать на рынке алмаз 5 400\n' +
      '▸ Продать на рынке бур 1 5000\n' +
      '▸ Продать на рынке динамит 2 300'
    );
  }

  const price = parseInt(args.pop());
  const quantity = parseInt(args.pop());
  const itemName = args.join(' ').toLowerCase();

  if (!quantity || !price || quantity <= 0 || price <= 0) {
    return ctx.send('❌ Количество и цена должны быть положительными числами.');
  }

  let itemType;
  let displayName = itemName;
  
  if (itemName === 'бур' || itemName === 'обычный бур') {
    if (p.drills < quantity) return ctx.send(`❌ У вас ${p.drills} буров.`);
    await pool.query('UPDATE players SET drills=drills-$1 WHERE user_id=$2', [quantity, uid]);
    itemType = 'drill'; displayName = 'Обычный бур';
  } else if (itemName === 'усиленный бур') {
    if (p.drills_enhanced < quantity) return ctx.send(`❌ У вас ${p.drills_enhanced} усиленных буров.`);
    await pool.query('UPDATE players SET drills_enhanced=drills_enhanced-$1 WHERE user_id=$2', [quantity, uid]);
    itemType = 'drill_enhanced'; displayName = 'Усиленный бур';
  } else if (itemName === 'алмазный бур') {
    if (p.drills_diamond < quantity) return ctx.send(`❌ У вас ${p.drills_diamond} алмазных буров.`);
    await pool.query('UPDATE players SET drills_diamond=drills_diamond-$1 WHERE user_id=$2', [quantity, uid]);
    itemType = 'drill_diamond'; displayName = 'Алмазный бур';
  } else if (itemName.includes('вышка')) {
    if (p.oil_rigs < quantity) return ctx.send(`❌ У вас ${p.oil_rigs} вышек.`);
    await pool.query('UPDATE players SET oil_rigs=oil_rigs-$1 WHERE user_id=$2', [quantity, uid]);
    itemType = 'oil_rig'; displayName = 'Нефтяная вышка';
  } else {
    const q = await getItemQty(uid, itemName);
    if (q < quantity) return ctx.send(`❌ У вас ${q} шт. «${itemName}».`);
    await removeItem(uid, itemName, quantity);
    itemType = 'item';
  }

  await pool.query('INSERT INTO market_listings(seller_id, item_type, item_name, quantity, price) VALUES($1,$2,$3,$4,$5)', [uid, itemType, displayName, quantity, price]);
  
  await ctx.send(
    `📦 ТОВАР НА РЫНКЕ!\n\n` +
    `📋 ${displayName} ×${quantity}\n` +
    `💰 ${fmt(price)}/шт | Всего: ${fmt(quantity*price)}💰\n\n` +
    `💡 Ждите покупателя. Деньги придут автоматически.`
  );
}

async function cmdMarketList(ctx) {
  // ПОКАЗЫВАЕМ ВСЕ ЛОТЫ (убрали лимит 20)
  const r = await pool.query('SELECT * FROM market_listings ORDER BY listed_at DESC');
  
  if (!r.rows.length) {
    return ctx.send(
      '📦 РЫНОК ПУСТ\n\n' +
      'Продайте что-нибудь:\n' +
      '▸ Продать на рынке алмаз 5 400\n' +
      '▸ Продать на рынке бур 1 5000'
    );
  }
  
  // Разбиваем на части если слишком длинное
  const lines = [`📦 РЫНОК (всего ${r.rows.length} лотов):`, ''];
  
  for (const l of r.rows) {
    const sn = await getName(Number(l.seller_id));
    lines.push(`#${l.id} | ${l.item_name} ×${l.quantity} | ${fmt(Number(l.price))}💰/шт | ${sn}`);
  }
  
  lines.push('', '🛍️ Купить: «Купить на рынке [ID]»');
  
  const fullText = lines.join('\n');
  if (fullText.length > 4000) {
    // Разбиваем на части
    let chunk = '';
    for (const line of lines) {
      if ((chunk + line + '\n').length > 4000) {
        await ctx.send(chunk);
        chunk = '';
      }
      chunk += line + '\n';
    }
    if (chunk) await ctx.send(chunk);
  } else {
    await ctx.send(fullText);
  }
}

async function cmdMarketBuy(ctx, uid, lotId) {
  const p = await getOrCreate(uid);
  if (p.banned) return ctx.send('⛔ Вы заблокированы.');
  
  lotId = parseInt(lotId);
  if (!lotId) {
    return ctx.send('❌ Укажите ID лота.\n📋 Пример: Купить на рынке 3\n💡 Список лотов: «Рынок»');
  }
  
  const lot = await pool.query('SELECT * FROM market_listings WHERE id=$1', [lotId]);
  if (!lot.rows.length) {
    return ctx.send(`❌ Лот #${lotId} не найден.\n💡 Возможно, его уже купили. «Рынок»`);
  }
  
  const l = lot.rows[0];
  const total = Number(l.quantity) * Number(l.price);
  
  if (Number(l.seller_id) === uid) {
    return ctx.send('❌ Нельзя купить свой товар!');
  }
  
  if (p.balance < total) {
    return ctx.send(
      `❌ НЕДОСТАТОЧНО МОНЕТ\n\n` +
      `📋 ${l.item_name} ×${l.quantity}\n` +
      `💰 Нужно: ${fmt(total)}\n` +
      `👛 Баланс: ${fmt(p.balance)}\n` +
      `❌ Не хватает: ${fmt(total - p.balance)}`
    );
  }
  
  await pool.query('UPDATE players SET balance=balance-$1 WHERE user_id=$2', [total, uid]);
  await pool.query('UPDATE players SET balance=balance+$1 WHERE user_id=$2', [total, Number(l.seller_id)]);

  if (l.item_type === 'drill') await pool.query('UPDATE players SET drills=drills+$1 WHERE user_id=$2', [l.quantity, uid]);
  else if (l.item_type === 'drill_enhanced') await pool.query('UPDATE players SET drills_enhanced=drills_enhanced+$1 WHERE user_id=$2', [l.quantity, uid]);
  else if (l.item_type === 'drill_diamond') await pool.query('UPDATE players SET drills_diamond=drills_diamond+$1 WHERE user_id=$2', [l.quantity, uid]);
  else if (l.item_type === 'oil_rig') await pool.query('UPDATE players SET oil_rigs=oil_rigs+$1 WHERE user_id=$2', [l.quantity, uid]);
  else await addItem(uid, l.item_name, l.quantity);

  await pool.query('DELETE FROM market_listings WHERE id=$1', [lotId]);

  const sn = await getName(Number(l.seller_id));
  
  // Уведомление продавцу
  try {
    await vk.api.messages.send({
      user_id: Number(l.seller_id),
      message: `📦 ПРОДАНО!\n📋 ${l.item_name} ×${l.quantity}\n💰 +${fmt(total)} монет`,
      random_id: Math.floor(Math.random() * 1e9),
    });
  } catch {}

  await ctx.send(
    `✅ ПОКУПКА УСПЕШНА!\n\n` +
    `📋 ${l.item_name} ×${l.quantity}\n` +
    `💰 Потрачено: ${fmt(total)} монет\n` +
    `👤 Продавец: ${sn}\n` +
    `👛 Баланс: ${fmt(p.balance - total)}`
  );
}

module.exports = { setGlobals, cmdMarketSell, cmdMarketList, cmdMarketBuy };
