import { Hand } from 'pokersolver';
import { RANKS, SUITS } from '../constants';

export const FULL_DECK = [];
for (const r of RANKS) for (const s of SUITS) FULL_DECK.push(r + s);

export function sampleWithoutReplacement(deck, n) {
  const arr = deck.slice();
  const out = [];
  for (let k = 0; k < n; k++) {
    const i = Math.floor(Math.random() * arr.length);
    out.push(arr[i]);
    arr[i] = arr[arr.length - 1];
    arr.pop();
  }
  return out;
}

// Équité Monte-Carlo à l'abattage pour N mains de 2 cartes (aucun board connu, cas préflop).
// Le retrait de cartes (blockers) entre les mains est géré automatiquement : les cartes déjà
// utilisées par une main sont exclues du deck de tirage, donc aussi des runouts de board.
export function equityMonteCarlo(hands, trials = 2000) {
  const dead = new Set(hands.flat());
  if (dead.size !== hands.length * 2) throw new Error('Cartes dupliquées entre les mains fournies');
  const deck = FULL_DECK.filter(c => !dead.has(c));
  const wins = new Array(hands.length).fill(0);
  for (let t = 0; t < trials; t++) {
    const board = sampleWithoutReplacement(deck, 5);
    const solved = hands.map(h => Hand.solve([...h, ...board]));
    const winners = Hand.winners(solved);
    const share = 1 / winners.length;
    for (const w of winners) wins[solved.indexOf(w)] += share;
  }
  return wins.map(w => w / trials);
}

// Équité HU entre deux mains exactes (raccourci pratique du cas à 2 le plus courant).
export function headsUpEquity(handA, handB, trials = 2000) {
  const [eqA, eqB] = equityMonteCarlo([handA, handB], trials);
  return { equityA: eqA, equityB: eqB };
}
