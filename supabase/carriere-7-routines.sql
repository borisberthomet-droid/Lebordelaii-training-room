-- Gestion de carriere 7 — routines chiffrees et objectifs mensuels
-- A executer dans l'editeur SQL de Supabase. Rejouable sans risque.

-- ---------------------------------------------------------------------------
-- 1. Objectifs : Vision / trimestre / mois.
-- L'horizon « annee » reste accepte pour ne pas invalider les lignes deja ecrites ; l'ecran, lui,
-- ne propose plus que les trois horizons voulus.
-- `debut` date la mise en place d'un objectif mensuel — sans elle, impossible de dire de quel
-- mois on parle une fois l'objectif atteint.
-- ---------------------------------------------------------------------------
alter table career_goals drop constraint if exists career_goals_horizon_check;
alter table career_goals add constraint career_goals_horizon_check
  check (horizon in ('vision', 'annee', 'trimestre', 'mois'));

alter table career_goals add column if not exists debut date;

-- ---------------------------------------------------------------------------
-- 2. Routines chiffrees.
--
-- Une routine ne se contente plus d'etre cochee : elle compte. « Drill ICM » sans nombre ne dit
-- pas si la semaine valait dix spots ou deux cents. La quantite est portee par la TACHE (donc par
-- le jour), et l'unite par la routine — c'est elle qui sait ce qu'on compte.
--
-- `cible` est l'objectif de la routine sur sa periode, facultatif : il sert a afficher une
-- progression, jamais a bloquer quoi que ce soit.
-- ---------------------------------------------------------------------------
alter table tasks add column if not exists quantite numeric;

alter table routines add column if not exists unite text;        -- « spots », « mains », « minutes »…
alter table routines add column if not exists cible numeric;     -- objectif par semaine, facultatif
alter table routines add column if not exists couleur text;      -- pastille de la ligne dans la grille
alter table routines add column if not exists ordre integer not null default 0;

-- Les bilans (mois, trimestre, annee) se calculent a l'affichage, a partir des memes lignes que
-- la grille montre deja. Pas de vue ni de compteur range quelque part : deux sources pour un meme
-- total, c'est une divergence qui attend son heure.
