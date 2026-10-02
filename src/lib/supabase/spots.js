import { createClient } from "./client";

// Traduit entre le modèle Spot du cahier des charges (camelCase) et les colonnes
// snake_case de la table `spots` (voir supabase/schema.sql).
function toRow(spot) {
  return {
    nom: spot.nom,
    mode: spot.mode,
    hero_combo: spot.heroCombo || "",
    villain_combo: spot.villainCombo || "",
    weights: spot.weights || {},
    hero_weights: spot.heroWeights || {},
    timer: spot.timer || 30,
    ko_value: spot.koValue || "",
    ligne: spot.ligne || "",
    explication: spot.explication || "",
    gto_wizard_link: spot.gtoWizardLink || "",
    consigne: spot.consigne || "",
    question: spot.question || "",
    question_answer: spot.questionAnswer || "",
    question_avis: spot.questionAvis || "",
    villain_info: spot.villainInfo || "",
    board: spot.board || "",
    blind_level: spot.blindLevel || "",
    average_bb: spot.averageBB || "",
    nb_inscrits: spot.nbInscrits || "",
    pot_total: spot.potTotal === "" || spot.potTotal == null ? null : Number(spot.potTotal),
    buy_in: spot.buyIn || "",
    format: spot.format || "",
    starting_stack: spot.startingStack || "",
    palier: spot.palier || "",
    moment_tournoi: spot.momentTournoi || "",
    seats: spot.seats || [],
    replay: spot.replay || null,
    semaine_du: spot.semaineDu || null,
  };
}

function fromRow(row) {
  return {
    id: row.id,
    nom: row.nom,
    mode: row.mode,
    heroCombo: row.hero_combo,
    villainCombo: row.villain_combo,
    weights: row.weights || {},
    heroWeights: row.hero_weights || {},
    timer: row.timer,
    koValue: row.ko_value,
    ligne: row.ligne,
    explication: row.explication || "",
    gtoWizardLink: row.gto_wizard_link || "",
    consigne: row.consigne || "",
    question: row.question || "",
    questionAnswer: row.question_answer || "",
    questionAvis: row.question_avis || "",
    villainInfo: row.villain_info || "",
    board: row.board,
    blindLevel: row.blind_level,
    averageBB: row.average_bb,
    nbInscrits: row.nb_inscrits,
    potTotal: row.pot_total,
    buyIn: row.buy_in,
    format: row.format,
    startingStack: row.starting_stack,
    palier: row.palier,
    momentTournoi: row.moment_tournoi,
    seats: row.seats || [],
    replay: row.replay,
    semaineDu: row.semaine_du || null,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

export async function listSpots() {
  const supabase = createClient();
  const { data, error } = await supabase.from("spots").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(fromRow);
}

// La main en cours : la plus récemment publiée dont la date est déjà passée.
//
// Pas « celle de la semaine courante » : si Boris saute une semaine, la précédente reste en
// place. Une main d'avance vaut mieux qu'une page vide, et le jeu ne s'arrête pas parce qu'un
// lundi est passé à la trappe. Une date dans le futur, elle, ne sort pas : c'est ce qui permet
// de préparer les mains à l'avance.
export async function getMainDeLaSemaine() {
  const supabase = createClient();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("spots").select("*")
    .not("semaine_du", "is", null)
    .lte("semaine_du", aujourdhui)
    .order("semaine_du", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data && data.length ? fromRow(data[0]) : null;
}

export async function getSpot(id) {
  const supabase = createClient();
  const { data, error } = await supabase.from("spots").select("*").eq("id", id).single();
  if (error) throw error;
  return fromRow(data);
}

export async function createSpot(spot) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("spots")
    .insert({ ...toRow(spot), created_by: user.id })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateSpot(id, spot) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("spots")
    .update(toRow(spot))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteSpot(id) {
  const supabase = createClient();
  const { error } = await supabase.from("spots").delete().eq("id", id);
  if (error) throw error;
}

export async function insertAttempt({ spotId, score, found, selectedCount, referenceCount }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("attempts").insert({
    spot_id: spotId,
    user_id: user.id,
    score,
    found,
    selected_count: selectedCount,
    reference_count: referenceCount,
  });
  if (error) throw error;
}

export async function getMyAttempts() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("attempts")
    .select("*, spots(nom, mode)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// Top 10 d'un spot : seule la dernière tentative de chaque élève compte
// (une nouvelle tentative remplace l'ancienne dans le classement), triée par score.
// Le résultat de l'élève sur une main donnée : il n'a qu'un essai, donc une seule ligne. Sert à
// lui réafficher son score quand il revient sur la page au lieu de lui redemander de jouer.
export async function getMonScore(spotId) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("attempts")
    .select("score, found, created_at")
    .eq("spot_id", spotId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data && data.length ? data[0] : null;
}

export async function getSpotLeaderboard(spotId) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("attempts")
    .select("user_id, score, created_at, profiles(pseudo)")
    .eq("spot_id", spotId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const latestByUser = new Map();
  for (const row of data) {
    if (!latestByUser.has(row.user_id)) latestByUser.set(row.user_id, row);
  }
  return [...latestByUser.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((row) => ({ pseudo: row.profiles?.pseudo || "?", score: row.score }));
}

// Classement général : ratio moyen de points par spot joué, sur la vue player_stats
// (voir supabase/schema.sql), filtré à un minimum de spots joués pour être significatif.
export async function getGeneralRanking(minSpots = 5) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("player_stats")
    .select("pseudo, total_spots, total_points, ratio")
    .gte("total_spots", minSpots)
    .order("ratio", { ascending: false });
  if (error) throw error;
  return data;
}

// Tire un spot au hasard pour l'entraînement, en excluant les spots exploit
// encore verrouillés (rejoués il y a moins de 30 jours) et, optionnellement,
// le spot en cours (pour éviter de retomber deux fois de suite sur le même).

// Verrou de rejouabilité pour les spots exploit : 30 jours entre deux tentatives.
export async function getSpotLock(spotId) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("user_spot_locks")
    .select("last_played_at")
    .eq("spot_id", spotId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? new Date(data.last_played_at).getTime() : null;
}

export async function setSpotLock(spotId) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("user_spot_locks")
    .upsert({ spot_id: spotId, user_id: user.id, last_played_at: new Date().toISOString() });
  if (error) throw error;
}
