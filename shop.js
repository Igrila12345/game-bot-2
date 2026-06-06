'use strict';

const config = require('../config');
const { getOrCreate, getItemQty, removeItem, addItem, pool, calcPassiveInfo } = require('../database');
const { fmt, fmtTime, updateVirusStatus, getName } = require('../helpers');
const { SHOP_ITEMS, ORES } = require('../game-data');
const punishment = require('./punishment');

function setGlobals(g) {}

function getDrillCost(cur) {
  const tier = Math.floor(cur / config.DRILL_PRICE_STEP);
  return config.DRILL_COST + tier * config.DRILL_COST;
}

function getOilCost(cur) {
  const tier = Math.floor(cur / config.OIL_PRICE_STEP);
  return config.OIL_COST + tier * config.OIL_COST;
}

async function cmdShop(ctx) {
  const lines = [
    '🛒 МАГАЗИН GENERATIONAL MINERS',
    '━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '📦 РАСХОДНИКИ:',
  ];
  for (const [n, i] of Object.entries(SHOP_ITEMS)) {
    lines.push(`▸ ${n} — ${fmt(i.cost)}💰 | ${i.desc}`);
  }
  lines.push(
    '',
    '🔧 ТЕХНИКА (дорожает каждые 100 штук):',
    '▸ Бур — пассивный доход 50💰/час',
    '▸ Нефтяная вышка — пассивный доход 100💰/час',
    '',
    '📈 Рост цен:',
    '▸ Буры: +2 000💰 каждые 100 шт.',
    '▸ Вышки: +5 000💰 каждые 100 шт.',
    '',
    '🛍️ Как купить:',
    '▸ Купить [предмет] [кол-во] — например: Купить еда 3',
    '▸ Бур [кол-во] — купить буры',
    '▸ Нефть [кол-во] — купить вышки',
    '',
    '💎 Продажа руды:',
    '▸ Продать [руда] — продать конкретную руду',
    '▸ Продать всё — продать всю руду и контрабанду',
    '▸ Продать на рынке [предмет] [кол-во] [цена] — выставить на рынок'
  );
  await ctx.send(lines.join('\n'));
}

async function cmdBuyItem(ctx, uid, item, qty) {
  const p = await getOrCreate(uid);
  if (p.banned) return ctx.send('⛔ Вы заблокированы в игре и не можете совершать покупки.');
  
  const si = SHOP_ITEMS[item];
  if (!si) {
    return ctx.send(
      `❌ Товар «${item}» не найден в магазине.\n\n` +
      `🛒 Посмотри список доступных товаров: «Магазин»\n` +
      `💡 Пример покупки: «Купить еда 3»`
    );
  }
  
  const tc = si.cost * qty;
  if (p.balance < tc) {
    return ctx.send(
      `❌ Недостаточно монет для покупки!\n\n` +
      `🛒 ${item} ×${qty}\n` +
      `💰 Цена за шт: ${fmt(si.cost)}\n` +
      `💰 Общая стоимость: ${fmt(tc)}\n` +
      `👛 Твой баланс: ${fmt(p.balance)}\n` +
      `❌ Не хватает: ${fmt(tc - p.balance)}\n\n` +
      `💡 Заработай монеты командой «Работа» или собери доход с буров: «Доход»`
    );
  }
  
  await pool.query('UPDATE players SET balance=balance-$1 WHERE user_id=$2', [tc, uid]);
  await addItem(uid, item, qty);
  
  await ctx.send(
    `✅ ПОКУПКА УСПЕШНА!\n\n` +
    `🛒 Товар: ${item} ×${qty}\n` +
    `💰 Потрачено: ${fmt(tc)} монет\n` +
    `👛 Остаток на балансе: ${fmt(p.balance - tc)} монет\n\n` +
    `📦 Проверь инвентарь: «Инвентарь»`
  );
}

async function cmdBuyDrill(ctx, uid, qty) {
  const p = await getOrCreate(uid);
  if (p.banned) return ctx.send('⛔ Вы заблокированы.');
  if (punishment.isIncomeBanned(uid)) return ctx.send('🚫 Ваш доход заблокирован администратором. Покупка буров недоступна.');
  
  let total = 0, cur = p.drills;
  for (let i = 0; i < qty; i++) { total += getDrillCost(cur); cur++; }
  
  const currentPrice = getDrillCost(p.drills);
  const afterPrice = getDrillCost(p.drills + qty);
  
  if (p.balance < total) {
    return ctx.send(
      `❌ Недостаточно монет для покупки буров!\n\n` +
      `⚙️ Количество: ${qty} шт.\n` +
      `💰 Цена за шт: ${fmt(currentPrice)} (у вас ${p.drills} буров)\n` +
      `💰 Общая стоимость: ${fmt(total)}\n` +
      `👛 Ваш баланс: ${fmt(p.balance)}\n` +
      `❌ Не хватает: ${fmt(total - p.balance)}\n\n` +
      `💡 Цена растёт каждые 100 буров на 2 000💰\n` +
      `💡 Заработайте: «Работа» или «Доход»`
    );
  }
  
  const now = Date.now();
  let pending = 0;
  if (p.drills > 0) {
    const h = Math.min((now - p.last_drill) / 3600000, 24);
    pending = Math.floor(h * config.DRILL_INCOME * p.drills);
  }
  
  await pool.query('UPDATE players SET balance=balance-$1+$2, drills=drills+$3, last_drill=$4 WHERE user_id=$5', [total, pending, qty, now, uid]);
  
  const newTotal = p.drills + qty;
  const newIncome = newTotal * config.DRILL_INCOME;
  
  let msg = `✅ ПОКУПКА БУРОВ УСПЕШНА!\n\n`;
  msg += `⚙️ Куплено: ${qty} шт.\n`;
  msg += `⚙️ Всего буров: ${newTotal}\n`;
  msg += `💰 Потрачено: ${fmt(total)} монет\n`;
  if (pending > 0) msg += `💰 Собрано с буров: ${fmt(pending)} монет\n`;
  msg += `👛 Баланс: ${fmt(p.balance - total + pending)}\n\n`;
  msg += `📈 Пассивный доход: ${fmt(newIncome)}💰/час\n`;
  msg += `💡 Следующий бур будет стоить: ${fmt(afterPrice)}💰\n`;
  
  const nt = Math.floor(newTotal / 100) * 100;
  if (newTotal >= nt && p.drills < nt) {
    msg += `\n⚠️ ВНИМАНИЕ! Вы перешли порог в ${nt} буров!\n`;
    msg += `💰 Цена выросла с ${fmt(currentPrice)} до ${fmt(afterPrice)}💰/шт.\n`;
  }
  
  msg += `\n💡 Соберите доход: «Доход»`;
  await ctx.send(msg);
}

async function cmdBuyOil(ctx, uid, qty) {
  const p = await getOrCreate(uid);
  if (p.banned) return ctx.send('⛔ Вы заблокированы.');
  if (punishment.isIncomeBanned(uid)) return ctx.send('🚫 Доход заблокирован. Покупка вышек недоступна.');
  
  let total = 0, cur = p.oil_rigs;
  for (let i = 0; i < qty; i++) { total += getOilCost(cur); cur++; }
  
  const currentPrice = getOilCost(p.oil_rigs);
  
  if (p.balance < total) {
    return ctx.send(
      `❌ Недостаточно монет для покупки вышек!\n\n` +
      `🛢️ Количество: ${qty} шт.\n` +
      `💰 Цена за шт: ${fmt(currentPrice)} (у вас ${p.oil_rigs} вышек)\n` +
      `💰 Общая стоимость: ${fmt(total)}\n` +
      `👛 Ваш баланс: ${fmt(p.balance)}\n` +
      `❌ Не хватает: ${fmt(total - p.balance)}\n\n` +
      `💡 Цена растёт каждые 100 вышек на 5 000💰`
    );
  }
  
  const now = Date.now();
  let pending = 0;
  if (p.oil_rigs > 0) {
    const h = Math.min((now - p.last_oil) / 3600000, 24);
    pending = Math.floor(h * config.OIL_INCOME * p.oil_rigs);
  }
  
  await pool.query('UPDATE players SET balance=balance-$1+$2, oil_rigs=oil_rigs+$3, last_oil=$4 WHERE user_id=$5', [total, pending, qty, now, uid]);
  
  const newTotal = p.oil_rigs + qty;
  const newIncome = newTotal * config.OIL_INCOME;
  
  let msg = `✅ ПОКУПКА ВЫШЕК УСПЕШНА!\n\n`;
  msg += `🛢️ Куплено: ${qty} шт.\n`;
  msg += `🛢️ Всего вышек: ${newTotal}\n`;
  msg += `💰 Потрачено: ${fmt(total)} монет\n`;
  if (pending > 0) msg += `💰 Собрано с вышек: ${fmt(pending)} монет\n`;
  msg += `👛 Баланс: ${fmt(p.balance - total + pending)}\n\n`;
  msg += `📈 Пассивный доход: ${fmt(newIncome)}💰/час\n`;
  msg += `\n💡 Соберите доход: «Нефть доход»`;
  await ctx.send(msg);
}

async function cmdIncome(ctx, uid) {
  const p = await getOrCreate(uid);
  if (p.banned) return ctx.send('⛔ Вы заблокированы.');
  if (punishment.isIncomeBanned(uid)) {
    const info = punishment.getPunishmentInfo(uid);
    return ctx.send(
      `🚫 ДОХОД ЗАБЛОКИРОВАН!\n\n` +
      `⏳ Осталось: ${fmtTime(info.until - Date.now())}\n` +
      `📋 Причина: ${info.reason}\n\n` +
      `💡 Обратитесь к администратору для разблокировки.`
    );
  }
  
  updateVirusStatus(p);
  const info = await calcPassiveInfo(uid);
  
  if (!info.activeDrills && !info.activeEnhanced && !info.activeDiamond) {
    return ctx.send(
      `❌ У вас нет активных буров!\n\n` +
      `⚙️ Обычные буры: ${info.totalDrills} шт. (активно: ${info.activeDrills})\n` +
      `🔩 Усиленные буры: ${info.totalEnhanced} шт. (активно: ${info.activeEnhanced})\n` +
      `💎 Алмазные буры: ${info.totalDiamond} шт. (активно: ${info.activeDiamond})\n\n` +
      `💡 Купите буры: «Бур [кол-во]» или скрафтите: «Крафт бур»\n` +
      `💡 Проверьте сломанное оборудование: «Ремонт»`
    );
  }
  
  if (info.drillPending <= 0) {
    return ctx.send(
      `⏳ Буры ещё не накопили доход!\n\n` +
      `⚙️ Активных буров: ${info.activeDrills + info.activeEnhanced + info.activeDiamond}\n` +
      `📈 Доход в час: ${fmt(info.drillIncomePerHour)}💰\n` +
      `💡 Подождите хотя бы несколько минут и попробуйте снова.\n` +
      `💡 Доход копится до 24 часов.`
    );
  }
  
  const earned = info.drillPending;
  const hours = Math.min((Date.now() - p.last_drill) / 3600000, 24);
  
  await pool.query('UPDATE players SET balance=balance+$1, last_drill=$2 WHERE user_id=$3', [earned, Date.now(), uid]);
  
  if (p.guild_id) {
    await pool.query('UPDATE guilds SET guild_balance=guild_balance+$1 WHERE id=$2', [earned, p.guild_id]);
  }
  
  let msg = `💰 ДОХОД С БУРОВ СОБРАН!\n\n`;
  msg += `💰 Получено: ${fmt(earned)} монет\n`;
  msg += `⏱️ Накоплено за: ${hours.toFixed(1)} ч.\n`;
  msg += `⚙️ Обычные буры: ${info.activeDrills}/${info.totalDrills} активно (+${fmt(info.activeDrills * config.DRILL_INCOME)}/ч)\n`;
  if (info.activeEnhanced > 0) msg += `🔩 Усиленные буры: ${info.activeEnhanced}/${info.totalEnhanced} активно (+${fmt(info.activeEnhanced * 100)}/ч)\n`;
  if (info.activeDiamond > 0) msg += `💎 Алмазные буры: ${info.activeDiamond}/${info.totalDiamond} активно (+${fmt(info.activeDiamond * 250)}/ч)\n`;
  if (info.engineerBonus > 0) msg += `⚙️ Бонус инженера: +25%\n`;
  msg += `📈 Общий доход в час: ${fmt(info.drillIncomePerHour)}💰\n`;
  msg += `👛 Баланс: ${fmt(p.balance + earned)}💰\n`;
  if (p.guild_id) msg += `\n👥 +${fmt(earned)}💰 зачислено в общий доход бригады!`;
  
  await ctx.send(msg);
}

async function cmdOilIncome(ctx, uid) {
  const p = await getOrCreate(uid);
  if (p.banned) return ctx.send('⛔ Вы заблокированы.');
  if (punishment.isIncomeBanned(uid)) {
    const pinfo = punishment.getPunishmentInfo(uid);
    return ctx.send(`🚫 Доход заблокирован!\n⏳ ${fmtTime(pinfo.until - Date.now())}\n📋 ${pinfo.reason}`);
  }
  
  updateVirusStatus(p);
  const info = await calcPassiveInfo(uid);
  
  if (!info.activeRigs) {
    return ctx.send(
      `❌ У вас нет активных нефтяных вышек!\n\n` +
      `🛢️ Всего вышек: ${info.totalRigs}\n` +
      `🛢️ Активно: ${info.activeRigs}\n\n` +
      `💡 Купите вышки: «Нефть [кол-во]» или скрафтите: «Крафт вышка»\n` +
      `💡 Проверьте сломанное: «Ремонт»`
    );
  }
  
  if (info.oilPending <= 0) {
    return ctx.send(
      `⏳ Вышки ещё не накопили доход!\n\n` +
      `🛢️ Активных вышек: ${info.activeRings}\n` +
      `📈 Доход в час: ${fmt(info.oilIncomePerHour)}💰\n` +
      `💡 Подождите немного и попробуйте снова.`
    );
  }
  
  const earned = info.oilPending;
  const hours = Math.min((Date.now() - p.last_oil) / 3600000, 24);
  
  await pool.query('UPDATE players SET balance=balance+$1, last_oil=$2 WHERE user_id=$3', [earned, Date.now(), uid]);
  
  if (p.guild_id) {
    await pool.query('UPDATE guilds SET guild_balance=guild_balance+$1 WHERE id=$2', [earned, p.guild_id]);
  }
  
  let msg = `💰 ДОХОД С ВЫШЕК СОБРАН!\n\n`;
  msg += `💰 Получено: ${fmt(earned)} монет\n`;
  msg += `⏱️ Накоплено за: ${hours.toFixed(1)} ч.\n`;
  msg += `🛢️ Активных вышек: ${info.activeRigs}/${info.totalRigs}\n`;
  msg += `📈 Доход в час: ${fmt(info.oilIncomePerHour)}💰\n`;
  if (info.oilBonus > 0) msg += `🛢️ Бонус нефтяника: +30%\n`;
  msg += `👛 Баланс: ${fmt(p.balance + earned)}💰\n`;
  if (p.guild_id) msg += `\n👥 +${fmt(earned)}💰 зачислено в общий доход бригады!`;
  
  await ctx.send(msg);
}

async function cmdSellOre(ctx, uid, oreName) {
  const p = await getOrCreate(uid);
  if (p.banned) return ctx.send('⛔ Вы заблокированы.');
  
  if (oreName === 'всё' || oreName === 'все') {
    let total = 0;
    const parts = [];
    
    for (const [n, o] of Object.entries(ORES)) {
      const q = await getItemQty(uid, n);
      if (q > 0) {
        const sum = q * o.price;
        total += sum;
        await pool.query('UPDATE inventory SET quantity=0 WHERE user_id=$1 AND item=$2', [uid, n]);
        parts.push(`${o.emoji} ${n}: ×${q} = ${fmt(sum)}💰`);
      }
    }
    
    const cq = await getItemQty(uid, 'контрабанда');
    if (cq > 0) {
      const sum = cq * config.CONTRABAND_PRICE;
      total += sum;
      await pool.query("UPDATE inventory SET quantity=0 WHERE user_id=$1 AND item='контрабанда'", [uid]);
      parts.push(`🕵️ контрабанда: ×${cq} = ${fmt(sum)}💰`);
    }
    
    if (total === 0) {
      return ctx.send(
        `🎒 У вас нет ресурсов для продажи!\n\n` +
        `💡 Добудьте руду: «Работа»\n` +
        `💡 Или займитесь чёрной работой: «Чёрная работа»`
      );
    }
    
    await pool.query('UPDATE players SET balance=balance+$1 WHERE user_id=$2', [total, uid]);
    
    return ctx.send(
      `💰 ПРОДАЖА ВСЕХ РЕСУРСОВ!\n\n` +
      `${parts.join('\n')}\n\n` +
      `✅ Итого получено: ${fmt(total)}💰\n` +
      `👛 Баланс: ${fmt(p.balance + total)}💰`
    );
  }
  
  if (oreName === 'контрабанда' || oreName === 'контрабанду') {
    const q = await getItemQty(uid, 'контрабанда');
    if (!q) return ctx.send('❌ У вас нет контрабанды.\n💡 Добудьте: «Чёрная работа»');
    const sum = q * config.CONTRABAND_PRICE;
    await pool.query("UPDATE inventory SET quantity=0 WHERE user_id=$1 AND item='контрабанда'", [uid]);
    await pool.query('UPDATE players SET balance=balance+$1 WHERE user_id=$2', [sum, uid]);
    return ctx.send(`🕵️ Продана контрабанда: ×${q} = ${fmt(sum)}💰\n👛 Баланс: ${fmt(p.balance + sum)}💰`);
  }
  
  const ore = ORES[oreName];
  if (!ore) {
    const oreList = Object.keys(ORES).join(', ');
    return ctx.send(
      `❌ Руда «${oreName}» не найдена!\n\n` +
      `📋 Доступные руды: ${oreList}\n` +
      `💡 Продать всё: «Продать всё»`
    );
  }
  
  const q = await getItemQty(uid, oreName);
  if (!q) {
    return ctx.send(
      `❌ У вас нет руды «${oreName}»!\n\n` +
      `💡 Добудьте её командой «Работа»`
    );
  }
  
  const sum = q * ore.price;
  await pool.query('UPDATE inventory SET quantity=0 WHERE user_id=$1 AND item=$2', [uid, oreName]);
  await pool.query('UPDATE players SET balance=balance+$1 WHERE user_id=$2', [sum, uid]);
  
  await ctx.send(
    `💰 РУДА ПРОДАНА!\n\n` +
    `${ore.emoji} ${oreName}: ×${q}\n` +
    `💰 Цена за шт: ${fmt(ore.price)}\n` +
    `✅ Получено: ${fmt(sum)}💰\n` +
    `👛 Баланс: ${fmt(p.balance + sum)}💰`
  );
}

async function cmdUseItem(ctx, uid, item) {
  const p = await getOrCreate(uid);
  if (p.banned) return ctx.send('⛔ Вы заблокированы.');
  
  const q = await getItemQty(uid, item);
  if (!q) {
    return ctx.send(
      `❌ У вас нет предмета «${item}»!\n\n` +
      `🛒 Купите в магазине: «Купить ${item}»\n` +
      `📦 Проверьте инвентарь: «Инвентарь»`
    );
  }
  
  if (item === 'еда') {
    if (p.stamina >= config.MAX_STAMINA) {
      return ctx.send(
        `❌ Стамина уже полная! (${p.stamina}/${config.MAX_STAMINA})\n\n` +
        `💡 Не тратьте еду зря. Используйте когда стамина ниже 100.`
      );
    }
    const g = Math.min(50, config.MAX_STAMINA - p.stamina);
    await pool.query('UPDATE players SET stamina=stamina+$1 WHERE user_id=$2', [g, uid]);
    await removeItem(uid, 'еда', 1);
    return ctx.send(
      `🍎 ВЫ СЪЕЛИ ЕДУ!\n\n` +
      `❤️ Стамина: ${p.stamina + g}/${config.MAX_STAMINA} (+${g})\n` +
      `📦 Осталось еды: ${q - 1} шт.\n\n` +
      (p.stamina + g >= config.STAMINA_PER_WORK ? `✅ Теперь можно работать! «Работа»` : `⚠️ Всё ещё мало для работы (нужно ${config.STAMINA_PER_WORK}).`)
    );
  }
  
  await ctx.send(`ℹ️ Предмет «${item}» не требует активации — он сработает автоматически при использовании.`);
}

async function cmdInventory(ctx, uid) {
  const r = await pool.query('SELECT item, quantity FROM inventory WHERE user_id=$1 AND quantity>0', [uid]);
  if (!r.rows.length) {
    return ctx.send(
      `🎒 ИНВЕНТАРЬ ПУСТ\n\n` +
      `💡 Добудьте руду: «Работа»\n` +
      `💡 Купите предметы: «Магазин»\n` +
      `💡 Займитесь крафтом: «Рецепты»`
    );
  }
  
  const lines = ['🎒 ВАШ ИНВЕНТАРЬ:', ''];
  let totalValue = 0;
  
  for (const row of r.rows) {
    if (ORES[row.item]) {
      const val = row.quantity * ORES[row.item].price;
      totalValue += val;
      lines.push(`${ORES[row.item].emoji} ${row.item}: ${row.quantity} шт. (${fmt(val)}💰)`);
    } else if (row.item === 'контрабанда') {
      const val = row.quantity * config.CONTRABAND_PRICE;
      totalValue += val;
      lines.push(`🕵️ контрабанда: ${row.quantity} шт. (${fmt(val)}💰)`);
    } else {
      lines.push(`📦 ${row.item}: ${row.quantity} шт.`);
    }
  }
  
  lines.push(
    '',
    `💰 Общая стоимость: ${fmt(totalValue)} монет`,
    '',
    `💡 Продать всё: «Продать всё»`,
    `💡 Продать на рынке: «Продать на рынке [предмет] [кол-во] [цена]»`
  );
  
  await ctx.send(lines.join('\n'));
}

module.exports = { setGlobals, cmdShop, cmdBuyItem, cmdBuyDrill, cmdBuyOil, cmdIncome, cmdOilIncome, cmdSellOre, cmdUseItem, cmdInventory };
