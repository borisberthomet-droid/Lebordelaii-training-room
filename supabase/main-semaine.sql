-- Main de la semaine — a executer dans l'editeur SQL de Supabase.
-- Rejouable sans risque : rien n'est supprime, rien n'est ecrase.
--
-- Un spot de l'editeur peut etre publie comme « main de la semaine » : une vraie main jouee, une
-- vraie range a deviner, un seul essai par eleve. C'est le seul usage qui reste des spots faits a
-- la main — le reste de l'entrainement tourne sur les simulations du solveur.
--
-- La date stockee est le LUNDI de la semaine concernee. Un lundi = une main, d'ou l'index unique :
-- deux mains la meme semaine, et plus personne ne sait laquelle est « la » main.

alter table spots add column if not exists semaine_du date;

create unique index if not exists spots_semaine_du_unique
  on spots (semaine_du) where semaine_du is not null;

comment on column spots.semaine_du is
  'Lundi de la semaine ou ce spot est la main de la semaine. null = spot hors jeu, jouable nulle part.';
