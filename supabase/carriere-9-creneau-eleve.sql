-- Gestion de carriere 9 — l'eleve note son creneau lui-meme.
-- A executer dans l'editeur SQL de Supabase. Rejouable sans risque.
--
-- Le creneau est convenu entre le coach et l'eleve AVANT, par message. Il ne s'agit donc pas
-- d'une reservation a valider : l'eleve ne fait qu'enregistrer ce qui est deja decide, pour que
-- la training room le sache. D'ou l'absence de tout circuit de confirmation, qui ferait refaire
-- a l'ecran un accord deja pris.
--
-- Ce que l'eleve peut faire : creer un coaching A VENIR pour lui-meme, en changer la date ou la
-- duree, l'annuler. Rien d'autre.
--
-- Ce qu'il ne peut pas faire, et pourquoi ca ne peut pas passer par les seules policies : RLS
-- filtre des LIGNES, pas des COLONNES. Une policy qui autorise l'eleve a modifier sa ligne
-- l'autoriserait du meme coup a passer son coaching a « fait », a se declarer « paye », ou a
-- ecrire sa propre synthese — trois choses qui appartiennent au coach, et dont deux touchent a
-- l'argent. Le garde-fou est donc un trigger, qui reecrit ces colonnes au lieu de faire confiance.
--
-- Le coach n'est jamais gene par ce trigger : il en sort a la premiere ligne.

create or replace function coaching_garde_fou()
returns trigger
language plpgsql
as $$
begin
  if est_coach() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() then
      raise exception 'on ne note un creneau que pour soi';
    end if;
    -- Un eleve declare un rendez-vous a venir : les colonnes qui engagent le coach ou l'argent
    -- sont remises a leur valeur de depart, quoi qu'il ait envoye.
    new.statut := 'a_venir';
    new.paiement := 'a_payer';
    new.pack_id := null;
    new.synthese := '{}'::jsonb;
    new.synthese_statut := 'brouillon';
    new.created_by := auth.uid();
    if new.date < now() - interval '1 day' then
      raise exception 'un creneau se note a l''avance, pas apres coup';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.statut <> 'a_venir' then
      raise exception 'ce coaching a deja eu lieu : seul le coach peut le modifier';
    end if;
    new.user_id := old.user_id;
    new.statut := old.statut;
    new.paiement := old.paiement;
    new.pack_id := old.pack_id;
    new.synthese := old.synthese;
    new.synthese_statut := old.synthese_statut;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.statut <> 'a_venir' then
      raise exception 'ce coaching a deja eu lieu : seul le coach peut le supprimer';
    end if;
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists coachings_garde_fou on coachings;
create trigger coachings_garde_fou
  before insert or update or delete on coachings
  for each row execute function coaching_garde_fou();

-- Les policies ouvrent la porte ; le trigger ci-dessus dit ce qu'on a le droit d'y faire passer.
-- Elles s'ajoutent a « coachings ecrits par le coach » : RLS additionne les policies.
drop policy if exists "creneau note par le joueur" on coachings;
create policy "creneau note par le joueur"
  on coachings for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "creneau modifie par le joueur" on coachings;
create policy "creneau modifie par le joueur"
  on coachings for update to authenticated
  using (auth.uid() = user_id and statut = 'a_venir')
  with check (auth.uid() = user_id);

drop policy if exists "creneau annule par le joueur" on coachings;
create policy "creneau annule par le joueur"
  on coachings for delete to authenticated
  using (auth.uid() = user_id and statut = 'a_venir');
