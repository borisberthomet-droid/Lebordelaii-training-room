// Clés d'activation : format, génération et messages. La vérification, elle, vit dans la base
// (supabase/schema.sql, bloc « Acces par cle d'activation ») — ici rien n'est une garantie.

// Alphabet sans caractères ambigus (ni I/1, ni O/0) : une clé se recopie depuis Discord sans
// erreur. 32 symboles, donc un octet aléatoire se ramène à un symbole sans biais (256 = 8 × 32).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// LBT-XXXX-XXXX-XXXX : 12 symboles, 60 bits d'aléa. Impossible à deviner par essais.
export function generateAccessCode() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const chars = [...bytes].map((b) => ALPHABET[b % 32]).join("");
  return `LBT-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

// Même normalisation que la base (upper + trim) : une clé collée avec des espaces ou en
// minuscules doit passer.
export function normalizeCode(code) {
  return (code || "").trim().toUpperCase();
}

// ---------------------------------------------------------------------------
// Durée d'accès
//
// Une clé porte une durée vendue (1, 3, 6, 12 mois) ou aucune. Le compte à rebours part de
// l'ACTIVATION, pas de la création : une clé remise à l'avance ne doit pas grignoter ce que
// l'élève a payé. La date d'échéance est posée en base au moment de l'activation ; ici on ne
// fait que la lire, la mettre en forme, et calculer une prolongation.
// ---------------------------------------------------------------------------

export const DUREES = [
  { mois: 1, label: "1 mois" },
  { mois: 3, label: "3 mois" },
  { mois: 6, label: "6 mois" },
  { mois: 12, label: "12 mois" },
  { mois: null, label: "Sans échéance" },
];

// Ajoute des mois en gardant le quantième quand il existe. Date.setMonth() déborde tout seul :
// le 31 janvier + 1 mois lui donne le 3 mars. On ramène au dernier jour du mois visé.
export function ajouterMois(date, mois) {
  const d = new Date(date);
  const jour = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + mois);
  const dernierJour = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(jour, dernierJour));
  return d;
}

// Une prolongation repart de l'échéance en cours si elle est encore devant, sinon d'aujourd'hui.
// Prolonger un accès terminé depuis deux mois doit donner deux mois à venir, pas zéro.
export function prolonger(expireLe, mois, maintenant = new Date()) {
  if (mois == null) return null;
  const base = expireLe && new Date(expireLe) > maintenant ? new Date(expireLe) : maintenant;
  return ajouterMois(base, mois);
}

export function joursRestants(expireLe, maintenant = new Date()) {
  if (!expireLe) return null;
  return Math.ceil((new Date(expireLe) - maintenant) / 86400000);
}

// Quatre états, parce que « terminé » et « retiré » ne se racontent pas pareil : une révocation
// est une décision du coach, une échéance est la fin de ce qui a été vendu.
export function etatCle(k, maintenant = new Date()) {
  if (k.revoked_at) return "revoquee";
  if (!k.used_at) return "libre";
  if (k.expire_le && new Date(k.expire_le) <= maintenant) return "expiree";
  return "active";
}

export function formaterEcheance(expireLe, maintenant = new Date()) {
  if (!expireLe) return "sans échéance";
  const date = new Date(expireLe).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  const jours = joursRestants(expireLe, maintenant);
  if (jours < 0) return `échue le ${date}`;
  if (jours === 0) return `échoit aujourd'hui (${date})`;
  if (jours === 1) return `échoit demain (${date})`;
  return `jusqu'au ${date} (${jours} jours)`;
}

export const ACTIVATION_MESSAGES = {
  cle_inconnue: "Cette clé n'existe pas. Vérifie-la avec Boris.",
  cle_utilisee: "Cette clé a déjà servi. Si c'est la tienne, connecte-toi avec ton email.",
  cle_revoquee: "Cette clé a été désactivée. Contacte Boris.",
  cle_expiree: "Cet accès est arrivé à échéance. Contacte Boris pour le prolonger.",
  pseudo_pris: "Ce pseudo est déjà pris, choisis-en un autre.",
  non_connecte: "Connecte-toi d'abord.",
};

// Chemin de retour après connexion : uniquement un chemin interne, jamais une autre origine
// (« //site.com » ou « https:// » ouvriraient une redirection vers l'extérieur).
export function safeNext(next) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
