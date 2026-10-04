// Ranges adverses, décodées des captures du classeur de Boris (feuille TRAINING, six images
// collées à côté des grilles vides). Elles ne sont pas recopiées à l'œil : la hauteur de la bande
// colorée de chaque case a été mesurée au pixel, puis le total pondéré vérifié contre la taille
// de range que Boris a notée à la main à côté de chaque grille.
//
// Cinq des six retombent exactement sur sa note. La sixième, « JAM 10 BB SB KO », donne 48,0 %
// pour une note de 46 % : deux points d'écart, soit une case à fréquence partielle lue comme
// pleine, soit un arrondi de sa part. C'est la seule à vérifier si un chiffre paraît faux.
//
// Une valeur de 1 veut dire « toujours », 0,5 « une fois sur deux ». Les mains absentes ne sont
// jamais jouées de cette façon-là.

export const RANGES = {
  // jam-sb-10 — 54.1 % des combos, 101 cases
  "jam-sb-10": { pct: 54.1, mains: {
    "AA": 1, "AKs": 1, "AQs": 1, "AJs": 1, "ATs": 1, "A9s": 1, "A8s": 1, "A7s": 1, "A6s": 1, "A5s": 1, "A4s": 1, "A3s": 1, "A2s": 1,
    "AKo": 1, "KK": 1, "KQs": 1, "KJs": 1, "KTs": 1, "K9s": 1, "K8s": 1, "K7s": 1, "K6s": 1, "K5s": 1, "K4s": 1, "K3s": 1, "K2s": 1,
    "AQo": 1, "KQo": 1, "QQ": 1, "QJs": 1, "QTs": 1, "Q9s": 1, "Q8s": 1, "Q7s": 1, "Q6s": 1, "Q5s": 1, "Q4s": 1, "Q3s": 1, "Q2s": 1,
    "AJo": 1, "KJo": 1, "QJo": 1, "JJ": 1, "JTs": 1, "J9s": 1, "J8s": 1, "J7s": 1, "J6s": 1, "J5s": 1, "J4s": 1,
    "ATo": 1, "KTo": 1, "QTo": 1, "JTo": 1, "TT": 1, "T9s": 1, "T8s": 1, "T7s": 1, "T6s": 1,
    "A9o": 1, "K9o": 1, "Q9o": 1, "J9o": 1, "T9o": 1, "99": 1, "98s": 1, "97s": 1, "96s": 1,
    "A8o": 1, "K8o": 1, "Q8o": 1, "J8o": 1, "T8o": 1, "98o": 1, "88": 1, "87s": 1, "86s": 1,
    "A7o": 1, "K7o": 1, "Q7o": 1, "77": 1, "76s": 1,
    "A6o": 1, "K6o": 1, "Q6o": 1, "66": 1, "65s": 1,
    "A5o": 1, "K5o": 1, "Q5o": 1, "55": 1, "54s": 1,
    "A4o": 1, "K4o": 1, "44": 1,
    "A3o": 1, "K3o": 1, "33": 1,
    "A2o": 1, "K2o": 1, "22": 1,
  } },
  // jam-sb-10-ko — 48 % des combos, 84 cases
  "jam-sb-10-ko": { pct: 48, mains: {
    "AKs": 1, "AQs": 1, "AJs": 1, "ATs": 1, "A9s": 1, "A8s": 1, "A7s": 1, "A6s": 1, "A5s": 1, "A4s": 1, "A3s": 1, "A2s": 1,
    "AKo": 1, "KQs": 1, "KJs": 1, "KTs": 1, "K9s": 1, "K8s": 1, "K7s": 1, "K6s": 1, "K5s": 1, "K4s": 1, "K3s": 1, "K2s": 1,
    "AQo": 1, "KQo": 1, "QJs": 1, "QTs": 1, "Q9s": 1, "Q8s": 1, "Q7s": 1, "Q6s": 1, "Q5s": 1, "Q4s": 1, "Q3s": 1, "Q2s": 1,
    "AJo": 1, "KJo": 1, "QJo": 1, "JJ": 1, "JTs": 1, "J9s": 1, "J8s": 1, "J7s": 1,
    "ATo": 1, "KTo": 1, "QTo": 1, "JTo": 1, "TT": 1, "T9s": 1, "T8s": 1,
    "A9o": 1, "K9o": 1, "Q9o": 1, "J9o": 1, "T9o": 1, "99": 1,
    "A8o": 1, "K8o": 1, "Q8o": 1, "J8o": 1, "T8o": 1, "88": 1,
    "A7o": 1, "K7o": 1, "Q7o": 1, "77": 1,
    "A6o": 1, "K6o": 1, "Q6o": 1, "66": 1,
    "A5o": 1, "K5o": 1, "Q5o": 1, "55": 1,
    "A4o": 1, "K4o": 1, "44": 1,
    "A3o": 1, "K3o": 1, "33": 1,
    "A2o": 1, "K2o": 1, "22": 1,
  } },
  // jam-bu-15-ko — 24.2 % des combos, 47 cases
  "jam-bu-15-ko": { pct: 24.2, mains: {
    "AJs": 0.47, "ATs": 1, "A9s": 1, "A8s": 1, "A7s": 1, "A6s": 1, "A5s": 1, "A4s": 1, "A3s": 1, "A2s": 1,
    "AKo": 1, "KQs": 0.38, "KJs": 1, "KTs": 1, "K9s": 1, "K8s": 1,
    "AQo": 1, "KQo": 1, "QJs": 1, "QTs": 1, "Q9s": 1,
    "AJo": 1, "KJo": 1, "QJo": 1, "JJ": 1, "JTs": 1, "J9s": 1,
    "ATo": 1, "KTo": 1, "TT": 1, "T9s": 1,
    "A9o": 1, "99": 1,
    "A8o": 1, "88": 1,
    "A7o": 1, "77": 1,
    "A6o": 1, "66": 1,
    "A5o": 1, "55": 1,
    "A4o": 1, "44": 1,
    "A3o": 1, "33": 1,
    "A2o": 0.41, "22": 0.39,
  } },
  // resteal-co-20 — 13.3 % des combos, 28 cases
  "resteal-co-20": { pct: 13.3, mains: {
    "AKs": 0.91, "AQs": 1, "AJs": 1, "ATs": 1, "A9s": 0.91, "A8s": 0.9, "A7s": 0.91, "A5s": 0.91,
    "AKo": 1, "KQs": 1, "KJs": 1, "KTs": 1,
    "AQo": 1, "KQo": 1, "QQ": 1, "QJs": 1, "QTs": 0.94,
    "AJo": 1, "JJ": 1,
    "ATo": 1, "TT": 1,
    "A9o": 1, "99": 1,
    "88": 1,
    "77": 1,
    "66": 1,
    "55": 1,
    "44": 1,
  } },
  // resteal-ep-20 — 6.6 % des combos, 18 cases
  "resteal-ep-20": { pct: 6.6, mains: {
    "AKs": 0.76, "AQs": 0.75, "AJs": 0.22, "ATs": 0.22, "A5s": 0.53,
    "AKo": 1, "KQs": 0.47, "KJs": 0.22,
    "AQo": 1, "QQ": 0.76, "QJs": 0.21,
    "AJo": 1, "JJ": 1,
    "TT": 1,
    "99": 1,
    "88": 1,
    "77": 1,
    "66": 0.48,
  } },
  // vs-4bet-jam — 3.8 % des combos, 9 cases
  "vs-4bet-jam": { pct: 3.8, mains: {
    "AA": 0.43, "AKs": 1, "AQs": 0.39,
    "AKo": 1, "KK": 1,
    "AQo": 0.47, "QQ": 1,
    "JJ": 1,
    "TT": 1,
  } },
};

// Les 169 cases dans l'ordre de la grille : A en haut à gauche, suited au-dessus de la diagonale.
export const CASES = [
  ["AA","AKs","AQs","AJs","ATs","A9s","A8s","A7s","A6s","A5s","A4s","A3s","A2s"],
  ["AKo","KK","KQs","KJs","KTs","K9s","K8s","K7s","K6s","K5s","K4s","K3s","K2s"],
  ["AQo","KQo","QQ","QJs","QTs","Q9s","Q8s","Q7s","Q6s","Q5s","Q4s","Q3s","Q2s"],
  ["AJo","KJo","QJo","JJ","JTs","J9s","J8s","J7s","J6s","J5s","J4s","J3s","J2s"],
  ["ATo","KTo","QTo","JTo","TT","T9s","T8s","T7s","T6s","T5s","T4s","T3s","T2s"],
  ["A9o","K9o","Q9o","J9o","T9o","99","98s","97s","96s","95s","94s","93s","92s"],
  ["A8o","K8o","Q8o","J8o","T8o","98o","88","87s","86s","85s","84s","83s","82s"],
  ["A7o","K7o","Q7o","J7o","T7o","97o","87o","77","76s","75s","74s","73s","72s"],
  ["A6o","K6o","Q6o","J6o","T6o","96o","86o","76o","66","65s","64s","63s","62s"],
  ["A5o","K5o","Q5o","J5o","T5o","95o","85o","75o","65o","55","54s","53s","52s"],
  ["A4o","K4o","Q4o","J4o","T4o","94o","84o","74o","64o","54o","44","43s","42s"],
  ["A3o","K3o","Q3o","J3o","T3o","93o","83o","73o","63o","53o","43o","33","32s"],
  ["A2o","K2o","Q2o","J2o","T2o","92o","82o","72o","62o","52o","42o","32o","22"],
];

export function poidsDe(scenarioId, main) {
  return RANGES[scenarioId]?.mains?.[main] ?? 0;
}
