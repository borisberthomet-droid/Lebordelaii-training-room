import { createClient } from "./client";

export async function insertPotOddsAttempt({ questionType, correct }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("pot_odds_attempts").insert({
    user_id: user.id,
    question_type: questionType,
    correct,
  });
  if (error) throw error;
}

// Stats perso (score cumulé +1/-1, précision) — utilisées sur /pot-odds lui-même.
export async function getMyPotOddsStats() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("pot_odds_stats")
    .select("total_questions, total_correct, score, accuracy")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data || { total_questions: 0, total_correct: 0, score: 0, accuracy: 0 };
}

// Classement par précision, minimum de questions répondues pour être qualifié
// (même logique que getGeneralRanking pour Find It — voir lib/supabase/spots.js).
export async function getPotOddsRanking(minQuestions = 10) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pot_odds_stats")
    .select("pseudo, total_questions, total_correct, score, accuracy")
    .gte("total_questions", minQuestions)
    .order("accuracy", { ascending: false });
  if (error) throw error;
  return data;
}
