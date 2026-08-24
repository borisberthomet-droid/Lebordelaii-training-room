import equityMatrix from './equityMatrix.json';
import { getClassCombos } from '../combos';
import { icmEquity } from './icm';

const CLASSES = Object.keys(equityMatrix); // 169 classes, la matrice précalculée fait autorité

// Poids réel de chaque classe (nb de combos / 1326) -- utilisé pour pondérer l'énumération dense
// (CFR+) par la vraie probabilité de donne, pas une pondération uniforme par classe.
const CLASS_WEIGHTS = CLASSES.map(c => getClassCombos(c).length);
const CLASS_WEIGHTS_TOTAL = CLASS_WEIGHTS.reduce((a, b) => a + b, 0);

function classEquity(a, b) {
  if (a === b) return 0.5;
  return equityMatrix[a][b];
}

// Valuation "ICM exact" : nécessite les stacks de TOUTE la table (l'élimination d'un adversaire
// change l'équité $ de tout le monde, pas seulement des 2 joueurs de ce coup) + les paliers de gains.
export function makeIcmValuation(tableStacksBB, prizesBB) {
  const names = Object.keys(tableStacksBB);
  return (stacksAfter) => {
    const stacks = names.map(n => stacksAfter[n] ?? tableStacksBB[n]);
    const eq = icmEquity(stacks, prizesBB);
    const out = {};
    names.forEach((n, i) => { out[n] = eq[i]; });
    return out;
  };
}

// Valuation "chip-EV" (mode multiway approximatif) : chaque joueur maximise directement son propre
// stack en jetons après le coup, sans ajustement ICM -- reste tractable multiway contrairement à l'ICM.
export function makeChipEvValuation() {
  return (stacksAfter) => stacksAfter;
}

// Construit l'arbre de décision HU (2 joueurs, alternance stricte) à partir de la VRAIE séquence
// d'événements (chaque décision réelle de l'un ou l'autre joueur dans ce segment HU, pas seulement
// les relances). C'est ce qui permet de gérer correctement le cas "limp puis option du second
// joueur" (ex: SB limpe, BB peut ensuite check/relancer) : "call"/"check" n'est terminal QUE si
// c'est la dernière décision réelle du segment -- sinon l'arbre continue vers la décision réelle
// suivante, avec le même palier de mise (`curBet` inchangé, ce n'était pas une relance).
// `events`: [{actor, realAction: 'call'|'check'|'raise', toBB (si raise)}, ...] dans l'ordre réel.
function buildHuTree(events, investedBB) {
  function decision(i, curBet, invested) {
    const ev = events[i];
    const actor = ev.actor;
    const options = {};
    options.fold = { type: 'terminal', kind: 'fold', by: actor, invested };

    // Le "call" hypothétique ne peut enchaîner sur le prochain événement RÉEL que si l'action
    // réellement jouée ici était elle-même 'call' (donc que ce prochain événement est une vraie
    // réponse au même palier de mise). Si l'action réelle ici était 'raise', "call" est une
    // déviation hypothétique sans aucune donnée réelle sur la suite -- on retombe sur l'abattage
    // immédiat comme meilleure approximation disponible (voir plan, limite connue).
    const investedAfterCall = { ...invested, [actor]: curBet };
    const callContinuesReal = ev.realAction === 'call' && i < events.length - 1;
    options.call = callContinuesReal
      ? { node: decision(i + 1, curBet, investedAfterCall) }
      : { type: 'terminal', kind: 'showdown', invested: investedAfterCall };

    if (ev.realAction === 'raise') {
      const investedAfterRaise = { ...invested, [actor]: ev.toBB };
      options.raise = { node: decision(i + 1, ev.toBB, investedAfterRaise) };
    }
    return { actor, curBet, invested, options };
  }

  const startBet = Math.max(...Object.values(investedBB));
  return decision(0, startBet, investedBB);
}

function terminalStacks(term, players, startStacksBB, deadMoneyBB) {
  if (term.kind === 'fold') {
    const winner = players.find((p) => p !== term.by);
    const stacks = {};
    stacks[term.by] = startStacksBB[term.by] - term.invested[term.by];
    stacks[winner] = startStacksBB[winner] + term.invested[term.by] + deadMoneyBB;
    return stacks;
  }
  return null; // showdown : dépend de l'équité, calculé au cas par cas dans terminalUtility
}

function terminalUtility(term, players, startStacksBB, allStacksBB, deadMoneyBB, valuation, clsA, clsB) {
  const [A, B] = players;
  if (term.kind === 'fold') {
    const stacksAfter = terminalStacks(term, players, startStacksBB, deadMoneyBB);
    const full = { ...allStacksBB, ...stacksAfter };
    const val = valuation(full);
    return { [A]: val[A], [B]: val[B] };
  }
  // showdown
  const potBB = term.invested[A] + term.invested[B] + deadMoneyBB;
  const equityA = classEquity(clsA, clsB);
  const stacksIfAWins = { ...allStacksBB, [A]: startStacksBB[A] - term.invested[A] + potBB, [B]: startStacksBB[B] - term.invested[B] };
  const stacksIfBWins = { ...allStacksBB, [A]: startStacksBB[A] - term.invested[A], [B]: startStacksBB[B] - term.invested[B] + potBB };
  const valA = valuation(stacksIfAWins);
  const valB = valuation(stacksIfBWins);
  return {
    [A]: equityA * valA[A] + (1 - equityA) * valB[A],
    [B]: equityA * valA[B] + (1 - equityA) * valB[B],
  };
}

// CFR+ dense (énumération complète des 169x169 paires de classes à chaque itération, pondérée par
// leur vraie probabilité de donne, pas d'échantillonnage Monte-Carlo). Testé contre une version
// échantillonnée (voir le plan / historique) : l'échantillonnage converge vite pour les mains
// nettes (premium/trash) mais reste instable à des millions d'itérations pour des mains proches de
// l'indifférence (ex. K9o à 10bb HU) -- l'énumération dense élimine tout ce bruit, converge net en
// quelques centaines d'itérations, et reste largement assez rapide pour un arbre de cette taille.
const CLASS_PROB = {};
CLASSES.forEach((c, i) => { CLASS_PROB[c] = CLASS_WEIGHTS[i] / CLASS_WEIGHTS_TOTAL; });

function runHuCfr(root, players, startStacksBB, allStacksBB, deadMoneyBB, valuation, iterations) {
  const [A, B] = players;
  const infosets = new Map();

  function getInfoset(path, actions) {
    if (!infosets.has(path)) {
      const regretSum = {}, strategySum = {};
      for (const c of CLASSES) {
        regretSum[c] = {}; strategySum[c] = {};
        for (const a of actions) { regretSum[c][a] = 0; strategySum[c][a] = 0; }
      }
      infosets.set(path, { actions, regretSum, strategySum });
    }
    return infosets.get(path);
  }

  function strategyFor(infoset, cls) {
    const actions = infoset.actions;
    let sum = 0;
    const strat = {};
    for (const a of actions) { strat[a] = Math.max(infoset.regretSum[cls][a], 0); sum += strat[a]; }
    for (const a of actions) strat[a] = sum > 0 ? strat[a] / sum : 1 / actions.length;
    return strat;
  }

  function cfr(node, path, clsA, clsB, reachA, reachB, chanceWeight) {
    if (node.type === 'terminal') {
      return terminalUtility(node, players, startStacksBB, allStacksBB, deadMoneyBB, valuation, clsA, clsB);
    }
    const actions = Object.keys(node.options);
    const infoset = getInfoset(path, actions);
    const actor = node.actor;
    const myCls = actor === A ? clsA : clsB;
    const strat = strategyFor(infoset, myCls);

    const util = {};
    const nodeUtil = { [A]: 0, [B]: 0 };
    for (const a of actions) {
      const childNode = node.options[a].type === 'terminal' ? node.options[a] : node.options[a].node;
      const childReachA = actor === A ? reachA * strat[a] : reachA;
      const childReachB = actor === B ? reachB * strat[a] : reachB;
      const u = cfr(childNode, path + '/' + a, clsA, clsB, childReachA, childReachB, chanceWeight);
      util[a] = u;
      nodeUtil[A] += strat[a] * u[A];
      nodeUtil[B] += strat[a] * u[B];
    }

    const oppReach = actor === A ? reachB : reachA;
    const myReach = actor === A ? reachA : reachB;
    for (const a of actions) {
      // CFR+ : le regret cumulé est replafonné à 0 après CHAQUE mise à jour (pas seulement à la
      // lecture de la stratégie) -- convergence bien plus rapide/stable que le CFR "vanilla".
      const updated = infoset.regretSum[myCls][a] + (util[a][actor] - nodeUtil[actor]) * oppReach * chanceWeight;
      infoset.regretSum[myCls][a] = Math.max(updated, 0);
      infoset.strategySum[myCls][a] += myReach * strat[a] * chanceWeight;
    }
    return nodeUtil;
  }

  for (let iter = 0; iter < iterations; iter++) {
    for (const clsA of CLASSES) {
      const wA = CLASS_PROB[clsA];
      for (const clsB of CLASSES) {
        cfr(root, 'root', clsA, clsB, 1, 1, wA * CLASS_PROB[clsB]);
      }
    }
  }

  // Stratégie moyenne (celle qui converge vers l'équilibre, pas la dernière itération brute)
  const result = {}; // path -> { actor, actions, byClass: {cls: {action: freq}} }
  for (const [path, infoset] of infosets) {
    const byClass = {};
    for (const c of CLASSES) {
      let sum = 0;
      for (const a of infoset.actions) sum += infoset.strategySum[c][a];
      byClass[c] = {};
      for (const a of infoset.actions) byClass[c][a] = sum > 0 ? infoset.strategySum[c][a] / sum : 1 / infoset.actions.length;
    }
    result[path] = { actions: infoset.actions, byClass };
  }
  return result;
}

// Point d'entrée : résout un coup préflop HU (2 joueurs vivants) avec la vraie séquence
// d'événements de la main (voir buildHuTree). Retourne la stratégie d'équilibre par classe à
// chaque noeud de décision, identifié par son "path" (ex. "root/call/raise" = noeud après que le
// 1er joueur ait limpé/checké puis que le 2e ait relancé).
export function solveHuPreflopSpot({ players, events, investedBB, startStacksBB, allStacksBB, deadMoneyBB = 0, valuation, iterations = 400 }) {
  const root = buildHuTree(events, investedBB);
  return runHuCfr(root, players, startStacksBB, allStacksBB, deadMoneyBB, valuation, iterations);
}

export { CLASSES, classEquity, CLASS_PROB };
