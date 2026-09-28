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
-- 3. Axes prioritaires : trois au maximum en même temps, définis avec le coach.
-- La limite est tenue par la base, pas seulement par l'écran : c'est la règle produit qui donne
-- sa valeur à la page (trois axes, pas douze).
-- ---------------------------------------------------------------------------
create table if not exists career_axes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  titre text not null,
  detail text,
  statut text not null default 'a_travailler'
    check (statut in ('a_travailler', 'en_cours', 'maitrise')),
  debut date not null default current_date,
  fin date,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists career_axes_user_idx on career_axes (user_id, statut);

create or replace function limite_axes_actifs()
returns trigger
language plpgsql
as $$
declare
  n integer;
begin
  if new.statut in ('a_travailler', 'en_cours') then
    select count(*) into n
    from career_axes
    where user_id = new.user_id
      and statut in ('a_travailler', 'en_cours')
      and id <> new.id;
    if n >= 3 then
      raise exception 'Trois axes actifs au maximum : termine-en un avant d''en ouvrir un autre.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists axes_limite on career_axes;
create trigger axes_limite
  before insert or update on career_axes
  for each row execute function limite_axes_actifs();

alter table career_axes enable row level security;

drop policy if exists "axes lus par le joueur ou le coach" on career_axes;
create policy "axes lus par le joueur ou le coach"
  on career_axes for select to authenticated
  using (auth.uid() = user_id or est_coach());

-- Le coach définit les axes techniques ; le joueur peut faire avancer le statut de son côté.
drop policy if exists "axes ecrits par le coach" on career_axes;
create policy "axes ecrits par le coach"
  on career_axes for all to authenticated
  using (est_coach()) with check (est_coach());

drop policy if exists "statut d axe modifiable par le joueur" on career_axes;
create policy "statut d axe modifiable par le joueur"
  on career_axes for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. Objectifs : vision, année, trimestre. Trois trimestriels au maximum, tenu côté écran.
-- ---------------------------------------------------------------------------
create table if not exists career_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  horizon text not null check (horizon in ('vision', 'annee', 'trimestre')),
  texte text not null,
  statut text not null default 'en_cours' check (statut in ('en_cours', 'atteint', 'abandonne')),
  echeance date,
  created_at timestamptz not null default now()
);

create index if not exists career_goals_user_idx on career_goals (user_id, horizon);

alter table career_goals enable row level security;

drop policy if exists "objectifs lus par le joueur ou le coach" on career_goals;
create policy "objectifs lus par le joueur ou le coach"
  on career_goals for select to authenticated
  using (auth.uid() = user_id or est_coach());

drop policy if exists "objectifs ecrits par le joueur" on career_goals;
create policy "objectifs ecrits par le joueur"
  on career_goals for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. Tâches et semaine. `jour` à null = la tâche est dans la to-do générale, pas encore posée
-- dans la semaine. Une tâche non faite reste sur son jour : rien ne la reporte automatiquement,
-- c'est le joueur qui décide de la déplacer.
-- ---------------------------------------------------------------------------
create table if not exists routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  titre text not null,
  -- 1 = lundi … 7 = dimanche
  jours smallint[] not null default '{}',
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  titre text not null,
  detail text,
  jour date,
  ordre integer not null default 0,
  fait boolean not null default false,
  fait_le timestamptz,
  routine_id uuid references routines(id) on delete set null,
  origine text not null default 'joueur' check (origine in ('joueur', 'coaching')),
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_jour_idx on tasks (user_id, jour);
-- Une routine ne doit pas créer deux fois la même tâche le même jour.
create unique index if not exists tasks_routine_jour_idx
  on tasks (routine_id, jour) where routine_id is not null;

alter table tasks enable row level security;
alter table routines enable row level security;

drop policy if exists "taches lues par le joueur ou le coach" on tasks;
create policy "taches lues par le joueur ou le coach"
  on tasks for select to authenticated
  using (auth.uid() = user_id or est_coach());

-- Le coach consulte, il ne touche pas : c'est la to-do du joueur.
drop policy if exists "taches ecrites par le joueur" on tasks;
create policy "taches ecrites par le joueur"
  on tasks for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "routines lues par le joueur ou le coach" on routines;
create policy "routines lues par le joueur ou le coach"
  on routines for select to authenticated
  using (auth.uid() = user_id or est_coach());

drop policy if exists "routines ecrites par le joueur" on routines;
create policy "routines ecrites par le joueur"
  on routines for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6. Leak Finder : les captures restent des références, les trois stats en focus sont saisies
-- à la main par le coach. Pas de lecture automatique des captures en V1.
-- ---------------------------------------------------------------------------
create table if not exists leak_shots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  chemin text not null,               -- chemin dans le bucket Storage `leakfinder`
  titre text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists leak_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  nom text not null,
  valeur_depart numeric,
  valeur_actuelle numeric,
  target_min numeric,
  target_max numeric,
  statut text not null default 'focus' check (statut in ('focus', 'acquise')),
  valeur_atteinte numeric,
  valide_le timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists leak_stats_user_idx on leak_stats (user_id, statut);

-- Trois stats en focus au maximum : le tableau de bord ne doit montrer que ce qui se travaille.
create or replace function limite_stats_focus()
returns trigger
language plpgsql
as $$
declare
  n integer;
begin
  if new.statut = 'focus' then
    select count(*) into n
    from leak_stats
    where user_id = new.user_id and statut = 'focus' and id <> new.id;
    if n >= 3 then
      raise exception 'Trois statistiques en focus au maximum : valide-en une avant d''en ajouter une autre.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists stats_limite on leak_stats;
create trigger stats_limite
  before insert or update on leak_stats
  for each row execute function limite_stats_focus();

-- Historique des notes du coach : la dernière s'affiche, les anciennes restent consultables.
create table if not exists leak_stat_notes (
  id uuid primary key default gen_random_uuid(),
  stat_id uuid not null references leak_stats(id) on delete cascade,
  note text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists leak_stat_notes_stat_idx on leak_stat_notes (stat_id, created_at desc);

alter table leak_shots enable row level security;
alter table leak_stats enable row level security;
alter table leak_stat_notes enable row level security;

drop policy if exists "captures lues par le joueur ou le coach" on leak_shots;
create policy "captures lues par le joueur ou le coach"
  on leak_shots for select to authenticated
  using (auth.uid() = user_id or est_coach());

drop policy if exists "captures ecrites par le coach" on leak_shots;
create policy "captures ecrites par le coach"
  on leak_shots for all to authenticated
  using (est_coach()) with check (est_coach());

drop policy if exists "stats lues par le joueur ou le coach" on leak_stats;
create policy "stats lues par le joueur ou le coach"
  on leak_stats for select to authenticated
  using (auth.uid() = user_id or est_coach());

drop policy if exists "stats ecrites par le coach" on leak_stats;
create policy "stats ecrites par le coach"
  on leak_stats for all to authenticated
  using (est_coach()) with check (est_coach());

drop policy if exists "notes de stat lues par le joueur ou le coach" on leak_stat_notes;
create policy "notes de stat lues par le joueur ou le coach"
  on leak_stat_notes for select to authenticated
  using (exists (
    select 1 from leak_stats s
    where s.id = stat_id and (s.user_id = auth.uid() or est_coach())
  ));

drop policy if exists "notes de stat ecrites par le coach" on leak_stat_notes;
create policy "notes de stat ecrites par le coach"
  on leak_stat_notes for all to authenticated
  using (est_coach()) with check (est_coach());

-- ---------------------------------------------------------------------------
-- 7. Coachings, packs d'heures, actions proposées.
-- ---------------------------------------------------------------------------
create table if not exists coaching_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  heures numeric not null check (heures > 0),
  achete_le date not null default current_date,
  expire_le date,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists coaching_packs_user_idx on coaching_packs (user_id, expire_le);

create table if not exists coachings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  date timestamptz not null,
  duree_min integer not null default 60 check (duree_min > 0),
  statut text not null default 'a_venir' check (statut in ('a_venir', 'fait')),
  paiement text not null default 'a_payer' check (paiement in ('a_payer', 'paye', 'pack')),
  pack_id uuid references coaching_packs(id) on delete set null,
  -- Synthèse structurée : points_cles, concepts, leaks, decisions, plan, actions.
  -- La transcription complète n'est jamais conservée ici, c'est une décision produit.
  synthese jsonb not null default '{}'::jsonb,
  synthese_statut text not null default 'brouillon' check (synthese_statut in ('brouillon', 'valide')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists coachings_user_idx on coachings (user_id, date desc);

create table if not exists coaching_actions (
  id uuid primary key default gen_random_uuid(),
  coaching_id uuid not null references coachings(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  texte text not null,
  frequence text,
  echeance date,
  statut text not null default 'propose' check (statut in ('propose', 'accepte', 'ignore')),
  task_id uuid references tasks(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists coaching_actions_user_idx on coaching_actions (user_id, statut);

alter table coaching_packs enable row level security;
alter table coachings enable row level security;
alter table coaching_actions enable row level security;

drop policy if exists "packs lus par le joueur ou le coach" on coaching_packs;
create policy "packs lus par le joueur ou le coach"
  on coaching_packs for select to authenticated
  using (auth.uid() = user_id or est_coach());

drop policy if exists "packs ecrits par le coach" on coaching_packs;
create policy "packs ecrits par le coach"
  on coaching_packs for all to authenticated
  using (est_coach()) with check (est_coach());

-- Le joueur ne voit une synthèse qu'une fois validée : un brouillon est un document de travail
-- du coach, pas un compte rendu.
drop policy if exists "coachings lus par le joueur ou le coach" on coachings;
create policy "coachings lus par le joueur ou le coach"
  on coachings for select to authenticated
  using (est_coach() or (auth.uid() = user_id));

drop policy if exists "coachings ecrits par le coach" on coachings;
create policy "coachings ecrits par le coach"
  on coachings for all to authenticated
  using (est_coach()) with check (est_coach());

drop policy if exists "actions lues par le joueur ou le coach" on coaching_actions;
create policy "actions lues par le joueur ou le coach"
  on coaching_actions for select to authenticated
  using (auth.uid() = user_id or est_coach());

drop policy if exists "actions ecrites par le coach" on coaching_actions;
create policy "actions ecrites par le coach"
  on coaching_actions for insert to authenticated
  with check (est_coach());

-- Le joueur accepte, modifie l'échéance ou ignore : c'est lui qui décide de ce qui entre dans sa
-- to-do.
drop policy if exists "actions acceptees ou ignorees par le joueur" on coaching_actions;
create policy "actions acceptees ou ignorees par le joueur"
  on coaching_actions for update to authenticated
  using (auth.uid() = user_id or est_coach())
  with check (auth.uid() = user_id or est_coach());

-- Brouillon de synthèse : table SÉPARÉE, lisible du seul coach.
--
-- Le garder dans `coachings` aurait été plus simple, mais la règle « le joueur ne voit la synthèse
-- qu'une fois validée » n'aurait alors tenu qu'à l'écran : RLS filtre des lignes, pas des colonnes,
-- et le joueur a le droit de lire ses lignes de coaching. Une table à part rend la règle vraie
-- jusque dans l'API. `coachings.synthese` n'est rempli qu'à la validation.
create table if not exists coaching_drafts (
  coaching_id uuid primary key references coachings(id) on delete cascade,
  contenu jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table coaching_drafts enable row level security;

drop policy if exists "brouillons reserves au coach" on coaching_drafts;
create policy "brouillons reserves au coach"
  on coaching_drafts for all to authenticated
  using (est_coach()) with check (est_coach());

-- ---------------------------------------------------------------------------
-- 8. Totaux de coaching, calculés — jamais saisis à la main.
-- ---------------------------------------------------------------------------
create or replace view coaching_totals as
  select
    user_id,
    count(*) filter (where statut = 'fait') as nb_faits,
    coalesce(sum(duree_min) filter (where statut = 'fait'), 0) as minutes_faites,
    max(date) filter (where statut = 'fait') as dernier,
    min(date) filter (where statut = 'a_venir' and date >= now()) as prochain
  from coachings
  group by user_id;

-- ---------------------------------------------------------------------------
-- 9. Stockage des captures Leak Finder. Bucket privé : on ne sert que des liens signés.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('leakfinder', 'leakfinder', false)
on conflict (id) do nothing;

drop policy if exists "captures deposees par le coach" on storage.objects;
create policy "captures deposees par le coach"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'leakfinder' and est_coach());

drop policy if exists "captures supprimees par le coach" on storage.objects;
create policy "captures supprimees par le coach"
  on storage.objects for delete to authenticated
  using (bucket_id = 'leakfinder' and est_coach());

-- Le joueur ne lit que le dossier à son nom : le chemin commence par son identifiant.
drop policy if exists "captures lues par leur joueur ou le coach" on storage.objects;
create policy "captures lues par leur joueur ou le coach"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'leakfinder'
    and (est_coach() or (storage.foldername(name))[1] = auth.uid()::text)
  );

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
