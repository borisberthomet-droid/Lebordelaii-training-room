// Port direct des tables de RP_PKO_Calculator.xlsx (feuille Tables), formules vérifiées
// cellule par cellule (RP_Calc!C17/C19/C21) — même logique de lookup, y compris le décalage
// MATCH(...,1)+1 sur la table Bonus RP (le seuil dépassé donne le palier SUIVANT, pas le
// palier atteint). Voir [[find-it-poker-trainer]] / la conversation où ces tables ont été
// extraites pour le détail de la vérification.

// Exportées (pas seulement utilisées via bonusRP()) pour que la page Mémo (/memo) puisse
// afficher la table brute telle quelle, sans dupliquer les valeurs.
export const BONUS_RP_THRESHOLDS = [0, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.5, 2];
export const BONUS_RP_VALUES = [0, -0.01, -0.025, -0.04, -0.05, -0.06, -0.07, -0.08, -0.09, -0.10, -0.11, -0.12, -0.13, -0.14, -0.15, -0.185, -0.22];

// Ratio KO/Stack (bounty du joueur ÷ son propre stack, même unité) -> Bonus RP.
// Au-delà du dernier seuil (2), on plafonne à la pire valeur plutôt que de planter comme
// le ferait Excel (INDEX hors plage) — divergence délibérée, pas une omission.
export function bonusRP(ratio) {
  if (ratio == null || isNaN(ratio)) return null;
  let idx = 0;
  for (let i = 0; i < BONUS_RP_THRESHOLDS.length; i++) {
    if (BONUS_RP_THRESHOLDS[i] <= ratio) idx = i; else break;
  }
  const nextIdx = Math.min(idx + 1, BONUS_RP_VALUES.length - 1);
  return BONUS_RP_VALUES[nextIdx];
}

export const RP_BASE_TABLE = {
  75: { Bas: 0, Moyen: 0.005, Eleve: 0.01 },
  50: { Bas: 0.01, Moyen: 0.015, Eleve: 0.02 },
  25: { Bas: 0.025, Moyen: 0.035, Eleve: 0.04 },
};

// Catégorie de stack d'un joueur vs la moyenne du tournoi.
export function stackCategory(stackBB, avgStackBB) {
  if (!stackBB || !avgStackBB) return null;
  const ratio = stackBB / avgStackBB;
  if (ratio < 0.75) return 'Bas';
  if (ratio <= 1.25) return 'Moyen';
  return 'Eleve';
}

// %FL : 75/50/25, "TF" traité comme 25 (même convention que le classeur Excel).
export function rpDeBase(fieldLeftPct, category) {
  const fl = fieldLeftPct === 'TF' ? 25 : fieldLeftPct;
  if (!RP_BASE_TABLE[fl] || !category) return null;
  return RP_BASE_TABLE[fl][category] ?? null;
}

export const CHIPLEAD_TABLE = {
  75: { Moyen: 0, Gros: -0.005, Huge: -0.01 },
  50: { Moyen: -0.005, Gros: -0.01, Huge: -0.02 },
  25: { Moyen: -0.01, Gros: -0.03, Huge: -0.04 },
};

// Catégorie de couverture : stack du héros / stack du vilain.
export function chipLeadCategory(heroStackBB, villainStackBB) {
  if (!heroStackBB || !villainStackBB) return 'Aucun';
  const ratio = heroStackBB / villainStackBB;
  if (ratio < 1.5) return 'Aucun';
  const rounded = Math.round(ratio);
  if (rounded >= 5) return 'Huge';
  if (rounded >= 3) return 'Gros';
  return 'Moyen';
}

export function chipLeadAdvantage(fieldLeftPct, category) {
  if (category === 'Aucun' || !category) return 0;
  const fl = fieldLeftPct === 'TF' ? 25 : fieldLeftPct;
  if (!CHIPLEAD_TABLE[fl]) return null;
  return CHIPLEAD_TABLE[fl][category] ?? null;
}

// Grille RP complète pour un siège "vilain" face au héros, selon la méthode par tables.
export function computeSeatRP({ villainStackBB, villainBountyBB, heroStackBB, avgStackBB, fieldLeftPct }) {
  const ratio = villainStackBB > 0 ? villainBountyBB / villainStackBB : null;
  const bonus = bonusRP(ratio);
  const category = stackCategory(villainStackBB, avgStackBB);
  const base = rpDeBase(fieldLeftPct, category);
  const clCategory = chipLeadCategory(heroStackBB, villainStackBB);
  const clAdvantage = chipLeadAdvantage(fieldLeftPct, clCategory);
  const total = [bonus, base, clAdvantage].every(v => v != null) ? bonus + base + clAdvantage : null;
  return { ratio, bonus, category, base, clCategory, clAdvantage, total };
}
