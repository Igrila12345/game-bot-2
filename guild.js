'use strict';

const config = require('../config');
const { getPlayer, getOrCreate, pool, isDeputy } = require('../database');
const { fmt, fmtTime, getName, vk } = require('../helpers');
const state = require('../state');

function setGlobals(g) {}

async function cmdGuildInfo(ctx, uid) {
  const p = await getOrCreate(uid);
  if (p.banned) return ctx.send('⛔');
  if (!p.guild_id) return ctx.send(`👥 Нет бригады.\nСоздать: «Создать бригаду [имя]» (${fmt(config.GUILD_COST)}💰)`);

  const gr = await pool.query('SELECT * FROM guilds WHERE id=$1',[p.guild_id]);
  if (!gr.rows[0]) { await pool.query('UPDATE players SET guild_id=NULL WHERE user_id=$1',[uid]); return ctx.send('❌ Нет.'); }
  const g = gr.rows[0];
  const mc = (await pool.query('SELECT COUNT(*) as c FROM players WHERE guild_id=$1',[g.id])).rows[0].c;
  const tw = (await pool.query('SELECT COALESCE(SUM(balance),0) as t FROM players WHERE guild_id=$1 AND banned=FALSE',[g.id])).rows[0].t;
  const treasury = Number(g.treasury);
  const guildBalance = Number(g.guild_balance || 0);
  const topM = await pool.query('SELECT user_id,balance FROM players WHERE guild_id=$1 AND banned=FALSE ORDER BY balance DESC LIMIT 5',[g.id]);
  const eq = await pool.query('SELECT COALESCE(SUM(drills+drills_enhanced+drills_diamond),0) as d,COALESCE(SUM(oil_rigs),0) as o FROM players WHERE guild_id=$1',[g.id]);

  const on = await getName(Number(g.owner_id));
  const dn = g.deputy_id ? await getName(Number(g.deputy_id)) : 'Нет';
  let mi = '';
  if (state.neutralMineController===p.guild_id && state.neutralMineControlEnd>Date.now()) mi=`\n🏰 Шахта! ${fmtTime(state.neutralMineControlEnd-Date.now())}`;

  const lines=[
    `👥 БРИГАДА «${g.name}»`,'',
    `👑 ${on} | 👤 Зам: ${dn} | 👥 ${mc} чел.`,'',
    `💰 Казна: ${fmt(treasury)}`,
    `📊 Собрано дохода: ${fmt(guildBalance)}`,
    `💰 Общее: ${fmt(treasury+guildBalance+Number(tw))}`,'',
    `⚙️ Буров: ${Number(eq.rows[0].d)} | 🛢️ Вышек: ${Number(eq.rows[0].o)}`,'',
    '🏆 ТОП-5:'
  ];
  for(let i=0;i<topM.rows.length;i++) lines.push(`${i+1}. ${await getName(Number(topM.rows[i].user_id))} — ${fmt(Number(topM.rows[i].balance))}💰`);
  if(mi) lines.push(mi);
  await ctx.send(lines.join('\n'));
}

async function cmdGuildTop(ctx) {
  const r = await pool.query(`
    SELECT g.id,g.name,g.treasury,g.guild_balance,g.owner_id,
      COUNT(p.user_id) as m,
      COALESCE(SUM(p.balance),0) as tb,
      COALESCE(SUM(p.drills+p.drills_enhanced+p.drills_diamond),0) as d,
      COALESCE(SUM(p.oil_rigs),0) as o
    FROM guilds g LEFT JOIN players p ON p.guild_id=g.id AND p.banned=FALSE
    GROUP BY g.id ORDER BY COALESCE(g.guild_balance,0) DESC LIMIT 10`);
  if(!r.rows.length) return ctx.send('Нет бригад.');
  const lines=['👑 ТОП-10 БРИГАД (по собранному доходу):',''];
  for(let i=0;i<r.rows.length;i++){
    const g=r.rows[i];
    const gb=Number(g.guild_balance||0);
    const emoji=['🥇','🥈','🥉'][i]||`${i+1}️⃣`;
    lines.push(`${emoji} ${g.name} — 📊 ${fmt(gb)} собрано | 👑 ${await getName(Number(g.owner_id))} | 👥${Number(g.m)}`);
  }
  await ctx.send(lines.join('\n'));
}

async function cmdCreateGuild(ctx, uid, name) {
  const p=await getOrCreate(uid);
  if(p.banned) return ctx.send('⛔');
  if(!name||name.length<2) return ctx.send('❌ «Создать бригаду [имя]»');
  if(p.guild_id) return ctx.send('❌ Уже в бригаде.');
  if(p.balance<config.GUILD_COST) return ctx.send(`❌ ${fmt(config.GUILD_COST)}💰`);
  try{
    const r=await pool.query('INSERT INTO guilds(name,owner_id) VALUES($1,$2) RETURNING id',[name,uid]);
    await pool.query('UPDATE players SET balance=balance-$1,guild_id=$2 WHERE user_id=$3',[config.GUILD_COST,r.rows[0].id,uid]);
    await ctx.send(`✅ Бригада «${name}»!\n💰 Топ по собранному доходу.\n👥 «Пригласить [ID]»`);
  }catch(e){if(e.code==='23505') return ctx.send('❌ Есть.');throw e;}
}

async function cmdTreasury(ctx, uid, amt) {
  const p=await getOrCreate(uid); if(p.banned) return ctx.send('⛔');
  const a=parseInt(amt); if(!a||a<=0) return ctx.send('❌ «В казну [сумма]»');
  if(!p.guild_id) return ctx.send('❌');
  if(p.balance<a) return ctx.send(`❌ ${fmt(p.balance)}`);
  await pool.query('UPDATE players SET balance=balance-$1 WHERE user_id=$2',[a,uid]);
  await pool.query('UPDATE guilds SET treasury=treasury+$1 WHERE id=$2',[a,p.guild_id]);
  const gr=await pool.query('SELECT name,treasury FROM guilds WHERE id=$1',[p.guild_id]);
  await ctx.send(`💰 +${fmt(a)} → «${gr.rows[0].name}» | Казна:${fmt(Number(gr.rows[0].treasury))}`);
}

async function cmdTakeFromTreasury(ctx, uid, amt) {
  const p=await getOrCreate(uid); if(p.banned) return ctx.send('⛔');
  const a=parseInt(amt); if(!a||a<=0) return ctx.send('❌ «Из казны [сумма]»');
  if(!p.guild_id) return ctx.send('❌');
  const gr=await pool.query('SELECT * FROM guilds WHERE id=$1',[p.guild_id]);
  if(!gr.rows[0]) return ctx.send('❌');
  if(Number(gr.rows[0].owner_id)!==uid&&!(await isDeputy(uid,p.guild_id))) return ctx.send('❌ Глава/зам.');
  if(Number(gr.rows[0].treasury)<a) return ctx.send(`❌ ${fmt(Number(gr.rows[0].treasury))}`);
  await pool.query('UPDATE guilds SET treasury=treasury-$1 WHERE id=$2',[a,p.guild_id]);
  await pool.query('UPDATE players SET balance=balance+$1 WHERE user_id=$2',[a,uid]);
  await ctx.send(`💰 -${fmt(a)} из казны.`);
}

async function cmdSetDeputy(ctx, uid, tid) {
  const p=await getOrCreate(uid); if(p.banned) return ctx.send('⛔');
  const t=parseInt(tid); if(!t) return ctx.send('❌ «Зам [ID]»');
  if(!p.guild_id) return ctx.send('❌');
  const gr=await pool.query('SELECT * FROM guilds WHERE id=$1',[p.guild_id]);
  if(Number(gr.rows[0].owner_id)!==uid) return ctx.send('❌ Глава.');
  const tp=await getPlayer(t); if(!tp||tp.guild_id!==p.guild_id) return ctx.send('❌');
  await pool.query('UPDATE guilds SET deputy_id=$1 WHERE id=$2',[t,p.guild_id]);
  await ctx.send(`✅ ${await getName(t)} — зам!`);
}

async function cmdRemoveDeputy(ctx, uid) {
  const p=await getOrCreate(uid); if(p.banned) return ctx.send('⛔');
  if(!p.guild_id) return ctx.send('❌');
  const gr=await pool.query('SELECT * FROM guilds WHERE id=$1',[p.guild_id]);
  if(Number(gr.rows[0].owner_id)!==uid) return ctx.send('❌');
  if(!gr.rows[0].deputy_id) return ctx.send('❌ Нет.');
  await pool.query('UPDATE guilds SET deputy_id=NULL WHERE id=$1',[p.guild_id]);
  await ctx.send(`✅ ${await getName(Number(gr.rows[0].deputy_id))} снят.`);
}

async function cmdInvite(ctx, uid, tid) {
  const p=await getOrCreate(uid); if(p.banned) return ctx.send('⛔');
  if(!tid||isNaN(tid)) return ctx.send('❌ «Пригласить [ID]»');
  if(!p.guild_id) return ctx.send('❌');
  const gr=await pool.query('SELECT * FROM guilds WHERE id=$1',[p.guild_id]);
  if(Number(gr.rows[0].owner_id)!==uid&&!(await isDeputy(uid,p.guild_id))) return ctx.send('❌');
  await pool.query('INSERT INTO guild_invites VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET guild_id=$2',[tid,p.guild_id]);
  try{await vk.api.messages.send({user_id:tid,message:`👥 Приглашение в «${gr.rows[0].name}»!\n«Принять приглашение»`,random_id:Math.floor(Math.random()*1e9)});}catch{}
  await ctx.send(`✅ → #${tid}`);
}

async function cmdAcceptInvite(ctx, uid) {
  const inv=await pool.query('SELECT * FROM guild_invites WHERE user_id=$1',[uid]);
  if(!inv.rows.length) return ctx.send('❌ Нет.');
  const p=await getOrCreate(uid); if(p.banned) return ctx.send('⛔');
  if(p.guild_id) return ctx.send('❌ Уже в бригаде.');
  const gr=await pool.query('SELECT name FROM guilds WHERE id=$1',[inv.rows[0].guild_id]);
  if(!gr.rows.length){await pool.query('DELETE FROM guild_invites WHERE user_id=$1',[uid]);return ctx.send('❌');}
  await pool.query('UPDATE players SET guild_id=$1 WHERE user_id=$2',[inv.rows[0].guild_id,uid]);
  await pool.query('DELETE FROM guild_invites WHERE user_id=$1',[uid]);
  await ctx.send(`✅ В «${gr.rows[0].name}»!`);
}

async function cmdLeaveGuild(ctx, uid) {
  const p=await getOrCreate(uid); if(p.banned) return ctx.send('⛔');
  if(!p.guild_id) return ctx.send('❌');
  const gr=await pool.query('SELECT * FROM guilds WHERE id=$1',[p.guild_id]);
  if(Number(gr.rows[0].owner_id)===uid) return ctx.send('❌ Глава.');
  await pool.query('UPDATE players SET guild_id=NULL WHERE user_id=$1',[uid]);
  await ctx.send('✅ Покинул.');
}

async function cmdTransferLeadership(ctx, uid, tid) {
  const p=await getOrCreate(uid); if(p.banned) return ctx.send('⛔');
  if(!tid||isNaN(tid)) return ctx.send('❌ «Передать лидерство [ID]»');
  if(!p.guild_id) return ctx.send('❌');
  const gr=await pool.query('SELECT * FROM guilds WHERE id=$1',[p.guild_id]);
  if(Number(gr.rows[0].owner_id)!==uid) return ctx.send('❌');
  const t=await getPlayer(tid); if(!t||t.guild_id!==p.guild_id) return ctx.send('❌');
  await pool.query('UPDATE guilds SET owner_id=$1 WHERE id=$2',[tid,p.guild_id]);
  await ctx.send(`👑 → ${await getName(tid)}`);
}

async function cmdDisbandGuild(ctx, uid) {
  const p=await getOrCreate(uid); if(p.banned) return ctx.send('⛔');
  if(!p.guild_id) return ctx.send('❌');
  const gr=await pool.query('SELECT * FROM guilds WHERE id=$1',[p.guild_id]);
  if(Number(gr.rows[0].owner_id)!==uid) return ctx.send('❌');
  const tr=Number(gr.rows[0].treasury),nm=gr.rows[0].name;
  await pool.query('UPDATE players SET guild_id=NULL WHERE guild_id=$1',[p.guild_id]);
  await pool.query('DELETE FROM guild_invites WHERE guild_id=$1;DELETE FROM guilds WHERE id=$1',[p.guild_id]);
  if(tr>0) await pool.query('UPDATE players SET balance=balance+$1 WHERE user_id=$2',[tr,uid]);
  await ctx.send(`💔 «${nm}» расформирована.${tr>0?`\n💰 +${fmt(tr)}`:''}`);
}

async function cmdTransfer(ctx, uid, args) {
  const p=await getOrCreate(uid); if(p.banned) return ctx.send('⛔');
  const pa=args.trim().split(/\s+/);const tid=parseInt(pa[0]),amt=parseInt(pa[1]);
  if(!tid||!amt||amt<config.TRANSFER_MIN) return ctx.send(`❌ «Перевести [ID] [сумма]» (мин.${config.TRANSFER_MIN})`);
  if(!p.guild_id) return ctx.send('❌ Только в бригаде.');
  const t=await getPlayer(tid); if(!t||t.guild_id!==p.guild_id) return ctx.send('❌');
  if(p.balance<amt) return ctx.send(`❌ ${fmt(p.balance)}`);
  await pool.query('UPDATE players SET balance=balance-$1 WHERE user_id=$2',[amt,uid]);
  await pool.query('UPDATE players SET balance=balance+$1 WHERE user_id=$2',[amt,tid]);
  await ctx.send(`✅ ${fmt(amt)}💰 → ${await getName(tid)}`);
}

module.exports = { setGlobals, cmdGuildInfo, cmdGuildTop, cmdCreateGuild, cmdTreasury, cmdTakeFromTreasury, cmdSetDeputy, cmdRemoveDeputy, cmdInvite, cmdAcceptInvite, cmdLeaveGuild, cmdTransferLeadership, cmdDisbandGuild, cmdTransfer };
