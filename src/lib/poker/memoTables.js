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

export const ELASTICITY_LEVELS = [
  { level: 1, k: 2.7, label: "Deep, vs open raise", color: "#4FA8E0" },
  { level: 2, k: 3.5, label: "Semi-commit", color: "#6FCF97" },
  { level: 3, k: 4.0, label: "All-in, jammeur large/deep", color: "#E8C547" },
  { level: 4, k: 4.6, label: "All-in, jammeur tight early", color: "#E89A47" },
  { level: 5, k: 5.5, label: "Chasse ouverte", color: "#E0645A" },
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

// Repères de la courbe RP = f(ratio KO/stack du vilain). Mesures solver de Boris.
// La formule log exacte n'est pas connue ici — on n'affiche que ces points mesurés plutôt
// que d'extrapoler une courbe ajustée qui aurait l'air officielle sans l'être.
export const RP_BY_BOUNTY_RATIO = [
  { ratio: 50, rp: -10 },
  { ratio: 100, rp: -16 },
  { ratio: 200, rp: -25 },
];

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
