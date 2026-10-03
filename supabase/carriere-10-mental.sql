-- Gestion de carriere 10 — evaluation mentale.
-- A executer dans l'editeur SQL de Supabase. Rejouable sans risque.
--
-- Pourquoi une table a part, alors que self_assessments existe deja. L'auto-evaluation couvre une
-- vingtaine de competences : on la remplit deux ou trois fois par an. Celle-ci se remplit tous les
-- quinze jours et tient en trois curseurs. Les melanger, c'est soit alourdir le rendez-vous
-- bimensuel jusqu'a ce qu'il ne soit plus tenu, soit produire des snapshots a trous dans l'autre.
-- Deux rythmes, deux tables.
--
-- Les AXES vivent dans le code (src/lib/carriere/mental.js) : le coach mental de Boris en demande
-- trois aujourd'hui, un quatrieme ne doit pas demander une migration. D'ou le jsonb.

create table if not exists mental_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  fait_le date not null default current_date,
  -- { "confiance": 70, "relachement": 55, "connaissance": 80 } — notes de 0 a 100.
  scores jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now(),
  -- Une evaluation par jour et par joueur : revenir sur celle du jour la corrige au lieu d'en
  -- empiler deux, ce qui fausserait une courbe.
  unique (user_id, fait_le)
);

create index if not exists mental_checkins_user_idx on mental_checkins (user_id, fait_le desc);

alter table mental_checkins enable row level security;

-- Meme regle que les auto-evaluations : l'auteur et son coach. C'est le but du suivi, et la page
-- le dit noir sur blanc a l'eleve avant qu'il ne saisisse quoi que ce soit.
drop policy if exists "mental lu par son auteur ou le coach" on mental_checkins;
create policy "mental lu par son auteur ou le coach"
  on mental_checkins for select to authenticated
  using (auth.uid() = user_id or est_coach());

-- Ecrit par son auteur SEULEMENT. Le coach ne note pas le mental de quelqu'un d'autre a sa
-- place : une auto-evaluation que l'on n'a pas ecrite soi-meme ne mesure plus rien.
drop policy if exists "mental ecrit par son auteur" on mental_checkins;
create policy "mental ecrit par son auteur"
  on mental_checkins for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
