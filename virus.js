'use strict';

const config = require('../config');
const { pool, getPlayer, getOrCreate } = require('../database');
const { fmtTime, getName, vk } = require('../helpers');
const state = require('../state');

function setGlobals(g) {}

async function cmdVirusStatus(ctx, uid) {
  const p = await getOrCreate(uid);
  const now = Date.now();
  let s = '✅ Здоров';
  if (p.vaccine_end > now) s = `💉 Защищён (${fmtTime(p.vaccine_end-now)})`;
  else if (p.virus===1 && p.virus_end > now) s = `🤒 Болен (${fmtTime(p.virus_end-now)})`;
  if (state.globalEpidemic) s += '\n⚠️ Эпидемия!';
  await ctx.send(`🦠 ${s}`);
}

async function cmdEpidemicInfo(ctx) {
  if (!state.globalEpidemic) return ctx.send('✅ Нет.');
  await ctx.send(`🦠 Эпидемия! Осталось: ${fmtTime(state.epidemicEndTime-Date.now())}`);
}

async function cmdHeal(ctx, uid, tidStr) {
  const p = await getOrCreate(uid);
  if (p.banned) return ctx.send('⛔');
  let tid = uid, cost = config.MEDKIT_COST;
  if (tidStr) {
    if (p.player_class!=='врач') return ctx.send('❌ Только врач.');
    tid = parseInt(tidStr); cost = Math.floor(config.MEDKIT_COST/2);
  }
  const t = await getPlayer(tid);
  if (!t) return ctx.send('❌');
  if (t.virus !== 1) return ctx.send('✅ Здоров.');
  if (p.balance < cost) return ctx.send(`❌ ${cost}💰`);
  await pool.query('UPDATE players SET balance=balance-$1 WHERE user_id=$2',[cost,uid]);
  await pool.query('UPDATE players SET virus=0,virus_end=0,stamina=LEAST(stamina+30,100) WHERE user_id=$1',[tid]);
  await ctx.send(`🏥 Вылечен!`);
}

async function cmdVaccinate(ctx, uid) {
  const p = await getOrCreate(uid);
  if (p.banned) return ctx.send('⛔');
  if (p.vaccine_end > Date.now()) return ctx.send('💉 Уже.');
  if (p.balance < config.VACCINE_COST) return ctx.send(`❌ ${config.VACCINE_COST}💰`);
  await pool.query('UPDATE players SET balance=balance-$1,virus=2,vaccine_end=$2,virus_end=0 WHERE user_id=$3',[config.VACCINE_COST,Date.now()+config.VACCINE_DURATION,uid]);
  await ctx.send('💉 24ч защиты!');
}

async function cmdAdminVirusStart(ctx) {
  if (state.globalEpidemic) return ctx.send('Уже.');
  state.globalEpidemic = true;
  state.epidemicEndTime = Date.now() + config.EPIDEMIC_DURATION;
  const players = await pool.query('SELECT user_id FROM players WHERE banned=FALSE');
  for (const pl of players.rows) {
    try { await vk.api.messages.send({user_id:pl.user_id,message:'🦠 ЭПИДЕМИЯ! -50% доход. «Лечить»',random_id:Math.floor(Math.random()*1e9)}); } catch {}
  }
  await ctx.send('🦠 Эпидемия!');
}

async function cmdAdminVirusStop(ctx) {
  state.globalEpidemic = false;
  state.epidemicEndTime = 0;
  await pool.query('UPDATE players SET virus=0,virus_end=0');
  await ctx.send('✅ Остановлена.');
}

async function cmdAdminHeal(ctx, tid) {
  await pool.query('UPDATE players SET virus=0,virus_end=0,stamina=LEAST(stamina+30,100) WHERE user_id=$1',[parseInt(tid)]);
  await ctx.send('✅');
}

async function cmdAdminVaccinate(ctx, tid) {
  await pool.query('UPDATE players SET virus=2,vaccine_end=$1,virus_end=0 WHERE user_id=$2',[Date.now()+config.VACCINE_DURATION,parseInt(tid)]);
  await ctx.send('✅');
}

async function cmdAdminInfect(ctx, tid) {
  await pool.query('UPDATE players SET virus=1,virus_end=$1,stamina=GREATEST(0,stamina-20) WHERE user_id=$2 AND vaccine_end<=$3',[Date.now()+config.EPIDEMIC_DURATION,parseInt(tid),Date.now()]);
  await ctx.send('🦠 Заражён.');
}

function startEpidemicChecker(s) {
  setInterval(() => {
    if (!s.globalEpidemic && Math.random() < config.EPIDEMIC_CHANCE) {
      s.globalEpidemic = true;
      s.epidemicEndTime = Date.now() + config.EPIDEMIC_DURATION;
    }
    if (s.globalEpidemic && s.epidemicEndTime <= Date.now()) s.globalEpidemic = false;
  }, config.EPIDEMIC_CHECK_INTERVAL);
}

module.exports = { setGlobals, cmdVirusStatus, cmdEpidemicInfo, cmdHeal, cmdVaccinate, cmdAdminVirusStart, cmdAdminVirusStop, cmdAdminHeal, cmdAdminVaccinate, cmdAdminInfect, startEpidemicChecker };
