'use strict';

const config = require('../config');
const { getPlayer, getOrCreate, addItem, getItemQty, removeItem, pool, calcPassiveInfo } = require('../database');
const { fmt, fmtTime, randInt, getName, getMoscowDayOfWeek, getMoscowDayStart, updateVirusStatus, getClassBonus } = require('../helpers');
const { PICKAXE, ORES, CLASSES, DAILY_BONUS } = require('../game-data');
const state = require('../state');

function setGlobals(g) {}

async function cmdStart(ctx, uid) {
  const p = await getPlayer(uid);
  if (p && p.banned) return ctx.send('⛔ Вы заблокированы.');
  if (p && p.work_count > 0) return ctx.send(`⛏️ Уже зарегистрированы!\n🆔 ${uid}\n👤 ${p.player_class||'нет'}\n💰 ${fmt(p.balance)}💰`);
  await getOrCreate(uid);
  const list = Object.entries(CLASSES).map(([n,i]) => `▸ ${n} — ${i.desc}`).join('\n');
  await ctx.send(`🎉 ДОБРО ПОЖАЛОВАТЬ!\n🆔 ${uid}\n\n👤 КЛАССЫ:\n${list}\n\n📝 «Класс шахтёр»`);
}

async function cmdSetClass(ctx, uid, className) {
  const p = await getOrCreate(uid);
  if (p.banned) return ctx.send('⛔');
  if (!className) {
    const list = Object.entries(CLASSES).map(([n,i]) => `▸ ${n} — ${i.desc}`).join('\n');
    return ctx.send(`👤 КЛАССЫ:\n${list}\n\nВаш: ${p.player_class||'не выбран'}\n📝 «Класс [имя]»`);
  }
  className = className.toLowerCase();
  if (!CLASSES[className]) return ctx.send(`❌ Нет «${className}».\nДоступные: ${Object.keys(CLASSES).join(', ')}`);
  await pool.query('UPDATE players SET player_class=$1 WHERE user_id=$2',[className,uid]);
  const em = {шахтёр:'⛏️',инженер:'⚙️',нефтяник:'🛢️',врач:'🏥',бригадир:'👑'};
  await ctx.send(`${em[className]||'👤'} Класс «${className}»!\n📋 ${CLASSES[className].desc}`);
}

async function cmdWork(ctx, uid) {
  const p = await getOrCreate(uid);
  if (p.banned) return ctx.send('⛔');
  const now = Date.now(); updateVirusStatus(p);
  if (p.jail_until>now) return ctx.send(`🚨 ТЮРЬМА!\n⏳ ${fmtTime(p.jail_until-now)}`);
  if (p.virus===1&&p.virus_end>now) return ctx.send(`🦠 БОЛЕН!\n⏳ ${fmtTime(p.virus_end-now)}\n🏥 «Лечить» ${fmt(config.MEDKIT_COST)}💰`);
  const left = config.WORK_CD-(now-p.last_work);
  if (left>0) return ctx.send(`⏳ КД: ${fmtTime(left)}\n💡 «Отдых» или «Еда»`);
  if (p.stamina<config.STAMINA_PER_WORK) return ctx.send(`😮‍💨 Стамина: ${p.stamina}/${config.MAX_STAMINA}\n💡 «Отдых» или «Еда»`);

  const pick = PICKAXE.find(l=>l.level===p.pickaxe_lvl)||PICKAXE[0];
  let income = Math.floor(config.BASE_INCOME*(1+pick.bonus/100));
  if (getClassBonus(p,'mine')) income=Math.floor(income*1.20);
  const hasDyn = (await getItemQty(uid,'динамит'))>0;
  if (hasDyn){income*=2;await removeItem(uid,'динамит',1);}
  let gb=0;
  if (p.guild_id){const gr=await pool.query('SELECT level FROM guilds WHERE id=$1',[p.guild_id]);if(gr.rows[0]){gb=Number(gr.rows[0].level)*5;const br=await pool.query("SELECT user_id FROM players WHERE guild_id=$1 AND player_class='бригадир' LIMIT 1",[p.guild_id]);if(br.rows.length)gb+=10;income=Math.floor(income*(1+gb/100));}}
  if (state.neutralMineController===p.guild_id&&state.neutralMineControlEnd>now) income=Math.floor(income*1.20);
  if (state.globalEpidemic&&p.virus!==2) income=Math.floor(income*0.5);
  const ns=p.stamina-config.STAMINA_PER_WORK;
  await pool.query('UPDATE players SET balance=balance+$1,stamina=$2,last_work=$3,work_count=work_count+1,battle_rating=battle_rating+1 WHERE user_id=$4',[income,ns,now,uid]);
  if (ctx.peerId&&ctx.peerId>2000000000) await pool.query('INSERT INTO chat_activity(chat_id,user_id,work_count,last_work) VALUES($1,$2,1,$3) ON CONFLICT(chat_id,user_id) DO UPDATE SET work_count=chat_activity.work_count+1,last_work=$3',[ctx.peerId-2000000000,uid,now]);
  const li=Math.max(0,Math.min((p.pickaxe_lvl||1)-1,4));
  const oreLines=[];
  for(const[n,o] of Object.entries(ORES)){if(Math.random()<o.chance[li]){let q=randInt(o.min,o.max);if(hasDyn)q*=2;await addItem(uid,n,q);oreLines.push(`${o.emoji} ${n}: +${q} шт.`);}}
  let msg=`⛏️ СПУСК В ШАХТУ!\n\n💰 +${fmt(income)} монет`;
  if (hasDyn) msg+='\n💥 Динамит: ×2';
  if (gb) msg+=`\n👥 Бригада: +${gb}%`;
  if (oreLines.length) msg+=`\n\n🎒 ДОБЫЧА:\n${oreLines.join('\n')}`;
  msg+=`\n\n❤️ Стамина: ${ns}/${config.MAX_STAMINA}\n⚔️ Рейтинг: ${p.battle_rating+1}\n📊 Работ: ${p.work_count+1}\n💰 Баланс: ${fmt(p.balance+income)}`;
  await ctx.send(msg);
}

async function cmdRest(ctx, uid) {
  const p=await getOrCreate(uid); if(p.banned) return ctx.send('⛔');
  const now=Date.now(), left=config.REST_CD-(now-p.last_rest);
  if (left>0) return ctx.send(`😴 КД отдыха: ${fmtTime(left)}\n💡 «Еда» +50 стамины`);
  const gained=config.MAX_STAMINA-p.stamina;
  await pool.query('UPDATE players SET stamina=$1,last_rest=$2 WHERE user_id=$3',[config.MAX_STAMINA,now,uid]);
  await ctx.send(`😴 ОТДЫХ\n❤️ Стамина: ${config.MAX_STAMINA}/${config.MAX_STAMINA}${gained>0?` (+${gained})`:''}`);
}

async function cmdPickaxe(ctx, uid) {
  const p=await getOrCreate(uid); if(p.banned) return ctx.send('⛔');
  const cur=PICKAXE.find(l=>l.level===p.pickaxe_lvl);
  if (!cur||cur.cost===null) return ctx.send('🔨 МАКС! Ур.5 (+120%)');
  if (p.balance<cur.cost) return ctx.send(`❌ ${fmt(cur.cost)}💰 нужно\nБаланс: ${fmt(p.balance)}`);
  await pool.query('UPDATE players SET balance=balance-$1,pickaxe_lvl=pickaxe_lvl+1 WHERE user_id=$2',[cur.cost,uid]);
  await ctx.send(`🔨 Ур.${cur.level+1}! +${PICKAXE.find(l=>l.level===cur.level+1).bonus}%\n💰 -${fmt(cur.cost)}`);
}

async function cmdProfile(ctx, uid) {
  const p=await getOrCreate(uid); updateVirusStatus(p);
  const name=await getName(uid), pick=PICKAXE.find(l=>l.level===p.pickaxe_lvl)||PICKAXE[0];
  let gn='Нет'; if(p.guild_id){const gr=await pool.query('SELECT name FROM guilds WHERE id=$1',[p.guild_id]);if(gr.rows[0])gn=gr.rows[0].name;}
  const info=await calcPassiveInfo(uid);
  const refCount=(await pool.query('SELECT COUNT(*) as c FROM players WHERE referred_by=$1',[uid])).rows[0].c;
  const em={шахтёр:'⛏️',инженер:'⚙️',нефтяник:'🛢️',врач:'🏥',бригадир:'👑'};

  const lines=[
    `👤 ПРОФИЛЬ: ${name}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🆔 ID: ${uid}`,
    `💰 Баланс: ${fmt(p.balance)} монет`,
    `❤️ Стамина: ${p.stamina}/${config.MAX_STAMINA}`,
    `⛏️ Кирка: уровень ${p.pickaxe_lvl} (+${pick.bonus}% к добыче)`,
    `⚔️ Боевой рейтинг: ${p.battle_rating}`,
    `👤 Класс: ${em[p.player_class]||''} ${p.player_class||'не выбран'}`,
    `👥 Бригада: ${gn}`,
    `⭐ Уровень крафта: ${p.craft_level}`,
    `📊 Выполнено работ: ${p.work_count}`,
    `🔗 Приглашено рефералов: ${refCount}`,
    '',
    `⚙️ ОБОРУДОВАНИЕ:`,
    `▸ Обычные буры: ${info.totalDrills} шт. (активно: ${info.activeDrills})`,
    `▸ Усиленные буры: ${info.totalEnhanced} шт. (активно: ${info.activeEnhanced})`,
    `▸ Алмазные буры: ${info.totalDiamond} шт. (активно: ${info.activeDiamond})`,
    `▸ Нефтяные вышки: ${info.totalRigs} шт. (активно: ${info.activeRigs})`,
    '',
    `📈 ПАССИВНЫЙ ДОХОД:`,
    `▸ С буров: ${fmt(info.drillIncomePerHour)}💰/час`,
    `▸ С вышек: ${fmt(info.oilIncomePerHour)}💰/час`,
    `▸ Общий: ${fmt(info.drillIncomePerHour+info.oilIncomePerHour)}💰/час`,
  ];
  if (config.WORK_CD-(Date.now()-p.last_work)<=0) lines.push('','✅ Можно работать! «Работа»');
  if (p.jail_until>Date.now()) lines.push(`🚨 Тюрьма: ${fmtTime(p.jail_until-Date.now())}`);
  await ctx.send(lines.join('\n'));
}

async function cmdBlackWork(ctx, uid) {
  const p=await getOrCreate(uid); if(p.banned) return ctx.send('⛔');
  const now=Date.now(); updateVirusStatus(p);
  if (p.jail_until>now) return ctx.send('🚨 ТЮРЬМА!');
  const left=config.BLACK_WORK_CD-(now-p.last_black);
  if (left>0) return ctx.send(`🕵️ КД: ${fmtTime(left)}`);
  let cc=config.BLACK_CATCH_CHANCE; if(p.has_roof) cc/=2;
  const hasDyn=(await getItemQty(uid,'динамит'))>0;
  let inc=config.BLACK_WORK_INCOME;
  if (hasDyn){inc*=2;cc=Math.max(0.05,cc-0.10);await removeItem(uid,'динамит',1);}
  await pool.query('UPDATE players SET last_black=$1 WHERE user_id=$2',[now,uid]);
  if (Math.random()<cc){
    const fine=Math.min(config.BLACK_FINE,p.balance);
    await pool.query('UPDATE players SET balance=balance-$1,stamina=20,jail_until=$2 WHERE user_id=$3',[fine,now+config.JAIL_DURATION,uid]);
    return ctx.send(`🚨 ПОЙМАЛИ!\n💸 -${fmt(fine)}💰\n⛓️ Тюрьма 1ч`);
  }
  await pool.query('UPDATE players SET balance=balance+$1 WHERE user_id=$2',[inc,uid]);
  await addItem(uid,'контрабанда',randInt(1,2));
  await ctx.send(`🦹 +${fmt(inc)}💰 +контрабанда`);
}

async function cmdSteal(ctx, uid, tidStr) {
  const p=await getOrCreate(uid); if(p.banned) return ctx.send('⛔');
  const now=Date.now();
  if (p.jail_until>now) return ctx.send('🚨 Тюрьма!');
  const left=config.STEAL_CD-(now-p.last_steal);
  if (left>0) return ctx.send(`🎭 КД: ${fmtTime(left)}`);
  const top=await pool.query('SELECT user_id,balance FROM players WHERE user_id!=$1 AND balance>=$2 AND banned=FALSE AND hidden=FALSE ORDER BY balance DESC LIMIT 10',[uid,config.STEAL_MIN_BALANCE]);
  if (!top.rows.length) return ctx.send(`🎭 Нет жертв с балансом от ${fmt(config.STEAL_MIN_BALANCE)}💰`);
  let vid,vb;
  if (tidStr){vid=parseInt(tidStr);const v=top.rows.find(r=>Number(r.user_id)===vid);if(!v)return ctx.send('❌ Игрок не в топ-10. Используйте @username или ID.');vb=Number(v.balance);}
  else{const v=top.rows[Math.floor(Math.random()*top.rows.length)];vid=Number(v.user_id);vb=Number(v.balance);}
  await pool.query('UPDATE players SET last_steal=$1 WHERE user_id=$2',[now,uid]);
  if (Math.random()>config.STEAL_CHANCE){const fine=Math.min(500,p.balance);await pool.query('UPDATE players SET balance=balance-$1 WHERE user_id=$2',[fine,uid]);return ctx.send(`🎭 ПРОВАЛ!\n💸 Штраф: ${fmt(fine)}💰\n⏳ КД: 4 часа`);}
  const stolen=Math.min(Math.floor(vb*(0.03+Math.random()*0.05)),100000);
  await pool.query('UPDATE players SET balance=balance-$1 WHERE user_id=$2',[stolen,vid]);
  await pool.query('UPDATE players SET balance=balance+$1 WHERE user_id=$2',[stolen,uid]);
  const vn=await getName(vid);
  await ctx.send(`🎭 КРАЖА УДАЛАСЬ!\n👤 ${vn}\n💰 +${fmt(stolen)} монет\n👛 Баланс: ${fmt(p.balance+stolen)}`);
}

async function cmdDailyBonus(ctx, uid) {
  const p=await getOrCreate(uid);
  if (p.banned) return ctx.send('⛔');
  if (!p.guild_id) return ctx.send(`🎁 БОНУС\n❌ Только в бригаде!\n💡 «Создать бригаду [имя]» ${fmt(config.GUILD_COST)}💰`);
  const ds=getMoscowDayStart();
  if (p.last_daily>=ds) return ctx.send('🎁 БОНУС\n✅ Уже забрали.\n⏳ Завтра после 00:00 МСК');
  const b=DAILY_BONUS[getMoscowDayOfWeek()];
  await pool.query('UPDATE players SET last_daily=$1 WHERE user_id=$2',[Date.now(),uid]);
  if (b.type==='coins'){await pool.query('UPDATE players SET balance=balance+$1 WHERE user_id=$2',[b.amount,uid]);await ctx.send(`🎁 БОНУС\n💰 +${fmt(b.amount)} монет`);}
  else{await pool.query('UPDATE players SET drills=drills+1,last_drill=$1 WHERE user_id=$2',[Date.now(),uid]);await ctx.send(`🎁 БОНУС\n⚙️ +1 бур (всего: ${p.drills+1})`);}
}

async function cmdTop(ctx) {
  const r=await pool.query('SELECT user_id,balance FROM players WHERE hidden=FALSE AND banned=FALSE ORDER BY balance DESC LIMIT 10');
  if (!r.rows.length) return ctx.send('📊 Пусто.');
  const lines=['🏆 ТОП-10:'];
  for (let i=0;i<r.rows.length;i++) lines.push(`${['🥇','🥈','🥉'][i]||`${i+1}.`} ${await getName(r.rows[i].user_id)} — ${fmt(r.rows[i].balance)}💰`);
  await ctx.send(lines.join('\n'));
}

async function cmdChatTop(ctx) {
  const r=await pool.query('SELECT chat_id,SUM(work_count) as tw FROM chat_activity GROUP BY chat_id ORDER BY tw DESC LIMIT 10');
  if (!r.rows.length) return ctx.send('💬 Нет данных.');
  const lines=['💬 ТОП ЧАТОВ:'];
  for (let i=0;i<r.rows.length;i++){
    let nm=`Чат#${r.rows[i].chat_id}`;
    try{const ci=await require('../helpers').vk.api.messages.getConversationsById({peer_ids:Number(r.rows[i].chat_id)+2000000000});if(ci.items[0])nm=ci.items[0].chat_settings.title;}catch{}
    lines.push(`${i+1}. ${nm} — ${r.rows[i].tw} работ`);
  }
  await ctx.send(lines.join('\n'));
}

module.exports = { setGlobals, cmdStart, cmdSetClass, cmdWork, cmdRest, cmdPickaxe, cmdProfile, cmdBlackWork, cmdSteal, cmdDailyBonus, cmdTop, cmdChatTop };
