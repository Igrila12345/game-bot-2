'use strict';

const { VK } = require('vk-io');
const config = require('./config');
const vk = new VK({ token: config.TOKEN });

function fmt(num) {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString('ru-RU');
}

async function getName(uid) {
  try {
    const r = await vk.api.users.get({ user_ids: String(uid) });
    if (r && r[0]) return `${r[0].first_name} ${r[0].last_name}`;
    return `Игрок #${uid}`;
  } catch { return `Игрок #${uid}`; }
}

function fmtTime(ms) {
  if (ms <= 0) return '0 сек';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h} ч ${m} мин`;
  if (m > 0) return `${m} мин ${s} сек`;
  return `${s} сек`;
}

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function getMoscowDayOfWeek() {
  const msk = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  return msk.getDay();
}

function getMoscowDayStart() {
  const now = new Date();
  const msk = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  msk.setHours(0, 0, 0, 0);
  return msk.getTime() + (now.getTime() - new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' })).getTime());
}

function updateVirusStatus(p) {
  const now = Date.now();
  if (p.vaccine_end > 0 && p.vaccine_end <= now) { p.vaccine_end = 0; if (p.virus === 2) p.virus = 0; }
  if (p.virus === 1 && p.virus_end > 0 && p.virus_end <= now) { p.virus = 0; p.virus_end = 0; }
  return p;
}

function getClassBonus(p, type) {
  if (!p.player_class) return 0;
  const b = { 'шахтёр':{mine:0.20}, 'инженер':{drill:0.25,craft:0.15}, 'нефтяник':{oil:0.30}, 'врач':{heal:0.50}, 'бригадир':{guild:0.10} };
  return (b[p.player_class] && b[p.player_class][type]) || 0;
}

async function isAdmin(uid) {
  if (uid === config.ADMIN_ID) return true;
  const { getPlayer } = require('./database');
  const p = await getPlayer(uid);
  return p && p.is_admin;
}

function isProtected(p) {
  return p.pickaxe_lvl < config.PROTECTION_LEVEL || p.balance < config.PROTECTION_BALANCE;
}

module.exports = { vk, fmt, getName, fmtTime, randInt, getMoscowDayOfWeek, getMoscowDayStart, updateVirusStatus, getClassBonus, isAdmin, isProtected };
