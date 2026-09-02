// Les stades de tournoi sélectionnables dans le RP Trainer, et l'aiguillage vers le moteur
// qui est réellement valide à chaque stade. C'est le point délicat du module : les trois
// piliers du framework de Boris n'ont pas la même zone de validité, et afficher un RP calculé
// hors de sa zone reviendrait à enseigner un chiffre faux.
//
//   pilier 1 (framework α → r → RP)  : 100% → ~30% FL, hors ICM        → validé 15+ sims
//   pilier 3 (calcul observable)     : ITM → TF, valeur du KO exacte    → arithmétique
//   pilier 2 (ICM exact + bounty)    : table finale                     → moteur porté et testé

import { payoutStructure } from "./icmBounty";

// `kind` : 'framework' = chaîne hors-ICM · 'icm' = moteur ICM (exact ou Monte-Carlo).
// `playersLeft` : soit une fraction du field (fl), soit un nombre absolu (abs).
export const STAGES = [
  { id: "fl100", label: "100% FL", short: "100%", fl: 1.0, kind: "framework" },
  { id: "fl50", label: "50% FL", short: "50%", fl: 0.5, kind: "framework" },
  { id: "fl25", label: "25% FL", short: "25%", fl: 0.25, kind: "framework", belowIcmLimit: true },
  { id: "fl18", label: "18% FL", short: "18%", fl: 0.18, kind: "framework", belowIcmLimit: true },
  { id: "bubble", label: "Bulle", short: "Bulle", atBubble: true, kind: "framework", belowIcmLimit: true },
  { id: "fl10", label: "10% FL", short: "10%", fl: 0.10, kind: "framework", belowIcmLimit: true },
  { id: "t3", label: "3 tables", short: "3 tbl", abs: 27, kind: "icm" },
  { id: "t2", label: "2 tables", short: "2 tbl", abs: 18, kind: "icm" },
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
      engine: stage.abs > 10 ? "ICM Monte-Carlo" : "ICM exact",
      note: stage.abs > 10
        ? "ICM échantillonné (l'exact est en O(n!), impraticable au-delà de ~10 joueurs). Écart mesuré vs exact : < 0.05% du prizepool."
        : "ICM exact Malmuth-Weitzman + bounty, moteur validé sur ses 7 tests d'origine.",
      solid: true,
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
