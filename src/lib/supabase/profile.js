import { createClient } from "./client";

// Profil : le pseudo vit dans `profiles` (public, il apparaît dans les classements), tout le
// reste dans `profile_private` (lisible par son seul propriétaire, et par le coach).
// L'email n'est stocké nulle part : il vient de auth.users.

export async function getMyAccount() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profil }, { data: prive }] = await Promise.all([
    supabase.from("profiles").select("id, pseudo, role, created_at").eq("id", user.id).maybeSingle(),
    supabase.from("profile_private").select("*").eq("id", user.id).maybeSingle(),
  ]);

  return {
    id: user.id,
    email: user.email,
    pseudo: profil?.pseudo || "",
    role: profil?.role || "student",
    memberSince: profil?.created_at || null,
    prive: prive || {},
  };
}

// Le pseudo est unique en base : une collision remonte en 23505, qu'on traduit plutôt que de
// laisser passer un message Postgres brut.
export async function updatePseudo(pseudo) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Session expirée.");
  const { error } = await supabase.from("profiles").update({ pseudo }).eq("id", user.id);
  if (error) {
    if (error.code === "23505") throw new Error("Ce pseudo est déjà pris.");
    throw error;
  }
}

const CHAMPS_PRIVES = ["discord", "telephone", "adresse", "rooms", "abi", "formats", "objectif", "dispos"];

export async function saveMyPrivate(values) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Session expirée.");

  const payload = { id: user.id, updated_at: new Date().toISOString() };
  for (const k of CHAMPS_PRIVES) payload[k] = values[k]?.trim() || null;

  // upsert : la ligne n'existe pas tant que l'élève n'a rien renseigné.
  const { error } = await supabase.from("profile_private").upsert(payload);
  if (error) throw error;
}

export { CHAMPS_PRIVES };
