import pkg from 'pokersolver';
import { CLASSES, CLASS_PROB, classEquity } from './preflopSolver';
import { getClassCombos } from '../combos';
import { FULL_DECK, sampleWithoutReplacement } from './equity';

const { Hand } = pkg;

// MODÈLE MULTIWAY (approximatif, voir plan) : contrairement au HU, il n'existe pas d'équilibre
// ICM multiway unique/bien défini (même GTO Wizard ne le fait pas). Approche retenue, standard
// dans l'industrie : chaque adversaire encore vivant répond à l'action de hero de façon
// INDÉPENDANTE, comme si c'était un coup HU contre hero seul (ignore les autres adversaires pour
// SA décision fold/call) -- ce n'est pas un vrai équilibre multiway, juste une approximation
// raisonnable. La décision de chaque adversaire est un calcul direct d'EV (fold vs call), PAS un
// CFR : l'action de hero étant fixée, il n'y a plus d'interaction stratégique à résoudre pour cet
// adversaire pris isolément, donc pas de souci de convergence. En revanche l'EV finale de HERO est
// calculée par un vrai Monte-Carlo qui simule TOUS les adversaires vivants simultanément (tirage de
// leur classe, décision continuer/fold, abattage réel si plusieurs continuent) -- la dilution
// d'équité multiway est donc correctement prise en compte côté hero, seule la décision de chaque
// adversaire individuel est simplifiée.

const AVG_EQUITY_VS_RANGE = {};
CLASSES.forEach(cls => {
  let sum = 0;
  CLASSES.forEach(opp => { sum += CLASS_PROB[opp] * classEquity(cls, opp); });
  AVG_EQUITY_VS_RANGE[cls] = sum;
});

function sampleClassWeighted() {
  let r = Math.random();
  for (const c of CLASSES) {
    r -= CLASS_PROB[c];
    if (r <= 0) return c;
  }
  return CLASSES[CLASSES.length - 1];
}

function pickRandomCombo(cls, used) {
  const combos = getClassCombos(cls).map(c => c.pair).filter(([a, b]) => !used.has(a) && !used.has(b));
  if (!combos.length) return null;
  return combos[Math.floor(Math.random() * combos.length)];
}

// Décision fold/call d'un adversaire face à l'action de hero (calcul direct, pas de CFR -- voir
// doc du module). `heroCommittedBB`/`callToBB` sont des montants TOTAUX investis cette rue (pas
// des incréments), même convention que preflopSolver.js.
function opponentContinueDecision({ opponentName, heroLogin, opponentStartStackBB, opponentInvestedBB, callToBB, deadMoneyBB, heroCommittedBB, allStacksBB, valuation }) {
  const decision = {};
  const foldStacks = { ...allStacksBB, [opponentName]: opponentStartStackBB - opponentInvestedBB };
  const evFold = valuation(foldStacks)[opponentName];
  const potBB = heroCommittedBB + callToBB + deadMoneyBB;

  CLASSES.forEach(cls => {
    const eq = AVG_EQUITY_VS_RANGE[cls];
    const stacksIfOppWins = { ...allStacksBB, [opponentName]: opponentStartStackBB - callToBB + potBB, [heroLogin]: allStacksBB[heroLogin] - heroCommittedBB };
    const stacksIfHeroWins = { ...allStacksBB, [opponentName]: opponentStartStackBB - callToBB, [heroLogin]: allStacksBB[heroLogin] - heroCommittedBB + potBB };
    const evCall = eq * valuation(stacksIfOppWins)[opponentName] + (1 - eq) * valuation(stacksIfHeroWins)[opponentName];
    decision[cls] = evCall > evFold;
  });
  return decision;
}

// EV de hero pour UNE action donnée, moyennée sur `trials` simulations (tirage des classes
// adverses, décision continuer/fold via `opponents[i].decision`, abattage réel si 1+ continuent).
function simulateHeroActionEV({ heroLogin, heroClass, heroCommittedBB, opponents, deadMoneyBB, allStacksBB, valuation, trials }) {
  let total = 0;
  let done = 0;
  for (let t = 0; t < trials; t++) {
    const continuing = [];
    let potBB = heroCommittedBB + deadMoneyBB;
    for (const opp of opponents) {
      const cls = sampleClassWeighted();
      if (opp.decision[cls]) {
        continuing.push({ name: opp.name, class: cls, callToBB: opp.callToBB });
        potBB += opp.callToBB;
      } else {
        potBB += opp.investedBB;
      }
    }

    const stacksAfter = { ...allStacksBB };
    opponents.forEach(o => {
      const c = continuing.find(x => x.name === o.name);
      stacksAfter[o.name] = allStacksBB[o.name] - (c ? o.callToBB : o.investedBB);
    });
    stacksAfter[heroLogin] = allStacksBB[heroLogin] - heroCommittedBB;

    if (continuing.length === 0) {
      stacksAfter[heroLogin] += potBB;
    } else {
      const used = new Set();
      const heroCombo = pickRandomCombo(heroClass, used);
      heroCombo.forEach(c => used.add(c));
      const assignments = [{ name: heroLogin, combo: heroCombo }];
      let ok = true;
      for (const c of continuing) {
        const combo = pickRandomCombo(c.class, used);
        if (!combo) { ok = false; break; }
        combo.forEach(card => used.add(card));
        assignments.push({ name: c.name, combo });
      }
      if (!ok) { t--; continue; }
      const deck = FULL_DECK.filter(c => !used.has(c));
      const board = sampleWithoutReplacement(deck, 5);
      const solved = assignments.map(a => ({ name: a.name, hand: Hand.solve([...a.combo, ...board]) }));
      const winners = Hand.winners(solved.map(s => s.hand));
      const share = 1 / winners.length;
      solved.forEach(s => { if (winners.includes(s.hand)) stacksAfter[s.name] += share * potBB; });
    }

    total += valuation(stacksAfter)[heroLogin];
    done++;
  }
  return total / done;
}

// Point d'entrée : compare l'EV de hero pour ses options réelles à ce noeud (fold, call du palier
// actuel, et raise si hero a réellement relancé) et situe son action réelle par rapport à la
// meilleure. `opponents`: [{name, startStackBB, investedBB}] -- tous les joueurs encore vivants
// hors hero à cette décision.
export function solveMultiwaySpot({ heroLogin, heroClass, heroInvestedBB, currentBetBB, realAction, realRaiseToBB, opponents, deadMoneyBB, allStacksBB, valuation, trials = 6000 }) {
  const scenarios = [{ action: 'fold', committedBB: heroInvestedBB }];
  scenarios.push({ action: 'call', committedBB: currentBetBB });
  if (realAction === 'raise' && realRaiseToBB) {
    scenarios.push({ action: 'raise', committedBB: realRaiseToBB });
  }

  const evByAction = {};
  for (const sc of scenarios) {
    if (sc.action === 'fold') {
      evByAction.fold = valuation({ ...allStacksBB, [heroLogin]: allStacksBB[heroLogin] - sc.committedBB })[heroLogin];
      continue;
    }
    const resolvedOpponents = opponents.map(o => ({
      name: o.name, investedBB: o.investedBB, callToBB: sc.committedBB,
      decision: opponentContinueDecision({
        opponentName: o.name, heroLogin, opponentStartStackBB: allStacksBB[o.name], opponentInvestedBB: o.investedBB,
        callToBB: sc.committedBB, deadMoneyBB, heroCommittedBB: sc.committedBB, allStacksBB, valuation,
      }),
    }));
    evByAction[sc.action] = simulateHeroActionEV({
      heroLogin, heroClass, heroCommittedBB: sc.committedBB, opponents: resolvedOpponents, deadMoneyBB, allStacksBB, valuation, trials,
    });
  }

  const bestAction = Object.keys(evByAction).reduce((a, b) => evByAction[a] >= evByAction[b] ? a : b);
  return { evByAction, bestAction, bestEV: evByAction[bestAction], chosenEV: evByAction[realAction] };
}
