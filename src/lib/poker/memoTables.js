// Données et formules des fiches mémo (/memo). Tout ce qui est calculable l'est ici à partir
// des formules (pas de valeurs recopiées à la main) ; les tables issues de mesures solver de
// Boris sont stockées telles quelles et marquées comme telles.

// ---------------------------------------------------------------------------
// POT ODDS — tout est dérivé de P (pot) et B (mise), pot normalisé à 1.
// ---------------------------------------------------------------------------

export const BET_SIZES_PCT = [10, 20, 25, 33, 35, 40, 50, 65, 66, 70, 75, 80, 100, 125, 150, 200, 300];

// Une ligne complète de la table pot odds pour un sizing donné (% du pot).
export function potOddsRow(betPct) {
  const pot = 1;
  const bet = betPct / 100;
  const cote = (pot + bet) / bet;              // cote offerte au défenseur (X:1)
  const callEquity = bet / (pot + 2 * bet);    // équité nécessaire pour call
  const mdf = pot / (pot + bet);               // minimum defense frequency
  const mff = bet / (pot + bet);               // minimum fold frequency (= alpha)
  const valueBetEquity = 1 - mdf / 2;          // équité min. pour value bet vs range totale
  // Alpha (Deep Dive) : nombre de combos de bluff PAR combo de value = B/(P+B).
  // Identique à la MFF — même quantité, lue soit comme une fréquence, soit comme un ratio
  // bluff:value. Le "% de bluffs dans la range de mise" (callEquity) est encore autre chose :
  // c'est bluffs/(value+bluffs) et non bluffs/value.
  const alpha = bet / (pot + bet);
  return { betPct, cote, callEquity, mdf, mff, valueBetEquity, alpha };
}

export const POT_ODDS_ROWS = BET_SIZES_PCT.map(potOddsRow);

// Combos de bluff nécessaires pour un nombre de combos de value donné.
export function bluffCombosFor(betPct, valueCombos) {
  return valueCombos * potOddsRow(betPct).alpha;
}

// ---------------------------------------------------------------------------
// PKO — élasticité : multiplicateur de range en fonction du Risk Premium.
// Formule M = e^(k × |RP|), vérifiée contre les 5 courbes du graphe de Boris
// (k=2.7 → ×2.25, k=3.5 → ×2.86, k=4.0 → ×3.32, k=4.6 → ×3.97, k=5.5 → ×5.21 à RP=-30%).
// ---------------------------------------------------------------------------

// Critères issus de PKO_framework_reference.md §4. Fiabilité inégale, signalée telle quelle :
// niveaux 1/3/4 solides (2 à 4 mesures chacun), niveau 2 une seule mesure, niveau 5 trois
// mesures dont deux avec des arbres d'actions asymétriques — la bande 5–6 tient, pas la décimale.
export const ELASTICITY_LEVELS = [
  { level: 1, k: 2.7, label: "Deep 40bb+, vs open raise, postflop à jouer", color: "#4FA8E0", solid: true },
  { level: 2, k: 3.5, label: "Semi-commit, le porteur du KO coûte cher à attaquer", color: "#6FCF97", solid: false },
  { level: 3, k: 4.0, label: "All-in, jammeur large (BTN/SB) ou deep (15-25bb)", color: "#E8C547", solid: true },
  { level: 4, k: 4.6, label: "All-in, jammeur tight en early position, 8-12bb", color: "#E89A47", solid: true },
  { level: 5, k: 5.5, label: "Chasseur qui couvre la prime, peut agir, et à bas coût", color: "#E0645A", solid: false },
];

export function rangeMultiplier(k, rpAbs) {
  return Math.exp(k * rpAbs);
}

export const ELASTICITY_RP_STEPS = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30];

// ---------------------------------------------------------------------------
// PKO — mesures solver de Boris, stockées telles quelles (pas de formule dérivée).
// ---------------------------------------------------------------------------

// RP Max en table finale selon le ratio prizepool KO / prizepool régulier.
// Source : ICM exact Malmuth-Weitzman + bounty, 6-7 joueurs, distribution de stacks réaliste.
export const RP_MAX_BY_KO_RATIO = [
  { ratio: 0, rpMax: 20.1, note: "sans KO" },
  { ratio: 20, rpMax: 14.3 },
  { ratio: 30, rpMax: 12.5 },
  { ratio: 40, rpMax: 11.1 },
  { ratio: 60, rpMax: 9.1 },
  { ratio: 80, rpMax: 7.7 },
  { ratio: 100, rpMax: 6.7, highlight: true },
  { ratio: 150, rpMax: 5.1 },
  { ratio: 200, rpMax: 4.1 },
  { ratio: 400, rpMax: 2.3 },
];

// Valeur encaissable d'un KO de base (en starting stacks) selon la taille du field en TF.
export const KO_VALUE_BY_FIELD = [
  { field: 45, value: 0.375, chips: 7500 },
  { field: 100, value: 0.44, chips: 8800 },
  { field: 1000, value: 0.77, chips: 15000 },
  { field: 3000, value: 1.0, chips: 20000 },
];

// RP = f(r), r = valeur du KO / stack du vilain.
// Formule du framework de Boris (PKO_framework_reference.md §3), validée sur 6 spots solver
// indépendants de r=0.29 à r=2.38. Vérifiée ici contre sa propre table mémorisable :
// écart max 0.56 pt, dans sa tolérance annoncée de ±1 pt.
// Le tassement logarithmique est mesuré, pas supposé : à r=2.38 une extrapolation linéaire
// prédirait -38%, le solveur donne -27%. Ne jamais linéariser.
export function riskPremiumFromRatio(r) {
  return -19 * Math.log(1 + 1.31 * r);
}

export const RP_RATIO_STEPS = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 2.4, 3.0];

// --- α(FL) : valeur encaissable d'un KO de base, en fraction du starting stack ---
// α est universel POUR UNE STRUCTURE DONNÉE : identique de 100 à 3000 inscrits, seul le % de
// field restant compte. En revanche la répartition du buy-in change la table, et l'écart n'est
// pas anecdotique : ~11% sur α, soit ~1 point de RP.
// Générateur porté depuis le framework, points de contrôle α_brut vérifiés à 0.1% près
// (100% FL → 0.5556 vs 0.556 · 50% → 0.6463 vs 0.646 · 30% → 0.6995 vs 0.699).
export function generateAlphaTable(bountyRatio = 0.5, regRatio = 0.4, gamma = 3.0) {
  const N = 1000;
  const bountyBase = bountyRatio;
  const ppReg = N * regRatio;
  let ppKO = N * bountyRatio;
  const table = { 1: bountyBase / ((ppReg + ppKO) / N) };
  for (let k = N; k > 1; k--) {
    const fl = k / N;
    const beta = Math.pow(1 - fl, gamma);
    const bountyElim = beta * (ppKO / k) + (1 - beta) * bountyBase;
    ppKO -= 0.5 * bountyElim; // moitié encaissée = sort du pool
    table[(k - 1) / N] = bountyBase / ((ppReg + ppKO) / N); // α BRUT
  }
  return table;
}

// α encaissable = α brut × 0.5 en PKO progressif (l'autre moitié roule sur notre tête).
export function alphaEncaissable(table, fl) {
  return table[Math.round(fl * 1000) / 1000] * 0.5;
}

// --- Structures de répartition du buy-in -----------------------------------------------------
// C'est ce qui distingue un Space KO d'un PKO 50/50, et ça change α d'environ 11%. Le prizePool
// SharkScope est le pool NET total (vérifié : prizePool = entrants × stake sur les 7 tournois de
// la bibliothèque) — il ne dit pas comment il se répartit entre KO et régulier. La structure est
// donc une donnée à saisir, pas à deviner depuis les résultats.
export const PKO_STRUCTURES = [
  {
    id: "sko",
    label: "Space KO",
    short: "SKO",
    bountyRatio: 0.50,
    regRatio: 0.40,
    rake: 0.10,
    note: "50% du buy-in dans les KO, 40% au prizepool régulier, 10% de rake.",
  },
  {
    id: "pko5050",
    label: "PKO 50/50",
    short: "PKO",
    bountyRatio: 0.45,
    regRatio: 0.45,
    rake: 0.10,
    note: "45% du buy-in dans les KO, 45% au prizepool régulier, 10% de rake.",
  },
];

// Défaut : Space KO. Mesuré sur la bibliothèque, en partant du fait que TOUS les gains réguliers
// vont à des places payées — donc Σ(prize − composante bounty) sur la grille EST le prizepool
// régulier, et le reste du pool net est le pool KO. Six des sept tournois donnent 50.0% du
// buy-in dans les KO (50.5% pour le W Series, arrondis de grille), ce qui est la signature du
// Space KO. Seul le HIGHROLLER 250€ à 63 entrants mesure 42.8%, plus proche du PKO 50/50 — mais
// sa grille est trop petite et trop trouée pour trancher.
export const DEFAULT_STRUCTURE_ID = "sko";

export function pkoStructure(id) {
  return PKO_STRUCTURES.find((s) => s.id === id) || PKO_STRUCTURES.find((s) => s.id === DEFAULT_STRUCTURE_ID);
}

// Tables α générées une fois par structure (le générateur boucle sur 1000 pas, inutile de le
// relancer à chaque question).
const ALPHA_TABLE_CACHE = new Map();

export function alphaTableFor(structureId) {
  const s = pkoStructure(structureId);
  if (!ALPHA_TABLE_CACHE.has(s.id)) {
    ALPHA_TABLE_CACHE.set(s.id, generateAlphaTable(s.bountyRatio, s.regRatio));
  }
  return ALPHA_TABLE_CACHE.get(s.id);
}

export function alphaFor(structureId, fl) {
  return alphaEncaissable(alphaTableFor(structureId), fl);
}

// Table de référence du framework, telle qu'écrite dans le document de Boris. Elle décrit le
// SPACE KO (50/40/10) : c'est elle qui donne le 0.32 à 50% FL. Le PKO 50/50 (45/45/10) donne
// 0.29 au même stade — les deux sortent du même générateur, seule la structure change.
//
// Au-delà de ~20% FL le générateur diverge de ces valeurs (FL 10% : 0.408 calculé vs 0.43 doc ;
// FL 3% : 0.475 vs 0.60) — attendu et documenté : le générateur suppose le prizepool régulier
// intact, ce qui cesse d'être vrai après l'ITM (les places déjà payées sortent du pool, donc le
// KO vaut ENCORE plus). Sous l'ITM, c'est le calcul observable (pilier 3) qui fait foi.
export const ALPHA_REFERENCE = [
  { fl: 100, alpha: 0.28 },
  { fl: 70, alpha: 0.30 },
  { fl: 50, alpha: 0.32, shortcut: true },
  { fl: 40, alpha: 0.34 },
  { fl: 30, alpha: 0.35, limit: true },
  { fl: 20, alpha: 0.37 },
  { fl: 10, alpha: 0.43, postItm: true },
  { fl: 5, alpha: 0.52, postItm: true },
  { fl: 3, alpha: 0.60, postItm: true },
  { fl: 1, alpha: 0.75, postItm: true },
];

// Zone où le générateur α reste valide : au-dessus de l'ITM, le prizepool régulier est encore
// intact, hypothèse sur laquelle il repose.
const ALPHA_GENERATOR_MIN_FL = 0.20;

// Colonne PKO 50/50 de la table de référence.
//   - FL ≥ 20% : générateur direct. Il reproduit la colonne SKO du document à 0.005 près, donc
//     rien ne justifie de passer par un rapport — et surtout, partir du 0.32 DÉJÀ ARRONDI du
//     document donnerait 0.283 au lieu de 0.286 à 50% FL, soit 0.28 affiché au lieu de 0.29.
//   - Sous l'ITM : le générateur diverge (il ignore les places déjà payées), donc on part de la
//     valeur mesurée du document et on lui applique le rapport des deux structures. Ce rapport
//     est stable (1.11 à 1.16 de 100% à 10% FL) là où les valeurs absolues ne le sont pas.
export function alphaReferenceRows() {
  return ALPHA_REFERENCE.map((row) => {
    const fl = row.fl / 100;
    const alphaPko = fl >= ALPHA_GENERATOR_MIN_FL
      ? alphaFor("pko5050", fl)
      : row.alpha * (alphaFor("pko5050", fl) / alphaFor("sko", fl));
    return { ...row, alphaSko: row.alpha, alphaPko };
  });
}

// Seuils de call (équité requise) selon la valeur du KO, en BB. Mesures solver.
export const CALL_THRESHOLD_OPEN_SHOVE = {
  title: "BB face à un open shove",
  koSteps: [0, 10],
  rows: [
    { spot: "vs OS 10bb", noKo: 44, atKo10: 29.5 },
    { spot: "vs OS 15bb", noKo: 46, atKo10: 34.6 },
    { spot: "vs OS 20bb", noKo: 47, atKo10: 37.6 },
  ],
};

export const CALL_THRESHOLD_RESTEAL = {
  title: "Call vs resteal (3bet jam)",
  koSteps: [0, 10],
  rows: [
    { spot: "vs resteal 15bb", noKo: 42, atKo10: 31.6 },
    { spot: "vs resteal 25bb", noKo: 45, atKo10: 37.7 },
    { spot: "vs resteal 40bb", noKo: 47, atKo10: 41.8 },
  ],
};

// Resserrement de la range d'agression du vilain selon le nombre de bounties sur sa tête.
export const VILLAIN_TIGHTENING = [
  { spot: "JAM 10bb", relative: -4, points: [{ ko: 0, pct: 24 }, { ko: 1, pct: 23 }, { ko: 3, pct: 20 }] },
  { spot: "JAM 20bb", relative: -25, points: [{ ko: 0, pct: 14 }, { ko: 1, pct: 10 }] },
  { spot: "OPEN 40bb", relative: -20, points: [{ ko: 0, pct: 23 }, { ko: 1, pct: 18 }, { ko: 2, pct: 15 }] },
];
