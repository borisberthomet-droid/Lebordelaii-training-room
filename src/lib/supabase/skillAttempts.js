import { createClient } from "./client";
import { attemptScore } from "@/lib/poker/skillScore";

// --- Journal local ----------------------------------------------------------------------------
// Les exercices tournent sans connexion (aucun n'exige d'être identifié sauf Find It), et la base
// peut être en veille. On garde donc une copie locale des tentatives : la fiche reste lisible
// hors ligne, et rien n'est perdu si l'enregistrement distant échoue. C'est une copie, pas une
// source concurrente — dès que la base répond, c'est elle qui fait foi.
const LOCAL_KEY = "skillAttempts";
const LOCAL_MAX = 2000;

function pushLocal(row) {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    const rows = raw ? JSON.parse(raw) : [];
    rows.push(row);
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(-LOCAL_MAX)));
  } catch { /* navigation privée, quota plein : on n'insiste pas */ }
}

export function readLocalSkillAttempts(days = 120) {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const limite = Date.now() - days * 86400000;
    return JSON.parse(raw).filter((r) => new Date(r.created_at).getTime() >= limite);
  } catch {
    return [];
  }
}

export function clearLocalSkillAttempts() {
  try { window.localStorage.removeItem(LOCAL_KEY); } catch { /* sans effet */ }
}

// Enregistrement d'une tentative pour la fiche joueur. Le score est normalisé côté client par
// skillScore.js — la base ne stocke que le résultat, pas la logique de notation, pour qu'un
// changement de barème ne demande pas de migration.
//
// Volontairement silencieux en cas d'échec : un exercice ne doit jamais s'interrompre parce que
// l'enregistrement a raté (session expirée, base en veille). L'appelant n'attend pas le résultat.
export async function recordSkillAttempt({ exercise, questionType = null, outcome, meta = {} }) {
  const scored = attemptScore(exercise, questionType, outcome);
  if (!scored) return null;

  pushLocal({
    exercise, question_type: questionType,
    score: scored.score, chance: scored.chance,
    created_at: new Date().toISOString(),
  });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { error } = await supabase.from("skill_attempts").insert({
    user_id: user.id,
    exercise,
    question_type: questionType,
    score: scored.score,
    chance: scored.chance,
    meta,
  });
  if (error) throw error;
  return scored;
}

// Fenêtre de lecture : au-delà de 120 jours, la demi-vie de 30 jours réduit le poids d'une
// tentative à moins de 6% — inutile de la remonter.
const WINDOW_DAYS = 120;

function since(days) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

export async function getMySkillAttempts(days = WINDOW_DAYS) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("skill_attempts")
    .select("exercise, question_type, score, chance, created_at")
    .eq("user_id", user.id)
    .gte("created_at", since(days))
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

// Vue coach : la fiche d'un élève donné.
export async function getSkillAttemptsFor(userId, days = WINDOW_DAYS) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("skill_attempts")
    .select("exercise, question_type, score, chance, created_at")
    .eq("user_id", userId)
    .gte("created_at", since(days))
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listStudents() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, pseudo, role")
    .order("pseudo");
  if (error) throw error;
  return data || [];
}

// Source unique pour toute page qui affiche une progression : la base si elle repond, le journal
// local sinon. Dupliquer cette bascule ferait deriver l'accueil et la fiche.
export async function loadMySkillRows() {
  try {
    const rows = await getMySkillAttempts();
    if (rows.length === 0) {
      const local = readLocalSkillAttempts();
      if (local.length) return { rows: local, source: "local" };
    }
    return { rows, source: "base" };
  } catch {
    return { rows: readLocalSkillAttempts(), source: "local" };
  }
}
