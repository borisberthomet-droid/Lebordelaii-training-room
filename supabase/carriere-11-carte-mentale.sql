-- Gestion de carriere 11 — mantra et photo personnelle de la carte mentale.
-- A executer dans l'editeur SQL de Supabase. Rejouable sans risque.
--
-- Deux champs sur la fiche privee, et un bucket pour l'image. Le mantra tient dans
-- profile_private parce qu'il appartient a la personne, pas a une evaluation datee : il ne change
-- pas tous les quinze jours, et il n'a pas a etre historise.

alter table profile_private add column if not exists mantra text;
alter table profile_private add column if not exists photo_mentale text;   -- chemin dans le bucket `mental`

comment on column profile_private.mantra is
  'Phrase que le joueur se repete. Affichee sur son tableau de bord, visible du coach.';
comment on column profile_private.photo_mentale is
  'Chemin de l''image dans le bucket Storage « mental ». null = pas de photo.';

-- ---------------------------------------------------------------------------
-- Bucket prive : on ne sert que des liens signes, jamais d'URL publique. Une photo que l'on
-- choisit pour se mettre dans un etat d'esprit est personnelle ; elle n'a aucune raison d'etre
-- devinable par quelqu'un qui connaitrait le nom du fichier.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('mental', 'mental', false)
on conflict (id) do nothing;

-- Contrairement aux captures du Leak Finder, c'est le JOUEUR qui depose : c'est sa photo.
-- Le chemin commence par son identifiant, et la policy l'y enferme.
drop policy if exists "photo mentale deposee par son joueur" on storage.objects;
create policy "photo mentale deposee par son joueur"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'mental' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "photo mentale remplacee par son joueur" on storage.objects;
create policy "photo mentale remplacee par son joueur"
  on storage.objects for update to authenticated
  using (bucket_id = 'mental' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'mental' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "photo mentale supprimee par son joueur" on storage.objects;
create policy "photo mentale supprimee par son joueur"
  on storage.objects for delete to authenticated
  using (bucket_id = 'mental' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "photo mentale lue par son joueur ou le coach" on storage.objects;
create policy "photo mentale lue par son joueur ou le coach"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'mental'
    and (est_coach() or (storage.foldername(name))[1] = auth.uid()::text)
  );
