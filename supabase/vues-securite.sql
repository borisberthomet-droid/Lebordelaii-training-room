-- Fermer les VUES, qui etaient restees ouvertes — a executer dans l'editeur SQL de Supabase.
-- Rejouable sans risque : rien n'est supprime, rien n'est ecrase.
--
-- Le probleme, mesure et non suppose. Avec la seule cle publique du navigateur, SANS COMPTE,
-- l'API renvoyait aujourd'hui :
--   player_stats          4 lignes  (pseudo + points de chaque eleve)
--   pot_odds_stats        1 ligne
--   range_builder_stats   1 ligne
--   math_trainer_stats    1 ligne
-- Les tables, elles, repondaient bien [] : acces-2-verrouiller.sql a fait son travail.
--
-- Pourquoi les vues passaient a travers. Une vue n'a pas de RLS a elle. Par defaut elle s'execute
-- avec les droits de SON PROPRIETAIRE, pas de celui qui l'interroge : elle lit donc les tables
-- sans que leurs politiques s'appliquent, et Supabase accorde la lecture des vues du schema
-- public a anon. Verrouiller les tables ne suffisait pas.
--
-- security_invoker renverse ca : la vue s'execute avec les droits de l'appelant, donc RLS
-- s'applique comme sur les tables. Un anonyme ne voit rien ; un eleve a jour voit les classements ;
-- un eleve dont la cle est revoquee ou echue ne voit plus rien, lui non plus.
--
-- Le REVOKE qui suit fait doublon avec security_invoker, volontairement : il ne depend d'aucune
-- version de PostgreSQL et ferme la porte aux anonymes meme si l'option etait perdue un jour
-- (une vue recreee par un DROP puis CREATE recupere les privileges par defaut du schema).

alter view player_stats          set (security_invoker = on);
alter view pot_odds_stats        set (security_invoker = on);
alter view range_builder_stats   set (security_invoker = on);
alter view math_trainer_stats    set (security_invoker = on);
alter view find_it_sim_stats     set (security_invoker = on);
alter view coaching_totals       set (security_invoker = on);

revoke select on player_stats, pot_odds_stats, range_builder_stats,
                 math_trainer_stats, find_it_sim_stats, coaching_totals
  from anon;

-- Les classements restent lisibles par les eleves connectes et a jour, qui en ont besoin.
grant select on player_stats, pot_odds_stats, range_builder_stats,
                math_trainer_stats, find_it_sim_stats, coaching_totals
  to authenticated;

-- Verification immediate : a executer ensuite pour voir le resultat, une ligne par vue.
select c.relname as vue,
       case when 'security_invoker=on' = any (c.reloptions) then 'OK' else 'A REFAIRE' end as invoker,
       case when has_table_privilege('anon', c.oid, 'select') then 'ANONYME PEUT LIRE' else 'ok' end as anon
  from pg_class c
 where c.relkind = 'v'
   and c.relnamespace = 'public'::regnamespace
 order by invoker desc, vue;
