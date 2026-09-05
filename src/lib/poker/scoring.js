import { RANKS, SUITS } from './constants';

export function comboOverlapsCards(key, cards) {
  if (!cards || !cards.length) return false;
  const c1 = key.slice(0, 2), c2 = key.slice(2, 4);
  return cards.includes(c1) || cards.includes(c2);
}

// Le board arrive sous des formes très différentes selon la source : saisi à la main dans
// l'admin ("As Kd 7h"), et collé d'un coup par HRC qui l'écrit SANS séparateur ("Js6h3d").
// Un découpage sur les espaces ratait complètement le second cas et rendait un board vide.
// On balaie donc les couples rang+couleur, ce qui couvre les deux et ignore le reste.
export function parseBoardCards(board) {
  if (!board) return [];
  const re = new RegExp(`[${RANKS.join("")}][${SUITS.join("")}]`, "g");
  return String(board).match(re) || [];
}

// Cartes déjà connues au moment où l'élève dessine : les siennes ET le board. Un combo qui en
// contient une est impossible pour le vilain — le proposer, c'est laisser l'élève dépenser des
// combos sur des mains qui n'existent pas, et fausser son score.
export function knownCards(heroCards, board) {
  return [...(heroCards || []).filter(Boolean), ...parseBoardCards(board)];
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
// `excludeCards` : les cartes du board. Sans ce retrait, Hero pouvait recevoir une carte
// posée sur le tapis.
export function drawWeightedHand(weights, excludeCards = []) {
  const key = drawWeightedCombo(weights, excludeCards);
  return key ? [key.slice(0, 2), key.slice(2, 4)] : drawRandomHand(excludeCards);
}

export function drawRandomHand(excludeCards = []) {
  const deck = [];
  for (const r of RANKS) for (const s of SUITS) if (!excludeCards.includes(r + s)) deck.push(r + s);
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
