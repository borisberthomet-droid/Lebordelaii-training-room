-- VERIFICATION, rien de plus : ce fichier ne modifie rien, il lit et rend un verdict.
-- A coller dans l'editeur SQL de Supabase, puis me renvoyer les deux tableaux.
--
-- Pourquoi : je n'ai pas d'acces direct a la base. Plutot que de te croire sur parole ou de
-- te faire relire du SQL, cette requete repond elle-meme a la question « le verrouillage est-il
-- en place ? ». Un seul mot a lire par ligne.

-- ---------------------------------------------------------------------------
-- 1. Verrouillage (acces-2-verrouiller.sql) : les 7 tables sensibles ne doivent etre lisibles
--    qu'avec un acces actif. RLS additionne les politiques (OU logique) : une seule ancienne
--    politique restee ouverte suffit a tout rouvrir, donc on les compte toutes.
-- ---------------------------------------------------------------------------
with attendu(tbl) as (
  values ('spots'), ('range_spots'), ('skill_items'),
         ('attempts'), ('pot_odds_attempts'), ('range_attempts'), ('skill_attempts')
),
pol as (
  select a.tbl,
         count(p.policyname)                                                    as nb_select,
         count(*) filter (where p.qual ilike '%has_access%')                    as avec_controle,
         count(*) filter (where p.qual is not null
                            and p.qual not ilike '%has_access%'
                            and p.qual not ilike '%role%admin%')                as sans_controle,
         string_agg(p.policyname || ' => ' || coalesce(p.qual, 'null'), ' | ')   as detail
  from attendu a
  left join pg_policies p
    on p.schemaname = 'public' and p.tablename = a.tbl and p.cmd in ('SELECT', 'ALL')
  group by a.tbl
)
select
  pol.tbl                                                as table_sensible,
  case when c.relrowsecurity then 'oui' else 'NON' end   as rls_active,
  case
    when not c.relrowsecurity          then 'A REFAIRE (RLS desactive)'
    when pol.nb_select = 0             then 'A REFAIRE (aucune politique de lecture)'
    when pol.sans_controle > 0         then 'A REGARDER (politique encore ouverte)'
    when pol.avec_controle > 0         then 'OK'
    else                                    'A REGARDER'
  end                                                    as verdict,
  pol.detail                                             as politiques
from pol
join pg_class c on c.relname = pol.tbl and c.relnamespace = 'public'::regnamespace
order by verdict, table_sensible;

-- ---------------------------------------------------------------------------
-- 2. Cles d'activation : qui est entre, avec quelle cle, et laquelle reste libre.
--    'utilisee' veut dire qu'un compte a ete cree avec : une cle ne sert qu'une fois.
-- ---------------------------------------------------------------------------
select
  k.code,
  coalesce(k.label, '—')                                   as destinataire,
  case
    when k.revoked_at is not null then 'revoquee'
    when k.used_at    is not null then 'utilisee'
    else                               'libre'
  end                                                      as etat,
  coalesce(k.used_email, '—')                              as compte,
  p.pseudo,
  to_char(k.used_at    at time zone 'Europe/Paris', 'DD/MM/YYYY HH24:MI') as activee_le,
  case when k.consent_at is not null then 'oui' else 'non' end            as consentement,
  to_char(k.created_at at time zone 'Europe/Paris', 'DD/MM/YYYY')         as creee_le
from access_keys k
left join profiles p on p.id = k.used_by
order by k.created_at;

-- ---------------------------------------------------------------------------
-- 3. Comptes sans acces : crees d'une facon ou d'une autre, mais qui ne passent pas le proxy.
--    Un compte ici n'est pas un probleme en soi — c'est une inscription restee en chemin.
--    Ce qui compte, c'est que le verdict de la section 1 soit OK partout : alors ce compte ne
--    lit rien non plus en attaquant la base directement.
-- ---------------------------------------------------------------------------
select
  p.pseudo,
  p.role,
  to_char(p.created_at at time zone 'Europe/Paris', 'DD/MM/YYYY HH24:MI') as cree_le
from profiles p
where p.role <> 'admin'
  and not exists (select 1 from access_keys k where k.used_by = p.id and k.revoked_at is null)
order by p.created_at;
