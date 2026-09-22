// Mise en ordre d'une range pour les molettes : chaque combo reçoit la tranche de poids qu'il
// occupe, de 0 (le haut de la range) à 1 (le bas).
//
// Fonctions de module, pas de code dans le composant : le classement est un calcul, il se teste
// hors navigateur et ne dépend d'aucun rendu.

import { categorize } from "./handCategory";

function avecTranches(scored, board) {
  const total = scored.reduce((s, c) => s + c.weight, 0) || 1;
  const out = [];
  let cum = 0;
  for (const c of scored) {
    const start = cum / total;
    cum += c.weight;
    out.push({
      ...c,
      start,
      end: cum / total,
      cat: categorize([c.key.slice(0, 2), c.key.slice(2, 4)], board),
    });
  }
  return out;
}

const lus = (combos) => combos
  .filter((c) => c[1] > 0)
  .map((c) => ({ key: c[0], weight: c[1], equity: c[2], percentile: c[3] }));

// Ordre de l'exercice : le percentile calculé à la construction, c'est-à-dire l'équité contre la
// range adverse. On s'y tient pour que la molette et la réponse affichée disent la même chose.
export function ordonnerParPercentile(combos, board) {
  const scored = lus(combos).sort((a, b) => a.percentile - b.percentile || (a.key < b.key ? -1 : 1));
  return avecTranches(scored, board);
}

// Même chose, triée sur l'équité brute : utile quand c'est l'équité elle-même qu'on fait varier.
export function ordonnerParEquite(combos, board) {
  const scored = lus(combos).sort((a, b) => b.equity - a.equity || (a.key < b.key ? -1 : 1));
  return avecTranches(scored, board);
}

// Tronçons consécutifs de même catégorie, pour dessiner la barre sans un bloc par combo.
export function tronconsParCategorie(ordered) {
  const out = [];
  for (const c of ordered) {
    const last = out[out.length - 1];
    if (last && last.cat === c.cat) last.end = c.end;
    else out.push({ cat: c.cat, start: c.start, end: c.end });
  }
  return out;
}

// Cran de molette le plus proche d'une taille donnée.
export function cranLePlusProche(crans, valeur) {
  if (valeur == null) return 0;
  let best = 0;
  for (let i = 1; i < crans.length; i++) {
    if (Math.abs(crans[i] - valeur) < Math.abs(crans[best] - valeur)) best = i;
  }
  return best;
}
