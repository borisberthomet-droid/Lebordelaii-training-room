-- Classement du Find It sur simulation — a executer dans l'editeur SQL de Supabase.
-- Rejouable sans risque : rien n'est supprime, rien n'est ecrase.
--
-- Le simulateur enregistrait deja un score (skill_attempts, exercise = 'find-it', meta.source =
-- 'solveur') : il alimentait la fiche joueur, mais l'eleve ne le voyait nulle part. Cette vue
-- rend ces points visibles et comparables, sans nouvelle table ni nouvelle ecriture.
--
-- Deux chiffres, parce qu'ils ne disent pas la meme chose :
--   points   = somme des scores. Il monte en jouant. C'est le chiffre du jeu.
--   moyenne  = qualite moyenne. Il ne monte qu'en jouant MIEUX. C'est le chiffre du coach.
-- Classer sur les points seuls recompenserait le volume ; afficher les deux evite de faire
-- passer un joueur applique pour un mauvais joueur parce qu'il joue moins.
--
-- skill_attempts.score va de 0 a 1 : on le ramene sur 100, comme partout ailleurs dans l'appli.

create or replace view find_it_sim_stats as
select
  p.id                                  as user_id,
  p.pseudo,
  count(a.id)                           as total_mains,
  round(sum(a.score) * 100)::int        as points,
  round(avg(a.score) * 100)::int        as moyenne,
  round(max(a.score) * 100)::int        as meilleur,
  max(a.created_at)                     as derniere
from profiles p
join skill_attempts a on a.user_id = p.id
where a.exercise = 'find-it'
  and a.meta->>'source' = 'solveur'
group by p.id, p.pseudo;

-- Index de confort : la vue filtre sur l'exercice a chaque lecture du classement.
create index if not exists skill_attempts_exercise_idx
  on skill_attempts (exercise, created_at desc);
