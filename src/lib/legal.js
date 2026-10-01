// Informations légales du site, rassemblées ici et nulle part ailleurs.
//
// Les trois pages (mentions légales, confidentialité, CGV) lisent ce fichier : une adresse ou un
// SIRET ne doit pas se trouver recopié à trois endroits, sinon il finit par être faux à deux.
//
// TOUT CE QUI EST MARQUÉ « À COMPLÉTER » doit être renseigné avant de publier. Tant qu'une valeur
// manque, les pages l'affichent en évidence plutôt que d'inventer : une mention légale fausse vaut
// moins qu'une mention légale absente.

// Exporté pour rester à portée de main : toute valeur légale encore inconnue passe par ici
// plutôt que par une approximation.
export const MANQUE = (quoi) => `[À COMPLÉTER : ${quoi}]`;

export const EDITEUR = {
  nom: "Boris Berthomet",
  marque: "Lebordelaii Training Room",
  statut: "EIRL Boris Berthomet, entreprise individuelle à responsabilité limitée, exerçant sous le nom commercial « Le Bordelaii »",
  siret: "834 870 925 00015",
  ape: "9329Z",
  adresse: "40 B allée des Douves, 33470 Gujan-Mestras",
  email: "contact@lebordelaii.fr",
  telephone: "06 15 65 05 13",
  tva: "TVA non applicable, article 293 B du CGI.",
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
];

// Médiateur de la consommation, d'après l'attestation d'affiliation du 1er octobre 2026.
// Les articles L.616-1 et R.616-1 du Code de la consommation imposent de faire figurer le nom,
// l'adresse postale et l'adresse du site du médiateur sur le site, dans les CGV et sur les
// factures : ces trois informations doivent donc rester exactes, pas seulement présentes.
export const MEDIATEUR = {
  nom: "CM2C — Centre de la Médiation de la Consommation de Conciliateurs de justice",
  forme: "association loi 1901 agréée par la CECMC",
  adresse: "49 rue de Ponthieu, 75008 Paris",
  site: "www.cm2c.net",
  siteUrl: "https://www.cm2c.net",
  telephone: "01 89 47 00 14",
  // L'adhésion est conclue pour trois ans. À renouveler avant cette date, sinon la mention
  // devient fausse et l'obligation n'est plus remplie.
  adhesionJusquau: "1er octobre 2029",
};

export const MISE_A_JOUR = "1er octobre 2026";

// Vrai quand une valeur n'a pas encore été renseignée : les pages s'en servent pour signaler ce
// qui reste à faire, au lieu de publier un texte à trous sans le dire.
export const aCompleter = (valeur) => typeof valeur === "string" && valeur.startsWith("[À COMPLÉTER");
