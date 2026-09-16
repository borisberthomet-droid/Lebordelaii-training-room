// Main charnière d'une range de défense : la main la plus faible que le défenseur doit encore
// continuer pour ne pas céder à n'importe quel bluff, à une taille de mise donnée.
//
// Définition de Boris : on classe la range du défenseur par FORCE DE MAIN sur le board, de la plus
// forte à la plus faible, et la charnière est la main située à la MDF depuis le haut. Pas par
// équité contre la range qui mise : la question se pose en bluff, où le défenseur paie avec ses
// mains les plus fortes d'abord. Conséquence utile, le classement ne dépend pas de la taille de
// mise — la molette est exacte à toutes les tailles, pas seulement à celle jouée.
//
// Force = meilleure main de 5 cartes sur le board actuel (tirages non comptés, comme dans la
// décomposition). Deux combos de même force se départagent par leur clé, pour un ordre stable.

import { handScore } from "./relativeStrength";

// MDF pour une mise exprimée en % du pot avant la mise : P / (P + B).
export function mdfForSize(sizePct) {
  return 1 / (1 + sizePct / 100);
}

// `combos` : liste de [clé "AhKd", poids]. Renvoie les combos triés du plus fort au plus faible,
// chacun avec la tranche de poids [start, end) qu'il occupe dans la range (fractions de 0 à 1).
export function orderByStrength(combos, board) {
  const scored = combos
    .filter(([, w]) => w > 0)
    .map(([key, weight]) => ({
      key, weight, score: handScore([key.slice(0, 2), key.slice(2, 4), ...board]),
    }))
    .sort((a, b) => b.score - a.score || (a.key < b.key ? -1 : 1));
  const total = scored.reduce((s, c) => s + c.weight, 0);
  let cum = 0;
  return scored.map((c) => {
    const start = cum / total;
    cum += c.weight;
    return { ...c, start, end: cum / total };
  });
}

// Combo dont la tranche contient le seuil : la plus faible main qu'il faut encore défendre.
export function pivotAt(ordered, mdf) {
  for (let i = 0; i < ordered.length; i++) {
    if (ordered[i].end >= mdf - 1e-12) return { ...ordered[i], index: i };
  }
  return { ...ordered[ordered.length - 1], index: ordered.length - 1 };
}
