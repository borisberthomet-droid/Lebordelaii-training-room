import { RANKS, SUITS } from './constants';

export function classId(i, j) {
  if (i === j) return RANKS[i] + RANKS[i];
  if (i < j) return RANKS[i] + RANKS[j] + 's';
  return RANKS[j] + RANKS[i] + 'o';
}

export function combosForClass(cls) {
  if (cls.length === 2) {
    const r = cls[0];
    const combos = [];
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) combos.push([r + SUITS[a], r + SUITS[b]]);
    return combos;
  }
  const r1 = cls[0], r2 = cls[1], type = cls[2];
  const combos = [];
  if (type === 's') {
    for (const s of SUITS) combos.push([r1 + s, r2 + s]);
  } else {
    for (const s1 of SUITS) for (const s2 of SUITS) if (s1 !== s2) combos.push([r1 + s1, r2 + s2]);
  }
  return combos;
}

export function comboKey(pair) { return pair.slice().sort().join(''); }

const CLASS_COMBOS_CACHE = {};
export function getClassCombos(cls) {
  if (!CLASS_COMBOS_CACHE[cls]) CLASS_COMBOS_CACHE[cls] = combosForClass(cls).map(p => ({ pair: p, key: comboKey(p) }));
  return CLASS_COMBOS_CACHE[cls];
}

export const ALL_CLASSES = [];
for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) ALL_CLASSES.push(classId(i, j));

export function parseClass(cls) {
  if (cls.length === 2) { const idx = RANKS.indexOf(cls[0]); return { i: idx, j: idx, type: 'pair' }; }
  const r1 = cls[0], r2 = cls[1], type = cls[2];
  const i1 = RANKS.indexOf(r1), i2 = RANKS.indexOf(r2);
  if (type === 's') return { i: i1, j: i2, type: 'suited' };
  return { i: i2, j: i1, type: 'offsuit' };
}

export function getLineClasses(cls) {
  const { i, j, type } = parseClass(cls);
  if (type === 'pair') return [cls];
  if (type === 'suited') { const out = []; for (let j2 = i + 1; j2 < 13; j2++) out.push(classId(i, j2)); return out; }
  const out = []; for (let i2 = j + 1; i2 < 13; i2++) out.push(classId(i2, j)); return out;
}
