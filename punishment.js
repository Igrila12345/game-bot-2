'use strict';

const { getOrCreate, pool } = require('../database');
const { fmt, fmtTime, getName, vk, isAdmin } = require('../helpers');

const activePunishments = new Map();

function isIncomeBanned(uid) {
  const p = activePunishments.get(uid);
  if (!p) return false;
  if (p.until <= Date.now()) { activePunishments.delete(uid); return false; }
  return true;
}

function getPunishmentInfo(uid) {
  const p = activePunishments.get(uid);
  if (!p || p.until <= Date.now()) { activePunishments.delete(uid); return null; }
  return p;
}

async function cmdBlockIncome(ctx, uid, tidStr, hoursStr, ...reason) {
  if (!await isAdmin(uid)) return ctx.send('❌ Админ.');
  const tid = parseInt(tidStr), hours = parseInt(hoursStr);
  if (!tid||!hours||hours<=0||hours>168) return ctx.send('❌ !блокдоход [ID] [часы] [причина]\nМакс: 168 ч (7 дней)');
  await getOrCreate(tid);
  const until = Date.now() + hours*3600000;
  const reasonText = reason.join(' ') || 'Не указана';
  activePunishments.set(tid, {type:'income_ban',until,reason:reasonText,issuedBy:uid});
  const tn = await getName(tid);
  await ctx.send(`🚫 Доход ${tn} заблокирован на ${hours}ч.\n📋 ${reasonText}`);
  try { await vk.api.messages.send({user_id:tid,message:`🚫 Твой доход заблокирован на ${hours}ч.\nПричина: ${reasonText}`,random_id:Math.floor(Math.random()*1e9)}); } catch {}
  await pool.query('INSERT INTO punishment_history(user_id,type,until,reason,issued_by) VALUES($1,$2,$3,$4,$5)',[tid,'income_ban',until,reasonText,uid]);
}

async function cmdUnblockIncome(ctx, uid, tidStr) {
  if (!await isAdmin(uid)) return ctx.send('❌');
  const tid = parseInt(tidStr);
  if (!tid) return ctx.send('❌ !разблокдоход [ID]');
  activePunishments.delete(tid);
  await ctx.send(`✅ Доход ${await getName(tid)} разблокирован.`);
  try { await vk.api.messages.send({user_id:tid,message:'✅ Доход разблокирован!',random_id:Math.floor(Math.random()*1e9)}); } catch {}
}

async function cmdPunishmentList(ctx, uid) {
  if (!await isAdmin(uid)) return ctx.send('❌');
  const now = Date.now();
  const list = [];
  for (const [tid,p] of activePunishments) {
    if (p.until<=now) { activePunishments.delete(tid); continue; }
    list.push(`👤 ${await getName(tid)} (${tid}) — ${fmtTime(p.until-now)} | ${p.reason}`);
  }
  if (!list.length) return ctx.send('✅ Нет наказаний.');
  await ctx.send('🚫 АКТИВНЫЕ НАКАЗАНИЯ:\n\n'+list.join('\n'));
}

module.exports = { activePunishments, isIncomeBanned, getPunishmentInfo, cmdBlockIncome, cmdUnblockIncome, cmdPunishmentList };
