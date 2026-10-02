import { createClient } from "./client";

// Classement du Find It sur simulation. Les tentatives sont déjà enregistrées par
// recordSkillAttempt (exercise « find-it », meta.source « solveur ») : rien de nouveau n'est
// écrit ici, on ne fait que lire la vue find_it_sim_stats (supabase/find-it-sim-classement.sql).

// Un minimum de mains pour apparaître, même convention que les autres classements : sans lui, un
// joueur avec une seule main réussie trône au-dessus de tout le monde et le tableau ne veut plus
// rien dire.
export const MINIMUM_MAINS = 10;

export async function getSimRanking(minMains = MINIMUM_MAINS) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("find_it_sim_stats")
    .select("user_id, pseudo, total_mains, points, moyenne, meilleur")
    .gte("total_mains", minMains)
    .order("points", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Les chiffres de l'élève connecté, qu'il ait atteint le minimum ou non : il doit pouvoir voir
// où il en est avant d'être classé, sinon le seuil ressemble à une porte fermée.
export async function getMesStatsSim() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("find_it_sim_stats")
    .select("total_mains, points, moyenne, meilleur")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data || { total_mains: 0, points: 0, moyenne: 0, meilleur: 0 };
}
