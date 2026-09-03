// Les stades de tournoi sélectionnables dans le RP Trainer, et l'aiguillage vers le moteur
// qui est réellement valide à chaque stade. C'est le point délicat du module : les trois
// piliers du framework de Boris n'ont pas la même zone de validité, et afficher un RP calculé
// hors de sa zone reviendrait à enseigner un chiffre faux.
//
//   pilier 1 (framework α → r → RP)  : 100% → ~30% FL, hors ICM        → validé 15+ sims
//   pilier 3 (calcul observable)     : ITM → TF, valeur du KO exacte    → arithmétique
//   pilier 2 (ICM exact + bounty)    : table finale                     → moteur porté et testé

import { payoutStructure, riskPremium } from "./icmBounty";
import {
  solveFrameworkSpot, generateFrameworkSpot, DEFAULT_STRUCTURE_ID, pkoStructure,
  snapBigBlind, blindLevel,
} from "./rpFramework";

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

export function generateStageQuestion(tournament, stage, pctPaid, structureId = DEFAULT_STRUCTURE_ID) {
  const totalEntries = tournament.totalEntrants + tournament.reEntries;
  const playersLeft = playersLeftAt(stage, totalEntries, pctPaid);
  const fieldLeft = playersLeft / totalEntries;
  const confidence = stageConfidence(stage);
  // Le stack de départ est propre à chaque tournoi (100 000 sur le HIGHROLLER, 20 000 ailleurs)
  // et c'est lui qui fixe l'échelle des blinds.
  const startingStack = tournament.startingStack || 20000;

  if (stage.kind === "icm") {
    const stacks = drawFinalTableStacks(playersLeft);
    let hero = Math.floor(Math.random() * playersLeft);
    let villain = Math.floor(Math.random() * playersLeft);
    while (villain === hero) villain = Math.floor(Math.random() * playersLeft);

    // Niveau de blinds cohérent avec les stacks tirés : les jetons en jeu sont constants, donc
    // l'average en jetons est connu, et la BB s'en déduit. Cosmétique pour le calcul ICM, mais
    // sans elle un stack « 67 BB » ne se rattache à rien de concret.
    const avgChips = (startingStack * totalEntries) / playersLeft;
    const avgBB = stacks.reduce((a, b) => a + b, 0) / stacks.length;
    const blinds = blindLevel(snapBigBlind(avgChips / avgBB));

    const payouts = remainingRegularPayouts(tournament, playersLeft);
    // Une question sur trois est un RP « vanilla » (sans prime) : c'est le repère de pression
    // ICM pure, à savoir lire avant d'y ajouter l'effet du bounty.
    const vanilla = Math.random() < 0.34;
    const bountyPool = vanilla ? 0 : circulatingBountyPool(tournament, playersLeft);
    const rp = riskPremium(stacks, payouts, hero, villain, bountyPool);

    // Pas de `structure` ici, et c'est volontaire : en table finale les deux pools sont observés
    // directement sur la grille de gains du tournoi. La structure ne sert qu'à générer α, qui
    // n'intervient pas dans le pilier 2. L'exposer donnerait à croire qu'elle change le résultat.
    return {
      kind: "icm", stage, tournament: tournament.name, playersLeft, fieldLeft, confidence,
      stacks, hero, villain, payouts, bountyPool, vanilla,
      startingStack, ...blinds,
      seats: stacks.map((s, i) => ({
        label: `S${i + 1}`, stackBB: s, isHero: i === hero, isVillain: i === villain,
        state: i === hero ? "hero" : i === villain ? "jam" : "idle",
      })),
      heroStack: stacks[hero], villainStack: stacks[villain],
      heroCovers: stacks[hero] > stacks[villain],
      answer: rp,
    };
  }

  // Le FL, la structure et le stack de départ sont imposés au générateur, pas écrasés après
  // coup : sinon le nombre de KO, α, les blinds et les stacks seraient tirés pour un autre
  // tournoi que celui affiché.
  const spot = generateFrameworkSpot(fieldLeft, structureId, startingStack);
  const solved = solveFrameworkSpot(spot);
  return {
    kind: "framework", stage, tournament: tournament.name, playersLeft, fieldLeft, confidence,
    structure: pkoStructure(structureId),
    ...spot, ...solved,
    answer: solved.rp,
  };
}
