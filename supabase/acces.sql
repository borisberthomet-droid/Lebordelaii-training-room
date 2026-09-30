-- Acces par cle d'activation — a executer dans l'editeur SQL de Supabase AVANT le deploiement.
-- Sans ces fonctions, le proxy du site ne trouve pas has_access() et ferme la porte a tout le
-- monde, Boris compris. Rejouable sans risque.

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
