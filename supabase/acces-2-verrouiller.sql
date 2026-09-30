-- Fermer aussi la BASE, pas seulement le site — a executer dans l'editeur SQL de Supabase.
--
-- Pourquoi ce fichier existe. Le proxy du site verifie has_access() a chaque page, mais il ne
-- protege que ce qui passe par le site. La base, elle, reste joignable directement avec la cle
-- publique (celle du navigateur, qui n'est pas un secret : c'est RLS qui fait la frontiere).
-- Aujourd'hui, deux personnes y liraient des choses :
--   - un eleve dont la cle vient d'etre revoquee, tant que sa session vit ;
--   - n'importe qui, en creant un compte directement par l'API sans passer par la page
--     d'activation : il n'obtient aucun acces au site, mais il est « authentifie ».
-- Ni l'un ni l'autre n'accede aux simulations (elles sont servies par le site, donc filtrees),
-- mais tous deux liraient les spots, les ranges de reference et les resultats des autres.
--
-- Apres ce fichier, « revoquer une cle » veut vraiment dire quelque chose.
--
-- Les profils restent lisibles : ils ne contiennent qu'un pseudo et un role, les classements en
-- ont besoin, et c'est la table sur laquelle has_access() s'appuie.

-- Contenus d'entrainement.
drop policy if exists "spots are readable by any authenticated user" on spots;
create policy "spots lisibles par un acces actif"
  on spots for select to authenticated using (has_access());

drop policy if exists "range_spots are readable by any authenticated user" on range_spots;
create policy "range_spots lisibles par un acces actif"
  on range_spots for select to authenticated using (has_access());

drop policy if exists "skill_items lisibles par tous" on skill_items;
create policy "skill_items lisibles par un acces actif"
  on skill_items for select to authenticated using (has_access());

-- Resultats. Ils alimentent les classements, donc ils restent lisibles entre eleves — mais
-- seulement pour ceux qui ont un acces actif.
drop policy if exists "attempts are readable by any authenticated user" on attempts;
create policy "attempts lisibles par un acces actif"
  on attempts for select to authenticated using (has_access());

drop policy if exists "pot_odds_attempts are readable by any authenticated user" on pot_odds_attempts;
create policy "pot_odds_attempts lisibles par un acces actif"
  on pot_odds_attempts for select to authenticated using (has_access());

drop policy if exists "range_attempts are readable by any authenticated user" on range_attempts;
create policy "range_attempts lisibles par un acces actif"
  on range_attempts for select to authenticated using (has_access());

drop policy if exists "skill_attempts are readable by any authenticated user" on skill_attempts;
create policy "skill_attempts lisibles par un acces actif"
  on skill_attempts for select to authenticated using (has_access());
