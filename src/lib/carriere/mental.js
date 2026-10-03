// Évaluation mentale : les axes, le rythme, et les calculs de tendance.
//
// Ce module ne parle ni à la base ni à l'écran — il répond à des questions sur une liste de
// check-ins tels que la base les rend, ce qui le rend testable en entier.
//
// Les axes sont ici et non en base : le coach mental de Boris en demande trois aujourd'hui, un
// quatrième ne doit pas demander une migration. Changer un libellé non plus.

export const AXES = [
  {
    id: "confiance",
    label: "Confiance",
    aide: "Est-ce que j'arrive à la table en me sentant à ma place, capable de jouer mon jeu ?",
    couleur: "#5F6127",
  },
  {
    id: "relachement",
    label: "Relâchement",
    aide: "Est-ce que je joue sans crispation, capable d'encaisser un bad beat sans que ça déborde ?",
    couleur: "#4E3E66",
  },
  {
    id: "connaissance",
    label: "Connaissance de soi",
    aide: "Est-ce que je repère mes états — fatigue, tilt, euphorie — assez tôt pour en tenir compte ?",
    couleur: "#A0552A",
  },
];

// Bimensuel : deux fois par mois, donc tous les quinze jours. Le rythme est ici pour qu'il se
// change en un endroit si le coach mental en demande un autre.
export const CADENCE_JOURS = 15;

// Au-delà, l'évaluation n'est plus en retard : elle est oubliée. L'écran le dit autrement.
export const SEUIL_OUBLI_JOURS = 45;

const JOUR = 86400000;

function jour(valeur) {
  const d = valeur instanceof Date ? valeur : new Date(String(valeur) + "T12:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

export function iso(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
}

// Les check-ins arrivent triés du plus récent au plus ancien (ordre de la requête). On ne se
// repose pas dessus : une fonction de calcul qui dépend de l'ordre d'une requête casse le jour
// où quelqu'un change le `order by`.
export function parDate(checkins = []) {
  return [...checkins].sort((a, b) => String(a.fait_le).localeCompare(String(b.fait_le)));
}

export function dernier(checkins = []) {
  const triés = parDate(checkins);
  return triés.length ? triés[triés.length - 1] : null;
}

export function prochaineEcheance(checkins = [], cadence = CADENCE_JOURS) {
  const d = dernier(checkins);
  if (!d) return null;
  const date = jour(d.fait_le);
  if (!date) return null;
  return new Date(date.getTime() + cadence * JOUR);
}

// Nombre de jours de retard : 0 ou moins quand c'est à jour, null quand rien n'a jamais été noté.
export function retardJours(checkins = [], maintenant = new Date(), cadence = CADENCE_JOURS) {
  const echeance = prochaineEcheance(checkins, cadence);
  if (!echeance) return null;
  return Math.floor((maintenant - echeance) / JOUR);
}

export function note(checkin, axeId) {
  const v = checkin?.scores?.[axeId];
  return Number.isFinite(v) ? v : null;
}

// Moyenne des axes renseignés. Un axe laissé vide ne compte pas comme un zéro : il manque.
export function moyenne(checkin) {
  const valeurs = AXES.map((a) => note(checkin, a.id)).filter((v) => v != null);
  if (!valeurs.length) return null;
  return Math.round(valeurs.reduce((s, v) => s + v, 0) / valeurs.length);
}

// Suite chronologique d'un axe, pour tracer une courbe.
export function serie(checkins = [], axeId) {
  return parDate(checkins)
    .map((c) => ({ date: c.fait_le, valeur: note(c, axeId) }))
    .filter((p) => p.valeur != null);
}

// Écart avec la mesure précédente. null quand il n'y a pas de quoi comparer : afficher « +0 »
// après une seule évaluation ferait croire à une stabilité qui n'a pas été mesurée.
export function variation(checkins = [], axeId) {
  const points = serie(checkins, axeId);
  if (points.length < 2) return null;
  return points[points.length - 1].valeur - points[points.length - 2].valeur;
}

// Coordonnées d'une courbe dans une boîte donnée, axe des notes figé sur 0–100.
//
// L'échelle est fixe et non ajustée aux valeurs : une courbe qui se recadre toute seule fait
// passer un progrès de deux points pour une envolée, ce qui est exactement ce qu'une mesure de
// confiance en soi ne doit pas raconter.
export function courbe(points, largeur, hauteur, marge = 4) {
  if (!points.length) return [];
  const utile = { x: largeur - marge * 2, y: hauteur - marge * 2 };
  const pas = points.length > 1 ? utile.x / (points.length - 1) : 0;
  return points.map((p, i) => ({
    x: marge + (points.length > 1 ? i * pas : utile.x / 2),
    y: marge + utile.y * (1 - p.valeur / 100),
    ...p,
  }));
}
