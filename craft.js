'use strict';

const { getOrCreate, getItemQty, removeItem, addItem, pool } = require('../database');
const { fmt, getClassBonus } = require('../helpers');
const { CRAFT_RECIPES, CRAFT_RESOURCES } = require('../game-data');

function setGlobals(g) {}

async function cmdCraft(ctx, uid, craftName) {
  const p = await getOrCreate(uid);
  if (p.banned) return ctx.send('⛔');
  if (!craftName) return ctx.send('❌ «Крафт [предмет]». Рецепты: «Рецепты»');

  const n = craftName.toLowerCase().trim();
  let key = null;
  if (n.includes('пластин')) key = 'пластина';
  else if (n.includes('обычный бур')||n==='обычный_бур') key='бур_обычный';
  else if (n.includes('усиленный')) key='бур_усиленный';
  else if (n.includes('алмазный')) key='бур_алмазный';
  else if (n.includes('вышка')) key='вышка_нефтяная';
  else if (n==='шестерня'||n==='шестерню') key='шестерня_крафт';
  else if (n.includes('наконечник')) key='алмазный_наконечник_крафт';
  else if (n.includes('магнит')) key='магнит_крафт';

  if (!key) return ctx.send('❌ Рецепт не найден. «Рецепты»');
  const recipe = CRAFT_RECIPES[key];

  for (const [item,qty] of Object.entries(recipe.ingredients)) {
    const pq = await getItemQty(uid,item);
    if (pq < qty) return ctx.send(`❌ ${item}: ${pq}/${qty}`);
  }
  if (p.balance < recipe.coins_cost) return ctx.send(`❌ ${fmt(recipe.coins_cost)}💰. Баланс: ${fmt(p.balance)}`);

  for (const [item,qty] of Object.entries(recipe.ingredients)) await removeItem(uid,item,qty);
  await pool.query('UPDATE players SET balance=balance-$1 WHERE user_id=$2',[recipe.coins_cost,uid]);

  let resultAmount = recipe.result_amount;
  if (getClassBonus(p,'craft') && Math.random() < 0.15) resultAmount++;

  if (recipe.result_type==='drill') await pool.query('UPDATE players SET drills=drills+$1 WHERE user_id=$2',[resultAmount,uid]);
  else if (recipe.result_type==='drill_enhanced') await pool.query('UPDATE players SET drills_enhanced=drills_enhanced+$1 WHERE user_id=$2',[resultAmount,uid]);
  else if (recipe.result_type==='drill_diamond') await pool.query('UPDATE players SET drills_diamond=drills_diamond+$1 WHERE user_id=$2',[resultAmount,uid]);
  else if (recipe.result_type==='oil_rig') await pool.query('UPDATE players SET oil_rigs=oil_rigs+$1 WHERE user_id=$2',[resultAmount,uid]);
  else await addItem(uid,recipe.result_item,resultAmount);

  const newCL = Math.max(p.craft_level, p.craft_level + Math.floor(recipe.coins_cost/1000));
  await pool.query('UPDATE players SET craft_level=$1 WHERE user_id=$2',[newCL,uid]);
  await ctx.send(`🔨 ${recipe.emoji} ${recipe.name} ×${resultAmount}!`);
}

async function cmdRecipes(ctx) {
  const lines = ['📋 РЕЦЕПТЫ:',''];
  for (const [k,r] of Object.entries(CRAFT_RECIPES)) {
    const ing = Object.entries(r.ingredients).map(([i,q])=>`${q}×${i}`).join(' + ');
    lines.push(`${r.emoji} ${r.name}: ${ing} + ${fmt(r.coins_cost)}💰`);
  }
  await ctx.send(lines.join('\n'));
}

async function cmdParts(ctx, uid) {
  const lines = ['🔩 Детали:'];
  for (const [k,v] of Object.entries(CRAFT_RESOURCES)) {
    const q = await getItemQty(uid,k);
    lines.push(`${v.emoji} ${v.name}: ${q}`);
  }
  await ctx.send(lines.join('\n'));
}

module.exports = { setGlobals, cmdCraft, cmdRecipes, cmdParts };
