// Prestations vendues : leur nature, leurs étapes, et où en est chacune.
//
// Ce module ne parle à personne — ni base, ni écran. Il répond à des questions sur un objet
// `prestation` tel que la base le rend. C'est ce qui permet de le tester en entier, et c'est
// aussi pourquoi les libellés d'étapes sont ici : reformuler « restitution » ne doit pas
// demander une migration.
//
// L'avancement est une suite de JALONS DATÉS — { "1": "2026-10-02", "2": "2026-10-05" } — et non
// un numéro d'étape. L'étape courante se déduit du nombre de jalons, donc elle ne peut jamais
// contredire les dates affichées.

export const TYPES = {
  leakfinder: {
    label: "Leakfinder",
    etapes: [
      { titre: "Commande", detail: "Leakfinder réservé, accès à la training room ouvert" },
      { titre: "Analyse des données", detail: "Dépouillement des mains et des statistiques" },
      { titre: "Restitution", detail: "Débrief et priorisation des axes de travail" },
      { titre: "Planification", detail: "Périodisation et exercices d'entraînement" },
    ],
  },
  coaching: {
    label: "Coaching individuel",
    etapes: [
      { titre: "Réservé", detail: "Séance calée" },
      { titre: "Séance faite", detail: "Le coaching a eu lieu" },
      { titre: "Synthèse", detail: "Compte rendu envoyé" },
    ],
  },
  duo: {
    label: "Coaching duo",
    etapes: [
      { titre: "Réservé", detail: "Séance calée" },
      { titre: "Séance faite", detail: "Le coaching a eu lieu" },
      { titre: "Synthèse", detail: "Compte rendu envoyé" },
    ],
  },
  seminaire: {
    label: "Séminaire",
    etapes: [
      { titre: "Inscription", detail: "Place réservée" },
      { titre: "Préparation", detail: "Programme et logistique transmis" },
      { titre: "Séminaire", detail: "Le séminaire a eu lieu" },
      { titre: "Suivi", detail: "Plan de travail après le séminaire" },
    ],
  },
  autre: {
    label: "Autre",
    etapes: [
      { titre: "Commandé", detail: "" },
      { titre: "En cours", detail: "" },
      { titre: "Terminé", detail: "" },
    ],
  },
};

export const PAIEMENTS = {
  attendu: { label: "En attente", couleur: "var(--attention)" },
  recu: { label: "Reçu", couleur: "var(--accent)" },
  offert: { label: "Offert", couleur: "var(--info)" },
};

export const STATUTS = {
  en_cours: { label: "En cours", couleur: "var(--info)" },
  terminee: { label: "Terminée", couleur: "var(--accent)" },
  annulee: { label: "Annulée", couleur: "var(--text-muted)" },
};

export function etapesDe(prestation) {
  return (TYPES[prestation?.type] || TYPES.autre).etapes;
}

export function libelleType(prestation) {
  if (prestation?.type === "autre" && prestation.libelle) return prestation.libelle;
  const base = (TYPES[prestation?.type] || TYPES.autre).label;
  return prestation?.libelle ? `${base} — ${prestation.libelle}` : base;
}

// Les clés de `jalons` sont des numéros d'étape en texte (le jsonb ne connaît pas les entiers en
// clé). On les trie numériquement : "10" vient après "9", ce que l'ordre alphabétique ignore.
function numerosFranchis(jalons) {
  return Object.keys(jalons || {})
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 1)
    .sort((a, b) => a - b);
}

// Nombre d'étapes franchies. On prend le PLUS GRAND numéro, pas le nombre de clés : si un jalon
// intermédiaire venait à manquer, l'étape 3 reste l'étape 3 — le suivi ne doit pas reculer parce
// qu'une date s'est perdue.
export function etapesFranchies(prestation) {
  const nums = numerosFranchis(prestation?.jalons);
  return nums.length ? nums[nums.length - 1] : 0;
}

export function dateEtape(prestation, numero) {
  return (prestation?.jalons || {})[String(numero)] || null;
}

export function estTerminee(prestation) {
  if (prestation?.statut === "terminee") return true;
  return etapesFranchies(prestation) >= etapesDe(prestation).length;
}

// 0 quand rien n'est commencé, 1 quand tout est franchi. Sert à la barre de progression.
export function progression(prestation) {
  const total = etapesDe(prestation).length;
  if (!total) return 0;
  return Math.min(1, etapesFranchies(prestation) / total);
}

export function prochaineEtape(prestation) {
  const franchies = etapesFranchies(prestation);
  const etapes = etapesDe(prestation);
  return franchies >= etapes.length ? null : { numero: franchies + 1, ...etapes[franchies] };
}

// Franchir l'étape suivante. Renvoie un NOUVEL objet jalons : l'appelant décide quoi en faire,
// et rien n'est modifié sur place.
export function avancer(prestation, jour = new Date()) {
  const suivante = prochaineEtape(prestation);
  if (!suivante) return prestation?.jalons || {};
  return { ...(prestation?.jalons || {}), [String(suivante.numero)]: iso(jour) };
}

// Retirer le dernier jalon, pour corriger un clic de trop.
export function reculer(prestation) {
  const jalons = { ...(prestation?.jalons || {}) };
  const dernier = etapesFranchies(prestation);
  if (dernier >= 1) delete jalons[String(dernier)];
  return jalons;
}

function iso(jour) {
  const d = jour instanceof Date ? jour : new Date(jour);
  return d.toISOString().slice(0, 10);
}

// Ce qui reste à encaisser sur un ensemble de prestations. « Offert » ne compte pas comme une
// perte : c'est une décision, pas un impayé.
export function resteAEncaisser(prestations = []) {
  return prestations
    .filter((p) => p.statut !== "annulee" && p.paiement === "attendu")
    .reduce((somme, p) => somme + (Number(p.montant) || 0), 0);
}

export function encaisse(prestations = []) {
  return prestations
    .filter((p) => p.paiement === "recu")
    .reduce((somme, p) => somme + (Number(p.montant) || 0), 0);
}
