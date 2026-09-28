-- Gestion de carriere 2/5 — axes, objectifs, taches
-- A executer dans l'editeur SQL de Supabase, dans l'ordre des numeros.
-- Rejouable sans risque : rien n'est supprime, rien n'est ecrase.

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
create table if not exists task_recurrences (
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
  recurrence_id uuid references task_recurrences(id) on delete set null,
  origine text not null default 'joueur' check (origine in ('joueur', 'coaching')),
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_jour_idx on tasks (user_id, jour);
-- Une récurrence ne doit pas créer deux fois la même tâche le même jour.
create unique index if not exists tasks_recurrence_jour_idx
  on tasks (recurrence_id, jour) where recurrence_id is not null;

alter table tasks enable row level security;
alter table task_recurrences enable row level security;

drop policy if exists "taches lues par le joueur ou le coach" on tasks;
create policy "taches lues par le joueur ou le coach"
  on tasks for select to authenticated
  using (auth.uid() = user_id or est_coach());

-- Le coach consulte, il ne touche pas : c'est la to-do du joueur.
drop policy if exists "taches ecrites par le joueur" on tasks;
create policy "taches ecrites par le joueur"
  on tasks for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "recurrences lues par le joueur ou le coach" on task_recurrences;
create policy "recurrences lues par le joueur ou le coach"
  on task_recurrences for select to authenticated
  using (auth.uid() = user_id or est_coach());

drop policy if exists "recurrences ecrites par le joueur" on task_recurrences;
create policy "recurrences ecrites par le joueur"
  on task_recurrences for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
