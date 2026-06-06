'use strict';

const config = require('../config');
const { getPlayer, getOrCreate, pool, getAvailableEquipment, getItemQty, removeItem } = require('../database');
const { fmt, fmtTime, getName, vk, isProtected } = require('../helpers');
const state = require('../state');

const activeRaids = new Map();
const activeWars = new Map();
const attackCounts = new Map();
const peaceMode = new Map();

function setGlobals(g) {}

async function isInPeaceMode(uid) {
  const e = peaceMode.get(uid);
  if (e && e > Date.now()) return true;
  if (e) peaceMode.delete(uid);
  return false;
}

async function getDailyAttacks(uid) {
  const today = new Date(new Date().toLocaleString('en-US',{timeZone:'Europe/Moscow'})); today.setHours(0,0,0,0);
  let c = 0;
  for (const [k,v] of attackCounts) if (v.aid===uid && v.time>=today.getTime()) c++;
  return c;
}

async function canAttack(aid, tid) {
  const t = await getPlayer(tid);
  if (!t) return {ok:false,r:'Игрок не найден.'};
  if (isProtected(t)) return {ok:false,r:'Игрок защищён.'};
  if (await isInPeaceMode(tid)) return {ok:false,r:'Игрок в режиме мира.'};
  if (await getDailyAttacks(aid) >= config.MAX_ATTACKS_PER_DAY) return {ok:false,r:'Лимит атак на сегодня.'};
  return {ok:true};
}

// ═══ РЕЙД ═══
async function cmdRaid(ctx, uid, tname) {
  const p=await getOrCreate(uid);
  if(!p.guild_id) return ctx.send('❌ Вы не в бригаде.');
  const mg=await pool.query('SELECT * FROM guilds WHERE id=$1',[p.guild_id]);
  if(!mg.rows[0]) return ctx.send('❌ Бригада не найдена.');
  if(Number(mg.rows[0].owner_id)!==uid) return ctx.send('❌ Только глава может начать рейд.');
  
  const tg=await pool.query('SELECT * FROM guilds WHERE name=$1',[tname]);
  if(!tg.rows.length) return ctx.send(`❌ Бригада «${tname}» не найдена.`);
  if(tg.rows[0].id===p.guild_id) return ctx.send('❌ Нельзя рейдить свою бригаду.');
  
  const now=Date.now();
  if(Number(mg.rows[0].last_raid) && now-Number(mg.rows[0].last_raid)<config.RAID_COOLDOWN) {
    return ctx.send(`❌ Рейд доступен раз в 3 дня.\n⏳ Следующий через: ${fmtTime(config.RAID_COOLDOWN-(now-Number(mg.rows[0].last_raid)))}`);
  }
  if(Number(mg.rows[0].treasury)<config.RAID_COST) return ctx.send(`❌ Нужно ${fmt(config.RAID_COST)}💰 в казне.\n💰 В казне: ${fmt(Number(mg.rows[0].treasury))}`);
  
  await pool.query('UPDATE guilds SET treasury=treasury-$1,last_raid=$2 WHERE id=$3',[config.RAID_COST,now,p.guild_id]);
  
  const key=`${p.guild_id}_${tg.rows[0].id}`;
  activeRaids.set(key,{
    att:p.guild_id, def:tg.rows[0].id,
    damage:0, traps:0,
    end:now+config.RAID_DURATION,
    attName:mg.rows[0].name, defName:tg.rows[0].name
  });
  
  const allA=await pool.query('SELECT user_id FROM players WHERE guild_id=$1',[p.guild_id]);
  const allD=await pool.query('SELECT user_id FROM players WHERE guild_id=$1',[tg.rows[0].id]);
  
  for(const pl of allA.rows) try{await vk.api.messages.send({user_id:pl.user_id,message:`🏴‍☠️ РЕЙД! Атакуем «${tg.rows[0].name}»!\n⏳ 1 час на диверсии.\n💰 «Диверсия» — 500💰`,random_id:Math.floor(Math.random()*1e9)});}catch{}
  for(const pl of allD.rows) try{await vk.api.messages.send({user_id:pl.user_id,message:`🛡️ ТРЕВОГА! «${mg.rows[0].name}» атакует!\n⏳ Защищайтесь!\n🪤 «Ловушка» — 300💰`,random_id:Math.floor(Math.random()*1e9)});}catch{}
  
  await ctx.send(`🏴‍☠️ РЕЙД НАЧАТ!\n\nЦель: «${tg.rows[0].name}»\n⏳ Длительность: 1 час\n💰 Из казны: -${fmt(config.RAID_COST)}💰\n\nАтакующие: «Диверсия»\nЗащитники: «Ловушка»`);
  
  setTimeout(()=>finishRaid(key),config.RAID_DURATION);
}

async function cmdSabotage(ctx, uid) {
  const p=await getOrCreate(uid);
  if(p.balance<config.SABOTAGE_COST) return ctx.send(`❌ Нужно ${fmt(config.SABOTAGE_COST)}💰\n💰 Баланс: ${fmt(p.balance)}`);
  for(const[k,r] of activeRaids){
    if(r.att===p.guild_id&&Date.now()<r.end){
      await pool.query('UPDATE players SET balance=balance-$1 WHERE user_id=$2',[config.SABOTAGE_COST,uid]);
      r.damage+=config.SABOTAGE_DAMAGE;
      await ctx.send(`💣 ДИВЕРСИЯ!\n\n⚔️ Урон врагу: +${fmt(config.SABOTAGE_DAMAGE)}\n🎯 Цель: «${r.defName}»\n📊 Общий урон: ${fmt(r.damage)}`);
      return;
    }
  }
  await ctx.send('❌ Сейчас нет активного рейда.');
}

async function cmdTrap(ctx, uid) {
  const p=await getOrCreate(uid);
  if(p.balance<config.TRAP_COST) return ctx.send(`❌ Нужно ${fmt(config.TRAP_COST)}💰\n💰 Баланс: ${fmt(p.balance)}`);
  for(const[k,r] of activeRaids){
    if(r.def===p.guild_id&&Date.now()<r.end){
      await pool.query('UPDATE players SET balance=balance-$1 WHERE user_id=$2',[config.TRAP_COST,uid]);
      r.traps+=config.TRAP_DEFENSE;
      await ctx.send(`🪤 ЛОВУШКА УСТАНОВЛЕНА!\n\n🛡️ Защита: +${fmt(config.TRAP_DEFENSE)}\n📊 Общая защита: ${fmt(r.traps)}`);
      return;
    }
  }
  await ctx.send('❌ Сейчас нет активного рейда на вашу бригаду.');
}

async function finishRaid(key) {
  const r=activeRaids.get(key); if(!r) return;
  const dmg=Math.max(0,r.damage-r.traps);
  const tg=await pool.query('SELECT treasury,name FROM guilds WHERE id=$1',[r.def]);
  const ag=await pool.query('SELECT name FROM guilds WHERE id=$1',[r.att]);
  
  if(dmg>0&&tg.rows[0]){
    const steal=Math.min(Math.floor(Number(tg.rows[0].treasury)*config.RAID_MAX_STEAL_PCT),config.RAID_MAX_STEAL,Number(tg.rows[0].treasury));
    if(steal>0){
      await pool.query('UPDATE guilds SET treasury=treasury-$1 WHERE id=$2',[steal,r.def]);
      await pool.query('UPDATE guilds SET treasury=treasury+$1 WHERE id=$2',[steal,r.att]);
    }
    const allD=await pool.query('SELECT user_id FROM players WHERE guild_id=$1',[r.def]);
    const allA=await pool.query('SELECT user_id FROM players WHERE guild_id=$1',[r.att]);
    for(const pl of allD.rows) try{await vk.api.messages.send({user_id:pl.user_id,message:`💀 Рейд завершён! «${ag.rows[0]?.name}» украли ${fmt(steal)}💰 из казны.`,random_id:Math.floor(Math.random()*1e9)});}catch{}
    for(const pl of allA.rows) try{await vk.api.messages.send({user_id:pl.user_id,message:`🎉 Рейд успешен! Захвачено ${fmt(steal)}💰 из казны «${tg.rows[0]?.name}».`,random_id:Math.floor(Math.random()*1e9)});}catch{}
  } else {
    const allD=await pool.query('SELECT user_id FROM players WHERE guild_id=$1',[r.def]);
    const allA=await pool.query('SELECT user_id FROM players WHERE guild_id=$1',[r.att]);
    for(const pl of allD.rows) try{await vk.api.messages.send({user_id:pl.user_id,message:'🛡️ Рейд отбит! Ваша защита выдержала атаку.',random_id:Math.floor(Math.random()*1e9)});}catch{}
    for(const pl of allA.rows) try{await vk.api.messages.send({user_id:pl.user_id,message:'❌ Рейд провален! Защита врага оказалась сильнее.',random_id:Math.floor(Math.random()*1e9)});}catch{}
  }
  activeRaids.delete(key);
}

// ═══ СНОС ОБОРУДОВАНИЯ ═══
async function cmdDestroy(ctx, uid, tid, eqNum) {
  const c=await canAttack(uid,tid); if(!c.ok) return ctx.send(`❌ ${c.r}`);
  const p=await getOrCreate(uid);
  if(p.battle_rating<config.DESTROY_RATING_REQ) return ctx.send(`❌ Нужен рейтинг ${config.DESTROY_RATING_REQ}. У вас: ${p.battle_rating}`);
  const dq=await getItemQty(uid,'динамит'); if(!dq) return ctx.send('❌ Нужен динамит. Купите: «Купить динамит»');
  const eq=await getAvailableEquipment(tid); if(!eq.length) return ctx.send('❌ У игрока нет оборудования.');
  const num=parseInt(eqNum)||1; if(num<1||num>eq.length) return ctx.send(`❌ Выберите от 1 до ${eq.length}`);
  const td=eq[num-1];
  await removeItem(uid,'динамит',1);
  await pool.query('INSERT INTO destroyed_equipment(owner_id,equipment_type,destroyed_at,repair_until) VALUES($1,$2,$3,$4)',[tid,td.type,Date.now(),Date.now()+config.DESTROY_REPAIR_TIME]);
  attackCounts.set(`${uid}_${tid}_${Date.now()}`,{aid:uid,tid,time:Date.now()});
  await ctx.send(`💥 ВЗРЫВ!\n\n🔧 Уничтожено: ${td.name}\n👤 Владелец: ${await getName(tid)}\n⏳ Восстановление: 6 часов`);
  try{await vk.api.messages.send({user_id:tid,message:`💥 ${await getName(uid)} уничтожил ваш ${td.name}!\n🔧 «Ремонт» — восстановить`,random_id:Math.floor(Math.random()*1e9)});}catch{}
}

async function cmdShowEquipment(ctx, uid, tid) {
  const eq=await getAvailableEquipment(tid);
  if(!eq.length) return ctx.send('❌ У игрока нет доступного оборудования.');
  await ctx.send(`🔧 ОБОРУДОВАНИЕ ${await getName(tid)}:\n\n${eq.map((e,i)=>`${i+1}. ${e.name} (доступно: ${e.available})`).join('\n')}\n\n💥 «Взорвать @user [номер]»`);
}

async function cmdRepair(ctx, uid) {
  const now=Date.now();
  const d=await pool.query('SELECT * FROM destroyed_equipment WHERE owner_id=$1 AND repair_until>$2',[uid,now]);
  if(!d.rows.length) return ctx.send('✅ У вас нет сломанного оборудования.');
  let total=0;
  const items=[];
  for(const eq of d.rows){
    let cost=0; let name='';
    switch(eq.equipment_type){
      case'drill':cost=Math.floor(config.DRILL_COST*config.DESTROY_REPAIR_MULT);name='Обычный бур';break;
      case'drill_enhanced':cost=Math.floor(1000*config.DESTROY_REPAIR_MULT);name='Усиленный бур';break;
      case'drill_diamond':cost=Math.floor(3000*config.DESTROY_REPAIR_MULT);name='Алмазный бур';break;
      case'oil_rig':cost=Math.floor(config.OIL_COST*config.DESTROY_REPAIR_MULT);name='Нефтяная вышка';break;
    }
    total+=cost;
    items.push(`${name}: ${fmt(cost)}💰`);
  }
  const p=await getOrCreate(uid);
  if(p.balance<total) return ctx.send(`❌ Нужно ${fmt(total)}💰\n💰 Баланс: ${fmt(p.balance)}\n\nСломанное:\n${items.join('\n')}`);
  await pool.query('UPDATE players SET balance=balance-$1 WHERE user_id=$2',[total,uid]);
  await pool.query('DELETE FROM destroyed_equipment WHERE owner_id=$1',[uid]);
  await ctx.send(`🔧 РЕМОНТ ВЫПОЛНЕН!\n\n${items.join('\n')}\n💰 Потрачено: ${fmt(total)}`);
}

// ═══ ВОЙНА ═══
async function cmdWar(ctx, uid, tname) {
  const p=await getOrCreate(uid);
  if(!p.guild_id) return ctx.send('❌ Вы не в бригаде.');
  const mg=await pool.query('SELECT * FROM guilds WHERE id=$1',[p.guild_id]);
  if(!mg.rows[0]) return ctx.send('❌ Бригада не найдена.');
  if(Number(mg.rows[0].owner_id)!==uid) return ctx.send('❌ Только глава может объявить войну.');
  
  const tg=await pool.query('SELECT * FROM guilds WHERE name=$1',[tname]);
  if(!tg.rows.length) return ctx.send(`❌ Бригада «${tname}» не найдена.`);
  if(tg.rows[0].id===p.guild_id) return ctx.send('❌ Нельзя воевать с собой.');
  
  const now=Date.now();
  if(Number(mg.rows[0].last_war) && now-Number(mg.rows[0].last_war)<config.WAR_COOLDOWN) {
    return ctx.send(`❌ Война доступна раз в 7 дней.\n⏳ Следующая через: ${fmtTime(config.WAR_COOLDOWN-(now-Number(mg.rows[0].last_war)))}`);
  }
  if(Number(mg.rows[0].treasury)<config.WAR_COST) return ctx.send(`❌ Нужно ${fmt(config.WAR_COST)}💰 в казне.`);
  
  await pool.query('UPDATE guilds SET treasury=treasury-$1,last_war=$2 WHERE id=$3',[config.WAR_COST,now,p.guild_id]);
  
  const key=`${p.guild_id}_${tg.rows[0].id}`;
  activeWars.set(key,{g1:p.guild_id,g2:tg.rows[0].id,p1:0,p2:0,end:now+config.WAR_DURATION});
  
  const ap=await pool.query('SELECT user_id FROM players WHERE guild_id IN ($1,$2) AND banned=FALSE',[p.guild_id,tg.rows[0].id]);
  for(const pl of ap.rows) try{await vk.api.messages.send({user_id:pl.user_id,message:`⚔️ ВОЙНА! «${mg.rows[0].name}» vs «${tg.rows[0].name}»!\n⏳ 24 часа.\n«Атаковать @user» — атака врага`,random_id:Math.floor(Math.random()*1e9)});}catch{}
  
  await ctx.send(`⚔️ ВОЙНА ОБЪЯВЛЕНА!\n\nВраг: «${tg.rows[0].name}»\n⏳ 24 часа\n💰 Из казны: -${fmt(config.WAR_COST)}💰\n\nПобедитель получит нейтральную шахту (+20% к добыче) и 10% казны врага!\n«Атаковать @user» — атакуйте врагов`);
}

async function cmdAttack(ctx, uid, tid) {
  const p=await getOrCreate(uid), t=await getPlayer(tid);
  if(!t||!t.guild_id||t.guild_id===p.guild_id) return ctx.send('❌ Игрок не во вражеской бригаде.');
  
  for(const[k,w] of activeWars){
    if(Date.now()<w.end&&((w.g1===p.guild_id&&w.g2===t.guild_id)||(w.g2===p.guild_id&&w.g1===t.guild_id))){
      const winner=Math.random()<0.5?uid:tid;
      if(winner===uid){if(w.g1===p.guild_id)w.p1++;else w.p2++;}
      else{if(w.g1===t.guild_id)w.p1++;else w.p2++;}
      attackCounts.set(`${uid}_${tid}_${Date.now()}`,{aid:uid,tid,time:Date.now()});
      await ctx.send(`⚔️ АТАКА!\n\nПобедитель: ${await getName(winner)}\n📊 Счёт войны: ${w.p1} - ${w.p2}`);
      try{await vk.api.messages.send({user_id:tid,message:`⚔️ Вас атаковал ${await getName(uid)}!\nСчёт войны: ${w.p1}-${w.p2}`,random_id:Math.floor(Math.random()*1e9)});}catch{}
      return;
    }
  }
  await ctx.send('❌ Сейчас нет активной войны с бригадой этого игрока.');
}

async function cmdMineInfo(ctx) {
  if(!state.neutralMineController||state.neutralMineControlEnd<=Date.now()) return ctx.send('🏰 НЕЙТРАЛЬНАЯ ШАХТА\n\nСтатус: свободна\n💡 Захватите через войну кланов!');
  const g=await pool.query('SELECT name FROM guilds WHERE id=$1',[state.neutralMineController]);
  await ctx.send(`🏰 НЕЙТРАЛЬНАЯ ШАХТА\n\n👑 Контролирует: «${g.rows[0]?.name}»\n📈 Бонус: +20% к добыче\n⏳ Контроль ещё: ${fmtTime(state.neutralMineControlEnd-Date.now())}`);
}

async function cmdPeace(ctx, uid) {
  if(await isInPeaceMode(uid)) return ctx.send('🕊️ Вы уже в режиме мира.');
  const p=await getOrCreate(uid);
  if(p.balance<config.PEACE_COST) return ctx.send(`❌ Нужно ${fmt(config.PEACE_COST)}💰\n💰 Баланс: ${fmt(p.balance)}`);
  await pool.query('UPDATE players SET balance=balance-$1 WHERE user_id=$2',[config.PEACE_COST,uid]);
  peaceMode.set(uid,Date.now()+config.PEACE_DURATION);
  await ctx.send(`🕊️ РЕЖИМ МИРА\n\n⏳ Защита: 12 часов\n💰 Потрачено: ${fmt(config.PEACE_COST)}💰\n🛡️ Вас нельзя атаковать, взрывать и воровать.`);
}

module.exports = { setGlobals, cmdRaid, cmdSabotage, cmdTrap, cmdDestroy, cmdShowEquipment, cmdRepair, cmdWar, cmdAttack, cmdMineInfo, cmdPeace };
