-- Find It! — schéma initial (Phase 1 : socle)
-- À exécuter une fois dans l'éditeur SQL du projet Supabase (Database > SQL Editor).

create extension if not exists "pgcrypto";

-- ---------- profiles ----------
-- Étend auth.users avec pseudo + rôle. Une ligne est créée automatiquement
-- à l'inscription par le trigger handle_new_user ci-dessous.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  pseudo text unique not null,
  role text not null default 'student' check (role in ('admin', 'student')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles are readable by any authenticated user"
  on profiles for select
  to authenticated
  using (true);

create policy "users can update their own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Empêche un élève de s'auto-promouvoir admin via une simple requête update
-- (la policy ci-dessus autorise l'update de la ligne, pas le changement de rôle).
create or replace function prevent_role_self_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.role <> old.role and auth.uid() = old.id then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_role_change on profiles;
create trigger on_profile_role_change
  before update on profiles
  for each row execute function prevent_role_self_escalation();

-- Crée automatiquement le profil (rôle student par défaut) à l'inscription.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, pseudo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'pseudo', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- spots ----------
create table if not exists spots (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  mode text not null check (mode in ('theorique', 'exploit')),
  hero_combo text default '',
  villain_combo text default '',
  weights jsonb not null default '{}',
  hero_weights jsonb not null default '{}',
  timer integer not null default 30,
  ko_value text default '',
  ligne text default '',
  explication text default '',
  gto_wizard_link text default '',
  consigne text default '',
  question text default '',
  question_answer text default '',
  question_avis text default '',
  villain_info text default '',
  board text default '',
  blind_level text default '',
  average_bb text default '',
  nb_inscrits text default '',
  pot_total numeric,
  buy_in text default '',
  format text default '',
  starting_stack text default '',
  palier text default '',
  moment_tournoi text default '',
  seats jsonb not null default '[]',
  replay jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table spots enable row level security;

create policy "spots are readable by any authenticated user"
  on spots for select
  to authenticated
  using (true);

create policy "only admins can write spots"
  on spots for all
  to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- ---------- attempts ----------
create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references spots(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  score integer not null,
  found boolean not null,
  selected_count integer not null,
  reference_count integer not null,
  created_at timestamptz not null default now()
);

alter table attempts enable row level security;

create policy "attempts are readable by any authenticated user"
  on attempts for select
  to authenticated
  using (true);

create policy "users can insert their own attempts"
  on attempts for insert
  to authenticated
  with check (auth.uid() = user_id);

-- ---------- user_spot_locks ----------
-- Remplace exploit-last:{spotId} : un spot exploit ne peut être rejoué
-- qu'après 30 jours.
create table if not exists user_spot_locks (
  user_id uuid not null references profiles(id) on delete cascade,
  spot_id uuid not null references spots(id) on delete cascade,
  last_played_at timestamptz not null default now(),
  primary key (user_id, spot_id)
);

alter table user_spot_locks enable row level security;

create policy "users manage their own spot locks"
  on user_spot_locks for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- pot_odds_attempts ----------
-- Une ligne par question répondue dans l'outil Pot Odds (/pot-odds), pas de spot_id
-- puisque les situations sont générées à la volée (voir lib/poker/potOdds.js).
create table if not exists pot_odds_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  question_type text not null,
  correct boolean not null,
  created_at timestamptz not null default now()
);

alter table pot_odds_attempts enable row level security;

create policy "pot_odds_attempts are readable by any authenticated user"
  on pot_odds_attempts for select
  to authenticated
  using (true);

create policy "users can insert their own pot odds attempts"
  on pot_odds_attempts for insert
  to authenticated
  with check (auth.uid() = user_id);

-- ---------- vues utiles ----------

-- Classement général : ratio points/spot, minimum de spots filtré côté requête.
create or replace view player_stats as
select
  p.id as user_id,
  p.pseudo,
  count(a.id) as total_spots,
  coalesce(sum(a.score), 0) as total_points,
  coalesce(avg(a.score), 0) as ratio
from profiles p
join attempts a on a.user_id = p.id
group by p.id, p.pseudo;

-- Stats Pot Odds : score cumulé (+1 bonne réponse / -1 mauvaise réponse) pour l'affichage
-- perso, et précision (accuracy) pour le classement — filtré à un minimum de questions
-- répondues côté requête pour éviter qu'un joueur avec 2 questions tope le classement.
create or replace view pot_odds_stats as
select
  p.id as user_id,
  p.pseudo,
  count(a.id) as total_questions,
  count(*) filter (where a.correct) as total_correct,
  count(*) filter (where a.correct) - count(*) filter (where not a.correct) as score,
  coalesce(avg(case when a.correct then 1.0 else 0.0 end), 0) as accuracy
from profiles p
join pot_odds_attempts a on a.user_id = p.id
group by p.id, p.pseudo;
