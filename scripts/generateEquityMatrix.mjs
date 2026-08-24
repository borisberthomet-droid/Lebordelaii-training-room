// Génère UNE FOIS (script offline, pas exécuté à la requête) la matrice d'équité préflop
// classe-vs-classe (169x169) à l'abattage, pondérée par combo avec retrait de cartes correct.
// Résultat mis en cache dans src/lib/poker/solver/equityMatrix.json, chargé tel quel par le
// solveur CFR (jamais recalculé en live — l'équité entre deux classes de mains ne dépend que
// de la combinatoire fixe d'un jeu de 52 cartes, donc c'est une constante).
import { writeFileSync } from 'fs';
import pkg from 'pokersolver';
const { Hand } = pkg;

const RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];
const SUITS = ['s','h','d','c'];

function classId(i, j) {
  if (i === j) return RANKS[i] + RANKS[i];
  if (i < j) return RANKS[i] + RANKS[j] + 's';
  return RANKS[j] + RANKS[i] + 'o';
}
function combosForClass(cls) {
  if (cls.length === 2) {
    const r = cls[0], combos = [];
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) combos.push([r + SUITS[a], r + SUITS[b]]);
    return combos;
  }
  const r1 = cls[0], r2 = cls[1], type = cls[2], combos = [];
  if (type === 's') { for (const s of SUITS) combos.push([r1 + s, r2 + s]); }
  else { for (const s1 of SUITS) for (const s2 of SUITS) if (s1 !== s2) combos.push([r1 + s1, r2 + s2]); }
  return combos;
}

const ALL_CLASSES = [];
for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) ALL_CLASSES.push(classId(i, j));
const UNIQUE_CLASSES = [...new Set(ALL_CLASSES)]; // 169

const FULL_DECK = [];
for (const r of RANKS) for (const s of SUITS) FULL_DECK.push(r + s);

function sampleWithoutReplacement(deck, n) {
  const arr = deck.slice(), out = [];
  for (let k = 0; k < n; k++) {
    const i = Math.floor(Math.random() * arr.length);
    out.push(arr[i]); arr[i] = arr[arr.length - 1]; arr.pop();
  }
  return out;
}

function pairEquity(handA, handB, trials) {
  const dead = new Set([...handA, ...handB]);
  const deck = FULL_DECK.filter(c => !dead.has(c));
  let winsA = 0, winsB = 0;
  for (let t = 0; t < trials; t++) {
    const board = sampleWithoutReplacement(deck, 5);
    const hA = Hand.solve([...handA, ...board]);
    const hB = Hand.solve([...handB, ...board]);
    const winners = Hand.winners([hA, hB]);
    if (winners.length === 2) { winsA += 0.5; winsB += 0.5; }
    else if (winners[0] === hA) winsA += 1;
    else winsB += 1;
  }
  return [winsA / trials, winsB / trials];
}

// Équité classe A vs classe B pondérée par tous les combos valides (sans collision de cartes)
// entre les deux classes -- gère le retrait de cartes correctement plutôt qu'un simple combo
// représentatif par classe.
function classPairEquity(clsA, clsB, trialsPerCombo) {
  const combosA = combosForClass(clsA), combosB = combosForClass(clsB);
  let sumA = 0, sumB = 0, n = 0;
  for (const ca of combosA) {
    for (const cb of combosB) {
      if (ca[0] === cb[0] || ca[0] === cb[1] || ca[1] === cb[0] || ca[1] === cb[1]) continue; // collision
      const [eqA, eqB] = pairEquity(ca, cb, trialsPerCombo);
      sumA += eqA; sumB += eqB; n++;
    }
  }
  if (n === 0) return null; // ex: AA vs AA impossible sans collision -- classe identique, non pertinent
  return [sumA / n, sumB / n];
}

const TRIALS_PER_COMBO = 60; // pondéré par plusieurs combos par paire de classes -> volume total correct
const matrix = {}; // matrix[clsA][clsB] = équité de A face à B
const t0 = Date.now();
let done = 0;
const totalPairs = (UNIQUE_CLASSES.length * (UNIQUE_CLASSES.length + 1)) / 2;

for (let i = 0; i < UNIQUE_CLASSES.length; i++) {
  const clsA = UNIQUE_CLASSES[i];
  matrix[clsA] = matrix[clsA] || {};
  for (let j = i; j < UNIQUE_CLASSES.length; j++) {
    const clsB = UNIQUE_CLASSES[j];
    matrix[clsB] = matrix[clsB] || {};
    if (clsA === clsB) { matrix[clsA][clsB] = 0.5; done++; continue; }
    const res = classPairEquity(clsA, clsB, TRIALS_PER_COMBO);
    if (res) {
      matrix[clsA][clsB] = res[0];
      matrix[clsB][clsA] = res[1];
    } else {
      matrix[clsA][clsB] = 0.5;
      matrix[clsB][clsA] = 0.5;
    }
    done++;
    if (done % 500 === 0) {
      const elapsed = (Date.now() - t0) / 1000;
      console.log(`${done}/${totalPairs} paires, ${elapsed.toFixed(0)}s écoulées, ETA ${((elapsed / done) * (totalPairs - done)).toFixed(0)}s`);
    }
  }
}

writeFileSync(new URL('../src/lib/poker/solver/equityMatrix.json', import.meta.url), JSON.stringify(matrix));
console.log('Terminé en', ((Date.now() - t0) / 1000).toFixed(0), 's ->', 'src/lib/poker/solver/equityMatrix.json');
