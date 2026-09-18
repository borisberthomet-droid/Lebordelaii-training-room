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
// `startBB` : un tapis unique, ou un tapis par position quand ils diffèrent (avec une ante de big
// blind, la BB part de plus haut puisqu'elle la paie).
// `anteType` : "BB" = une seule ante payée par la big blind (usage MTT actuel), sinon une ante
// par joueur. Les deux existent dans les sims du site, et les confondre fausse pot et tapis.
export function replayTo(sequence, idx, { startBB, sbBB, bbBB, anteBB, anteType = "REGULAR", forceStreet = null }) {
  const total = {}, street = {}, action = {};
  const depart = (p) => (typeof startBB === "number" ? startBB : startBB?.[p] ?? 0);
  for (const p of POSITIONS) { total[p] = anteType === "BB" ? 0 : anteBB; street[p] = 0; }
  if (anteType === "BB") total.BB += anteBB;
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

  // Pot affiché au centre : ce qui est DÉJÀ ramassé, sans les jetons de la street en cours — ils
  // sont posés devant les joueurs. Signalé par Boris : une mise river de 6bb gonflait le pot
  // affiché à 15.1bb alors qu'il valait 9.1bb avant la mise.
  const total_ = POSITIONS.reduce((sum, p) => sum + total[p], 0);
  const pot = total_ - POSITIONS.reduce((sum, p) => sum + street[p], 0);
  return {
    stacks: Object.fromEntries(POSITIONS.map((p) => [p, +(depart(p) - total[p]).toFixed(1)])),
    bets: Object.fromEntries(POSITIONS.filter((p) => street[p] > 0).map((p) => [p, +street[p].toFixed(1)])),
    streetCommit: { ...street },
    // `potTotal` garde tout, mises de la street comprises : c'est lui qui sert aux contrôles.
    action, pot: +pot.toFixed(2), potTotal: +total_.toFixed(2), street: currentStreet,
  };
}

export function stateAtStep(sequence, step, opts) {
  return replayTo(sequence, step.last, { ...opts, forceStreet: step.kind === "deal" ? step.street : null });
}
