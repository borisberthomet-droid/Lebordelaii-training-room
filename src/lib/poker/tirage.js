// Choix du spot proposé à l'élève.
//
// Deux règles, demandées par Boris après être tombé plusieurs fois sur des lignes qui n'existent
// pas en pratique (« BB donk bet flop sur AA8, ça n'existe PAS DU TOUT ») :
//
//   1. une ligne trop rare ne sort pas du tout ;
//   2. les autres sortent à la fréquence à laquelle elles arrivent vraiment.
//
// La fréquence en question est celle de la LIGNE, les deux ranges prises ensemble — pas celle de
// la range de hero seul, qui reste large sur des lignes que l'adversaire ne prend jamais. Elle est
// calculée à la construction (`lineFreqPct`).

// Mesuré sur As Ah 8d Kd 5c : ce seuil écarte 88% des nœuds de l'arbre et garde 97% de la
// probabilité de jeu. Les donks flop fantômes y pèsent 0.001%.
export const FREQ_MIN_PCT = 0.05;

export function frequence(spot) {
  // Les textures construites avant cette mesure n'ont que la fréquence de hero : mieux vaut
  // s'en servir que de tout écarter le temps d'une reconstruction.
  return spot.lineFreqPct ?? spot.reachPct ?? 0;
}

export function lignesJouees(spots) {
  return spots.filter((s) => frequence(s) >= FREQ_MIN_PCT);
}

// Fréquence de mise minimale pour qu'un nœud « je peux miser » soit entraînable. Mesuré sur les
// 2 509 nœuds publiés : 275 sont sous ce seuil, dont une centaine à 0.0% — typiquement la BB
// première de parole sur le turn après avoir check-callé le cbet, qui n'a aucune range de donk
// dans cet arbre. Y demander une équité de value n'a pas de sens.
export const MISE_MIN_PCT = 10;

export function aUneRangeDeMise(spot) {
  // Les textures construites avant cette mesure n'ont pas le champ : on ne les écarte pas.
  return spot.betFreqPct == null || spot.betFreqPct >= MISE_MIN_PCT;
}

// Tirage proportionnel à la fréquence de la ligne.
export function tirerPondere(spots) {
  if (!spots.length) return null;
  const total = spots.reduce((a, s) => a + frequence(s), 0);
  if (total <= 0) return spots[Math.floor(Math.random() * spots.length)];
  let r = Math.random() * total;
  for (const s of spots) { r -= frequence(s); if (r <= 0) return s; }
  return spots[spots.length - 1];
}
