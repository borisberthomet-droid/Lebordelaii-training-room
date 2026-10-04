// Équité nécessaire pour payer un tapis préflop, tirée du classeur de Boris
// (« Equités ranges HU BORIS.xlsx », feuille « Calcul de cotes »).
//
// Ce sont des cotes, pas des opinions : à une profondeur donnée, le pot et le montant à payer
// sont connus, donc l'équité minimale pour que le call soit rentable l'est aussi. Les valeurs
// restent celles du classeur plutôt qu'un recalcul : les tailles d'open et de 3-bet retenues
// (2bb et 6bb) y sont déjà intégrées, et un recalcul maison déplacerait les seuils d'un point
// ou deux sans que l'élève sache pourquoi.

export const SITUATIONS = [
  {
    id: "vs-4bet-jam",
    label: "Face à un 4-bet tapis",
    contexte: "Tu as 3-bet à 6bb, il repousse tapis.",
    bande: "33 à 41 %",
    seuils: [
      { bb: 20, equite: 33.5 },
      { bb: 25, equite: 36.5 },
      { bb: 30, equite: 39 },
      { bb: 35, equite: 40.5 },
    ],
  },
  {
    id: "vs-3bet-jam",
    label: "Face à un 3-bet tapis",
    contexte: "Tu as ouvert à 2bb, il repousse tapis.",
    bande: "40 à 46 %",
    seuils: [
      { bb: 10, equite: 37 },
      { bb: 15, equite: 41 },
      { bb: 20, equite: 43 },
      { bb: 25, equite: 44.5 },
      { bb: 30, equite: 45.5 },
    ],
  },
  {
    id: "vs-open-jam",
    label: "Face à un open tapis",
    contexte: "Il ouvre tapis, tu es dans les blindes.",
    bande: "43 à 48 %",
    seuils: [
      { bb: 10, equite: 43.5 },
      { bb: 15, equite: 45.5 },
      { bb: 20, equite: 46.5 },
      { bb: 25, equite: 47.5 },
    ],
  },
];

export function seuilDe(situationId, bb) {
  const s = SITUATIONS.find((x) => x.id === situationId);
  return s ? s.seuils.find((x) => x.bb === bb) || null : null;
}

// Toutes les questions possibles : 13 couples situation / profondeur. Le nombre est volontairement
// petit — c'est une table de repères, et la connaître par cœur est le but, pas un effet de bord.
export function toutesLesQuestions() {
  return SITUATIONS.flatMap((s) => s.seuils.map((v) => ({ situation: s, ...v })));
}

// Erreur moyenne du meilleur prédicteur constant, mesurée sur les 13 seuils : répondre « 43 % »
// partout se trompe de 3,5 points en moyenne. C'est le zéro de la note dans skillScore.js.
//
// Le repère est serré, et c'est voulu : la bande utile ne fait que quatorze points de large
// (33,5 à 47,5). Deux points d'erreur sur une cote préflop, c'est beaucoup — c'est la différence
// entre payer et se coucher avec la même main.
export const ERREUR_NAIF = 3.5;
