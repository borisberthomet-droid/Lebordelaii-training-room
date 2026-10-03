import { createClient } from "./client";
import { decalerJours, joursDeSemaine, lundiDe, numeroJour } from "@/lib/carriere/semaine";
import { resteAEncaisser } from "@/lib/carriere/prestations";

// Accès aux données de la Gestion de carrière. Tout passe par les policies : un élève ne voit que
// ses lignes, le coach voit tout. Aucune fonction ici ne filtre « pour faire joli » — si une
// requête ramène trop, c'est la policy qu'il faut corriger, pas l'écran.

const sb = () => createClient();

async function jeter(erreur) {
  if (!erreur) return;
  // Tant que le SQL n'a pas été passé dans Supabase, les tables n'existent pas : on le dit en
  // clair plutôt que de laisser remonter « relation does not exist ».
  if (/does not exist|schema cache/i.test(erreur.message || "")) {
    throw new Error("Les tables de la Gestion de carrière n'existent pas encore : exécute supabase/carriere.sql dans l'éditeur SQL Supabase.");
  }
  throw erreur;
}

export async function monCompte() {
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("id, pseudo, role").eq("id", user.id).maybeSingle();
  return { id: user.id, email: user.email, pseudo: data?.pseudo || user.email, role: data?.role || "student" };
}

// --- Compétences et auto-évaluation -------------------------------------------------------------

export async function listerCompetences() {
  const { data, error } = await sb()
    .from("skill_items").select("*").eq("actif", true)
    .order("famille").order("ordre");
  await jeter(error);
  return data || [];
}

export async function listerEvaluations(userId) {
  const { data, error } = await sb()
    .from("self_assessments")
    .select("id, commentaire, created_at, self_assessment_scores(skill_id, score)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  await jeter(error);
  return (data || []).map((e) => ({
    id: e.id,
    commentaire: e.commentaire,
    date: e.created_at,
    scores: Object.fromEntries((e.self_assessment_scores || []).map((s) => [s.skill_id, s.score])),
  }));
}

export async function enregistrerEvaluation(userId, scores, commentaire) {
  const supabase = sb();
  const { data, error } = await supabase
    .from("self_assessments").insert({ user_id: userId, commentaire: commentaire || null })
    .select("id").single();
  await jeter(error);
  const lignes = Object.entries(scores)
    .filter(([, v]) => v != null && v !== "")
    .map(([skill_id, score]) => ({ assessment_id: data.id, skill_id, score: Number(score) }));
  if (lignes.length) {
    const { error: e2 } = await supabase.from("self_assessment_scores").insert(lignes);
    await jeter(e2);
  }
  return data.id;
}

// --- Axes prioritaires ---------------------------------------------------------------------------

export async function listerAxes(userId) {
  const { data, error } = await sb()
    .from("career_axes").select("*").eq("user_id", userId)
    .order("statut").order("created_at", { ascending: false });
  await jeter(error);
  return data || [];
}

export async function creerAxe(userId, axe, parId) {
  const { error } = await sb().from("career_axes").insert({ ...axe, user_id: userId, created_by: parId });
  await jeter(error);
}

export async function majAxe(id, champs) {
  const { error } = await sb().from("career_axes").update(champs).eq("id", id);
  await jeter(error);
}

export async function supprimerAxe(id) {
  const { error } = await sb().from("career_axes").delete().eq("id", id);
  await jeter(error);
}

// --- Objectifs -------------------------------------------------------------------------------------

export async function listerObjectifs(userId) {
  const { data, error } = await sb()
    .from("career_goals").select("*").eq("user_id", userId)
    .order("horizon").order("created_at", { ascending: false });
  await jeter(error);
  return data || [];
}

export async function creerObjectif(userId, objectif) {
  const { data, error } = await sb()
    .from("career_goals").insert({ ...objectif, user_id: userId }).select("*").single();
  await jeter(error);
  return data;
}

export async function majObjectif(id, champs) {
  const { error } = await sb().from("career_goals").update(champs).eq("id", id);
  await jeter(error);
}

export async function supprimerObjectif(id) {
  const { error } = await sb().from("career_goals").delete().eq("id", id);
  await jeter(error);
}

// --- Tâches ------------------------------------------------------------------------------------------

// Backlog (jour null) et semaine demandée, en une fois : les deux vues se manipulent ensemble
// (on glisse de l'une à l'autre), les charger séparément ferait clignoter l'écran.
export async function chargerTaches(userId, lundi) {
  const jours = joursDeSemaine(lundi);
  const supabase = sb();
  const [backlog, semaine] = await Promise.all([
    supabase.from("tasks").select("*").eq("user_id", userId).is("jour", null).order("ordre"),
    supabase.from("tasks").select("*").eq("user_id", userId)
      .gte("jour", jours[0]).lte("jour", jours[6]).order("ordre"),
  ]);
  await jeter(backlog.error);
  await jeter(semaine.error);
  return { backlog: backlog.data || [], semaine: semaine.data || [] };
}

export async function creerTache(userId, tache) {
  const { data, error } = await sb()
    .from("tasks").insert({ ...tache, user_id: userId }).select("*").single();
  await jeter(error);
  return data;
}

export async function majTache(id, champs) {
  const { error } = await sb().from("tasks").update(champs).eq("id", id);
  await jeter(error);
}

export async function supprimerTache(id) {
  const { error } = await sb().from("tasks").delete().eq("id", id);
  await jeter(error);
}

export async function listerRoutines(userId) {
  const { data, error } = await sb()
    .from("routines").select("*").eq("user_id", userId).eq("actif", true).order("created_at");
  await jeter(error);
  return data || [];
}

export async function creerRoutine(userId, titre, jours, champs = {}) {
  const { data, error } = await sb()
    .from("routines").insert({ user_id: userId, titre, jours, ...champs }).select("*").single();
  await jeter(error);
  return data;
}

export async function majRoutine(id, champs) {
  const { error } = await sb().from("routines").update(champs).eq("id", id);
  await jeter(error);
}

// Grille des routines : les routines actives et TOUTES leurs entrees. Le volume reste modeste —
// quelques centaines de lignes par an — et series comme cumuls ont besoin de l'historique entier.
export async function chargerGrilleRoutines(userId) {
  const supabase = sb();
  const [routines, entrees] = await Promise.all([
    supabase.from("routines").select("*").eq("user_id", userId).eq("actif", true).order("ordre").order("created_at"),
    supabase.from("tasks").select("id, routine_id, jour, fait, quantite")
      .eq("user_id", userId).not("routine_id", "is", null).order("jour"),
  ]);
  await jeter(routines.error);
  await jeter(entrees.error);
  return { routines: routines.data || [], entrees: entrees.data || [] };
}

// Coche ou decoche une routine un jour donne. La ligne peut ne pas exister : l'ouverture d'une
// semaine n'est plus la seule facon de la creer, on peut cocher n'importe quel jour de la grille.
export async function marquerRoutine({ userId, routine, jour, fait, entree }) {
  const supabase = sb();
  if (entree) {
    const { error } = await supabase.from("tasks")
      .update({ fait, fait_le: fait ? new Date().toISOString() : null })
      .eq("id", entree.id);
    await jeter(error);
    return { ...entree, fait };
  }
  const { data, error } = await supabase.from("tasks").insert({
    user_id: userId, titre: routine.titre, jour, routine_id: routine.id,
    fait, fait_le: fait ? new Date().toISOString() : null,
  }).select("id, routine_id, jour, fait, quantite").single();
  await jeter(error);
  return data;
}

export async function saisirQuantite(taskId, quantite) {
  const { error } = await sb().from("tasks")
    .update({ quantite: quantite === "" || quantite == null ? null : Number(quantite) })
    .eq("id", taskId);
  await jeter(error);
}

export async function supprimerRoutine(id) {
  const { error } = await sb().from("routines").update({ actif: false }).eq("id", id);
  await jeter(error);
}

// Pose les routines de la semaine affichée. L'index unique (routine_id, jour) fait
// que rejouer l'opération ne crée pas de doublon — c'est lui qui garantit l'idempotence, pas un
// test côté client qui courrait après une tâche créée sur un autre appareil.
export async function materialiserRoutines(userId, lundi, routines, dejaPosees) {
  if (!routines.length) return [];
  const existantes = new Set(dejaPosees.filter((t) => t.routine_id).map((t) => `${t.routine_id}|${t.jour}`));
  const aCreer = [];
  for (const jour of joursDeSemaine(lundi)) {
    const n = numeroJour(jour);
    for (const r of routines) {
      if (!(r.jours || []).includes(n)) continue;
      if (existantes.has(`${r.id}|${jour}`)) continue;
      aCreer.push({ user_id: userId, titre: r.titre, jour, routine_id: r.id });
    }
  }
  if (!aCreer.length) return [];
  const { data, error } = await sb().from("tasks").insert(aCreer).select("*");
  // Une collision sur l'index unique veut dire que la tâche existait déjà : ce n'est pas une
  // erreur à montrer.
  if (error && error.code !== "23505") await jeter(error);
  return data || [];
}

// --- Leak Finder -------------------------------------------------------------------------------------

export async function listerStats(userId) {
  const { data, error } = await sb()
    .from("leak_stats")
    .select("*, leak_stat_notes(id, note, created_at)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  await jeter(error);
  return (data || []).map((s) => ({
    ...s,
    notes: (s.leak_stat_notes || []).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
  }));
}

export async function creerStat(userId, stat, parId) {
  const { data, error } = await sb()
    .from("leak_stats").insert({ ...stat, user_id: userId, created_by: parId }).select("*").single();
  await jeter(error);
  return data;
}

export async function majStat(id, champs) {
  const { error } = await sb().from("leak_stats").update(champs).eq("id", id);
  await jeter(error);
}

export async function supprimerStat(id) {
  const { error } = await sb().from("leak_stats").delete().eq("id", id);
  await jeter(error);
}

export async function ajouterNote(statId, note, parId) {
  const { data, error } = await sb()
    .from("leak_stat_notes").insert({ stat_id: statId, note, created_by: parId }).select("*").single();
  await jeter(error);
  return data;
}

// Valider une stat, c'est acter qu'elle est atteinte : elle quitte les focus et libère une place.
export async function validerStat(id, valeurAtteinte) {
  const { error } = await sb().from("leak_stats").update({
    statut: "acquise",
    valeur_atteinte: valeurAtteinte,
    valeur_actuelle: valeurAtteinte,
    valide_le: new Date().toISOString(),
  }).eq("id", id);
  await jeter(error);
}

export async function listerCaptures(userId) {
  const { data, error } = await sb()
    .from("leak_shots").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  await jeter(error);
  return data || [];
}

export async function envoyerCapture(userId, fichier, titre, parId) {
  const supabase = sb();
  const chemin = `${userId}/${Date.now()}-${fichier.name.replace(/[^\w.-]+/g, "_")}`;
  const { error } = await supabase.storage.from("leakfinder").upload(chemin, fichier, { upsert: false });
  if (error) {
    if (/Bucket not found/i.test(error.message || "")) {
      throw new Error("Le bucket Storage « leakfinder » n'existe pas encore : crée-le dans Supabase (Storage → New bucket, privé).");
    }
    throw error;
  }
  const { data, error: e2 } = await supabase
    .from("leak_shots").insert({ user_id: userId, chemin, titre: titre || null, created_by: parId })
    .select("*").single();
  await jeter(e2);
  return data;
}

// Les captures sont dans un bucket privé : on ne sert que des liens signés, valables une heure.
export async function lienCapture(chemin) {
  const { data, error } = await sb().storage.from("leakfinder").createSignedUrl(chemin, 3600);
  if (error) return null;
  return data?.signedUrl || null;
}

export async function supprimerCapture(capture) {
  const supabase = sb();
  await supabase.storage.from("leakfinder").remove([capture.chemin]);
  const { error } = await supabase.from("leak_shots").delete().eq("id", capture.id);
  await jeter(error);
}

// --- Coachings et packs ---------------------------------------------------------------------------

// La fiche privee reduite a ce dont la carte mentale a besoin. Une fonction a part plutot que
// chargerFiche : cette page n’a ni objectifs ni coachings a charger pour afficher une phrase.
export async function chargerCartePrivee(userId) {
  const { data, error } = await sb()
    .from("profile_private").select("mantra, photo_mentale").eq("id", userId).maybeSingle();
  await jeter(error);
  return data || {};
}

// Mantra et photo de la carte mentale. Ils vivent sur la fiche privée et non dans une évaluation
// datée : ils appartiennent à la personne, ils ne changent pas tous les quinze jours, et il n'y a
// rien à historiser. L'upsert ne touche que les colonnes passées, le reste de la fiche est intact.
export async function enregistrerCarteMentale(userId, champs) {
  const { error } = await sb().from("profile_private")
    .upsert({ id: userId, ...champs, updated_at: new Date().toISOString() }, { onConflict: "id" });
  await jeter(error);
}

export async function envoyerPhotoMentale(userId, fichier) {
  const supabase = sb();
  const chemin = `${userId}/${Date.now()}-${fichier.name.replace(/[^\w.-]+/g, "_")}`;
  const { error } = await supabase.storage.from("mental").upload(chemin, fichier, { upsert: false });
  if (error) {
    if (/Bucket not found/i.test(error.message || "")) {
      throw new Error("Le bucket Storage « mental » n'existe pas encore : exécute supabase/carriere-11-carte-mentale.sql dans l'éditeur SQL Supabase.");
    }
    throw error;
  }
  await enregistrerCarteMentale(userId, { photo_mentale: chemin });
  return chemin;
}

// Lien signé, valable une heure : le bucket est privé, rien n'est servi en clair.
export async function lienPhotoMentale(chemin) {
  if (!chemin) return null;
  const { data, error } = await sb().storage.from("mental").createSignedUrl(chemin, 3600);
  if (error) return null;
  return data?.signedUrl || null;
}

export async function retirerPhotoMentale(userId, chemin) {
  // On efface le fichier avant d'oublier son chemin : dans l'autre sens, une erreur laisserait
  // une image orpheline que plus personne ne saurait retrouver pour la supprimer.
  if (chemin) await sb().storage.from("mental").remove([chemin]);
  await enregistrerCarteMentale(userId, { photo_mentale: null });
}

export async function listerMental(userId) {
  const { data, error } = await sb()
    .from("mental_checkins").select("*").eq("user_id", userId).order("fait_le", { ascending: false });
  await jeter(error);
  return data || [];
}
// Une évaluation par jour : revenir le même jour corrige celle du jour plutôt que d'en empiler
// une seconde, ce qui ferait un pic sur la courbe là où il n'y a eu qu'une hésitation.
export async function enregistrerMental(userId, { fait_le, scores, note }) {
  const { error } = await sb().from("mental_checkins")
    .upsert({ user_id: userId, fait_le, scores, note }, { onConflict: "user_id,fait_le" });
  await jeter(error);
}
export async function supprimerMental(id) {
  const { error } = await sb().from("mental_checkins").delete().eq("id", id);
  await jeter(error);
}

export async function listerPrestations(userId) {
  const { data, error } = await sb()
    .from("prestations").select("*").eq("user_id", userId).order("commandee_le", { ascending: false });
  await jeter(error);
  return data || [];
}
export async function creerPrestation(userId, prestation, parId) {
  const { data, error } = await sb()
    .from("prestations").insert({ ...prestation, user_id: userId, created_by: parId }).select("*").single();
  await jeter(error);
  return data;
}
export async function majPrestation(id, champs) {
  const { error } = await sb().from("prestations").update(champs).eq("id", id);
  await jeter(error);
}
export async function supprimerPrestation(id) {
  const { error } = await sb().from("prestations").delete().eq("id", id);
  await jeter(error);
}

export async function listerCoachings(userId) {
  const { data, error } = await sb()
    .from("coachings").select("*, coaching_actions(*)").eq("user_id", userId).order("date", { ascending: false });
  await jeter(error);
  return data || [];
}

export async function creerCoaching(userId, coaching, parId) {
  const { data, error } = await sb()
    .from("coachings").insert({ ...coaching, user_id: userId, created_by: parId }).select("*").single();
  await jeter(error);
  return data;
}

export async function majCoaching(id, champs) {
  const { error } = await sb().from("coachings").update(champs).eq("id", id);
  await jeter(error);
}

export async function supprimerCoaching(id) {
  const { error } = await sb().from("coachings").delete().eq("id", id);
  await jeter(error);
}

// Brouillon de synthèse : table réservée au coach. Ce que le joueur voit est dans
// `coachings.synthese`, rempli seulement à la validation.
export async function chargerBrouillon(coachingId) {
  const { data, error } = await sb()
    .from("coaching_drafts").select("contenu").eq("coaching_id", coachingId).maybeSingle();
  await jeter(error);
  return data?.contenu || {};
}

export async function enregistrerBrouillon(coachingId, contenu) {
  const { error } = await sb()
    .from("coaching_drafts")
    .upsert({ coaching_id: coachingId, contenu, updated_at: new Date().toISOString() });
  await jeter(error);
}

// Valider, c'est publier : le brouillon devient la synthèse visible du joueur.
export async function validerSynthese(coachingId, contenu) {
  await enregistrerBrouillon(coachingId, contenu);
  await majCoaching(coachingId, { synthese: contenu, synthese_statut: "valide" });
}

export async function creerActions(coachingId, userId, textes) {
  const lignes = textes.filter((t) => t.trim()).map((texte) => ({ coaching_id: coachingId, user_id: userId, texte }));
  if (!lignes.length) return [];
  const { data, error } = await sb().from("coaching_actions").insert(lignes).select("*");
  await jeter(error);
  return data || [];
}

export async function majAction(id, champs) {
  const { error } = await sb().from("coaching_actions").update(champs).eq("id", id);
  await jeter(error);
}

// Accepter une action proposée : elle devient une tâche de la to-do générale, et l'action garde
// le lien pour qu'on ne la propose pas deux fois.
export async function accepterAction(action, userId) {
  const tache = await creerTache(userId, {
    titre: action.texte,
    detail: action.frequence || null,
    jour: action.echeance || null,
    origine: "coaching",
  });
  await majAction(action.id, { statut: "accepte", task_id: tache.id });
  return tache;
}

export async function listerPacks(userId) {
  const { data, error } = await sb()
    .from("coaching_packs").select("*").eq("user_id", userId).order("achete_le", { ascending: false });
  await jeter(error);
  return data || [];
}

export async function creerPack(userId, pack, parId) {
  const { data, error } = await sb()
    .from("coaching_packs").insert({ ...pack, user_id: userId, created_by: parId }).select("*").single();
  await jeter(error);
  return data;
}

export async function supprimerPack(id) {
  const { error } = await sb().from("coaching_packs").delete().eq("id", id);
  await jeter(error);
}

// Consommation d'un pack : la somme des coachings réalisés qui lui sont rattachés. Calculé, jamais
// saisi — un compteur qu'on met à jour à la main finit toujours par mentir.
export function etatPack(pack, coachings) {
  const minutes = coachings
    .filter((c) => c.pack_id === pack.id && c.statut === "fait")
    .reduce((s, c) => s + (c.duree_min || 0), 0);
  const utilisees = minutes / 60;
  const restantes = Math.max(0, pack.heures - utilisees);
  const expire = pack.expire_le || null;
  const joursRestants = expire
    ? Math.ceil((new Date(`${expire}T23:59:59`) - new Date()) / 86400000)
    : null;
  return {
    achetees: pack.heures,
    utilisees: +utilisees.toFixed(2),
    restantes: +restantes.toFixed(2),
    expire,
    joursRestants,
    expire_bientot: joursRestants != null && joursRestants <= 15 && joursRestants >= 0 && restantes > 0,
    expire_passe: joursRestants != null && joursRestants < 0,
  };
}

export function packActif(packs, coachings) {
  const vivants = packs
    .map((p) => ({ pack: p, etat: etatPack(p, coachings) }))
    .filter((x) => !x.etat.expire_passe && x.etat.restantes > 0);
  return vivants[0] || null;
}

// --- Vue coach ----------------------------------------------------------------------------------------

// Une ligne par joueur pour le tableau du coach. Les totaux viennent de la vue SQL, les packs
// sont recomposés ici parce que leur consommation dépend des coachings.
export async function listerJoueurs() {
  const supabase = sb();
  const [profils, totaux, packs, coachings, prestations] = await Promise.all([
    supabase.from("profiles").select("id, pseudo, role, created_at").order("pseudo"),
    supabase.from("coaching_totals").select("*"),
    supabase.from("coaching_packs").select("*"),
    supabase.from("coachings").select("id, user_id, pack_id, statut, duree_min, date, paiement"),
    supabase.from("prestations").select("*").order("commandee_le", { ascending: false }),
  ]);
  await jeter(profils.error);
  await jeter(totaux.error);
  await jeter(packs.error);
  await jeter(coachings.error);
  await jeter(prestations.error);

  const parJoueur = (liste, id) => liste.filter((x) => x.user_id === id);
  return (profils.data || []).map((p) => {
    const t = (totaux.data || []).find((x) => x.user_id === p.id);
    const sesCoachings = parJoueur(coachings.data || [], p.id);
    const actif = packActif(parJoueur(packs.data || [], p.id), sesCoachings);
    const impayes = sesCoachings.filter((c) => c.statut === "fait" && c.paiement === "a_payer").length;
    // La prestation qui compte dans un tableau de suivi est celle qui est EN COURS : une
    // prestation terminée n'appelle aucune action, elle n'a rien à faire dans une colonne qu'on
    // balaie du regard. La liste étant déjà triée par date, la première est la plus récente.
    const sesPrestations = parJoueur(prestations.data || [], p.id);
    return {
      ...p,
      prestations: sesPrestations,
      prestation: sesPrestations.find((x) => x.statut === "en_cours") || null,
      duPrestations: resteAEncaisser(sesPrestations),
      nbCoachings: t?.nb_faits || 0,
      heures: +(((t?.minutes_faites || 0) / 60).toFixed(2)),
      dernier: t?.dernier || null,
      prochain: t?.prochain || null,
      pack: actif,
      impayes,
    };
  });
}

// Fiche complète d'un joueur, côté coach comme côté joueur : une seule requête groupée, pour que
// le tableau de bord n'enchaîne pas huit allers-retours.
export async function chargerFiche(userId) {
  const supabase = sb();
  const lundi = lundiDe();
  const [axes, objectifs, stats, coachings, packs, evals, taches, prive, competences, prestations,
         mental] = await Promise.all([
    listerAxes(userId),
    listerObjectifs(userId),
    listerStats(userId),
    listerCoachings(userId),
    listerPacks(userId),
    listerEvaluations(userId),
    supabase.from("tasks").select("*").eq("user_id", userId)
      .gte("jour", lundi).lte("jour", decalerJours(lundi, 6)),
    supabase.from("profile_private").select("*").eq("id", userId).maybeSingle(),
    listerCompetences(),
    listerPrestations(userId),
    listerMental(userId),
  ]);
  await jeter(taches.error);
  return {
    userId,
    axes,
    objectifs,
    stats,
    coachings,
    packs,
    prestations,
    mental,
    evaluations: evals,
    competences,
    tachesSemaine: taches.data || [],
    prive: prive.data || {},
    lundi,
  };
}
