// Séries et cumuls des routines. Calculs purs, sans React ni base : ils se vérifient hors
// navigateur, et c'est ici que se joue la seule subtilité du sujet.
//
// La subtilité, justement : une routine n'est pas forcément quotidienne. « Review tous les lundis
// et jeudis » ne doit pas voir sa série cassée par un mardi. Un jour ne compte donc dans la série
// que s'il était PRÉVU — et si la routine ne précise aucun jour, tous les jours comptent.

import { decalerJours, numeroJour } from "./semaine.js";   // extension explicite : Node la réclame quand ce calcul est vérifié hors navigateur

export const estPrevu = (routine, jour) =>
  !routine.jours?.length || routine.jours.includes(numeroJour(jour));

// Index { "YYYY-MM-DD": ligne } des entrées d'une routine.
export function parJour(entrees) {
  return Object.fromEntries(entrees.map((e) => [e.jour, e]));
}

// Série en cours : jours prévus consécutifs faits, en remontant depuis aujourd'hui.
//
// Le jour même ne casse pas la série s'il n'est pas encore fait — il n'est pas fini. C'est ce qui
// évite d'afficher « série : 0 » à un joueur tous les matins au réveil.
export function serie(routine, entrees, aujourdhui) {
  const index = parJour(entrees);
  let jour = aujourdhui;
  let compte = 0;
  if (estPrevu(routine, jour) && !index[jour]?.fait) jour = decalerJours(jour, -1);
  // 400 jours de recul : au-delà, l'information n'intéresse plus personne.
  for (let i = 0; i < 400; i++) {
    if (estPrevu(routine, jour)) {
      if (!index[jour]?.fait) break;
      compte++;
    }
    jour = decalerJours(jour, -1);
  }
  return compte;
}

// Record : la plus longue série jamais tenue, sur tout l'historique connu.
export function record(routine, entrees, aujourdhui) {
  const faits = entrees.filter((e) => e.fait && e.jour).map((e) => e.jour).sort();
  if (!faits.length) return 0;
  const index = parJour(entrees);
  let meilleur = 0, courant = 0;
  let jour = faits[0];
  const fin = aujourdhui > faits[faits.length - 1] ? aujourdhui : faits[faits.length - 1];
  while (jour <= fin) {
    if (estPrevu(routine, jour)) {
      if (index[jour]?.fait) { courant++; if (courant > meilleur) meilleur = courant; }
      else courant = 0;
    }
    jour = decalerJours(jour, 1);
  }
  return meilleur;
}

// --- Cumuls ---------------------------------------------------------------------------------

const debutMois = (iso) => `${iso.slice(0, 7)}-01`;
const debutAnnee = (iso) => `${iso.slice(0, 4)}-01-01`;
function debutTrimestre(iso) {
  const mois = Number(iso.slice(5, 7));
  const premier = Math.floor((mois - 1) / 3) * 3 + 1;
  return `${iso.slice(0, 4)}-${String(premier).padStart(2, "0")}-01`;
}

export const PERIODES = [
  { id: "mois", label: "Ce mois-ci", depuis: debutMois },
  { id: "trimestre", label: "Ce trimestre", depuis: debutTrimestre },
  { id: "annee", label: "Cette année", depuis: debutAnnee },
];

// Bilan d'une routine sur une période : jours faits et total de ce qui a été compté.
//
// `total` ne vaut que ce que le joueur a saisi. Une routine faite sans quantité renseignée compte
// dans les jours mais pas dans le total — c'est plus honnête que de supposer « 1 ».
export function bilan(entrees, depuis, jusqua) {
  const dedans = entrees.filter((e) => e.jour >= depuis && e.jour <= jusqua && e.fait);
  return {
    jours: dedans.length,
    total: dedans.reduce((s, e) => s + (Number(e.quantite) || 0), 0),
    chiffres: dedans.filter((e) => e.quantite != null).length,
  };
}

export function bilans(entrees, aujourdhui) {
  return Object.fromEntries(
    PERIODES.map((p) => [p.id, bilan(entrees, p.depuis(aujourdhui), aujourdhui)])
  );
}
