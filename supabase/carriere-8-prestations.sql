-- Gestion de carriere 8 — prestations vendues et leur avancement.
-- A executer dans l'editeur SQL de Supabase. Rejouable sans risque.
--
-- Ce qui manquait : savoir, pour chaque eleve, ce qu'il a commande, s'il a paye, et ou en est la
-- prestation. C'etait dans la tete du coach et dans ses messages Discord.
--
-- L'avancement est stocke comme une suite de JALONS DATES, pas comme un numero d'etape. Un numero
-- dit « on en est a 3 » ; les jalons disent « commande le 2, analyse le 5, restitution le 11 »,
-- ce qui est exactement ce qu'un suivi de colis affiche — et ce qui permet, trois mois plus tard,
-- de repondre a « ca a pris combien de temps ? ». L'etape courante se deduit du nombre de jalons,
-- donc elle ne peut pas contredire les dates : il n'y a qu'une seule source de verite.
--
-- Les libelles des etapes vivent dans le code (src/lib/carriere/prestations.js) et non ici :
-- reformuler « restitution » ne doit pas demander une migration.

create table if not exists prestations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null default 'leakfinder'
    check (type in ('leakfinder', 'coaching', 'duo', 'seminaire', 'autre')),
  libelle text,                       -- pour 'autre', ou pour preciser
  commandee_le date not null default current_date,

  montant numeric check (montant is null or montant >= 0),
  paiement text not null default 'attendu'
    check (paiement in ('attendu', 'recu', 'offert')),
  paye_le date,

  -- { "1": "2026-10-02", "2": "2026-10-05" } — une date par etape franchie.
  jalons jsonb not null default '{}'::jsonb,
  statut text not null default 'en_cours'
    check (statut in ('en_cours', 'terminee', 'annulee')),

  -- Visible par l'eleve : c'est le mot qui accompagne le suivi, pas un pense-bete de coach.
  -- RLS filtre des lignes, pas des colonnes — ce qui est ecrit ici sera lu.
  note text,

  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists prestations_user_idx on prestations (user_id, commandee_le desc);

alter table prestations enable row level security;

-- L'eleve voit ses prestations : c'est le but, qu'il puisse suivre sa commande sans demander.
drop policy if exists "prestations lues par le joueur ou le coach" on prestations;
create policy "prestations lues par le joueur ou le coach"
  on prestations for select to authenticated
  using (auth.uid() = user_id or est_coach());

drop policy if exists "prestations ecrites par le coach" on prestations;
create policy "prestations ecrites par le coach"
  on prestations for all to authenticated
  using (est_coach()) with check (est_coach());
