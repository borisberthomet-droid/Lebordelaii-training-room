-- Gestion de carriere 5/5 — bucket des captures
-- A executer dans l'editeur SQL de Supabase, dans l'ordre des numeros.
-- Rejouable sans risque : rien n'est supprime, rien n'est ecrase.

-- ---------------------------------------------------------------------------
-- 9. Stockage des captures Leak Finder. Bucket privé : on ne sert que des liens signés.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('leakfinder', 'leakfinder', false)
on conflict (id) do nothing;

drop policy if exists "captures deposees par le coach" on storage.objects;
create policy "captures deposees par le coach"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'leakfinder' and est_coach());

drop policy if exists "captures supprimees par le coach" on storage.objects;
create policy "captures supprimees par le coach"
  on storage.objects for delete to authenticated
  using (bucket_id = 'leakfinder' and est_coach());

-- Le joueur ne lit que le dossier à son nom : le chemin commence par son identifiant.
drop policy if exists "captures lues par leur joueur ou le coach" on storage.objects;
create policy "captures lues par leur joueur ou le coach"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'leakfinder'
    and (est_coach() or (storage.foldername(name))[1] = auth.uid()::text)
  );
