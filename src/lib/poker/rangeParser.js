import { RANKS } from './constants';
import { ALL_CLASSES, comboKey, getClassCombos } from './combos';

export function expandPlus(token) {
  const m = token.match(/^([2-9TJQKA])([2-9TJQKA])?([so])?\+$/);
  if (!m) return null;
  const [, r1, r2, suited] = m;
  // Notation paire, à la fois "7+" et "77+" doivent désigner l'échelle de paires
  // 22..77 — sans ce cas, "77+"/"QQ+" tombe dans la branche connecteurs ci-dessous
  // où hi===lo0, ce qui produit une liste vide au lieu de l'échelle attendue.
  if (!r2 || r1 === r2) {
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

export function isComboToken(tok) {
  return /^[2-9TJQKA][cdhs][2-9TJQKA][cdhs]$/.test(tok);
}

export function parsePastedRange(text, minWeight = 0) {
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
    if (w <= 0 || w < minWeight) continue;
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

// Ne garde, dans la range "principale" (le sizing réellement joué), que les combos pour lesquels
// ce sizing est réellement l'action la plus fréquente du solveur — exclut les mains qui n'y
// apparaissent que par un résidu de stratégie mixée (ex: 20% ici, mais 45% sur un autre sizing).
export function filterDominantCombos(primaryWeights, competingWeightsList) {
  const result = {};
  for (const [key, w] of Object.entries(primaryWeights)) {
    const beaten = competingWeightsList.some(other => (other[key] || 0) > w);
    if (!beaten) result[key] = w;
  }
  return result;
}
