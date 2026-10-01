-- VERIFICATION, rien de plus : ce fichier ne modifie rien, il lit et rend un verdict.
-- A coller dans l'editeur SQL de Supabase, puis me renvoyer le tableau.
--
-- Pourquoi : je n'ai pas d'acces direct a la base. Plutot que de te croire sur parole ou de te
-- faire relire du SQL, cette requete repond elle-meme a la question « le verrouillage est-il en
-- place ? ». Un seul mot a lire par ligne, dans la colonne verdict.
--
-- UNE SEULE requete, volontairement : l'editeur SQL de Supabase n'affiche que le resultat du
-- dernier statement. Trois requetes separees n'en auraient montre qu'une.

with attendu(tbl) as (
  values ('spots'), ('range_spots'), ('skill_items'),
         ('attempts'), ('pot_odds_attempts'), ('range_attempts'), ('skill_attempts')
),

-- RLS additionne les politiques (OU logique) : une seule ancienne politique restee ouverte
-- suffit a tout rouvrir. On les compte donc toutes, pas seulement la nouvelle.
pol as (
  select a.tbl,
         count(p.policyname)                                       as nb_select,
         count(*) filter (where p.qual ilike '%has_access%')        as avec_controle,
         -- est_coach() et les politiques admin sont PLUS strictes que has_access(), pas plus
         -- laxistes : les compter comme des trous ferait crier au loup (cas vecu sur skill_items).
         count(*) filter (where p.qual is not null
                            and p.qual not ilike '%has_access%'
                            and p.qual not ilike '%est_coach%'
                            and p.qual not ilike '%admin%')         as sans_controle,
         string_agg(p.policyname, ' + ')                            as noms
  from attendu a
  left join pg_policies p
    on p.schemaname = 'public' and p.tablename = a.tbl and p.cmd in ('SELECT', 'ALL')
  group by a.tbl
),

verrouillage as (
  select
    '1 verrouillage'::text as section,
    pol.tbl::text          as objet,
    case
      when c.oid is null          then 'TABLE INTROUVABLE'
      when not c.relrowsecurity   then 'A REFAIRE : RLS desactive'
      when pol.nb_select = 0      then 'A REFAIRE : aucune politique de lecture'
      when pol.sans_controle > 0  then 'A REGARDER : politique encore ouverte'
      when pol.avec_controle > 0  then 'OK'
      else                             'A REGARDER'
    end::text              as verdict,
    coalesce(pol.noms, 'aucune politique')::text as detail
  from pol
  left join pg_class c
    on c.relname = pol.tbl and c.relnamespace = 'public'::regnamespace
),

-- 'utilisee' veut dire qu'un compte a ete cree avec : une cle ne sert qu'une fois.
cles as (
  select
    '2 cle'::text as section,
    k.code::text  as objet,
    case
      when k.revoked_at is not null then 'revoquee'
      when k.used_at    is not null then 'utilisee'
      else                               'libre'
    end::text     as verdict,
    concat_ws(' - ',
      'pour ' || coalesce(k.label, 'personne en particulier'),
      k.used_email,
      case when p.pseudo is not null then 'pseudo ' || p.pseudo end,
      case when k.used_at is not null
           then 'le ' || to_char(k.used_at at time zone 'Europe/Paris', 'DD/MM/YYYY HH24:MI') end,
      case when k.consent_at is not null then 'consentement donne' end,
      k.revoked_reason
    )::text       as detail
  from access_keys k
  left join profiles p on p.id = k.used_by
),

-- Un compte ici n'est pas un probleme en soi : c'est une inscription restee en chemin, qui ne
-- passe pas le proxy. Ce qui compte, c'est que la section 1 soit OK partout — alors ce compte ne
-- lit rien non plus en attaquant la base directement.
orphelins as (
  select
    '3 compte sans acces'::text as section,
    coalesce(p.pseudo, '(sans pseudo)')::text as objet,
    ('role ' || coalesce(p.role::text, '?'))::text as verdict,
    ('cree le ' || to_char(p.created_at at time zone 'Europe/Paris', 'DD/MM/YYYY HH24:MI'))::text as detail
  from profiles p
  where coalesce(p.role::text, '') <> 'admin'
    and not exists (
      select 1 from access_keys k where k.used_by = p.id and k.revoked_at is null
    )
)

select * from verrouillage
union all select * from cles
union all select * from orphelins
order by section, verdict, objet;
