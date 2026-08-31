import { ALL_CLASSES, getClassCombos } from './combos';

// Compare deux ranges pondérées (0-1 par combo, comme comboWeights partout ailleurs dans le
// projet) sur les 1326 combos réels — un combo absent des DEUX objets compte comme un accord
// implicite à 0% (check/fold), pas comme ignoré : sans ça, une petite range de référence rendrait
// la comparaison quasi vide de sens. Retourne un score de similarité global + le détail par classe
// (les 169 cases du grid) pour la vue diff : `diff` signé (+ = l'élève sur-bet cette classe par
// rapport à la référence, - = il la sous-bet), `absDiff` pour l'intensité visuelle.
export function compareRanges(studentWeights, referenceWeights) {
  let sumAbsDiff = 0;
  let totalCombos = 0;
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
    }
    sumAbsDiff += clsAbsDiff;
    totalCombos += combos.length;
    perClass[cls] = {
      studentAvg: studentSum / combos.length,
      referenceAvg: referenceSum / combos.length,
      diff: (studentSum - referenceSum) / combos.length,
      absDiff: clsAbsDiff / combos.length,
    };
  }

  const avgAbsDiff = totalCombos > 0 ? sumAbsDiff / totalCombos : 0;
  const accuracy = Math.round((1 - avgAbsDiff) * 100);
  return { accuracy, avgAbsDiff, perClass };
}
