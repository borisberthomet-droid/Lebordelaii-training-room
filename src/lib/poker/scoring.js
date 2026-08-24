import { RANKS, SUITS } from './constants';

export function comboOverlapsCards(key, cards) {
  if (!cards || !cards.length) return false;
  const c1 = key.slice(0, 2), c2 = key.slice(2, 4);
  return cards.includes(c1) || cards.includes(c2);
}

export function drawWeightedCombo(weights, excludeCards) {
  const entries = Object.entries(weights).filter(([k, w]) => w > 0 && !comboOverlapsCards(k, excludeCards));
  if (!entries.length) return null;
  const total = entries.reduce((acc, [, w]) => acc + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
  return entries[entries.length - 1][0];
}

// Tire la main de Hero pondérée par une range d'ouverture (ex: range CO configurée
// dans l'admin), au lieu d'un tirage uniforme sur les 1326 combos — sans quoi Hero
// peut se retrouver avec une main hors de toute range réaliste pour la position/l'action.
export function drawWeightedHand(weights) {
  const key = drawWeightedCombo(weights, []);
  return key ? [key.slice(0, 2), key.slice(2, 4)] : drawRandomHand();
}

export function drawRandomHand() {
  const deck = [];
  for (const r of RANKS) for (const s of SUITS) deck.push(r + s);
  const i1 = Math.floor(Math.random() * deck.length);
  const c1 = deck.splice(i1, 1)[0];
  const i2 = Math.floor(Math.random() * deck.length);
  const c2 = deck[i2];
  return [c1, c2];
}

// found = combo réel de Vilain ∈ sélection de l'élève
// si !found → score = 0
// sinon → score = round(100 × (Σ poids_référence des combos sélectionnés) / (nombre de combos sélectionnés))
// Une sélection large qui dilue la densité moyenne est pénalisée même si elle contient le
// bon combo — c'est le mécanisme central qui empêche de "spammer" une sélection énorme.
export function scoreAttempt(selectedKeys, referenceWeights, villainKey) {
  const found = selectedKeys.includes(villainKey);
  let score = 0;
  if (found && selectedKeys.length > 0) {
    const sum = selectedKeys.reduce((acc, k) => acc + (referenceWeights[k] || 0), 0);
    score = Math.round((sum / selectedKeys.length) * 100);
  }
  return { found, score };
}
