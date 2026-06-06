'use strict';

const { VK } = require('vk-io');
const config = require('./config');
const { initDB } = require('./database');
const { vk } = require('./helpers');
const state = require('./state');

const work = require('./modules/work');
const shop = require('./modules/shop');
const craft = require('./modules/craft');
const market = require('./modules/market');
const guild = require('./modules/guild');
const pvp = require('./modules/pvp');
const virus = require('./modules/virus');
const referral = require('./modules/referral');
const promo = require('./modules/promo');
const punishment = require('./modules/punishment');
const info = require('./modules/info');
const admin = require('./modules/admin');

work.setGlobals(state);
shop.setGlobals(state);
guild.setGlobals(state);
pvp.setGlobals(state);
virus.setGlobals(state);

// Конвертер @username / [id|@] / ID в число
async function resolveId(input) {
  if (!input) return null;
  input = String(input).trim();
  if (/^\d+$/.test(input)) return parseInt(input);
  let name = input.replace(/^@/, '').replace(/\[id\d+\|@?/, '').replace(/\]$/, '');
  try {
    const users = await vk.api.users.get({ user_ids: [name] });
    if (users && users[0]) return users[0].id;
  } catch {}
  return null;
}

setInterval(async () => {
  try { const { pool } = require('./database'); await pool.query('SELECT 1'); }
  catch (e) { console.error('keepalive:', e.message); }
}, 4 * 60 * 1000);

vk.updates.on('message_new', async (ctx) => {
  try {
    if (!ctx.text) return;
    const uid = ctx.senderId;
    if (uid < 0) return;

    const raw = ctx.text.trim();
    const text = raw.toLowerCase();
    const parts = text.split(/\s+/);

    // Старт + рефералка
    if (text === 'старт' || text === 'начать') {
      if (ctx.messagePayload) {
        try { const pl = JSON.parse(ctx.messagePayload); if (pl.ref) await referral.processReferral(pl.ref, uid); } catch {}
      }
      const rm = raw.match(/ref=([A-Z0-9]+)/i);
      if (rm) await referral.processReferral(rm[1], uid);
      return work.cmdStart(ctx, uid);
    }

    const incomeBanned = punishment.isIncomeBanned(uid);

    // ═══ АДМИН-КОМАНДЫ ═══
    if (await require('./helpers').isAdmin(uid)) {
      if (text === '/admin') return admin.cmdAdminHelp(ctx);
      
      // Команды с ID/юзером - используем resolveId
      if (parts[0] === '!дать') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌ Игрок не найден.'); return admin.cmdGive(ctx, [null, String(tid), parts[2]]); }
      if (parts[0] === '!забрать') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌ Игрок не найден.'); return admin.cmdTake(ctx, [null, String(tid), parts[2]]); }
      if (parts[0] === '!датьруду') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌'); return admin.cmdGiveOre(ctx, [null, String(tid), parts[2], parts[3]]); }
      if (parts[0] === '!забратьруду') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌'); return admin.cmdTakeOre(ctx, [null, String(tid), parts[2], parts[3]]); }
      if (parts[0] === '!датьпредмет') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌'); return admin.cmdGiveItem(ctx, [null, String(tid), parts[2], parts[3]]); }
      if (parts[0] === '!забратьпредмет') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌'); return admin.cmdTakeItem(ctx, [null, String(tid), parts[2], parts[3]]); }
      if (parts[0] === '!датьбур') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌'); return admin.cmdGiveDrill(ctx, [null, String(tid), parts[2]]); }
      if (parts[0] === '!забратьбур') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌'); return admin.cmdTakeDrill(ctx, [null, String(tid), parts[2]]); }
      if (parts[0] === '!датьвышку') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌'); return admin.cmdGiveOil(ctx, [null, String(tid), parts[2]]); }
      if (parts[0] === '!забратьвышку') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌'); return admin.cmdTakeOil(ctx, [null, String(tid), parts[2]]); }
      if (parts[0] === '!профиль') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌'); return admin.cmdProfile(ctx, tid); }
      if (parts[0] === '!освободить') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌'); return admin.cmdFree(ctx, tid); }
      if (parts[0] === '!бан') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌'); return admin.cmdBan(ctx, [null, String(tid)]); }
      if (parts[0] === '!разбан') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌'); return admin.cmdUnban(ctx, [null, String(tid)]); }
      if (parts[0] === '!админ') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌'); return admin.cmdSetAdmin(ctx, uid, tid); }
      if (parts[0] === '!снятьадмин') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌'); return admin.cmdRemoveAdmin(ctx, uid, tid); }
      if (parts[0] === '!сброскд') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌'); return admin.cmdResetCD(ctx, [null, String(tid)]); }
      if (parts[0] === '!датькд') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌'); return admin.cmdSetCD(ctx, [null, String(tid), parts[2]]); }
      if (parts[0] === '!датьинфу') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌'); return admin.cmdGiveInfo(ctx, uid, tid, parts[2]); }
      if (parts[0] === '!инфадоступ') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌'); return admin.cmdCheckInfo(ctx, uid, tid); }
      if (parts[0] === '!блокдоход') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌'); return punishment.cmdBlockIncome(ctx, uid, String(tid), parts[2], ...parts.slice(3)); }
      if (parts[0] === '!разблокдоход') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌'); return punishment.cmdUnblockIncome(ctx, uid, String(tid)); }
      if (parts[0] === '!рефералы') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌'); return admin.cmdAdminReferrals(ctx, uid, String(tid)); }
      if (parts[0] === '!вылечить') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌'); return virus.cmdAdminHeal(ctx, String(tid)); }
      if (parts[0] === '!защитить') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌'); return virus.cmdAdminVaccinate(ctx, String(tid)); }
      if (parts[0] === '!заразить') { const tid = await resolveId(parts[1]); if (!tid) return ctx.send('❌'); return virus.cmdAdminInfect(ctx, String(tid)); }
      
      // Команды без ID
      if (text === '!игроки') return admin.cmdPlayers(ctx);
      if (text === '!скрыть') return admin.cmdHide(ctx, uid);
      if (text === '!показать') return admin.cmdShow(ctx, uid);
      if (text === '!обнулитьвсех') return admin.cmdResetAll(ctx);
      if (text === '!обнулитьвсех подтвердить') return admin.cmdResetAllConfirm(ctx);
      if (parts[0] === '!промо') return promo.cmdCreatePromo(ctx, uid, raw.slice('!промо '.length));
      if (parts[0] === '!деактивировать') return promo.cmdDeactivatePromo(ctx, text.slice('!деактивировать '.length).trim());
      if (text === '!промокоды') return promo.cmdListPromos(ctx);
      if (text === '!вирус старт') return virus.cmdAdminVirusStart(ctx);
      if (text === '!вирус стоп') return virus.cmdAdminVirusStop(ctx);
      if (text === '!наказания') return punishment.cmdPunishmentList(ctx, uid);
    }

    // ═══ РЫНОК (до "купить") ═══
    if (text.startsWith('купить на рынке ')) return market.cmdMarketBuy(ctx, uid, parseInt(text.slice('купить на рынке '.length).trim()));
    if (text.startsWith('продать на рынке ')) return market.cmdMarketSell(ctx, uid, raw.slice('продать на рынке '.length).trim());
    if (text === 'рынок') return market.cmdMarketList(ctx);

    // ═══ ИНФА ═══
    if (text.startsWith('инфа клан ') || text.startsWith('инфаклан ')) return info.cmdInfoGuild(ctx, uid, raw.slice(raw.indexOf(' ')+1).replace(/^клан\s+/i,'').trim());
    if (text.startsWith('инфа ')) {
      let tidStr = text.slice('инфа '.length).trim();
      const tid = await resolveId(tidStr);
      if (tid) return info.cmdInfo(ctx, uid, tid);
    }

    // ═══ КЛАСС ═══
    if (text.startsWith('класс ')) return work.cmdSetClass(ctx, uid, raw.slice('класс '.length).trim());
    if (text === 'класс') return work.cmdSetClass(ctx, uid, null);

    // ═══ ОСНОВНОЕ ═══
    if (text === 'работа') return incomeBanned ? ctx.send('🚫 Доход заблокирован!') : work.cmdWork(ctx, uid);
    if (text === 'отдых') return work.cmdRest(ctx, uid);
    if (text === 'кирка') return work.cmdPickaxe(ctx, uid);
    if (text === 'чёрная работа' || text === 'черная работа') return work.cmdBlackWork(ctx, uid);
    if (text === 'профиль') return work.cmdProfile(ctx, uid);
    if (text === 'бонус') return work.cmdDailyBonus(ctx, uid);

    // ═══ ТЕХНИКА ═══
    if (text.startsWith('бур ')) { if (incomeBanned) return ctx.send('🚫'); return shop.cmdBuyDrill(ctx, uid, parseInt(text.slice('бур '.length))||1); }
    if (text === 'бур') { if (incomeBanned) return ctx.send('🚫'); return shop.cmdBuyDrill(ctx, uid, 1); }
    if (text.startsWith('нефть ')) { if (incomeBanned) return ctx.send('🚫'); return shop.cmdBuyOil(ctx, uid, parseInt(text.slice('нефть '.length))||1); }
    if (text === 'нефть') { if (incomeBanned) return ctx.send('🚫'); return shop.cmdBuyOil(ctx, uid, 1); }
    if (text === 'доход') { if (incomeBanned) return ctx.send('🚫'); return shop.cmdIncome(ctx, uid); }
    if (text === 'нефть доход') { if (incomeBanned) return ctx.send('🚫'); return shop.cmdOilIncome(ctx, uid); }

    // ═══ МАГАЗИН ═══
    if (text === 'магазин') return shop.cmdShop(ctx);
    if (text.startsWith('купить ')) { const a = text.slice('купить '.length).trim().split(/\s+/); return shop.cmdBuyItem(ctx, uid, a[0], parseInt(a[1])||1); }
    if (text.startsWith('использовать ')) return shop.cmdUseItem(ctx, uid, text.slice('использовать '.length));
    if (['еда','кушать','покушать','съесть','жрать','хавать'].includes(text)) return shop.cmdUseItem(ctx, uid, 'еда');
    if (text.startsWith('продать ') && !text.startsWith('продать на рынке')) return shop.cmdSellOre(ctx, uid, text.slice('продать '.length).trim());
    if (text === 'инвентарь') return shop.cmdInventory(ctx, uid);

    // ═══ КРАФТ ═══
    if (text.startsWith('крафт ')) return craft.cmdCraft(ctx, uid, raw.slice('крафт '.length).trim());
    if (text === 'рецепты') return craft.cmdRecipes(ctx);
    if (text === 'детали') return craft.cmdParts(ctx, uid);

    // ═══ БРИГАДЫ ═══
    if (text.startsWith('создать бригаду ')) return guild.cmdCreateGuild(ctx, uid, raw.slice('создать бригаду '.length).trim());
    if (text === 'бригада') return guild.cmdGuildInfo(ctx, uid);
    if (['топ кланов','топ бригад','рейтинг кланов'].includes(text)) return guild.cmdGuildTop(ctx);
    if (text.startsWith('пригласить ')) { const tid = await resolveId(text.slice('пригласить '.length).trim()); if (!tid) return ctx.send('❌ Игрок не найден.'); return guild.cmdInvite(ctx, uid, tid); }
    if (text === 'принять приглашение') return guild.cmdAcceptInvite(ctx, uid);
    if (text === 'покинуть бригаду') return guild.cmdLeaveGuild(ctx, uid);
    if (text.startsWith('в казну ')) return guild.cmdTreasury(ctx, uid, text.slice('в казну '.length).trim());
    if (text.startsWith('из казны ')) return guild.cmdTakeFromTreasury(ctx, uid, text.slice('из казны '.length).trim());
    if (text.startsWith('зам ')) { const tid = await resolveId(text.slice('зам '.length).trim()); if (!tid) return ctx.send('❌'); return guild.cmdSetDeputy(ctx, uid, tid); }
    if (text === 'снять зама') return guild.cmdRemoveDeputy(ctx, uid);
    if (text.startsWith('передать лидерство ')) { const tid = await resolveId(text.slice('передать лидерство '.length).trim()); if (!tid) return ctx.send('❌'); return guild.cmdTransferLeadership(ctx, uid, tid); }
    if (['расформировать клан','распустить бригаду','расформировать бригаду','распустить клан'].includes(text)) return guild.cmdDisbandGuild(ctx, uid);
    if (text.startsWith('перевести ')) {
      const args = text.slice('перевести '.length).trim().split(/\s+/);
      const tid = await resolveId(args[0]);
      if (!tid) return ctx.send('❌ Игрок не найден. Используйте: Перевести @user 500');
      return guild.cmdTransfer(ctx, uid, `${tid} ${args[1]}`);
    }

    // ═══ PvP ═══
    if (text.startsWith('рейд ')) return pvp.cmdRaid(ctx, uid, raw.slice('рейд '.length).trim());
    if (text === 'диверсия') return pvp.cmdSabotage(ctx, uid);
    if (text === 'ловушка') return pvp.cmdTrap(ctx, uid);
    if (text.startsWith('взорвать ') && text.split(/\s+/).length === 2) {
      const tid = await resolveId(text.split(/\s+/)[1]);
      if (!tid) return ctx.send('❌ Игрок не найден.');
      return pvp.cmdShowEquipment(ctx, uid, tid);
    }
    if (text.startsWith('взорвать ') && text.split(/\s+/).length >= 3) {
      const p2 = text.split(/\s+/);
      const tid = await resolveId(p2[1]);
      if (!tid) return ctx.send('❌ Игрок не найден.');
      return pvp.cmdDestroy(ctx, uid, tid, p2[2]);
    }
    if (text === 'ремонт') return pvp.cmdRepair(ctx, uid);
    if (text.startsWith('война ')) return pvp.cmdWar(ctx, uid, raw.slice('война '.length).trim());
    if (text.startsWith('атаковать ')) {
      const tid = await resolveId(text.slice('атаковать '.length).trim());
      if (!tid) return ctx.send('❌ Игрок не найден.');
      return pvp.cmdAttack(ctx, uid, tid);
    }
    if (text === 'шахта') return pvp.cmdMineInfo(ctx);
    if (text === 'перемирие') return pvp.cmdPeace(ctx, uid);

    // ═══ ВИРУС ═══
    if (text === 'статус') return virus.cmdVirusStatus(ctx, uid);
    if (text === 'эпидемия') return virus.cmdEpidemicInfo(ctx);
    if (text.startsWith('лечить ')) { const tid = await resolveId(text.slice('лечить '.length).trim()); return virus.cmdHeal(ctx, uid, tid ? String(tid) : null); }
    if (text === 'лечить') return virus.cmdHeal(ctx, uid, null);
    if (text === 'вакцина') return virus.cmdVaccinate(ctx, uid);

    // ═══ ВОРОВСТВО ═══
    if (text.startsWith('своровать ') || text.startsWith('украсть ')) {
      const tid = await resolveId(text.split(/\s+/)[1]);
      return work.cmdSteal(ctx, uid, tid ? String(tid) : null);
    }
    if (text === 'своровать' || text === 'украсть') return work.cmdSteal(ctx, uid, null);

    // ═══ РЕФЕРАЛКА ═══
    if (['реферал','реф','реферальная ссылка'].includes(text)) return referral.cmdReferral(ctx, uid);
    if (['мои рефералы','рефералы'].includes(text)) return referral.cmdMyReferrals(ctx, uid);

    // ═══ ПРОМО ═══
    if (text.startsWith('промокод ')) return promo.cmdUsePromo(ctx, uid, text.slice('промокод '.length).trim());

    // ═══ ТОПЫ ═══
    if (text === 'топ') return work.cmdTop(ctx);
    if (['топ чатов','рейтинг чатов','чаты топ'].includes(text)) return work.cmdChatTop(ctx);

    // ═══ ПОМОЩЬ ═══
    if (text === 'помощь') {
      return ctx.send(
        '📋 ПОЛНЫЙ СПИСОК КОМАНД\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '⛏️ ОСНОВНОЕ:\n' +
        '▸ Старт — регистрация и выбор класса\n' +
        '▸ Работа — добыча монет и руды (кд 30 мин)\n' +
        '▸ Отдых — восстановить стамину (кд 30 мин)\n' +
        '▸ Кирка — улучшить (+30% добычи)\n' +
        '▸ Профиль — статистика, баланс, оборудование\n' +
        '▸ Бонус — ежедневная награда (в бригаде)\n' +
        '▸ Класс [имя] — выбрать/сменить класс\n\n' +
        '⚙️ ТЕХНИКА:\n' +
        '▸ Бур [N] — купить буры (доход 50/час)\n' +
        '▸ Нефть [N] — купить вышки (доход 100/час)\n' +
        '▸ Доход — собрать монеты с буров\n' +
        '▸ Нефть доход — собрать монеты с вышек\n' +
        '⚠️ Цена растёт каждые 100 шт.\n\n' +
        '🛒 МАГАЗИН:\n' +
        '▸ Магазин — список товаров\n' +
        '▸ Купить [предмет] [N]\n' +
        '▸ Продать [руда] / Продать всё\n' +
        '▸ Инвентарь — посмотреть предметы\n' +
        '▸ Еда — +50 стамины\n\n' +
        '🔨 КРАФТ:\n' +
        '▸ Крафт [предмет]\n' +
        '▸ Рецепты / Детали\n\n' +
        '📦 РЫНОК:\n' +
        '▸ Рынок — все лоты\n' +
        '▸ Продать на рынке [предмет] [N] [цена]\n' +
        '▸ Купить на рынке [ID]\n\n' +
        '👥 БРИГАДЫ:\n' +
        '▸ Бригада — инфо\n' +
        '▸ Создать бригаду [имя] (5000💰)\n' +
        '▸ Топ кланов — рейтинг по доходу\n' +
        '▸ Пригласить @user / Принять приглашение\n' +
        '▸ Покинуть бригаду\n' +
        '▸ В казну [N] / Из казны [N] (глава/зам)\n' +
        '▸ Зам @user / Снять зама\n' +
        '▸ Передать лидерство @user\n' +
        '▸ Перевести @user [N] — только в бригаде\n' +
        '▸ Расформировать клан\n\n' +
        '⚔️ БОЕВКА:\n' +
        '▸ Рейд [клан] — атака на 1 час (глава, 10000💰 из казны)\n' +
        '   Участники делают диверсии, защитники ставят ловушки.\n' +
        '   В конце — кража из казны врага. КД 3 дня.\n' +
        '▸ Диверсия — урон врагу при рейде (500💰)\n' +
        '▸ Ловушка — защита при рейде (300💰)\n' +
        '▸ Война [клан] — война на 24 часа (глава, 20000💰)\n' +
        '   Победитель получает нейтральную шахту (+20% на 3 дня)\n' +
        '   и забирает 10% казны врага. КД 7 дней.\n' +
        '▸ Атаковать @user — атака врага в войне\n' +
        '▸ Взорвать @user — показать оборудование врага\n' +
        '▸ Взорвать @user [N] — сломать оборудование\n' +
        '▸ Ремонт — починить всё сломанное\n' +
        '▸ Шахта — статус нейтральной шахты\n' +
        '▸ Перемирие — защита 12ч (5000💰)\n\n' +
        '🦠 ЗДОРОВЬЕ:\n' +
        '▸ Статус — проверить здоровье\n' +
        '▸ Лечить — вылечиться (300💰)\n' +
        '▸ Лечить @user — лечить другого (врач, 150💰)\n' +
        '▸ Вакцина — защита 24ч (1000💰)\n' +
        '▸ Эпидемия — статус\n\n' +
        '🎭 КРИМИНАЛ:\n' +
        '▸ Своровать — украсть у случайного\n' +
        '▸ Своровать @user — украсть у конкретного\n' +
        '▸ Чёрная работа — рискованный заработок\n\n' +
        '🔍 РАЗВЕДКА (доступ у админа):\n' +
        '▸ Инфа @user — профиль игрока\n' +
        '▸ Инфа клан [имя] — инфо о бригаде\n\n' +
        '🔗 РЕФЕРАЛКА:\n' +
        '▸ Реферал — получить ссылку\n' +
        '▸ Мои рефералы — список приглашённых\n' +
        '💰 +20000💰 вам, +5000💰 другу\n\n' +
        '🎟️ Промокод [код] — активировать\n\n' +
        '🏆 Топ / Топ кланов / Топ чатов'
      );
    }

  } catch (err) {
    console.error('Ошибка:', err.message);
    try { await ctx.send('❌ Ошибка.'); } catch {}
  }
});

(async () => {
  await initDB();
  await vk.updates.start();
  virus.startEpidemicChecker(state);
  console.log('✅ Бот запущен!');
})();
