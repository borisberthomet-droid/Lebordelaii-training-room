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

export const ACTIVATION_MESSAGES = {
  cle_inconnue: "Cette clé n'existe pas. Vérifie-la avec Boris.",
  cle_utilisee: "Cette clé a déjà servi. Si c'est la tienne, connecte-toi avec ton email.",
  cle_revoquee: "Cette clé a été désactivée. Contacte Boris.",
  pseudo_pris: "Ce pseudo est déjà pris, choisis-en un autre.",
  non_connecte: "Connecte-toi d'abord.",
};

// Chemin de retour après connexion : uniquement un chemin interne, jamais une autre origine
// (« //site.com » ou « https:// » ouvriraient une redirection vers l'extérieur).
export function safeNext(next) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
