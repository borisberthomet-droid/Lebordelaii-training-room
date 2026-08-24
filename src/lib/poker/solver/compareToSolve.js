import { RANKS } from '../constants';
import { solveHuPreflopSpot, makeChipEvValuation, makeIcmValuation } from './preflopSolver';
import { solveMultiwaySpot } from './multiwaySolver';

function cardsToClass(cards) {
  const [c1, c2] = cards;
  const r1 = c1[0], r2 = c2[0], s1 = c1[1], s2 = c2[1];
  if (r1 === r2) return r1 + r1;
  const i1 = RANKS.indexOf(r1), i2 = RANKS.indexOf(r2);
  const [hi, lo] = i1 < i2 ? [r1, r2] : [r2, r1];
  return hi + lo + (s1 === s2 ? 's' : 'o');
}

// Reconstruit, à partir des steps preflop d'une main (format winamaxJson.js), les segments où
// hero est engagé à 2 (lui + un seul adversaire encore vivant) -- le seul cas couvert par le
// solveur HU pour l'instant (voir tâche "solveur multiway", pas encore construit). Un segment
// démarre dès que la table se réduit à 2 joueurs vivants et englobe toutes les décisions
// ultérieures de hero tant que ça reste 2 (elles partagent le même arbre résolu). `events` est la
// vraie séquence d'actions (call/check ou raise) des DEUX joueurs de ce segment, dans l'ordre --
// nécessaire pour que buildHuTree sache quand "call" clôture vraiment la rue (voir sa doc).
function findHuSegments(spot, heroLogin) {
  const steps = spot.replay.steps.filter(s => s.street === 'PRE-FLOP' && s.player);
  const allNames = spot.seatsBase.map(s => s.name);
  const folded = new Set();
  const invested = { ...spot.replay.initialStreetCommit };
  allNames.forEach(n => { if (!(n in invested)) invested[n] = 0; });

  const segments = [];
  let current = null;

  for (const step of steps) {
    const live = allNames.filter(n => !folded.has(n));

    if (step.player === heroLogin && live.length === 2) {
      const villain = live.find(n => n !== heroLogin);
      if (!current || current.villain !== villain) {
        const bb = spot.replay.bb;
        current = {
          villain,
          // `invested` est en jetons bruts (comme replay.initialStreetCommit/step.chipsIn) --
          // tout le reste (startStacksBB, events[].toBB) est en bb, donc conversion nécessaire ici.
          startInvested: { [heroLogin]: invested[heroLogin] / bb, [villain]: invested[villain] / bb },
          events: [],
          deadMoneyBB: allNames.filter(n => n !== heroLogin && n !== villain).reduce((s, n) => s + (invested[n] || 0), 0) / bb,
          decisions: [],
        };
        segments.push(current);
      }
    }

    if (current && (step.player === heroLogin || step.player === current.villain) && live.length === 2) {
      const isFold = step.label === 'Fold';
      const isRaise = /^(Raise to|All-in)/.test(step.label || '');
      const chosenAction = isFold ? 'fold' : isRaise ? 'raise' : 'call';

      if (step.player === heroLogin) {
        const path = 'root' + current.events.map(e => '/' + e.realAction).join('');
        current.decisions.push({ step, path, chosenAction });
      }

      // Un fold reste un évènement de l'arbre (buildHuTree a besoin de connaître l'acteur de ce
      // noeud) même s'il n'entraîne aucune continuation -- un fold est toujours la dernière action
      // réelle de son segment de toute façon, donc "call" y redevient terminal automatiquement.
      const toBB = isRaise ? Number(step.label.match(/(\d+)$/)?.[1] || 0) / spot.replay.bb : null;
      current.events.push({ actor: step.player, realAction: chosenAction, toBB });
    }

    if (step.label === 'Fold') folded.add(step.player);
    if (step.chipsIn) invested[step.player] = (invested[step.player] || 0) + step.chipsIn;
  }
  return segments;
}

// Analyse toutes les décisions préflop HU de hero dans une main, compare chaque action réelle à
// la stratégie résolue par CFR, retourne un verdict par décision. Les coups multiway (3+ joueurs
// vivants à la décision de hero) sont explicitement marqués "non couverts" plutôt qu'ignorés en
// silence -- le solveur multiway n'est pas encore construit (voir plan).
export function analyzeHandPreflop(spot, heroLogin, { tableStacksBB, prizesBB, bountiesBB } = {}) {
  const bb = spot.replay.bb;
  if (!bb) return { handId: spot.handId, decisions: [] };

  const heroSeat = spot.seatsBase.find(s => s.name === heroLogin);
  if (!heroSeat || !heroSeat.cards || heroSeat.cards.includes('X')) {
    return { handId: spot.handId, decisions: [], skipped: 'cartes hero indisponibles' };
  }
  const heroClass = cardsToClass(heroSeat.cards);

  const startStacksAllBB = {};
  spot.seatsBase.forEach(s => { startStacksAllBB[s.name] = s.stackChips / bb; });

  const valuation = prizesBB
    ? makeIcmValuation(tableStacksBB || startStacksAllBB, prizesBB)
    : makeChipEvValuation();
  const mode = prizesBB ? 'hu-icm' : 'hu-chipev';

  const decisions = [];

  // Décisions multiway (3+ joueurs vivants) : approximation indépendante chip-EV/ICM (voir
  // multiwaySolver.js) -- jamais présentée comme un vrai équilibre, verdict basé sur un écart
  // d'EV en bb plutôt que sur une fréquence (pas de mix résolu ici, juste une comparaison d'EV).
  const steps = spot.replay.steps.filter(s => s.street === 'PRE-FLOP' && s.player);
  const allNames = spot.seatsBase.map(s => s.name);
  const folded = new Set();
  const invested = { ...spot.replay.initialStreetCommit };
  allNames.forEach(n => { if (!(n in invested)) invested[n] = 0; });

  for (const s of steps) {
    const live = allNames.filter(n => !folded.has(n));
    if (s.player === heroLogin && live.length > 2) {
      const isFold = s.label === 'Fold';
      const isRaise = /^(Raise to|All-in)/.test(s.label || '');
      const chosenAction = isFold ? 'fold' : isRaise ? 'raise' : 'call';
      const realRaiseToBB = isRaise ? Number(s.label.match(/(\d+)$/)?.[1] || 0) / bb : null;

      const currentBetBB = Math.max(...live.map(n => invested[n] || 0)) / bb;
      const heroInvestedBB = (invested[heroLogin] || 0) / bb;
      const deadMoneyBB = allNames.filter(n => !live.includes(n)).reduce((sum, n) => sum + (invested[n] || 0), 0) / bb;
      const opponents = live.filter(n => n !== heroLogin).map(n => ({ name: n, investedBB: (invested[n] || 0) / bb }));

      try {
        const mw = solveMultiwaySpot({
          heroLogin, heroClass, heroInvestedBB, currentBetBB, realAction: chosenAction, realRaiseToBB,
          opponents, deadMoneyBB, allStacksBB: startStacksAllBB, valuation,
        });
        const gapBB = mw.bestEV - mw.chosenEV;
        const verdict = gapBB < 0.5 ? 'aligné' : gapBB < 2 ? 'leak_mineur' : 'leak_majeur';
        decisions.push({
          street: 'PRE-FLOP', mode: prizesBB ? 'multiway-icm-approx' : 'multiway-chipev-approx',
          heroClass, action: s.label, chosenAction, liveCount: live.length,
          gapBB, evByAction: mw.evByAction, bestAction: mw.bestAction, verdict,
        });
      } catch (e) {
        decisions.push({ street: 'PRE-FLOP', action: s.label, verdict: 'non_couvert', reason: `erreur solveur multiway : ${e.message}` });
      }
    }
    if (s.label === 'Fold') folded.add(s.player);
    if (s.chipsIn) invested[s.player] = (invested[s.player] || 0) + s.chipsIn;
  }

  const segments = findHuSegments(spot, heroLogin);
  for (const seg of segments) {
    const startStacksBB = { [heroLogin]: startStacksAllBB[heroLogin], [seg.villain]: startStacksAllBB[seg.villain] };
    const result = solveHuPreflopSpot({
      players: [heroLogin, seg.villain],
      events: seg.events,
      investedBB: seg.startInvested,
      startStacksBB,
      allStacksBB: startStacksAllBB,
      deadMoneyBB: seg.deadMoneyBB,
      valuation,
    });

    for (const dec of seg.decisions) {
      const node = result[dec.path];
      if (!node) continue;
      const freqs = node.byClass[heroClass];
      const chosenFreq = freqs[dec.chosenAction] ?? 0;
      const bestFreq = Math.max(...Object.values(freqs));
      const deviation = bestFreq - chosenFreq;
      const verdict = deviation < 0.15 ? 'aligné' : deviation < 0.5 ? 'leak_mineur' : 'leak_majeur';
      decisions.push({
        street: 'PRE-FLOP', mode, heroClass, villain: seg.villain,
        action: dec.step.label, chosenAction: dec.chosenAction, chosenFreq, bestFreq, deviation, verdict,
        strategy: freqs,
      });
    }
  }

  return { handId: spot.handId, decisions };
}
