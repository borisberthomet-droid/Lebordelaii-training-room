// Trainer de calcul mental rapide pour les situations MTT courantes : sizing en % du pot
// (en BB ou en jetons, dans les deux sens) et conversion cote risque/récompense -> équité
// minimale. Même esprit que potOdds.js mais pour les calculs "à la volée" plutôt que les
// fréquences de call/bluff en elles-mêmes.

const BET_SIZES_PCT = [25, 33, 40, 50, 66, 75, 80, 100, 125, 150];

function roundTo(v, step) {
  return Math.round(v / step) * step;
}

export const QUESTION_TYPES = ["sizing_amount", "sizing_pct", "odds_ratio"];

export function generateSpot() {
  const questionType = QUESTION_TYPES[Math.floor(Math.random() * QUESTION_TYPES.length)];
  const unit = Math.random() < 0.5 ? "BB" : "jetons";
  const pot = unit === "BB" ? roundTo(3 + Math.random() * 57, 1) : roundTo(500 + Math.random() * 59500, 100);
  const betPct = BET_SIZES_PCT[Math.floor(Math.random() * BET_SIZES_PCT.length)];
  const bet = unit === "BB" ? Math.round((pot * betPct) / 100 * 10) / 10 : roundTo((pot * betPct) / 100, 5);

  // Cote risque/récompense — indépendante de pot/bet ci-dessus, propre au type odds_ratio.
  const risk = roundTo(5 + Math.random() * 95, 5);
  const reward = roundTo(10 + Math.random() * 290, 5);

  return { questionType, unit, pot, betPct, bet, risk, reward };
}

export function computeAnswer({ questionType, pot, betPct, bet, risk, reward }) {
  if (questionType === "sizing_amount") return (pot * betPct) / 100;
  if (questionType === "sizing_pct") return (bet / pot) * 100;
  return (risk / (risk + reward)) * 100; // odds_ratio
}

export const QUESTION_META = {
  sizing_amount: {
    label: "Montant à miser",
    unit: (s) => s.unit,
    // Tolérance relative (3%) plutôt qu'absolue : un pot en jetons peut valoir 500 ou 60 000,
    // une tolérance fixe en points n'aurait aucun sens dans les deux cas à la fois.
    isCorrect: (guess, answer) => Math.abs(guess - answer) / answer <= 0.03,
    prompt: (s) => `${s.pot} ${s.unit} × ${s.betPct}% = ?`,
    formula: (s, a) => `${s.pot} × ${s.betPct}% = ${a.toFixed(s.unit === "BB" ? 1 : 0)} ${s.unit}`,
  },
  sizing_pct: {
    label: "Pourcentage du pot",
    unit: () => "%",
    isCorrect: (guess, answer) => Math.abs(guess - answer) <= 2,
    prompt: (s) => `${s.bet} / ${s.pot} = ? %`,
    formula: (s, a) => `${s.bet} ÷ ${s.pot} × 100 = ${a.toFixed(1)}%`,
  },
  odds_ratio: {
    label: "Cote risque / récompense",
    unit: () => "%",
    isCorrect: (guess, answer) => Math.abs(guess - answer) <= 2,
    prompt: (s) => `${s.risk} / (${s.risk} + ${s.reward}) = ? %`,
    formula: (s, a) => `${s.risk} ÷ (${s.risk} + ${s.reward}) × 100 = ${a.toFixed(1)}%`,
  },
};
