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

-- ---------- range_spots / range_attempts ----------
-- Range Builder (/range-builder) : Boris crée un spot (catégorie libre + intitulé + range de
-- référence collée depuis un solveur), un élève dessine sa propre stratégie sur le même spot et
-- obtient un score de similarité (voir compareRanges dans lib/poker/rangeCompare.js). Catégorie en
-- texte libre (pas de table séparée) — le formulaire propose les catégories déjà utilisées via un
-- datalist, mais Boris peut en taper une nouvelle à tout moment ("cbet / deux barrel", "Range de
-- call PKO vs resteal", etc.), pas de taxonomie figée à maintenir.
create table if not exists range_spots (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  label text not null,
  reference_weights jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table range_spots enable row level security;

create policy "range_spots are readable by any authenticated user"
  on range_spots for select
  to authenticated
  using (true);

create policy "only admins can write range_spots"
  on range_spots for all
  to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create table if not exists range_attempts (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references range_spots(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  student_weights jsonb not null default '{}'::jsonb,
  accuracy numeric not null,
  created_at timestamptz not null default now()
);

alter table range_attempts enable row level security;

create policy "range_attempts are readable by any authenticated user"
  on range_attempts for select
  to authenticated
  using (true);

create policy "users can insert their own range_attempts"
  on range_attempts for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Classement général Range Builder : précision moyenne, filtrée à un minimum de tentatives
-- côté requête (même convention que player_stats/pot_odds_stats).
create or replace view range_builder_stats as
select
  p.id as user_id,
  p.pseudo,
  count(a.id) as total_attempts,
  coalesce(avg(a.accuracy), 0) as avg_accuracy
from profiles p
join range_attempts a on a.user_id = p.id
group by p.id, p.pseudo;

-- ---------- math_trainer_attempts ----------
-- Une ligne par question répondue dans Math Trainer (/math-trainer). Pas de spot_id : les
-- opérations sont générées à la volée (voir lib/poker/mathTrainer.js), comme pour pot_odds.
create table if not exists math_trainer_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  question_type text not null,
  correct boolean not null,
  created_at timestamptz not null default now()
);

alter table math_trainer_attempts enable row level security;

create policy "math_trainer_attempts are readable by any authenticated user"
  on math_trainer_attempts for select
  to authenticated
  using (true);

create policy "users can insert their own math trainer attempts"
  on math_trainer_attempts for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Stats Math Trainer : score cumulé (+1/-1) pour l'affichage perso, précision pour le
-- classement — filtré à un minimum de questions côté requête.
create or replace view math_trainer_stats as
select
  p.id as user_id,
  p.pseudo,
  count(a.id) as total_questions,
  count(*) filter (where a.correct) as total_correct,
  count(*) filter (where a.correct) - count(*) filter (where not a.correct) as score,
  coalesce(avg(case when a.correct then 1.0 else 0.0 end), 0) as accuracy
from profiles p
join math_trainer_attempts a on a.user_id = p.id
group by p.id, p.pseudo;

-- ---------------------------------------------------------------------------
-- Fiche joueur : une table unique pour TOUTES les tentatives, quel que soit
-- l'exercice. Les tables par exercice (attempts, pot_odds_attempts, …) restent
-- pour leurs classements ; celle-ci sert uniquement au calcul des compétences,
-- et évite d'avoir à rejoindre cinq tables de formes différentes pour tracer un
-- radar. `score` est déjà normalisé dans [0,1] par src/lib/poker/skillScore.js,
-- `chance` est le score qu'obtiendrait le hasard sur cette question.
-- ---------------------------------------------------------------------------
create table if not exists skill_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  exercise text not null,
  question_type text,
  score real not null check (score >= 0 and score <= 1),
  chance real not null default 0 check (chance >= 0 and chance < 1),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists skill_attempts_user_created_idx
  on skill_attempts (user_id, created_at desc);

alter table skill_attempts enable row level security;

drop policy if exists "skill_attempts are readable by any authenticated user" on skill_attempts;
create policy "skill_attempts are readable by any authenticated user"
  on skill_attempts for select
  to authenticated
  using (true);

drop policy if exists "users can insert their own skill attempts" on skill_attempts;
create policy "users can insert their own skill attempts"
  on skill_attempts for insert
  to authenticated
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Informations personnelles. Table SEPAREE de `profiles` pour une raison
-- precise : `profiles` est lisible par tout utilisateur connecte (c'est ce qui
-- fait fonctionner les classements, qui affichent les pseudos). Y ajouter une
-- adresse ou un telephone les rendrait visibles par tous les eleves. Ici,
-- chacun ne lit que sa propre ligne — le coach excepte, qui a besoin des
-- coordonnees de ses eleves.
-- Le pseudo, lui, reste sur `profiles` : il est public par nature.
-- L'email n'est pas stocke : il vit deja dans auth.users et se lit cote client.
-- ---------------------------------------------------------------------------
create table if not exists profile_private (
  id uuid primary key references profiles(id) on delete cascade,
  discord text,
  telephone text,
  adresse text,
  rooms text,          -- pseudos utilises sur les rooms (Winamax, Stars...)
  abi text,            -- buy-in moyen
  formats text,        -- MTT, PKO, SNG, spins...
  objectif text,       -- objectif de la saison
  dispos text,         -- fuseau horaire et creneaux de coaching
  updated_at timestamptz not null default now()
);

alter table profile_private enable row level security;

drop policy if exists "users read their own private profile" on profile_private;
create policy "users read their own private profile"
  on profile_private for select
  to authenticated
  using (
    auth.uid() = id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "users insert their own private profile" on profile_private;
create policy "users insert their own private profile"
  on profile_private for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "users update their own private profile" on profile_private;
create policy "users update their own private profile"
  on profile_private for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Acces par cle d'activation (2026-09-17)
-- Tout le site est ferme : seul un compte qui a active une cle valide, ou un
-- admin, passe le proxy (src/proxy.js). Les cles sont generees par le coach,
-- a usage unique, sans expiration, revocables a tout moment.
--
-- La cle est reservee DANS la base, au moment ou le compte est cree (trigger
-- sur auth.users) : appeler l'inscription Supabase directement, sans passer par
-- la page, ne permet pas de la contourner.
-- ---------------------------------------------------------------------------
create table if not exists access_keys (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  label text,                 -- eleve a qui la cle est destinee
  created_at timestamptz not null default now(),
  used_by uuid references auth.users(id) on delete set null,
  used_email text,
  used_at timestamptz,        -- une cle utilisee le reste, meme si le compte est supprime
  consent_at timestamptz,     -- consentement au stockage des donnees de suivi
  revoked_at timestamptz,
  revoked_reason text         -- 'manuel' ; plus tard 'inactivite' ou 'abonnement' pour une fermeture automatique
);

alter table access_keys enable row level security;

drop policy if exists "admins manage access keys" on access_keys;
create policy "admins manage access keys"
  on access_keys for all
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Acces du compte connecte : admin, ou au moins une cle activee et non revoquee.
create or replace function has_access()
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (select 1 from access_keys k where k.used_by = auth.uid() and k.revoked_at is null)
  );
$$;

-- Etat detaille pour la page /acces : 'actif', 'revoque' (avait une cle, toutes
-- revoquees) ou 'aucun'.
create or replace function my_access_state()
returns text
language sql stable security definer set search_path = public
as $$
  select case
    when has_access() then 'actif'
    when exists (select 1 from access_keys k where k.used_by = auth.uid()) then 'revoque'
    else 'aucun'
  end;
$$;

-- Verification avant inscription, pour afficher un message precis. Le pseudo
-- n'est teste que si la cle est bonne : sans cle, on n'apprend rien des comptes.
create or replace function check_activation(p_code text, p_pseudo text)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare k access_keys%rowtype;
begin
  select * into k from access_keys where code = upper(trim(p_code));
  if not found then return 'cle_inconnue'; end if;
  if k.revoked_at is not null then return 'cle_revoquee'; end if;
  if k.used_at is not null then return 'cle_utilisee'; end if;
  if exists (select 1 from profiles where lower(pseudo) = lower(trim(p_pseudo))) then
    return 'pseudo_pris';
  end if;
  return 'ok';
end;
$$;

-- Reserve la cle a la creation du compte. Sans cle dans les metadonnees (compte
-- cree a la main depuis le tableau de bord Supabase), on laisse passer : le
-- compte existe mais n'a acces a rien tant qu'une cle n'est pas activee.
create or replace function claim_access_key_on_signup()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_code text := upper(trim(coalesce(new.raw_user_meta_data->>'access_key', '')));
begin
  if v_code = '' then return new; end if;
  update access_keys
     set used_by = new.id, used_email = new.email, used_at = now(),
         consent_at = case when new.raw_user_meta_data->>'consent' = 'true' then now() end
   where code = v_code and used_at is null and revoked_at is null;
  if not found then
    raise exception 'cle d''activation invalide, deja utilisee ou revoquee';
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_claim_access_key on auth.users;
create trigger on_auth_user_claim_access_key
  after insert on auth.users
  for each row execute function claim_access_key_on_signup();

-- Activation par un compte deja connecte : compte cree avant les cles, ou acces
-- revoque puis nouvelle cle.
create or replace function redeem_access_key(p_code text, p_consent boolean)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_status text;
begin
  if auth.uid() is null then return 'non_connecte'; end if;
  update access_keys
     set used_by = auth.uid(),
         used_email = (select email from auth.users where id = auth.uid()),
         used_at = now(),
         consent_at = case when p_consent then now() end
   where code = upper(trim(p_code)) and used_at is null and revoked_at is null;
  if found then return 'ok'; end if;
  select case when revoked_at is not null then 'cle_revoquee' else 'cle_utilisee' end
    into v_status
    from access_keys where code = upper(trim(p_code));
  return coalesce(v_status, 'cle_inconnue');
end;
$$;

grant execute on function has_access() to anon, authenticated;
grant execute on function my_access_state() to authenticated;
grant execute on function check_activation(text, text) to anon, authenticated;
grant execute on function redeem_access_key(text, boolean) to authenticated;
