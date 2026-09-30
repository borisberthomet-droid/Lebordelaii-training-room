// Informations légales du site, rassemblées ici et nulle part ailleurs.
//
// Les trois pages (mentions légales, confidentialité, CGV) lisent ce fichier : une adresse ou un
// SIRET ne doit pas se trouver recopié à trois endroits, sinon il finit par être faux à deux.
//
// TOUT CE QUI EST MARQUÉ « À COMPLÉTER » doit être renseigné avant de publier. Tant qu'une valeur
// manque, les pages l'affichent en évidence plutôt que d'inventer : une mention légale fausse vaut
// moins qu'une mention légale absente.

const MANQUE = (quoi) => `[À COMPLÉTER : ${quoi}]`;

export const EDITEUR = {
  nom: "Boris Berthomet",
  marque: "Lebordelaii Training Room",
  statut: MANQUE("statut juridique — entrepreneur individuel, EURL, SASU…"),
  siret: MANQUE("numéro SIRET"),
  adresse: MANQUE("adresse du siège ou de l'activité"),
  email: "borisberthomet@gmail.com",
  telephone: null,                       // facultatif : la loi n'impose pas le téléphone
  tva: MANQUE("numéro de TVA, ou « franchise en base de TVA — TVA non applicable, art. 293 B du CGI »"),
  directeurPublication: "Boris Berthomet",
};

// Ce que le site utilise pour fonctionner. Ces informations-là, je les connais : ce sont les
// services que nous avons mis en place.
export const HEBERGEURS = [
  {
    role: "Hébergement du site",
    nom: "Vercel Inc.",
    adresse: "340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis",
    site: "vercel.com",
    note: "Les pages sont servies depuis les serveurs européens de Vercel, mais la société est américaine.",
  },
  {
    role: "Base de données, comptes et fichiers",
    nom: "Supabase Inc.",
    adresse: "970 Toa Payoh North, Singapour",
    site: "supabase.com",
    note: "Les données du site sont stockées dans l'Union européenne (Irlande, région eu-west-1).",
  },
];

// Les prix affichés sur le site de coaching. À vérifier avant publication : c'est le genre de
// chiffre qui change sans que personne ne pense aux CGV.
export const PRESTATIONS = [
  { nom: "Coaching individuel", prix: "125 €", unite: "la séance d'une heure" },
  { nom: "Coaching duo", prix: "200 €", unite: "la séance d'une heure" },
  { nom: "Analyse de jeu — Leakfinder", prix: "500 €", unite: "la formule complète" },
  { nom: "Pack d'heures", prix: MANQUE("tarif des packs"), unite: "validité indiquée à l'achat" },
];

export const MEDIATEUR = {
  nom: MANQUE("médiateur de la consommation — obligatoire pour vendre à des particuliers en France"),
  site: null,
};

export const MISE_A_JOUR = "30 septembre 2026";

// Vrai quand une valeur n'a pas encore été renseignée : les pages s'en servent pour signaler ce
// qui reste à faire, au lieu de publier un texte à trous sans le dire.
export const aCompleter = (valeur) => typeof valeur === "string" && valeur.startsWith("[À COMPLÉTER");
