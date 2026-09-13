// Notation des compétences pour la fiche joueur.
//
// Le problème à résoudre : les exercices ne se ressemblent pas. L'un demande un quintile parmi
// cinq (le hasard donne déjà 20%), l'autre une équité en pourcentage (le hasard ne donne rien),
// un troisième un Risk Premium dont toutes les bonnes réponses tiennent dans une bande de 10
// points. Comparer des « % de réussite » bruts d'un exercice à l'autre n'a aucun sens.
//
// La règle retenue, la même partout : **un score mesure ce qu'on fait de mieux qu'un joueur qui
// ne sait rien**. 0 = le niveau d'un naïf, 100 = sans erreur. Le niveau du naïf n'est pas
// inventé, il est MESURÉ sur les données réelles de chaque exercice (voir REF_ERROR ci-dessous).

// --- Les axes de la fiche ---------------------------------------------------------------------
export const AXES = [
  { id: "equite", label: "Équité", desc: "Estimer sa force brute face à une range" },
  { id: "frequence", label: "Fréquence", desc: "Savoir à quelle fréquence défendre, miser, bluffer" },
  { id: "calcul", label: "Calcul mental", desc: "Pots, cotes et sizings sans hésiter" },
  { id: "lecture", label: "Lecture de range", desc: "Reconstruire la range de l'adversaire" },
  { id: "pko", label: "PKO", desc: "Risk Premium et valeur des primes" },
  { id: "icm", label: "ICM / TF", desc: "Pression de table finale" },
];

// --- Repères mesurés --------------------------------------------------------------------------
// REF_ERROR = erreur moyenne du MEILLEUR PRÉDICTEUR CONSTANT, c'est-à-dire d'un joueur qui
// répondrait toujours la même chose sans regarder le spot. C'est le vrai niveau zéro.
//
//   équité   26.9 points — mesuré sur 108 129 combos des 4 textures. Répondre « 50% » partout
//                          se trompe de 26.9 points en moyenne (les équités vont de 2% à 93%).
//   RP        4.6 points — mesuré sur 1 575 tirages du RP Trainer, réponse constante = médiane
//                          (−8.1%). Bande beaucoup plus serrée : 2 points d'erreur sur le RP
//                          valent donc bien plus qu'ils ne vaudraient sur une équité.
const REF_ERROR = { equite: 26.9, rp: 4.6 };

// --- Un exercice, son axe, sa façon d'être noté ------------------------------------------------
// `chance` = score qu'obtient le hasard pur. 0.20 pour un choix parmi 5 quintiles (vérifié : les
// cinq tranches pèsent exactement 20% chacune). ~0 quand il faut taper un nombre.
export const SKILLS = {
  "value-equity": { axis: "equite", kind: "estimate", refError: REF_ERROR.equite, chance: 0 },
  "range-position": { axis: "frequence", kind: "choice", chance: 0.20 },
  "math-trainer": { axis: "calcul", kind: "binary", chance: 0 },
  "find-it": { axis: "lecture", kind: "ratio", chance: 0 },
  "range-builder": { axis: "frequence", kind: "ratio", chance: 0 },
  "rp-trainer": { axis: "pko", kind: "estimate", refError: REF_ERROR.rp, chance: 0 },
  // Pot Odds mélange deux compétences : l'axe dépend du type de question, pas de l'exercice.
  "pot-odds:call_equity": { axis: "equite", kind: "binary", chance: 0 },
  "pot-odds:value_bet_equity": { axis: "equite", kind: "binary", chance: 0 },
  "pot-odds:bluff_fold_equity": { axis: "frequence", kind: "binary", chance: 0 },
  "pot-odds:bluff_ratio": { axis: "frequence", kind: "binary", chance: 0 },
};

export function skillFor(exercise, questionType) {
  return SKILLS[`${exercise}:${questionType}`] || SKILLS[exercise] || null;
}

// --- Note d'une tentative ----------------------------------------------------------------------
// Renvoie { score, chance } avec score dans [0,1]. Le score est déjà rapporté au naïf pour les
// estimations ; pour les choix, c'est `chance` qui sera retiré au moment de l'agrégation (sur une
// seule tentative, « mieux que le hasard » n'a pas de sens — il en faut plusieurs).
export function attemptScore(exercise, questionType, outcome) {
  const cfg = skillFor(exercise, questionType);
  if (!cfg) return null;
  const clamp = (x) => Math.max(0, Math.min(1, x));

  if (cfg.kind === "estimate") {
    if (!Number.isFinite(outcome.error)) return null;
    // Aussi bon que le naïf → 0. Deux fois meilleur → 0.5. Sans erreur → 1.
    return { score: clamp(1 - Math.abs(outcome.error) / cfg.refError), chance: 0 };
  }
  if (cfg.kind === "choice" || cfg.kind === "binary") {
    return { score: outcome.correct ? 1 : 0, chance: cfg.chance };
  }
  if (cfg.kind === "ratio") {
    if (!Number.isFinite(outcome.ratio)) return null;
    return { score: clamp(outcome.ratio), chance: cfg.chance };
  }
  return null;
}

// --- Agrégation ---------------------------------------------------------------------------------
// Demi-vie : une tentative d'il y a un mois compte moitié moins qu'une d'aujourd'hui. Sans ça un
// élève traîne ses débuts pendant des mois et ne voit jamais ses progrès.
export const HALF_LIFE_DAYS = 30;
// Poids effectif à partir duquel on considère l'axe réellement mesuré. 8 tentatives récentes
// donnent 50% de confiance, 24 en donnent 75%.
export const CONFIDENCE_K = 8;
// En dessous, on n'affiche pas de note : deux réussites de suite ne font pas une compétence.
export const MIN_WEIGHT = 3;

export function aggregate(attempts, now = Date.now()) {
  let w = 0, sw = 0, cw = 0;
  for (const a of attempts) {
    const ageDays = Math.max(0, (now - new Date(a.created_at).getTime()) / 86400000);
    const weight = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
    w += weight;
    sw += weight * a.score;
    cw += weight * (a.chance || 0);
  }
  if (w <= 0) return { score: null, confidence: 0, weight: 0, n: attempts.length, measured: false };

  const raw = sw / w;
  const chance = cw / w;
  // Retrait du hasard : répondre au hasard à un QCM à 5 doit donner 0, pas 20.
  const skill = chance >= 1 ? raw : Math.max(0, (raw - chance) / (1 - chance));
  return {
    score: Math.round(skill * 100),
    confidence: w / (w + CONFIDENCE_K),
    weight: w,
    n: attempts.length,
    measured: w >= MIN_WEIGHT,
  };
}

// Progression : niveau des 30 derniers jours contre celui des 30 précédents. `null` tant qu'il
// n'y a pas assez de matière des deux côtés — annoncer une progression sur deux tentatives serait
// du bruit présenté comme un résultat.
export function trend(attempts, now = Date.now()) {
  const day = 86400000;
  const recent = attempts.filter((a) => now - new Date(a.created_at).getTime() <= 30 * day);
  const before = attempts.filter((a) => {
    const age = now - new Date(a.created_at).getTime();
    return age > 30 * day && age <= 60 * day;
  });
  if (recent.length < MIN_WEIGHT || before.length < MIN_WEIGHT) return null;
  const a = aggregate(recent, now), b = aggregate(before, now - 30 * day);
  if (a.score == null || b.score == null) return null;
  return a.score - b.score;
}

// --- Fiche complète -----------------------------------------------------------------------------
// `attempts` : lignes brutes { exercise, question_type, score, chance, created_at }.
export function buildProfile(attempts, now = Date.now()) {
  const byAxis = Object.fromEntries(AXES.map((a) => [a.id, []]));
  for (const a of attempts) {
    const cfg = skillFor(a.exercise, a.question_type);
    if (cfg && byAxis[cfg.axis]) byAxis[cfg.axis].push(a);
  }

  const axes = AXES.map((axis) => {
    const rows = byAxis[axis.id];
    const agg = aggregate(rows, now);
    return { ...axis, ...agg, trend: trend(rows, now) };
  });

  // Score global : moyenne des axes mesurés, PONDÉRÉE PAR LA CONFIANCE. Sans ça, un axe touché
  // deux fois pèserait autant qu'un axe travaillé cent fois.
  let num = 0, den = 0;
  for (const a of axes) if (a.measured && a.score != null) { num += a.score * a.confidence; den += a.confidence; }
  const global = den > 0 ? Math.round(num / den) : null;

  return { axes, global, measuredAxes: axes.filter((a) => a.measured).length, total: attempts.length };
}

// --- Niveau indicatif ----------------------------------------------------------------------------
// Proposition, pas un verdict : le coach garde la main.
export const LEVELS = [
  { min: 0, label: "Débutant" },
  { min: 30, label: "Intermédiaire" },
  { min: 50, label: "Semi-pro" },
  { min: 68, label: "Haut niveau" },
  { min: 82, label: "Pro" },
];

export function levelFor(score) {
  if (score == null) return null;
  return [...LEVELS].reverse().find((l) => score >= l.min)?.label || LEVELS[0].label;
}
