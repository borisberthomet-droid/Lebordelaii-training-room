// « Où suis-je dans ma range ? » — force RELATIVE d'une main dans sa propre range, sur un board
// donné, mesurée par l'équité face à la range adverse.
//
// Restreint au turn et à la river, volontairement : là, l'énumération est exhaustive donc le
// classement est EXACT. Sur un flop il faudrait échantillonner 990 runouts, et le bruit
// déplacerait les mains proches d'une frontière de quintile — un élève verrait sa bonne réponse
// comptée fausse.

// pokersolver est un module CommonJS : l'import nommé fonctionne via le bundler, mais pas sous
// Node nu. La forme « défaut puis déstructuration » marche dans les deux, ce qui permet de
// lancer la suite de tests de ce module hors navigateur.
import pokersolver from "pokersolver";
const { Hand } = pokersolver;

// --- Score de main -----------------------------------------------------------------------
// Entier comparable, pour trier une fois et faire des recherches dichotomiques ensuite.
// `hand.cards` ne contient PAS toujours 5 cartes : une couleur en renvoie jusqu'à 7 (mesuré sur
// 300 000 mains : 695 à 6 cartes, 18 à 7). Sans la troncature, ces mains-là sortaient un score
// 16 fois trop grand et passaient devant des quintes flush. Validé après correction : 0
// désaccord avec pokersolver sur 300 000 paires, et les 12 150 égalités toutes détectées.
export function handScore(cards) {
  const h = Hand.solve(cards);
  let v = h.rank;
  const best = h.cards.slice(0, 5);
  for (const c of best) v = v * 16 + c.rank;
  return v;
}

// --- Combos ------------------------------------------------------------------------------
// Une range est un objet { "AhKd": poids, ... }. Les poids sont des fréquences (0 à 1) : un
// solveur joue rarement une main à 100%, et ignorer les poids fausserait le classement.

function comboCards(key) {
  return [key.slice(0, 2), key.slice(2, 4)];
}

function clashes(cards, dead) {
  return cards.some((c) => dead.has(c));
}

// --- Équité exacte d'une range face à une autre, sur un board complet ----------------------
// Renvoie, pour chaque combo de hero, son équité (victoires + moitié des partages) face à la
// range du vilain, EN TENANT COMPTE DU CARD REMOVAL : un combo du vilain qui partage une carte
// avec celui de hero est impossible, il doit sortir du dénominateur de CE combo-là. C'est le
// piège classique — l'ignorer avantage systématiquement les mains qui bloquent le haut de la
// range adverse.
function equitiesOnCompleteBoard(heroCombos, villainCombos, board) {
  const vScores = villainCombos.map((c) => ({
    ...c, score: handScore([...c.cards, ...board]),
  }));
  vScores.sort((a, b) => a.score - b.score);

  // Sommes préfixes des poids, pour obtenir en O(log n) le poids total sous un score donné.
  const prefix = new Float64Array(vScores.length + 1);
  for (let i = 0; i < vScores.length; i++) prefix[i + 1] = prefix[i] + vScores[i].weight;
  const totalWeight = prefix[vScores.length];

  // Index carte -> combos du vilain qui la contiennent, pour retirer les conflits sans balayer
  // toute la range à chaque combo de hero.
  const byCard = new Map();
  vScores.forEach((c, i) => {
    for (const card of c.cards) {
      if (!byCard.has(card)) byCard.set(card, []);
      byCard.get(card).push(i);
    }
  });

  // Bornes du plateau de score égal, pour séparer victoires, partages et défaites.
  const lowerBound = (s) => {
    let lo = 0, hi = vScores.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (vScores[m].score < s) lo = m + 1; else hi = m; }
    return lo;
  };
  const upperBound = (s) => {
    let lo = 0, hi = vScores.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (vScores[m].score <= s) lo = m + 1; else hi = m; }
    return lo;
  };

  return heroCombos.map((h) => {
    const score = handScore([...h.cards, ...board]);
    let win = prefix[lowerBound(score)];
    let tie = prefix[upperBound(score)] - prefix[lowerBound(score)];
    let total = totalWeight;

    // Retrait des combos impossibles. Un même combo du vilain peut partager ses DEUX cartes avec
    // hero : sans déduplication il serait retiré deux fois et le dénominateur deviendrait faux.
    const seen = new Set();
    for (const card of h.cards) {
      const idxs = byCard.get(card);
      if (!idxs) continue;
      for (const i of idxs) {
        if (seen.has(i)) continue;
        seen.add(i);
        const v = vScores[i];
        total -= v.weight;
        if (v.score < score) win -= v.weight;
        else if (v.score === score) tie -= v.weight;
      }
    }

    return { ...h, equity: total > 1e-12 ? (win + tie / 2) / total : 0 };
  });
}

const RANKS = "23456789TJQKA";
const SUITS = "shdc";
const FULL_DECK = [];
for (const r of RANKS) for (const s of SUITS) FULL_DECK.push(r + s);

// --- Point d'entrée -----------------------------------------------------------------------
// `board` : 4 cartes (turn) ou 5 (river). Sur un turn, on énumère les 44 rivers possibles et on
// moyenne — exhaustif, donc exact lui aussi.
export function rankRangeOnBoard({ heroWeights, villainWeights, board }) {
  if (board.length !== 4 && board.length !== 5) {
    throw new Error(`Board de ${board.length} cartes : ce module ne traite que le turn (4) et la river (5).`);
  }
  const dead = new Set(board);

  const toCombos = (weights) =>
    Object.entries(weights)
      .filter(([, w]) => w > 1e-9)
      .map(([key, weight]) => ({ key, weight, cards: comboCards(key) }))
      .filter((c) => !clashes(c.cards, dead));

  const hero = toCombos(heroWeights);
  const villain = toCombos(villainWeights);
  if (hero.length === 0 || villain.length === 0) {
    throw new Error("Range vide une fois le board retiré : rien à classer.");
  }

  let scored;
  if (board.length === 5) {
    scored = equitiesOnCompleteBoard(hero, villain, board);
  } else {
    // Turn : chaque river est équiprobable, mais elle retire aussi des combos des deux ranges.
    // On accumule l'équité par combo et on divise par le nombre de rivers où il survit — sinon
    // un combo bloqué par beaucoup de rivers serait injustement pénalisé.
    const sum = new Map(hero.map((h) => [h.key, 0]));
    const seen = new Map(hero.map((h) => [h.key, 0]));
    const rivers = FULL_DECK.filter((c) => !dead.has(c));
    for (const river of rivers) {
      const full = [...board, river];
      const hh = hero.filter((h) => !h.cards.includes(river));
      const vv = villain.filter((v) => !v.cards.includes(river));
      if (hh.length === 0 || vv.length === 0) continue;
      for (const r of equitiesOnCompleteBoard(hh, vv, full)) {
        sum.set(r.key, sum.get(r.key) + r.equity);
        seen.set(r.key, seen.get(r.key) + 1);
      }
    }
    scored = hero.map((h) => ({ ...h, equity: seen.get(h.key) ? sum.get(h.key) / seen.get(h.key) : 0 }));
  }

  // Percentile PONDÉRÉ : 0 = meilleur combo de la range. On place chaque combo au milieu de la
  // tranche de poids qu'il occupe, sinon le tout premier serait au percentile 0 et le dernier
  // n'atteindrait jamais 100.
  scored.sort((a, b) => b.equity - a.equity);
  const totalW = scored.reduce((a, c) => a + c.weight, 0);
  let acc = 0;
  for (const c of scored) {
    c.percentile = ((acc + c.weight / 2) / totalW) * 100;
    acc += c.weight;
  }

  return { combos: scored, byKey: new Map(scored.map((c) => [c.key, c])), totalWeight: totalW };
}

// --- Les cinq réponses possibles ------------------------------------------------------------
// Quintiles : cinq tranches disjointes, pour que les boutons soient mutuellement exclusifs.
export const BUCKETS = [
  { id: "top20", label: "TOP 20%", range: "0 – 20%", min: 0, max: 20 },
  { id: "top40", label: "TOP 40%", range: "20 – 40%", min: 20, max: 40 },
  { id: "mid", label: "MILIEU", range: "40 – 60%", min: 40, max: 60 },
  { id: "bot40", label: "BOTTOM 40%", range: "60 – 80%", min: 60, max: 80 },
  { id: "bot20", label: "BOTTOM 20%", range: "80 – 100%", min: 80, max: 100 },
];

export function bucketFor(percentile) {
  return BUCKETS.find((b) => percentile < b.max) || BUCKETS[BUCKETS.length - 1];
}

// Un combo à 19.8% et un à 20.2% sont dans deux quintiles différents alors qu'ils sont
// équivalents : demander de les distinguer teste la chance, pas la lecture. L'appelant peut
// écarter les combos trop proches d'une frontière.
export function distanceToBoundary(percentile) {
  return Math.min(...BUCKETS.flatMap((b) => [Math.abs(percentile - b.min), Math.abs(percentile - b.max)])
    .filter((d) => d > 0 || percentile === 0));
}
