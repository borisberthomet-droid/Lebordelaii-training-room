import React, { useState, useEffect, useCallback, useMemo } from 'react';

// ---------- Constantes poker ----------
const RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];
const SUITS = ['s','h','d','c'];
const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };
// coeur = rouge, carreau = orange clair (distincts), pique = blanc, trefle = vert
const SUIT_COLOR = { s: '#ECEEF1', c: '#6FCF97', h: '#E0645A', d: '#4FA8E0' };
const MOMENT_OPTIONS = ['100% restants', '75% restants', '50% restants', '25% restants', '18% restants', '16% restants', 'Proche bulle', '10% restants', '5% restants', '3 tables', '2 tables', 'Table finale'];
const selectStyle = { background: '#211F1D', border: '1px solid #302D2A', color: '#ECEEF1', borderRadius: 6, padding: '5px 6px', fontSize: 12 };
const ORANGE = '#E8A83C';
const ORANGE_RGB = '232,168,60';

// positions dans l'ordre horaire en partant du bouton (offset 0 = BTN)
const POSITIONS_BY_COUNT = {
  2: ['BTN/SB', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'UTG'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
  7: ['BTN', 'SB', 'BB', 'UTG', 'UTG1', 'HJ', 'CO'],
  8: ['BTN', 'SB', 'BB', 'UTG', 'UTG1', 'LJ', 'HJ', 'CO'],
  9: ['BTN', 'SB', 'BB', 'UTG', 'UTG1', 'UTG2', 'LJ', 'HJ', 'CO'],
};

const PROFILE_OPTIONS = ['ELITE', 'REG AGGRO', 'AVG REG', 'REG TIGHT', 'RECREA', 'BALEINE', 'GTO'];
const PROFILE_COLORS = {
  'ELITE': '#E0645A', 'REG AGGRO': '#E8C547', 'AVG REG': '#9C9691', 'REG TIGHT': '#4FA8E0',
  'RECREA': '#2F6B4F', 'BALEINE': '#39FF6A', 'GTO': '#FFFFFF',
};

function generateSeats(n) {
  const labels = POSITIONS_BY_COUNT[n] || POSITIONS_BY_COUNT[6];
  return labels.map((position, i) => ({ position, stackBB: '', action: '', bounty: '', role: null, profile: '', dealer: i === 0 }));
}

function seatCoords(i, n) {
  const angle = Math.PI / 2 + (i * 2 * Math.PI / n);
  const rx = 43, ry = 41;
  return { left: 50 + rx * Math.cos(angle), top: 50 + ry * Math.sin(angle) };
}

function getSeatPos(i, n) {
  const c = seatCoords(i, n);
  return { left: `${c.left}%`, top: `${c.top}%` };
}

// position d'un jeton de mise, interpolée entre le siège et le centre de la table
// Anneau à rayon FIXE (indépendant de la distance du siège) : garantit que le jeton
// reste toujours hors de la zone du board (max 5 cartes), quel que soit le nombre de joueurs.
function getChipPos(i, n) {
  const angle = Math.PI / 2 + (i * 2 * Math.PI / n);
  const rx = 28, ry = 26;
  return { left: `${50 + rx * Math.cos(angle)}%`, top: `${50 + ry * Math.sin(angle)}%` };
}

function classId(i, j) {
  if (i === j) return RANKS[i] + RANKS[i];
  if (i < j) return RANKS[i] + RANKS[j] + 's';
  return RANKS[j] + RANKS[i] + 'o';
}

function combosForClass(cls) {
  if (cls.length === 2) {
    const r = cls[0];
    const combos = [];
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) combos.push([r + SUITS[a], r + SUITS[b]]);
    return combos;
  }
  const r1 = cls[0], r2 = cls[1], type = cls[2];
  const combos = [];
  if (type === 's') {
    for (const s of SUITS) combos.push([r1 + s, r2 + s]);
  } else {
    for (const s1 of SUITS) for (const s2 of SUITS) if (s1 !== s2) combos.push([r1 + s1, r2 + s2]);
  }
  return combos;
}

function comboKey(pair) { return pair.slice().sort().join(''); }

const CLASS_COMBOS_CACHE = {};
function getClassCombos(cls) {
  if (!CLASS_COMBOS_CACHE[cls]) CLASS_COMBOS_CACHE[cls] = combosForClass(cls).map(p => ({ pair: p, key: comboKey(p) }));
  return CLASS_COMBOS_CACHE[cls];
}

const ALL_CLASSES = [];
for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) ALL_CLASSES.push(classId(i, j));

function parseClass(cls) {
  if (cls.length === 2) { const idx = RANKS.indexOf(cls[0]); return { i: idx, j: idx, type: 'pair' }; }
  const r1 = cls[0], r2 = cls[1], type = cls[2];
  const i1 = RANKS.indexOf(r1), i2 = RANKS.indexOf(r2);
  if (type === 's') return { i: i1, j: i2, type: 'suited' };
  return { i: i2, j: i1, type: 'offsuit' };
}

function getLineClasses(cls) {
  const { i, j, type } = parseClass(cls);
  if (type === 'pair') return [cls];
  if (type === 'suited') { const out = []; for (let j2 = i + 1; j2 < 13; j2++) out.push(classId(i, j2)); return out; }
  const out = []; for (let i2 = j + 1; i2 < 13; i2++) out.push(classId(i2, j)); return out;
}

// ---------- Parseur de range collée ----------
function expandPlus(token) {
  const m = token.match(/^([2-9TJQKA])([2-9TJQKA])?([so])?\+$/);
  if (!m) return null;
  const [, r1, r2, suited] = m;
  if (!r2) {
    const idx = RANKS.indexOf(r1);
    const out = [];
    for (let k = 0; k <= idx; k++) out.push(RANKS[k] + RANKS[k]);
    return out;
  }
  const i1 = RANKS.indexOf(r1), i2 = RANKS.indexOf(r2);
  const hi = Math.min(i1, i2), lo0 = Math.max(i1, i2);
  const out = [];
  for (let k = lo0; k > hi; k--) out.push(RANKS[hi] + RANKS[k] + suited);
  return out;
}

function isComboToken(tok) {
  return /^[2-9TJQKA][cdhs][2-9TJQKA][cdhs]$/.test(tok);
}

function parsePastedRange(text) {
  const comboWeights = {};
  const parts = text.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    const rawTok = part.slice(0, idx).trim();
    const rawW = part.slice(idx + 1).trim();
    let w = parseFloat(rawW);
    if (isNaN(w)) continue;
    w = Math.max(0, Math.min(1, w));
    w = Math.round(w * 10000) / 10000;
    if (w <= 0) continue;
    if (rawTok.endsWith('+')) {
      const expanded = expandPlus(rawTok);
      if (expanded) expanded.forEach(cls => { getClassCombos(cls).forEach(({ key }) => { comboWeights[key] = w; }); });
      continue;
    }
    if (isComboToken(rawTok)) {
      const key = comboKey([rawTok.slice(0, 2), rawTok.slice(2, 4)]);
      comboWeights[key] = w;
      continue;
    }
    const cleaned = rawTok.replace(/\s/g, '');
    if (ALL_CLASSES.includes(cleaned)) getClassCombos(cleaned).forEach(({ key }) => { comboWeights[key] = w; });
  }
  return comboWeights;
}

// ---------- Parseur de Hand History Winamax ----------

// Construit la séquence complète de la main avec suivi précis des jetons : pour chaque action,
// combien chaque joueur a en stack, combien il y a dans le pot, et le board visible à ce moment.
// Extrait le stack et le KO depuis le contenu entre parenthèses d'une ligne "Seat N: nom (...)",
// en tolérant les séparateurs de milliers (espace normal ou insécable) que Winamax utilise sur les gros stacks.
// Isole la section d'en-tête (avant la première "*** ... ***") : c'est là, et seulement là,
// que se trouvent les vraies lignes "Seat N: nom (stack, bounty)". Le résumé final peut contenir
// des lignes "Seat N: nom (big blind) showed..." qui matchent le même motif par accident.
function getSeatHeaderSection(text) {
  const idx = text.indexOf('***');
  return idx === -1 ? text : text.slice(0, idx);
}

function parseSeatParenthetical(raw) {
  const commaIdx = raw.indexOf(',');
  const stackPart = commaIdx === -1 ? raw : raw.slice(0, commaIdx);
  const bountyPart = commaIdx === -1 ? '' : raw.slice(commaIdx + 1);
  const stack = parseInt(stackPart.replace(/[^\d]/g, ''), 10);
  const bountyMatch = bountyPart.match(/(\d+(?:[.,]\d+)?)\s*€/);
  const bounty = bountyMatch ? parseFloat(bountyMatch[1].replace(',', '.')) : null;
  return { stack, bounty };
}

function buildHHReplay(text) {
  const result = { initialStacks: {}, initialPot: 0, initialStreetCommit: {}, bb: null, steps: [] };
  try {
    const mBlinds = text.match(/\((\d+)\/(\d+)\/(\d+)\)/) || text.match(/\((\d+)\/(\d+)\)/);
    let sb, bb;
    if (mBlinds) {
      if (mBlinds.length === 4) { sb = parseInt(mBlinds[2], 10); bb = parseInt(mBlinds[3], 10); }
      else { sb = parseInt(mBlinds[1], 10); bb = parseInt(mBlinds[2], 10); }
    }
    result.bb = bb || null;

    const seatLines = [...getSeatHeaderSection(text).matchAll(/Seat (\d+): (.+?) \(([^)]+)\)/g)];
    const stacks = {};
    seatLines.forEach(m => { stacks[m[2].trim()] = parseSeatParenthetical(m[3]).stack; });

    const anteSection = text.split('*** ANTE/BLINDS ***')[1] || '';
    const anteBlock = anteSection.split('*** PRE-FLOP ***')[0];
    let pot = 0;
    const streetCommit = {};
    anteBlock.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
      let m;
      if ((m = line.match(/^(.+?) posts ante (\d+)/))) { stacks[m[1]] -= +m[2]; pot += +m[2]; }
      else if ((m = line.match(/^(.+?) posts small blind (\d+)/))) { stacks[m[1]] -= +m[2]; pot += +m[2]; streetCommit[m[1]] = +m[2]; }
      else if ((m = line.match(/^(.+?) posts big blind (\d+)/))) { stacks[m[1]] -= +m[2]; pot += +m[2]; streetCommit[m[1]] = +m[2]; }
    });
    result.initialStacks = { ...stacks };
    result.initialPot = pot;
    result.initialStreetCommit = { ...streetCommit };

    let board = [];
    const streets = text.split(/\*\*\* (PRE-FLOP|FLOP|TURN|RIVER) \*\*\*/);
    for (let i = 1; i < streets.length; i += 2) {
      const streetName = streets[i];
      const content = streets[i + 1] || '';
      const localCommit = streetName === 'PRE-FLOP' ? { ...streetCommit } : {};

      if (streetName === 'FLOP') { const mb = content.match(/^\s*\[([^\]]+)\]/); if (mb) board = [...mb[1].split(' ')]; }
      if (streetName === 'TURN') { const mb = content.match(/^\s*\[[^\]]+\]\[([^\]]+)\]/); if (mb) board = [...board, mb[1]]; }
      if (streetName === 'RIVER') { const mb = content.match(/^\s*\[[^\]]+\]\[([^\]]+)\]/); if (mb) board = [...board, mb[1]]; }

      const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (/^\*\*\*/.test(line) || /^Dealt to/.test(line) || /^\[/.test(line)) continue;
        let m, chipsIn = 0, label = null, player = null;
        if ((m = line.match(/^(.+?) folds$/))) { player = m[1]; label = 'Fold'; }
        else if ((m = line.match(/^(.+?) checks$/))) { player = m[1]; label = 'Check'; }
        else if ((m = line.match(/^(.+?) calls (\d+)(.*)$/))) { player = m[1]; chipsIn = +m[2]; localCommit[player] = (localCommit[player] || 0) + chipsIn; label = /all-in/.test(m[3]) ? `All-in ${chipsIn}` : `Call ${chipsIn}`; }
        else if ((m = line.match(/^(.+?) bets (\d+)(.*)$/))) { player = m[1]; chipsIn = +m[2]; localCommit[player] = (localCommit[player] || 0) + chipsIn; label = /all-in/.test(m[3]) ? `All-in ${chipsIn}` : `Bet ${chipsIn}`; }
        else if ((m = line.match(/^(.+?) raises \d+ to (\d+)(.*)$/))) { player = m[1]; const total = +m[2]; chipsIn = total - (localCommit[player] || 0); localCommit[player] = total; label = /all-in/.test(m[3]) ? `All-in ${total}` : `Raise to ${total}`; }
        else continue;
        if (!player) continue;
        stacks[player] = (stacks[player] || 0) - chipsIn;
        pot += chipsIn;
        result.steps.push({ street: streetName, player, label, chipsIn, potChips: pot, stacksChips: { ...stacks }, streetCommit: { ...localCommit }, board: [...board] });
      }
    }
  } catch (e) { console.error('Erreur buildHHReplay', e); }
  return result;
}

// Reconstruit board / ligne / action par siège tels qu'ils étaient au moment de l'étape cutoffIdx (incluse).
function applyCutoff(steps, cutoffIdx) {
  const upTo = steps.slice(0, cutoffIdx + 1);
  const last = upTo[upTo.length - 1];
  const board = last ? last.board : [];
  const currentStreet = last ? last.street : 'PRE-FLOP';
  const byStreet = {};
  upTo.forEach(e => { (byStreet[e.street] = byStreet[e.street] || []).push(`${e.player} ${e.label}`); });
  const ligne = ['PRE-FLOP', 'FLOP', 'TURN', 'RIVER'].filter(s => byStreet[s]).map(s => `${s}: ${byStreet[s].join(', ')}`).join(' | ');
  // le tag d'action par siège ne montre que la street en cours : il reste affiché tant que
  // l'action n'est pas revenue au joueur, et se réinitialise dès qu'une nouvelle street commence.
  const actionByPlayer = {};
  upTo.filter(e => e.street === currentStreet).forEach(e => { actionByPlayer[e.player] = e.label; });
  return { board, ligne, actionByPlayer };
}

// Extrait tous les montants € du buy-in Winamax (2 ou 3 parties selon le format), calcule le total,
// et enrichit avec le KO minimum vu à la table si seulement 2 montants sont donnés dans la HH.
function decomposeBuyIn(buyIn, seats) {
  if (!buyIn) return null;
  const nums = [...buyIn.matchAll(/(\d+(?:[.,]\d+)?)\s*€/g)].map(m => parseFloat(m[1].replace(',', '.')));
  if (!nums.length) return null;
  const total = +nums.reduce((a, b) => a + b, 0).toFixed(2);
  if (nums.length === 2) {
    const bounties = (seats || []).map(s => s.bounty ? parseFloat(s.bounty) : null).filter(b => b != null && !isNaN(b));
    if (bounties.length) {
      const ko = Math.min(...bounties);
      const [staking, rake] = nums;
      if (ko > 0 && ko < staking) {
        const prizePool = +(staking - ko).toFixed(2);
        return { total, parts: [ko, prizePool, rake] };
      }
    }
  }
  return { total, parts: nums };
}

function parseWinamaxHH(text) {
  const out = {};
  try {
    const mTourn = text.match(/Tournament\s+"([^"]+)"\s+buyIn:\s*([^\n]+?)\s+level:\s*(\d+)/);
    if (mTourn) { out.tournName = mTourn[1]; out.buyIn = mTourn[2].trim(); out.palier = `Niveau ${mTourn[3]}`; }

    const mBlinds = text.match(/\((\d+)\/(\d+)\/(\d+)\)/) || text.match(/\((\d+)\/(\d+)\)/);
    let ante = 0, sb, bb;
    if (mBlinds) {
      if (mBlinds.length === 4) { ante = parseInt(mBlinds[1], 10); sb = parseInt(mBlinds[2], 10); bb = parseInt(mBlinds[3], 10); }
      else { sb = parseInt(mBlinds[1], 10); bb = parseInt(mBlinds[2], 10); }
      out.blindLevel = ante ? `${sb}/${bb} (ante ${ante})` : `${sb}/${bb}`;
    }

    out.format = /bounty/i.test(text) ? 'PKO' : 'Classic';

    const mButton = text.match(/Seat #(\d+) is the button/);
    const buttonSeat = mButton ? parseInt(mButton[1], 10) : 1;

    const seatLines = [...getSeatHeaderSection(text).matchAll(/Seat (\d+): (.+?) \(([^)]+)\)/g)];
    const n = seatLines.length;

    const mDealt = text.match(/Dealt to (.+?) \[([^\]]+)\]/);
    const heroName = mDealt ? mDealt[1] : null;
    if (mDealt) { const cards = mDealt[2].split(' '); out.heroCard1 = cards[0]; out.heroCard2 = cards[1]; }

    const showdowns = [...text.matchAll(/(.+?) shows \[([^\]]+)\]/g)];
    let villainName = null;
    for (const sd of showdowns) { if (sd[1].trim() !== heroName) { villainName = sd[1].trim(); if (sd[2]) { const c = sd[2].split(' '); out.villainCard1 = c[0]; out.villainCard2 = c[1]; } break; } }

    let seatsBase = [];
    if (n > 0 && POSITIONS_BY_COUNT[n]) {
      const labels = POSITIONS_BY_COUNT[n];
      seatsBase = seatLines.map(m => {
        const seatNum = parseInt(m[1], 10), name = m[2].trim();
        const { stack, bounty } = parseSeatParenthetical(m[3]);
        const offset = ((seatNum - buttonSeat) % n + n) % n;
        const position = labels[offset];
        const stackBB = bb ? Math.round((stack / bb) * 10) / 10 : '';
        let role = null;
        if (heroName && name === heroName) role = 'hero';
        else if (villainName && name === villainName) role = 'villain';
        if (role === 'villain' && bounty) out.koValue = bounty + '€';
        return { position, stackBB, bounty: bounty ? bounty + '€' : '', role, profile: '', dealer: seatNum === buttonSeat, name };
      });
      out.numPlayers = n;
    }

    const mPot = text.match(/Total pot (\d+)/);
    if (mPot && bb) out.potTotal = Math.round((parseInt(mPot[1], 10) / bb) * 10) / 10;

    const replay = buildHHReplay(text);
    out.seatsBase = seatsBase;
    out.replay = replay;

    if (replay.steps.length) {
      const cutoff = applyCutoff(replay.steps, replay.steps.length - 1);
      out.board = cutoff.board.join(' ');
      out.ligne = cutoff.ligne;
      out.seats = seatsBase.map(s => ({ ...s, action: cutoff.actionByPlayer[s.name] || '' }));
    } else {
      out.seats = seatsBase.map(s => ({ ...s, action: '' }));
    }
  } catch (e) { console.error('Erreur parsing HH', e); }
  return out;
}

// ---------- Stockage ----------
async function loadSpotsIndex() {
  try { const r = await window.storage.get('spots:index', true); return r ? JSON.parse(r.value) : []; } catch { return []; }
}
async function saveSpotsIndex(ids) {
  try { await window.storage.set('spots:index', JSON.stringify(ids), true); } catch (e) { console.error(e); }
}
async function saveSpot(spot) {
  try { await window.storage.set('spot:' + spot.id, JSON.stringify(spot), true); } catch (e) { console.error(e); }
}
async function loadSpot(id) {
  try { const r = await window.storage.get('spot:' + id, true); return r ? JSON.parse(r.value) : null; } catch { return null; }
}
async function deleteSpotStorage(id) {
  try { await window.storage.delete('spot:' + id, true); } catch (e) { console.error(e); }
}

// ---------- Deny cards & tirage pondéré ----------
function comboOverlapsCards(key, cards) {
  if (!cards || !cards.length) return false;
  const c1 = key.slice(0, 2), c2 = key.slice(2, 4);
  return cards.includes(c1) || cards.includes(c2);
}

function drawWeightedCombo(weights, excludeCards) {
  const entries = Object.entries(weights).filter(([k, w]) => w > 0 && !comboOverlapsCards(k, excludeCards));
  if (!entries.length) return null;
  const total = entries.reduce((acc, [, w]) => acc + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
  return entries[entries.length - 1][0];
}

function drawRandomHand() {
  const deck = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(r + s);
  const i1 = Math.floor(Math.random() * deck.length);
  const c1 = deck.splice(i1, 1)[0];
  const i2 = Math.floor(Math.random() * deck.length);
  const c2 = deck[i2];
  return [c1, c2];
}

// ---------- Pseudo / classements ----------
async function loadPseudo() {
  try { const r = await window.storage.get('pseudo', false); return r ? r.value : ''; } catch { return ''; }
}
async function savePseudo(p) {
  try { await window.storage.set('pseudo', p, false); } catch (e) { console.error(e); }
}
async function pushLeaderboardEntry(spotId, entry) {
  try {
    const key = 'leaderboard:' + spotId;
    const r = await window.storage.get(key, true).catch(() => null);
    const list = r ? JSON.parse(r.value) : [];
    const filtered = list.filter(e => e.pseudo !== entry.pseudo);
    filtered.push(entry);
    filtered.sort((a, b) => b.score - a.score);
    await window.storage.set(key, JSON.stringify(filtered.slice(0, 10)), true);
  } catch (e) { console.error(e); }
}
async function loadLeaderboard(spotId) {
  try { const r = await window.storage.get('leaderboard:' + spotId, true); return r ? JSON.parse(r.value) : []; } catch { return []; }
}
async function updatePlayerStats(pseudo, score) {
  try {
    const key = 'players:' + pseudo;
    const r = await window.storage.get(key, true).catch(() => null);
    const cur = r ? JSON.parse(r.value) : { pseudo, totalPoints: 0, totalSpots: 0 };
    cur.totalPoints += score; cur.totalSpots += 1;
    await window.storage.set(key, JSON.stringify(cur), true);
    const idxR = await window.storage.get('players:index', true).catch(() => null);
    const idx = idxR ? JSON.parse(idxR.value) : [];
    if (!idx.includes(pseudo)) { idx.push(pseudo); await window.storage.set('players:index', JSON.stringify(idx), true); }
  } catch (e) { console.error(e); }
}

// Historique personnel : stocké en espace privé (rattaché au compte Claude.ai de l'élève), pas partagé.
async function pushPersonalHistory(entry) {
  try {
    const key = 'my-history';
    const r = await window.storage.get(key, false).catch(() => null);
    const list = r ? JSON.parse(r.value) : [];
    list.unshift(entry);
    await window.storage.set(key, JSON.stringify(list.slice(0, 300)), false);
  } catch (e) { console.error(e); }
}
async function loadPersonalHistory() {
  try { const r = await window.storage.get('my-history', false); return r ? JSON.parse(r.value) : []; } catch { return []; }
}
async function loadGeneralRanking(minSpots = 5) {
  try {
    const idxR = await window.storage.get('players:index', true);
    const idx = idxR ? JSON.parse(idxR.value) : [];
    const players = await Promise.all(idx.map(async p => { const r = await window.storage.get('players:' + p, true).catch(() => null); return r ? JSON.parse(r.value) : null; }));
    return players.filter(Boolean).filter(p => p.totalSpots >= minSpots).map(p => ({ ...p, ratio: p.totalPoints / p.totalSpots })).sort((a, b) => b.ratio - a.ratio);
  } catch { return []; }
}
async function getExploitLock(spotId) {
  try { const r = await window.storage.get('exploit-last:' + spotId, false); return r ? JSON.parse(r.value) : null; } catch { return null; }
}
async function setExploitLock(spotId) {
  try { await window.storage.set('exploit-last:' + spotId, JSON.stringify(Date.now()), false); } catch (e) { console.error(e); }
}

// ---------- Grille ----------
function GridCell({ cls, weight, expanded, onWheelClass, onClickClass, onCtrlClickClass, onDragStartClass, onDragEnterClass, comboWeights, onWheelCombo, onClickCombo, mode, excludedCards }) {
  const bg = weight <= 0 ? 'transparent' : `rgba(${ORANGE_RGB},${0.12 + weight * 0.4})`;
  const classFullyExcluded = excludedCards && excludedCards.length
    ? getClassCombos(cls).every(({ key }) => comboOverlapsCards(key, excludedCards)) : false;
  return (
    <div
      onMouseDown={(e) => {
        if (classFullyExcluded || e.button !== 0) return;
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) onCtrlClickClass(cls);
        else onDragStartClass(cls);
      }}
      onMouseEnter={(e) => { if (!classFullyExcluded && e.buttons === 1) onDragEnterClass(cls); }}
      onContextMenu={(e) => { e.preventDefault(); if (!classFullyExcluded) onClickClass(cls); }}
      onMouseLeave={() => { if (expanded) onClickClass(cls); }}
      style={{
        background: bg, border: '1px solid #302D2A',
        color: classFullyExcluded ? '#302D2A' : (weight > 0.4 ? '#FFFFFF' : (weight > 0 ? ORANGE : '#ECEEF1')),
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 11,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: classFullyExcluded ? 'not-allowed' : 'pointer', userSelect: 'none', aspectRatio: '1/1', borderRadius: 3,
        position: 'relative', minWidth: 0, opacity: classFullyExcluded ? 0.4 : 1,
      }}
      title={classFullyExcluded ? `${cls} — impossible (cartes de Hero)` : `${cls} — glisser: remplir plusieurs cases · ctrl+clic: toute la ligne · clic droit: détail combos`}
    >
      {cls}
      {expanded && (
        <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
          style={{ position: 'absolute', top: '110%', left: 0, zIndex: 50, background: '#211F1D', border: '1px solid #302D2A', borderRadius: 6, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', width: 180 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 10, color: '#9C9691', marginBottom: 6 }}>
            {cls} — {mode === 'admin' ? 'poids par combo' : 'sélection par combo'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
            {getClassCombos(cls).map(({ pair, key }) => {
              const w = comboWeights[key] || 0;
              const excluded = comboOverlapsCards(key, excludedCards);
              return (
                <div key={key}
                  onClick={(e) => { e.stopPropagation(); if (!excluded) onClickCombo(key); }}
                  style={{
                    background: excluded ? '#0A0C0E' : (w > 0 ? `rgba(${ORANGE_RGB},${0.15 + w * 0.4})` : '#1A1918'),
                    border: '1px solid #302D2A', borderRadius: 4, padding: '3px 2px',
                    textAlign: 'center', cursor: excluded ? 'not-allowed' : 'pointer', fontSize: 10,
                    opacity: excluded ? 0.35 : 1, fontFamily: "'IBM Plex Mono', monospace",
                  }}>
                  {pair.map((c, idx) => <span key={idx} style={{ color: SUIT_COLOR[c[1]] }}>{c[0]}{SUIT_SYMBOL[c[1]]}</span>)}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RangeGrid({ comboWeights, setComboWeights, mode, resultReveal, excludedCards }) {
  const [expandedClass, setExpandedClass] = useState(null);
  const [dragValue, setDragValue] = useState(null);

  useEffect(() => {
    const stop = () => setDragValue(null);
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  const classWeight = useCallback((cls) => {
    const combos = getClassCombos(cls);
    const sum = combos.reduce((acc, { key }) => acc + (comboWeights[key] || 0), 0);
    return sum / combos.length;
  }, [comboWeights]);

  const setClassAll = (cls, value) => {
    setComboWeights(prev => {
      const next = { ...prev };
      getClassCombos(cls).forEach(({ key }) => { if (!comboOverlapsCards(key, excludedCards)) next[key] = value; });
      return next;
    });
  };

  const onWheelClass = (cls) => { const current = classWeight(cls); setClassAll(cls, current > 0 ? 0 : 1); };
  const onClickClass = (cls) => setExpandedClass(prev => prev === cls ? null : cls);

  const onDragStartClass = (cls) => {
    const current = classWeight(cls);
    const target = current > 0 ? 0 : 1;
    setDragValue(target);
    setClassAll(cls, target);
  };
  const onDragEnterClass = (cls) => { if (dragValue !== null) setClassAll(cls, dragValue); };

  const onCtrlClickClass = (cls) => {
    const lineClasses = getLineClasses(cls);
    const allKeys = lineClasses.flatMap(c => getClassCombos(c).map(x => x.key)).filter(k => !comboOverlapsCards(k, excludedCards));
    const allFull = allKeys.length > 0 && allKeys.every(k => (comboWeights[k] || 0) > 0);
    setComboWeights(prev => { const next = { ...prev }; allKeys.forEach(k => { next[k] = allFull ? 0 : 1; }); return next; });
  };

  const onWheelCombo = (key, deltaY) => {
    setComboWeights(prev => {
      const cur = prev[key] || 0;
      let next;
      if (mode === 'admin') next = deltaY < 0 ? Math.min(1, +(cur + 0.1).toFixed(2)) : Math.max(0, +(cur - 0.1).toFixed(2));
      else next = cur > 0 ? 0 : 1;
      return { ...prev, [key]: next };
    });
  };

  const onClickCombo = (key) => setComboWeights(prev => ({ ...prev, [key]: prev[key] > 0 ? 0 : 1 }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(13, 1fr)', gap: 2, maxWidth: 480 }}>
      {ALL_CLASSES.map(cls => {
        let cellBg = null;
        if (resultReveal) {
          const combos = getClassCombos(cls);
          const villainInClass = combos.some(c => c.key === resultReveal.villainKey);
          if (villainInClass) cellBg = resultReveal.found ? '#3FA05A' : '#C4544A';
        }
        return (
          <div key={cls} style={cellBg ? { outline: `2px solid ${cellBg}`, borderRadius: 3 } : undefined}>
            <GridCell cls={cls} weight={classWeight(cls)} expanded={expandedClass === cls}
              onWheelClass={onWheelClass} onClickClass={onClickClass} onCtrlClickClass={onCtrlClickClass}
              onDragStartClass={onDragStartClass} onDragEnterClass={onDragEnterClass}
              comboWeights={comboWeights} onWheelCombo={onWheelCombo} onClickCombo={onClickCombo}
              mode={mode} excludedCards={excludedCards} />
          </div>
        );
      })}
    </div>
  );
}

// ---------- Sélecteur de carte ----------
function CardPicker({ card, onChange }) {
  const rank = card ? card[0] : 'A';
  const suit = card ? card[1] : 's';
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <select value={rank} onChange={e => onChange(e.target.value + suit)} style={selectStyle}>
        {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      <select value={suit} onChange={e => onChange(rank + e.target.value)} style={selectStyle}>
        {SUITS.map(s => <option key={s} value={s}>{SUIT_SYMBOL[s]}</option>)}
      </select>
    </div>
  );
}

function MiniCard({ card }) {
  const rank = card[0], suit = card[1];
  return (
    <div style={{ background: '#0F1216', border: '1px solid #302D2A', borderRadius: 4, padding: '3px 6px', fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", color: SUIT_COLOR[suit], fontWeight: 600 }}>
      {rank}{SUIT_SYMBOL[suit]}
    </div>
  );
}

const BOARD_BG = { s: '#454B57', h: '#C0392B', d: '#2E6DA4', c: '#2F7A4F' };

// couleurs façon dénomination réelle : blanc / rouge / bleu / vert / or, selon la taille de la mise
function chipColorForAmount(bb) {
  if (bb < 5) return '#ECEEF1';
  if (bb < 15) return '#D64545';
  if (bb < 40) return '#3F8FD1';
  if (bb < 100) return '#3FA05A';
  return '#E8A83C';
}
const CHIP_TEXT_COLOR = { '#ECEEF1': '#1A1918', '#D64545': '#FFFFFF', '#3F8FD1': '#FFFFFF', '#3FA05A': '#FFFFFF', '#E8A83C': '#1A1918' };

// tuile de mise plate et colorée (même esprit que les cartes), la taille grandit avec le montant
function BetTag({ amountBB }) {
  const color = chipColorForAmount(amountBB || 0);
  const textColor = CHIP_TEXT_COLOR[color] || '#1A1918';
  const tier = amountBB < 5 ? 0 : amountBB < 15 ? 1 : amountBB < 40 ? 2 : amountBB < 100 ? 3 : 4;
  const dims = [
    { minWidth: 40, height: 26, fs: 12 },
    { minWidth: 46, height: 29, fs: 13 },
    { minWidth: 52, height: 32, fs: 14 },
    { minWidth: 58, height: 35, fs: 15 },
    { minWidth: 64, height: 38, fs: 16 },
  ][tier];
  return (
    <div style={{
      ...dims, borderRadius: 8, background: color, color: textColor,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontFamily: "'IBM Plex Mono', monospace",
      boxShadow: '0 3px 10px rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.1)', padding: '0 8px',
    }}>
      {amountBB}
    </div>
  );
}

function BoardCard({ card }) {
  const rank = card[0], suit = card[1];
  return (
    <div style={{
      width: 58, height: 74, borderRadius: 10, background: BOARD_BG[suit],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 34, fontWeight: 800, color: '#F5F6F8', fontFamily: "'IBM Plex Mono', monospace",
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)',
    }}>
      {rank}
    </div>
  );
}

function HoleCard({ card }) {
  const rank = card[0], suit = card[1];
  return (
    <div style={{
      width: 38, height: 50, borderRadius: 7, background: BOARD_BG[suit],
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 20, fontWeight: 800, color: '#F5F6F8', fontFamily: "'IBM Plex Mono', monospace",
      boxShadow: '0 3px 8px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)',
    }}>
      {rank}
    </div>
  );
}

function Seat({ position, stackBB, stackChips, action, bounty, dealer, highlight, profile }) {
  const [showChips, setShowChips] = useState(false);
  const profileColor = profile ? PROFILE_COLORS[profile] : null;
  const borderColor = profileColor || highlight || '#302D2A';
  const glow = (profileColor || highlight) ? `0 0 10px ${(profileColor || highlight)}66, 0 2px 8px rgba(0,0,0,0.4)` : '0 2px 8px rgba(0,0,0,0.4)';
  const clickable = stackChips != null;
  return (
    <div style={{
      background: '#211F1D', border: `2px solid ${borderColor}`, boxShadow: glow,
      borderRadius: 10, padding: '6px 10px', fontSize: 11, minWidth: 128, position: 'relative',
    }}>
      {dealer && (
        <div style={{ position: 'absolute', top: -9, right: -9, width: 18, height: 18, borderRadius: '50%', background: '#ECEEF1', color: '#1A1918', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>D</div>
      )}
      {bounty && (
        <div style={{
          position: 'absolute', top: -9, left: -9, minWidth: 22, height: 22, borderRadius: '50%',
          background: '#1A1918', border: '2px solid #6FCF97', color: '#6FCF97', fontSize: 8, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
          fontFamily: "'IBM Plex Mono', monospace", padding: '0 2px', zIndex: 2,
        }}>{bounty}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginLeft: bounty ? 12 : 0 }}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ color: '#9C9691', whiteSpace: 'nowrap', fontSize: 11 }}>{position || '—'}</div>
          {profile && <div style={{ fontSize: 8, color: profileColor, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>{profile}</div>}
        </div>
        <div
          onClick={() => clickable && setShowChips(v => !v)}
          title={clickable ? 'Clique pour voir le stack en jetons' : undefined}
          style={{
            fontFamily: "'IBM Plex Mono', monospace", color: '#ECEEF1', fontSize: showChips ? 13 : 15, fontWeight: 700,
            whiteSpace: 'nowrap', cursor: clickable ? 'pointer' : 'default',
            borderBottom: clickable ? '1px dotted rgba(242,153,74,0.5)' : 'none',
          }}
        >
          {showChips ? stackChips.toLocaleString('fr-FR') : `${stackBB || '—'} BB`}
        </div>
      </div>
      {action && (
        <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: /all-?in/i.test(action) ? '#E0645A' : '#6FCF97', marginTop: 4 }}>{action}</div>
      )}
    </div>
  );
}

// ---------- Visuel de table (circulaire, façon Wizard) ----------
function TableView({ spot, heroCardsOverride, bets }) {
  const board = (spot.board || '').trim().split(/\s+/).filter(Boolean);
  const seats = spot.seats && spot.seats.length ? spot.seats : [];
  const n = seats.length || 1;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: '#9C9691', flexWrap: 'wrap' }}>
        <span>Blinds <span style={{ color: '#ECEEF1' }}>{spot.blindLevel || '—'}</span></span>
        <span>Average <span style={{ color: '#ECEEF1' }}>{spot.averageBB || '—'} BB</span></span>
        {spot.momentTournoi && <span style={{ background: '#302D2A', padding: '2px 8px', borderRadius: 10, fontFamily: "'Space Grotesk', sans-serif" }}>{spot.momentTournoi}</span>}
      </div>
      <div style={{ position: 'relative', width: '100%', maxWidth: 680, aspectRatio: '4/3', margin: '0 auto' }}>
        <div style={{ position: 'absolute', inset: 0, border: '2px solid #302D2A', borderRadius: '50%', background: 'radial-gradient(ellipse at center, #16233A 0%, #0B121F 75%)' }} />
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', zIndex: 5 }}>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', minHeight: 74 }}>
            {board.length ? board.map((c, i) => <BoardCard key={i} card={c} />) : <span style={{ fontSize: 11, color: '#556070', alignSelf: 'center' }}>board —</span>}
          </div>
          {spot.potTotal != null && spot.potTotal !== '' && (
            <div style={{ marginTop: 6, display: 'inline-block', background: '#211F1D', border: '1px solid #302D2A', borderRadius: 20, padding: '4px 14px' }}>
              <span style={{ fontSize: 10, color: '#9C9691' }}>Pot </span>
              <span style={{ color: '#ECEEF1', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 15 }}>{spot.potTotal} BB</span>
            </div>
          )}
        </div>
        {seats.map((s, i) => {
          const pos = getSeatPos(i, n);
          const holeCards = s.role === 'hero'
            ? (heroCardsOverride && heroCardsOverride.length === 2 ? heroCardsOverride : (spot.heroCombo ? [spot.heroCombo.slice(0, 2), spot.heroCombo.slice(2, 4)] : null))
            : null;
          const highlight = s.role === 'hero' ? ORANGE : (s.role === 'villain' ? '#E0645A' : undefined);
          return (
            <div key={i} style={{ position: 'absolute', left: pos.left, top: pos.top, transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              {holeCards && holeCards.length === 2 && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <HoleCard card={holeCards[0]} /><HoleCard card={holeCards[1]} />
                </div>
              )}
              <Seat position={s.position} stackBB={s.stackBB} stackChips={s.stackChips} action={s.action} bounty={s.bounty} dealer={s.dealer} highlight={highlight} profile={s.profile} />
            </div>
          );
        })}
        {bets && seats.map((s, i) => {
          const amount = bets[s.name];
          if (amount == null || amount <= 0) return null;
          const chipPos = getChipPos(i, n);
          return (
            <div key={'bet' + i} style={{ position: 'absolute', left: chipPos.left, top: chipPos.top, transform: 'translate(-50%,-50%)', zIndex: 4 }}>
              <BetTag amountBB={amount} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Replayer interactif (navigation coup par coup) ----------
function Replayer({ spot, heroCardsOverride }) {
  const steps = (spot.replay && spot.replay.steps) || [];
  const hasReplay = steps.length > 0;
  const [idx, setIdx] = useState(hasReplay ? -1 : null);

  if (!hasReplay) {
    return (
      <>
        <TableView spot={spot} heroCardsOverride={heroCardsOverride} />
        <div style={{ background: '#211F1D', border: '1px solid #302D2A', borderRadius: 6, padding: '8px 10px', marginBottom: 14, fontSize: 12, color: '#ECEEF1', fontStyle: 'italic' }}>
          {spot.ligne || 'Ligne de jeu non renseignée.'}
        </div>
      </>
    );
  }

  const maxIdx = steps.length - 1;
  const bb = spot.replay.bb;
  const current = idx >= 0 ? steps[idx] : null;
  const stacksChips = current ? current.stacksChips : spot.replay.initialStacks;
  const potChips = current ? current.potChips : spot.replay.initialPot;
  const cutoff = idx >= 0 ? applyCutoff(steps, idx) : { board: [], ligne: '', actionByPlayer: {} };

  const liveSeats = (spot.seats || []).map(s => ({
    ...s,
    stackBB: bb ? Math.round(((stacksChips[s.name] ?? 0) / bb) * 10) / 10 : s.stackBB,
    stackChips: stacksChips[s.name] ?? null,
    action: cutoff.actionByPlayer[s.name] || '',
  }));
  const liveSpot = { ...spot, seats: liveSeats, board: cutoff.board.join(' '), potTotal: bb ? Math.round((potChips / bb) * 10) / 10 : spot.potTotal };

  const streetCommit = current ? current.streetCommit : spot.replay.initialStreetCommit;
  const betsBB = {};
  if (bb && streetCommit) {
    Object.entries(streetCommit).forEach(([name, amount]) => {
      if (amount > 0) betsBB[name] = Math.round((amount / bb) * 10) / 10;
    });
  }

  const streetsPresent = [...new Set(steps.map(s => s.street))];
  const jumpToStreet = (street) => { const i = steps.findIndex(s => s.street === street); if (i >= 0) setIdx(i); };

  return (
    <>
      <TableView spot={liveSpot} heroCardsOverride={heroCardsOverride} bets={betsBB} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
        <button onClick={() => setIdx(i => Math.max(-1, i - 1))} disabled={idx <= -1}
          style={{ padding: '6px 12px', background: idx <= -1 ? '#211F1D' : '#302D2A', color: '#ECEEF1', border: '1px solid #302D2A', borderRadius: 6, opacity: idx <= -1 ? 0.4 : 1 }}>←</button>
        {['PRE-FLOP', 'FLOP', 'TURN', 'RIVER'].map(s => (
          <button key={s} disabled={!streetsPresent.includes(s)} onClick={() => jumpToStreet(s)}
            style={{ padding: '5px 9px', fontSize: 10, background: current && current.street === s ? ORANGE : '#211F1D', color: current && current.street === s ? '#1A1918' : '#ECEEF1', border: '1px solid #302D2A', borderRadius: 6, opacity: streetsPresent.includes(s) ? 1 : 0.3 }}>
            {s}
          </button>
        ))}
        <button onClick={() => setIdx(i => Math.min(maxIdx, i + 1))} disabled={idx >= maxIdx}
          style={{ padding: '6px 12px', background: idx >= maxIdx ? '#211F1D' : '#302D2A', color: '#ECEEF1', border: '1px solid #302D2A', borderRadius: 6, opacity: idx >= maxIdx ? 0.4 : 1 }}>→</button>
      </div>
      {!current && (
        <div style={{ background: '#211F1D', border: '1px solid #302D2A', borderRadius: 6, padding: '8px 10px', marginBottom: 14, fontSize: 12, color: '#9C9691', fontStyle: 'italic', textAlign: 'center' }}>
          Avant l'action (mains distribuées)
        </div>
      )}
    </>
  );
}

// ---------- App ----------
export default function App() {
  const [tab, setTab] = useState('admin');
  const [spots, setSpots] = useState([]);
  const [loadingSpots, setLoadingSpots] = useState(true);

  const [editWeights, setEditWeights] = useState({});
  const [pasteText, setPasteText] = useState('');
  const [hhText, setHhText] = useState('');
  const [hhMsg, setHhMsg] = useState('');
  const [parsedHH, setParsedHH] = useState(null); // { seatsBase, steps, initialStacks, initialPot, bb }
  const [selectedNodeIdx, setSelectedNodeIdx] = useState(null); // nœud confirmé (sauvegardé)
  const [previewIdx, setPreviewIdx] = useState(null); // nœud en cours de navigation (aperçu live)

  const [form, setForm] = useState({
    nom: '', koValue: '', ligne: '', timer: 30,
    buyIn: '', format: '', startingStack: '', palier: '',
    board: '', blindLevel: '', averageBB: '', nbInscrits: '', potTotal: '',
    momentTournoi: MOMENT_OPTIONS[0],
    mode: 'theorique',
    heroCard1: 'Qc', heroCard2: 'Qd',
    villainCard1: 'As', villainCard2: 'Kd',
    numPlayers: 6, seats: generateSeats(6), replay: null,
  });
  const [saveMsg, setSaveMsg] = useState('');

  const [pseudo, setPseudo] = useState('');
  const [pseudoInput, setPseudoInput] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [generalRanking, setGeneralRanking] = useState([]);
  const [myHistory, setMyHistory] = useState([]);
  useEffect(() => { (async () => setMyHistory(await loadPersonalHistory()))(); }, []);
  const [exploitLocked, setExploitLocked] = useState(null);

  useEffect(() => { (async () => { const p = await loadPseudo(); setPseudo(p); setPseudoInput(p); })(); }, []);

  const [activeSpot, setActiveSpot] = useState(null);
  const [playWeights, setPlayWeights] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [reveal, setReveal] = useState(null);
  const [showLobby, setShowLobby] = useState(false);

  useEffect(() => {
    (async () => {
      const ids = await loadSpotsIndex();
      const loaded = await Promise.all(ids.map(loadSpot));
      setSpots(loaded.filter(Boolean));
      setLoadingSpots(false);
    })();
  }, []);

  useEffect(() => {
    if (!running) return;
    if (timeLeft <= 0) { submitAttempt(); return; }
    const t = setTimeout(() => setTimeLeft(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [running, timeLeft]);

  const handlePaste = () => {
    const weights = parsePastedRange(pasteText);
    setEditWeights(prev => ({ ...prev, ...weights }));
  };

  const handleAnalyzeHH = () => {
    if (!hhText.trim()) { setHhMsg('Colle une hand history avant.'); return; }
    const parsed = parseWinamaxHH(hhText);
    setForm(f => ({ ...f, ...parsed, replay: parsed.replay }));
    if (parsed.replay && parsed.replay.steps.length) {
      setParsedHH({ seatsBase: parsed.seatsBase, steps: parsed.replay.steps, initialStacks: parsed.replay.initialStacks, initialPot: parsed.replay.initialPot, initialStreetCommit: parsed.replay.initialStreetCommit, bb: parsed.replay.bb });
      setSelectedNodeIdx(parsed.replay.steps.length - 1);
      setPreviewIdx(parsed.replay.steps.length - 1);
    }
    if (parsed.villainCard1 && parsed.villainCard2) {
      const key = comboKey([parsed.villainCard1, parsed.villainCard2]);
      setEditWeights(prev => ({ ...prev, [key]: 1 }));
    }
    setHhMsg('Hand history analysée. Navigue action par action ci-dessous avec les flèches, puis valide le nœud où tu veux arrêter l\'exercice. Vérifie le vilain détecté avant de sauvegarder.');
  };

  const handleSelectNode = (idx) => {
    if (!parsedHH) return;
    setSelectedNodeIdx(idx);
    const cutoff = applyCutoff(parsedHH.steps, idx);
    setForm(f => ({
      ...f,
      board: cutoff.board.join(' '),
      ligne: cutoff.ligne,
      seats: f.seats.map(s => ({ ...s, action: cutoff.actionByPlayer[s.name] || '' })),
      replay: { initialStacks: parsedHH.initialStacks, initialPot: parsedHH.initialPot, initialStreetCommit: parsedHH.initialStreetCommit, bb: parsedHH.bb, steps: parsedHH.steps.slice(0, idx + 1) },
    }));
  };

  const resetEditor = () => {
    setEditWeights({});
    setPasteText('');
    setHhText('');
    setHhMsg('');
    setParsedHH(null);
    setSelectedNodeIdx(null);
    setPreviewIdx(null);
    setForm({
      nom: '', koValue: '', ligne: '', timer: 30, buyIn: '', format: '', startingStack: '', palier: '',
      board: '', blindLevel: '', averageBB: '', nbInscrits: '', potTotal: '',
      momentTournoi: MOMENT_OPTIONS[0], mode: 'theorique',
      heroCard1: 'Qc', heroCard2: 'Qd', villainCard1: 'As', villainCard2: 'Kd',
      numPlayers: 6, seats: generateSeats(6), replay: null,
    });
  };

  const setNumPlayers = (n) => setForm(f => ({ ...f, numPlayers: n, seats: generateSeats(n) }));

  const updateSeat = (idx, patch) => setForm(f => {
    const seats = f.seats.map((s, i) => i === idx ? { ...s, ...patch } : s);
    return { ...f, seats };
  });
  const setSeatRole = (idx, role) => setForm(f => {
    const seats = f.seats.map((s, i) => ({ ...s, role: i === idx ? (s.role === role ? null : role) : (s.role === role ? null : s.role) }));
    return { ...f, seats };
  });
  const setSeatDealer = (idx) => setForm(f => {
    const seats = f.seats.map((s, i) => ({ ...s, dealer: i === idx }));
    return { ...f, seats };
  });

  const handleSaveSpot = async () => {
    if (!form.nom.trim()) { setSaveMsg('Donne un nom au spot avant de sauvegarder.'); return; }
    let heroCombo = '';
    let villainKey = '';
    if (form.mode === 'exploit') {
      if (form.heroCard1 === form.heroCard2) { setSaveMsg('Les deux cartes de Hero doivent être différentes.'); return; }
      if (form.villainCard1 === form.villainCard2) { setSaveMsg('Les deux cartes du combo vilain doivent être différentes.'); return; }
      heroCombo = form.heroCard1 + form.heroCard2;
      villainKey = form.villainCard1 + form.villainCard2;
      if (!(editWeights[villainKey] > 0)) {
        setSaveMsg("⚠️ Le combo de vilain n'a aucun poids dans la grille de référence à gauche — le score sera toujours 0 pour ce spot. Colle/édite la range de référence avant de sauvegarder.");
        return;
      }
    } else {
      const hasDrawable = Object.values(editWeights).some(w => w > 0);
      if (!hasDrawable) {
        setSaveMsg("⚠️ La grille de référence est vide — aucun combo n'est tirable pour vilain. Colle/édite la range avant de sauvegarder.");
        return;
      }
    }
    const id = 'spot_' + Date.now();
    const spot = {
      id, nom: form.nom, koValue: form.koValue, ligne: form.ligne,
      mode: form.mode, heroCombo, villainCombo: villainKey, timer: parseInt(form.timer, 10) || 30,
      buyIn: form.buyIn, format: form.format, startingStack: form.startingStack, palier: form.palier,
      board: form.board, blindLevel: form.blindLevel, averageBB: form.averageBB, nbInscrits: form.nbInscrits,
      potTotal: form.potTotal, momentTournoi: form.momentTournoi, seats: form.seats, replay: form.replay || null,
      weights: editWeights, createdAt: Date.now(),
    };
    await saveSpot(spot);
    const ids = await loadSpotsIndex();
    await saveSpotsIndex([...ids, id]);
    setSpots(prev => [...prev, spot]);
    setSaveMsg('Spot sauvegardé.');
    resetEditor();
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const handleDeleteSpot = async (id) => {
    await deleteSpotStorage(id);
    const ids = await loadSpotsIndex();
    await saveSpotsIndex(ids.filter(x => x !== id));
    setSpots(prev => prev.filter(s => s.id !== id));
  };

  const startSpot = async (spot) => {
    if (spot.mode === 'exploit') {
      const lock = await getExploitLock(spot.id);
      if (lock && Date.now() - lock < 30 * 24 * 3600 * 1000) {
        setExploitLocked(lock); setActiveSpot(spot); setTab('play'); return;
      }
    }
    setExploitLocked(null);
    setActiveSpot(spot);
    setPlayWeights({});
    setReveal(null);
    setShowLobby(false);
    setTimeLeft(spot.timer);
    setRunning(true);
    setTab('play');
  };

  const [currentVillainKey, setCurrentVillainKey] = useState(null);
  const [currentHeroCards, setCurrentHeroCards] = useState([]);
  useEffect(() => {
    if (!activeSpot || exploitLocked) { setCurrentVillainKey(null); setCurrentHeroCards([]); return; }
    if (activeSpot.mode === 'exploit') {
      const heroCards = activeSpot.heroCombo ? [activeSpot.heroCombo.slice(0, 2), activeSpot.heroCombo.slice(2, 4)] : [];
      setCurrentHeroCards(heroCards);
      const raw = activeSpot.villainCombo;
      setCurrentVillainKey(raw && raw.length === 4 ? comboKey([raw.slice(0, 2), raw.slice(2, 4)]) : raw);
    } else {
      const heroCards = drawRandomHand();
      setCurrentHeroCards(heroCards);
      setCurrentVillainKey(drawWeightedCombo(activeSpot.weights, heroCards));
    }
  }, [activeSpot, exploitLocked]);

  const submitAttempt = async () => {
    setRunning(false);
    if (!activeSpot || !currentVillainKey) return;
    const selected = Object.entries(playWeights).filter(([, v]) => v > 0).map(([k]) => k);
    const found = selected.includes(currentVillainKey);
    let score = 0;
    if (found && selected.length > 0) {
      const sum = selected.reduce((acc, k) => acc + (activeSpot.weights[k] || 0), 0);
      score = Math.round((sum / selected.length) * 100);
    }
    const referenceCount = Object.values(activeSpot.weights).filter(w => w > 0).length;
    setReveal({ found, score, villainKey: currentVillainKey, selectedCount: selected.length, referenceCount });
    if (activeSpot.mode === 'exploit') await setExploitLock(activeSpot.id);
    if (pseudo) { await pushLeaderboardEntry(activeSpot.id, { pseudo, score, date: Date.now() }); await updatePlayerStats(pseudo, score); }
    await pushPersonalHistory({ spotName: activeSpot.nom, mode: activeSpot.mode, score, found, date: Date.now() });
    setMyHistory(await loadPersonalHistory());
  };

  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div style={{ minHeight: '100vh', background: '#1A1918', color: '#ECEEF1', fontFamily: "'Space Grotesk', sans-serif", padding: 20 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        input, select, textarea { font-family: 'Space Grotesk', sans-serif; }
        button { font-family: 'Space Grotesk', sans-serif; cursor: pointer; }
      `}</style>

      <div style={{
        position: 'relative', marginBottom: 20, padding: '18px 20px', borderRadius: 14, overflow: 'hidden',
        border: '1px solid #302D2A', background: '#211F1D',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 55% 100% at 92% 10%, rgba(232,168,60,0.28) 0%, transparent 55%), radial-gradient(ellipse 50% 90% at 5% 95%, rgba(74,127,181,0.28) 0%, transparent 60%)',
        }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 0.5 }}>Find It!</div>
            <div style={{ fontSize: 12, color: '#9C9691' }}>Entraînement de lecture de range</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input placeholder="Ton pseudo" value={pseudoInput} onChange={e => setPseudoInput(e.target.value)}
              onBlur={() => { setPseudo(pseudoInput); savePseudo(pseudoInput); }}
              style={{ background: '#211F1D', border: '1px solid #302D2A', color: '#ECEEF1', borderRadius: 6, padding: '6px 8px', fontSize: 12, width: 110 }} />
            {['admin', 'library', 'play', 'ranking', 'history'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 14px', borderRadius: 6, fontSize: 12, background: tab === t ? ORANGE : '#211F1D', color: tab === t ? '#1A1918' : '#ECEEF1', border: '1px solid #302D2A' }}>
                {t === 'admin' ? 'Éditeur' : t === 'library' ? 'Bibliothèque' : t === 'play' ? 'Jouer' : t === 'ranking' ? 'Classements' : 'Mon historique'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === 'admin' && (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px', minWidth: 300 }}>
            <div style={{ fontSize: 13, color: '#9C9691', marginBottom: 6 }}>Importer une Hand History (Winamax)</div>
            <textarea value={hhText} onChange={e => setHhText(e.target.value)} rows={4}
              placeholder="Colle ici le texte complet de la hand history..."
              style={{ width: '100%', background: '#211F1D', border: '1px solid #302D2A', color: '#ECEEF1', borderRadius: 6, padding: 8, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }} />
            <button onClick={handleAnalyzeHH} style={{ marginTop: 6, padding: '6px 12px', background: ORANGE, color: '#1A1918', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
              Analyser la Hand History
            </button>
            {hhMsg && <div style={{ marginTop: 6, fontSize: 11, color: '#9C9691', maxWidth: 420 }}>{hhMsg}</div>}

            {parsedHH && parsedHH.steps.length > 0 && (() => {
              const maxIdx = parsedHH.steps.length - 1;
              const bb = parsedHH.bb;
              const current = previewIdx != null && previewIdx >= 0 ? parsedHH.steps[previewIdx] : null;
              const cutoff = previewIdx != null && previewIdx >= 0 ? applyCutoff(parsedHH.steps, previewIdx) : { board: [], ligne: '', actionByPlayer: {} };
              const stacksChips = current ? current.stacksChips : parsedHH.initialStacks;
              const potChips = current ? current.potChips : parsedHH.initialPot;
              const previewSeats = form.seats.map(s => ({
                ...s,
                stackBB: bb ? Math.round(((stacksChips[s.name] ?? 0) / bb) * 10) / 10 : s.stackBB,
                stackChips: stacksChips[s.name] ?? null,
                action: cutoff.actionByPlayer[s.name] || '',
              }));
              const previewSpot = { ...form, seats: previewSeats, board: cutoff.board.join(' '), potTotal: bb ? Math.round((potChips / bb) * 10) / 10 : form.potTotal };
              const streetsPresent = [...new Set(parsedHH.steps.map(s => s.street))];
              const jumpToStreet = (street) => { const i = parsedHH.steps.findIndex(s => s.street === street); if (i >= 0) setPreviewIdx(i); };
              const isConfirmed = selectedNodeIdx === previewIdx;

              return (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: '#9C9691', marginBottom: 6 }}>Navigue action par action pour choisir ton nœud d'arrêt :</div>
                  <TableView spot={previewSpot} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => setPreviewIdx(i => Math.max(-1, i - 1))} disabled={previewIdx <= -1}
                      style={{ padding: '6px 12px', background: previewIdx <= -1 ? '#211F1D' : '#302D2A', color: '#ECEEF1', border: '1px solid #302D2A', borderRadius: 6, opacity: previewIdx <= -1 ? 0.4 : 1 }}>←</button>
                    {['PRE-FLOP', 'FLOP', 'TURN', 'RIVER'].map(s => (
                      <button key={s} disabled={!streetsPresent.includes(s)} onClick={() => jumpToStreet(s)}
                        style={{ padding: '5px 9px', fontSize: 10, background: current && current.street === s ? ORANGE : '#211F1D', color: current && current.street === s ? '#1A1918' : '#ECEEF1', border: '1px solid #302D2A', borderRadius: 6, opacity: streetsPresent.includes(s) ? 1 : 0.3 }}>
                        {s}
                      </button>
                    ))}
                    <button onClick={() => setPreviewIdx(i => Math.min(maxIdx, i + 1))} disabled={previewIdx >= maxIdx}
                      style={{ padding: '6px 12px', background: previewIdx >= maxIdx ? '#211F1D' : '#302D2A', color: '#ECEEF1', border: '1px solid #302D2A', borderRadius: 6, opacity: previewIdx >= maxIdx ? 0.4 : 1 }}>→</button>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 12, color: '#9C9691', marginBottom: 8 }}>
                    {current ? `${current.player} : ${current.label}` : "Avant l'action (mains distribuées)"}
                  </div>
                  <button onClick={() => handleSelectNode(previewIdx)} disabled={isConfirmed} style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: 'none',
                    background: isConfirmed ? '#302D2A' : ORANGE, color: isConfirmed ? '#6FCF97' : '#1A1918',
                    cursor: isConfirmed ? 'default' : 'pointer',
                  }}>
                    {isConfirmed ? '✓ Nœud d\'arrêt confirmé pour ce point' : "Arrêter l'exercice ici — utiliser ce nœud"}
                  </button>
                </div>
              );
            })()}

            <div style={{ marginTop: 20, fontSize: 13, color: '#9C9691', marginBottom: 6 }}>Ou coller une range (classes ou combo par combo)</div>
            <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={3}
              style={{ width: '100%', background: '#211F1D', border: '1px solid #302D2A', color: '#ECEEF1', borderRadius: 6, padding: 8, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }} />
            <button onClick={handlePaste} style={{ marginTop: 6, padding: '6px 12px', background: '#302D2A', color: '#ECEEF1', border: 'none', borderRadius: 6, fontSize: 12 }}>Importer la range</button>

            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, color: '#9C9691', marginBottom: 8 }}>Grille de référence (poids théorique)</div>
              <RangeGrid comboWeights={editWeights} setComboWeights={setEditWeights} mode="admin" excludedCards={form.mode === 'exploit' ? [form.heroCard1, form.heroCard2] : []} />
            </div>
          </div>

          <div style={{ flex: '1 1 300px', minWidth: 280 }}>
            <div style={{ fontSize: 13, color: '#9C9691', marginBottom: 8 }}>Détails du spot</div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: '#9C9691', display: 'block', marginBottom: 4 }}>Mode</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['theorique', 'Théorique (tirage infini)'], ['exploit', 'Exploit (1x, rappel 1 mois)']].map(([v, label]) => (
                  <button key={v} onClick={() => setForm(f => ({ ...f, mode: v }))}
                    style={{ flex: 1, padding: '6px 8px', fontSize: 11, borderRadius: 6, border: '1px solid #302D2A', background: form.mode === v ? ORANGE : '#211F1D', color: form.mode === v ? '#1A1918' : '#ECEEF1' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {form.mode === 'exploit' && (
              <>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: '#9C9691', display: 'block', marginBottom: 4 }}>Main de Hero (showdown observé)</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <CardPicker card={form.heroCard1} onChange={c => setForm(f => ({ ...f, heroCard1: c }))} />
                    <CardPicker card={form.heroCard2} onChange={c => setForm(f => ({ ...f, heroCard2: c }))} />
                    <MiniCard card={form.heroCard1} /><MiniCard card={form.heroCard2} />
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: '#9C9691', display: 'block', marginBottom: 4 }}>Combo réel de vilain (showdown observé)</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <CardPicker card={form.villainCard1} onChange={c => setForm(f => ({ ...f, villainCard1: c }))} />
                    <CardPicker card={form.villainCard2} onChange={c => setForm(f => ({ ...f, villainCard2: c }))} />
                    <MiniCard card={form.villainCard1} /><MiniCard card={form.villainCard2} />
                  </div>
                </div>
              </>
            )}
            {form.mode === 'theorique' && (
              <div style={{ marginBottom: 10, fontSize: 11, color: '#9C9691' }}>
                À chaque tentative, la main de Hero ET le combo de vilain seront tirés au hasard.
              </div>
            )}

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: '#9C9691', display: 'block', marginBottom: 4 }}>Nombre de joueurs à la table</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                  <button key={n} onClick={() => setNumPlayers(n)} style={{ padding: '5px 10px', fontSize: 11, borderRadius: 6, border: '1px solid #302D2A', background: form.numPlayers === n ? ORANGE : '#211F1D', color: form.numPlayers === n ? '#1A1918' : '#ECEEF1' }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: '#9C9691', display: 'block', marginBottom: 4 }}>Sièges — position, stack, action, puis clique Hero / Vilain / D</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {form.seats.map((seat, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input value={seat.position} onChange={e => updateSeat(idx, { position: e.target.value })}
                      style={{ width: 52, background: '#211F1D', border: '1px solid #302D2A', color: '#ECEEF1', borderRadius: 6, padding: '4px 5px', fontSize: 10 }} />
                    <input placeholder="BB" value={seat.stackBB} onChange={e => updateSeat(idx, { stackBB: e.target.value })}
                      style={{ width: 44, background: '#211F1D', border: '1px solid #302D2A', color: '#ECEEF1', borderRadius: 6, padding: '4px 5px', fontSize: 10 }} />
                    <input placeholder="Action" value={seat.action} onChange={e => updateSeat(idx, { action: e.target.value })}
                      style={{ width: 70, background: '#211F1D', border: '1px solid #302D2A', color: '#ECEEF1', borderRadius: 6, padding: '4px 5px', fontSize: 10 }} />
                    <input placeholder="KO €" value={seat.bounty} onChange={e => updateSeat(idx, { bounty: e.target.value })}
                      style={{ width: 46, background: '#211F1D', border: '1px solid #302D2A', color: '#ECEEF1', borderRadius: 6, padding: '4px 5px', fontSize: 10 }} />
                    <button onClick={() => setSeatRole(idx, 'hero')} style={{ padding: '4px 7px', fontSize: 10, borderRadius: 6, border: '1px solid #302D2A', background: seat.role === 'hero' ? ORANGE : '#211F1D', color: seat.role === 'hero' ? '#1A1918' : '#ECEEF1' }}>Hero</button>
                    <button onClick={() => setSeatRole(idx, 'villain')} style={{ padding: '4px 7px', fontSize: 10, borderRadius: 6, border: '1px solid #302D2A', background: seat.role === 'villain' ? '#E0645A' : '#211F1D', color: seat.role === 'villain' ? '#1A1918' : '#ECEEF1' }}>Vilain</button>
                    <button onClick={() => setSeatDealer(idx)} style={{ padding: '4px 7px', fontSize: 10, borderRadius: 6, border: '1px solid #302D2A', background: seat.dealer ? '#ECEEF1' : '#211F1D', color: seat.dealer ? '#1A1918' : '#ECEEF1' }}>D</button>
                    <select value={seat.profile} onChange={e => updateSeat(idx, { profile: e.target.value })}
                      style={{ ...selectStyle, padding: '4px 5px', fontSize: 10, borderColor: seat.profile ? PROFILE_COLORS[seat.profile] : '#302D2A', color: seat.profile ? PROFILE_COLORS[seat.profile] : '#ECEEF1' }}>
                      <option value="">Profil —</option>
                      {PROFILE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: '#9C9691', display: 'block', marginBottom: 4 }}>Moment du tournoi</label>
              <select value={form.momentTournoi} onChange={e => setForm(f => ({ ...f, momentTournoi: e.target.value }))} style={{ ...selectStyle, width: '100%' }}>
                {MOMENT_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {[
              ['nom', 'Nom du spot'], ['koValue', 'Valeur du KO'], ['ligne', 'Ligne de jeu (résumé)'],
              ['board', 'Board (ex: As Kd 7h 2c 9s)'], ['potTotal', 'Pot total (en BB)'],
              ['blindLevel', 'Niveau de blind (ex: 400/800)'], ['averageBB', 'Average du tournoi (en BB)'],
              ['timer', 'Timer (secondes)'], ['buyIn', 'Buy-in'], ['format', 'Format (freezeout, PKO...)'],
              ['startingStack', 'Starting stack'], ['palier', 'Palier'],
            ].map(([field, label]) => (
              <div key={field} style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: '#9C9691', display: 'block', marginBottom: 2 }}>{label}</label>
                <input value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  style={{ width: '100%', background: '#211F1D', border: '1px solid #302D2A', color: '#ECEEF1', borderRadius: 6, padding: '6px 8px', fontSize: 12 }} />
              </div>
            ))}

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: '#9C9691', display: 'block', marginBottom: 4 }}>Nombre d'inscrits au tournoi</label>
              <input value={form.nbInscrits} onChange={e => setForm(f => ({ ...f, nbInscrits: e.target.value }))}
                style={{ width: '100%', background: '#211F1D', border: '1px solid #302D2A', color: '#ECEEF1', borderRadius: 6, padding: '6px 8px', fontSize: 12, marginBottom: 6 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                {[5000, 1000, 500, 200].map(n => (
                  <button key={n} onClick={() => setForm(f => ({ ...f, nbInscrits: String(n) }))} style={{ padding: '4px 10px', background: '#302D2A', color: '#ECEEF1', border: 'none', borderRadius: 6, fontSize: 11 }}>{n}</button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 14, marginBottom: 6, fontSize: 11, color: '#9C9691' }}>Aperçu de la table</div>
            <TableView spot={form} heroCardsOverride={form.mode === 'exploit' ? [form.heroCard1, form.heroCard2] : undefined} />

            <button onClick={handleSaveSpot} style={{ marginTop: 8, padding: '8px 16px', background: ORANGE, color: '#1A1918', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13 }}>
              Sauvegarder le spot
            </button>
            {saveMsg && <div style={{ marginTop: 8, fontSize: 12, color: saveMsg.startsWith('⚠️') ? '#E0645A' : '#6FCF97', maxWidth: 280 }}>{saveMsg}</div>}
          </div>
        </div>
      )}

      {tab === 'library' && (
        <div>
          {loadingSpots ? <div style={{ color: '#9C9691', fontSize: 13 }}>Chargement…</div> :
            spots.length === 0 ? <div style={{ color: '#9C9691', fontSize: 13 }}>Aucun spot créé pour l'instant. Passe par l'onglet Éditeur.</div> :
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {spots.map(s => (
                <div key={s.id} style={{ background: '#211F1D', border: '1px solid #302D2A', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.nom}</div>
                    <div style={{ fontSize: 11, color: '#9C9691', fontFamily: "'IBM Plex Mono', monospace" }}>KO: {s.koValue || '—'} · {s.mode === 'exploit' ? 'Exploit' : 'Théorique'} · timer {s.timer}s</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => startSpot(s)} style={{ padding: '6px 12px', background: ORANGE, color: '#1A1918', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>Jouer</button>
                    <button onClick={() => handleDeleteSpot(s.id)} style={{ padding: '6px 12px', background: 'transparent', color: '#C4544A', border: '1px solid #C4544A', borderRadius: 6, fontSize: 12 }}>Supprimer</button>
                  </div>
                </div>
              ))}
            </div>
          }
        </div>
      )}

      {tab === 'play' && (
        activeSpot ? (
          exploitLocked ? (
            <div style={{ maxWidth: 480, background: '#211F1D', border: '1px solid #302D2A', borderRadius: 8, padding: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{activeSpot.nom}</div>
              <div style={{ fontSize: 13, color: '#9C9691' }}>
                Ce spot exploit a déjà été joué. Il sera de nouveau disponible le{' '}
                <span style={{ color: ORANGE }}>{new Date(exploitLocked + 30 * 24 * 3600 * 1000).toLocaleDateString('fr-FR')}</span>.
              </div>
            </div>
          ) : (
          <div style={{ maxWidth: 560 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{activeSpot.nom}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, color: timeLeft <= 5 ? '#C4544A' : ORANGE }}>{fmtTime(timeLeft)}</div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: 12, flexWrap: 'wrap' }}>
              <div style={{ background: '#211F1D', border: '1px solid #302D2A', borderRadius: 6, padding: '6px 10px' }}>
                KO: <span style={{ color: ORANGE, fontFamily: "'IBM Plex Mono', monospace" }}>{activeSpot.koValue || '—'}</span>
              </div>
              <div onMouseEnter={() => setShowLobby(true)} onMouseLeave={() => setShowLobby(false)}
                style={{ position: 'relative', background: '#211F1D', border: '1px solid #302D2A', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>
                Lobby
                {showLobby && (
                  <div style={{ position: 'absolute', top: '110%', left: 0, background: '#211F1D', border: '1px solid #302D2A', borderRadius: 6, padding: 10, width: 230, zIndex: 30, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {(() => {
                      const d = decomposeBuyIn(activeSpot.buyIn, activeSpot.seats);
                      if (d) {
                        return <div>Buy-in: {d.total}€ ({d.parts.map(p => `${p}€`).join(' + ')})</div>;
                      }
                      return <div>Buy-in: {activeSpot.buyIn || '—'}</div>;
                    })()}
                    <div>Format: {activeSpot.format || '—'}</div>
                    <div>Starting stack: {activeSpot.startingStack || '—'}</div>
                    <div>Palier: {activeSpot.palier || '—'}</div>
                    <div>Inscrits: {activeSpot.nbInscrits || '—'}</div>
                  </div>
                )}
              </div>
            </div>

            <Replayer spot={activeSpot} heroCardsOverride={currentHeroCards} />

            {!reveal ? (
              <>
                {!pseudo && <div style={{ fontSize: 11, color: '#E0645A', marginBottom: 8 }}>Renseigne ton pseudo en haut pour apparaître au classement.</div>}
                <RangeGrid comboWeights={playWeights} setComboWeights={setPlayWeights} mode="play" excludedCards={currentHeroCards} />
                <button onClick={submitAttempt} style={{ marginTop: 14, padding: '10px 18px', background: ORANGE, color: '#1A1918', border: 'none', borderRadius: 6, fontWeight: 700 }}>
                  Valider
                </button>
              </>
            ) : (
              <>
                <RangeGrid comboWeights={playWeights} setComboWeights={() => {}} mode="reveal"
                  resultReveal={{ villainKey: reveal.villainKey, found: reveal.found }} excludedCards={currentHeroCards} />
                <div style={{ marginTop: 14, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: reveal.found ? '#6FCF97' : '#C4544A', fontFamily: "'IBM Plex Mono', monospace" }}>{reveal.score} pts</div>
                  <div style={{ fontSize: 13, color: '#9C9691' }}>Combo vilain : <MiniCard card={reveal.villainKey.slice(0, 2)} /> <MiniCard card={reveal.villainKey.slice(2, 4)} /></div>
                </div>
                <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ background: '#211F1D', border: '1px solid #302D2A', borderRadius: 6, padding: '6px 12px', fontSize: 12 }}>
                    <span style={{ color: '#9C9691' }}>Ta sélection : </span>
                    <span style={{ color: '#ECEEF1', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>{reveal.selectedCount} combos</span>
                  </div>
                  <div style={{ background: '#211F1D', border: '1px solid #302D2A', borderRadius: 6, padding: '6px 12px', fontSize: 12 }}>
                    <span style={{ color: '#9C9691' }}>Range de référence : </span>
                    <span style={{ color: ORANGE, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700 }}>{reveal.referenceCount} combos</span>
                  </div>
                </div>
                {activeSpot.mode === 'theorique' && (
                  <button onClick={() => startSpot(activeSpot)} style={{ marginTop: 12, padding: '8px 16px', background: '#302D2A', color: '#ECEEF1', border: 'none', borderRadius: 6, fontSize: 13 }}>
                    Rejouer ce spot (nouveau tirage)
                  </button>
                )}
              </>
            )}
          </div>
          )
        ) : (
          <div style={{ color: '#9C9691', fontSize: 13 }}>Choisis un spot depuis la Bibliothèque pour t'entraîner.</div>
        )
      )}

      {tab === 'ranking' && (
        <div style={{ maxWidth: 480 }}>
          <div style={{ fontSize: 13, color: '#9C9691', marginBottom: 8 }}>Classement général (ratio, min. 5 spots joués)</div>
          <button onClick={async () => setGeneralRanking(await loadGeneralRanking(5))} style={{ marginBottom: 10, padding: '6px 12px', background: '#302D2A', color: '#ECEEF1', border: 'none', borderRadius: 6, fontSize: 12 }}>
            Actualiser
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {generalRanking.length === 0 && <div style={{ fontSize: 12, color: '#556070' }}>Aucun joueur qualifié pour l'instant.</div>}
            {generalRanking.map((p, i) => (
              <div key={p.pseudo} style={{ display: 'flex', justifyContent: 'space-between', background: '#211F1D', border: '1px solid #302D2A', borderRadius: 6, padding: '6px 10px', fontSize: 12 }}>
                <span>#{i + 1} {p.pseudo}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: ORANGE }}>{p.ratio.toFixed(1)} pts/spot · {p.totalSpots} joués</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 13, color: '#9C9691', margin: '20px 0 8px' }}>Top 10 par spot</div>
          <select onChange={async e => setLeaderboard(await loadLeaderboard(e.target.value))} style={{ ...selectStyle, width: '100%', marginBottom: 10 }}>
            <option value="">— choisir un spot —</option>
            {spots.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {leaderboard.map((e, i) => (
              <div key={e.pseudo} style={{ display: 'flex', justifyContent: 'space-between', background: '#211F1D', border: '1px solid #302D2A', borderRadius: 6, padding: '6px 10px', fontSize: 12 }}>
                <span>#{i + 1} {e.pseudo}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: ORANGE }}>{e.score} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div style={{ maxWidth: 520 }}>
          {!pseudo && <div style={{ fontSize: 12, color: '#E0645A', marginBottom: 10 }}>Renseigne ton pseudo en haut pour que ton historique se rattache bien à toi.</div>}
          {myHistory.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9C9691' }}>Aucune tentative enregistrée pour l'instant — joue un spot pour commencer ton historique.</div>
          ) : (
            <>
              {(() => {
                const total = myHistory.length;
                const avg = Math.round(myHistory.reduce((a, h) => a + h.score, 0) / total);
                const best = Math.max(...myHistory.map(h => h.score));
                return (
                  <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                    <div style={{ background: '#211F1D', border: '1px solid #302D2A', borderRadius: 8, padding: '10px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: ORANGE, fontFamily: "'IBM Plex Mono', monospace" }}>{total}</div>
                      <div style={{ fontSize: 10, color: '#9C9691' }}>spots joués</div>
                    </div>
                    <div style={{ background: '#211F1D', border: '1px solid #302D2A', borderRadius: 8, padding: '10px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#ECEEF1', fontFamily: "'IBM Plex Mono', monospace" }}>{avg}</div>
                      <div style={{ fontSize: 10, color: '#9C9691' }}>score moyen</div>
                    </div>
                    <div style={{ background: '#211F1D', border: '1px solid #302D2A', borderRadius: 8, padding: '10px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#6FCF97', fontFamily: "'IBM Plex Mono', monospace" }}>{best}</div>
                      <div style={{ fontSize: 10, color: '#9C9691' }}>meilleur score</div>
                    </div>
                  </div>
                );
              })()}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {myHistory.map((h, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#211F1D', border: '1px solid #302D2A', borderRadius: 6, padding: '7px 12px', fontSize: 12 }}>
                    <div>
                      <div style={{ color: '#ECEEF1' }}>{h.spotName || 'Spot'}</div>
                      <div style={{ fontSize: 10, color: '#9C9691' }}>{h.mode === 'exploit' ? 'Exploit' : 'Théorique'} · {new Date(h.date).toLocaleDateString('fr-FR')}</div>
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: h.found ? '#6FCF97' : '#C4544A' }}>{h.score} pts</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
