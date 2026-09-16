// Logique du replayer des spots de sim résolue, sortie du composant pour être testée hors
// navigateur sur tous les spots publiés.
//
// Le replayer avance par ÉTAPES, pas par actions : une carte qui tombe est une étape à elle seule,
// chaque action en est une autre. La première version avançait action par action, si bien qu'un
// clic faisait tomber la turn ET montrait la première action de la turn en même temps (signalé par
// Boris). Un joueur ne lit pas un coup comme ça : il voit la carte, puis l'action.

export const POSITIONS = ["UTG", "HJ", "CO", "BU", "SB", "BB"];

// Nombre de cartes du board visibles selon la street en cours.
export function visibleBoardCount(street) {
  return street >= 3 ? 5 : street === 2 ? 4 : street === 1 ? 3 : 0;
}

// Étapes du replayer :
//   start  — blinds et antes postées, aucune action
//   deal   — la carte de la street tombe ; mises remises à zéro, aucune action encore
//   action — une action, et une seule
// `last` = index de la dernière action rejouée à cette étape (−1 = aucune).
// `decisionStreet` : street où hero doit agir. S'il est premier de parole sur une nouvelle street,
// la séquence s'arrête à la street précédente et il faut encore faire tomber la carte.
export function buildSteps(sequence, decisionStreet = null) {
  const steps = [{ kind: "start", street: 0, last: -1 }];
  let street = 0;
  const dealUpTo = (target, last) => {
    for (let s = street + 1; s <= target; s++) steps.push({ kind: "deal", street: s, last });
    street = Math.max(street, target);
  };
  sequence.forEach((a, i) => {
    if (a.street > street) dealUpTo(a.street, i - 1);
    steps.push({ kind: "action", street: a.street, last: i });
  });
  if (decisionStreet != null && decisionStreet > street) dealUpTo(decisionStreet, sequence.length - 1);
  return steps;
}

// Rejoue la séquence jusqu'à `idx` inclus (−1 = avant toute action, blinds et antes déjà postées).
//
// Conventions HRC, à ne pas confondre : une relance donne le TOTAL engagé sur la street, un call
// donne le montant ADDITIONNEL. Prendre l'un pour l'autre fausse le pot et donc les cotes.
export function replayTo(sequence, idx, { startBB, sbBB, bbBB, anteBB, forceStreet = null }) {
  const total = {}, street = {}, action = {};
  for (const p of POSITIONS) { total[p] = anteBB; street[p] = 0; }
  total.SB += sbBB; street.SB = sbBB;
  total.BB += bbBB; street.BB = bbBB;

  let currentStreet = 0;
  for (let i = 0; i <= idx && i < sequence.length; i++) {
    const a = sequence[i];
    if (a.street !== currentStreet) {
      for (const p of POSITIONS) street[p] = 0;
      for (const k of Object.keys(action)) delete action[k];
      currentStreet = a.street;
    }
    let delta = 0;
    if (a.type === "R") { delta = a.amountBB - street[a.pos]; street[a.pos] = a.amountBB; }
    else if (a.type === "C") { delta = a.amountBB; street[a.pos] += delta; }
    total[a.pos] += delta;
    action[a.pos] = a.type === "F" ? "fold"
      : a.type === "X" ? "check"
      : a.type === "C" ? "call"
      : `bet ${a.amountBB}`;
  }

  // Carte qui tombe : la street avance sans action rejouée, les mises de la street close
  // disparaissent de la table (elles sont dans le pot).
  if (forceStreet != null && forceStreet > currentStreet) {
    for (const p of POSITIONS) street[p] = 0;
    for (const k of Object.keys(action)) delete action[k];
    currentStreet = forceStreet;
  }

  const pot = POSITIONS.reduce((sum, p) => sum + total[p], 0);
  return {
    stacks: Object.fromEntries(POSITIONS.map((p) => [p, +(startBB - total[p]).toFixed(1)])),
    bets: Object.fromEntries(POSITIONS.filter((p) => street[p] > 0).map((p) => [p, +street[p].toFixed(1)])),
    streetCommit: { ...street },
    action, pot: +pot.toFixed(2), street: currentStreet,
  };
}

export function stateAtStep(sequence, step, opts) {
  return replayTo(sequence, step.last, { ...opts, forceStreet: step.kind === "deal" ? step.street : null });
}
