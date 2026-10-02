-- Acces a duree determinee (3/3) — a executer dans l'editeur SQL de Supabase.
-- Rejouable sans risque : rien n'est supprime, rien n'est ecrase.
--
-- Une cle porte desormais une duree choisie a la creation : 1, 3, 6, 12 mois, ou indeterminee.
--
-- Le compte a rebours demarre A L'ACTIVATION, pas a la creation. Une cle remise a un eleve qui
-- s'inscrit trois semaines plus tard ne doit pas lui manger trois semaines de ce qu'il a paye :
-- c'est la seule regle qui rend la duree vendable.
--
-- Les cles DEJA activees gardent expire_le a null, donc un acces sans echeance. Personne ne perd
-- son acces du jour au lendemain a cause de ce fichier ; une echeance se pose ensuite a la main,
-- depuis la page d'administration.

alter table access_keys add column if not exists duree_mois integer;
alter table access_keys add column if not exists expire_le  timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'access_keys_duree_mois_check') then
    alter table access_keys add constraint access_keys_duree_mois_check
      check (duree_mois is null or duree_mois between 1 and 120);
  end if;
end $$;

comment on column access_keys.duree_mois is 'Duree vendue, en mois. null = sans echeance.';
comment on column access_keys.expire_le  is 'Echeance, calculee a l''activation. null = sans echeance.';

create index if not exists access_keys_expire_idx on access_keys (expire_le) where expire_le is not null;

-- ---------------------------------------------------------------------------
-- Le controle d'acces lui-meme. Une echeance depassee ferme la porte exactement comme une
-- revocation — mais les deux restent distinctes dans la table, parce que « abonnement termine »
-- et « acces retire » ne se racontent pas pareil a un eleve.
-- ---------------------------------------------------------------------------
create or replace function has_access()
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    or exists (
      select 1 from access_keys k
       where k.used_by = auth.uid()
         and k.revoked_at is null
         and (k.expire_le is null or k.expire_le > now())
    )
  );
$$;

-- Etat detaille + echeance, pour la page /acces et l'avertissement de fin d'abonnement.
-- Renvoie du jsonb plutot qu'un texte : l'ecran a besoin de la date, pas seulement du verdict.
create or replace function mon_acces()
returns jsonb
language sql stable security definer set search_path = public
as $$
  with mienne as (
    -- La « meilleure » cle de l'eleve : active avant revoquee, sans echeance avant datee, puis
    -- la plus lointaine. C'est celle qui decide de ce qu'on lui affiche.
    select k.*
      from access_keys k
     where k.used_by = auth.uid()
     order by (k.revoked_at is null) desc,
              (k.expire_le is null) desc,
              k.expire_le desc
     limit 1
  )
  select jsonb_build_object(
    'etat', case
      when has_access() then 'actif'
      when exists (select 1 from access_keys k
                    where k.used_by = auth.uid()
                      and k.revoked_at is null
                      and k.expire_le is not null
                      and k.expire_le <= now())              then 'expire'
      when exists (select 1 from access_keys k
                    where k.used_by = auth.uid())            then 'revoque'
      else                                                        'aucun'
    end,
    'expire_le', (select expire_le from mienne),
    'jours', (select case when expire_le is null then null
                          else greatest(0, ceil(extract(epoch from (expire_le - now())) / 86400))::int
                     end from mienne)
  );
$$;

-- Conserve pour les appels existants : meme question, reponse en un mot.
create or replace function my_access_state()
returns text
language sql stable security definer set search_path = public
as $$ select mon_acces() ->> 'etat'; $$;

-- ---------------------------------------------------------------------------
-- Activation : c'est ici que l'echeance se pose. Dans un UPDATE, « duree_mois » a droite du
-- signe egal designe la valeur AVANT mise a jour, donc bien la duree portee par la cle.
-- ---------------------------------------------------------------------------
create or replace function claim_access_key_on_signup()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_code text := upper(trim(coalesce(new.raw_user_meta_data->>'access_key', '')));
begin
  if v_code = '' then return new; end if;
  update access_keys
     set used_by = new.id, used_email = new.email, used_at = now(),
         consent_at = case when new.raw_user_meta_data->>'consent' = 'true' then now() end,
         expire_le = case when duree_mois is not null
                          then now() + make_interval(months => duree_mois) end
   where code = v_code and used_at is null and revoked_at is null;
  if not found then
    raise exception 'cle d''activation invalide, deja utilisee ou revoquee';
  end if;
  return new;
end;
$$;

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
         consent_at = case when p_consent then now() end,
         expire_le = case when duree_mois is not null
                          then now() + make_interval(months => duree_mois) end
   where code = upper(trim(p_code)) and used_at is null and revoked_at is null;
  if found then return 'ok'; end if;
  select case when revoked_at is not null then 'cle_revoquee' else 'cle_utilisee' end
    into v_status
    from access_keys where code = upper(trim(p_code));
  return coalesce(v_status, 'cle_inconnue');
end;
$$;

grant execute on function has_access()       to anon, authenticated;
grant execute on function mon_acces()        to authenticated;
grant execute on function my_access_state()  to authenticated;
