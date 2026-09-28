-- Gestion de carriere 3/5 — leak finder
-- A executer dans l'editeur SQL de Supabase, dans l'ordre des numeros.
-- Rejouable sans risque : rien n'est supprime, rien n'est ecrase.

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
