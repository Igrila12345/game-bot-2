'use strict';

const config = require('../config');
const { getPlayer, getOrCreate, pool, getItemQty, removeItem, addItem } = require('../database');
const { fmt, getName, isAdmin } = require('../helpers');

function setGlobals(g) {}

async function cmdAdminHelp(ctx) {
  await ctx.send(
    '👑 АДМИН:\n\n'+
    '💰 !дать [ID] [сумма] | !забрать\n'+
    '⛏️ !датьруду | !забратьруду | !датьпредмет | !забратьпредмет\n'+
    '⚙️ !датьбур [ID] [N] | !забратьбур | !датьвышку | !забратьвышку\n'+
    '👤 !игроки | !профиль [ID] | !освободить | !бан | !разбан\n'+
    '⏳ !сброскд [ID] | !датькд [ID] [мин]\n'+
    '🚫 !блокдоход | !разблокдоход | !наказания\n'+
    '🔍 !датьинфу | !инфадоступ | !рефералы [ID]\n'+
    '🦠 !вирус | !вылечить | !защитить\n'+
    '🎟️ !промо | !деактивировать | !промокоды\n'+
    '⚠️ !обнулитьвсех | !админ [ID] | !снятьадмин'
  );
}

async function cmdGive(ctx, parts) {
  const tid=parseInt(parts[1]), amt=parseInt(parts[2]);
  if(!tid||!amt||amt<=0) return ctx.send('❌ !дать [ID] [сумма]');
  await getOrCreate(tid);
  await pool.query('UPDATE players SET balance=balance+$1 WHERE user_id=$2',[amt,tid]);
  await ctx.send(`✅ ${await getName(tid)} +${fmt(amt)}💰`);
}

async function cmdTake(ctx, parts) {
  const tid=parseInt(parts[1]), amt=parseInt(parts[2]);
  if(!tid||!amt||amt<=0) return ctx.send('❌ !забрать [ID] [сумма]');
  const p=await getPlayer(tid); if(!p) return ctx.send('❌');
  const take=Math.min(amt,p.balance);
  await pool.query('UPDATE players SET balance=balance-$1 WHERE user_id=$2',[take,tid]);
  await ctx.send(`✅ -${fmt(take)}💰`);
}

async function cmdGiveOre(ctx, parts) {
  const tid=parseInt(parts[1]), ore=parts[2], qty=parseInt(parts[3])||1;
  if(!tid||!ore) return ctx.send('❌ !датьруду [ID] [руда] [кол-во]');
  await getOrCreate(tid); await addItem(tid,ore,qty);
  await ctx.send(`✅ ${ore} ×${qty}`);
}

async function cmdTakeOre(ctx, parts) {
  const tid=parseInt(parts[1]), ore=parts[2], qty=parseInt(parts[3])||1;
  if(!tid||!ore) return ctx.send('❌');
  const cur=await getItemQty(tid,ore); const take=Math.min(qty,cur);
  if(!take) return ctx.send('❌ Нет.');
  await removeItem(tid,ore,take);
  await ctx.send(`✅ -${take} ${ore}`);
}

async function cmdGiveItem(ctx, parts) {
  const tid=parseInt(parts[1]), item=parts[2], qty=parseInt(parts[3])||1;
  if(!tid||!item) return ctx.send('❌');
  await getOrCreate(tid); await addItem(tid,item,qty);
  await ctx.send(`✅ ${item} ×${qty}`);
}

async function cmdTakeItem(ctx, parts) {
  const tid=parseInt(parts[1]), item=parts[2], qty=parseInt(parts[3])||1;
  if(!tid||!item) return ctx.send('❌');
  const cur=await getItemQty(tid,item); const take=Math.min(qty,cur);
  if(!take) return ctx.send('❌ Нет.');
  await removeItem(tid,item,take);
  await ctx.send(`✅ -${take} ${item}`);
}

async function cmdGiveDrill(ctx, parts) {
  const tid=parseInt(parts[1]), qty=parseInt(parts[2])||1;
  if(!tid||qty<=0) return ctx.send('❌ !датьбур [ID] [кол-во]');
  await getOrCreate(tid);
  await pool.query('UPDATE players SET drills=drills+$1 WHERE user_id=$2',[qty,tid]);
  await ctx.send(`✅ +${qty} буров → ${await getName(tid)}`);
}

async function cmdTakeDrill(ctx, parts) {
  const tid=parseInt(parts[1]), qty=parseInt(parts[2])||1;
  if(!tid||qty<=0) return ctx.send('❌ !забратьбур [ID] [кол-во]');
  const p=await getPlayer(tid); if(!p) return ctx.send('❌');
  const take=Math.min(qty,p.drills);
  await pool.query('UPDATE players SET drills=drills-$1 WHERE user_id=$2',[take,tid]);
  await ctx.send(`✅ -${take} буров`);
}

async function cmdGiveOil(ctx, parts) {
  const tid=parseInt(parts[1]), qty=parseInt(parts[2])||1;
  if(!tid||qty<=0) return ctx.send('❌ !датьвышку [ID] [кол-во]');
  await getOrCreate(tid);
  await pool.query('UPDATE players SET oil_rigs=oil_rigs+$1 WHERE user_id=$2',[qty,tid]);
  await ctx.send(`✅ +${qty} вышек → ${await getName(tid)}`);
}

async function cmdTakeOil(ctx, parts) {
  const tid=parseInt(parts[1]), qty=parseInt(parts[2])||1;
  if(!tid||qty<=0) return ctx.send('❌ !забратьвышку [ID] [кол-во]');
  const p=await getPlayer(tid); if(!p) return ctx.send('❌');
  const take=Math.min(qty,p.oil_rigs);
  await pool.query('UPDATE players SET oil_rigs=oil_rigs-$1 WHERE user_id=$2',[take,tid]);
  await ctx.send(`✅ -${take} вышек`);
}

async function cmdPlayers(ctx) {
  const r=await pool.query('SELECT user_id,balance,banned FROM players ORDER BY balance DESC');
  if(!r.rows.length) return ctx.send('Пусто.');
  const lines=[`👤 ИГРОКОВ: ${r.rows.length}`];
  for(let i=0;i<r.rows.length;i++) lines.push(`${i+1}. ${await getName(r.rows[i].user_id)} — ${fmt(r.rows[i].balance)}💰 ${r.rows[i].banned?'⛔':''}`);
  await ctx.send(lines.join('\n'));
}

async function cmdProfile(ctx, tid) {
  const p=await getPlayer(parseInt(tid)); if(!p) return ctx.send('❌');
  const gn=p.guild_id?(await pool.query('SELECT name FROM guilds WHERE id=$1',[p.guild_id])).rows[0]?.name||'Нет':'Нет';
  const refCount=(await pool.query('SELECT COUNT(*) as c FROM players WHERE referred_by=$1',[p.user_id])).rows[0].c;
  await ctx.send(`👤 ${await getName(p.user_id)}\n💰 ${fmt(p.balance)} | ⛏️ Ур.${p.pickaxe_lvl}\n⚙️ Б:${p.drills} | 🛢️ ${p.oil_rigs}\n👥 ${gn} | 🔗 Реф:${refCount}`);
}

async function cmdFree(ctx, tid) { await pool.query('UPDATE players SET jail_until=0 WHERE user_id=$1',[parseInt(tid)]); await ctx.send('✅'); }
async function cmdHide(ctx, uid) { await pool.query('UPDATE players SET hidden=TRUE WHERE user_id=$1',[uid]); await ctx.send('👻'); }
async function cmdShow(ctx, uid) { await pool.query('UPDATE players SET hidden=FALSE WHERE user_id=$1',[uid]); await ctx.send('✅'); }

async function cmdBan(ctx, parts) { const tid=parseInt(parts[1]); if(!tid) return ctx.send('❌'); await pool.query('UPDATE players SET banned=TRUE WHERE user_id=$1',[tid]); await ctx.send(`⛔ ${await getName(tid)}`); }
async function cmdUnban(ctx, parts) { const tid=parseInt(parts[1]); if(!tid) return ctx.send('❌'); await pool.query('UPDATE players SET banned=FALSE WHERE user_id=$1',[tid]); await ctx.send(`✅ ${await getName(tid)}`); }

async function cmdSetAdmin(ctx, uid, tid) { if(uid!==config.ADMIN_ID) return ctx.send('❌'); await pool.query('UPDATE players SET is_admin=TRUE WHERE user_id=$1',[parseInt(tid)]); await ctx.send('✅'); }
async function cmdRemoveAdmin(ctx, uid, tid) { if(uid!==config.ADMIN_ID||parseInt(tid)===config.ADMIN_ID) return ctx.send('❌'); await pool.query('UPDATE players SET is_admin=FALSE WHERE user_id=$1',[parseInt(tid)]); await ctx.send('✅'); }

async function cmdResetAll(ctx) { await ctx.send('⚠️ !обнулитьвсех подтвердить'); }
async function cmdResetAllConfirm(ctx) {
  await pool.query("UPDATE players SET balance=0,stamina=100,pickaxe_lvl=1,drills=0,oil_rigs=0,drills_enhanced=0,drills_diamond=0,work_count=0,craft_level=1,battle_rating=0,last_work=0,last_rest=0,last_drill=0,last_oil=0");
  await pool.query('DELETE FROM inventory;DELETE FROM destroyed_equipment;DELETE FROM market_listings;UPDATE guilds SET treasury=0,guild_balance=0');
  await pool.query('UPDATE players SET is_admin=TRUE WHERE user_id=$1',[config.ADMIN_ID]);
  await ctx.send('✅ ОБНУЛЕНО!');
}

async function cmdResetCD(ctx, parts) { const tid=parseInt(parts[1]); if(!tid) return ctx.send('❌ !сброскд [ID]'); await pool.query('UPDATE players SET last_work=0 WHERE user_id=$1',[tid]); await ctx.send(`✅ КД сброшен`); }
async function cmdSetCD(ctx, parts) { const tid=parseInt(parts[1]), min=parseInt(parts[2]); if(!tid||!min||min<=0) return ctx.send('❌ !датькд [ID] [мин]'); const cd=Date.now()-(30*60*1000)+(min*60*1000); await pool.query('UPDATE players SET last_work=$1 WHERE user_id=$2',[cd,tid]); await ctx.send(`✅ КД ${min} мин`); }

async function cmdGiveInfo(ctx, uid, tid, days) { const t=parseInt(tid),d=parseInt(days); if(!t||![1,7,30].includes(d)) return ctx.send('❌'); globalThis.infoAccess.set(t,Date.now()+d*86400000); await ctx.send(`✅`); }
async function cmdCheckInfo(ctx, uid, tid) { const t=parseInt(tid); if(!t) return ctx.send('❌'); const a=globalThis.infoAccess.get(t); if(!a||a<=Date.now()){globalThis.infoAccess.delete(t);return ctx.send('❌');} await ctx.send(`✅`); }

async function cmdAdminReferrals(ctx, uid, tidStr) {
  if(!await isAdmin(uid)) return ctx.send('❌');
  const tid=parseInt(tidStr); if(!tid) return ctx.send('❌');
  const p=await getPlayer(tid); if(!p) return ctx.send('❌');
  const refs=await pool.query('SELECT user_id,balance FROM players WHERE referred_by=$1 ORDER BY balance DESC',[tid]);
  if(!refs.rows.length) return ctx.send(`👥 0 реф.`);
  const lines=[`👥 ${await getName(tid)}: ${refs.rows.length} реф.`];
  for(const r of refs.rows) lines.push(`${await getName(Number(r.user_id))} — ${fmt(Number(r.balance))}💰`);
  await ctx.send(lines.join('\n'));
}

module.exports = {
  setGlobals, cmdAdminHelp, cmdGive, cmdTake, cmdGiveOre, cmdTakeOre,
  cmdGiveItem, cmdTakeItem, cmdGiveDrill, cmdTakeDrill, cmdGiveOil, cmdTakeOil,
  cmdPlayers, cmdProfile, cmdFree, cmdHide, cmdShow, cmdBan, cmdUnban,
  cmdSetAdmin, cmdRemoveAdmin, cmdResetAll, cmdResetAllConfirm,
  cmdGiveInfo, cmdCheckInfo, cmdAdminReferrals, cmdResetCD, cmdSetCD
};
