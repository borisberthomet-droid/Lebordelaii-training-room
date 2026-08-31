import { ALL_CLASSES, getClassCombos } from './combos';

// Compare deux ranges pondérées (0-1 par combo, comme comboWeights partout ailleurs dans le
// projet). Le score global ne compte QUE les combos "actifs" (poids > 0 côté élève OU côté
// référence, ou les deux) — pas les 1326 combos réels. Une range serrée (ex: paires premium
// seulement) a l'immense majorité de ses 1326 combos à 0% des deux côtés ; les compter comme
// "accord" noie un vrai désaccord dans le bruit (constaté : un pli entier oublié — TT, 6 combos —
// donnait 100% de similarité au lieu de ~80%, alors que la grille d'écart montrait bien le trou).
// `perClass` reste calculé sur les vrais 13 (ou 4/12) combos de la classe pour la vue diff — c'est
// seulement l'agrégat global qui doit ignorer le bruit des combos jamais évoqués par personne.
export function compareRanges(studentWeights, referenceWeights) {
  let sumAbsDiff = 0;
  let activeCombos = 0;
  const perClass = {};

  for (const cls of ALL_CLASSES) {
    const combos = getClassCombos(cls);
    let clsAbsDiff = 0, studentSum = 0, referenceSum = 0;
    for (const { key } of combos) {
      const s = studentWeights[key] || 0;
      const r = referenceWeights[key] || 0;
      clsAbsDiff += Math.abs(s - r);
      studentSum += s;
      referenceSum += r;
      if (s > 0 || r > 0) { sumAbsDiff += Math.abs(s - r); activeCombos++; }
    }
    perClass[cls] = {
      studentAvg: studentSum / combos.length,
      referenceAvg: referenceSum / combos.length,
      diff: (studentSum - referenceSum) / combos.length,
      absDiff: clsAbsDiff / combos.length,
    };
  }

  const avgAbsDiff = activeCombos > 0 ? sumAbsDiff / activeCombos : 0;
  const accuracy = activeCombos > 0 ? Math.round((1 - avgAbsDiff) * 100) : 100;
  return { accuracy, avgAbsDiff, perClass };
}
