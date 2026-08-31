import { createClient } from "./client";

function fromRow(row) {
  return {
    id: row.id,
    category: row.category,
    label: row.label,
    referenceWeights: row.reference_weights || {},
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

export async function listRangeSpots() {
  const supabase = createClient();
  const { data, error } = await supabase.from("range_spots").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(fromRow);
}

// Catégories déjà utilisées, pour peupler le datalist du formulaire de création — texte libre,
// pas de table séparée (voir commentaire dans supabase/schema.sql).
export async function listRangeCategories() {
  const supabase = createClient();
  const { data, error } = await supabase.from("range_spots").select("category");
  if (error) throw error;
  return [...new Set(data.map((r) => r.category))].sort();
}

export async function createRangeSpot({ category, label, referenceWeights }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("range_spots")
    .insert({ category, label, reference_weights: referenceWeights, created_by: user.id })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateRangeSpot(id, { category, label, referenceWeights }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("range_spots")
    .update({ category, label, reference_weights: referenceWeights })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteRangeSpot(id) {
  const supabase = createClient();
  const { error } = await supabase.from("range_spots").delete().eq("id", id);
  if (error) throw error;
}

export async function insertRangeAttempt({ spotId, studentWeights, accuracy }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("range_attempts").insert({
    spot_id: spotId,
    user_id: user.id,
    student_weights: studentWeights,
    accuracy,
  });
  if (error) throw error;
}

// Classement d'un spot précis : seule la dernière tentative de chaque élève compte (une nouvelle
// tentative remplace l'ancienne), trié par score — même convention que getSpotLeaderboard (spots.js).
export async function getRangeSpotLeaderboard(spotId) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("range_attempts")
    .select("user_id, accuracy, created_at, profiles(pseudo)")
    .eq("spot_id", spotId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const latestByUser = new Map();
  for (const row of data) {
    if (!latestByUser.has(row.user_id)) latestByUser.set(row.user_id, row);
  }
  return [...latestByUser.values()]
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 10)
    .map((row) => ({ pseudo: row.profiles?.pseudo || "?", accuracy: row.accuracy }));
}

// Classement général : précision moyenne sur toutes les tentatives, minimum de tentatives
// filtré côté requête pour être significatif (même convention que getPotOddsRanking).
export async function getRangeBuilderRanking(minAttempts = 5) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("range_builder_stats")
    .select("pseudo, total_attempts, avg_accuracy")
    .gte("total_attempts", minAttempts)
    .order("avg_accuracy", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getMyRangeAttempts(spotId) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("range_attempts")
    .select("*")
    .eq("user_id", user.id)
    .eq("spot_id", spotId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
