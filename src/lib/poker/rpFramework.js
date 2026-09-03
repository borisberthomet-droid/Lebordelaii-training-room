// Framework PKO hors-ICM de Boris — chaîne α → r → RP → multiplicateur de range.
// Source : HANDOFF_claude_code.md / PKO_framework_reference.md (calibré sur ~15 sims solver HRC).
//
// ZONE DE VALIDITÉ : 100% → ~30% de field restant. En dessous, la pression ICM s'ajoute et il
// faut le calcul exact (pilier 2). Ce module ne doit JAMAIS générer de spot sous 30% FL.
//
// Les briques de calcul (générateur α, formule RP, multiplicateur) vivent dans memoTables.js —
// elles alimentent aussi les fiches mémo. Pas de duplication : une seule définition par formule.

import {
  alphaFor, riskPremiumFromRatio, rangeMultiplier, ELASTICITY_LEVELS,
  PKO_STRUCTURES, DEFAULT_STRUCTURE_ID, pkoStructure,
} from "./memoTables";

// α dépend de la structure du tournoi, pas seulement du field restant : un Space KO (50% du
// buy-in dans les KO) donne α = 0.32 à 50% FL, un PKO 50/50 (45%) donne 0.29. Environ 11%
// d'écart sur α, soit ~1 point de RP. C'est un paramètre, pas une constante.
export { PKO_STRUCTURES, DEFAULT_STRUCTURE_ID, pkoStructure };

export const FL_MIN = 0.30; // limite basse de validité du framework
export const FL_MAX = 1.0;

// --- Étape 1 : valeur d'un KO en BB ---------------------------------------------------------
// N_KO = bounty du vilain / bounty initiale du tournoi.
// startingStackBB = starting stack exprimé en BB ACTUELLES ≈ average de la table × field restant.
export function koValueBB(nKO, alphaFL, startingStackBB) {
  return nKO * alphaFL * startingStackBB;
}

// --- Étape 2 : ratio r ----------------------------------------------------------------------
export function ratioR(koBB, villainStackBB) {
  return koBB / villainStackBB;
}

// --- Étape 3 : RP, puis ajustement de couverture (régime 2 uniquement) -----------------------
// Le RP de la formule correspond au cas « hero est couvert par des joueurs derrière ».
// Si hero couvre tout le monde derrière, on retire 5 points (RP plus négatif).
export const COVERAGE_BONUS_PTS = 5;

export function rpWithCoverage(rp, coversEveryoneBehind) {
  return coversEveryoneBehind ? rp - COVERAGE_BONUS_PTS : rp;
}

// --- Régime 1 : hero clôture l'action -------------------------------------------------------
// Pas de RP, pas de coefficient, pas de malus couverture : seuil d'équité direct.
export function closingEquityThreshold(toCall, potFinal, koBB) {
  return (toCall / (potFinal + koBB)) * 100;
}

export function alphaForFieldLeft(fl, structureId = DEFAULT_STRUCTURE_ID) {
  return alphaFor(structureId, fl);
}

// Chaîne complète pour un spot de régime 2. Retourne chaque étape intermédiaire : le trainer
// affiche la correction pas à pas, donc rien ne doit rester implicite.
export function solveFrameworkSpot(spot) {
  const { fieldLeft, avgStackBB, nKO, villainStackBB, coversEveryoneBehind, k, structureId } = spot;
  const alpha = alphaForFieldLeft(fieldLeft, structureId);
  // Quand la blinde est connue, elle fait foi : starting stack ÷ BB est exact. Sinon on retombe
  // sur average × field restant, qui est la même quantité écrite autrement (les jetons en jeu
  // sont constants, donc average = starting ÷ field restant).
  const startingStackBB = spot.startingStackBB ?? avgStackBB * fieldLeft;
  const koBB = koValueBB(nKO, alpha, startingStackBB);
  const r = ratioR(koBB, villainStackBB);
  const rpRaw = riskPremiumFromRatio(r);
  const rp = rpWithCoverage(rpRaw, coversEveryoneBehind);
  // rangeMultiplier(k, rpAbs) attend rpAbs en FRACTION (0.16), pas en points (16).
  const M = rangeMultiplier(k, Math.abs(rp) / 100);
  return { alpha, startingStackBB, koBB, r, rpRaw, rp, M };
}

// --- Génération de spots --------------------------------------------------------------------

function rand(min, max) {
  return min + Math.random() * (max - min);
}


// Nombre moyen de KO de base par survivant, déduit de la conservation du pool KO — le même
// modèle que le moteur ICM : chaque élimination retire la moitié d'une prime du pool.
//   pool restant = B_total × (0.5 + 0.5 × FL)     joueurs restants = N × FL
//   → N_KO moyen = (0.5 + 0.5 × FL) / FL
// Donne 1.0 à 100% FL, 1.5 à 50%, 2.5 à 25%, 5.5 à 10% — cohérent avec l'exemple de TF du
// document de Boris, où un vilain porte 10 KO de base. Un plafond fixe à 4, comme le suggérait
// le brief (écrit pour le module early/mid seul), inversait la courbe : le RP faiblissait en fin
// de tournoi au lieu de se renforcer.
export function meanNKO(fieldLeft) {
  return (0.5 + 0.5 * fieldLeft) / Math.max(fieldLeft, 0.005);
}

// Tirage autour de cette moyenne : la plupart des joueurs sont proches, quelques-uns ont
// accumulé (le porteur de grosse prime est justement le spot intéressant).
function drawNKO(fieldLeft) {
  const mean = meanNKO(fieldLeft);
  const draw = mean * rand(0.4, 2.2);
  // Arrondi au demi-KO en early (1, 1.5, 2…), à l'unité quand les primes s'empilent.
  return mean < 3 ? Math.max(1, Math.round(draw * 2) / 2) : Math.max(1, Math.round(draw));
}

// Average stack réaliste : se resserre à mesure que le tournoi avance. starting = average × FL,
// donc à 30% FL un average de ~38bb donne un starting de ~11bb — cohérent avec un vrai MTT.
function drawAvgStackBB(fieldLeft) {
  const base = 25 + fieldLeft * 45;
  return Math.round(base * rand(0.8, 1.2) * 10) / 10;
}

const POSITIONS = ["UTG", "HJ", "CO", "BTN", "SB", "BB"];

// --- Niveau de blinds ------------------------------------------------------------------------
// Sans la blinde, « le vilain porte 1 KO » ne dit rien : l'élève ne peut pas savoir si ça vaut
// 5 BB ou 12 BB. On tire donc un vrai palier, et c'est LUI qui devient la vérité du spot —
// starting stack ÷ BB est alors exact, au lieu de passer par l'approximation average × FL.
const BLIND_MANTISSAS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8];
const BLIND_MIN = 50;
const BLIND_MAX = 5e6;

export const BLIND_LADDER = (() => {
  const out = [];
  for (let k = 1; k <= 7; k++) {
    for (const m of BLIND_MANTISSAS) {
      const bb = m * Math.pow(10, k);
      if (bb >= BLIND_MIN && bb <= BLIND_MAX) out.push(bb);
    }
  }
  return out.sort((a, b) => a - b);
})();

// Palier le plus proche de la cible en écart RELATIF : à 3000 jetons de cible, 2500 et 4000 sont
// à 500 l'un comme l'autre en absolu, mais 2500 est nettement plus proche en proportion.
export function snapBigBlind(target) {
  return BLIND_LADDER.reduce((best, bb) =>
    Math.abs(Math.log(bb / target)) < Math.abs(Math.log(best / target)) ? bb : best
  , BLIND_LADDER[0]);
}

// Winamax joue l'ante en big blind. Purement cosmétique ici : l'ante n'entre pas dans la chaîne.
export function blindLevel(bigBlind) {
  return { bigBlind, smallBlind: bigBlind / 2, ante: bigBlind };
}

// Stacks des sièges, recentrés pour que leur moyenne soit exactement l'average annoncé. Sans ce
// recentrage l'élève lit une table dont la moyenne contredit la donnée du problème.
function drawSeatStacks(n, avgStackBB, spread) {
  const raw = Array.from({ length: n }, () => rand(Math.max(0.15, 1 - spread), 1 + spread));
  const mean = raw.reduce((a, b) => a + b, 0) / raw.length;
  return raw.map((x) => Math.max(1, Math.round((x / mean) * avgStackBB * 10) / 10));
}

// Zone où la formule RP est réellement validée (r = 0.29 → 2.38 sur les sims solver).
// On génère dans une bande légèrement élargie, mais jamais au-delà : entraîner un élève sur
// r = 8 lui apprendrait un RP que le framework n'a jamais mesuré (extrapolation log non testée).
export const R_MIN_TRAINABLE = 0.15;
export const R_MAX_TRAINABLE = 2.5;

// `forcedFieldLeft` : impose le stade de tournoi. Indispensable quand l'appelant sait à quel
// stade il veut la question — sinon le N_KO et l'échantillonnage par rejet sont calculés pour
// un autre stade que celui affiché, et le spot devient incohérent.
// `structureId` : idem pour la structure. Elle entre dans α donc dans r, et doit donc être
// connue AVANT le rejet — l'appliquer après coup ferait sortir des spots de la zone validée.
// `startingStack` : stack de départ du tournoi, en jetons. Sert à en déduire un vrai niveau de
// blinds (100 000 sur le HIGHROLLER, 20 000 sur les autres).
export function generateFrameworkSpot(forcedFieldLeft = null, structureId = DEFAULT_STRUCTURE_ID, startingStack = 20000) {
  // Rejet des tirages qui sortent de la zone validée. Convergence rapide en pratique ;
  // le compteur borne le pire cas plutôt que de risquer une boucle infinie.
  for (let attempt = 0; attempt < 60; attempt++) {
    const spot = drawRawSpot(forcedFieldLeft, structureId, startingStack);
    const r = solveFrameworkSpot(spot).r;
    if (r >= R_MIN_TRAINABLE && r <= R_MAX_TRAINABLE) return spot;
  }
  return drawRawSpot(forcedFieldLeft, structureId, startingStack);
}

function drawRawSpot(forcedFieldLeft = null, structureId = DEFAULT_STRUCTURE_ID, startingStack = 20000) {
  const fieldLeft = forcedFieldLeft ?? Math.round(rand(FL_MIN, FL_MAX) * 100) / 100;

  // On tire un average plausible, on en déduit le palier de blinds correspondant, puis on
  // REPART de la blinde : elle est ce que l'élève lit à la table, donc c'est elle qui doit être
  // ronde et exacte, pas l'average.
  const bigBlind = snapBigBlind(startingStack / (drawAvgStackBB(fieldLeft) * fieldLeft));
  const startingStackBB = startingStack / bigBlind;
  const avgStackBB = Math.round((startingStackBB / fieldLeft) * 10) / 10;

  // La dispersion des stacks s'ouvre au fil du tournoi : au niveau 1 tout le monde a le stack de
  // départ, en fin de tournoi l'écart entre chip leader et short est énorme. Une dispersion fixe
  // donnait des vilains à 0.2× la moyenne dès 100% de field restant, ce qui n'existe pas.
  const spread = 0.15 + (1 - fieldLeft) * 0.95;
  const stacks = drawSeatStacks(POSITIONS.length, avgStackBB, spread);

  // Configuration de table : un jammeur, un décideur (pas de multiway, cf. brief).
  const villainIdx = Math.floor(Math.random() * 4); // le jammeur ouvre depuis UTG..BTN
  const heroIdx = villainIdx + 1 + Math.floor(Math.random() * (POSITIONS.length - villainIdx - 1));
  const heroCloses = heroIdx === POSITIONS.length - 1; // dernier à parler = clôture l'action

  // La couverture se LIT sur la table au lieu d'être tirée au sort : hero couvre s'il a plus de
  // jetons que chacun des joueurs encore à parler derrière lui. C'est la définition, et ça rend
  // la table informative plutôt que décorative.
  const behind = stacks.slice(heroIdx + 1);
  const coversEveryoneBehind = !heroCloses && behind.every((s) => stacks[heroIdx] > s);

  const nKOs = stacks.map(() => drawNKO(fieldLeft));
  const spotFamily = Math.random() < 0.65 ? "allin" : "vsOR";

  const seats = POSITIONS.map((label, i) => ({
    label,
    stackBB: stacks[i],
    nKO: nKOs[i],
    isHero: i === heroIdx,
    isVillain: i === villainIdx,
    // « fold » avant le jammeur, « à parler » après hero : c'est ce découpage qui dit à l'élève
    // s'il est en régime 1 (il clôture) ou en régime 2 (il reste du monde derrière).
    state: i < villainIdx ? "folded" : i === villainIdx ? "jam" : i === heroIdx ? "hero" : i < heroIdx ? "folded" : "toAct",
  }));

  return {
    fieldLeft, avgStackBB, startingStackBB, startingStack, structureId,
    ...blindLevel(bigBlind),
    seats,
    villainPos: POSITIONS[villainIdx], heroPos: POSITIONS[heroIdx],
    villainStackBB: stacks[villainIdx], heroStackBB: stacks[heroIdx], nKO: nKOs[villainIdx],
    heroCloses, coversEveryoneBehind, spotFamily,
    k: spotFamily === "allin" ? 4.6 : 2.7,
  };
}

// --- Les 5 types de questions ---------------------------------------------------------------

export const QUESTION_TYPES = ["ko_value", "ratio", "rp", "regime", "dilatation"];

export const RP_TOLERANCE_EXACT = 2;  // ±2 pts = exact
export const RP_TOLERANCE_CLOSE = 4;  // ±4 pts = proche

export const QUESTION_META = {
  ko_value: {
    label: "Valeur du KO",
    unit: "BB",
    prompt: (s) =>
      `${(s.fieldLeft * 100).toFixed(0)}% de field restant, average de table ${s.avgStackBB} BB. Le vilain porte ${s.nKO} KO de base. Combien vaut son KO, en BB ?`,
    answer: (r) => r.koBB,
    isCorrect: (guess, a) => Math.abs(guess - a) / a <= 0.10,
    closeEnough: (guess, a) => Math.abs(guess - a) / a <= 0.20,
  },
  ratio: {
    label: "Ratio r (KO / stack vilain)",
    unit: "%",
    prompt: (s) =>
      `${(s.fieldLeft * 100).toFixed(0)}% de field restant, average ${s.avgStackBB} BB, vilain à ${s.villainStackBB} BB avec ${s.nKO} KO. Quel est le ratio r = valeur du KO / son stack, en % ?`,
    answer: (r) => r.r * 100,
    isCorrect: (guess, a) => Math.abs(guess - a) <= 10,
    closeEnough: (guess, a) => Math.abs(guess - a) <= 20,
  },
  rp: {
    label: "Risk Premium",
    unit: "%",
    prompt: (s) =>
      `${(s.fieldLeft * 100).toFixed(0)}% de field restant, average ${s.avgStackBB} BB. Le vilain (${s.villainPos}) a ${s.villainStackBB} BB et ${s.nKO} KO. Tu es ${s.heroPos}${s.coversEveryoneBehind ? " et tu couvres tout le monde derrière toi" : ""}. Quel est le RP de ce spot ?`,
    answer: (r) => r.rp,
    isCorrect: (guess, a) => Math.abs(guess - a) <= RP_TOLERANCE_EXACT,
    closeEnough: (guess, a) => Math.abs(guess - a) <= RP_TOLERANCE_CLOSE,
  },
  dilatation: {
    label: "Multiplicateur de range",
    unit: "×",
    prompt: (s) =>
      `${(s.fieldLeft * 100).toFixed(0)}% de field restant, average ${s.avgStackBB} BB, vilain ${s.villainStackBB} BB avec ${s.nKO} KO — spot ${s.spotFamily === "allin" ? "all-in (k=4.6)" : "vs open raise (k=2.7)"}${s.coversEveryoneBehind ? ", tu couvres tout le monde derrière" : ""}. Par combien multiplies-tu ta range chipEV ?`,
    answer: (r) => r.M,
    isCorrect: (guess, a) => Math.abs(guess - a) / a <= 0.20,
    closeEnough: (guess, a) => Math.abs(guess - a) / a <= 0.35,
  },
};

// Q4 « régime » est un QCM, pas une réponse numérique — traité à part.
export const REGIME_CHOICES = [
  { value: "regime1", label: "Régime 1 — je clôture, seuil direct (pas de RP)" },
  { value: "regime2", label: "Régime 2 — des joueurs derrière, chaîne r → RP → M" },
];

export function regimeAnswer(spot) {
  return spot.heroCloses ? "regime1" : "regime2";
}

export function regimePrompt(spot) {
  return spot.heroCloses
    ? `Le vilain (${spot.villainPos}) jam ${spot.villainStackBB} BB. Tu es en BB, tout le monde a fold : tu es le dernier à parler. Quel régime de calcul ?`
    : `Le vilain (${spot.villainPos}) jam ${spot.villainStackBB} BB. Tu es ${spot.heroPos}, il reste des joueurs à parler derrière toi. Quel régime de calcul ?`;
}

export function regimeExplanation(spot) {
  return spot.heroCloses
    ? "Tu clôtures l'action : personne ne peut plus t'isoler ni voler le KO. Le calcul se fait en pot odds directes — à payer / (pot final + valeur du KO). Pas de RP, et le malus « couvert » n'existe pas dans ce régime."
    : "Des joueurs peuvent encore entrer dans le pot : le vrai coût n'est pas ton stack, c'est le risque d'isolation. On passe par la chaîne r → RP → multiplicateur, avec −5 points de RP si tu couvres tout le monde derrière.";
}

export { ELASTICITY_LEVELS };
