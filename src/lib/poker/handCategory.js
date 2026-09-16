// Catégorie d'une main sur un board, et décomposition d'une range en catégories.
//
// Les définitions sont celles de Boris, pas celles du moteur d'évaluation. L'écart compte : sur
// un board pairé, pokersolver appelle « double paire » une main qui ne touche qu'une carte, alors
// qu'à la table c'est une paire. Mesuré sur les ranges du solveur, ce seul cas pèse 10% des combos
// à la river — suivre le moteur aurait faussé une réponse sur dix.
//
// Règles retenues :
//   - DP+ = double paire ou mieux faite avec au moins une carte privative. Sur board pairé, la
//     catégorie devient Trips+ : la paire du board ne compte pas.
//   - Overpair = paire servie au-dessus de la plus haute carte du board.
//   - Toute autre paire servie qui n'améliore pas est une Underpair, même entre deux cartes du board.
//   - Une carte privative qui touche le board donne une paire nommée par la hauteur DISTINCTE de la
//     carte touchée : sur K K 7 3 2, 7x est 2nde paire. Au-delà de la 4e hauteur (river à cinq
//     hauteurs), on reste en 4e paire.
//   - Pas de paire = Air, tirage ou non.

const RANKS = "23456789TJQKA";
const value = (card) => RANKS.indexOf(card[0]) + 2;
const suitOf = (card) => card[1];

export const CATEGORIES = [
  { id: "made", label: "DP+", pairedLabel: "Trips+", color: "#34D399" },
  { id: "overpair", label: "Overpair", color: "#7ED0F0" },
  { id: "tp", label: "TP", color: "#4FA8E0" },
  { id: "p2", label: "2nde paire", color: "#8B8FE8" },
  { id: "p3", label: "3e paire", color: "#B98BE0" },
  { id: "p4", label: "4e paire", color: "#E08BC0" },
  { id: "underpair", label: "Underpair", color: "#E8C547" },
  { id: "air", label: "Air", color: "#6B7280" },
];

const PAIR_BY_POSITION = ["tp", "p2", "p3", "p4"];

export function boardIsPaired(board) {
  return new Set(board.map((c) => c[0])).size < board.length;
}

export function categoryLabel(cat, board) {
  return cat.id === "made" && boardIsPaired(board) ? cat.pairedLabel : cat.label;
}

// Une catégorie de paire n'existe que si le board a assez de hauteurs distinctes : pas de 4e paire
// sur un turn pairé. Les proposer quand même serait un piège sur le board, pas sur la range.
export function availableCategories(board) {
  const distinct = new Set(board.map((c) => c[0])).size;
  return CATEGORIES.filter((c) => {
    const pos = PAIR_BY_POSITION.indexOf(c.id);
    return pos < 0 || pos < distinct;
  });
}

function straightHigh(values) {
  const set = new Set(values);
  if (set.has(14)) set.add(1);
  for (let hi = 14; hi >= 5; hi--) {
    let ok = true;
    for (let k = 0; k < 5 && ok; k++) ok = set.has(hi - k);
    if (ok) return hi;
  }
  return 0;
}

// Couleur jouée par une carte privative. Si le board porte déjà cinq cartes de la couleur, la carte
// privative doit battre la plus petite des cinq meilleures, sinon c'est le board qui joue.
function makesFlush(hole, board) {
  for (const s of ["s", "h", "d", "c"]) {
    const boardSuited = board.filter((c) => suitOf(c) === s).map(value).sort((a, b) => b - a);
    const holeSuited = hole.filter((c) => suitOf(c) === s).map(value);
    if (!holeSuited.length || boardSuited.length + holeSuited.length < 5) continue;
    if (boardSuited.length < 5) return true;
    if (Math.max(...holeSuited) > boardSuited[4]) return true;
  }
  return false;
}

export function categorize(hole, board) {
  const boardValues = board.map(value);
  const holeValues = hole.map(value);
  const count = {};
  for (const v of boardValues) count[v] = (count[v] || 0) + 1;
  const distinct = Object.keys(count).map(Number).sort((a, b) => b - a);
  const paired = distinct.length < board.length;

  if (makesFlush(hole, board)) return "made";
  if (straightHigh([...boardValues, ...holeValues]) > straightHigh(boardValues)) return "made";

  if (holeValues[0] === holeValues[1]) {
    const p = holeValues[0];
    if (count[p]) return "made";                       // brelan servi, full ou carré
    return p > distinct[0] ? "overpair" : "underpair";
  }

  const touched = holeValues.filter((v) => count[v]);
  if (touched.some((v) => count[v] >= 2)) return "made"; // brelan avec la paire du board
  if (touched.length === 2 && !paired) return "made";    // vraie double paire
  if (touched.length) {
    const pos = Math.min(...touched.map((v) => distinct.indexOf(v)));
    return PAIR_BY_POSITION[Math.min(pos, 3)];
  }
  return "air";
}

// `combos` : liste de [clé "AhKd", poids]. Renvoie la part de chaque catégorie, en pourcentage du
// poids total — c'est la fréquence réelle de la range, pas un simple décompte de combos.
export function decompose(combos, board) {
  const weights = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0]));
  const classes = Object.fromEntries(CATEGORIES.map((c) => [c.id, {}]));
  let total = 0;
  for (const [key, w] of combos) {
    if (!(w > 0)) continue;
    const hole = [key.slice(0, 2), key.slice(2, 4)];
    const cat = categorize(hole, board);
    weights[cat] += w;
    total += w;
    const cls = handClass(hole);
    classes[cat][cls] = (classes[cat][cls] || 0) + w;
  }
  const pct = Object.fromEntries(
    Object.entries(weights).map(([k, w]) => [k, total > 0 ? (w / total) * 100 : 0])
  );
  return { pct, weights, classes, total };
}

// Nom de classe « AKs », « T9o », « 77 » pour lister ce qui compose chaque catégorie.
export function handClass([a, b]) {
  const [hi, lo] = value(a) >= value(b) ? [a, b] : [b, a];
  if (hi[0] === lo[0]) return hi[0] + lo[0];
  return hi[0] + lo[0] + (suitOf(hi) === suitOf(lo) ? "s" : "o");
}

// Erreur d'une décomposition estimée : la part de la range mal attribuée, en points. C'est la
// moitié de la somme des écarts absolus — chaque point placé dans la mauvaise catégorie manque
// forcément dans une autre, le compter deux fois doublerait l'erreur.
export function decompositionError(guess, truth) {
  let sum = 0;
  for (const c of CATEGORIES) sum += Math.abs((guess[c.id] || 0) - (truth[c.id] || 0));
  return sum / 2;
}
