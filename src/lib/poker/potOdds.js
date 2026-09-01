// Générateur de situations de pot odds river (bet et/ou raise) + calcul des 4 fréquences
// clés. P = pot avant l'action adverse, B = montant de cette action (mise ou relance).
//
// - Équité requise pour call = B / (P + 2B)  — c'est aussi la fréquence de bluff
//   à l'équilibre que l'adversaire doit avoir dans sa range de mise/relance.
// - Fold equity requise pour qu'un bluff isolé soit rentable = B / (P + B).
// - Ratio de bluff théorique optimal (bluffs / (value + bluffs)) quand on est
//   l'attaquant = B / (P + 2B) — même formule que l'équité requise pour call,
//   vue du côté de celui qui mise.
// - Équité minimale pour value bet (vs la range totale de vilain, qui défend
//   exactement sa MDF) = 1 − f/2, où f = P/(P+B) est la fréquence de call de
//   vilain à l'équilibre. f=1 (vilain ne fold jamais) redonne le seuil classique
//   de 50% ; plus B grandit, plus f baisse et plus le seuil monte (ex : 75% en bet pot).

const BET_SIZES_PCT = [33, 50, 66, 75, 100, 125, 150, 200];

export const QUESTION_TYPES = ["call_equity", "bluff_fold_equity", "bluff_ratio", "value_bet_equity", "bluff_combos"];

export function generateSpot() {
  const pot = Math.round((20 + Math.random() * 180) / 5) * 5;
  const betPct = BET_SIZES_PCT[Math.floor(Math.random() * BET_SIZES_PCT.length)];
  const bet = Math.max(5, Math.round((pot * betPct) / 100 / 5) * 5);
  const isRaise = Math.random() < 0.4;
  const questionType = QUESTION_TYPES[Math.floor(Math.random() * QUESTION_TYPES.length)];
  // Utilisés seulement par bluff_combos, générés systématiquement (coût nul) pour rester
  // cohérent avec le reste du spot si jamais le type de question change après coup.
  const valueCombos = 4 + Math.floor(Math.random() * 57); // 4..60
  const frame = Math.random() < 0.5 ? "hero" : "villain";
  return { pot, bet, betPct, isRaise, questionType, valueCombos, frame };
}

// Ratio bluffs/(value+bluffs) nécessaire = B/(P+2B) (même formule que call_equity/bluff_ratio,
// voir plus haut) ; convertit ensuite ce ratio en nombre de combos de bluff pour un nombre de
// combos de value donné : bluffCombos = valueCombos × ratio/(1−ratio).
function bluffCombosNeeded(pot, bet, valueCombos) {
  const ratio = bet / (pot + 2 * bet);
  return valueCombos * (ratio / (1 - ratio));
}

export function computeAnswer({ pot, bet, questionType, valueCombos }) {
  if (questionType === "bluff_fold_equity") return (bet / (pot + bet)) * 100;
  if (questionType === "value_bet_equity") {
    const f = pot / (pot + bet);
    return (1 - f / 2) * 100;
  }
  if (questionType === "bluff_combos") return bluffCombosNeeded(pot, bet, valueCombos);
  return (bet / (pot + 2 * bet)) * 100; // call_equity et bluff_ratio partagent la formule
}

export const QUESTION_META = {
  call_equity: {
    label: "Équité requise pour call",
    unit: "%", tolerance: 2,
    prompt: (s) =>
      `Le pot fait ${s.pot}. Vilain ${s.isRaise ? "relance à" : "mise"} ${s.bet} (soit ${s.betPct}% du pot). Quelle équité minimale te faut-il pour call, à l'équilibre ?`,
    hint: "= la fréquence de bluff que l'adversaire doit avoir dans sa range pour que tu sois indifférent entre call et fold.",
    formula: (s, a) => `Mise / (Pot + 2×Mise) = ${s.bet} / (${s.pot} + 2×${s.bet}) = ${a.toFixed(1)}%`,
  },
  bluff_fold_equity: {
    label: "Fold equity requise pour un bluff",
    unit: "%", tolerance: 2,
    prompt: (s) =>
      `Tu envisages de ${s.isRaise ? "relancer à" : "bluffer"} ${s.bet} dans un pot de ${s.pot} (soit ${s.betPct}% du pot). À quelle fréquence ton adversaire doit-il fold pour que CE ${s.isRaise ? "bluff de relance" : "bluff"}, pris isolément, soit rentable ?`,
    hint: "Ici on ne parle pas d'équilibre de range — juste de la rentabilité de ce coup précis, en supposant 0% d'équité quand on est call.",
    formula: (s, a) => `Mise / (Pot + Mise) = ${s.bet} / (${s.pot} + ${s.bet}) = ${a.toFixed(1)}%`,
  },
  bluff_ratio: {
    label: "Ratio de bluff théorique optimal",
    unit: "%", tolerance: 2,
    prompt: (s) =>
      `Tu ${s.isRaise ? "relances à" : "mises"} ${s.bet} dans un pot de ${s.pot} (soit ${s.betPct}% du pot) avec une range polarisée (value + bluffs). Quel pourcentage de ta range de ${s.isRaise ? "relance" : "mise"} doit être des bluffs pour rester équilibré ?`,
    hint: "= la même fréquence que l'équité requise pour call, vue du côté de celui qui mise : au-delà, l'adversaire peut te punir en callant large ; en dessous, en foldant large.",
    formula: (s, a) => `Mise / (Pot + 2×Mise) = ${s.bet} / (${s.pot} + 2×${s.bet}) = ${a.toFixed(1)}%`,
  },
  value_bet_equity: {
    label: "Équité minimale pour value bet",
    unit: "%", tolerance: 2,
    prompt: (s) =>
      `Tu as une main solide et tu envisages de ${s.isRaise ? "relancer à" : "miser"} ${s.bet} dans un pot de ${s.pot} (soit ${s.betPct}% du pot), contre un vilain qui défend exactement sa MDF. Quelle équité minimale te faut-il contre SA RANGE TOTALE pour que ce value bet soit rentable ?`,
    hint: "≠ l'équité requise pour call : ici tu dois battre 50% de ce qui continue à jouer contre toi (sa range de call), pas 50% de sa range totale — plus tu mises gros, plus il défend serré, plus ce seuil monte.",
    formula: (s, a) => {
      const f = (s.pot / (s.pot + s.bet)) * 100;
      return `f = Pot/(Pot+Mise) = ${s.pot}/(${s.pot}+${s.bet}) = ${f.toFixed(1)}% (MDF) · EQm = 1 − f/2 = ${a.toFixed(1)}%`;
    },
  },
  bluff_combos: {
    label: "Combos de bluff nécessaires",
    unit: "combos", tolerance: 1,
    prompt: (s) => s.frame === "hero"
      ? `Tu ${s.isRaise ? "relances à" : "mises"} ${s.bet} dans un pot de ${s.pot} (soit ${s.betPct}% du pot, pot où tu es all-in ou en river). Tu as ${s.valueCombos} combos de value dans ta range de ${s.isRaise ? "relance" : "mise"}. Combien de combos de bluff te faut-il pour rester équilibré ?`
      : `Ton adversaire ${s.isRaise ? "relance à" : "mise"} ${s.bet} dans un pot de ${s.pot} (soit ${s.betPct}% du pot). Tu lui identifies ${s.valueCombos} combos de value. S'il joue équilibré, combien de combos de bluff sa range doit-elle contenir ?`,
    hint: "1) ratio de bluff = Mise/(Pot+2×Mise) (même formule que le ratio de bluff en %) — 2) combos de bluff = combos de value × ratio/(1−ratio).",
    formula: (s, a) => {
      const ratio = (s.bet / (s.pot + 2 * s.bet)) * 100;
      return `Ratio = ${s.bet}/(${s.pot}+2×${s.bet}) = ${ratio.toFixed(1)}% · Bluffs = ${s.valueCombos} × ${ratio.toFixed(1)}%/${(100 - ratio).toFixed(1)}% = ${a.toFixed(1)} combos`;
    },
  },
};
