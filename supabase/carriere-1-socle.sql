-- Gestion de carriere 1/5 — socle, competences, auto-evaluation
-- A executer dans l'editeur SQL de Supabase, dans l'ordre des numeros.
-- Rejouable sans risque : rien n'est supprime, rien n'est ecrase.

-- Gestion de carrière — à exécuter UNE FOIS dans l'éditeur SQL du projet Supabase.
-- Ce fichier est indépendant de schema.sql : il suppose seulement que `profiles` existe.
--
-- Principe de droits, le même partout : l'élève est propriétaire de ce qui relève de lui
-- (auto-évaluation, objectifs, tâches, planning), le coach lit tout et écrit ce qui relève de
-- l'accompagnement (axes, leaks, coachings, packs). Aucune table n'autorise le coach à modifier
-- les tâches ou les objectifs du joueur : c'est une décision produit, pas un oubli.

create extension if not exists "pgcrypto";

-- Raccourci lisible, réutilisé par toutes les policies.
create or replace function est_coach()
returns boolean
language sql
stable
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- Fiche joueur : deux champs qui manquaient à profile_private.
-- ---------------------------------------------------------------------------
alter table profile_private add column if not exists prenom text;
alter table profile_private add column if not exists nom text;

-- ---------------------------------------------------------------------------
-- 1. Référentiel de compétences (auto-évaluation)
-- Une table plutôt qu'une liste en dur : ajouter « 4-bet pots » ne doit pas demander un
-- déploiement. L'ordre d'affichage est porté par `ordre`, la désactivation par `actif` — on ne
-- supprime pas une compétence déjà notée dans un ancien snapshot.
-- ---------------------------------------------------------------------------
create table if not exists skill_items (
  id uuid primary key default gen_random_uuid(),
  famille text not null check (famille in ('technique', 'apprentissage', 'gestion')),
  libelle text not null,
  -- Axe de la carte joueur. Onze compétences techniques feraient un radar illisible : plusieurs
  -- compétences partagent un axe, et une nouvelle compétence choisit le sien sans toucher au code.
  groupe text not null default 'Technique',
  ordre integer not null default 0,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

alter table skill_items add column if not exists groupe text not null default 'Technique';

alter table skill_items enable row level security;

drop policy if exists "skill_items lisibles par tous" on skill_items;
create policy "skill_items lisibles par tous"
  on skill_items for select to authenticated using (true);

drop policy if exists "skill_items ecrits par le coach" on skill_items;
create policy "skill_items ecrits par le coach"
  on skill_items for all to authenticated
  using (est_coach()) with check (est_coach());

-- ---------------------------------------------------------------------------
-- 2. Auto-évaluations : un snapshot daté, ses notes de 0 à 100.
-- ---------------------------------------------------------------------------
create table if not exists self_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  commentaire text,
  created_at timestamptz not null default now()
);

create index if not exists self_assessments_user_idx
  on self_assessments (user_id, created_at desc);

create table if not exists self_assessment_scores (
  assessment_id uuid not null references self_assessments(id) on delete cascade,
  skill_id uuid not null references skill_items(id) on delete cascade,
  score integer not null check (score >= 0 and score <= 100),
  primary key (assessment_id, skill_id)
);

alter table self_assessments enable row level security;
alter table self_assessment_scores enable row level security;

drop policy if exists "auto-evaluations lues par leur auteur ou le coach" on self_assessments;
create policy "auto-evaluations lues par leur auteur ou le coach"
  on self_assessments for select to authenticated
  using (auth.uid() = user_id or est_coach());

drop policy if exists "auto-evaluations ecrites par leur auteur" on self_assessments;
create policy "auto-evaluations ecrites par leur auteur"
  on self_assessments for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "notes lues par leur auteur ou le coach" on self_assessment_scores;
create policy "notes lues par leur auteur ou le coach"
  on self_assessment_scores for select to authenticated
  using (exists (
    select 1 from self_assessments a
    where a.id = assessment_id and (a.user_id = auth.uid() or est_coach())
  ));

drop policy if exists "notes ecrites par leur auteur" on self_assessment_scores;
create policy "notes ecrites par leur auteur"
  on self_assessment_scores for all to authenticated
  using (exists (select 1 from self_assessments a where a.id = assessment_id and a.user_id = auth.uid()))
  with check (exists (select 1 from self_assessments a where a.id = assessment_id and a.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 10. Référentiel de compétences — première liste, modifiable ensuite depuis l'écran coach.
-- ---------------------------------------------------------------------------
insert into skill_items (famille, libelle, groupe, ordre)
select * from (values
  ('technique', 'SRP IP agresseur', 'SRP', 10),
  ('technique', 'SRP IP défenseur', 'SRP', 20),
  ('technique', 'SRP OOP agresseur', 'SRP', 30),
  ('technique', 'SRP OOP défenseur', 'SRP', 40),
  ('technique', 'Pots 3-bet IP', 'Pots 3-bet', 50),
  ('technique', 'Pots 3-bet OOP', 'Pots 3-bet', 60),
  ('technique', 'Multiway', 'Multiway', 70),
  ('technique', 'Préflop', 'Préflop', 80),
  ('technique', 'ICM', 'ICM & PKO', 90),
  ('technique', 'Postflop ICM', 'ICM & PKO', 100),
  ('technique', 'PKO', 'ICM & PKO', 110),
  ('apprentissage', 'Organisation du travail', 'Apprentissage', 10),
  ('apprentissage', 'Structurer son apprentissage', 'Apprentissage', 20),
  ('apprentissage', 'Système de révision', 'Apprentissage', 30),
  ('apprentissage', 'Faire des reviews', 'Apprentissage', 40),
  ('apprentissage', 'Travail avec les solveurs', 'Apprentissage', 50),
  ('apprentissage', 'Régularité', 'Apprentissage', 60),
  ('apprentissage', 'Transformer une connaissance en automatisme', 'Apprentissage', 70),
  ('gestion', 'Bankroll management', 'Gestion', 10),
  ('gestion', 'Set de session', 'Gestion', 20),
  ('gestion', 'Organisation', 'Gestion', 30),
  ('gestion', 'Investissement dans son activité', 'Gestion', 40),
  ('gestion', 'Compétences entrepreneuriales', 'Gestion', 50)
) as v(famille, libelle, groupe, ordre)
where not exists (select 1 from skill_items);
