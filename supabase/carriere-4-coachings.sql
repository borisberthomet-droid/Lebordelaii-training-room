-- Gestion de carriere 4/5 — coachings, syntheses, packs
-- A executer dans l'editeur SQL de Supabase, dans l'ordre des numeros.
-- Rejouable sans risque : rien n'est supprime, rien n'est ecrase.

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
