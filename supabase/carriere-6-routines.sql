-- Gestion de carriere 6/6 — « routines » remplace « recurrences »
-- A executer une fois, apres les cinq premiers fichiers. Rejouable : chaque instruction verifie
-- que l'objet existe encore sous son ancien nom.

alter table if exists task_recurrences rename to routines;
alter table if exists tasks rename column recurrence_id to routine_id;
alter index if exists tasks_recurrence_jour_idx rename to tasks_routine_jour_idx;

do $$
begin
  if exists (select 1 from pg_policies where tablename = 'routines'
             and policyname = 'recurrences lues par le joueur ou le coach') then
    alter policy "recurrences lues par le joueur ou le coach" on routines
      rename to "routines lues par le joueur ou le coach";
  end if;
  if exists (select 1 from pg_policies where tablename = 'routines'
             and policyname = 'recurrences ecrites par le joueur') then
    alter policy "recurrences ecrites par le joueur" on routines
      rename to "routines ecrites par le joueur";
  end if;
end $$;
