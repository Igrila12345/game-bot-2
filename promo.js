'use strict';

const { getOrCreate, pool } = require('../database');
const { fmt } = require('../helpers');

function setGlobals(g) {}

async function cmdCreatePromo(ctx, uid, args) {
  const p = args.trim().split(/\s+/);
  if (p.length<3) return ctx.send('❌ !промо [код] [тип] [кол-во] [макс.активаций]');
  const code=p[0].toUpperCase(), type=p[1], amount=parseInt(p[2]), max=parseInt(p[3])||1;
  if (!['coins','drill','oil','stamina'].includes(type)) return ctx.send('❌ Типы: coins,drill,oil,stamina');
  try{
    await pool.query('INSERT INTO promo_codes(code,reward_type,reward_amount,max_uses,created_by) VALUES($1,$2,$3,$4,$5)',[code,type,amount,max,uid]);
    await ctx.send(`✅ ${code}: ${amount} ${type} [${max}]`);
  }catch(e){if(e.code==='23505') return ctx.send('❌ Есть.');throw e;}
}

async function cmdDeactivatePromo(ctx, code) {
  const r = await pool.query("UPDATE promo_codes SET active=FALSE WHERE code=$1 RETURNING code",[code.toUpperCase()]);
  if (!r.rows.length) return ctx.send('❌');
  await ctx.send(`✅ ${code.toUpperCase()} деактивирован.`);
}

async function cmdListPromos(ctx) {
  const r = await pool.query('SELECT * FROM promo_codes ORDER BY code');
  if (!r.rows.length) return ctx.send('Пусто.');
  await ctx.send(r.rows.map(p=>`${p.active?'✅':'❌'} ${p.code} — ${p.reward_amount} ${p.reward_type} [${p.uses}/${p.max_uses}]`).join('\n'));
}

async function cmdUsePromo(ctx, uid, code) {
  const p = await getOrCreate(uid);
  if (p.banned) return ctx.send('⛔');
  const cu = code.toUpperCase();
  const r = await pool.query('SELECT * FROM promo_codes WHERE code=$1',[cu]);
  if (!r.rows.length) return ctx.send('❌ Нет.');
  const pr = r.rows[0];
  if (!pr.active) return ctx.send('❌ Деактивирован.');
  if (pr.uses >= pr.max_uses) return ctx.send('❌ Исчерпан.');
  const used = await pool.query('SELECT 1 FROM promo_uses WHERE user_id=$1 AND code=$2',[uid,cu]);
  if (used.rows.length) return ctx.send('❌ Уже активировал.');

  await pool.query('UPDATE promo_codes SET uses=uses+1 WHERE code=$1',[cu]);
  await pool.query('INSERT INTO promo_uses(user_id,code) VALUES($1,$2)',[uid,cu]);

  const type=pr.reward_type, amount=Number(pr.reward_amount);
  if (type==='coins') { await pool.query('UPDATE players SET balance=balance+$1 WHERE user_id=$2',[amount,uid]); await ctx.send(`🎟️ +${fmt(amount)}💰`); }
  else if (type==='drill') { await pool.query('UPDATE players SET drills=drills+$1 WHERE user_id=$2',[amount,uid]); await ctx.send(`🎟️ +${amount} бур(ов)`); }
  else if (type==='oil') { await pool.query('UPDATE players SET oil_rigs=oil_rigs+$1 WHERE user_id=$2',[amount,uid]); await ctx.send(`🎟️ +${amount} вышек`); }
  else if (type==='stamina') { const ns=Math.min(100,p.stamina+amount); await pool.query('UPDATE players SET stamina=$1 WHERE user_id=$2',[ns,uid]); await ctx.send(`🎟️ +${amount} стамины`); }
}

module.exports = { setGlobals, cmdCreatePromo, cmdDeactivatePromo, cmdListPromos, cmdUsePromo };
