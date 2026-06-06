'use strict';

const { getPlayer, pool, calcPassiveInfo } = require('../database');
const { fmt, fmtTime, getName } = require('../helpers');
const { PICKAXE } = require('../game-data');
const config = require('../config');

globalThis.infoAccess = globalThis.infoAccess || new Map();

function setGlobals(g) {}

async function cmdInfo(ctx, uid, targetId) {
  if (!globalThis.infoAccess.get(uid) || globalThis.infoAccess.get(uid) <= Date.now()) {
    globalThis.infoAccess.delete(uid);
    return ctx.send('❌ Нет доступа к «Инфа».');
  }

  const p = await getPlayer(targetId);
  if (!p) return ctx.send('❌ Нет.');
  const pick = PICKAXE.find(l=>l.level===p.pickaxe_lvl)||PICKAXE[0];
  const info = await calcPassiveInfo(targetId);
  let gn = 'Нет';
  if (p.guild_id) { const gr = await pool.query('SELECT name FROM guilds WHERE id=$1',[p.guild_id]); if (gr.rows[0]) gn = gr.rows[0].name; }

  const lines = [
    `🔍 ${await getName(targetId)} (${targetId})`,
    `💰 ${fmt(p.balance)} | ❤️ ${p.stamina}/${config.MAX_STAMINA}`,
    `⛏️ Ур.${p.pickaxe_lvl}(+${pick.bonus}%) | ⚔️ ${p.battle_rating}`,
    `👤 ${p.player_class||'нет'} | 👥 ${gn}`,
    `⚙️ Буры:${info.totalDrills} | 🛢️ Вышки:${info.totalRigs}`,
    `📊 Работ:${p.work_count} | ⭐Крафт:${p.craft_level}`,
  ];
  if (p.jail_until > Date.now()) lines.push(`🚨 Тюрьма ${fmtTime(p.jail_until-Date.now())}`);
  if (p.has_roof) lines.push('🛡️ Крыша');
  await ctx.send(lines.join('\n'));
}

async function cmdInfoGuild(ctx, uid, guildName) {
  if (!globalThis.infoAccess.get(uid) || globalThis.infoAccess.get(uid) <= Date.now()) {
    globalThis.infoAccess.delete(uid);
    return ctx.send('❌ Нет доступа.');
  }
  const gr = await pool.query('SELECT * FROM guilds WHERE name=$1',[guildName]);
  if (!gr.rows.length) return ctx.send('❌ Нет.');
  const g = gr.rows[0];
  const mc = (await pool.query('SELECT COUNT(*) as c FROM players WHERE guild_id=$1',[g.id])).rows[0].c;
  const tw = (await pool.query('SELECT COALESCE(SUM(balance),0) as t FROM players WHERE guild_id=$1 AND banned=FALSE',[g.id])).rows[0].t;
  const total = Number(g.treasury) + Number(tw);
  const eq = await pool.query('SELECT COALESCE(SUM(drills+drills_enhanced+drills_diamond),0) as d,COALESCE(SUM(oil_rigs),0) as o FROM players WHERE guild_id=$1',[g.id]);

  await ctx.send(
    `🔍 БРИГАДА «${g.name}»\n` +
    `👑 ${await getName(Number(g.owner_id))} | 👥 ${mc} чел.\n` +
    `💰 Казна:${fmt(Number(g.treasury))} | Баланс:${fmt(Number(tw))} | Общее:${fmt(total)}\n` +
    `⚙️ Буров:${Number(eq.rows[0].d)} | 🛢️ Вышек:${Number(eq.rows[0].o)}`
  );
}

module.exports = { setGlobals, cmdInfo, cmdInfoGuild };
