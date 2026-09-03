// Les stades de tournoi sélectionnables dans le RP Trainer, et l'aiguillage vers le moteur
// qui est réellement valide à chaque stade. C'est le point délicat du module : les trois
// piliers du framework de Boris n'ont pas la même zone de validité, et afficher un RP calculé
// hors de sa zone reviendrait à enseigner un chiffre faux.
//
//   pilier 1 (framework α → r → RP)  : 100% → ~30% FL, hors ICM        → validé 15+ sims
//   pilier 3 (calcul observable)     : ITM → TF, valeur du KO exacte    → arithmétique
//   pilier 2 (ICM exact + bounty)    : table finale                     → moteur porté et testé

import { payoutStructure, riskPremium } from "./icmBounty";
import { solveFrameworkSpot, generateFrameworkSpot } from "./rpFramework";

// `kind` : 'framework' = chaîne hors-ICM · 'icm' = moteur ICM (exact ou Monte-Carlo).
// `playersLeft` : soit une fraction du field (fl), soit un nombre absolu (abs).
export const STAGES = [
  { id: "fl100", label: "100% FL", short: "100%", fl: 1.0, kind: "framework" },
  { id: "fl50", label: "50% FL", short: "50%", fl: 0.5, kind: "framework" },
  { id: "fl25", label: "25% FL", short: "25%", fl: 0.25, kind: "framework", belowIcmLimit: true },
  { id: "fl18", label: "18% FL", short: "18%", fl: 0.18, kind: "framework", belowIcmLimit: true },
  { id: "bubble", label: "Bulle", short: "Bulle", atBubble: true, kind: "framework", belowIcmLimit: true },
  { id: "fl10", label: "10% FL", short: "10%", fl: 0.10, kind: "framework", belowIcmLimit: true },
  // 3 et 2 tables restent sur le framework : l'ICM exact y est hors de portée (O(n!)) et le
  // Monte-Carlo, mesuré, laisse ±3 points d'amplitude sur le RP — plus large que la tolérance
  // de correction (±2). Descendre sous 0.5 point demanderait ~4M d'itérations, soit ~8 s par
  // question. On préfère annoncer la limite plutôt qu'afficher un chiffre instable.
  { id: "t3", label: "3 tables", short: "3 tbl", abs: 27, kind: "framework", belowIcmLimit: true, icmOutOfReach: true },
  { id: "t2", label: "2 tables", short: "2 tbl", abs: 18, kind: "framework", belowIcmLimit: true, icmOutOfReach: true },
  { id: "ft", label: "Table finale", short: "TF", abs: 9, kind: "icm" },
];

// Structures de payout proposées. Les 7 tournois Winamax de la bibliothèque paient tous
// 12.5–13.0% du field (mesuré sur leurs vraies grilles) ; 15% et 20% couvrent les autres
// opérateurs. Le % payé déplace la bulle, donc change le stade « Bulle » et la pression ICM.
export const PAYOUT_PCTS = [
  { value: 0.125, label: "12.5% payés", note: "standard Winamax (mesuré sur les 7 tournois)" },
  { value: 0.15, label: "15% payés", note: "structure plus large" },
  { value: 0.20, label: "20% payés", note: "structure très large" },
];

// Nombre de joueurs restants correspondant à un stade, pour un field et un % payé donnés.
export function playersLeftAt(stage, totalEntries, pctPaid) {
  if (stage.abs) return Math.min(stage.abs, totalEntries);
  if (stage.atBubble) return Math.max(2, Math.round(totalEntries * pctPaid) + 1);
  return Math.max(2, Math.round(totalEntries * stage.fl));
}

export function fieldLeftAt(stage, totalEntries, pctPaid) {
  return playersLeftAt(stage, totalEntries, pctPaid) / totalEntries;
}

// Grille de gains RÉGULIERS encore à distribuer, en partant de la vraie table de payout du
// tournoi (composante bounty retirée : elle est traitée à part par le moteur). Si le tournoi
// n'a pas assez de places renseignées, on retombe sur les profils de table finale de Boris.
export function remainingRegularPayouts(tournament, playersLeft) {
  const rows = tournament.payoutTable
    .map((p) => ({ position: p.position, regular: p.prizeEuro - (p.prizeBountyComponent || 0) }))
    .filter((p) => p.regular > 0.01)
    .sort((a, b) => a.position - b.position);

  const ladder = [];
  for (let place = 1; place <= playersLeft; place++) {
    const row = rows.find((r) => r.position === place);
    ladder.push(row ? row.regular : 0);
  }
  if (ladder.some((v) => v > 0)) return ladder;

  const total = rows.reduce((a, b) => a + b.regular, 0) || 10000;
  return payoutStructure(Math.min(9, Math.max(2, playersLeft)), total);
}

// Pool KO encore en circulation : pool de départ moins la moitié encaissée à chaque élimination
// (même modèle que le moteur ICM). Le total distribué en bounty sur toute la grille est la
// meilleure mesure disponible du pool de départ.
export function circulatingBountyPool(tournament, playersLeft) {
  const totalBounty = tournament.payoutTable.reduce((a, p) => a + (p.prizeBountyComponent || 0), 0);
  const totalEntries = tournament.totalEntrants + tournament.reEntries;
  const eliminated = Math.max(0, totalEntries - playersLeft);
  const perHead = totalBounty / totalEntries;
  return Math.max(0, totalBounty - eliminated * perHead * 0.5);
}

// Ce que le trainer peut honnêtement affirmer à chaque stade.
export function stageConfidence(stage) {
  if (stage.kind === "icm") {
    return {
      engine: "ICM exact + bounty",
      note: "ICM exact Malmuth-Weitzman + bounty, moteur validé sur ses 7 tests d'origine. Aucune approximation.",
      solid: true,
    };
  }
  if (stage.icmOutOfReach) {
    return {
      engine: "Framework (hors ICM)",
      note: "À 2-3 tables l'ICM exact est hors de portée (O(n!)) et l'échantillonnage laisse ±3 points d'incertitude sur le RP, plus que la tolérance de correction. Seule la composante bounty est calculée ici : le vrai RP est moins négatif.",
      solid: false,
    };
  }
  if (stage.belowIcmLimit) {
    return {
      engine: "Framework (hors ICM)",
      note: "Sous 30% de field restant, le framework donne la composante bounty du RP, mais la pression ICM s'y ajoute et n'est PAS incluse ici. Le vrai RP est donc moins négatif que le chiffre affiché.",
      solid: false,
    };
  }
  return {
    engine: "Framework (hors ICM)",
    note: "Zone de validité pleine du framework, calibré sur 15+ simulations solveur.",
    solid: true,
  };
}

// --- Génération d'une question, aiguillée selon le stade -------------------------------------

function rand(min, max) {
  return min + Math.random() * (max - min);
}

// Stacks de table finale réalistes : un chip leader, quelques stacks moyens, des courts.
function drawFinalTableStacks(n) {
  return Array.from({ length: n }, () => Math.round(rand(8, 120)));
}

export function generateStageQuestion(tournament, stage, pctPaid) {
  const totalEntries = tournament.totalEntrants + tournament.reEntries;
  const playersLeft = playersLeftAt(stage, totalEntries, pctPaid);
  const fieldLeft = playersLeft / totalEntries;
  const confidence = stageConfidence(stage);

  if (stage.kind === "icm") {
    const stacks = drawFinalTableStacks(playersLeft);
    let hero = Math.floor(Math.random() * playersLeft);
    let villain = Math.floor(Math.random() * playersLeft);
    while (villain === hero) villain = Math.floor(Math.random() * playersLeft);

    const payouts = remainingRegularPayouts(tournament, playersLeft);
    // Une question sur trois est un RP « vanilla » (sans prime) : c'est le repère de pression
    // ICM pure, à savoir lire avant d'y ajouter l'effet du bounty.
    const vanilla = Math.random() < 0.34;
    const bountyPool = vanilla ? 0 : circulatingBountyPool(tournament, playersLeft);
    const rp = riskPremium(stacks, payouts, hero, villain, bountyPool);

    return {
      kind: "icm", stage, tournament: tournament.name, playersLeft, fieldLeft, confidence,
      stacks, hero, villain, payouts, bountyPool, vanilla,
      heroStack: stacks[hero], villainStack: stacks[villain],
      heroCovers: stacks[hero] > stacks[villain],
      answer: rp,
    };
  }

  // Le FL est imposé au générateur, pas écrasé après coup : sinon le nombre de KO et le stack
  // moyen seraient tirés pour un autre stade que celui affiché.
  const spot = generateFrameworkSpot(fieldLeft);
  const solved = solveFrameworkSpot(spot);
  return {
    kind: "framework", stage, tournament: tournament.name, playersLeft, fieldLeft, confidence,
    ...spot, ...solved,
    answer: solved.rp,
  };
}
